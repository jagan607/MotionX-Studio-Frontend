import React from "react";
import { Trash2, Loader2, Wand2, Play, Sparkles, Settings } from "lucide-react";
import { Asset, CharacterProfile } from "@/lib/types";

interface AssetCardProps {
    asset: Asset;
    projectId: string;
    isGenerating: boolean;
    onGenerate: (asset: Asset) => void;
    onConfig: (asset: Asset) => void;
    onDelete: (id: string, type: string) => void;
}

export const AssetCard: React.FC<AssetCardProps> = ({
    asset,
    isGenerating,
    onGenerate,
    onConfig,
    onDelete
}) => {
    return (
        <div className="group relative aspect-[3/4] bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden hover:border-neutral-600 transition-all">

            {/* --- 1. VISUAL LAYER --- */}
            <div className="w-full h-full relative">

                {/* A. LOADING OVERLAY (Shows on top of everything when generating) */}
                {isGenerating && (
                    <div className="absolute inset-0 z-20 bg-black/80 backdrop-blur-[2px] flex flex-col items-center justify-center animate-in fade-in duration-300">
                        <Loader2 className="w-8 h-8 text-motion-red animate-spin mb-2" />
                        <span className="text-[9px] font-mono text-motion-red tracking-widest animate-pulse">
                            GENERATING...
                        </span>
                    </div>
                )}

                {/* B. IMAGE OR PLACEHOLDER */}
                {asset.image_url ? (
                    <img
                        src={asset.image_url}
                        alt={asset.name}
                        className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-all duration-500"
                    />
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center">
                        {/* Only show placeholder icon if NOT generating (since overlay handles loading) */}
                        {!isGenerating && (
                            <>
                                <Wand2 className="text-neutral-700 mb-2" size={24} />
                                <span className="text-[9px] font-mono text-neutral-600">NO VISUAL</span>
                            </>
                        )}
                    </div>
                )}

                {/* DELETE BUTTON (Hover Only - Hidden when generating) */}
                {!isGenerating && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(asset.id, asset.type);
                        }}
                        className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-red-900/80 text-white/50 hover:text-white rounded-md opacity-0 group-hover:opacity-100 transition-all z-10"
                    >
                        <Trash2 size={12} />
                    </button>
                )}

                {/* AUDIO BADGE (Characters Only) */}
                {asset.type === 'character' && (asset as CharacterProfile).voice_config?.voice_id && (
                    <div className="absolute top-2 left-2 px-2 py-1 bg-black/50 backdrop-blur rounded text-[8px] font-bold text-green-400 flex items-center gap-1 z-10">
                        <Play size={8} fill="currentColor" /> VOICE LINKED
                    </div>
                )}
            </div>

            {/* --- 2. CONTROLS LAYER (Bottom - Transparent Gradient) --- */}
            <div className="absolute bottom-0 left-0 w-full p-3 bg-gradient-to-t from-black via-black/90 to-transparent z-10">
                <h3 className="text-sm font-display uppercase text-white truncate mb-3 pl-1">
                    {asset.name}
                </h3>

                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={() => onGenerate(asset)}
                        disabled={isGenerating}
                        className="flex items-center justify-center gap-1.5 py-2 bg-white/10 hover:bg-motion-red text-white rounded text-[9px] font-bold tracking-widest transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Sparkles size={10} /> {asset.image_url ? "REGEN" : "GENERATE"}
                    </button>

                    <button
                        onClick={() => onConfig(asset)}
                        disabled={isGenerating}
                        className="flex items-center justify-center gap-1.5 py-2 bg-transparent border border-white/20 hover:border-white hover:bg-white/5 text-white rounded text-[9px] font-bold tracking-widest transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Settings size={10} /> CONFIG
                    </button>
                </div>
            </div>
        </div>
    );
};