"use client";

/**
 * /playground — B2C Playground workspace page.
 *
 * Phase 3: Functional asset drawer with tabbed CRUD, prompt bar with @-mentions,
 * and real-time generation grid.
 *
 * Layout:
 *   Left:   PlaygroundAssetDrawer (Characters, Locations, Products + create form)
 *   Center: Generation feed (real-time from Firestore) + Prompt bar (functional)
 *   Right:  Style panel (placeholder — Phase 4)
 */

import { useState } from "react";
import { PlaygroundProvider, usePlayground } from "@/app/context/PlaygroundContext";
import { PricingProvider } from "@/app/hooks/usePricing";
import { Loader2, PanelLeftOpen, PanelLeftClose } from "lucide-react";
import PlaygroundGenerationGrid from "@/components/playground/PlaygroundGenerationGrid";
import PlaygroundPromptBar from "@/components/playground/PlaygroundPromptBar";
import PlaygroundAssetDrawer from "@/components/playground/PlaygroundAssetDrawer";
import PlaygroundAnimateModal from "@/components/playground/PlaygroundAnimateModal";

export default function PlaygroundPage() {
    return (
        <PricingProvider>
            <PlaygroundProvider>
                <PlaygroundWorkspace />
            </PlaygroundProvider>
        </PricingProvider>
    );
}

function PlaygroundWorkspace() {
    const {
        generations,
        generationsLoading,
        uid,
        animateTarget,
        setAnimateTarget,
    } = usePlayground();

    const [drawerOpen, setDrawerOpen] = useState(true);

    if (!uid) {
        return (
            <div className="h-screen w-screen bg-[#030303] flex flex-col items-center justify-center text-[#E50914]">
                <Loader2 className="animate-spin mb-4" size={32} />
                <span className="text-xs font-mono tracking-[3px] uppercase">Authenticating…</span>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-[#030303] text-[#EDEDED] font-sans flex flex-col pt-[64px] overflow-hidden selection:bg-[#E50914] selection:text-white">

            {/* ═══ MAIN LAYOUT ═══ */}
            <div className="flex-1 flex min-h-0 overflow-hidden relative">

                {/* ── LEFT: COLLAPSIBLE ASSET DRAWER ── */}
                <aside
                    className="flex flex-col bg-[#050505] border-r border-white/[0.06] shrink-0 transition-all duration-200 ease-in-out overflow-hidden"
                    style={{ width: drawerOpen ? 280 : 0, minWidth: drawerOpen ? 280 : 0 }}
                >
                    <PlaygroundAssetDrawer />
                </aside>

                {/* ── CENTER: GENERATION FEED + PROMPT BAR ── */}
                <main className="flex-1 flex flex-col min-w-0 relative">
                    {/* Feed header */}
                    <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-3">
                            {/* Drawer toggle — prominent when collapsed, subtle when open */}
                            {drawerOpen ? (
                                <button
                                    onClick={() => setDrawerOpen(false)}
                                    className="p-1.5 rounded-md text-[#555] hover:text-white hover:bg-white/[0.06] transition-all cursor-pointer"
                                    title="Hide assets"
                                >
                                    <PanelLeftClose size={16} />
                                </button>
                            ) : (
                                <button
                                    onClick={() => setDrawerOpen(true)}
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#E50914]/30 bg-[#E50914]/10 text-[#E50914] text-[9px] font-bold uppercase tracking-[2px] hover:bg-[#E50914]/20 hover:border-[#E50914]/50 transition-all cursor-pointer"
                                    title="Show assets"
                                >
                                    <PanelLeftOpen size={14} />
                                    Assets ›
                                </button>
                            )}
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
            </div>

            {/* ═══ ANIMATE MODAL (adapter around ShotEditorPanel) ═══ */}
            <PlaygroundAnimateModal
                generation={animateTarget}
                isOpen={!!animateTarget}
                onClose={() => setAnimateTarget(null)}
            />
        </div>
    );
}
