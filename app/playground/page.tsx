"use client";

/**
 * /playground — B2C Playground workspace page.
 *
 * Phase 2: Functional prompt bar, generation grid with real-time updates,
 * and asset tagging via usePromptMention.
 *
 * Layout:
 *   Left:   Asset drawer (placeholder — Phase 3)
 *   Center: Generation feed (real-time from Firestore) + Prompt bar (functional)
 *   Right:  Style panel (placeholder — Phase 4)
 */

import { PlaygroundProvider, usePlayground } from "@/app/context/PlaygroundContext";
import { Loader2, Sparkles, Image as ImageIcon, Layers, Palette } from "lucide-react";
import PlaygroundGenerationGrid from "@/components/playground/PlaygroundGenerationGrid";
import PlaygroundPromptBar from "@/components/playground/PlaygroundPromptBar";

export default function PlaygroundPage() {
    return (
        <PlaygroundProvider>
            <PlaygroundWorkspace />
        </PlaygroundProvider>
    );
}

function PlaygroundWorkspace() {
    const {
        generations,
        generationsLoading,
        characters,
        locations,
        products,
        assetsLoading,
        stylePrefs,
        uid,
    } = usePlayground();

    if (!uid) {
        return (
            <div className="h-screen w-screen bg-[#030303] flex flex-col items-center justify-center text-[#E50914]">
                <Loader2 className="animate-spin mb-4" size={32} />
                <span className="text-xs font-mono tracking-[3px] uppercase">Authenticating…</span>
            </div>
        );
    }

    const totalAssets = characters.length + locations.length + products.length;

    return (
        <div className="fixed inset-0 bg-[#030303] text-[#EDEDED] font-sans flex flex-col pt-[64px] overflow-hidden selection:bg-[#E50914] selection:text-white">

            {/* ═══ MAIN LAYOUT: 3-COLUMN ═══ */}
            <div className="flex-1 flex min-h-0 overflow-hidden">

                {/* ── LEFT: ASSET DRAWER (placeholder — Phase 3) ── */}
                <aside className="hidden lg:flex w-[260px] border-r border-white/[0.06] flex-col bg-[#050505] shrink-0">
                    <div className="px-4 py-4 border-b border-white/[0.06]">
                        <div className="flex items-center gap-2 mb-1">
                            <Layers size={14} className="text-[#E50914]" />
                            <span className="text-[10px] font-mono text-[#E50914] uppercase tracking-[3px] font-bold">Assets</span>
                        </div>
                        <p className="text-[9px] text-[#555] font-mono uppercase tracking-[1px]">
                            {assetsLoading ? "Loading…" : `${totalAssets} asset${totalAssets !== 1 ? "s" : ""} available`}
                        </p>
                    </div>

                    {/* Tab bar placeholder */}
                    <div className="flex border-b border-white/[0.06]">
                        {(["Characters", "Locations", "Products"] as const).map((tab) => (
                            <button
                                key={tab}
                                className="flex-1 py-2.5 text-[8px] font-bold uppercase tracking-[2px] text-[#555] hover:text-white hover:bg-white/[0.03] transition-colors border-b-2 border-transparent first:border-[#E50914] first:text-white cursor-pointer"
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    {/* Asset list */}
                    <div className="flex-1 overflow-y-auto no-scrollbar p-3">
                        {assetsLoading ? (
                            <div className="flex items-center justify-center h-32">
                                <Loader2 className="animate-spin text-[#333]" size={18} />
                            </div>
                        ) : totalAssets === 0 ? (
                            <div className="flex flex-col items-center justify-center h-40 text-center">
                                <Layers size={24} className="text-[#222] mb-3" />
                                <p className="text-[10px] text-[#444] uppercase tracking-widest font-semibold">No assets yet</p>
                                <p className="text-[9px] text-[#333] mt-1">Create characters, locations, and products</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {[...characters, ...locations, ...products].map((asset) => (
                                    <div
                                        key={asset.id}
                                        className="flex items-center gap-3 p-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.1] transition-all group"
                                    >
                                        <div className="w-9 h-9 rounded-md bg-[#111] border border-[#222] overflow-hidden shrink-0 flex items-center justify-center">
                                            {asset.image_url ? (
                                                <img src={asset.image_url} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <ImageIcon size={12} className="text-[#333]" />
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[11px] font-semibold text-white/90 truncate">{asset.name}</p>
                                            <p className="text-[8px] text-[#555] font-mono uppercase tracking-[1px]">{asset.type}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </aside>

                {/* ── CENTER: GENERATION FEED + PROMPT BAR ── */}
                <main className="flex-1 flex flex-col min-w-0 relative">
                    {/* Feed header */}
                    <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-2">
                            <Sparkles size={14} className="text-[#E50914]" />
                            <span className="text-[10px] font-mono text-white/60 uppercase tracking-[3px] font-bold">Generations</span>
                        </div>
                        <span className="text-[9px] font-mono text-[#444] uppercase tracking-[1px]">
                            {generationsLoading ? "Loading…" : `${generations.length} generation${generations.length !== 1 ? "s" : ""}`}
                        </span>
                    </div>

                    {/* Feed grid — scrollable, with bottom padding for the prompt bar */}
                    <div className="flex-1 overflow-y-auto no-scrollbar p-4 pb-40">
                        <PlaygroundGenerationGrid
                            generations={generations}
                            loading={generationsLoading}
                        />
                    </div>

                    {/* ── BOTTOM: FUNCTIONAL PROMPT BAR ── */}
                    <PlaygroundPromptBar />
                </main>

                {/* ── RIGHT: STYLE PANEL (placeholder — Phase 4) ── */}
                <aside className="hidden xl:flex w-[240px] border-l border-white/[0.06] flex-col bg-[#050505] shrink-0">
                    <div className="px-4 py-4 border-b border-white/[0.06]">
                        <div className="flex items-center gap-2 mb-1">
                            <Palette size={14} className="text-[#E50914]" />
                            <span className="text-[10px] font-mono text-[#E50914] uppercase tracking-[3px] font-bold">Style</span>
                        </div>
                        <p className="text-[9px] text-[#555] font-mono uppercase tracking-[1px]">Quick Preferences</p>
                    </div>

                    <div className="flex-1 p-4 space-y-4 overflow-y-auto no-scrollbar">
                        {([
                            { label: "Aspect Ratio", key: "aspect_ratio" as const },
                            { label: "Shot Type", key: "shot_type" as const },
                            { label: "Provider", key: "image_provider" as const },
                            { label: "Model Tier", key: "model_tier" as const },
                            { label: "Visual Style", key: "style" as const },
                            { label: "Color Palette", key: "style_palette" as const },
                            { label: "Lighting", key: "style_lighting" as const },
                            { label: "Mood", key: "style_mood" as const },
                        ]).map(({ label, key }) => (
                            <div key={key}>
                                <label className="text-[8px] font-mono text-[#555] uppercase tracking-[2px] block mb-1.5">{label}</label>
                                <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg px-3 py-2 text-[11px] text-white/60 font-mono">
                                    {stylePrefs[key] || "—"}
                                </div>
                            </div>
                        ))}
                    </div>
                </aside>
            </div>
        </div>
    );
}
