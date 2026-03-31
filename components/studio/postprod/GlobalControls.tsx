"use client";

import React, { useState } from "react";
import { Settings2, ChevronDown } from "lucide-react";
import { GlobalFilmControls } from "@/lib/types/postprod";

// ═══════════════════════════════════════════════════════════
//   GLOBAL FILM CONTROLS
//   Style / Pacing / Mood — updates entire timeline
// ═══════════════════════════════════════════════════════════

interface GlobalControlsProps {
    controls: GlobalFilmControls;
    onChange: (controls: GlobalFilmControls) => void;
}

const STYLES: GlobalFilmControls["style"][] = ["cinematic", "ad", "documentary", "music_video"];
const PACINGS: GlobalFilmControls["pacing"][] = ["slow", "medium", "fast"];
const MOODS: GlobalFilmControls["mood"][] = ["dark", "light", "emotional", "intense", "neutral"];

export default function GlobalControls({ controls, onChange }: GlobalControlsProps) {
    const [open, setOpen] = useState(false);

    return (
        <div className="absolute bottom-4 right-4 z-20">
            {/* Toggle */}
            <button
                onClick={() => setOpen(!open)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[8px] font-bold tracking-[2px] uppercase transition-all ${
                    open
                        ? "bg-[#E50914]/20 text-[#E50914] border border-[#E50914]/30"
                        : "bg-black/60 backdrop-blur-sm text-neutral-400 border border-white/10 hover:border-white/20"
                }`}
            >
                <Settings2 size={10} />
                FILM CONTROLS
                <ChevronDown size={9} className={`transition-transform ${open ? "rotate-180" : ""}`} />
            </button>

            {/* Panel */}
            {open && (
                <div className="absolute bottom-10 right-0 w-56 bg-[#0a0a0a]/95 backdrop-blur-xl border border-[#222] rounded-lg p-3 space-y-3 shadow-2xl">
                    {/* Style */}
                    <ControlRow label="Style">
                        <div className="flex gap-1 flex-wrap">
                            {STYLES.map((s) => (
                                <button
                                    key={s}
                                    onClick={() => onChange({ ...controls, style: s })}
                                    className={`px-2 py-1 rounded text-[7px] font-bold tracking-widest uppercase transition-all ${
                                        controls.style === s
                                            ? "bg-[#E50914] text-white"
                                            : "bg-[#111] text-neutral-500 hover:text-white"
                                    }`}
                                >
                                    {s.replace("_", " ")}
                                </button>
                            ))}
                        </div>
                    </ControlRow>

                    {/* Pacing */}
                    <ControlRow label="Pacing">
                        <div className="flex gap-1">
                            {PACINGS.map((p) => (
                                <button
                                    key={p}
                                    onClick={() => onChange({ ...controls, pacing: p })}
                                    className={`flex-1 py-1 rounded text-[7px] font-bold tracking-widest uppercase transition-all ${
                                        controls.pacing === p
                                            ? "bg-[#E50914] text-white"
                                            : "bg-[#111] text-neutral-500 hover:text-white"
                                    }`}
                                >
                                    {p}
                                </button>
                            ))}
                        </div>
                    </ControlRow>

                    {/* Mood */}
                    <ControlRow label="Mood">
                        <div className="flex gap-1 flex-wrap">
                            {MOODS.map((m) => (
                                <button
                                    key={m}
                                    onClick={() => onChange({ ...controls, mood: m })}
                                    className={`px-2 py-1 rounded text-[7px] font-bold tracking-widest uppercase transition-all ${
                                        controls.mood === m
                                            ? "bg-[#E50914] text-white"
                                            : "bg-[#111] text-neutral-500 hover:text-white"
                                    }`}
                                >
                                    {m}
                                </button>
                            ))}
                        </div>
                    </ControlRow>
                </div>
            )}
        </div>
    );
}

function ControlRow({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <span className="text-[7px] text-neutral-600 tracking-[2px] uppercase font-bold block mb-1">
                {label}
            </span>
            {children}
        </div>
    );
}
