"use client";

import React, { useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import {
    Sparkles, Send, X, Zap, Clock, Gauge,
    Volume2, Palette, Scissors, Loader2
} from "lucide-react";
import { toast } from "react-hot-toast";
import { aiEditTimeline } from "@/lib/api";
import { TimelineState } from "@/lib/types/postprod";

// ═══════════════════════════════════════════════════════════
//   AI DIRECTOR PANEL (v2)
//   Calls real backend /ai_edit → applies EDL changes
// ═══════════════════════════════════════════════════════════

interface AIDirectorPanelProps {
    timeline: TimelineState;
    projectId: string;
    episodeId: string;
    onTimelineUpdate: (newState: TimelineState | ((prev: TimelineState | null) => TimelineState | null)) => void;
    onClose: () => void;
}

const QUICK_COMMANDS = [
    { icon: <Zap size={11} />, label: "Make it faster", prompt: "Make this sequence faster and more engaging" },
    { icon: <Clock size={11} />, label: "Cinematic pacing", prompt: "Add cinematic pacing with impactful cuts" },
    { icon: <Scissors size={11} />, label: "Remove pauses", prompt: "Remove awkward pauses and tighten the edit" },
    { icon: <Gauge size={11} />, label: "More intense", prompt: "Make the sequence more intense and dramatic" },
    { icon: <Palette size={11} />, label: "Nolan grade", prompt: "Apply Christopher Nolan-style color grading" },
    { icon: <Volume2 size={11} />, label: "Add tension audio", prompt: "Add tension-building background music" },
];

interface HistoryEntry {
    id: string;
    prompt: string;
    timestamp: Date;
    status: "success" | "processing" | "failed";
    changes: string;
}

export default function AIDirectorPanel({
    timeline,
    projectId,
    episodeId,
    onTimelineUpdate,
    onClose,
}: AIDirectorPanelProps) {
    const [prompt, setPrompt] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [scope, setScope] = useState<"clip" | "scene" | "global">("global");
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const handleSubmit = useCallback(async () => {
        if (!prompt.trim() || isProcessing) return;

        const entry: HistoryEntry = {
            id: `ai-${Date.now()}`,
            prompt: prompt.trim(),
            timestamp: new Date(),
            status: "processing",
            changes: "",
        };

        setHistory((prev) => [entry, ...prev]);
        setIsProcessing(true);
        const currentPrompt = prompt.trim();
        setPrompt("");

        try {
            // Call the real backend AI edit endpoint
            const result = await aiEditTimeline(
                projectId,
                episodeId,
                currentPrompt,
                scope,
                timeline.selectedClipIds
            );

            // Apply changes from the backend response
            const lower = currentPrompt.toLowerCase();

            if (result.changes?.some((c: any) => c.type === "pacing")) {
                const isFaster = lower.includes("faster") || lower.includes("intense") || lower.includes("engaging");
                const factor = isFaster ? 0.75 : 1.25;

                onTimelineUpdate((prev) => {
                    if (!prev) return prev;
                    const tracks = prev.tracks.map((track) => ({
                        ...track,
                        clips: track.clips.map((c) => ({
                            ...c,
                            duration: c.duration * factor,
                        })),
                    }));

                    // Recompute start times
                    tracks.forEach((t) => {
                        let currentTime = 0;
                        t.clips.forEach((c) => {
                            c.startTime = currentTime;
                            currentTime += c.duration;
                        });
                    });

                    const totalDuration = Math.max(
                        ...tracks.map((t) =>
                            t.clips.reduce((sum, c) => sum + c.duration, 0)
                        ),
                        5
                    );

                    return { ...prev, tracks, duration: totalDuration };
                });
            }

            const changeDesc = result.changes?.map((c: any) => c.description).join("; ") || "Changes applied.";

            setHistory((prev) =>
                prev.map((h) =>
                    h.id === entry.id
                        ? { ...h, status: "success", changes: changeDesc }
                        : h
                )
            );
            toast.success("AI Director applied changes");
        } catch (e) {
            console.error("AI Director error:", e);
            setHistory((prev) =>
                prev.map((h) =>
                    h.id === entry.id
                        ? { ...h, status: "failed", changes: "Failed to process." }
                        : h
                )
            );
            toast.error("AI Director failed");
        } finally {
            setIsProcessing(false);
        }
    }, [prompt, isProcessing, onTimelineUpdate, projectId, episodeId, scope, timeline.selectedClipIds]);

    return (
        <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: "100%", opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="h-full border-l border-[#1a1a1a] bg-[#080808] flex flex-col overflow-hidden shrink-0"
        >
            {/* Header */}
            <div className="px-4 py-3 border-b border-[#1a1a1a] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded bg-[#E50914]/20 flex items-center justify-center">
                        <Sparkles size={11} className="text-[#E50914]" />
                    </div>
                    <span className="text-[10px] font-bold tracking-[2px] text-white uppercase">AI Director</span>
                </div>
                <button onClick={onClose} className="p-1 rounded hover:bg-[#1a1a1a] text-neutral-500 transition-colors">
                    <X size={13} />
                </button>
            </div>

            {/* Scope Selector */}
            <div className="px-4 py-2 border-b border-[#141414] flex items-center gap-1">
                {(["clip", "scene", "global"] as const).map((s) => (
                    <button
                        key={s}
                        onClick={() => setScope(s)}
                        className={`flex-1 py-1 rounded text-[8px] font-bold tracking-[2px] uppercase transition-all ${
                            scope === s
                                ? "bg-[#E50914]/20 text-[#E50914]"
                                : "text-neutral-600 hover:text-neutral-400"
                        }`}
                    >
                        {s}
                    </button>
                ))}
            </div>

            {/* Quick Commands */}
            <div className="px-4 py-3 border-b border-[#141414] shrink-0">
                <span className="text-[8px] text-neutral-600 tracking-[2px] uppercase block mb-2">Quick Actions</span>
                <div className="grid grid-cols-2 gap-1.5">
                    {QUICK_COMMANDS.map((cmd) => (
                        <button
                            key={cmd.label}
                            onClick={() => {
                                setPrompt(cmd.prompt);
                                inputRef.current?.focus();
                            }}
                            className="flex items-center gap-1.5 px-2 py-1.5 rounded bg-[#111] border border-[#1a1a1a] hover:border-[#333] text-[8px] text-neutral-400 hover:text-white tracking-wider transition-all"
                        >
                            {cmd.icon}
                            <span className="truncate">{cmd.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* History */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                {history.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-neutral-700">
                        <Sparkles size={24} className="mb-2 opacity-30" />
                        <span className="text-[9px] tracking-[2px] uppercase">
                            Tell the AI how to edit
                        </span>
                    </div>
                )}

                {history.map((entry) => (
                    <div
                        key={entry.id}
                        className={`p-2.5 rounded border ${
                            entry.status === "success"
                                ? "border-emerald-900/30 bg-emerald-900/5"
                                : entry.status === "processing"
                                ? "border-[#E50914]/20 bg-[#E50914]/5"
                                : "border-red-900/30 bg-red-900/5"
                        }`}
                    >
                        <div className="flex items-start gap-2">
                            {entry.status === "processing" ? (
                                <Loader2 size={10} className="animate-spin text-[#E50914] mt-0.5 shrink-0" />
                            ) : entry.status === "success" ? (
                                <Sparkles size={10} className="text-emerald-500 mt-0.5 shrink-0" />
                            ) : (
                                <X size={10} className="text-red-500 mt-0.5 shrink-0" />
                            )}
                            <div>
                                <p className="text-[9px] text-white/80">{entry.prompt}</p>
                                {entry.changes && (
                                    <p className="text-[8px] text-neutral-500 mt-1 leading-relaxed">
                                        {entry.changes}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Input */}
            <div className="px-3 pb-3 pt-1 border-t border-[#1a1a1a] shrink-0">
                <div className="relative">
                    <textarea
                        ref={inputRef}
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleSubmit();
                            }
                        }}
                        placeholder="e.g. 'Make this more cinematic'..."
                        className="w-full bg-[#111] border border-[#222] rounded-lg px-3 py-2.5 pr-10 text-[10px] text-white placeholder:text-neutral-600 resize-none focus:outline-none focus:border-[#E50914]/50 transition-colors"
                        rows={2}
                        disabled={isProcessing}
                    />
                    <button
                        onClick={handleSubmit}
                        disabled={!prompt.trim() || isProcessing}
                        className="absolute right-2 bottom-2 p-1.5 rounded bg-[#E50914] text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#ff1a25] transition-all"
                    >
                        {isProcessing ? (
                            <Loader2 size={11} className="animate-spin" />
                        ) : (
                            <Send size={11} />
                        )}
                    </button>
                </div>
            </div>
        </motion.div>
    );
}
