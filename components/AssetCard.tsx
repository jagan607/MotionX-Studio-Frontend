import React from "react";
import { Trash2, Loader2, Wand2, Play, Sparkles, Settings, Plus } from "lucide-react";
import { Asset, CharacterProfile } from "@/lib/types";

interface AssetCardProps {
    variant?: 'default' | 'create'; // <--- NEW PROP
    asset?: Asset;
    projectId?: string;
    isGenerating?: boolean;
    onGenerate?: (asset: Asset) => void;
    onConfig?: (asset: Asset) => void;
    onDelete?: (id: string, type: string) => void;
    onCreate?: () => void; // <--- Handler for Create Mode
    label?: string;        // <--- Label for Create Mode (e.g., "New Character")
}

export const AssetCard: React.FC<AssetCardProps> = ({
    variant = 'default',
    asset,
    isGenerating = false,
    onGenerate,
    onConfig,
    onDelete,
    onCreate,
    label
}) => {

    // --- VARIANT: CREATE NEW CARD ---
    if (variant === 'create') {
        return (
            <div
                onClick={onCreate}
                className="aspect-[3/4] border border-dashed border-neutral-800 rounded-xl bg-neutral-900/20 flex flex-col items-center justify-center p-4 hover:border-neutral-600 hover:bg-neutral-900/40 transition-all cursor-pointer group animate-in fade-in zoom-in duration-300"
            >
                <div className="w-12 h-12 rounded-full bg-neutral-800 flex items-center justify-center mb-3 group-hover:scale-110 group-hover:bg-white group-hover:text-black transition-all shadow-lg">
                    <Plus size={24} />
                </div>
                <span className="text-[10px] font-bold tracking-widest text-neutral-500 group-hover:text-white transition-colors uppercase">
                    {label || "ADD NEW"}
                </span>
            </div>
        );
    }

    // --- VARIANT: STANDARD ASSET CARD ---
    if (!asset) return null; // Safety check

    return (
        <div className="group relative aspect-[3/4] bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden hover:border-neutral-600 transition-all">

            {/* --- 1. VISUAL LAYER --- */}
            <div className="w-full h-full relative">

                {/* A. LOADING OVERLAY */}
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
                        {!isGenerating && (
                            <>
                                <Wand2 className="text-neutral-700 mb-2" size={24} />
                                <span className="text-[9px] font-mono text-neutral-600">NO VISUAL</span>
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
                        className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-red-900/80 text-white/50 hover:text-white rounded-md opacity-0 group-hover:opacity-100 transition-all z-10"
                    >
                        <Trash2 size={12} />
                    </button>
                )}

                {/* AUDIO BADGE */}
                {asset.type === 'character' && (asset as CharacterProfile).voice_config?.voice_id && (
                    <div className="absolute top-2 left-2 px-2 py-1 bg-black/50 backdrop-blur rounded text-[8px] font-bold text-green-400 flex items-center gap-1 z-10">
                        <Play size={8} fill="currentColor" /> VOICE LINKED
                    </div>
                )}
            </div>

            {/* --- 2. CONTROLS LAYER --- */}
            <div className="absolute bottom-0 left-0 w-full p-3 bg-gradient-to-t from-black via-black/90 to-transparent z-10">
                <h3 className="text-sm font-display uppercase text-white truncate mb-3 pl-1">
                    {asset.name}
                </h3>

                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={() => onGenerate && onGenerate(asset)}
                        disabled={isGenerating}
                        className="flex items-center justify-center gap-1.5 py-2 bg-white/10 hover:bg-motion-red text-white rounded text-[9px] font-bold tracking-widest transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Sparkles size={10} /> {asset.image_url ? "REGEN" : "GENERATE"}
                    </button>

                    <button
                        onClick={() => onConfig && onConfig(asset)}
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