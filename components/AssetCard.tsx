import React, { useState } from "react";
import {
    Trash2, Loader2, Wand2, Play, Sparkles, Settings,
    Plus, Video, ShoppingBag, ChevronLeft, ChevronRight
} from "lucide-react";
import { Asset, CharacterProfile, ProductProfile, LocationProfile } from "@/lib/types";

interface AssetCardProps {
    variant?: 'default' | 'create';
    tourId?: string;
    asset?: Asset;
    projectId?: string;
    isGenerating?: boolean;
    onGenerate?: (asset: Asset) => void;
    onConfig?: (asset: Asset) => void;
    onDelete?: (id: string, type: string) => void;
    onCreate?: () => void;
    onView?: (asset: Asset) => void;
    onRegisterKling?: (asset: Asset) => void;
    label?: string;
}

const VIEW_LABELS: Record<string, string> = {
    wide: "Wide", front: "Front", left: "Left", right: "Right"
};

export const AssetCard: React.FC<AssetCardProps> = ({
    variant = 'default',
    asset,
    isGenerating = false,
    onGenerate,
    onConfig,
    onDelete,
    onCreate,
    onView,
    onRegisterKling,
    label,
    tourId
}) => {
    // Hooks must be called before any returns
    const [activeViewIdx, setActiveViewIdx] = useState(0);

    // --- VARIANT: CREATE NEW CARD ---
    if (variant === 'create') {
        return (
            <div
                onClick={onCreate}
                className="aspect-[4/3] border border-dashed border-white/[0.08] rounded-lg bg-white/[0.02] flex flex-col items-center justify-center p-4 hover:border-[#E50914]/40 hover:bg-[#E50914]/5 transition-all cursor-pointer group"
            >
                <div className="w-11 h-11 rounded-full bg-white/[0.04] flex items-center justify-center mb-3 group-hover:scale-110 group-hover:bg-[#E50914] group-hover:text-white transition-all border border-white/[0.06]">
                    <Plus size={22} />
                </div>
                <span className="text-[9px] font-bold tracking-[0.2em] text-neutral-600 group-hover:text-white transition-colors uppercase">
                    {label || "ADD NEW"}
                </span>
            </div>
        );
    }

    // --- VARIANT: STANDARD ASSET CARD ---
    if (!asset) return null;

    // Location multi-view
    const isLocation = asset.type === 'location';
    const hasViews = isLocation && !!(asset as LocationProfile).image_views;
    const views = hasViews ? (asset as LocationProfile).image_views! : {};
    const allViews: { key: string; url: string }[] = [];
    // Main image always first
    if (asset.image_url) allViews.push({ key: 'wide', url: asset.image_url });
    if (hasViews) {
        Object.entries(views).forEach(([key, url]) => {
            if (url && key !== 'wide') allViews.push({ key, url });
        });
    }
    const currentView = allViews[activeViewIdx] || allViews[0];
    const hasMultipleViews = allViews.length > 1;

    const cycleView = (dir: 1 | -1, e: React.MouseEvent) => {
        e.stopPropagation();
        setActiveViewIdx(prev => (prev + dir + allViews.length) % allViews.length);
    };

    // Status
    const isReady = !!asset.image_url;
    const statusBorder = isGenerating
        ? 'border-amber-500/60 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
        : isReady
            ? 'border-emerald-500/30'
            : 'border-white/[0.06]';

    return (
        <div
            id={!isGenerating ? tourId : undefined}
            className={`group relative aspect-[4/3] bg-[#0A0A0A] rounded-lg overflow-hidden transition-all duration-300 border-2 ${statusBorder} hover:border-white/20`}
        >
            {/* ── IMAGE AREA ── */}
            <div
                onClick={() => onView && asset && onView(asset)}
                className="w-full h-full relative cursor-pointer"
            >
                {/* LOADING OVERLAY */}
                {isGenerating && (
                    <div className="absolute inset-0 z-30 bg-black/70 backdrop-blur-[2px] flex flex-col items-center justify-center">
                        <Loader2 className="w-7 h-7 text-amber-500 animate-spin mb-2" />
                        <span className="text-[9px] text-amber-500/80 tracking-[3px] uppercase font-mono animate-pulse">
                            Generating
                        </span>
                    </div>
                )}

                {/* IMAGE OR PLACEHOLDER */}
                {currentView?.url ? (
                    <img
                        src={currentView.url}
                        alt={asset.name}
                        className="absolute inset-0 w-full h-full object-cover transition-all duration-500 group-hover:scale-[1.03]"
                    />
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-[#080808]">
                        {!isGenerating && (
                            <>
                                <Wand2 className="text-neutral-700 mb-2" size={22} />
                                <span className="text-[9px] text-neutral-600 tracking-wider uppercase">No visual</span>
                            </>
                        )}
                    </div>
                )}

                {/* MULTI-VIEW ARROWS (locations only) */}
                {hasMultipleViews && !isGenerating && (
                    <>
                        <button
                            onClick={(e) => cycleView(-1, e)}
                            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-black/60 backdrop-blur-sm border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-black/80 cursor-pointer"
                        >
                            <ChevronLeft size={14} className="text-white/70" />
                        </button>
                        <button
                            onClick={(e) => cycleView(1, e)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-black/60 backdrop-blur-sm border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-black/80 cursor-pointer"
                        >
                            <ChevronRight size={14} className="text-white/70" />
                        </button>
                        {/* View label + dots */}
                        <div className="absolute top-2 left-2 z-20 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-[8px] font-bold uppercase tracking-wider text-white/80 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded">
                                {VIEW_LABELS[currentView?.key] || currentView?.key}
                            </span>
                        </div>
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            {allViews.map((v, i) => (
                                <button
                                    key={v.key}
                                    onClick={(e) => { e.stopPropagation(); setActiveViewIdx(i); }}
                                    className={`w-1.5 h-1.5 rounded-full transition-all cursor-pointer ${i === activeViewIdx
                                        ? 'bg-[#E50914] scale-125'
                                        : 'bg-white/30 hover:bg-white/60'}`}
                                />
                            ))}
                        </div>
                    </>
                )}

                {/* DELETE BUTTON */}
                {!isGenerating && onDelete && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(asset.id, asset.type);
                        }}
                        className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-red-900/80 text-white/40 hover:text-white rounded-md opacity-0 group-hover:opacity-100 transition-all z-20 cursor-pointer"
                    >
                        <Trash2 size={12} />
                    </button>
                )}

                {/* TYPE BADGES */}
                {asset.type === 'character' && (asset as CharacterProfile).voice_config?.voice_id && (
                    <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/60 backdrop-blur-sm rounded text-[7px] font-bold text-[#ff6b6b] flex items-center gap-1 z-20">
                        <Play size={7} fill="currentColor" /> Voice
                    </div>
                )}

                {asset.type === 'character' && (() => {
                    const rawType = (asset as CharacterProfile).character_type;
                    const charType = (!rawType || rawType === 'primary') ? 'human' : rawType;
                    const typeConfig: Record<string, { icon: string; color: string }> = {
                        human: { icon: '👤', color: 'text-blue-300 bg-blue-500/15 border-blue-500/20' },
                        animal: { icon: '🐾', color: 'text-green-300 bg-green-500/15 border-green-500/20' },
                        creature: { icon: '👹', color: 'text-purple-300 bg-purple-500/15 border-purple-500/20' },
                        robot: { icon: '🤖', color: 'text-cyan-300 bg-cyan-500/15 border-cyan-500/20' },
                    };
                    const cfg = typeConfig[charType] || typeConfig.human;
                    const hasVoice = (asset as CharacterProfile).voice_config?.voice_id;
                    return (
                        <div className={`absolute ${hasVoice ? 'top-8' : 'top-2'} left-2 px-2 py-0.5 backdrop-blur-sm rounded text-[7px] font-bold flex items-center gap-1 z-20 border ${cfg.color}`}>
                            <span className="text-[9px]">{cfg.icon}</span> {charType}
                        </div>
                    );
                })()}

                {asset.type === 'product' && (
                    <div className="absolute top-2 left-2 px-2 py-0.5 bg-amber-600/20 backdrop-blur-sm border border-amber-600/20 rounded text-[7px] font-bold text-amber-400 uppercase tracking-wider z-20">
                        {(asset as ProductProfile).category || 'product'}
                    </div>
                )}
            </div>

            {/* ── BOTTOM OVERLAY ── */}
            <div className="absolute bottom-0 left-0 right-0 z-10 pointer-events-none">
                {/* Always visible: subtle gradient + name */}
                <div className="h-20 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 px-3 pb-2.5 flex items-end justify-between">
                    <h3 className="text-[11px] font-bold uppercase text-white/90 truncate leading-none drop-shadow-lg">
                        {asset.name}
                    </h3>
                    <div className={`w-2 h-2 rounded-full shrink-0 ml-2 ${isGenerating
                        ? 'bg-amber-500 animate-pulse'
                        : isReady
                            ? 'bg-emerald-500'
                            : 'bg-neutral-600'}`}
                    />
                </div>

                {/* Hover: action panel slides up */}
                <div className="absolute bottom-0 left-0 right-0 pointer-events-auto bg-black/90 backdrop-blur-sm translate-y-full group-hover:translate-y-0 transition-transform duration-200 ease-out">
                    <div className="px-3 pt-2 pb-1.5 flex items-center justify-between">
                        <h3 className="text-[11px] font-bold uppercase text-white truncate leading-none">
                            {asset.name}
                        </h3>
                        <div className={`w-2 h-2 rounded-full shrink-0 ml-2 ${isGenerating
                            ? 'bg-amber-500 animate-pulse'
                            : isReady
                                ? 'bg-emerald-500'
                                : 'bg-neutral-600'}`}
                        />
                    </div>
                    {asset.type === 'product' && (asset as ProductProfile).description && (
                        <p className="text-[8px] text-neutral-500 truncate px-3 -mt-0.5">{(asset as ProductProfile).description}</p>
                    )}
                    <div className="px-2 pb-2 pt-1 flex gap-1.5">
                        <button
                            onClick={(e) => { e.stopPropagation(); onGenerate && onGenerate(asset); }}
                            disabled={isGenerating}
                            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-white/[0.06] hover:bg-[#E50914] text-white/70 hover:text-white rounded text-[8px] font-bold tracking-wider uppercase transition-all disabled:opacity-30 cursor-pointer"
                        >
                            <Sparkles size={9} /> {asset.image_url ? "Regen" : "Generate"}
                        </button>

                        <button
                            onClick={(e) => { e.stopPropagation(); onConfig && onConfig(asset); }}
                            disabled={isGenerating}
                            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-white/[0.06] hover:bg-white/[0.12] text-white/70 hover:text-white rounded text-[8px] font-bold tracking-wider uppercase transition-all disabled:opacity-30 cursor-pointer"
                        >
                            <Settings size={9} /> Config
                        </button>

                        {onRegisterKling && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onRegisterKling(asset); }}
                                disabled={isGenerating}
                                className={`flex items-center justify-center gap-1 px-2 py-1.5 rounded text-[8px] font-bold tracking-wider uppercase transition-all cursor-pointer disabled:opacity-30
                                    ${asset.kling_element_id
                                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
                                        : 'bg-blue-500/10 text-blue-300 border border-blue-500/20 hover:bg-blue-500/20'}`}
                            >
                                <Video size={9} /> {asset.kling_element_id ? '✓' : 'Video'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};