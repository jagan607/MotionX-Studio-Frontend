import React from "react";
import { ArrowLeft, Layers, MapPin, Users, ChevronDown, MonitorPlay, FileText } from "lucide-react"; // Added FileText
import { useRouter } from "next/navigation";
import { Project } from "@/lib/types";

interface StudioControlBarProps {
    project: Project;
    episodes: any[];
    activeEpisodeId: string;
    onEpisodeChange: (id: string) => void;
    stats: {
        sceneCount: number;
        assetCount: number;
        visualProgress: number;
    };
}

export const StudioControlBar: React.FC<StudioControlBarProps> = ({
    project,
    episodes,
    activeEpisodeId,
    onEpisodeChange,
    stats
}) => {
    const router = useRouter();
    const isSeries = project.type === 'micro_drama';

    return (
        <div className="w-full border-b border-[#222] bg-[#090909] sticky top-0 z-40">

            {/* TOP ROW */}
            <div className="flex items-center justify-between px-8 py-4">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="flex items-center gap-2 text-[10px] font-bold tracking-widest text-neutral-500 hover:text-white transition-colors"
                    >
                        <ArrowLeft size={12} /> DASHBOARD
                    </button>

                    <div className="h-4 w-[1px] bg-[#333]" />

                    <h1 className="text-sm font-display uppercase text-white tracking-wider">
                        {project.title} <span className="text-neutral-600">//</span> PRODUCTION TERMINAL
                    </h1>
                </div>

                {/* Right Side: CTAs */}
                <div className="flex items-center gap-3">
                    {/* NEW: Script Editor Button */}
                    <button
                        onClick={() => router.push(`/project/${project.id}/script`)}
                        className="flex items-center gap-2 px-4 py-2 bg-[#111] border border-[#333] hover:border-white rounded text-[10px] font-bold text-white tracking-widest transition-all"
                    >
                        <FileText size={12} /> SCRIPT
                    </button>

                    <button
                        onClick={() => router.push(`/project/${project.id}/assets`)}
                        className="flex items-center gap-2 px-4 py-2 bg-[#111] border border-[#333] hover:border-white rounded text-[10px] font-bold text-white tracking-widest transition-all"
                    >
                        <Users size={12} /> ASSETS
                    </button>
                </div>
            </div>

            {/* BOTTOM ROW: CONTROLS & STATS */}
            <div className="flex items-center justify-between px-8 py-3 bg-[#050505] border-t border-[#1a1a1a]">

                {/* Episode Selector */}
                <div className="flex items-center gap-4">
                    {isSeries ? (
                        <div className="relative group">
                            <select
                                value={activeEpisodeId}
                                onChange={(e) => onEpisodeChange(e.target.value)}
                                className="appearance-none bg-transparent text-motion-red font-display font-bold text-xl uppercase pr-8 outline-none cursor-pointer hover:opacity-80 transition-opacity"
                            >
                                {episodes.map(ep => (
                                    <option key={ep.id} value={ep.id} className="bg-black text-white">
                                        EPISODE {ep.number}: {ep.title}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown size={14} className="absolute right-0 top-1/2 -translate-y-1/2 text-motion-red pointer-events-none" />
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 text-motion-red font-display font-bold text-xl uppercase">
                            <MonitorPlay size={20} />
                            <span>FEATURE FILM</span>
                        </div>
                    )}
                </div>

                {/* Stats */}
                <div className="flex items-center gap-6">
                    <StatItem icon={<Layers size={12} />} label="SCENES" value={stats.sceneCount} />
                    <StatItem icon={<MapPin size={12} />} label="ASSETS" value={stats.assetCount} />

                    <div className="flex flex-col gap-1 w-32">
                        <div className="flex justify-between text-[9px] font-mono text-neutral-500">
                            <span>VISUALS</span>
                            <span>{stats.visualProgress}%</span>
                        </div>
                        <div className="h-1 bg-[#222] rounded-full overflow-hidden">
                            <div
                                className="h-full bg-motion-red transition-all duration-1000"
                                style={{ width: `${stats.visualProgress}%` }}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const StatItem = ({ icon, label, value }: any) => (
    <div className="flex items-center gap-2 text-neutral-500">
        {icon}
        <div className="flex flex-col leading-none">
            <span className="text-[10px] font-bold text-white">{value}</span>
            <span className="text-[8px] tracking-wider uppercase">{label}</span>
        </div>
    </div>
);