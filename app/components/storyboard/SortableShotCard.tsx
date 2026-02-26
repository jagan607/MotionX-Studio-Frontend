"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    GripVertical, Trash2, Sparkles, Film,
    ImagePlus, Link2, Plus, CheckCircle2,
    Wand2, Loader2, Palette, XCircle, Upload, Settings, Pin, Volume2
} from "lucide-react";
import imageCompression from 'browser-image-compression';
import type { VideoProvider } from '@/app/hooks/shot-manager/useShotVideoGen';
import { usePricing } from '@/app/hooks/usePricing';

interface CastMember { id: string; name: string; }
interface Location { id: string; name: string; }
interface Product { id: string; name: string; }

interface Shot {
    id: string;
    shot_type: string;
    characters: string[];
    products?: string[];
    visual_action: string;
    video_prompt?: string;
    location?: string;
    image_url?: string;
    video_url?: string;
    lipsync_url?: string;
    video_status?: string;
    status?: string;
    morph_to_next?: boolean;
    prompt: string;
    estimated_duration?: number;
    is_upscaled?: boolean;
    upscale_status?: string;
    upscale_error?: string;
    image_url_original?: string;
}

interface SortableShotCardProps {
    shot: Shot;
    index: number;
    styles: any;
    onDelete: (id: string) => void;
    castMembers: CastMember[];
    locations: Location[];
    products?: Product[];
    onUpdateShot: (id: string, field: keyof Shot, value: any) => void;
    onRender: (referenceFile?: File | null, provider?: 'gemini' | 'seedream') => void;
    onEdit: () => void;
    onUpscale: () => void;
    isRendering: boolean;
    onExpand: () => void;
    nextShotImage?: string;
    isMorphedByPrev?: boolean;
    onUploadImage: (file: File) => void;
    onLipSync?: () => void;
    tourId?: string;
    children: React.ReactNode;
    continuityRefId?: string | null;
    onSetContinuityRef?: (id: string | null) => void;
}

const normalize = (str: string) => str ? str.toLowerCase().trim() : "";

export const SortableShotCard = ({
    shot,
    index,
    styles,
    onDelete,
    castMembers,
    locations,
    products = [],
    onUpdateShot,
    onRender,
    onEdit,
    onUpscale,
    isRendering,
    onExpand,
    nextShotImage,
    isMorphedByPrev = false,
    onUploadImage,
    onLipSync,
    tourId,
    children,
    continuityRefId,
    onSetContinuityRef,
}: SortableShotCardProps) => {

    const isPinned = continuityRefId === shot.id;

    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: shot.id });

    // --- Provider States ---
    const [imageProvider, setImageProvider] = useState<'gemini' | 'seedream'>('gemini');

    // Linked State
    const isLinked = shot.morph_to_next === true;

    // Loading States
    const isGenerating = isRendering || shot.status === 'generating';
    const isAnimating = ['animating', 'processing', 'queued', 'pending'].includes(shot.video_status || '');
    const isBusy = isGenerating || isAnimating;
    const overlayText = isAnimating ? "Animating..." : "Generating...";
    const isUpscaled = shot.is_upscaled === true;
    const isUpscaling = shot.upscale_status === 'processing';

    // Validation
    const hasImage = Boolean(shot.image_url);
    const hasVideo = Boolean(shot.video_url);
    const canLink = hasImage && Boolean(nextShotImage) && !isMorphedByPrev;

    // --- Pricing ---
    const { getImageCost } = usePricing();
    const imageCost = getImageCost();
    const upscaleCost = 2;

    // --- Cast Toggle Logic ---
    const handleCharToggle = (charId: string) => {
        const current = Array.isArray(shot.characters) ? [...shot.characters] : [];
        const isActive = current.includes(charId) || current.some(c => normalize(c) === normalize(castMembers.find(cm => cm.id === charId)?.name || ''));
        let updated;
        if (isActive) {
            updated = current.filter(c => c !== charId && normalize(c) !== normalize(castMembers.find(cm => cm.id === charId)?.name || ''));
        } else {
            updated = [...current, charId];
        }
        onUpdateShot(shot.id, "characters", updated);
    };

    // --- Product Toggle Logic ---
    const handleProductToggle = (prodId: string) => {
        const current = Array.isArray(shot.products) ? [...shot.products] : [];
        let updated;
        if (current.includes(prodId)) {
            updated = current.filter(id => id !== prodId);
        } else {
            updated = [...current, prodId];
        }
        onUpdateShot(shot.id, "products", updated);
    };

    // --- Ref Image Logic ---
    const [refFile, setRefFile] = useState<File | null>(null);
    const [refPreviewUrl, setRefPreviewUrl] = useState<string | null>(null);
    const [isHoveringRef, setIsHoveringRef] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const mainImageInputRef = useRef<HTMLInputElement>(null);
    const [isCompressing, setIsCompressing] = useState(false);

    useEffect(() => {
        if (!refFile) { setRefPreviewUrl(null); return; }
        const objectUrl = URL.createObjectURL(refFile);
        setRefPreviewUrl(objectUrl);
        return () => URL.revokeObjectURL(objectUrl);
    }, [refFile]);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            setIsCompressing(true);
            try {
                const compressed = await imageCompression(e.target.files[0], { maxSizeMB: 1, maxWidthOrHeight: 1500, useWebWorker: true });
                setRefFile(compressed);
            } finally {
                setIsCompressing(false);
            }
        }
    };

    const handleMainImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            try {
                const compressed = await imageCompression(e.target.files[0], { maxSizeMB: 2, maxWidthOrHeight: 2048, useWebWorker: true });
                onUploadImage(compressed);
            } catch (err) {
                console.error("Compression failed", err);
                onUploadImage(e.target.files[0]);
            }
        }
    };

    const clearRefImage = (e: React.MouseEvent) => {
        e.stopPropagation();
        setRefFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    // Local Buffers
    const [localVisualAction, setLocalVisualAction] = useState(shot.visual_action || "");
    const [localVideoPrompt, setLocalVideoPrompt] = useState(shot.video_prompt || "");

    useEffect(() => { setLocalVisualAction(shot.visual_action || ""); }, [shot.visual_action]);
    useEffect(() => { setLocalVideoPrompt(shot.video_prompt || ""); }, [shot.video_prompt]);

    // --- Drag Style ---
    const dragStyle = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 1000 : 1,
    };

    // --- Pill button helper ---
    const pillBtn = (active: boolean) =>
        `flex-1 px-2 py-1.5 text-[10px] font-semibold rounded-md text-center transition-all cursor-pointer select-none
        ${active
            ? 'bg-[#E50914]/15 text-white border border-[#E50914]/60'
            : 'bg-white/[0.03] text-neutral-500 border border-white/[0.08] hover:border-white/20 hover:text-neutral-300'
        }
        ${isBusy || isMorphedByPrev ? '!cursor-not-allowed' : ''}`;

    // Tag button helper
    const tagBtn = (active: boolean) =>
        `px-2.5 py-1 text-[10px] rounded-md border transition-all cursor-pointer select-none
        ${active
            ? 'bg-[#E50914] text-white border-[#E50914]'
            : 'bg-transparent text-neutral-500 border-white/[0.1] hover:border-white/20 hover:text-neutral-300'
        }
        ${isMorphedByPrev ? 'opacity-40 !cursor-not-allowed' : ''}`;

    return (
        <div
            ref={setNodeRef}
            id={tourId}
            style={dragStyle}
            className={`relative flex flex-col rounded-xl p-4
                ${isDragging ? 'opacity-60 scale-[1.02]' : 'opacity-100'}
                ${isUpscaled ? 'bg-white/[0.04] border border-white/20' : 'bg-[#0A0A0A] border border-white/[0.08]'}
                ${isMorphedByPrev ? 'border-[#E50914]/60' : ''}
                ${(isLinked || isMorphedByPrev) ? 'shadow-[0_0_0_1px_#E50914]' : ''}
            `}
        >

            {/* ── Linked Sequence Label ── */}
            {isMorphedByPrev && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-[#E50914] text-white text-[9px] font-bold px-2 py-0.5 rounded-md z-[60] flex items-center gap-1 shadow-[0_0_10px_rgba(229,9,20,0.4)]">
                    <Link2 size={9} /> Linked
                </div>
            )}

            {/* ── Gutter Link Button ── */}
            {canLink && (
                <>
                    {isLinked && (
                        <div className="absolute top-1/2 -right-[30px] w-10 h-0.5 bg-[#E50914] z-40 -translate-y-1/2 shadow-[0_0_8px_#E50914]" />
                    )}
                    <div
                        onClick={() => onUpdateShot(shot.id, "morph_to_next", !isLinked)}
                        title={isLinked ? "Unlink" : "Morph into Next Shot"}
                        className={`absolute top-1/2 -right-3.5 -translate-y-1/2 z-50 w-7 h-7 rounded-full flex items-center justify-center cursor-pointer transition-all
                            ${isLinked
                                ? 'bg-[#E50914] border-2 border-black text-white shadow-[0_0_15px_rgba(229,9,20,0.5)]'
                                : 'bg-[#111] border border-white/[0.15] text-neutral-500 shadow-md hover:border-white/30'
                            }
                        `}
                    >
                        {isLinked ? <Link2 size={13} /> : <Plus size={13} />}
                    </div>
                </>
            )}

            {/* ── Header ── */}
            <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2.5">
                    <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-neutral-600 hover:text-neutral-400 transition-colors p-0.5">
                        <GripVertical size={16} />
                    </div>
                    <span className="text-[11px] font-bold tracking-wide text-[#E50914]">
                        Shot {String(index + 1).padStart(2, '0')}
                        {isUpscaled && <span className="ml-1.5 text-[10px] font-bold text-cyan-400">4K</span>}
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    {/* Pin as continuity reference */}
                    {onSetContinuityRef && (
                        <button
                            onClick={() => onSetContinuityRef(isPinned ? null : shot.id)}
                            title={isPinned ? 'Remove as reference' : 'Use as character reference'}
                            className={`p-1 rounded-md transition-all cursor-pointer
                                ${isPinned
                                    ? 'text-[#E50914] bg-[#E50914]/10 hover:bg-[#E50914]/20'
                                    : 'text-neutral-600 hover:text-neutral-300 hover:bg-white/[0.05]'
                                }`}
                        >
                            <Pin size={13} className={isPinned ? 'fill-[#E50914]' : ''} />
                        </button>
                    )}
                    <button onClick={() => onDelete(shot.id)} className="bg-transparent border-none text-neutral-600 hover:text-red-500 cursor-pointer transition-colors p-1 rounded-md hover:bg-white/[0.05]">
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>

            {/* ── Preview ── */}
            <div
                onClick={(e) => { e.stopPropagation(); if (hasImage || hasVideo) onExpand(); }}
                className={`relative mb-3 rounded-lg overflow-hidden ${(hasImage || hasVideo) ? 'cursor-pointer' : ''}`}
            >
                {isBusy && (
                    <div className="absolute inset-0 z-10 overflow-hidden rounded-lg">
                        {/* Flowing gradient blobs — theme reds */}
                        <div className="absolute inset-0 bg-black/40">
                            <div className="absolute w-[60%] h-[60%] rounded-full bg-[#E50914]/30 blur-[40px]"
                                style={{ animation: 'flowBlob1 4s ease-in-out infinite', top: '10%', left: '10%' }} />
                            <div className="absolute w-[50%] h-[50%] rounded-full bg-[#ff4d4d]/15 blur-[40px]"
                                style={{ animation: 'flowBlob2 5s ease-in-out infinite', top: '40%', right: '5%' }} />
                            <div className="absolute w-[40%] h-[40%] rounded-full bg-[#E50914]/20 blur-[35px]"
                                style={{ animation: 'flowBlob3 6s ease-in-out infinite', bottom: '5%', left: '30%' }} />
                        </div>
                        {/* Frosted glass layer */}
                        <div className="absolute inset-0 backdrop-blur-xl bg-white/[0.03]" />
                        {/* Label only */}
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-[10px] font-semibold text-white/60 tracking-[3px] uppercase"
                                style={{ animation: 'shimmerText 2s ease-in-out infinite' }}>
                                {overlayText}
                            </span>
                        </div>
                        <style jsx>{`
                            @keyframes flowBlob1 {
                                0%, 100% { transform: translate(0, 0) scale(1); }
                                33% { transform: translate(30%, 20%) scale(1.2); }
                                66% { transform: translate(-10%, 30%) scale(0.9); }
                            }
                            @keyframes flowBlob2 {
                                0%, 100% { transform: translate(0, 0) scale(1); }
                                33% { transform: translate(-30%, -20%) scale(1.1); }
                                66% { transform: translate(10%, -10%) scale(1.3); }
                            }
                            @keyframes flowBlob3 {
                                0%, 100% { transform: translate(0, 0) scale(1.1); }
                                33% { transform: translate(20%, -30%) scale(0.8); }
                                66% { transform: translate(-20%, 10%) scale(1.2); }
                            }
                            @keyframes shimmerText {
                                0%, 100% { opacity: 0.6; }
                                50% { opacity: 0.3; }
                            }
                        `}</style>
                    </div>
                )}
                {/* Pinned REF badge */}
                {isPinned && (
                    <div className="absolute top-2 left-2 z-20 flex items-center gap-1 bg-[#E50914] text-white text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md shadow-[0_0_8px_rgba(229,9,20,0.4)]">
                        <Pin size={8} className="fill-white" /> REF
                    </div>
                )}
                {children}
            </div>

            {/* ── Metadata ── */}
            <div className="flex gap-2 mb-3">
                <div className="flex-1">
                    <label className="text-[9px] font-semibold text-neutral-500 mb-1 block">Shot Type</label>
                    <select
                        disabled={isMorphedByPrev}
                        defaultValue={shot.shot_type || "Wide Shot"}
                        onChange={(e) => onUpdateShot(shot.id, "shot_type", e.target.value)}
                        className="w-full bg-white/[0.03] border border-white/[0.08] text-neutral-200 text-[11px] px-2.5 py-2 rounded-lg outline-none focus:border-[#E50914]/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        <option value="">{shot.shot_type}</option>
                        <option value="Wide Shot">Wide Shot</option>
                        <option value="Medium Shot">Medium Shot</option>
                        <option value="Close Up">Close Up</option>
                        <option value="Extreme Close Up">Extreme Close Up</option>
                        <option value="Medium Close Up">Medium Close Up</option>
                    </select>
                </div>
                {shot.estimated_duration ? (
                    <div className="w-12 shrink-0">
                        <label className="text-[9px] font-semibold text-neutral-500 mb-1 block">Dur.</label>
                        <div className="w-full bg-white/[0.03] border border-white/[0.08] text-amber-400 text-[11px] px-2.5 py-2 rounded-lg text-center font-mono font-bold">
                            {shot.estimated_duration}s
                        </div>
                    </div>
                ) : null}
                <div className="flex-1">
                    <label className="text-[9px] font-semibold text-neutral-500 mb-1 block">Location</label>
                    <select
                        disabled={isMorphedByPrev}
                        value={shot.location || ""}
                        onChange={(e) => onUpdateShot(shot.id, "location", e.target.value)}
                        className="w-full bg-white/[0.03] border border-white/[0.08] text-neutral-200 text-[11px] px-2.5 py-2 rounded-lg outline-none focus:border-[#E50914]/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        <option disabled value="">Select...</option>
                        <option value={shot.location}>{shot.location}</option>
                        {locations.filter(l => l.name !== shot.location).map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
                    </select>
                </div>
            </div>

            {/* ── Products ── */}
            {products.length > 0 && (
                <div className="mb-3">
                    <label className="text-[9px] font-semibold text-neutral-500 mb-1.5 block">Products</label>
                    <div className="flex flex-wrap gap-1.5">
                        {products.map((prod) => {
                            const isActive = Array.isArray(shot.products) && shot.products.includes(prod.id);
                            return (
                                <button key={prod.id} disabled={isMorphedByPrev} onClick={() => handleProductToggle(prod.id)} className={tagBtn(isActive)}>
                                    {prod.name}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── Cast ── */}
            <div className="mb-3">
                <label className="text-[9px] font-semibold text-neutral-500 mb-1.5 block">Cast</label>
                <div className="flex flex-wrap gap-1.5">
                    {castMembers.map((char) => {
                        const isActive = Array.isArray(shot.characters) && (
                            shot.characters.includes(char.id) ||
                            shot.characters.some(c => normalize(c) === normalize(char.name))
                        );
                        return (
                            <button key={char.id} disabled={isMorphedByPrev} onClick={() => handleCharToggle(char.id)} className={tagBtn(isActive)}>
                                {char.name}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ── Image Prompt ── */}
            <div className="mb-3">
                <div className="flex justify-between items-center mb-1.5">
                    <label className="text-[9px] font-semibold text-neutral-500">Image Prompt</label>
                    <div className="flex items-center gap-1.5 relative"
                        onMouseEnter={() => setIsHoveringRef(true)}
                        onMouseLeave={() => setIsHoveringRef(false)}
                    >
                        <input disabled={isMorphedByPrev} type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*" />
                        <input disabled={isMorphedByPrev || isBusy} type="file" ref={mainImageInputRef} onChange={handleMainImageSelect} className="hidden" accept="image/*" />

                        <button
                            disabled={isMorphedByPrev || isCompressing}
                            onClick={() => fileInputRef.current?.click()}
                            className={`flex items-center gap-1.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-md transition-all
                                ${refPreviewUrl
                                    ? 'text-[#E50914] bg-[#E50914]/10 border border-[#E50914]/30'
                                    : 'text-neutral-500 hover:text-neutral-300 border-none bg-transparent'
                                }
                                ${(isMorphedByPrev || isCompressing) ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
                            `}
                        >
                            {isCompressing ? (
                                <><Loader2 size={9} className="animate-spin" /> Processing</>
                            ) : refPreviewUrl ? (
                                <>
                                    <div className="w-3 h-3 rounded-sm bg-cover bg-center" style={{ backgroundImage: `url(${refPreviewUrl})` }} />
                                    Ref Active
                                </>
                            ) : (
                                <><ImagePlus size={9} /> Add Ref</>
                            )}
                        </button>

                        {refPreviewUrl && !isCompressing && !isMorphedByPrev && (
                            <button onClick={clearRefImage} className="text-neutral-600 hover:text-red-500 transition-colors p-0.5" title="Remove Reference">
                                <XCircle size={11} />
                            </button>
                        )}

                        {refPreviewUrl && isHoveringRef && !isCompressing && (
                            <div className="absolute bottom-full right-0 mb-2 w-40 bg-black border border-white/[0.15] rounded-lg overflow-hidden z-[9999] shadow-2xl pointer-events-none">
                                <img src={refPreviewUrl} alt="Ref Preview" className="w-full h-auto block" />
                            </div>
                        )}
                    </div>
                </div>
                <textarea
                    disabled={isMorphedByPrev}
                    value={isMorphedByPrev ? "Content determined by morph transition." : localVisualAction}
                    onChange={(e) => { setLocalVisualAction(e.target.value); onUpdateShot(shot.id, "visual_action", e.target.value); }}
                    placeholder="Visual description..."
                    className="w-full bg-white/[0.03] border border-white/[0.08] text-neutral-200 text-[11px] px-2.5 py-2 rounded-lg outline-none focus:border-[#E50914]/40 resize-none transition-colors placeholder:text-neutral-600 disabled:opacity-40 disabled:cursor-not-allowed"
                    rows={2}
                />
            </div>

            {/* ── Video Prompt ── */}
            <div className="mb-3">
                <label className="text-[9px] font-semibold text-neutral-500 mb-1.5 block">Video Prompt</label>
                <textarea
                    disabled={isMorphedByPrev}
                    value={isMorphedByPrev ? "Movement controlled by previous shot transition." : localVideoPrompt}
                    onChange={(e) => { setLocalVideoPrompt(e.target.value); onUpdateShot(shot.id, "video_prompt", e.target.value); }}
                    placeholder="Motion description..."
                    className="w-full bg-white/[0.03] border border-white/[0.08] text-neutral-200 text-[11px] px-2.5 py-2 rounded-lg outline-none focus:border-[#E50914]/40 resize-none transition-colors placeholder:text-neutral-600 disabled:opacity-40 disabled:cursor-not-allowed"
                    rows={2}
                />
            </div>

            {/* ── Action Footer ── */}
            <div className={`mt-auto pt-3 border-t border-white/[0.06] ${isMorphedByPrev ? 'opacity-30 pointer-events-none' : ''}`}>

                {/* Edit & Animate Button - Triggers Inspector */}
                <button
                    onClick={onEdit}
                    disabled={isBusy}
                    className="w-full flex items-center justify-center gap-2 py-2.5 mb-2 rounded-lg bg-[#E50914]/10 hover:bg-[#E50914]/20 border border-[#E50914]/40 text-xs font-semibold text-white transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Settings size={14} className="group-hover:rotate-45 transition-transform text-[#E50914]" />
                    Shot Settings & Animate
                </button>

                {/* Image Rendering Utils */}
                <div className="grid grid-cols-2 gap-2 mb-2">
                    <button
                        onClick={() => onRender(refFile, imageProvider)}
                        disabled={isBusy}
                        className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-bold bg-white/[0.06] text-white border border-white/[0.1] hover:border-white/20 hover:bg-white/[0.1] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        <Sparkles size={12} /> {hasImage ? "Re-Gen" : "Gen Image"}
                        <span className="opacity-50 text-[9px] font-normal">· {imageCost} cr</span>
                    </button>
                    <button
                        onClick={onUpscale}
                        disabled={!hasImage || isBusy || isUpscaled || isUpscaling}
                        className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed
                            ${isUpscaled
                                ? 'bg-cyan-500/15 text-white border border-cyan-500/60'
                                : isUpscaling
                                    ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30 animate-pulse'
                                    : 'bg-white/[0.06] text-white border border-white/[0.1] hover:border-white/20 hover:bg-white/[0.1]'
                            }
                        `}
                    >
                        {isUpscaling ? <Loader2 size={12} className="animate-spin" /> : isUpscaled ? <CheckCircle2 size={12} /> : <Wand2 size={12} />}
                        {isUpscaling ? "Upscaling..." : isUpscaled ? "4K" : "Upscale 4K"}
                        {!isUpscaled && !isUpscaling && <span className="opacity-50 text-[9px] font-normal">· {upscaleCost} cr</span>}
                    </button>
                </div>

                {/* Lip Sync — only when video exists */}
                {hasVideo && onLipSync && (
                    <button
                        onClick={onLipSync}
                        disabled={isBusy}
                        className="w-full flex items-center justify-center gap-1.5 py-2 mb-2 rounded-lg text-[10px] font-bold bg-white/[0.06] text-white border border-white/[0.1] hover:border-[#E50914]/40 hover:bg-[#E50914]/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        <Volume2 size={12} /> Lip Sync
                    </button>
                )}

                {/* Upload Image */}
                <button
                    onClick={() => mainImageInputRef.current?.click()}
                    disabled={isBusy}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-semibold text-neutral-500 border border-dashed border-white/[0.1] bg-white/[0.02] hover:border-white/20 hover:text-neutral-300 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    <Upload size={10} /> Upload Image
                </button>
            </div>
        </div>
    );
};