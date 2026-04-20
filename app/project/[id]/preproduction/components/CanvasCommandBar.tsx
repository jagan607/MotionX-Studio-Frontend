"use client";

import React from "react";
import { Plus, Wand2, RefreshCw, Loader2 } from "lucide-react";

interface CanvasCommandBarProps {
    onAddScene: () => void;
    onAutoExtend: () => void;
    onRegenerate: () => void;
    isExtending?: boolean;
    isRegenerating?: boolean;
    disabled?: boolean;
}

export function CanvasCommandBar({
    onAddScene,
    onAutoExtend,
    onRegenerate,
    isExtending = false,
    isRegenerating = false,
    disabled = false,
}: CanvasCommandBarProps) {
    const busy = isExtending || isRegenerating;

    return (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[15] flex items-center gap-1.5 bg-[#0C0C0C]/90 backdrop-blur-xl border border-white/[0.06] rounded-2xl px-2.5 py-1.5 shadow-2xl"
            style={{ animation: "nodeEntrance 0.4s cubic-bezier(0.23, 1, 0.32, 1) both" }}
        >
            {/* ADD SCENE */}
            <button
                onClick={onAddScene}
                disabled={disabled || busy}
                title="Add a new empty scene"
                className="group relative flex items-center gap-2 h-8 px-3.5 rounded-xl text-white/50 hover:text-white hover:bg-white/[0.08] transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
                <Plus size={14} strokeWidth={2.5} />
                <span className="text-[9px] font-bold tracking-[2px] uppercase">Add Scene</span>
                {/* Accent dot */}
                <div className="absolute top-1 right-1 w-1 h-1 rounded-full bg-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>

            {/* Divider */}
            <div className="h-5 w-px bg-white/[0.06]" />

            {/* AUTO-EXTEND */}
            <button
                onClick={onAutoExtend}
                disabled={disabled || busy}
                title="AI-generate the next scene based on narrative flow"
                className="group relative flex items-center gap-2 h-8 px-3.5 rounded-xl text-white/50 hover:text-[#D4A843] hover:bg-[#D4A843]/[0.06] transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
                {isExtending ? (
                    <Loader2 size={14} className="animate-spin text-[#D4A843]" />
                ) : (
                    <Wand2 size={14} />
                )}
                <span className="text-[9px] font-bold tracking-[2px] uppercase">
                    {isExtending ? "Extending…" : "Auto-Extend"}
                </span>
                <div className="absolute top-1 right-1 w-1 h-1 rounded-full bg-[#D4A843] opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>

            {/* Divider */}
            <div className="h-5 w-px bg-white/[0.06]" />

            {/* REGENERATE */}
            <button
                onClick={onRegenerate}
                disabled={disabled || busy}
                title="Re-parse the script and regenerate all scenes"
                className="group relative flex items-center gap-2 h-8 px-3.5 rounded-xl text-white/50 hover:text-amber-400 hover:bg-amber-500/[0.06] transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
                {isRegenerating ? (
                    <Loader2 size={14} className="animate-spin text-amber-400" />
                ) : (
                    <RefreshCw size={14} />
                )}
                <span className="text-[9px] font-bold tracking-[2px] uppercase">
                    {isRegenerating ? "Regenerating…" : "Regenerate"}
                </span>
                <div className="absolute top-1 right-1 w-1 h-1 rounded-full bg-amber-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
        </div>
    );
}
