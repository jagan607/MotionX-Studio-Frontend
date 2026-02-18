"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
    ArrowLeft, FileText, Database, Settings,
    Plus, Clapperboard, ChevronDown, Check
} from "lucide-react";
import { useCredits } from "@/hooks/useCredits";
import CreditModal from "@/app/components/modals/CreditModal";
import { auth } from "@/lib/firebase";
import { fetchUserProjectsBasic, DashboardProject } from "@/lib/api";

interface StudioHeaderProps {
    projectTitle: string;
    projectId: string;
    activeEpisodeId?: string;
    onOpenSettings: () => void;
    onOpenAssets?: () => void; // If provided, opens modal instead of navigating
    className?: string;
}

export const StudioHeader: React.FC<StudioHeaderProps> = ({
    projectTitle,
    projectId,
    activeEpisodeId,
    onOpenSettings,
    onOpenAssets,
    className = ""
}) => {
    const pathname = usePathname();
    const router = useRouter();
    const { credits } = useCredits();
    const [showTopUp, setShowTopUp] = useState(false);

    // --- PROJECT SWITCHER STATE ---
    const [projects, setProjects] = useState<DashboardProject[]>([]);
    const [showProjectDropdown, setShowProjectDropdown] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Fetch all user projects on mount
    useEffect(() => {
        const uid = auth.currentUser?.uid;
        if (uid) {
            fetchUserProjectsBasic(uid).then(setProjects);
        }
    }, []);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setShowProjectDropdown(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleProjectSwitch = (targetProjectId: string) => {
        setShowProjectDropdown(false);
        if (targetProjectId !== projectId) {
            router.push(`/project/${targetProjectId}/studio`);
        }
    };

    // --- NAVIGATION LOGIC ---
    const getActiveTab = () => {
        if (pathname.includes("/script")) return "script";
        if (pathname.endsWith("/assets")) return "assets";
        if (pathname.endsWith("/studio")) return "studio";
        return "";
    };

    const activeTab = getActiveTab();

    // --- LINK CONSTRUCTION ---
    const hasValidEpisode = activeEpisodeId && activeEpisodeId !== "empty" && activeEpisodeId !== "new_placeholder";

    const scriptHref = hasValidEpisode
        ? `/project/${projectId}/script?episode_id=${activeEpisodeId}`
        : `/project/${projectId}/script`;

    // --- STYLES ---
    const tabBase = "flex items-center gap-2 px-4 py-1.5 rounded-sm transition-all duration-200 text-[10px] font-bold uppercase tracking-widest select-none";
    const tabActive = "bg-[#222] text-white shadow-sm border border-[#333]";
    const tabInactive = "text-[#666] hover:text-white hover:bg-[#151515] border border-transparent";

    return (
        <>
            <CreditModal isOpen={showTopUp} onClose={() => setShowTopUp(false)} />

            <header className={`h-20 border-b border-[#222] bg-[#050505] flex items-center justify-between px-8 shrink-0 z-50 ${className}`}>

                {/* --- LEFT: BACK + STUDIO TITLE --- */}
                <div className="flex items-center h-full gap-6">
                    <Link href="/dashboard" className="flex items-center gap-3 text-[#555] hover:text-white transition-colors group h-full">
                        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                        <span className="text-[10px] font-bold tracking-[0.2em] uppercase">Dashboard</span>
                    </Link>

                    <h1 style={{ fontFamily: 'Anton, sans-serif', fontSize: '28px', letterSpacing: '1px', color: '#fff', textTransform: 'uppercase', margin: 0, lineHeight: 1 }}>
                        STUDIO
                    </h1>
                </div>

                {/* --- RIGHT: PROJECT SWITCHER + NAV + CREDITS --- */}
                <div className="flex items-center h-full gap-4">

                    {/* PROJECT SWITCHER DROPDOWN */}
                    <div className="relative" ref={dropdownRef}>
                        <button
                            onClick={() => setShowProjectDropdown(!showProjectDropdown)}
                            className="flex items-center justify-between gap-3 px-4 h-10 bg-[#1A1A1A] text-[#EEE] border border-[#333] hover:border-[#555] rounded transition-all group cursor-pointer min-w-[240px] max-w-[300px]"
                        >
                            <span className="text-[11px] font-semibold uppercase tracking-wide truncate select-none">
                                {projectTitle || "Untitled Project"}
                            </span>
                            <ChevronDown
                                size={14}
                                className={`text-[#666] group-hover:text-white transition-all duration-200 ${showProjectDropdown ? "rotate-180" : ""}`}
                            />
                        </button>

                        {showProjectDropdown && (
                            <div className="absolute top-full right-0 mt-1 w-full bg-[#1A1A1A] border border-[#333] rounded shadow-2xl shadow-black/80 z-[9999] overflow-hidden">
                                {/* Header */}
                                <div className="px-4 py-2.5 border-b border-[#222] flex items-center justify-between bg-[#111]">
                                    <span className="text-[9px] font-bold text-[#555] uppercase tracking-widest">Switch Project</span>
                                    <span className="text-[9px] font-mono text-[#333]">{projects.length}</span>
                                </div>

                                {/* Project List */}
                                <div className="max-h-[280px] overflow-y-auto">
                                    {projects.map((p) => (
                                        <button
                                            key={p.id}
                                            onClick={() => handleProjectSwitch(p.id)}
                                            className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all cursor-pointer ${p.id === projectId
                                                ? "bg-red-900/10 border-l-2 border-l-red-500"
                                                : "hover:bg-[#222] border-l-2 border-l-transparent"
                                                }`}
                                        >
                                            <div className="flex-1 min-w-0">
                                                <div className="text-[11px] font-bold text-[#EEE] uppercase tracking-wide truncate">
                                                    {p.title}
                                                </div>
                                                <div className="text-[9px] font-mono text-[#555] uppercase mt-0.5">
                                                    {p.type === 'movie' ? 'Feature Film' : p.type === 'ad' ? 'Advertisement' : 'Series'}
                                                </div>
                                            </div>
                                            {p.id === projectId && (
                                                <Check size={14} className="text-red-500 shrink-0" />
                                            )}
                                        </button>
                                    ))}

                                    {projects.length === 0 && (
                                        <div className="px-4 py-6 text-center text-[10px] text-[#444] font-mono">
                                            No projects found
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* DIVIDER */}
                    <div className="h-8 w-[1px] bg-[#222]" />

                    {/* CONFIG BUTTON */}
                    <button
                        onClick={onOpenSettings}
                        className="flex items-center gap-2 px-4 py-2 bg-[#0A0A0A] border border-[#222] hover:bg-[#151515] hover:border-[#444] transition-all group rounded-sm"
                        title="Project Settings"
                    >
                        <Settings size={12} className="text-[#666] group-hover:text-white group-hover:rotate-90 transition-all duration-500" />
                        <span className="text-[10px] font-bold text-[#666] group-hover:text-white uppercase tracking-widest">Config</span>
                    </button>

                    {/* MAIN NAVIGATION SWITCHER */}
                    <div className="flex items-center bg-[#0A0A0A] border border-[#222] rounded-sm p-1 gap-1">
                        <Link
                            href={`/project/${projectId}/studio`}
                            className={`${tabBase} ${activeTab === "studio" ? tabActive : tabInactive}`}
                        >
                            <Clapperboard size={12} className={activeTab === "studio" ? "text-red-500" : "text-[#666]"} />
                            <span>Studio</span>
                        </Link>
                        <Link
                            href={scriptHref}
                            className={`${tabBase} ${activeTab === "script" ? tabActive : tabInactive}`}
                        >
                            <FileText size={12} className={activeTab === "script" ? "text-red-500" : "text-[#666]"} />
                            <span>Script</span>
                        </Link>
                        {onOpenAssets ? (
                            <button
                                onClick={onOpenAssets}
                                className={`${tabBase} ${activeTab === "assets" ? tabActive : tabInactive}`}
                            >
                                <Database size={12} className={activeTab === "assets" ? "text-red-500" : "text-[#666]"} />
                                <span>Assets</span>
                            </button>
                        ) : (
                            <Link
                                href={`/project/${projectId}/assets`}
                                className={`${tabBase} ${activeTab === "assets" ? tabActive : tabInactive}`}
                            >
                                <Database size={12} className={activeTab === "assets" ? "text-red-500" : "text-[#666]"} />
                                <span>Assets</span>
                            </Link>
                        )}
                    </div>

                    {/* DIVIDER */}
                    <div className="h-8 w-[1px] bg-[#222]" />

                    {/* CREDITS */}
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