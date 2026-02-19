"use client";

import React from "react";
import { Layers, Film, Plus, Settings } from "lucide-react";

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
    onOpenSettings?: () => void;
    projectType?: string;
    className?: string;
}

export const ReelSidebar: React.FC<ReelSidebarProps> = ({
    episodes,
    activeEpisodeId,
    onSelectEpisode,
    onNewEpisode,
    onEditEpisode,
    onOpenSettings,
    projectType,
    metadata,
    className = ""
}) => {
    return (
        <div id="tour-studio-sidebar" className={`w-[280px] bg-[#050505] border-r border-white/[0.06] flex flex-col shrink-0 ${className}`}>

            {/* --- REEL LIST SECTION --- */}
            <div className="p-6 border-b border-white/[0.06] flex-1 overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                    <div className="text-[10px] font-semibold text-neutral-600 uppercase tracking-widest flex items-center gap-2">
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
                                className={`w-full flex items-center justify-between px-4 py-3 text-[10px] font-bold tracking-widest uppercase transition-all rounded-lg group
                                ${isActive
                                        ? "bg-white/[0.04] text-white border border-white/[0.08] border-l-2 border-l-[#E50914]"
                                        : "text-neutral-600 hover:text-neutral-300 hover:bg-white/[0.02] border border-transparent"
                                    }`}
                            >
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <Film size={14} className={isActive ? "text-[#E50914]" : "text-neutral-700 group-hover:text-neutral-500"} />
                                    <span className="truncate max-w-[140px]" title={ep.title}>
                                        {ep.title || `EPISODE ${ep.episode_number}`}
                                    </span>
                                </div>

                                {isActive && (
                                    <div className="flex items-center gap-2">
                                        {onEditEpisode && (
                                            <div
                                                onClick={(e) => { e.stopPropagation(); onEditEpisode(ep.id); }}
                                                className="w-5 h-5 flex items-center justify-center rounded-full bg-[#E50914]/20 text-red-400 hover:bg-[#E50914] hover:text-white transition-colors border border-[#E50914]/30"
                                                title="Edit Script"
                                            >
                                                <Layers size={10} />
                                            </div>
                                        )}
                                        <div className="w-1.5 h-1.5 bg-[#E50914] rounded-full animate-pulse shadow-[0_0_8px_rgba(229,9,20,0.6)]" />
                                    </div>
                                )}
                            </button>
                        );
                    })}

                    {/* Empty State */}
                    {episodes.length === 0 && (
                        <div className="text-[10px] text-neutral-600 text-center py-8 italic border border-dashed border-white/[0.06] rounded-lg">
                            No active reels found.
                        </div>
                    )}

                    {/* NEW REEL CTA — only for multi-episode projects */}
                    {projectType !== 'movie' && projectType !== 'ad' && (
                        <button
                            onClick={onNewEpisode}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 mt-4 text-[10px] font-bold tracking-widest uppercase text-neutral-600 border border-dashed border-white/[0.08] rounded-lg hover:border-white/[0.15] hover:text-white hover:bg-white/[0.02] transition-all group"
                        >
                            <Plus size={12} className="group-hover:rotate-90 transition-transform duration-300" />
                            <span>New Reel</span>
                        </button>
                    )}
                </div>
            </div>

            {/* --- METADATA FOOTER --- */}
            <div className="p-6 mt-auto bg-[#050505]">
                <div className="p-4 bg-white/[0.02] border border-white/[0.06] rounded-lg flex flex-col gap-2.5 relative overflow-hidden">
                    {/* Decorative accent */}
                    <div className="absolute top-0 left-0 w-1 h-full bg-[#E50914]/25 rounded-full" />

                    <div className="flex justify-between items-center text-[9px] text-neutral-600 pl-3">
                        <span>Scenes</span>
                        <span className="text-neutral-300 font-medium">{metadata.sceneCount}</span>
                    </div>
                    <div className="flex justify-between items-center text-[9px] text-neutral-600 pl-3">
                        <span>Assets</span>
                        <span className="text-neutral-300 font-medium">{metadata.assetCount}</span>
                    </div>
                    <div className="flex justify-between items-center text-[9px] text-neutral-600 pl-3">
                        <span>Format</span>
                        <span className="text-neutral-300 font-medium">{metadata.format}</span>
                    </div>
                </div>
            </div>

            {/* --- CONFIG BUTTON --- */}
            {onOpenSettings && (
                <div className="px-6 pb-4">
                    <button
                        onClick={onOpenSettings}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] hover:border-white/[0.1] transition-all group rounded-lg"
                        title="Project Settings"
                    >
                        <Settings size={12} className="text-[#666] group-hover:text-white group-hover:rotate-90 transition-all duration-500" />
                        <span className="text-[10px] font-semibold text-neutral-600 group-hover:text-white uppercase tracking-widest">Settings</span>
                    </button>
                </div>
            )}
        </div>
    );
};