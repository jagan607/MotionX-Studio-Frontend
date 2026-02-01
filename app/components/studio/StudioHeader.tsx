"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    ArrowLeft, MonitorPlay, FileText, Database, Settings,
    Plus, Edit3, Clapperboard
} from "lucide-react";
import { useCredits } from "@/hooks/useCredits";
import CreditModal from "@/app/components/modals/CreditModal";

interface StudioHeaderProps {
    projectTitle: string;
    projectId: string;
    // Removed renderProgress as requested
    activeEpisodeId?: string; // Crucial for the 'Scenes' link
    onOpenSettings: () => void;
    className?: string;
}

export const StudioHeader: React.FC<StudioHeaderProps> = ({
    projectTitle,
    projectId,
    activeEpisodeId,
    onOpenSettings,
    className = ""
}) => {
    const pathname = usePathname();
    const { credits } = useCredits();
    const [showTopUp, setShowTopUp] = useState(false);

    // --- NAVIGATION LOGIC ---
    // Helper to determine strictly which tab is active based on the URL
    const getActiveTab = () => {
        if (pathname.includes("/script")) return "script";
        if (pathname.includes("/editor")) return "scenes";
        if (pathname.endsWith("/assets")) return "assets";
        if (pathname.endsWith("/studio")) return "studio";
        return "";
    };

    const activeTab = getActiveTab();

    // Scenes Link Construction
    // Valid only if we have a valid Episode ID (not empty/placeholder)
    const canEnterScenes = activeEpisodeId && activeEpisodeId !== "empty" && activeEpisodeId !== "new_placeholder";
    const scenesHref = canEnterScenes ? `/project/${projectId}/episode/${activeEpisodeId}/editor` : "#";

    // --- STYLES ---
    const tabBase = "flex items-center gap-2 px-4 py-1.5 rounded-sm transition-all duration-200 text-[10px] font-bold uppercase tracking-widest select-none";
    const tabActive = "bg-[#222] text-white shadow-sm border border-[#333]";
    const tabInactive = "text-[#666] hover:text-white hover:bg-[#151515] border border-transparent";
    const tabDisabled = "text-[#333] cursor-not-allowed border border-transparent opacity-50";

    return (
        <>
            <CreditModal isOpen={showTopUp} onClose={() => setShowTopUp(false)} />

            <header className={`h-20 border-b border-[#222] bg-[#050505] flex items-center justify-between px-6 shrink-0 z-50 ${className}`}>

                {/* --- LEFT: CONTEXT & BACK --- */}
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

                {/* --- RIGHT: WORKFLOW & TOOLS --- */}
                <div className="flex items-center h-full gap-8">

                    <div className="flex items-center gap-3">

                        {/* CONFIG BUTTON (Separate from Switcher) */}
                        <button
                            onClick={onOpenSettings}
                            className="flex items-center gap-2 px-4 py-2 bg-[#0A0A0A] border border-[#222] hover:bg-[#151515] hover:border-[#444] transition-all group rounded-sm mr-2"
                            title="Project Settings"
                        >
                            <Settings size={12} className="text-[#666] group-hover:text-white group-hover:rotate-90 transition-all duration-500" />
                            <span className="text-[10px] font-bold text-[#666] group-hover:text-white uppercase tracking-widest">Config</span>
                        </button>

                        {/* MAIN NAVIGATION SWITCHER */}
                        <div className="flex items-center bg-[#0A0A0A] border border-[#222] rounded-sm p-1 gap-1">

                            {/* 1. STUDIO */}
                            <Link
                                href={`/project/${projectId}/studio`}
                                className={`${tabBase} ${activeTab === "studio" ? tabActive : tabInactive}`}
                            >
                                <Clapperboard size={12} className={activeTab === "studio" ? "text-red-500" : "text-[#666]"} />
                                <span>Studio</span>
                            </Link>

                            {/* 2. SCRIPT */}
                            <Link
                                href={`/project/${projectId}/script`}
                                className={`${tabBase} ${activeTab === "script" ? tabActive : tabInactive}`}
                            >
                                <FileText size={12} className={activeTab === "script" ? "text-red-500" : "text-[#666]"} />
                                <span>Script</span>
                            </Link>

                            {/* 3. SCENES (Conditional Link) */}
                            {canEnterScenes ? (
                                <Link
                                    href={scenesHref}
                                    className={`${tabBase} ${activeTab === "scenes" ? tabActive : tabInactive}`}
                                >
                                    <Edit3 size={12} className={activeTab === "scenes" ? "text-red-500" : "text-[#666]"} />
                                    <span>Scenes</span>
                                </Link>
                            ) : (
                                <div className={`${tabBase} ${tabDisabled}`}>
                                    <Edit3 size={12} />
                                    <span>Scenes</span>
                                </div>
                            )}

                            {/* 4. ASSETS */}
                            <Link
                                href={`/project/${projectId}/assets`}
                                className={`${tabBase} ${activeTab === "assets" ? tabActive : tabInactive}`}
                            >
                                <Database size={12} className={activeTab === "assets" ? "text-red-500" : "text-[#666]"} />
                                <span>Assets</span>
                            </Link>
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