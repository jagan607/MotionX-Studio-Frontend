"use client";

import React from "react";
import Link from "next/link";
import {
    ArrowLeft,
    MonitorPlay,
    FileText,
    Database,
    Settings,
    CheckCircle2,
    Coins
} from "lucide-react";

interface StudioHeaderProps {
    projectTitle: string;
    projectId: string;
    renderProgress: number; // 0 to 100
    credits?: number;
    onOpenSettings: () => void;
    className?: string;
}

export const StudioHeader: React.FC<StudioHeaderProps> = ({
    projectTitle,
    projectId,
    renderProgress,
    credits = 0,
    onOpenSettings,
    className = ""
}) => {
    return (
        <header className={`h-20 border-b border-[#222] bg-[#080808] flex items-center justify-between px-8 shrink-0 z-50 ${className}`}>

            {/* --- LEFT: NAVIGATION & TITLE --- */}
            <div className="flex items-center gap-8">
                {/* Back to Dashboard */}
                <Link href="/dashboard" className="flex items-center gap-2 text-[#666] hover:text-white transition-colors group">
                    <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                    <span className="text-[10px] font-bold tracking-[0.2em] uppercase">Dashboard</span>
                </Link>

                <div className="h-8 w-[1px] bg-[#222]" />

                {/* Project Identity */}
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <MonitorPlay size={16} className="text-red-600" />
                        <h1 className="text-xl font-display font-bold uppercase text-white tracking-tight leading-none">
                            VISUALIZATION STUDIO
                        </h1>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="text-[10px] font-mono text-[#555] uppercase tracking-widest truncate max-w-[200px]">
                            {projectTitle || "UNTITLED PROJECT"}
                        </div>

                        {/* SETTINGS TRIGGER */}
                        <button
                            onClick={onOpenSettings}
                            className="text-[#444] hover:text-white transition-colors p-1"
                            title="Project Settings"
                        >
                            <Settings size={12} />
                        </button>
                    </div>
                </div>
            </div>

            {/* --- RIGHT: TOOLS & STATUS --- */}
            <div className="flex items-center gap-6">

                {/* Main Navigation */}
                <div className="flex bg-[#0A0A0A] border border-[#222]">
                    <Link
                        href={`/project/${projectId}/script`}
                        className="flex items-center gap-2 px-4 py-2 border-r border-[#222] hover:bg-[#111] transition-colors group"
                    >
                        <FileText size={12} className="text-[#666] group-hover:text-white" />
                        <span className="text-[10px] font-bold text-[#666] group-hover:text-white uppercase tracking-widest">Script</span>
                    </Link>
                    <Link
                        href={`/project/${projectId}/assets`}
                        className="flex items-center gap-2 px-4 py-2 hover:bg-[#111] transition-colors group"
                    >
                        <Database size={12} className="text-[#666] group-hover:text-white" />
                        <span className="text-[10px] font-bold text-[#666] group-hover:text-white uppercase tracking-widest">Assets</span>
                    </Link>
                </div>

                <div className="h-8 w-[1px] bg-[#222]" />

                {/* CREDIT WIDGET */}
                <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-2 text-[10px] font-mono text-[#666]">
                        <Coins size={10} className="text-yellow-600" />
                        <span className="tracking-widest">BALANCE</span>
                    </div>
                    <div className="text-sm font-bold text-white leading-none tracking-wider">
                        {credits.toLocaleString()} <span className="text-[9px] text-[#444] font-normal">CR</span>
                    </div>
                </div>

                <div className="h-8 w-[1px] bg-[#222]" />

                {/* RENDER STATS */}
                <div className="flex flex-col items-end">
                    <div className="text-[10px] font-mono text-[#666] mb-1 uppercase tracking-widest flex items-center gap-2">
                        {renderProgress === 100 ? <CheckCircle2 size={10} className="text-green-500" /> : null}
                        RENDER PROGRESS: <span className="text-white">{renderProgress}%</span>
                    </div>
                    <div className="w-32 h-1 bg-[#1A1A1A]">
                        <div
                            className="h-full bg-red-600 transition-all duration-700 ease-out"
                            style={{ width: `${renderProgress}%` }}
                        />
                    </div>
                </div>
            </div>
        </header>
    );
};