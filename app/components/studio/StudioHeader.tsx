"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
    ArrowLeft,
    MonitorPlay,
    FileText,
    Database,
    Settings,
    CheckCircle2,
    Plus
} from "lucide-react";
import { useCredits } from "@/hooks/useCredits"; // Dynamically fetches from users/{uid}
import CreditModal from "@/app/components/modals/CreditModal";

interface StudioHeaderProps {
    projectTitle: string;
    projectId: string;
    renderProgress: number; // 0 to 100
    onOpenSettings: () => void;
    className?: string;
}

export const StudioHeader: React.FC<StudioHeaderProps> = ({
    projectTitle,
    projectId,
    renderProgress,
    onOpenSettings,
    className = ""
}) => {
    const { credits } = useCredits(); // Live DB connection
    const [showTopUp, setShowTopUp] = useState(false);

    return (
        <>
            <CreditModal isOpen={showTopUp} onClose={() => setShowTopUp(false)} />

            <header className={`h-20 border-b border-[#222] bg-[#050505] flex items-center justify-between px-6 shrink-0 z-50 select-none ${className}`}>

                {/* --- LEFT: DASHBOARD & IDENTITY --- */}
                <div className="flex items-center h-full gap-6">

                    {/* 1. Dashboard Back Link */}
                    <Link
                        href="/dashboard"
                        className="flex items-center gap-3 text-[#555] hover:text-white transition-colors group h-full"
                    >
                        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform duration-300" />
                        <span className="text-[10px] font-bold tracking-[0.2em] uppercase">Dashboard</span>
                    </Link>

                    <div className="h-8 w-[1px] bg-[#222]" />

                    {/* 2. System Identity & Project Title (Side by Side) */}
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <MonitorPlay size={14} className="text-red-600" />
                            <h2 className="text-sm font-display font-bold text-white uppercase tracking-tight leading-none">
                                Visualization Studio
                            </h2>
                        </div>

                        {/* Separator Slash */}
                        <span className="text-[#333] font-mono text-lg">/</span>

                        <h1 className="text-sm font-mono text-[#888] uppercase tracking-wider truncate max-w-[300px]">
                            {projectTitle || "Untitled Project"}
                        </h1>
                    </div>
                </div>

                {/* --- RIGHT: TOOLS, STATUS & CREDITS --- */}
                <div className="flex items-center h-full gap-8">

                    {/* 1. Toolset: Config + Navigation */}
                    <div className="flex items-center gap-3">
                        {/* Config CTA (Moved to Right) */}
                        <button
                            onClick={onOpenSettings}
                            className="flex items-center gap-2 px-4 py-2 bg-[#0A0A0A] border border-[#222] hover:bg-[#151515] hover:border-[#444] transition-all group rounded-sm"
                        >
                            <Settings size={12} className="text-[#666] group-hover:text-white group-hover:rotate-90 transition-all duration-500" />
                            <span className="text-[10px] font-bold text-[#666] group-hover:text-white uppercase tracking-widest">Config</span>
                        </button>

                        {/* Navigation Group */}
                        <div className="flex items-center bg-[#0A0A0A] border border-[#222] rounded-sm overflow-hidden">
                            <Link
                                href={`/project/${projectId}/script`}
                                className="flex items-center gap-2 px-5 py-2 border-r border-[#222] hover:bg-[#151515] transition-colors group"
                            >
                                <FileText size={12} className="text-[#666] group-hover:text-white transition-colors" />
                                <span className="text-[10px] font-bold text-[#666] group-hover:text-white uppercase tracking-widest">Script</span>
                            </Link>
                            <Link
                                href={`/project/${projectId}/assets`}
                                className="flex items-center gap-2 px-5 py-2 hover:bg-[#151515] transition-colors group"
                            >
                                <Database size={12} className="text-[#666] group-hover:text-white transition-colors" />
                                <span className="text-[10px] font-bold text-[#666] group-hover:text-white uppercase tracking-widest">Assets</span>
                            </Link>
                        </div>
                    </div>

                    <div className="h-8 w-[1px] bg-[#222]" />

                    {/* 2. Render Progress Bar */}
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
                            <div
                                className="h-full bg-red-600 transition-all duration-700 ease-out shadow-[0_0_10px_rgba(220,38,38,0.5)]"
                                style={{ width: `${renderProgress}%` }}
                            />
                        </div>
                    </div>

                    <div className="h-8 w-[1px] bg-[#222]" />

                    {/* 3. Credits & Top Up (Dynamic) */}
                    <div className="flex items-center gap-5">
                        <div className="text-right">
                            <div className="flex items-center justify-end gap-1.5 mb-0.5">
                                <span className="block text-[8px] text-[#888] font-mono uppercase leading-none">Credits</span>
                                {credits !== null && <div className="w-1 h-1 rounded-full bg-green-500 animate-pulse" title="Live Sync Active" />}
                            </div>
                            <div className="text-[13px] text-white font-bold font-mono tracking-wider leading-none">
                                {credits !== null ? credits.toLocaleString() : <span className="text-[#333] animate-pulse">---</span>}
                            </div>
                        </div>

                        <button
                            onClick={() => setShowTopUp(true)}
                            className="flex items-center gap-1.5 bg-red-900/10 border border-red-600/30 text-white px-4 py-2 text-[9px] font-bold uppercase cursor-pointer transition-all hover:bg-red-600 hover:border-red-600 hover:shadow-[0_0_20px_rgba(220,38,38,0.4)] rounded-sm group"
                        >
                            <Plus size={10} strokeWidth={4} className="text-red-500 group-hover:text-white transition-colors" />
                            Top Up
                        </button>
                    </div>

                </div>
            </header>
        </>
    );
};