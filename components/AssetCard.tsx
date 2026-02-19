import React from "react";
import { Trash2, Loader2, Wand2, Play, Sparkles, Settings, Plus, Video } from "lucide-react";
import { Asset, CharacterProfile } from "@/lib/types";

interface AssetCardProps {
    variant?: 'default' | 'create'; // <--- NEW PROP
    tourId?: string; // <--- FOR TOUR TARGETING
    asset?: Asset;
    projectId?: string;
    isGenerating?: boolean;
    onGenerate?: (asset: Asset) => void;
    onConfig?: (asset: Asset) => void;
    onDelete?: (id: string, type: string) => void;
    onCreate?: () => void; // <--- Handler for Create Mode
    onView?: (asset: Asset) => void; // <--- Handler for View Mode
    onRegisterKling?: (asset: Asset) => void; // <--- Handler for Kling Registration
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
    onView,
    onRegisterKling,
    label,
    tourId
}) => {

    // --- VARIANT: CREATE NEW CARD ---
    if (variant === 'create') {
        return (
            <div
                onClick={onCreate}
                className="aspect-[3/4] border border-dashed border-white/[0.08] rounded-xl bg-white/[0.02] flex flex-col items-center justify-center p-4 hover:border-[#E50914]/40 hover:bg-[#E50914]/5 transition-all cursor-pointer group animate-in fade-in zoom-in duration-300"
            >
                <div className="w-12 h-12 rounded-full bg-white/[0.04] flex items-center justify-center mb-3 group-hover:scale-110 group-hover:bg-[#E50914] group-hover:text-white transition-all shadow-lg border border-white/[0.06]">
                    <Plus size={24} />
                </div>
                <span className="text-[10px] font-bold tracking-widest text-neutral-600 group-hover:text-white transition-colors uppercase">
                    {label || "ADD NEW"}
                </span>
            </div>
        );
    }

    // --- VARIANT: STANDARD ASSET CARD ---
    if (!asset) return null; // Safety check

    return (
        <div id={!isGenerating ? tourId : undefined} className="group relative aspect-[3/4] bg-[#0A0A0A] border border-white/[0.06] rounded-xl overflow-hidden hover:border-white/[0.12] transition-all">

            {/* --- 1. VISUAL LAYER --- */}
            <div
                onClick={() => onView && asset && onView(asset)}
                className="w-full h-full relative cursor-pointer"
            >

                {/* A. LOADING OVERLAY */}
                {isGenerating && (
                    <div className="absolute inset-0 z-20 bg-black/80 backdrop-blur-[2px] flex flex-col items-center justify-center animate-in fade-in duration-300">
                        <Loader2 className="w-8 h-8 text-motion-red animate-spin mb-2" />
                        <span className="text-[9px] text-[#E50914] tracking-widest animate-pulse">
                            Generating...
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
                                <span className="text-[9px] text-neutral-600">No visual</span>
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
                        className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-red-900/80 text-white/50 hover:text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all z-10"
                    >
                        <Trash2 size={12} />
                    </button>
                )}

                {/* AUDIO BADGE */}
                {asset.type === 'character' && (asset as CharacterProfile).voice_config?.voice_id && (
                    <div className="absolute top-2 left-2 px-2 py-1 bg-black/50 backdrop-blur rounded-md text-[8px] font-bold text-[#ff6b6b] flex items-center gap-1 z-10">
                        <Play size={8} fill="currentColor" /> Voice Linked
                    </div>
                )}
            </div>

            {/* --- 2. CONTROLS LAYER --- */}
            <div className="absolute bottom-0 left-0 w-full p-3 bg-gradient-to-t from-black via-black/90 to-transparent z-10 flex flex-col justify-end min-h-[50%]">
                <h3 className="text-sm font-display uppercase text-white truncate mb-2 pl-1">
                    {asset.name}
                </h3>

                <div className="grid grid-cols-2 gap-2 mb-2">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onGenerate && onGenerate(asset);
                        }}
                        disabled={isGenerating}
                        className="flex items-center justify-center gap-1.5 py-2 bg-white/10 hover:bg-[#E50914] text-white rounded-md text-[9px] font-bold tracking-widest transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Sparkles size={10} /> {asset.image_url ? "Regen" : "Generate"}
                    </button>

                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onConfig && onConfig(asset);
                        }}
                        disabled={isGenerating}
                        className="flex items-center justify-center gap-1.5 py-2 bg-transparent border border-white/20 hover:border-white hover:bg-white/5 text-white rounded-md text-[9px] font-bold tracking-widest transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Settings size={10} /> Config
                    </button>
                </div>

                {/* KLING ENABLE VIDEO BUTTON */}
                {asset.type !== 'location' && (
                    <div className="w-full">
                        {asset.kling_element_id ? (
                            <div className="w-full py-1.5 bg-[#00ff41]/10 border border-[#00ff41]/30 rounded-md flex items-center justify-center gap-1.5 text-[#00ff41] text-[9px] font-bold tracking-widest uppercase cursor-default">
                                <Video size={10} /> Video Ready
                            </div>
                        ) : (
                            <button
                                onClick={(e) => { e.stopPropagation(); onRegisterKling?.(asset); }}
                                disabled={isGenerating || !onRegisterKling}
                                className="w-full py-1.5 bg-blue-500/10 hover:bg-blue-500/30 border border-blue-500/20 hover:border-blue-500/50 text-blue-200 rounded-md flex items-center justify-center gap-1.5 text-[9px] font-bold tracking-widest uppercase transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Video size={10} /> Enable Video
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};