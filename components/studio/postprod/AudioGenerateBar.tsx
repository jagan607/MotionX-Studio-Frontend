"use client";

import React, { useState, useRef } from "react";
import { Waves, Music, Loader2, Sparkles, X } from "lucide-react";
import { generateSfx, generateBgm } from "@/lib/api";

// ═══════════════════════════════════════════════════════════
//   AUDIO GENERATE BAR — Sleek inline prompt bar
// ═══════════════════════════════════════════════════════════

interface AudioGenerateBarProps {
    type: "sfx" | "bgm";
    projectId: string;
    onGenerated: (audioUrl: string, prompt: string, duration: number) => void;
    onClose: () => void;
}

const SFX_PRESETS = [
    { label: "Footsteps", prompt: "Footsteps on gravel path" },
    { label: "Glass", prompt: "Glass shattering on floor" },
    { label: "Thunder", prompt: "Distant thunder rumble" },
    { label: "Whoosh", prompt: "Fast cinematic whoosh" },
    { label: "Impact", prompt: "Heavy impact hit" },
    { label: "Rain", prompt: "Rain on window" },
    { label: "Fire", prompt: "Crackling fire close up" },
    { label: "Door", prompt: "Metal door slam echo" },
    { label: "Wind", prompt: "Strong howling wind" },
    { label: "Explosion", prompt: "Distant explosion rumble" },
];

const BGM_PRESETS = [
    { label: "Tension", prompt: "Cinematic tension building orchestral" },
    { label: "Action", prompt: "Fast paced action thriller drums" },
    { label: "Emotional", prompt: "Emotional piano with soft strings" },
    { label: "Dark", prompt: "Dark ambient drone atmospheric" },
    { label: "Epic", prompt: "Epic orchestral battle music" },
    { label: "Chill", prompt: "Lo-fi chill hip hop beats" },
    { label: "Romantic", prompt: "Romantic strings gentle waltz" },
    { label: "Horror", prompt: "Eerie horror suspense ambient" },
    { label: "Upbeat", prompt: "Upbeat electronic dance energy" },
    { label: "Sad", prompt: "Melancholic slow piano solo" },
];

export default function AudioGenerateBar({
    type,
    projectId,
    onGenerated,
    onClose,
}: AudioGenerateBarProps) {
    const [prompt, setPrompt] = useState("");
    const [duration, setDuration] = useState(type === "sfx" ? 5 : 30);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    const isSfx = type === "sfx";
    const maxDuration = isSfx ? 22 : 120;
    const minDuration = isSfx ? 1 : 5;
    const accent = isSfx ? "22,211,238" : "168,85,247"; // rgb values
    const presets = isSfx ? SFX_PRESETS : BGM_PRESETS;

    const handleGenerate = async () => {
        if (!prompt.trim()) return;
        setLoading(true);
        setError("");
        try {
            const result = isSfx
                ? await generateSfx(projectId, prompt.trim(), duration)
                : await generateBgm(projectId, prompt.trim(), duration, true);
            if (result.status === "success" && result.audio_url) {
                onGenerated(result.audio_url, prompt.trim(), duration);
            } else {
                throw new Error(result.error || "Generation failed");
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Generation failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            className="relative overflow-hidden"
            style={{
                background: `linear-gradient(180deg, rgba(${accent},0.04) 0%, rgba(10,10,10,0.98) 40%)`,
                borderTop: `1px solid rgba(${accent},0.15)`,
            }}
        >
            {/* Close button — top right */}
            <button
                onClick={onClose}
                className="absolute top-2 right-3 p-1 rounded-full hover:bg-white/5 transition-colors z-20"
            >
                <X size={11} className="text-neutral-600 hover:text-neutral-400" />
            </button>

            {/* Row 1: Presets */}
            <div className="flex items-center gap-1 px-3 pt-2.5 pb-1.5 overflow-x-auto scrollbar-hide">
                <div className="flex items-center gap-1 shrink-0 mr-1.5">
                    {isSfx ? (
                        <Waves size={11} style={{ color: `rgb(${accent})` }} />
                    ) : (
                        <Music size={11} style={{ color: `rgb(${accent})` }} />
                    )}
                    <span
                        className="text-[8px] font-bold tracking-[2px] uppercase shrink-0"
                        style={{ color: `rgb(${accent})` }}
                    >
                        {isSfx ? "SFX" : "BGM"}
                    </span>
                    <div className="w-px h-3 bg-neutral-800 mx-1" />
                </div>
                {presets.map((p) => (
                    <button
                        key={p.label}
                        onClick={() => {
                            setPrompt(p.prompt);
                            inputRef.current?.focus();
                        }}
                        className="shrink-0 px-2.5 py-1 rounded-full text-[9px] font-medium transition-all duration-200 hover:scale-[1.04]"
                        style={{
                            border: `1px solid ${prompt === p.prompt ? `rgba(${accent},0.5)` : 'rgba(255,255,255,0.06)'}`,
                            color: prompt === p.prompt ? `rgb(${accent})` : '#777',
                            backgroundColor: prompt === p.prompt ? `rgba(${accent},0.1)` : 'rgba(255,255,255,0.02)',
                        }}
                    >
                        {p.label}
                    </button>
                ))}
            </div>

            {/* Row 2: Input + Duration + Generate */}
            <div className="flex items-center gap-2 px-3 pb-2.5">
                {/* Prompt input */}
                <div className="flex-1 relative">
                    <input
                        ref={inputRef}
                        type="text"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !loading) handleGenerate();
                        }}
                        placeholder={isSfx ? "Describe the sound..." : "Describe the mood & style..."}
                        className="w-full bg-white/[0.03] rounded-lg px-3 py-1.5 text-[11px] text-white placeholder-neutral-600 focus:outline-none transition-all"
                        style={{
                            border: `1px solid ${prompt ? `rgba(${accent},0.25)` : 'rgba(255,255,255,0.06)'}`,
                            boxShadow: prompt ? `0 0 12px rgba(${accent},0.05)` : 'none',
                        }}
                        disabled={loading}
                        autoFocus
                    />
                    {error && (
                        <div className="absolute -bottom-4 left-0 text-[8px] text-red-400 truncate max-w-full">
                            {error}
                        </div>
                    )}
                </div>

                {/* Duration chip */}
                <div
                    className="flex items-center gap-1.5 shrink-0 rounded-lg px-2.5 py-1.5"
                    style={{
                        border: '1px solid rgba(255,255,255,0.06)',
                        backgroundColor: 'rgba(255,255,255,0.02)',
                    }}
                >
                    <input
                        type="range"
                        min={minDuration}
                        max={maxDuration}
                        step={isSfx ? 0.5 : 5}
                        value={duration}
                        onChange={(e) => setDuration(parseFloat(e.target.value))}
                        className="w-16 h-[3px] rounded-full appearance-none cursor-pointer"
                        style={{
                            background: `linear-gradient(to right, rgb(${accent}) 0%, rgb(${accent}) ${((duration - minDuration) / (maxDuration - minDuration)) * 100}%, rgba(255,255,255,0.08) ${((duration - minDuration) / (maxDuration - minDuration)) * 100}%, rgba(255,255,255,0.08) 100%)`,
                        }}
                        disabled={loading}
                    />
                    <span className="text-[10px] font-mono text-neutral-500 w-7 text-right tabular-nums">
                        {duration}s
                    </span>
                </div>

                {/* Generate button */}
                <button
                    onClick={handleGenerate}
                    disabled={loading || !prompt.trim()}
                    className="shrink-0 flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[10px] font-bold tracking-wider uppercase transition-all duration-200 disabled:opacity-20 hover:brightness-125 active:scale-95"
                    style={{
                        background: `linear-gradient(135deg, rgba(${accent},0.25), rgba(${accent},0.12))`,
                        border: `1px solid rgba(${accent},0.3)`,
                        color: `rgb(${accent})`,
                        boxShadow: `0 2px 12px rgba(${accent},0.15)`,
                    }}
                >
                    {loading ? (
                        <Loader2 size={11} className="animate-spin" />
                    ) : (
                        <Sparkles size={11} />
                    )}
                    {loading ? "Working..." : "Generate"}
                </button>
            </div>
        </div>
    );
}
