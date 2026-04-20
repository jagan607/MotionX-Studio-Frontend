"use client";

import React, { useState, useRef, useCallback } from "react";
import { Edit2, Sparkles, Trash2, User, MapPin, Palette, Package, Film, Maximize2, Settings } from "lucide-react";

export type NodeType = "scene" | "character" | "location" | "moodboard" | "product";

export interface NodePosition {
    x: number;
    y: number;
}

interface CanvasNodeProps {
    id: string;
    type: NodeType;
    position: NodePosition;
    title: string;
    subtitle?: string;
    imageUrl?: string | null;
    sceneNumber?: number;
    badges?: string[];
    onEdit?: () => void;
    onGenerate?: () => void;
    onDelete?: () => void;
    onImageClick?: () => void;
    onPositionChange?: (id: string, pos: NodePosition) => void;
    isGenerating?: boolean;
    isSelected?: boolean;
    index?: number;
    children?: React.ReactNode;
}

const TYPE_WIDTHS: Record<NodeType, number> = {
    scene: 340,
    character: 160,
    location: 260,
    moodboard: 240,
    product: 150,
};

export function CanvasNode({
    id, type, position, title, subtitle, imageUrl, sceneNumber,
    badges, onEdit, onGenerate, onDelete, onImageClick, onPositionChange,
    isGenerating, isSelected, index = 0, children
}: CanvasNodeProps) {
    const width = TYPE_WIDTHS[type];
    const [isDragging, setIsDragging] = useState(false);
    const dragState = useRef<{ startX: number; startY: number; posX: number; posY: number; moved: boolean } | null>(null);
    const didStartDrag = useRef(false);

    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        if ((e.target as HTMLElement).closest("button")) return;
        e.stopPropagation();
        setIsDragging(true);
        didStartDrag.current = true;
        dragState.current = { startX: e.clientX, startY: e.clientY, posX: position.x, posY: position.y, moved: false };
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }, [position]);

    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        if (!dragState.current) return;
        const scale = getCanvasScale(e.currentTarget);
        const dx = (e.clientX - dragState.current.startX) / scale;
        const dy = (e.clientY - dragState.current.startY) / scale;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragState.current.moved = true;
        if (dragState.current.moved) {
            onPositionChange?.(id, { x: dragState.current.posX + dx, y: dragState.current.posY + dy });
        }
    }, [id, onPositionChange]);

    const handlePointerUp = useCallback((e: React.PointerEvent) => {
        if (!didStartDrag.current) return; // Button click — don't trigger onEdit
        const wasMoved = dragState.current?.moved || false;
        setIsDragging(false);
        dragState.current = null;
        didStartDrag.current = false;
        try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { }
        if (!wasMoved && onEdit) onEdit();
    }, [onEdit]);

    // Polaroid rotation for characters
    const rotation = type === "character" ? (index % 2 === 0 ? -1.5 : 1.8) : 0;

    return (
        <div
            className={`absolute group/node ${isDragging ? 'z-50 cursor-grabbing' : 'z-10 cursor-grab'}`}
            style={{
                left: position.x,
                top: position.y,
                width,
                transform: `rotate(${rotation}deg)`,
                filter: isDragging ? "drop-shadow(0 20px 40px rgba(0,0,0,0.8))" : undefined,
                animation: `nodeEntrance 0.5s cubic-bezier(0.23, 1, 0.32, 1) ${index * 60}ms both`,
                transition: isDragging ? 'none' : 'filter 0.3s ease',
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
        >
            {/* ── Push-pin for characters ── */}
            {type === "character" && (
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-20">
                    <div className="w-4 h-4 rounded-full bg-[#D4A843] shadow-[0_2px_8px_rgba(212,168,67,0.5)] border-2 border-[#B8922E]" />
                </div>
            )}

            {/* ── SCENE: Clapperboard style ── */}
            {type === "scene" && (
                <div
                    className={`rounded-lg overflow-hidden border ${isSelected ? 'border-white/40 shadow-[0_0_30px_rgba(255,255,255,0.1)]' : 'border-white/[0.08] hover:border-white/[0.2]'}`}
                    style={{ background: "linear-gradient(180deg, #1A1A1A 0%, #0D0D0D 100%)" }}
                >
                    {/* Clapperboard top bar */}
                    <div className="relative h-10 overflow-hidden" style={{
                        background: "repeating-linear-gradient(-45deg, #1a1a1a, #1a1a1a 8px, #222 8px, #222 16px)",
                    }}>
                        <div className="absolute inset-0 flex items-center justify-between px-3">
                            <span className="text-[10px] font-bold tracking-[3px] uppercase text-white/30">SCENE</span>
                            <div className="relative z-40 flex items-center gap-1 opacity-0 group-hover/node:opacity-100 transition-opacity">
                                {onEdit && <button onClick={e => { e.stopPropagation(); onEdit(); }} className="p-1.5 text-white/30 hover:text-white rounded transition-all"><Edit2 size={14} /></button>}
                                {onDelete && <button onClick={e => { e.stopPropagation(); onDelete(); }} className="p-1.5 text-white/30 hover:text-red-400 rounded transition-all"><Trash2 size={14} /></button>}
                            </div>
                        </div>
                    </div>
                    {/* Scene number */}
                    <div className="px-4 pt-3">
                        <span className="text-[56px] font-['Anton'] leading-none text-white/[0.06] tracking-tight">
                            {String(sceneNumber ?? 0).padStart(2, "0")}
                        </span>
                    </div>
                    {/* Title + Description */}
                    <div className="px-4 pb-1 -mt-2">
                        <h3 className="text-[13px] font-bold tracking-wide uppercase text-white/80 leading-tight">{title}</h3>
                    </div>
                    {subtitle && (
                        <div className="px-4 pb-3">
                            <p className="text-[11px] text-white/35 leading-relaxed line-clamp-4">{subtitle}</p>
                        </div>
                    )}
                    {/* Character badges */}
                    {badges && badges.length > 0 && (
                        <div className="px-4 pb-3 flex flex-wrap gap-1">
                            {badges.slice(0, 3).map((b, i) => (
                                <span key={i} className="px-2 py-0.5 rounded text-[9px] font-mono uppercase tracking-widest text-[#D4A843]/60 border border-[#D4A843]/15 bg-[#D4A843]/[0.04]">{b}</span>
                            ))}
                        </div>
                    )}
                    <div className="h-[2px]" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)" }} />
                </div>
            )}

            {/* ── CHARACTER: Polaroid style ── */}
            {type === "character" && (
                <div
                    className={`rounded-sm overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.6)] hover:shadow-[0_8px_30px_rgba(212,168,67,0.15)] ${isSelected ? 'ring-2 ring-[#D4A843]' : ''}`}
                    style={{ background: "#F5F0E8", padding: "8px 8px 28px 8px" }}
                >
                    <div className="relative w-full aspect-[3/4] overflow-hidden bg-[#E0D9CE]">
                        {imageUrl ? (
                            <img src={imageUrl} alt={title} className="absolute inset-0 w-full h-full object-cover" />
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <User size={36} className="text-[#C4B9A8]" />
                            </div>
                        )}
                        {isGenerating && (
                            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2">
                                <div className="w-5 h-5 border-2 border-[#D4A843] border-t-transparent rounded-full animate-spin" />
                                <span className="text-[8px] font-mono tracking-widest uppercase text-[#D4A843] animate-pulse">Rendering</span>
                            </div>
                        )}
                        <div className="absolute top-1 right-1 z-40 flex gap-0.5 opacity-0 group-hover/node:opacity-100 transition-opacity">
                            {onGenerate && <button onClick={e => { e.stopPropagation(); onGenerate(); }} className="p-1 bg-black/50 text-white/70 hover:text-[#E50914] rounded transition-all"><Sparkles size={10} /></button>}
                            {onDelete && <button onClick={e => { e.stopPropagation(); onDelete(); }} className="p-1 bg-black/50 text-white/70 hover:text-red-400 rounded transition-all"><Trash2 size={10} /></button>}
                        </div>
                        {/* Center action buttons */}
                        <div className="absolute inset-0 z-30 flex items-center justify-center gap-2 opacity-0 group-hover/node:opacity-100 transition-all duration-200">
                            <div className="absolute inset-0 bg-black/40 transition-opacity" />
                            {imageUrl && onImageClick && (
                                <button
                                    onClick={e => { e.stopPropagation(); onImageClick(); }}
                                    className="relative z-10 flex flex-col items-center gap-1 px-3 py-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg hover:bg-white/20 hover:border-white/40 transition-all cursor-pointer"
                                >
                                    <Maximize2 size={14} className="text-white" />
                                    <span className="text-[7px] font-bold tracking-[2px] uppercase text-white/80">Expand</span>
                                </button>
                            )}
                            {onEdit && (
                                <button
                                    onClick={e => { e.stopPropagation(); onEdit(); }}
                                    className="relative z-10 flex flex-col items-center gap-1 px-3 py-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg hover:bg-white/20 hover:border-white/40 transition-all cursor-pointer"
                                >
                                    <Settings size={14} className="text-[#D4A843]" />
                                    <span className="text-[7px] font-bold tracking-[2px] uppercase text-[#D4A843]/80">Config</span>
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="mt-2 text-center">
                        <h3 className="text-[13px] font-bold text-[#2A2520] tracking-wide" style={{ fontFamily: "'Georgia', serif" }}>{title}</h3>
                        {subtitle && <p className="text-[9px] text-[#8B7D6B] mt-0.5">{subtitle}</p>}
                    </div>
                </div>
            )}

            {/* ── LOCATION: Cinematic letterbox ── */}
            {type === "location" && (
                <div className="relative">
                    <div className="absolute -top-2 right-4 z-20">
                        <div className="w-3.5 h-3.5 rounded-full bg-[#4A90E2] shadow-[0_2px_6px_rgba(74,144,226,0.4)] border-2 border-[#3A7BC8]" />
                        <div className="w-[2px] h-2 bg-[#4A90E2]/60 mx-auto -mt-0.5" />
                    </div>
                    <div className={`rounded-lg overflow-hidden border ${isSelected ? 'border-[#4A90E2]/50 shadow-[0_0_20px_rgba(74,144,226,0.15)]' : 'border-white/[0.06] hover:border-[#4A90E2]/30'}`} style={{ background: "#0A0A0A" }}>
                        <div className="flex items-center gap-0">
                            <div className="w-4 flex-shrink-0 flex flex-col items-center gap-1 py-1">
                                {[...Array(4)].map((_, i) => <div key={i} className="w-2 h-3 rounded-sm bg-white/[0.04]" />)}
                            </div>
                            <div className="relative flex-1 aspect-[2.39/1] overflow-hidden bg-[#0A0A0A]">
                                {imageUrl ? (
                                    <img src={imageUrl} alt={title} className="absolute inset-0 w-full h-full object-cover" />
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <MapPin size={28} className="text-white/[0.06]" />
                                    </div>
                                )}
                                {isGenerating && (
                                    <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-2">
                                        <div className="w-5 h-5 border-2 border-[#4A90E2] border-t-transparent rounded-full animate-spin" />
                                    </div>
                                )}
                                <div className="absolute top-1 right-1 z-40 flex gap-0.5 opacity-0 group-hover/node:opacity-100 transition-opacity">
                                    {onGenerate && <button onClick={e => { e.stopPropagation(); onGenerate(); }} className="p-1 bg-black/50 text-white/70 hover:text-[#E50914] rounded transition-all"><Sparkles size={10} /></button>}
                                    {onDelete && <button onClick={e => { e.stopPropagation(); onDelete(); }} className="p-1 bg-black/50 text-white/70 hover:text-red-400 rounded transition-all"><Trash2 size={10} /></button>}
                                </div>
                                {/* Center action buttons */}
                                <div className="absolute inset-0 z-30 flex items-center justify-center gap-2 opacity-0 group-hover/node:opacity-100 transition-all duration-200">
                                    <div className="absolute inset-0 bg-black/40 transition-opacity" />
                                    {imageUrl && onImageClick && (
                                        <button
                                            onClick={e => { e.stopPropagation(); onImageClick(); }}
                                            className="relative z-10 flex flex-col items-center gap-1 px-3 py-1.5 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg hover:bg-white/20 hover:border-white/40 transition-all cursor-pointer"
                                        >
                                            <Maximize2 size={12} className="text-white" />
                                            <span className="text-[6px] font-bold tracking-[2px] uppercase text-white/80">Expand</span>
                                        </button>
                                    )}
                                    {onEdit && (
                                        <button
                                            onClick={e => { e.stopPropagation(); onEdit(); }}
                                            className="relative z-10 flex flex-col items-center gap-1 px-3 py-1.5 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg hover:bg-white/20 hover:border-white/40 transition-all cursor-pointer"
                                        >
                                            <Settings size={12} className="text-[#4A90E2]" />
                                            <span className="text-[6px] font-bold tracking-[2px] uppercase text-[#4A90E2]/80">Config</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="w-4 flex-shrink-0 flex flex-col items-center gap-1 py-1">
                                {[...Array(4)].map((_, i) => <div key={i} className="w-2 h-3 rounded-sm bg-white/[0.04]" />)}
                            </div>
                        </div>
                        <div className="px-4 py-2">
                            <h3 className="text-[11px] font-bold tracking-[1.5px] uppercase text-white/70">{title}</h3>
                            {subtitle && <p className="text-[9px] text-white/25 mt-0.5 font-mono">{subtitle}</p>}
                        </div>
                    </div>
                </div>
            )}

            {/* ── PRODUCT/PROP: Small reference card ── */}
            {type === "product" && (
                <div className="relative">
                    <div className="absolute -top-2.5 left-3 z-20">
                        <div className="w-3 h-6 rounded-full border-2 border-[#10B981]/50 bg-transparent" />
                    </div>
                    <div className={`rounded-lg overflow-hidden border ${isSelected ? 'border-[#10B981]/40' : 'border-white/[0.06] hover:border-[#10B981]/20'}`} style={{ background: "linear-gradient(180deg, #111, #0A0A0A)" }}>
                        <div className="relative w-full aspect-square overflow-hidden bg-[#080808]">
                            {imageUrl ? (
                                <img src={imageUrl} alt={title} className="absolute inset-0 w-full h-full object-cover" />
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Package size={24} className="text-white/[0.06]" />
                                </div>
                            )}
                            {isGenerating && (
                                <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-2">
                                    <div className="w-4 h-4 border-2 border-[#10B981] border-t-transparent rounded-full animate-spin" />
                                </div>
                            )}
                            <div className="absolute top-1 right-1 z-40 flex gap-0.5 opacity-0 group-hover/node:opacity-100 transition-opacity">
                                {onGenerate && <button onClick={e => { e.stopPropagation(); onGenerate(); }} className="p-1 bg-black/50 text-white/70 hover:text-[#E50914] rounded transition-all"><Sparkles size={10} /></button>}
                                {onDelete && <button onClick={e => { e.stopPropagation(); onDelete(); }} className="p-1 bg-black/50 text-white/70 hover:text-red-400 rounded transition-all"><Trash2 size={10} /></button>}
                            </div>
                            {/* Center action buttons */}
                            <div className="absolute inset-0 z-30 flex items-center justify-center gap-2 opacity-0 group-hover/node:opacity-100 transition-all duration-200">
                                <div className="absolute inset-0 bg-black/40 transition-opacity" />
                                {imageUrl && onImageClick && (
                                    <button
                                        onClick={e => { e.stopPropagation(); onImageClick(); }}
                                        className="relative z-10 flex flex-col items-center gap-1 px-3 py-1.5 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg hover:bg-white/20 hover:border-white/40 transition-all cursor-pointer"
                                    >
                                        <Maximize2 size={12} className="text-white" />
                                        <span className="text-[6px] font-bold tracking-[2px] uppercase text-white/80">Expand</span>
                                    </button>
                                )}
                                {onEdit && (
                                    <button
                                        onClick={e => { e.stopPropagation(); onEdit(); }}
                                        className="relative z-10 flex flex-col items-center gap-1 px-3 py-1.5 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg hover:bg-white/20 hover:border-white/40 transition-all cursor-pointer"
                                    >
                                        <Settings size={12} className="text-[#10B981]" />
                                        <span className="text-[6px] font-bold tracking-[2px] uppercase text-[#10B981]/80">Config</span>
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="px-3 py-2">
                            <h3 className="text-[11px] font-bold text-white/70 truncate">{title}</h3>
                            {subtitle && <p className="text-[8px] text-white/25 mt-0.5 font-mono uppercase tracking-wider">{subtitle}</p>}
                        </div>
                    </div>
                </div>
            )}

            {/* ── MOODBOARD: Color swatch board ── */}
            {type === "moodboard" && (
                <div className={`rounded-lg overflow-hidden border ${isSelected ? 'border-[#E50914]/40' : 'border-white/[0.06] hover:border-[#E50914]/20'}`} style={{ background: "linear-gradient(180deg, #141010, #0A0808)" }}>
                    <div className="px-3 pt-3 pb-1 flex items-center gap-2">
                        <Palette size={10} className="text-[#E50914]/50" />
                        <span className="text-[8px] font-bold tracking-[2.5px] uppercase text-[#E50914]/40">Visual Style</span>
                    </div>
                    <div className="relative mx-3 mb-2 aspect-[16/10] overflow-hidden rounded bg-[#0A0808] border border-white/[0.04]">
                        {imageUrl ? (
                            <img src={imageUrl} alt={title} className="absolute inset-0 w-full h-full object-cover" />
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Palette size={28} className="text-white/[0.06]" />
                            </div>
                        )}
                        <div className="absolute top-1 right-1 z-40 flex gap-0.5 opacity-0 group-hover/node:opacity-100 transition-opacity">
                            {onEdit && <button onClick={e => { e.stopPropagation(); onEdit(); }} className="p-1 bg-black/50 text-white/70 hover:text-white rounded transition-all"><Edit2 size={10} /></button>}
                        </div>
                    </div>
                    <div className="px-3 pb-3">
                        <h3 className="text-[11px] font-bold text-white/60">{title}</h3>
                        {subtitle && <p className="text-[9px] text-white/25 mt-0.5">{subtitle}</p>}
                    </div>
                </div>
            )}

            {children && <div className="mt-2">{children}</div>}
        </div>
    );
}

function getCanvasScale(el: EventTarget): number {
    let current = el as HTMLElement | null;
    while (current) {
        const t = current.style.transform;
        if (t && t.includes("scale")) {
            const m = t.match(/scale\(([^)]+)\)/);
            if (m) return parseFloat(m[1]);
        }
        current = current.parentElement;
    }
    return 1;
}
