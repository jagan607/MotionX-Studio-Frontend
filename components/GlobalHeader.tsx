"use client";

import { useState } from "react";
import { auth } from "@/lib/firebase";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Plus, User } from "lucide-react";
import { useCredits } from "@/hooks/useCredits";
import CreditModal from "@/app/components/modals/CreditModal";

export default function GlobalHeader() {
    const pathname = usePathname();
    const { credits } = useCredits();
    const [showTopUp, setShowTopUp] = useState(false);

    // Hide Header on "App Mode" Pages
    const isEditorPage = pathname.includes('/project/') && (
        pathname.includes('/script') ||
        pathname.includes('/studio') ||
        pathname.includes('/draft') ||
        pathname.includes('/assets') ||
        pathname.includes('/new') ||
        pathname.includes('/editor') ||
        pathname.includes('/moodboard') ||
        pathname.includes('/treatment')
    );

    if (pathname === "/login" || pathname === "/" || pathname === "/pricing" || isEditorPage) {
        return null;
    }

    return (
        <>
            <CreditModal isOpen={showTopUp} onClose={() => setShowTopUp(false)} />
            <header className="flex justify-between items-center border-b border-white/[0.06] px-4 sm:px-6 lg:px-10 py-3 sm:py-4 bg-[#050505]/85 backdrop-blur-xl sticky top-0 z-50">

                {/* ── LOGO ── */}
                <Link href="/dashboard" className="no-underline shrink-0">
                    <h1 className="text-lg sm:text-2xl font-['Anton'] uppercase leading-none tracking-[0.5px] text-white">
                        Motion X <span className="text-[#E50914]">Studio</span>
                    </h1>
                    <p className="text-[8px] sm:text-[9px] text-[#999] tracking-[3px] font-bold mt-1 uppercase">Creative Studio</p>
                </Link>

                {/* ── RIGHT CONTROLS ── */}
                <div className="flex items-center gap-2 sm:gap-3 lg:gap-4">

                    {/* Credits + Top Up */}
                    <div id="tour-credits-target" className="flex items-center gap-2 sm:gap-3 lg:gap-4 mr-1 sm:mr-2 lg:mr-4">
                        <div className="text-right">
                            <span className="text-[7px] sm:text-[8px] text-[#999] font-mono uppercase block leading-none mb-0.5">Credits</span>
                            <div className="text-xs sm:text-[13px] text-white font-bold font-mono tracking-[0.5px]">{credits !== null ? credits : '---'}</div>
                        </div>
                        <button
                            onClick={() => setShowTopUp(true)}
                            className="flex items-center gap-1 sm:gap-1.5 bg-[#E50914]/10 border border-[#E50914]/30 text-white px-2 sm:px-3 py-1.5 sm:py-[6px] text-[8px] sm:text-[9px] font-bold uppercase rounded-md cursor-pointer transition-all hover:bg-[#E50914]/25 hover:border-[#E50914] hover:shadow-[0_0_20px_rgba(229,9,20,0.2)]"
                        >
                            <Plus size={9} strokeWidth={4} />
                            <span className="hidden sm:inline">TOP UP</span>
                        </button>
                    </div>

                    {/* New Project — hidden on small mobile */}
                    <Link href="/project/new" className="hidden md:block">
                        <button className="flex items-center gap-2 bg-[#1A1A1A] border border-[#222] text-[10px] sm:text-xs font-bold tracking-[2px] text-white px-3 sm:px-5 lg:px-6 py-2 sm:py-2.5 uppercase hover:bg-[#222] transition-colors rounded-md cursor-pointer">
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
        </>
    );
}