"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { DashboardProject } from "@/lib/api";
import {
    Search, Plus, Compass, Zap, CreditCard, User,
    Film, ArrowRight, Command, CornerDownLeft
} from "lucide-react";

interface Props {
    projects: DashboardProject[];
    open: boolean;
    onClose: () => void;
}

interface Action {
    id: string;
    icon: React.ReactNode;
    label: string;
    sublabel?: string;
    href?: string;
    type: "project" | "action";
}

const fuzzyMatch = (query: string, target: string): boolean => {
    const q = query.toLowerCase();
    const t = target.toLowerCase();
    if (t.includes(q)) return true;
    let qi = 0;
    for (let i = 0; i < t.length && qi < q.length; i++) {
        if (t[i] === q[qi]) qi++;
    }
    return qi === q.length;
};

const QUICK_ACTIONS: Action[] = [
    { id: "new", icon: <Plus size={14} />, label: "Create New Project", href: "/project/new", type: "action" },
    { id: "playground", icon: <Zap size={14} />, label: "Open Playground", sublabel: "Quick single-shot generation", href: "/playground", type: "action" },
    { id: "explore", icon: <Compass size={14} />, label: "Explore Community", sublabel: "Browse AI creations", href: "/explore", type: "action" },
    { id: "credits", icon: <CreditCard size={14} />, label: "Top Up Credits", href: "/pricing", type: "action" },
    { id: "profile", icon: <User size={14} />, label: "My Profile", href: "/profile", type: "action" },
];

export default function CommandPalette({ projects, open, onClose }: Props) {
    const router = useRouter();
    const [query, setQuery] = useState("");
    const [activeIdx, setActiveIdx] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (open) {
            setQuery("");
            setActiveIdx(0);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [open]);

    const projectActions: Action[] = projects.map(p => ({
        id: p.id,
        icon: <Film size={14} />,
        label: p.title,
        sublabel: p.type === "movie" ? "Film" : p.type === "ad" ? "Ad" : "Series",
        href: `/project/${p.id}`,
        type: "project",
    }));

    const allActions = [...QUICK_ACTIONS, ...projectActions];
    const filtered = query.trim()
        ? allActions.filter(a => fuzzyMatch(query, a.label) || (a.sublabel && fuzzyMatch(query, a.sublabel)))
        : allActions;

    const handleSelect = useCallback((action: Action) => {
        if (action.href) router.push(action.href);
        onClose();
    }, [router, onClose]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx(p => Math.min(p + 1, filtered.length - 1)); }
        if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx(p => Math.max(p - 1, 0)); }
        if (e.key === "Enter" && filtered[activeIdx]) { e.preventDefault(); handleSelect(filtered[activeIdx]); }
        if (e.key === "Escape") onClose();
    }, [filtered, activeIdx, handleSelect, onClose]);

    useEffect(() => { setActiveIdx(0); }, [query]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[70] flex items-start justify-center pt-[15vh]" onClick={onClose}
            style={{ backgroundColor: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)", animation: "fadeIn 0.15s ease" }}>
            <div className="w-full max-w-lg mx-4 rounded-2xl overflow-hidden border border-white/[0.08] bg-[#0c0c0c]/95 shadow-[0_40px_120px_rgba(0,0,0,0.8)]"
                onClick={e => e.stopPropagation()}
                style={{ animation: "slideUp 0.25s cubic-bezier(0.16,1,0.3,1)" }}>

                {/* Search input */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06]">
                    <Search size={16} className="text-white/20 shrink-0" />
                    <input
                        ref={inputRef}
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Search projects or jump to..."
                        className="flex-1 bg-transparent text-[14px] text-white placeholder-white/20 focus:outline-none caret-[#E50914]"
                    />
                    <kbd className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white/[0.05] border border-white/[0.08] text-[9px] font-mono text-white/20">
                        ESC
                    </kbd>
                </div>

                {/* Results */}
                <div className="max-h-[50vh] overflow-y-auto no-scrollbar py-2">
                    {filtered.length === 0 ? (
                        <div className="px-5 py-8 text-center">
                            <p className="text-[12px] text-white/15">No results for &ldquo;{query}&rdquo;</p>
                        </div>
                    ) : (
                        <>
                            {/* Quick actions */}
                            {filtered.some(a => a.type === "action") && (
                                <div className="px-3 pt-1 pb-1">
                                    <span className="text-[8px] font-bold uppercase tracking-[2px] text-white/15 px-2">Actions</span>
                                </div>
                            )}
                            {filtered.filter(a => a.type === "action").map((action, i) => {
                                const globalIdx = filtered.indexOf(action);
                                return (
                                    <button key={action.id} onClick={() => handleSelect(action)}
                                        onMouseEnter={() => setActiveIdx(globalIdx)}
                                        className={`w-full flex items-center gap-3 px-5 py-2.5 text-left transition-colors cursor-pointer border-none ${
                                            activeIdx === globalIdx ? "bg-white/[0.06]" : "bg-transparent hover:bg-white/[0.03]"
                                        }`}>
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                            activeIdx === globalIdx ? "bg-[#E50914]/15 text-[#E50914]" : "bg-white/[0.04] text-white/30"
                                        } transition-colors`}>
                                            {action.icon}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <span className={`text-[12px] font-medium block ${activeIdx === globalIdx ? "text-white" : "text-white/60"}`}>{action.label}</span>
                                            {action.sublabel && <span className="text-[10px] text-white/20 block">{action.sublabel}</span>}
                                        </div>
                                        {activeIdx === globalIdx && <CornerDownLeft size={12} className="text-white/20 shrink-0" />}
                                    </button>
                                );
                            })}

                            {/* Projects */}
                            {filtered.some(a => a.type === "project") && (
                                <div className="px-3 pt-3 pb-1">
                                    <span className="text-[8px] font-bold uppercase tracking-[2px] text-white/15 px-2">Projects</span>
                                </div>
                            )}
                            {filtered.filter(a => a.type === "project").map(action => {
                                const globalIdx = filtered.indexOf(action);
                                return (
                                    <button key={action.id} onClick={() => handleSelect(action)}
                                        onMouseEnter={() => setActiveIdx(globalIdx)}
                                        className={`w-full flex items-center gap-3 px-5 py-2.5 text-left transition-colors cursor-pointer border-none ${
                                            activeIdx === globalIdx ? "bg-white/[0.06]" : "bg-transparent hover:bg-white/[0.03]"
                                        }`}>
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                            activeIdx === globalIdx ? "bg-[#E50914]/15 text-[#E50914]" : "bg-white/[0.04] text-white/30"
                                        } transition-colors`}>
                                            {action.icon}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <span className={`text-[12px] font-medium block truncate ${activeIdx === globalIdx ? "text-white" : "text-white/60"}`}>{action.label}</span>
                                            {action.sublabel && <span className="text-[10px] text-white/20">{action.sublabel}</span>}
                                        </div>
                                        <ArrowRight size={12} className={`shrink-0 ${activeIdx === globalIdx ? "text-white/30" : "text-transparent"}`} />
                                    </button>
                                );
                            })}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-5 py-3 border-t border-white/[0.04] bg-white/[0.01]">
                    <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1 text-[8px] font-mono text-white/15">
                            <kbd className="px-1 py-0.5 rounded bg-white/[0.05] border border-white/[0.08]">↑↓</kbd> Navigate
                        </span>
                        <span className="flex items-center gap-1 text-[8px] font-mono text-white/15">
                            <kbd className="px-1 py-0.5 rounded bg-white/[0.05] border border-white/[0.08]">↵</kbd> Select
                        </span>
                    </div>
                    <span className="flex items-center gap-1 text-[8px] font-mono text-white/15">
                        <Command size={8} />K to toggle
                    </span>
                </div>
            </div>
        </div>
    );
}
