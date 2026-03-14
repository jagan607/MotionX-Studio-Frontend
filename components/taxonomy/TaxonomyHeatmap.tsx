"use client";

import React from "react";
import { TaxonomyMetrics, ArchetypeMatch } from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// METRIC LABELS (row names for the heatmap)
// ─────────────────────────────────────────────────────────────────────────────

const METRIC_KEYS: { key: keyof TaxonomyMetrics; label: string }[] = [
    { key: "dialogue_action_ratio", label: "Dialogue" },
    { key: "fragmentation_whitespace", label: "Whitespace" },
    { key: "character_interiority", label: "Interiority" },
    { key: "thematic_subtext", label: "Subtext" },
    { key: "scene_duration_pacing", label: "Pacing" },
];

// ─────────────────────────────────────────────────────────────────────────────
// COLOR SCALE — maps 0–10 score to brand-aligned Tailwind bg classes
// ─────────────────────────────────────────────────────────────────────────────

const getHeatColor = (score: number): string => {
    // Clamped 0–10
    const s = Math.max(0, Math.min(10, Math.round(score)));
    const scale: Record<number, string> = {
        0: "bg-neutral-900/80 text-neutral-600",
        1: "bg-neutral-800/90 text-neutral-500",
        2: "bg-neutral-700/80 text-neutral-400",
        3: "bg-red-950/40 text-red-300/70",
        4: "bg-red-950/60 text-red-300/80",
        5: "bg-red-900/50 text-red-200/80",
        6: "bg-red-900/70 text-red-100/90",
        7: "bg-red-800/70 text-white/90",
        8: "bg-red-700/80 text-white",
        9: "bg-red-600/90 text-white",
        10: "bg-red-600 text-white font-bold",
    };
    return scale[s] || scale[5];
};

// ─────────────────────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────────────────────

interface TaxonomyHeatmapProps {
    scriptMetrics: TaxonomyMetrics;
    topMatches: ArchetypeMatch[]; // expects 3 entries
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

const TaxonomyHeatmap: React.FC<TaxonomyHeatmapProps> = ({
    scriptMetrics,
    topMatches,
}) => {
    // Column headers: "Your Script" + top 3 archetype names
    const columns = [
        { label: "Your Script", isScript: true },
        ...topMatches.slice(0, 3).map((m) => ({
            label: m.name,
            isScript: false,
        })),
    ];

    return (
        <div className="w-full overflow-x-auto">
            <div className="min-w-[480px]">
                {/* ── COLUMN HEADERS ── */}
                <div className="grid gap-1 mb-1" style={{ gridTemplateColumns: `140px repeat(${columns.length}, 1fr)` }}>
                    {/* Empty top-left corner */}
                    <div />
                    {columns.map((col, idx) => (
                        <div
                            key={idx}
                            className={`text-center py-2 px-1 rounded-t-md text-[9px] font-bold uppercase tracking-[2px] ${
                                col.isScript
                                    ? "bg-[#E50914]/15 text-[#E50914] border border-[#E50914]/30"
                                    : "bg-white/[0.04] text-white/40 border border-white/[0.06]"
                            }`}
                        >
                            {col.label}
                        </div>
                    ))}
                </div>

                {/* ── HEATMAP ROWS ── */}
                {METRIC_KEYS.map((metric) => {
                    // Build cell values: script metric + archetype ideal metrics
                    const scriptVal = scriptMetrics[metric.key];
                    const archetypeVals = topMatches
                        .slice(0, 3)
                        .map((m) => m.ideal_metrics[metric.key]);
                    const allVals = [scriptVal, ...archetypeVals];

                    return (
                        <div
                            key={metric.key}
                            className="grid gap-1 mb-1"
                            style={{ gridTemplateColumns: `140px repeat(${columns.length}, 1fr)` }}
                        >
                            {/* Row label */}
                            <div className="flex items-center px-3 py-3 text-[10px] font-bold text-white/50 uppercase tracking-[1.5px] bg-white/[0.02] rounded-l-md border border-white/[0.04]">
                                {metric.label}
                            </div>

                            {/* Heatmap cells */}
                            {allVals.map((val, idx) => (
                                <div
                                    key={idx}
                                    className={`flex items-center justify-center py-3 rounded-sm text-sm font-mono font-semibold transition-all duration-300 ${getHeatColor(val)} ${
                                        idx === 0 ? "ring-1 ring-[#E50914]/20" : ""
                                    }`}
                                >
                                    {val.toFixed(1)}
                                </div>
                            ))}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default TaxonomyHeatmap;
