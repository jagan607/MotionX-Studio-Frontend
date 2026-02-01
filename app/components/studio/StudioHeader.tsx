"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
    ArrowLeft, MonitorPlay, FileText, Database, Settings,
    CheckCircle2, Plus, Edit3, Clapperboard
} from "lucide-react";
import { useCredits } from "@/hooks/useCredits";
import CreditModal from "@/app/components/modals/CreditModal";

interface StudioHeaderProps {
    projectTitle: string;
    projectId: string;
    renderProgress: number;
    activeEpisodeId?: string;
    onOpenSettings: () => void;
    className?: string;
}

export const StudioHeader: React.FC<StudioHeaderProps> = ({
    projectTitle,
    projectId,
    renderProgress,
    activeEpisodeId,
    onOpenSettings,
    className = ""
}) => {
    const { credits } = useCredits();
    const [showTopUp, setShowTopUp] = useState(false);

    // Determine if Scene Manager should be enabled
    const hasActiveEpisode = activeEpisodeId && activeEpisodeId !== "empty" && activeEpisodeId !== "new_placeholder";

    return (
        <>
            <CreditModal isOpen={showTopUp} onClose={() => setShowTopUp(false)} />

            <header className={`h-20 border-b border-[#222] bg-[#050505] flex items-center justify-between px-6 shrink-0 z-50 select-none ${className}`}>

                {/* --- LEFT: CONTEXT --- */}
                <div className="flex items-center h-full gap-6">
                    <Link href="/dashboard" className="flex items-center gap-3 text-[#555] hover:text-white transition-colors group h-full">
                        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                        <span className="text-[10px] font-bold tracking-[0.2em] uppercase">Dashboard</span>
                    </Link>

                    <div className="h-8 w-[1px] bg-[#222]" />

                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <MonitorPlay size={14} className="text-red-600" />
                            <h2 className="text-sm font-display font-bold text-white uppercase tracking-tight leading-none">
                                Visualization Studio
                            </h2>
                        </div>
                        <span className="text-[#333] font-mono text-lg">/</span>
                        <h1 className="text-sm font-mono text-[#888] uppercase tracking-wider truncate max-w-[300px]">
                            {projectTitle || "Untitled Project"}
                        </h1>
                    </div>
                </div>

                {/* --- RIGHT: WORKFLOW TOOLS --- */}
                <div className="flex items-center h-full gap-8">

                    <div className="flex items-center gap-3">

                        {/* 4. CONFIG */}
                        <button
                            onClick={onOpenSettings}
                            className="flex items-center gap-2 px-4 py-2 bg-[#0A0A0A] border border-[#222] hover:bg-[#151515] hover:border-[#444] transition-all group rounded-sm"
                            title="Project Settings"
                        >
                            <Settings size={12} className="text-[#666] group-hover:text-white group-hover:rotate-90 transition-all duration-500" />
                            <span className="text-[10px] font-bold text-[#666] group-hover:text-white uppercase tracking-widest">Config</span>
                        </button>

                        {/* WORKFLOW NAVIGATION GROUP */}
                        <div className="flex items-center bg-[#0A0A0A] border border-[#222] rounded-sm overflow-hidden p-1 gap-1">

                            {/* 1. SCRIPT (Ingestion) */}
                            <Link
                                href={`/project/${projectId}/script`}
                                className="flex items-center gap-2 px-4 py-1.5 hover:bg-[#151515] rounded-sm transition-colors group"
                                title="Ingest Script"
                            >
                                <FileText size={12} className="text-[#666] group-hover:text-white transition-colors" />
                                <span className="text-[10px] font-bold text-[#666] group-hover:text-white uppercase tracking-widest transition-colors">Script</span>
                            </Link>

                            {/* 2. SCENES (Editor) - Highlighted if Active */}
                            {hasActiveEpisode ? (
                                <Link
                                    href={`/project/${projectId}/episode/${activeEpisodeId}/editor`}
                                    className="flex items-center gap-2 px-4 py-1.5 bg-[#1A1A1A] border border-transparent hover:bg-red-600 hover:text-white hover:border-red-500 rounded-sm group transition-all shadow-sm hover:shadow-red-900/20"
                                    title="Open Scene Manager"
                                >
                                    <Edit3 size={12} className="text-white group-hover:text-white" />
                                    <span className="text-[10px] font-bold text-white uppercase tracking-widest">Scenes</span>
                                </Link>
                            ) : (
                                <div className="flex items-center gap-2 px-4 py-1.5 opacity-30 cursor-not-allowed">
                                    <Edit3 size={12} />
                                    <span className="text-[10px] font-bold uppercase tracking-widest">Scenes</span>
                                </div>
                            )}

                            {/* 3. ASSETS */}
                            <Link
                                href={`/project/${projectId}/assets`}
                                className="flex items-center gap-2 px-4 py-1.5 hover:bg-[#151515] rounded-sm transition-colors group"
                                title="View Assets"
                            >
                                <Database size={12} className="text-[#666] group-hover:text-white transition-colors" />
                                <span className="text-[10px] font-bold text-[#666] group-hover:text-white uppercase tracking-widest transition-colors">Assets</span>
                            </Link>
                        </div>
                    </div>

                    <div className="h-8 w-[1px] bg-[#222]" />

                    {/* STATUS: Render Queue */}
                    <div className="flex flex-col items-end min-w-[140px]">
                        <div className="flex items-center justify-between w-full mb-1.5">
                            <span className="text-[9px] font-mono text-[#555] tracking-widest">RENDER QUEUE</span>
                            <div className="flex items-center gap-2">
                                {renderProgress === 100 && <CheckCircle2 size={10} className="text-green-500" />}
                                <span className={`text-[10px] font-mono font-bold ${renderProgress > 0 ? 'text-white' : 'text-[#333]'}`}>
                                    {renderProgress}%
                                </span>
                            </div>
                        </div>
                        <div className="w-full h-1 bg-[#151515] overflow-hidden">
                            <div className="h-full bg-red-600 transition-all duration-700 ease-out" style={{ width: `${renderProgress}%` }} />
                        </div>
                    </div>

                    <div className="h-8 w-[1px] bg-[#222]" />

                    {/* STATUS: Credits */}
                    <div className="flex items-center gap-5">
                        <div className="text-right">
                            <div className="flex items-center justify-end gap-1.5 mb-0.5">
                                <span className="block text-[8px] text-[#888] font-mono uppercase leading-none">Credits</span>
                                {credits !== null && <div className="w-1 h-1 rounded-full bg-green-500 animate-pulse" />}
                            </div>
                            <div className="text-[13px] text-white font-bold font-mono tracking-wider leading-none">
                                {credits !== null ? credits.toLocaleString() : <span className="text-[#333] animate-pulse">---</span>}
                            </div>
                        </div>
                        <button onClick={() => setShowTopUp(true)} className="flex items-center gap-1.5 bg-red-900/10 border border-red-600/30 text-white px-4 py-2 text-[9px] font-bold uppercase cursor-pointer transition-all hover:bg-red-600 hover:border-red-600 rounded-sm">
                            <Plus size={10} strokeWidth={4} /> Top Up
                        </button>
                    </div>
                </div>
            </header>
        </>
    );
};