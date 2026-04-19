"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    ArrowLeft, ChevronDown, Check, Plus, FileText,
    Database, Play, Clapperboard
} from "lucide-react";
import { useCredits } from "@/hooks/useCredits";
import { formatCredits } from "@/app/hooks/usePricing";
import CreditModal from "@/app/components/modals/CreditModal";
import { auth } from "@/lib/firebase";
import { fetchUserProjectsBasic, DashboardProject } from "@/lib/api";
import { Project } from "@/lib/types";

interface PreProductionHeaderProps {
    projectTitle: string;
    projectId: string;
    project: Project | null;
    activeEpisodeId?: string;
    hasScript?: boolean;
    onOpenAssets?: () => void;
    onEditScript?: () => void;
    className?: string;
}

export const PreProductionHeader: React.FC<PreProductionHeaderProps> = ({
    projectTitle,
    projectId,
    project,
    activeEpisodeId,
    hasScript = false,
    onOpenAssets,
    onEditScript,
    className = ""
}) => {
    const router = useRouter();
    const { credits, plan } = useCredits();
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
            router.push(`/project/${targetProjectId}/preproduction`);
        }
    };

    const productionUrl = project?.type === 'micro_drama'
        ? `/project/${projectId}/studio`
        : `/project/${projectId}/storyboard`;

    return (
        <>
            <CreditModal isOpen={showTopUp} onClose={() => setShowTopUp(false)} />

            <header className={`h-16 border-b border-white/[0.06] bg-[#050505]/85 backdrop-blur-xl flex items-center justify-between px-6 shrink-0 z-50 ${className}`}>

                {/* LEFT: Back to Project Hub */}
                <div className="flex items-center h-full gap-5">
                    <Link href={`/project/${projectId}`} className="flex items-center gap-2.5 text-[#555] hover:text-white transition-colors group h-full no-underline">
                        <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
                        <span className="text-[9px] font-bold tracking-[0.2em] uppercase">Project Hub</span>
                    </Link>
                </div>

                {/* RIGHT: PROJECT SWITCHER + CTAs + CREDITS */}
                <div className="flex items-center h-full gap-3">

                    {/* PROJECT SWITCHER DROPDOWN */}
                    <div className="relative" ref={dropdownRef}>
                        <button
                            onClick={() => setShowProjectDropdown(!showProjectDropdown)}
                            className="flex items-center justify-between gap-2.5 px-3.5 h-9 bg-[#1A1A1A] text-[#EEE] border border-[#333] hover:border-[#555] rounded-md transition-all group cursor-pointer min-w-[200px] max-w-[260px]"
                        >
                            <span className="text-[10px] font-semibold uppercase tracking-wide truncate select-none">
                                {projectTitle || "Untitled Project"}
                            </span>
                            <ChevronDown
                                size={13}
                                className={`text-[#666] group-hover:text-white transition-all duration-200 ${showProjectDropdown ? "rotate-180" : ""}`}
                            />
                        </button>

                        {showProjectDropdown && (
                            <div className="absolute top-full right-0 mt-1 w-full bg-[#1A1A1A] border border-[#333] rounded-md shadow-2xl shadow-black/80 z-[9999] overflow-hidden">
                                <div className="px-4 py-2 border-b border-[#222] flex items-center justify-between bg-[#111]">
                                    <span className="text-[9px] font-bold text-[#555] uppercase tracking-widest">Switch Project</span>
                                    <span className="text-[9px] font-mono text-[#333]">{projects.length}</span>
                                </div>
                                <div className="max-h-[280px] overflow-y-auto">
                                    {projects.map((p) => (
                                        <button
                                            key={p.id}
                                            onClick={() => handleProjectSwitch(p.id)}
                                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all cursor-pointer ${p.id === projectId
                                                ? "bg-red-900/10 border-l-2 border-l-red-500"
                                                : "hover:bg-[#222] border-l-2 border-l-transparent"
                                                }`}
                                        >
                                            <div className="flex-1 min-w-0">
                                                <div className="text-[10px] font-bold text-[#EEE] uppercase tracking-wide truncate">
                                                    {p.title}
                                                </div>
                                                <div className="text-[8px] font-mono text-[#555] uppercase mt-0.5">
                                                    {p.type === 'movie' ? 'Feature Film' : p.type === 'ad' ? 'Advertisement' : 'Series'}
                                                </div>
                                            </div>
                                            {p.id === projectId && (
                                                <Check size={13} className="text-red-500 shrink-0" />
                                            )}
                                        </button>
                                    ))}
                                    {projects.length === 0 && (
                                        <div className="px-4 py-5 text-center text-[9px] text-[#444] font-mono">
                                            No projects found
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* CTAs */}
                    <div className="h-7 w-[1px] bg-[#222]" />
                    <div className="flex items-center gap-2">
                        {/* Assets */}
                        {onOpenAssets && (
                            <button
                                id="tour-preprod-assets-btn"
                                onClick={onOpenAssets}
                                className="flex items-center gap-2 h-9 px-4 bg-[#1A1A1A] border border-[#333] hover:border-[#555] text-[11px] font-semibold text-[#EEE] hover:text-white uppercase tracking-wide transition-colors rounded-md cursor-pointer"
                            >
                                <Database size={13} /> Assets
                            </button>
                        )}

                        {/* Script */}
                        {onEditScript && (
                            <button
                                id="tour-preprod-script-btn"
                                onClick={onEditScript}
                                className="flex items-center gap-2 h-9 px-4 bg-[#1A1A1A] border border-[#333] hover:border-[#555] text-[11px] font-semibold text-[#EEE] hover:text-white uppercase tracking-wide transition-colors rounded-md cursor-pointer"
                            >
                                <FileText size={13} /> Script
                            </button>
                        )}

                        {/* Production Link */}
                        {hasScript && (
                            <Link
                                id="tour-preprod-production-btn"
                                href={productionUrl}
                                className="flex items-center gap-2 h-9 px-4 bg-[#1A1A1A] border border-[#333] hover:border-[#555] text-[11px] font-semibold text-[#EEE] hover:text-[#D4A843] uppercase tracking-wide transition-colors rounded-md no-underline cursor-pointer"
                                title="Go to Production"
                            >
                                <Play size={13} className="fill-current" /> Production
                            </Link>
                        )}
                    </div>
                    <div className="h-7 w-[1px] bg-[#222]" />

                    {/* CREDITS */}
                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <div className="flex items-center justify-end gap-1.5 mb-0.5">
                                <span className="block text-[8px] text-[#888] font-mono uppercase leading-none">Credits</span>
                                {credits !== null && <div className="w-1 h-1 rounded-full bg-green-500 animate-pulse" />}
                            </div>
                            <div className="text-[12px] text-white font-bold font-mono tracking-wider leading-none">
                                {credits !== null ? formatCredits(credits) : <span className="text-[#333] animate-pulse">---</span>}
                            </div>
                        </div>
                        <button onClick={() => setShowTopUp(true)} className="flex items-center gap-1.5 bg-red-900/10 border border-red-600/30 text-white px-3 py-1.5 text-[8px] font-bold uppercase cursor-pointer transition-all hover:bg-red-600 hover:border-red-600 rounded-md">
                            <Plus size={9} strokeWidth={4} /> Top Up
                        </button>
                    </div>
                </div>
            </header>
        </>
    );
};
