"use client";

import { useState, useEffect, useRef } from "react";
import { auth } from "@/lib/firebase";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Plus, User, Building, ChevronDown, Check, Zap } from "lucide-react";
import { useCredits } from "@/hooks/useCredits";
import { useWorkspace } from "@/app/context/WorkspaceContext";
import CreditModal from "@/app/components/modals/CreditModal";
import { invalidateDashboardCache } from "@/lib/api";

export default function GlobalHeader() {
    const pathname = usePathname();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { credits, plan, isEnterprise, creditsExpireAt, freeCreditsExpired } = useCredits();
    const { availableWorkspaces, activeWorkspaceSlug, setActiveWorkspace } = useWorkspace();
    const [showTopUp, setShowTopUp] = useState(false);
    const [showSwitcher, setShowSwitcher] = useState(false);
    const switcherRef = useRef<HTMLDivElement>(null);

    // Auto-open top-up modal when redirected from /pricing after successful subscription
    useEffect(() => {
        if (searchParams.get("openTopUp") === "true") {
            setShowTopUp(true);
            // Clean the param from the URL without a re-render loop
            router.replace(pathname);
        }
    }, [searchParams, pathname, router]);

    // Close switcher on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) {
                setShowSwitcher(false);
            }
        };
        if (showSwitcher) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [showSwitcher]);

    // Hide Header on "App Mode" Pages
    const isOnNewProject = pathname === '/project/new';
    const isEditorPage = pathname.includes('/project/') && !isOnNewProject && (
        pathname.includes('/script') ||
        pathname.includes('/studio') ||
        pathname.includes('/preproduction') ||
        pathname.includes('/storyboard') ||
        pathname.includes('/postprod') ||
        pathname.includes('/draft') ||
        pathname.includes('/assets') ||
        pathname.includes('/editor') ||
        pathname.includes('/moodboard') ||
        pathname.includes('/treatment') ||
        // Check if it's strictly /project/[id]
        pathname.match(/^\/project\/[a-zA-Z0-9_-]+$/) !== null
    );


    if (pathname === "/login" || pathname === "/" || pathname === "/pricing" || pathname === "/onboarding" || isEditorPage) {
        return null;
    }

    // Get display name for the active workspace
    const activeWorkspace = availableWorkspaces.find(w => w.slug === activeWorkspaceSlug);
    const workspaceDisplayName = activeWorkspace?.name || auth.currentUser?.displayName || "Personal Workspace";

    const handleWorkspaceSwitch = (slug: string | null) => {
        setActiveWorkspace(slug);
        setShowSwitcher(false);
        // Invalidate project cache so the dashboard reloads for the new context
        const uid = auth.currentUser?.uid;
        if (uid) invalidateDashboardCache(uid);
        // If on dashboard, force a refresh
        if (pathname === "/dashboard") {
            router.refresh();
        }
    };

    return (
        <>
            <CreditModal isOpen={showTopUp} onClose={() => setShowTopUp(false)} />
            <header className="flex justify-between items-center border-b border-white/[0.06] px-4 sm:px-6 lg:px-10 py-3 sm:py-4 bg-[#050505]/85 backdrop-blur-xl sticky top-0 z-50">

                {/* ── LEFT: LOGO + WORKSPACE SWITCHER ── */}
                <div className="flex items-center gap-3 sm:gap-4">
                    <Link href="/dashboard" className="no-underline shrink-0">
                        <h1 className="text-lg sm:text-2xl font-['Anton'] uppercase leading-none tracking-[0.5px] text-white">
                            Motion X <span className="text-[#E50914]">Studio</span>
                        </h1>
                        <p className="text-[8px] sm:text-[9px] text-[#999] tracking-[3px] font-bold mt-1 uppercase">Creative Studio</p>
                    </Link>

                    {/* ── WORKSPACE SWITCHER (only shown when user has orgs) ── */}
                    {availableWorkspaces.length > 0 && (
                    <div className="relative" ref={switcherRef}>
                        <button
                            onClick={() => setShowSwitcher(!showSwitcher)}
                            className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/15 transition-all cursor-pointer group"
                        >
                            <div className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold shrink-0 ${
                                activeWorkspaceSlug
                                    ? 'bg-[#E50914]/20 text-[#E50914] border border-[#E50914]/30'
                                    : 'bg-white/10 text-white/70'
                            }`}>
                                {activeWorkspaceSlug
                                    ? <Building size={11} />
                                    : <User size={11} />
                                }
                            </div>
                            <span className="hidden sm:block text-[11px] font-semibold text-white/80 max-w-[120px] truncate group-hover:text-white transition-colors">
                                {workspaceDisplayName}
                            </span>
                            <ChevronDown size={12} className={`text-white/40 transition-transform ${showSwitcher ? 'rotate-180' : ''}`} />
                        </button>

                        {/* ── DROPDOWN ── */}
                        {showSwitcher && (
                            <div className="absolute top-full left-0 mt-2 w-[260px] rounded-xl border border-white/[0.1] bg-[#0C0C0C]/95 backdrop-blur-2xl shadow-[0_16px_48px_rgba(0,0,0,0.6)] overflow-hidden z-[100]"
                                style={{ animation: 'fadeSlideIn 0.15s ease-out' }}
                            >
                                {/* Header */}
                                <div className="px-4 pt-3 pb-2">
                                    <p className="text-[9px] font-mono text-[#555] uppercase tracking-[2px]">Workspaces</p>
                                </div>

                                {/* Personal Workspace */}
                                <button
                                    onClick={() => handleWorkspaceSwitch(null)}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.05] transition-colors cursor-pointer border-none bg-transparent text-left"
                                >
                                    <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                                        <User size={13} className="text-white/70" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[12px] font-semibold text-white/90 truncate">{auth.currentUser?.displayName || 'Personal Workspace'}</p>
                                    </div>
                                    {!activeWorkspaceSlug && (
                                        <Check size={14} className="text-[#00FF41] shrink-0" />
                                    )}
                                </button>

                                {/* Divider + Org Workspaces */}
                                <div className="mx-4 border-t border-white/[0.06]" />
                                {availableWorkspaces.map((ws) => (
                                    <button
                                        key={ws.slug}
                                        onClick={() => handleWorkspaceSwitch(ws.slug)}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.05] transition-colors cursor-pointer border-none bg-transparent text-left"
                                    >
                                        <div className="w-7 h-7 rounded-lg bg-[#E50914]/10 border border-[#E50914]/20 flex items-center justify-center shrink-0 overflow-hidden">
                                            {ws.logo_url ? (
                                                <img src={ws.logo_url} alt="" className="w-full h-full object-cover rounded-lg" />
                                            ) : (
                                                <Building size={13} className="text-[#E50914]" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[12px] font-semibold text-white/90 truncate">{ws.name}</p>
                                            <p className="text-[9px] text-[#555] font-mono uppercase">{ws.slug}</p>
                                        </div>
                                        {activeWorkspaceSlug === ws.slug && (
                                            <Check size={14} className="text-[#00FF41] shrink-0" />
                                        )}
                                    </button>
                                ))}

                                {/* Footer hint */}
                                <div className="px-4 py-2.5 border-t border-white/[0.06]">
                                    <p className="text-[8px] text-[#444] font-mono uppercase tracking-[1px] text-center">
                                        {`${availableWorkspaces.length} org${availableWorkspaces.length > 1 ? 's' : ''} available`}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                    )}
                </div>

                {/* ── RIGHT CONTROLS ── */}
                <div className="flex items-center gap-2 sm:gap-3 lg:gap-4">

                    {/* Credits + Top Up */}
                    <div id="tour-credits-target" className={`flex items-center gap-2 sm:gap-3 lg:gap-4 mr-1 sm:mr-2 lg:mr-4 ${credits !== null && credits < 5 ? 'animate-pulse' : ''}`}>
                        <div className="text-right">
                            <span className="text-[7px] sm:text-[8px] text-[#999] font-mono uppercase block leading-none mb-0.5 flex items-center gap-1">
                                {isEnterprise && <Building size={8} className="text-[#E50914]" />}
                                {isEnterprise ? 'Org Credits' : 'Credits'}
                            </span>
                            <div className={`text-xs sm:text-[13px] font-bold font-mono tracking-[0.5px] ${credits !== null && credits < 5 ? 'text-[#E50914]' : 'text-white'}`}>{credits !== null ? credits : '---'}</div>
                            {/* Expiry countdown for free users */}
                            {plan === "free" && creditsExpireAt && !freeCreditsExpired && credits !== null && credits > 0 && (() => {
                                const now = new Date();
                                const diff = creditsExpireAt.getTime() - now.getTime();
                                const daysLeft = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
                                if (daysLeft <= 0) return null;
                                return (
                                    <span className={`text-[7px] font-mono uppercase block leading-none mt-0.5 ${daysLeft <= 3 ? 'text-[#E50914] animate-pulse' : 'text-[#666]'}`}>
                                        {daysLeft}d left
                                    </span>
                                );
                            })()}
                        </div>
                        <button
                            onClick={() => setShowTopUp(true)}
                            className="flex items-center gap-1 sm:gap-1.5 bg-[#E50914]/10 border border-[#E50914]/30 text-white px-2 sm:px-3 py-1.5 sm:py-[6px] text-[8px] sm:text-[9px] font-bold uppercase rounded-md cursor-pointer transition-all hover:bg-[#E50914]/25 hover:border-[#E50914] hover:shadow-[0_0_20px_rgba(229,9,20,0.2)]"
                        >
                            <Plus size={9} strokeWidth={4} />
                            <span className="hidden sm:inline">TOP UP</span>
                        </button>
                    </div>

                    {/* Playground — B2C workspace */}
                    <Link id="tour-playground" href="/playground" className="hidden md:block no-underline">
                        <button
                            className={`flex items-center gap-2 text-[10px] sm:text-xs font-bold tracking-[2px] uppercase transition-all rounded-md px-3 sm:px-4 lg:px-5 py-2 sm:py-2.5 cursor-pointer border ${
                                pathname === '/playground'
                                    ? 'bg-[#E50914]/15 border-[#E50914]/40 text-[#E50914] shadow-[0_0_20px_rgba(229,9,20,0.15)]'
                                    : 'bg-[#1A1A1A] border-[#222] text-white hover:bg-[#222]'
                            }`}
                        >
                            Playground
                        </button>
                    </Link>

                    {/* New Project — hidden on small mobile, disabled when on /project/new */}
                    <Link href="/project/new" className={`hidden md:block ${isOnNewProject ? 'pointer-events-none' : ''}`}>
                        <button
                            disabled={isOnNewProject}
                            className={`flex items-center gap-2 bg-[#1A1A1A] border border-[#222] text-[10px] sm:text-xs font-bold tracking-[2px] text-white px-3 sm:px-5 lg:px-6 py-2 sm:py-2.5 uppercase transition-colors rounded-md
                                ${isOnNewProject ? 'opacity-30 cursor-not-allowed' : 'hover:bg-[#222] cursor-pointer'}`}
                        >
                            <Plus className="w-3 h-3" strokeWidth={3} /> New Project
                        </button>
                    </Link>

                    {/* Operator / Profile */}
                    <Link href="/profile" className="no-underline">
                        <div className="flex items-center gap-2 sm:gap-3 border border-white/[0.08] px-2.5 sm:px-3 lg:px-4 py-1.5 sm:py-[7px] rounded-lg hover:border-white/15 hover:bg-white/[0.04] transition-all">
                            <div className="w-1.5 h-1.5 bg-[#00FF41] rounded-full shadow-[0_0_8px_rgba(0,255,65,0.4)]" />
                            <div className="text-left hidden sm:block">
                                <p className="text-[8px] font-mono text-white leading-none mb-0.5 uppercase">Operator</p>
                                <p className="text-[11px] font-bold text-white leading-none truncate max-w-[100px] lg:max-w-[140px]">{auth.currentUser?.displayName || 'OPERATOR_01'}</p>
                            </div>
                            <User size={14} className="text-white" />
                        </div>
                    </Link>
                </div>
            </header>

            <style jsx global>{`
                @keyframes fadeSlideIn {
                    from { opacity: 0; transform: translateY(-4px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </>
    );
}