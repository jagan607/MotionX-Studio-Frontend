"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Command, Plus, Globe, Zap, Rocket, ChevronLeft, ChevronRight, FolderOpen } from "@/lib/lucide";

export default function GlobalSidebar() {
    const pathname = usePathname();
    const PUBLIC_ROUTES = ["/", "/login", "/onboarding", "/pricing", "/showcase", "/explore"];
    const isPublicPage = pathname?.startsWith("/public") || pathname?.startsWith("/share/") || PUBLIC_ROUTES.includes(pathname || "");
    const [isCollapsed, setIsCollapsed] = useState(pathname !== "/dashboard");

    React.useEffect(() => {
        setIsCollapsed(pathname !== "/dashboard");
    }, [pathname]);

    if (isPublicPage) return null;

    return (
        <aside className={`${isCollapsed ? 'w-[70px]' : 'w-[220px] lg:w-[250px]'} shrink-0 border-r border-white/[0.08] bg-[#111111]/70 backdrop-blur-2xl flex flex-col z-[40] shadow-[4px_0_32px_rgba(0,0,0,0.5)] transition-all duration-300 relative group`}>
            {/* Collapse Toggle */}
            <button 
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="absolute -right-3 top-6 w-6 h-6 bg-[#1a1a1a] border border-white/10 hover:border-[#D40A12]/50 rounded-full flex items-center justify-center text-white/70 hover:text-[#D40A12] cursor-pointer z-50 transition-all opacity-0 group-hover:opacity-100 shadow-[0_0_10px_rgba(0,0,0,0.8)]"
            >
                {isCollapsed ? <ChevronRight size={12} strokeWidth={3} /> : <ChevronLeft size={12} strokeWidth={3} />}
            </button>

            <div className="p-4 space-y-2 mt-2">
                <Link href="/dashboard" className={`w-full text-left ${isCollapsed ? 'px-0 justify-center' : 'px-4'} py-2.5 text-[10px] font-bold tracking-[1.5px] uppercase rounded-lg transition-all flex items-center gap-3 no-underline ${pathname === '/dashboard' ? 'bg-[#D40A12]/15 text-[#D40A12] border border-[#D40A12]/30 shadow-[0_0_15px_rgba(212,10,18,0.2)]' : 'text-white/50 hover:bg-white/[0.05] hover:text-white border border-transparent'}`}>
                    <Command size={16} className={isCollapsed ? 'mx-auto' : ''} />
                    {!isCollapsed && <span>Dashboard</span>}
                </Link>
                <Link href="/library" className={`w-full text-left ${isCollapsed ? 'px-0 justify-center' : 'px-4'} py-2.5 text-[10px] font-bold tracking-[1.5px] uppercase rounded-lg transition-all flex items-center gap-3 no-underline mt-1 ${pathname === '/library' ? 'bg-[#D40A12]/15 text-[#D40A12] border border-[#D40A12]/30 shadow-[0_0_15px_rgba(212,10,18,0.2)]' : 'text-white/50 hover:bg-white/[0.05] hover:text-white border border-transparent'}`}>
                    <FolderOpen size={16} className={isCollapsed ? 'mx-auto' : ''} />
                    {!isCollapsed && <span>My Projects</span>}
                </Link>
                <Link href="/project/new" className={`w-full text-left ${isCollapsed ? 'px-0 justify-center' : 'px-4'} py-2.5 text-[10px] font-bold tracking-[1.5px] uppercase rounded-lg transition-all flex items-center gap-3 no-underline mt-1 ${pathname === '/project/new' ? 'bg-[#D40A12]/15 text-[#D40A12] border border-[#D40A12]/30 shadow-[0_0_15px_rgba(212,10,18,0.2)]' : 'text-white/50 hover:bg-white/[0.05] hover:text-white border border-transparent'}`}>
                    <Plus size={16} className={isCollapsed ? 'mx-auto' : ''} />
                    {!isCollapsed && <span>New Project</span>}
                </Link>
                <Link href="/explore" className={`w-full text-left ${isCollapsed ? 'px-0 justify-center' : 'px-4'} py-2.5 text-[10px] font-bold tracking-[1.5px] uppercase rounded-lg transition-all flex items-center gap-3 no-underline mt-1 ${pathname === '/explore' ? 'bg-[#D40A12]/15 text-[#D40A12] border border-[#D40A12]/30 shadow-[0_0_15px_rgba(212,10,18,0.2)]' : 'text-white/50 hover:bg-white/[0.05] hover:text-white border border-transparent'}`}>
                    <Globe size={16} className={isCollapsed ? 'mx-auto' : ''} />
                    {!isCollapsed && <span>Community</span>}
                </Link>
                <Link href="/playground" className={`w-full text-left ${isCollapsed ? 'px-0 justify-center' : 'px-4'} py-2.5 text-[10px] font-bold tracking-[1.5px] uppercase rounded-lg transition-all flex items-center gap-3 no-underline mt-1 ${pathname === '/playground' ? 'bg-[#D40A12]/15 text-[#D40A12] border border-[#D40A12]/30 shadow-[0_0_15px_rgba(212,10,18,0.2)]' : 'text-white/50 hover:bg-white/[0.05] hover:text-white border border-transparent'}`}>
                    <Zap size={16} className={isCollapsed ? 'mx-auto' : ''} />
                    {!isCollapsed && <span>Playground</span>}
                </Link>
            </div>
            
            {/* ═══ AI Director — subtle sidebar entry ═══ */}
            <div className={`mt-auto ${isCollapsed ? 'p-2' : 'p-4'} border-t border-white/[0.04]`}>
                <button
                    className={`w-full text-left ${isCollapsed ? 'px-0 justify-center' : 'px-4'} py-2.5 text-[10px] font-bold tracking-[1.5px] uppercase rounded-lg transition-all flex items-center gap-3 text-white/40 hover:bg-white/[0.05] hover:text-white/70 border border-transparent cursor-pointer bg-transparent`}
                    onClick={() => {
                        const btn = document.getElementById('voice-director-toggle');
                        if (btn) btn.click();
                    }}
                >
                    <Rocket size={16} className={`${isCollapsed ? 'mx-auto' : ''} text-[#D40A12]/70`} />
                    {!isCollapsed && <span>AI Director</span>}
                </button>
            </div>
        </aside>
    );
}
