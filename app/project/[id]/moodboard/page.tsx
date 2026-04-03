"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { collection, onSnapshot, QuerySnapshot, DocumentData, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { api } from "@/lib/api";
import {
    Loader2, Check, Palette, Sun, Layers, CloudFog,
    ChevronRight, ChevronLeft, RefreshCw, AlertCircle,
    ArrowLeft, SkipForward, Sparkles, Undo2, Upload
} from "lucide-react";
import { toast } from "react-hot-toast";
import { toastError, toastSuccess } from "@/lib/toast";
import Link from "next/link";
import CustomMoodboardModal, { CustomMoodboardResult } from "./CustomMoodboardModal";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface MoodOption {
    id: string;
    name: string;
    image_url: string | null;
    color_palette: string;
    lighting: string;
    texture: string;
    atmosphere: string;
    status: "generating" | "ready" | "failed";
    is_variation?: boolean;
    variation_source?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// ATTRIBUTE TAG
// ─────────────────────────────────────────────────────────────────────────────

const AttrTag = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
    <div className="flex items-start gap-3 py-2.5">
        <span className="text-white/20 mt-0.5">{icon}</span>
        <div>
            <span className="text-[8px] font-mono text-white/25 uppercase tracking-[3px] block mb-1">{label}</span>
            <span className="text-[12px] text-white/70 leading-relaxed">{value || "—"}</span>
        </div>
    </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function MoodboardPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();

    const projectId = params.id as string;
    const paramEpisodeId = searchParams.get("episode_id");
    const [resolvedEpisodeId, setResolvedEpisodeId] = useState<string>(paramEpisodeId || "main");
    const episodeId = resolvedEpisodeId;

    const assetsQuery = searchParams.toString();
    const assetsUrl = `/project/${projectId}/assets${assetsQuery ? `?${assetsQuery}` : ''}`;
    const studioUrl = `/project/${projectId}/studio`;
    const isOnboarding = searchParams.get("onboarding") === "true";

    // --- State ---
    const [phase, setPhase] = useState<"select" | "confirming" | "error">("select");
    const [moods, setMoods] = useState<MoodOption[]>([]);
    const [selectedIdx, setSelectedIdx] = useState<number>(0);
    const [isRegenerating, setIsRegenerating] = useState(false);
    const [isGeneratingVariations, setIsGeneratingVariations] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [firestoreLoaded, setFirestoreLoaded] = useState(false);
    const [projectTitle, setProjectTitle] = useState("");
    const [appliedMoodId, setAppliedMoodId] = useState<string | null>(null);
    // Track which moodboard card IDs have already been toasted for failure
    const failedToastedIds = React.useRef<Set<string>>(new Set());

    const readyCount = moods.filter(m => m.status === "ready").length;
    const totalCount = moods.length;
    const selectedMood = moods[selectedIdx] || null;
    const isApplied = selectedMood && appliedMoodId === selectedMood.id;

    // --- Custom Moodboard Upload State ---
    const [customMood, setCustomMood] = useState<{
        localImageUrl: string;
        name: string;
        color_palette: string;
        lighting: string;
        texture: string;
        atmosphere: string;
        isAnalyzing: boolean;
    } | null>(null);
    const [pendingAction, setPendingAction] = useState<{
        type: 'select_taxonomy' | 'regenerate';
        payload?: number;
    } | null>(null);
    const [showCustomModal, setShowCustomModal] = useState(false);

    const isCustomMode = customMood !== null;
    const isCustomAnalyzing = customMood?.isAnalyzing ?? false;

    // The "virtual" selected mood — either from moods[] or customMood
    const displayMood: MoodOption | null = isCustomMode
        ? {
            id: '__custom__',
            name: customMood!.name || 'Analyzing...',
            image_url: customMood!.localImageUrl,
            color_palette: customMood!.color_palette,
            lighting: customMood!.lighting,
            texture: customMood!.texture,
            atmosphere: customMood!.atmosphere,
            status: customMood!.isAnalyzing ? 'generating' : 'ready',
        }
        : selectedMood;

    // Cleanup blob URL on unmount or when custom mood changes
    useEffect(() => {
        return () => {
            if (customMood?.localImageUrl) URL.revokeObjectURL(customMood.localImageUrl);
        };
    }, [customMood?.localImageUrl]);

    // --- Fetch project doc for title & applied mood ---
    useEffect(() => {
        if (!projectId) return;
        const unsub = onSnapshot(doc(db, "projects", projectId), (snap) => {
            const data = snap.data();
            if (data) {
                setProjectTitle(data.title || "");
                setAppliedMoodId(data.selected_mood_id || null);
                // Resolve episode ID from project doc if available
                if (data.default_episode_id) {
                    setResolvedEpisodeId(data.default_episode_id);
                }
            }
        });
        return () => unsub();
    }, [projectId]);

    // --- Firestore real-time listener for mood options ---
    useEffect(() => {
        if (!projectId) return;
        const colRef = collection(db, "projects", projectId, "moodboard_options");
        const unsub = onSnapshot(colRef, (snapshot: QuerySnapshot<DocumentData>) => {
            const options: MoodOption[] = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    name: data.name || "",
                    image_url: data.image_url || null,
                    color_palette: data.color_palette || "",
                    lighting: data.lighting || "",
                    texture: data.texture || "",
                    atmosphere: data.atmosphere || "",
                    status: data.status || "generating",
                    is_variation: data.is_variation || false,
                    variation_source: data.variation_source || undefined,
                };
            });

            // Surface per-card failures via toast (once per card, not on every snapshot)
            options.forEach(opt => {
                if (opt.status === "failed" && !failedToastedIds.current.has(opt.id)) {
                    failedToastedIds.current.add(opt.id);
                    toastError(`Mood "${opt.name || opt.id}" failed to render. You can regenerate.`);
                }
            });

            setMoods(options);
            setFirestoreLoaded(true);
        });
        return () => unsub();
    }, [projectId]);

    // --- Generate moods API ---
    const generateMoods = useCallback(async () => {
        setIsRegenerating(true);
        try {
            const res = await api.post("/api/v1/shot/generate_moodboard", {
                project_id: projectId,
                episode_id: episodeId,
            });
            if (res.data.status === "success") {
                if (res.data.mood_options?.length > 0) {
                    setMoods(res.data.mood_options.map((m: any) => ({
                        ...m, status: m.status || (m.image_url ? "ready" : "generating"),
                    })));
                }
                toastSuccess("Generating moods...");
            } else {
                setErrorMessage("Couldn't generate mood options. Please try again.");
                setPhase("error");
            }
        } catch (e: any) {
            console.error("[Moodboard] Generation error:", e);
            const moodErr = e.response?.data?.detail || "Generation failed. Please try again.";
            setErrorMessage(moodErr);
            toastError(moodErr);
            setPhase("error");
        } finally {
            setIsRegenerating(false);
        }
    }, [projectId, episodeId]);

    // --- Generate variations ("More Like This") ---
    const isViewingVariations = moods.length > 0 && moods.some(m => m.is_variation);

    const generateVariations = useCallback(async (moodOptionId: string) => {
        setIsGeneratingVariations(true);
        try {
            const res = await api.post("/api/v1/shot/generate_moodboard_variations", {
                project_id: projectId,
                episode_id: episodeId,
                mood_option_id: moodOptionId,
            });
            if (res.data.status === "success") {
                toastSuccess(`Generating variations of "${res.data.archetype || selectedMood?.name}"...`);
                setSelectedIdx(0);
            } else {
                toastError("Couldn't generate variations. Please try again.");
            }
        } catch (e: any) {
            console.error("[Moodboard] Variation error:", e);
            toastError(e.response?.data?.detail || "Variation generation failed.");
        } finally {
            setIsGeneratingVariations(false);
        }
    }, [projectId, episodeId, selectedMood]);

    // --- Navigation ---
    const navigate = (dir: 1 | -1) => {
        setSelectedIdx(prev => (prev + dir + moods.length) % moods.length);
    };

    const handleRetry = () => {
        setPhase("select"); setErrorMessage("");
        generateMoods();
    };

    // --- Custom Moodboard Submit (from modal) ---
    const handleCustomSubmit = async (result: CustomMoodboardResult) => {
        // If there's already a custom mood, revoke the old blob
        if (customMood?.localImageUrl) URL.revokeObjectURL(customMood.localImageUrl);

        const localUrl = URL.createObjectURL(result.file);
        setCustomMood({
            localImageUrl: localUrl,
            name: result.mode === 'manual' ? (result.manualParams?.name || '') : '',
            color_palette: result.mode === 'manual' ? (result.manualParams?.color_palette || '') : '',
            lighting: result.mode === 'manual' ? (result.manualParams?.lighting || '') : '',
            texture: result.mode === 'manual' ? (result.manualParams?.texture || '') : '',
            atmosphere: result.mode === 'manual' ? (result.manualParams?.atmosphere || '') : '',
            isAnalyzing: result.mode === 'ai',
        });
        setShowCustomModal(false);

        if (result.mode === 'ai') {
            // AI Auto-Extract: call the analyze endpoint
            try {
                const formData = new FormData();
                formData.append('project_id', projectId);
                formData.append('file', result.file);

                const res = await api.post(
                    '/api/v1/shot/analyze_custom_moodboard',
                    formData,
                    { headers: { 'Content-Type': 'multipart/form-data' } }
                );

                if (res.data.status === 'success') {
                    const style = res.data.moodboard_style;
                    setCustomMood(prev => prev ? {
                        ...prev,
                        name: style.name,
                        color_palette: style.color_palette,
                        lighting: style.lighting,
                        texture: style.texture,
                        atmosphere: style.atmosphere,
                        isAnalyzing: false,
                    } : null);

                    toastSuccess(`Style "${style.name}" extracted — review and apply when ready`);
                }
            } catch (e: any) {
                toastError(e.response?.data?.detail || 'Analysis failed');
                URL.revokeObjectURL(localUrl);
                setCustomMood(null);
            }
        } else {
            // Manual Entry: parameters already set, ready for review
            toastSuccess('Custom moodboard ready — review and apply when ready');
        }
    };

    // --- Guard functions for switching away from custom ---
    const handleTaxonomySelect = (idx: number) => {
        if (isCustomMode) {
            setPendingAction({ type: 'select_taxonomy', payload: idx });
        } else {
            setSelectedIdx(idx);
        }
    };

    const handleRegenerateGuarded = () => {
        if (isCustomMode) {
            setPendingAction({ type: 'regenerate' });
        } else {
            generateMoods();
        }
    };

    const confirmDiscardCustom = () => {
        if (customMood) URL.revokeObjectURL(customMood.localImageUrl);
        setCustomMood(null);

        if (pendingAction?.type === 'select_taxonomy' && pendingAction.payload !== undefined) {
            setSelectedIdx(pendingAction.payload);
        } else if (pendingAction?.type === 'regenerate') {
            generateMoods();
        }
        setPendingAction(null);
    };

    // --- Apply custom moodboard (user confirms after review) ---
    const handleConfirmCustom = () => {
        if (!customMood || isCustomAnalyzing) return;
        setAppliedMoodId('__custom__');
        toastSuccess(`Mood "${customMood.name || 'Custom'}" applied to your project`);
        router.push(`/project/${projectId}/preproduction?episode_id=${episodeId}`);
    };

    const handleConfirm = async () => {
        if (!selectedMood) return;
        setPhase("confirming");
        try {
            const res = await api.post("/api/v1/shot/select_moodboard", {
                project_id: projectId, mood_option_id: selectedMood.id,
            });
            if (res.data.status === "success") {
                setAppliedMoodId(selectedMood.id);
                toastSuccess(`Mood "${res.data.selected_mood?.name || "selected"}" applied`);

                // Dual-gate check: if both scenes + moodboard are locked, extraction starts
                if (res.data.asset_extraction_triggered) {
                    toastSuccess("Assets extracting — finalizing your project...");
                }

                router.push(`/project/${projectId}/preproduction?episode_id=${episodeId}`);
            } else { toastError("Failed to apply mood"); setPhase("select"); }
        } catch (e: any) {
            toastError(e.response?.data?.detail || "Selection failed");
            setPhase("select");
        }
    };

    // Keyboard navigation
    useEffect(() => {
        if (phase !== "select" || !selectedMood) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === "ArrowRight") navigate(1);
            if (e.key === "ArrowLeft") navigate(-1);
            if (e.key === "Enter") handleConfirm();
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [phase, selectedIdx, moods.length]);

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────────────

    return (
        <main className="fixed inset-0 bg-[#020202] text-white overflow-hidden">
            <style jsx global>{`
                @keyframes fadeSlideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes heroFade { from { opacity: 0; } to { opacity: 1; } }
                @keyframes labelReveal { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes scanDrift { 0% { top: 10%; } 100% { top: 90%; } }
                @keyframes pulseGlow { 0%,100% { box-shadow: 0 0 20px rgba(229,9,20,0.15); } 50% { box-shadow: 0 0 40px rgba(229,9,20,0.3); } }
                @keyframes mbFlowBlob1 {
                    0%, 100% { transform: translate(0, 0) scale(1); }
                    33% { transform: translate(25%, 15%) scale(1.3); }
                    66% { transform: translate(-15%, 25%) scale(0.9); }
                }
                @keyframes mbFlowBlob2 {
                    0%, 100% { transform: translate(0, 0) scale(1); }
                    33% { transform: translate(-20%, -15%) scale(1.15); }
                    66% { transform: translate(15%, -10%) scale(1.25); }
                }
                @keyframes mbPulseText {
                    0%, 100% { opacity: 0.5; }
                    50% { opacity: 0.25; }
                }
            `}</style>

            {/* ══════════════════════ TOP BAR — always visible ══════════════════════ */}
            <div className="absolute top-0 left-0 right-0 z-50 h-14 flex items-center justify-between px-6 bg-gradient-to-b from-black/80 to-transparent">
                {/* Left: back + project name */}
                <div className="flex items-center gap-4">
                    <Link href={studioUrl} className="flex items-center gap-2 text-white/40 hover:text-white transition-colors no-underline group">
                        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                        <span className="text-[10px] font-bold tracking-[2px] uppercase">Studio</span>
                    </Link>
                    {projectTitle && (
                        <>
                            <div className="w-px h-4 bg-white/10" />
                            <span className="text-[10px] text-white/25 font-mono uppercase tracking-wider truncate max-w-[200px]">{projectTitle}</span>
                        </>
                    )}

                </div>

                {/* Right: status + actions */}
                <div className="flex items-center gap-4">
                    {totalCount > 0 && readyCount < totalCount && (
                        <div className="flex items-center gap-2">
                            <Loader2 size={10} className="animate-spin text-[#E50914]/50" />
                            <span className="text-[9px] font-mono text-white/25 uppercase tracking-wider">
                                Rendering {readyCount}/{totalCount}
                            </span>
                        </div>
                    )}

                    {isViewingVariations && (
                        <button onClick={handleRegenerateGuarded} disabled={isRegenerating}
                            className="flex items-center gap-2 px-4 py-1.5 text-[10px] font-bold text-white/40 uppercase tracking-[1px] border border-white/[0.08] rounded-md hover:text-white hover:border-white/20 hover:bg-white/[0.04] transition-all cursor-pointer disabled:opacity-30">
                            <Undo2 size={12} />
                            Back to Originals
                        </button>
                    )}

                    {selectedMood && (
                        <button onClick={handleRegenerateGuarded} disabled={isRegenerating}
                            className="flex items-center gap-2 px-4 py-1.5 text-[10px] font-bold text-white/40 uppercase tracking-[1px] border border-white/[0.08] rounded-md hover:text-white hover:border-white/20 hover:bg-white/[0.04] transition-all cursor-pointer disabled:opacity-30">
                            <RefreshCw size={12} className={isRegenerating ? "animate-spin" : ""} />
                            Regenerate
                        </button>
                    )}

                    {/* Close (from studio) — hidden during onboarding */}
                    {!isOnboarding && (
                        <Link href={studioUrl}
                            className="flex items-center gap-2 px-4 py-1.5 text-[10px] font-bold text-white/40 uppercase tracking-[1px] border border-white/[0.08] rounded-md hover:text-white hover:border-white/20 hover:bg-white/[0.04] transition-all no-underline">
                            <ArrowLeft size={12} />
                            Close
                        </Link>
                    )}
                </div>
            </div>

            {/* ══════════════════════ ERROR ══════════════════════ */}
            {phase === "error" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center z-40">
                    <div className="absolute inset-0 bg-[#030303]" />
                    <div className="relative z-10 flex flex-col items-center text-center max-w-md px-6">
                        <div className="w-20 h-20 rounded-full border border-[#E50914]/30 flex items-center justify-center mb-6">
                            <AlertCircle size={32} className="text-[#E50914]" />
                        </div>
                        <h2 className="text-2xl uppercase tracking-wide mb-3 font-display">Generation Failed</h2>
                        <p className="text-[12px] text-neutral-500 mb-8 leading-relaxed">{errorMessage}</p>
                        <button onClick={handleRetry}
                            className="flex items-center gap-2 px-8 py-3 rounded-lg bg-[#E50914] hover:bg-[#ff1a25] text-white text-[11px] font-bold uppercase tracking-[2px] transition-all cursor-pointer">
                            <RefreshCw size={14} /> Try Again
                        </button>
                    </div>
                </div>
            )}

            {/* ══════════════════════ NO MOODS YET ══════════════════════ */}
            {phase === "select" && !selectedMood && (
                <div className="absolute inset-0 z-0">
                    <div className="absolute inset-0 bg-[#030303] overflow-hidden">
                        <div className="absolute w-[50%] h-[50%] rounded-full bg-[#E50914]/15 blur-[80px]"
                            style={{ animation: 'mbFlowBlob1 6s ease-in-out infinite', top: '15%', left: '20%' }} />
                        <div className="absolute w-[40%] h-[40%] rounded-full bg-[#ff4d4d]/8 blur-[60px]"
                            style={{ animation: 'mbFlowBlob2 7s ease-in-out infinite', top: '40%', right: '15%' }} />
                        <div className="absolute inset-0 backdrop-blur-3xl bg-white/[0.01]" />
                    </div>

                    <div className="absolute inset-0 flex flex-col items-center justify-center z-40">
                        {!firestoreLoaded ? (
                            <>
                                <Loader2 size={24} className="text-[#E50914]/40 animate-spin mb-4" />
                                <span className="text-[10px] text-white/20 tracking-[4px] uppercase">Loading moodboard...</span>
                            </>
                        ) : isRegenerating ? (
                            <>
                                <Loader2 size={24} className="text-[#E50914] animate-spin mb-4" />
                                <span className="text-[10px] text-white/40 tracking-[4px] uppercase">Generating moods...</span>
                            </>
                        ) : (
                            <>
                                <Palette size={36} className="text-[#E50914]/30 mb-6" />
                                <h2 className="text-2xl sm:text-3xl uppercase tracking-wide mb-3 font-display text-white/80">Visual Direction</h2>
                                <p className="text-[11px] text-white/30 tracking-[2px] uppercase mb-8">No moodboard generated yet</p>
                                <button
                                    onClick={generateMoods}
                                    className="flex items-center gap-2 px-8 py-3 rounded-lg bg-[#E50914] hover:bg-[#ff1a25] text-white text-[11px] font-bold uppercase tracking-[2px] transition-all cursor-pointer"
                                >
                                    <Palette size={14} /> Generate Moodboard
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* ══════════════════════ SELECT — FULL IMMERSIVE ══════════════════════ */}
            {phase === "select" && (displayMood || isCustomMode) && (
                <>
                    {/* ── HERO BACKGROUND IMAGE ── */}
                    <div key={displayMood!.id + (displayMood!.image_url || '')} className="absolute inset-0 z-0" style={{ animation: "heroFade 0.8s ease both" }}>
                        {displayMood!.image_url ? (
                            <img src={displayMood!.image_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                        ) : (
                            <div className="absolute inset-0 bg-[#050505] overflow-hidden">
                                <div className="absolute w-[55%] h-[55%] rounded-full bg-[#E50914]/25 blur-[60px]"
                                    style={{ animation: 'mbFlowBlob1 5s ease-in-out infinite', top: '10%', left: '15%' }} />
                                <div className="absolute w-[45%] h-[45%] rounded-full bg-[#ff4d4d]/12 blur-[50px]"
                                    style={{ animation: 'mbFlowBlob2 6s ease-in-out infinite', top: '35%', right: '10%' }} />
                                <div className="absolute inset-0 backdrop-blur-2xl bg-white/[0.02]" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-[11px] font-semibold text-white/40 tracking-[4px] uppercase"
                                        style={{ animation: 'mbPulseText 2.5s ease-in-out infinite' }}>
                                        Rendering...
                                    </span>
                                </div>
                            </div>
                        )}
                        {/* Cinematic overlays */}
                        <div className="absolute inset-0 bg-black/30" />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#020202] via-transparent to-[#020202]/40" />
                        <div className="absolute inset-0 bg-gradient-to-r from-[#020202]/70 via-transparent to-[#020202]/50" />
                    </div>

                    {/* ── LETTERBOX BARS ── */}
                    <div className="absolute top-0 left-0 right-0 h-14 bg-gradient-to-b from-[#020202] to-transparent z-30" />
                    <div className="absolute bottom-0 left-0 right-0 h-36 bg-gradient-to-t from-[#020202] via-[#020202] to-transparent z-30" />

                    {/* ── VIEWFINDER FRAME ── */}
                    <div className="absolute inset-0 z-20 pointer-events-none">
                        <div className="absolute top-16 left-8 w-12 h-12 border-t border-l border-white/[0.06]" />
                        <div className="absolute top-16 right-8 w-12 h-12 border-t border-r border-white/[0.06]" />
                        <div className="absolute bottom-40 left-8 w-12 h-12 border-b border-l border-white/[0.06]" />
                        <div className="absolute bottom-40 right-8 w-12 h-12 border-b border-r border-white/[0.06]" />
                        <div className="absolute left-12 right-12 h-[1px] bg-gradient-to-r from-transparent via-[#E50914]/15 to-transparent"
                            style={{ animation: "scanDrift 6s ease-in-out infinite alternate" }} />
                    </div>

                    {/* ── CENTER STAGE: MOOD INFO ── */}
                    <div className="absolute inset-0 z-30 flex items-center pointer-events-none">
                        <div key={displayMood!.id} className="ml-16 max-w-lg" style={{ animation: "labelReveal 0.5s ease both" }}>
                            {/* Mood index + badges */}
                            <div className="flex items-center gap-3 mb-4">
                                <div className={`h-[1px] w-10 ${isCustomMode ? 'bg-amber-500/40' : 'bg-[#E50914]/40'}`} />
                                {isCustomMode ? (
                                    <span className="flex items-center gap-1.5 text-[9px] font-mono text-amber-400/60 uppercase tracking-[4px]">
                                        <Upload size={10} /> Custom Reference
                                    </span>
                                ) : (
                                    <span className="text-[9px] font-mono text-[#E50914]/60 uppercase tracking-[4px]">
                                        {isViewingVariations ? "Variation" : "Mood"} {selectedIdx + 1} of {totalCount}
                                    </span>
                                )}
                                {isViewingVariations && !isCustomMode && (
                                    <span className="flex items-center gap-1 text-[8px] font-bold text-purple-400/80 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded uppercase tracking-wider">
                                        <Sparkles size={9} /> Variation
                                    </span>
                                )}
                                {isCustomMode && !isCustomAnalyzing && appliedMoodId === '__custom__' && (
                                    <span className="flex items-center gap-1 text-[8px] font-bold text-emerald-400/80 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded uppercase tracking-wider">
                                        <Check size={9} /> Applied
                                    </span>
                                )}
                                {isCustomMode && !isCustomAnalyzing && appliedMoodId !== '__custom__' && (
                                    <span className="flex items-center gap-1 text-[8px] font-bold text-amber-400/80 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded uppercase tracking-wider">
                                        <Sparkles size={9} /> Ready to Apply
                                    </span>
                                )}
                                {!isCustomMode && isApplied && (
                                    <span className="flex items-center gap-1 text-[8px] font-bold text-emerald-400/80 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded uppercase tracking-wider">
                                        <Check size={9} /> Applied
                                    </span>
                                )}
                            </div>

                            {/* Big name */}
                            {isCustomAnalyzing ? (
                                <div className="mb-6">
                                    <div className="h-12 w-80 bg-white/[0.06] rounded-lg animate-pulse" />
                                </div>
                            ) : (
                                <h1 className="text-6xl md:text-7xl font-display uppercase tracking-tight leading-[0.9] mb-6 text-white">
                                    {displayMood!.name}
                                </h1>
                            )}

                            {/* Attributes */}
                            {isCustomAnalyzing ? (
                                <div className="space-y-3 border-l border-white/[0.06] pl-5">
                                    {['Color Palette', 'Lighting', 'Texture', 'Atmosphere'].map(label => (
                                        <div key={label} className="py-2.5">
                                            <span className="text-[8px] font-mono text-white/25 uppercase tracking-[3px] block mb-2">{label}</span>
                                            <div className="h-3 w-48 bg-white/[0.06] rounded animate-pulse" />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="space-y-0 border-l border-white/[0.06] pl-5">
                                    <AttrTag icon={<Palette size={13} />} label="Color Palette" value={displayMood!.color_palette} />
                                    <AttrTag icon={<Sun size={13} />} label="Lighting" value={displayMood!.lighting} />
                                    <AttrTag icon={<Layers size={13} />} label="Texture" value={displayMood!.texture} />
                                    <AttrTag icon={<CloudFog size={13} />} label="Atmosphere" value={displayMood!.atmosphere} />
                                </div>
                            )}

                            {/* Image generating indicator */}
                            {!isCustomMode && displayMood!.status !== "ready" && (
                                <div className="flex items-center gap-2 mt-6">
                                    <Loader2 size={12} className="animate-spin text-[#E50914]/40" />
                                    <span className="text-[9px] text-white/20 uppercase tracking-[3px] font-mono">Rendering preview...</span>
                                </div>
                            )}

                            {/* Analyzing indicator for custom */}
                            {isCustomAnalyzing && (
                                <div className="flex items-center gap-2 mt-6">
                                    <Loader2 size={12} className="animate-spin text-amber-400/60" />
                                    <span className="text-[9px] text-amber-300/40 uppercase tracking-[3px] font-mono">Analyzing your reference...</span>
                                </div>
                            )}

                            {/* Generate More Like This CTA — hidden for custom */}
                            {!isCustomMode && displayMood!.status === "ready" && (
                                <button
                                    onClick={() => generateVariations(displayMood!.id)}
                                    disabled={isGeneratingVariations}
                                    className="pointer-events-auto flex items-center gap-2 mt-6 px-5 py-2 rounded-lg text-[10px] font-bold uppercase tracking-[1.5px] border border-white/[0.1] bg-white/[0.04] backdrop-blur-sm text-white/50 hover:text-white hover:border-white/25 hover:bg-white/[0.08] transition-all cursor-pointer disabled:opacity-30 group"
                                >
                                    {isGeneratingVariations ? (
                                        <><Loader2 size={13} className="animate-spin" /> Generating...</>
                                    ) : (
                                        <><Sparkles size={13} className="text-[#E50914]/60 group-hover:text-[#E50914] transition-colors" /> Generate More Like This</>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* ── NAVIGATION ARROWS ── */}
                    {totalCount > 1 && (
                        <div className="absolute inset-y-0 left-0 right-0 z-40 flex items-center justify-between px-6 pointer-events-none">
                            <button onClick={() => navigate(-1)}
                                className="w-12 h-12 rounded-full border border-white/[0.08] bg-black/30 backdrop-blur-sm flex items-center justify-center hover:border-white/[0.2] hover:bg-black/50 transition-all cursor-pointer pointer-events-auto group">
                                <ChevronLeft size={18} className="text-white/30 group-hover:text-white transition-colors" />
                            </button>
                            <button onClick={() => navigate(1)}
                                className="w-12 h-12 rounded-full border border-white/[0.08] bg-black/30 backdrop-blur-sm flex items-center justify-center hover:border-white/[0.2] hover:bg-black/50 transition-all cursor-pointer pointer-events-auto group">
                                <ChevronRight size={18} className="text-white/30 group-hover:text-white transition-colors" />
                            </button>
                        </div>
                    )}

                    {/* ── BOTTOM FILMSTRIP ── */}
                    <div className="absolute bottom-0 left-0 right-0 z-40">
                        {/* Filmstrip perforations */}
                        <div className="flex items-center justify-center gap-[6px] mb-1.5 opacity-15">
                            {[...Array(Math.round(typeof window !== 'undefined' ? window.innerWidth / 18 : 60))].map((_, i) => (
                                <div key={i} className="w-[6px] h-[3px] rounded-[1px] bg-white/60" />
                            ))}
                        </div>

                        <div className="flex h-[100px] border-t border-white/[0.04] bg-[#020202]/80 backdrop-blur-md">
                            {moods.map((mood, idx) => {
                                const active = !isCustomMode && idx === selectedIdx;
                                const hasImage = mood.status === "ready" && mood.image_url;
                                const isMoodApplied = mood.id === appliedMoodId;
                                return (
                                    <button key={mood.id}
                                        onClick={() => handleTaxonomySelect(idx)}
                                        className={`relative flex-1 overflow-hidden transition-all duration-500 cursor-pointer group
                                            ${idx > 0 ? 'border-l border-white/[0.03]' : ''}
                                            ${active ? 'flex-[1.8]' : 'opacity-40 hover:opacity-70'}`}
                                    >
                                        {hasImage ? (
                                            <img src={mood.image_url!} alt={mood.name}
                                                className={`absolute inset-0 w-full h-full object-cover transition-all duration-700
                                                    ${active ? 'scale-100 brightness-90' : 'scale-110 brightness-50 group-hover:brightness-75 group-hover:scale-105'}`}
                                            />
                                        ) : (
                                            <div className="absolute inset-0 bg-[#060606] overflow-hidden">
                                                <div className="absolute w-[70%] h-[70%] rounded-full bg-[#E50914]/20 blur-[25px]"
                                                    style={{ animation: 'mbFlowBlob1 4s ease-in-out infinite', top: '5%', left: '10%' }} />
                                                <div className="absolute w-[50%] h-[50%] rounded-full bg-[#ff4d4d]/10 blur-[20px]"
                                                    style={{ animation: 'mbFlowBlob2 5s ease-in-out infinite', bottom: '5%', right: '5%' }} />
                                                <div className="absolute inset-0 backdrop-blur-xl bg-white/[0.02]" />
                                            </div>
                                        )}

                                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />

                                        {/* Active indicator — red line */}
                                        {active && <div className="absolute top-0 inset-x-0 h-[2px] bg-[#E50914] shadow-[0_0_8px_rgba(229,9,20,0.5)]" />}

                                        {/* Applied badge on thumbnail */}
                                        {isMoodApplied && (
                                            <div className="absolute top-2 right-2 bg-emerald-500/20 border border-emerald-500/30 rounded px-1.5 py-0.5">
                                                <Check size={8} className="text-emerald-400" />
                                            </div>
                                        )}

                                        {/* Label */}
                                        <div className="absolute bottom-0 inset-x-0 p-2.5">
                                            <span className={`text-[9px] font-bold uppercase tracking-wider block truncate
                                                ${active ? 'text-white' : 'text-white/50'}`}>
                                                {mood.name}
                                            </span>
                                            {active && hasImage && !isMoodApplied && (
                                                <span className="text-[7px] text-[#E50914]/60 uppercase tracking-[2px] font-mono mt-0.5 block">Selected</span>
                                            )}
                                            {active && isMoodApplied && (
                                                <span className="text-[7px] text-emerald-400/60 uppercase tracking-[2px] font-mono mt-0.5 block">Currently Applied</span>
                                            )}
                                            {!hasImage && (
                                                <div className="flex items-center gap-1 mt-0.5">
                                                    <Loader2 size={7} className="animate-spin text-[#E50914]/30" />
                                                    <span className="text-[7px] text-white/15 uppercase tracking-wider font-mono">Rendering</span>
                                                </div>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}

                            {/* ── Custom Upload Cell ── */}
                            <button
                                onClick={() => setShowCustomModal(true)}
                                className={`relative flex-1 min-w-[80px] overflow-hidden border-l border-white/[0.03] transition-all duration-500 cursor-pointer group
                                    ${isCustomMode ? 'flex-[1.8] opacity-100' : 'opacity-40 hover:opacity-70'}`}
                            >
                                {isCustomMode && customMood ? (
                                    <>
                                        <img src={customMood.localImageUrl} alt="Custom" className="absolute inset-0 w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />
                                    </>
                                ) : (
                                    <div className="absolute inset-0 bg-[#060606] flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-white/[0.06] m-1 rounded">
                                        <Upload size={14} className="text-white/15" />
                                        <span className="text-[7px] text-white/15 uppercase tracking-widest font-mono">Upload</span>
                                    </div>
                                )}
                                {isCustomMode && <div className="absolute top-0 inset-x-0 h-[2px] bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" />}
                                <div className="absolute bottom-0 inset-x-0 p-2.5">
                                    <span className={`text-[9px] font-bold uppercase tracking-wider block truncate
                                        ${isCustomMode ? 'text-white' : 'text-white/50'}`}>
                                        {isCustomMode ? (customMood?.name || 'Analyzing...') : 'Custom'}
                                    </span>
                                    {isCustomMode && !isCustomAnalyzing && (
                                        <span className={`text-[7px] uppercase tracking-[2px] font-mono mt-0.5 block
                                            ${appliedMoodId === '__custom__' ? 'text-emerald-400/60' : 'text-amber-400/60'}`}>
                                            {appliedMoodId === '__custom__' ? '✦ Applied' : '✦ Ready'}
                                        </span>
                                    )}
                                    {isCustomMode && isCustomAnalyzing && (
                                        <div className="flex items-center gap-1 mt-0.5">
                                            <Loader2 size={7} className="animate-spin text-amber-400/40" />
                                            <span className="text-[7px] text-amber-300/30 uppercase tracking-wider font-mono">Analyzing</span>
                                        </div>
                                    )}
                                </div>
                            </button>
                        </div>

                        {/* Filmstrip bottom perforations */}
                        <div className="flex items-center justify-center gap-[6px] mt-1 mb-1.5 opacity-15">
                            {[...Array(Math.round(typeof window !== 'undefined' ? window.innerWidth / 18 : 60))].map((_, i) => (
                                <div key={i} className="w-[6px] h-[3px] rounded-[1px] bg-white/60" />
                            ))}
                        </div>

                        {/* CTA bar */}
                        <div className="flex items-center justify-between px-8 py-3 bg-[#020202]">
                            <div className="flex items-center gap-2">
                                <span className="text-[8px] font-mono text-white/10 uppercase tracking-[3px]">
                                    ← → Navigate • Enter to Apply
                                </span>
                            </div>
                            <button onClick={isCustomMode ? handleConfirmCustom : handleConfirm}
                                disabled={isCustomAnalyzing || (!isCustomMode && isApplied)}
                                className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-[2px] transition-all cursor-pointer
                                    ${isCustomMode
                                        ? (isCustomAnalyzing
                                            ? 'bg-amber-900/20 text-amber-400/60 border border-amber-500/20 cursor-default'
                                            : 'bg-amber-500 hover:bg-amber-400 text-black shadow-[0_0_20px_rgba(245,158,11,0.2)] hover:shadow-[0_0_30px_rgba(245,158,11,0.3)]')
                                        : isApplied
                                            ? 'bg-emerald-900/30 text-emerald-400/60 border border-emerald-500/20 cursor-default'
                                            : 'bg-[#E50914] hover:bg-[#ff1a25] text-white shadow-[0_0_20px_rgba(229,9,20,0.2)] hover:shadow-[0_0_30px_rgba(229,9,20,0.4)]'}`}
                                style={(!isApplied && !isCustomMode) || (isCustomMode && !isCustomAnalyzing) ? { animation: "pulseGlow 2.5s ease-in-out infinite" } : undefined}>
                                {isCustomMode ? (
                                    isCustomAnalyzing ? (
                                        <><Loader2 size={13} className="animate-spin" /> Analyzing Reference...</>
                                    ) : (
                                        <>Apply This Mood <ChevronRight size={13} /></>
                                    )
                                ) : isApplied ? (
                                    <><Check size={13} /> Already Applied</>
                                ) : (
                                    <>Apply This Mood <ChevronRight size={13} /></>
                                )}
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* ══════════════════════ CONFIRMING ══════════════════════ */}
            {phase === "confirming" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center z-50">
                    {/* Keep the hero visible behind a frosted overlay */}
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />
                    <div className="relative z-10 flex flex-col items-center">
                        <div className="relative w-16 h-16 mb-6">
                            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#E50914] animate-spin" style={{ animationDuration: "1.5s" }} />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Palette size={22} className="text-[#E50914]" />
                            </div>
                        </div>
                        <h3 className="text-lg uppercase tracking-[3px] font-display mb-2">Applying Mood</h3>
                        <p className="text-[10px] text-white/30 uppercase tracking-[3px] font-mono">
                            Setting visual direction for {projectTitle || "your project"}...
                        </p>
                    </div>
                </div>
            )}

            {/* ══════════════════════ WARNING MODAL — Custom Moodboard Discard ══════════════════════ */}
            {pendingAction && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setPendingAction(null)} />
                    <div className="relative z-10 bg-[#111] border border-white/[0.1] rounded-xl p-8 max-w-md text-center" style={{ animation: "fadeSlideUp 0.3s ease both" }}>
                        <AlertCircle size={32} className="text-amber-400 mx-auto mb-4" />
                        <h3 className="text-lg font-display uppercase tracking-wide mb-2">
                            Replace Custom Moodboard?
                        </h3>
                        <p className="text-[12px] text-neutral-400 leading-relaxed mb-8">
                            {pendingAction.type === 'regenerate'
                                ? 'Generating new archetypes will discard your uploaded custom reference.'
                                : 'Switching to a generated moodboard will discard your uploaded reference.'}
                        </p>
                        <div className="flex gap-3 justify-center">
                            <button onClick={() => setPendingAction(null)}
                                className="px-6 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border border-white/[0.1] text-neutral-300 hover:bg-white/[0.05] transition-all cursor-pointer">
                                Cancel
                            </button>
                            <button onClick={confirmDiscardCustom}
                                className="px-6 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-[#E50914] text-white hover:bg-[#ff1a25] transition-all cursor-pointer">
                                Continue
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Custom Moodboard Modal */}
            <CustomMoodboardModal
                isOpen={showCustomModal}
                onClose={() => setShowCustomModal(false)}
                onSubmit={handleCustomSubmit}
            />
        </main>
    );
}
