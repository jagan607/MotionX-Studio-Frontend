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
    Plus,
    Zap
} from "lucide-react";
import { useCredits } from "@/hooks/useCredits"; // Ensures connection to users/{uid}/credits
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
    const { credits } = useCredits(); // Connects to Firestore: users/{uid} -> field: credits
    const [showTopUp, setShowTopUp] = useState(false);

    return (
        <>
            <CreditModal isOpen={showTopUp} onClose={() => setShowTopUp(false)} />

            <header className={`h-20 border-b border-[#222] bg-[#050505] flex items-center justify-between px-6 shrink-0 z-50 select-none ${className}`}>

                {/* --- LEFT: NAVIGATION & CONTEXT --- */}
                <div className="flex items-center h-full gap-6">

                    {/* 1. Dashboard Back Link */}
                    <Link
                        href="/dashboard"
                        className="flex items-center gap-2 text-[#444] hover:text-white transition-colors group h-full"
                        title="Return to Dashboard"
                    >
                        <div className="p-2 rounded-full group-hover:bg-[#111] transition-colors">
                            <ArrowLeft size={18} className="group-hover:-translate-x-0.5 transition-transform duration-300" />
                        </div>
                    </Link>

                    <div className="h-8 w-[1px] bg-[#222]" />

                    {/* 2. Project Context (Revamped Layout) */}
                    <div className="flex flex-col justify-center">
                        {/* System Label */}
                        <div className="flex items-center gap-2 mb-0.5">
                            <MonitorPlay size={10} className="text-red-600" />
                            <span className="text-[9px] font-mono text-[#555] tracking-[0.2em] uppercase leading-none">
                                Visualization Studio
                            </span>
                        </div>

                        {/* Project Title & Config */}
                        <div className="flex items-center gap-3">
                            <h1 className="text-lg font-display font-bold text-white tracking-wide uppercase leading-none truncate max-w-[300px]">
                                {projectTitle || "Untitled Project"}
                            </h1>

                            {/* Settings Button */}
                            <button
                                onClick={onOpenSettings}
                                className="flex items-center gap-1.5 px-2 py-0.5 ml-2 bg-[#111] border border-[#222] rounded hover:border-[#444] hover:bg-[#1A1A1A] transition-all group"
                            >
                                <Settings size={10} className="text-[#666] group-hover:text-white group-hover:rotate-90 transition-all duration-500" />
                                <span className="text-[9px] font-mono font-bold text-[#666] group-hover:text-white uppercase tracking-wider">Config</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* --- RIGHT: TOOLS, STATUS & CREDITS --- */}
                <div className="flex items-center h-full gap-8">

                    {/* 1. Editor Navigation */}
                    <div className="flex items-center bg-[#0A0A0A] border border-[#222] rounded-sm overflow-hidden">
                        <Link
                            href={`/project/${projectId}/script`}
                            className="flex items-center gap-2 px-5 py-2.5 border-r border-[#222] hover:bg-[#151515] transition-colors group"
                        >
                            <FileText size={12} className="text-[#666] group-hover:text-white transition-colors" />
                            <span className="text-[10px] font-bold text-[#666] group-hover:text-white uppercase tracking-widest transition-colors">Script</span>
                        </Link>
                        <Link
                            href={`/project/${projectId}/assets`}
                            className="flex items-center gap-2 px-5 py-2.5 hover:bg-[#151515] transition-colors group"
                        >
                            <Database size={12} className="text-[#666] group-hover:text-white transition-colors" />
                            <span className="text-[10px] font-bold text-[#666] group-hover:text-white uppercase tracking-widest transition-colors">Assets</span>
                        </Link>
                    </div>

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

                    {/* 3. Credits & Top Up (Matching Global Header) */}
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