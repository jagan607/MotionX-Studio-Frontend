"use client";

import React from "react";
import { Layers, Film, Plus } from "lucide-react";

// Define the shape of an Episode object based on your DB
interface Episode {
    id: string;
    title?: string;
    episode_number?: number;
    synopsis?: string;
}

interface ReelSidebarProps {
    episodes: Episode[];
    activeEpisodeId: string;
    onSelectEpisode: (id: string) => void;
    onNewEpisode: () => void;
    metadata: {
        sceneCount: number;
        assetCount: number;
        format: string;
    };
    onEditEpisode?: (id: string) => void;
    className?: string;
}

export const ReelSidebar: React.FC<ReelSidebarProps> = ({
    episodes,
    activeEpisodeId,
    onSelectEpisode,
    onNewEpisode,
    onEditEpisode,
    metadata,
    className = ""
}) => {
    return (
        <div className={`w-[280px] bg-[#050505] border-r border-[#222] flex flex-col shrink-0 ${className}`}>

            {/* --- REEL LIST SECTION --- */}
            <div className="p-6 border-b border-[#222] flex-1 overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                    <div className="text-[10px] font-bold text-[#444] uppercase tracking-widest flex items-center gap-2">
                        <Layers size={14} /> Active Reels
                    </div>
                </div>

                <div className="space-y-1">
                    {episodes.map((ep) => {
                        const isActive = activeEpisodeId === ep.id;
                        return (
                            <button
                                key={ep.id}
                                onClick={() => onSelectEpisode(ep.id)}
                                className={`w-full flex items-center justify-between px-4 py-3 text-[10px] font-bold tracking-widest uppercase transition-all border border-transparent group
                                ${isActive
                                        ? "bg-[#111] text-white border-[#222] border-l-2 border-l-red-600"
                                        : "text-[#555] hover:text-[#AAA] hover:bg-[#0A0A0A]"
                                    }`}
                            >
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <Film size={14} className={isActive ? "text-red-500" : "text-[#333] group-hover:text-[#555]"} />
                                    <span className="truncate max-w-[140px]" title={ep.title}>
                                        {ep.title || `EPISODE ${ep.episode_number}`}
                                    </span>
                                </div>

                                {isActive && (
                                    <div className="flex items-center gap-2">
                                        {onEditEpisode && (
                                            <div
                                                onClick={(e) => { e.stopPropagation(); onEditEpisode(ep.id); }}
                                                className="w-5 h-5 flex items-center justify-center rounded-full bg-red-900/30 text-red-400 hover:bg-red-600 hover:text-white transition-colors border border-red-900/50"
                                                title="Edit Script"
                                            >
                                                <Layers size={10} />
                                            </div>
                                        )}
                                        <div className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse shadow-[0_0_8px_rgba(220,38,38,0.8)]" />
                                    </div>
                                )}
                            </button>
                        );
                    })}

                    {/* Empty State */}
                    {episodes.length === 0 && (
                        <div className="text-[10px] text-[#333] text-center py-8 italic border border-dashed border-[#222] rounded-sm">
                            No active reels found.
                        </div>
                    )}

                    {/* NEW REEL CTA */}
                    <button
                        onClick={onNewEpisode}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 mt-4 text-[10px] font-bold tracking-widest uppercase text-[#444] border border-dashed border-[#333] hover:border-[#666] hover:text-white hover:bg-[#0A0A0A] transition-all group"
                    >
                        <Plus size={12} className="group-hover:rotate-90 transition-transform duration-300" />
                        <span>New Reel</span>
                    </button>
                </div>
            </div>

            {/* --- METADATA FOOTER --- */}
            <div className="p-6 mt-auto bg-[#050505]">
                <div className="p-4 bg-[#0A0A0A] border border-[#222] flex flex-col gap-2 relative overflow-hidden">
                    {/* Decorative accent */}
                    <div className="absolute top-0 left-0 w-1 h-full bg-[#151515]" />

                    <div className="flex justify-between items-center text-[9px] text-[#555] font-mono">
                        <span>SCENE COUNT</span>
                        <span className="text-white">{metadata.sceneCount}</span>
                    </div>
                    <div className="flex justify-between items-center text-[9px] text-[#555] font-mono">
                        <span>ASSET DB</span>
                        <span className="text-white">{metadata.assetCount}</span>
                    </div>
                    <div className="flex justify-between items-center text-[9px] text-[#555] font-mono">
                        <span>FORMAT</span>
                        <span className="text-white">{metadata.format}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};