"use client";

import React from "react";
import {
    Trash2, Loader2, Wand2, Sparkles, Settings,
    Video, MapPin, Globe
} from "lucide-react";
import { WorldProfile, Asset } from "@/lib/types";

interface WorldCardProps {
    asset: WorldProfile;
    isGenerating?: boolean;
    locationCount: number;
    onGenerate?: (asset: Asset) => void;
    onConfig?: (asset: Asset) => void;
    onDelete?: (id: string, type: string) => void;
    onView?: (asset: Asset) => void;
    onRegisterKling?: (asset: Asset) => void;
}

export const WorldCard: React.FC<WorldCardProps> = ({
    asset,
    isGenerating = false,
    locationCount,
    onGenerate,
    onConfig,
    onDelete,
    onView,
    onRegisterKling,
}) => {
    const isReady = !!asset.image_url;
    const statusBorder = isGenerating
        ? 'border-amber-500/60 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
        : isReady
            ? 'border-emerald-500/30'
            : 'border-white/[0.06]';

    // Visual traits as chips (max 4)
    const traits = (asset.visual_traits || []).slice(0, 4);

    return (
        <div
            className={`group relative aspect-[3/2] bg-[#0A0A0A] rounded-lg overflow-hidden transition-all duration-300 border-2 ${statusBorder} hover:border-white/20`}
        >
            {/* ── IMAGE AREA ── */}
            <div
                onClick={() => onView && onView(asset)}
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
                {asset.image_url ? (
                    <img
                        src={asset.image_url}
                        alt={asset.name}
                        className="absolute inset-0 w-full h-full object-cover transition-all duration-500 group-hover:scale-[1.03]"
                    />
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-[#080808]">
                        {!isGenerating && (
                            <>
                                <Globe className="text-neutral-700 mb-2" size={26} />
                                <span className="text-[9px] text-neutral-600 tracking-wider uppercase">No visual</span>
                            </>
                        )}
                    </div>
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

                {/* TYPE BADGE */}
                <div className="absolute top-2 left-2 px-2 py-0.5 bg-indigo-600/20 backdrop-blur-sm border border-indigo-500/20 rounded text-[7px] font-bold text-indigo-300 uppercase tracking-wider z-20 flex items-center gap-1">
                    <Globe size={8} /> World
                </div>

                {/* LOCATION COUNT BADGE */}
                {locationCount > 0 && (
                    <div className="absolute top-2 right-10 px-2 py-0.5 bg-black/60 backdrop-blur-sm rounded text-[7px] font-bold text-neutral-400 flex items-center gap-1 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MapPin size={7} /> {locationCount} location{locationCount !== 1 ? 's' : ''}
                    </div>
                )}

                {/* TRAITS CHIPS */}
                {traits.length > 0 && (
                    <div className="absolute bottom-12 left-2 right-2 flex flex-wrap gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                        {traits.map((trait, i) => (
                            <span
                                key={i}
                                className="px-1.5 py-0.5 bg-black/60 backdrop-blur-sm border border-white/[0.06] rounded text-[7px] text-neutral-400 truncate max-w-[120px]"
                            >
                                {trait}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {/* ── BOTTOM OVERLAY ── */}
            <div className="absolute bottom-0 left-0 right-0 z-10 pointer-events-none">
                {/* Always visible: gradient + name */}
                <div className="h-20 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 px-3 pb-2.5 flex items-end justify-between">
                    <div className="flex-1 min-w-0">
                        <h3 className="text-[11px] font-bold uppercase text-white/90 truncate leading-none drop-shadow-lg">
                            {asset.name}
                        </h3>
                        {(asset.time_period || asset.technology_level) && (
                            <p className="text-[8px] text-neutral-500 truncate mt-0.5">
                                {[asset.time_period, asset.technology_level].filter(Boolean).join(' · ')}
                            </p>
                        )}
                    </div>
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
                        <div className="flex-1 min-w-0">
                            <h3 className="text-[11px] font-bold uppercase text-white truncate leading-none">
                                {asset.name}
                            </h3>
                            {(asset.time_period || asset.technology_level) && (
                                <p className="text-[8px] text-neutral-500 truncate mt-0.5">
                                    {[asset.time_period, asset.technology_level].filter(Boolean).join(' · ')}
                                </p>
                            )}
                        </div>
                        <div className={`w-2 h-2 rounded-full shrink-0 ml-2 ${isGenerating
                            ? 'bg-amber-500 animate-pulse'
                            : isReady
                                ? 'bg-emerald-500'
                                : 'bg-neutral-600'}`}
                        />
                    </div>

                    {asset.description && (
                        <p className="text-[8px] text-neutral-500 truncate px-3 -mt-0.5">{asset.description}</p>
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
