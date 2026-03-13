"use client";

import React, { useRef, useState } from "react";
import { Globe, Loader2, Plus, Search, AlertCircle, Upload, FileText, X } from "lucide-react";

interface WorldsEmptyStateProps {
    isDetecting: boolean;
    progress: string;
    error: string | null;
    onDetect: () => void;
    onDetectWithFile: (file: File) => void;
    onDetectWithText: (text: string) => void;
    onCreateManual: () => void;
}

export const WorldsEmptyState: React.FC<WorldsEmptyStateProps> = ({
    isDetecting,
    progress,
    error,
    onDetect,
    onDetectWithFile,
    onDetectWithText,
    onCreateManual,
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [showPasteModal, setShowPasteModal] = useState(false);
    const [pastedText, setPastedText] = useState("");

    // --- DETECTING STATE ---
    if (isDetecting) {
        return (
            <div className="col-span-full flex flex-col items-center justify-center py-24">
                <div className="relative mb-6">
                    <div className="w-16 h-16 rounded-full bg-[#E50914]/10 border border-[#E50914]/20 flex items-center justify-center">
                        <Loader2 size={28} className="text-[#E50914] animate-spin" />
                    </div>
                    <div className="absolute -inset-3 rounded-full border border-[#E50914]/10 animate-pulse" />
                </div>
                <p className="text-sm text-white font-medium mb-1">Analyzing Script</p>
                <p className="text-[10px] text-neutral-500 tracking-wider uppercase font-mono">
                    {progress || "Processing..."}
                </p>
            </div>
        );
    }

    // --- ERROR STATE ---
    if (error) {
        return (
            <div className="col-span-full flex flex-col items-center justify-center py-20">
                <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
                    <AlertCircle size={24} className="text-red-400" />
                </div>
                <p className="text-sm text-red-400 font-medium mb-2">Detection Failed</p>
                <p className="text-[10px] text-neutral-500 max-w-sm text-center mb-6">{error}</p>
                <button
                    onClick={onDetect}
                    className="px-4 py-2 bg-white/[0.04] border border-white/[0.08] hover:border-[#E50914]/50 hover:bg-[#E50914]/10 text-neutral-400 hover:text-white text-[10px] font-bold tracking-widest uppercase transition-all rounded cursor-pointer"
                >
                    Try Again
                </button>
            </div>
        );
    }

    // --- EMPTY STATE ---
    return (
        <div className="col-span-full flex flex-col items-center justify-center py-20">
            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.pdf,.fountain,.fdx"
                className="hidden"
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onDetectWithFile(file);
                    e.target.value = "";
                }}
            />

            <div className="w-16 h-16 rounded-full bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-5">
                <Globe size={28} className="text-neutral-600" />
            </div>

            <h3 className="text-sm font-bold text-neutral-400 mb-1.5 uppercase tracking-wider">
                No Worlds Detected
            </h3>
            <p className="text-[10px] text-neutral-600 max-w-xs text-center mb-8 leading-relaxed">
                Worlds are higher-level environments that contain multiple locations.
                Analyze your script to automatically detect distinct worlds.
            </p>

            <div className="flex flex-col items-center gap-3">
                {/* Primary CTA */}
                <button
                    onClick={onDetect}
                    className="flex items-center gap-2.5 px-6 py-3 bg-[#E50914] hover:bg-[#ff1a25] text-white text-[10px] font-bold tracking-[0.2em] uppercase rounded transition-all shadow-lg shadow-[#E50914]/20 hover:shadow-[#E50914]/40 cursor-pointer"
                >
                    <Search size={13} /> Detect Worlds
                </button>

                {/* Divider */}
                <div className="flex items-center gap-3 my-1">
                    <div className="w-12 h-px bg-white/[0.06]" />
                    <span className="text-[8px] text-neutral-700 uppercase tracking-widest">or</span>
                    <div className="w-12 h-px bg-white/[0.06]" />
                </div>

                {/* Secondary CTAs row */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 px-4 py-2 bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.15] text-neutral-500 hover:text-neutral-300 text-[9px] font-bold tracking-widest uppercase transition-all rounded cursor-pointer"
                    >
                        <Upload size={11} /> Upload Script
                    </button>

                    <button
                        onClick={() => setShowPasteModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.15] text-neutral-500 hover:text-neutral-300 text-[9px] font-bold tracking-widest uppercase transition-all rounded cursor-pointer"
                    >
                        <FileText size={11} /> Paste Script
                    </button>

                    <button
                        onClick={onCreateManual}
                        className="flex items-center gap-2 px-4 py-2 bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.15] text-neutral-500 hover:text-neutral-300 text-[9px] font-bold tracking-widest uppercase transition-all rounded cursor-pointer"
                    >
                        <Plus size={11} /> Create Manually
                    </button>
                </div>
            </div>

            {/* PASTE SCRIPT MODAL */}
            {showPasteModal && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-sm">
                    <div className="w-[560px] max-h-[70vh] flex flex-col bg-[#0A0A0A] border border-white/[0.08] rounded-xl shadow-2xl">
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06]">
                            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Paste Script Text</h3>
                            <button
                                onClick={() => { setShowPasteModal(false); setPastedText(""); }}
                                className="w-7 h-7 flex items-center justify-center hover:bg-white/[0.06] text-neutral-500 hover:text-white rounded-full transition-colors cursor-pointer"
                            >
                                <X size={14} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-5 flex-1">
                            <textarea
                                value={pastedText}
                                onChange={(e) => setPastedText(e.target.value)}
                                placeholder="Paste your screenplay or script text here..."
                                className="w-full h-48 bg-white/[0.03] border border-white/[0.08] rounded-lg px-4 py-3 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-white/20 transition-colors resize-none font-mono leading-relaxed"
                                autoFocus
                            />
                            <p className="text-[9px] text-neutral-600 mt-2">
                                {pastedText.length > 0 ? `${pastedText.length.toLocaleString()} characters` : "Minimum ~500 characters recommended"}
                            </p>
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-white/[0.06]">
                            <button
                                onClick={() => { setShowPasteModal(false); setPastedText(""); }}
                                className="px-4 py-2 text-[9px] font-bold text-neutral-500 hover:text-white uppercase tracking-widest transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    if (pastedText.trim().length > 0) {
                                        onDetectWithText(pastedText.trim());
                                        setShowPasteModal(false);
                                        setPastedText("");
                                    }
                                }}
                                disabled={pastedText.trim().length === 0}
                                className="flex items-center gap-2 px-5 py-2 bg-[#E50914] hover:bg-[#ff1a25] text-white text-[9px] font-bold tracking-widest uppercase rounded transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                            >
                                <Search size={10} /> Detect Worlds
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
