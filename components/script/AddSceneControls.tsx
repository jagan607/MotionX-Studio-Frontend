"use client";

import React from "react";
import { Plus, Wand2, Loader2, ChevronRight, FilePlus2 } from "lucide-react";

interface AddSceneControlsProps {
    onManualAdd: () => void;
    onAutoExtend: () => void;
    isExtending: boolean;
    disabled?: boolean;
    className?: string;
}

export const AddSceneControls: React.FC<AddSceneControlsProps> = ({
    onManualAdd,
    onAutoExtend,
    isExtending,
    disabled = false,
    className = ""
}) => {
    return (
        <div className={`w-full py-8 border-t border-dashed border-neutral-800 flex flex-col items-center justify-center gap-4 ${className}`}>

            <div className="flex items-center gap-4 w-full max-w-2xl">

                {/* 1. MANUAL ADD BUTTON */}
                <button
                    onClick={onManualAdd}
                    disabled={disabled || isExtending}
                    className="group flex-1 h-14 bg-neutral-900/50 border border-neutral-800 hover:border-neutral-600 rounded-lg flex items-center justify-center gap-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <div className="w-8 h-8 rounded bg-neutral-800 flex items-center justify-center group-hover:bg-neutral-700 transition-colors">
                        <Plus size={16} className="text-white" />
                    </div>
                    <div className="text-left">
                        <div className="text-[11px] font-bold text-white tracking-widest uppercase">Manual Add</div>
                        <div className="text-[9px] text-neutral-500 font-mono">Create empty slugline</div>
                    </div>
                </button>

                {/* VISUAL DIVIDER */}
                <div className="h-px w-8 bg-neutral-800 hidden sm:block" />
                <span className="text-[9px] font-bold text-neutral-600 uppercase tracking-widest hidden sm:block">OR</span>
                <div className="h-px w-8 bg-neutral-800 hidden sm:block" />

                {/* 2. AUTO-EXTEND BUTTON (AI) */}
                <button
                    onClick={onAutoExtend}
                    disabled={disabled || isExtending}
                    className={`group flex-[1.5] h-14 relative overflow-hidden rounded-lg border flex items-center justify-center gap-4 transition-all disabled:opacity-50 disabled:cursor-not-allowed
                    ${isExtending
                            ? 'bg-red-900/10 border-red-900/30 cursor-wait'
                            : 'bg-gradient-to-r from-red-900/10 to-transparent border-red-900/30 hover:border-red-500/50 hover:bg-red-900/20'
                        }`}
                >
                    {/* Background Shine Effect */}
                    {!isExtending && (
                        <div className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/5 to-transparent skew-x-12 pointer-events-none" />
                    )}

                    {isExtending ? (
                        <>
                            <Loader2 size={18} className="text-red-500 animate-spin" />
                            <div className="text-left">
                                <div className="text-[11px] font-bold text-red-400 tracking-widest uppercase animate-pulse">
                                    Dreaming Sequence...
                                </div>
                                <div className="text-[9px] text-red-500/60 font-mono">
                                    Analyzing context vectors
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="w-8 h-8 rounded bg-red-900/30 border border-red-500/20 flex items-center justify-center group-hover:scale-110 transition-transform shadow-[0_0_15px_rgba(220,38,38,0.2)]">
                                <Wand2 size={16} className="text-red-400" />
                            </div>
                            <div className="text-left">
                                <div className="text-[11px] font-bold text-white tracking-widest uppercase group-hover:text-red-400 transition-colors">
                                    Auto-Extend Story
                                </div>
                                <div className="text-[9px] text-neutral-500 font-mono group-hover:text-neutral-400">
                                    Generate next scene from context
                                </div>
                            </div>
                            <ChevronRight size={14} className="text-neutral-600 group-hover:text-red-500 group-hover:translate-x-1 transition-all ml-2" />
                        </>
                    )}
                </button>
            </div>

            {/* Helper Text */}
            {!disabled && (
                <div className="text-[9px] text-neutral-600 font-mono flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-green-500/50"></span>
                    AI Context Window Active: Ready to read previous scene
                </div>
            )}
        </div>
    );
};