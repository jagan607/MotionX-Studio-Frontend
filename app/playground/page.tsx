"use client";

/**
 * /playground — B2C Playground workspace page.
 *
 * Layout:
 *   Left:   PlaygroundAssetDrawer (Characters, Locations, Products + create form)
 *   Center: Generation feed (real-time from Firestore) + Prompt bar (functional)
 *   Right:  PlaygroundTemplatePicker (collapsible sidebar with video clip templates)
 */

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { PlaygroundProvider, usePlayground } from "@/app/context/PlaygroundContext";
import { PricingProvider } from "@/app/hooks/usePricing";
import { Loader2, PanelLeftOpen, PanelLeftClose, PanelRightOpen, PanelRightClose } from "lucide-react";
import { TourOverlay } from "@/components/tour/TourOverlay";
import { PLAYGROUND_TOUR_STEPS } from "@/lib/tourConfigs";
import { useTour } from "@/hooks/useTour";

// Heavy components — dynamically loaded (only when user reaches /playground)
const PlaygroundGenerationGrid = dynamic(() => import("@/components/playground/PlaygroundGenerationGrid"), { ssr: false });
const PlaygroundPromptBar = dynamic(() => import("@/components/playground/PlaygroundPromptBar"), { ssr: false });
const PlaygroundAssetDrawer = dynamic(() => import("@/components/playground/PlaygroundAssetDrawer"), { ssr: false });
const PlaygroundAnimateModal = dynamic(() => import("@/components/playground/PlaygroundAnimateModal"), { ssr: false });
const PlaygroundTemplatePicker = dynamic(() => import("@/components/playground/PlaygroundTemplatePicker"), { ssr: false });

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
    const searchParams = useSearchParams();
    const {
        generations,
        generationsLoading,
        uid,
        animateTarget,
        setAnimateTarget,
        assetDrawerOpen: drawerOpen,
        setAssetDrawerOpen: setDrawerOpen,
        setPendingPrompt,
    } = usePlayground();

    // ── Template sidebar state ──
    const [templateSidebarOpen, setTemplateSidebarOpen] = useState(true);

    // ── Tour ──
    const { step: tourStep, nextStep: tourNext, completeTour } = useTour("playground_tour");
    const [forceTour, setForceTour] = useState(false);
    const tourForceCheckedRef = useRef(false);

    useEffect(() => {
        if (tourForceCheckedRef.current) return;
        const shouldTour = searchParams.get("tour") === "true";
        if (shouldTour) {
            setForceTour(true);
            tourForceCheckedRef.current = true;
        }
    }, [searchParams]);

    const [manualTourStep, setManualTourStep] = useState(0);
    useEffect(() => {
        if (forceTour && tourStep === 0 && manualTourStep === 0) {
            const timer = setTimeout(() => setManualTourStep(1), 1500);
            return () => clearTimeout(timer);
        }
    }, [forceTour, tourStep, manualTourStep]);

    const activeTourStep = tourStep || manualTourStep;
    const handleTourNext = () => {
        if (tourStep > 0) {
            tourNext();
        } else {
            setManualTourStep(prev => prev + 1);
        }
    };
    const handleTourComplete = () => {
        if (tourStep > 0) {
            completeTour();
        } else {
            setManualTourStep(0);
            setForceTour(false);
            completeTour();
        }
    };

    // Auto-open the asset drawer when tour reaches step 2 ("YOUR ASSETS")
    useEffect(() => {
        if (activeTourStep === 2 && !drawerOpen) {
            setDrawerOpen(true);
        }
    }, [activeTourStep, drawerOpen, setDrawerOpen]);

    // Read ?idea= query param and pre-fill the prompt bar (one-shot)
    const ideaInjectedRef = useRef(false);
    useEffect(() => {
        if (ideaInjectedRef.current) return;
        const idea = searchParams.get("idea");
        if (idea) {
            setPendingPrompt(decodeURIComponent(idea));
            ideaInjectedRef.current = true;
        }
    }, [searchParams, setPendingPrompt]);

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

            {/* ═══ MAIN LAYOUT: LEFT DRAWER | CENTER FEED | RIGHT TEMPLATES ═══ */}
            <div className="flex-1 flex min-h-0 overflow-hidden relative">

                {/* ── LEFT: COLLAPSIBLE ASSET DRAWER ── */}
                <aside
                    id="tour-pg-assets"
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
                            {/* Left drawer toggle */}
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
                            <span id="tour-pg-grid" className="text-[10px] font-mono text-white/60 uppercase tracking-[3px] font-bold">Generations</span>
                        </div>

                        <div className="flex items-center gap-3">
                            <span className="text-[9px] font-mono text-[#444] uppercase tracking-[1px]">
                                {generationsLoading ? "Loading…" : `${generations.length} generation${generations.length !== 1 ? "s" : ""}`}
                            </span>

                            {/* Right template sidebar toggle */}
                            {templateSidebarOpen ? (
                                <button
                                    onClick={() => setTemplateSidebarOpen(false)}
                                    className="p-1.5 rounded-md text-[#555] hover:text-white hover:bg-white/[0.06] transition-all cursor-pointer"
                                    title="Hide templates"
                                >
                                    <PanelRightClose size={16} />
                                </button>
                            ) : (
                                <button
                                    onClick={() => setTemplateSidebarOpen(true)}
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#D4A843]/30 bg-[#D4A843]/10 text-[#D4A843] text-[9px] font-bold uppercase tracking-[2px] hover:bg-[#D4A843]/20 hover:border-[#D4A843]/50 transition-all cursor-pointer"
                                    title="Show templates"
                                >
                                    ‹ Templates
                                    <PanelRightOpen size={14} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Feed grid — scrollable, with bottom padding for the prompt bar */}
                    <div className="flex-1 overflow-y-auto no-scrollbar p-4 pb-40">
                        <PlaygroundGenerationGrid
                            generations={generations}
                            loading={generationsLoading}
                        />
                    </div>

                    {/* ── BOTTOM: FUNCTIONAL PROMPT BAR ── */}
                    <div id="tour-pg-prompt">
                        <PlaygroundPromptBar />
                    </div>
                </main>

                {/* ── RIGHT: COLLAPSIBLE TEMPLATE SIDEBAR ── */}
                <aside
                    id="tour-pg-templates"
                    className="flex flex-col bg-[#050505] border-l border-white/[0.06] shrink-0 transition-all duration-200 ease-in-out overflow-hidden"
                    style={{ width: templateSidebarOpen ? 300 : 0, minWidth: templateSidebarOpen ? 300 : 0 }}
                >
                    <PlaygroundTemplatePicker />
                </aside>
            </div>

            {/* ═══ ANIMATE MODAL ═══ */}
            <PlaygroundAnimateModal
                generation={animateTarget}
                isOpen={!!animateTarget}
                onClose={() => setAnimateTarget(null)}
            />

            {/* ═══ GUIDED TOUR ═══ */}
            <TourOverlay
                step={activeTourStep}
                steps={PLAYGROUND_TOUR_STEPS}
                onNext={handleTourNext}
                onComplete={handleTourComplete}
            />
        </div>
    );
}
