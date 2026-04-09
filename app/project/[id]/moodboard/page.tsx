"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { collection, onSnapshot, QuerySnapshot, DocumentData, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { api } from "@/lib/api";
import {
    Loader2, Check, Palette, Sun, Layers, CloudFog,
    ChevronRight, ChevronLeft, RefreshCw, AlertCircle,
    ArrowLeft, Sparkles, Undo2, X, Trash2,
    BrainCircuit
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

    const preproductionUrl = `/project/${projectId}/preproduction?episode_id=${episodeId}`;
    const isOnboarding = searchParams.get("onboarding") === "true";

    // --- State ---
    const [phase, setPhase] = useState<"select" | "confirming" | "extracting" | "error">("select");
    const [extractionStep, setExtractionStep] = useState(0);
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

    // --- Custom Moodboard Upload ---
    const [showCustomModal, setShowCustomModal] = useState(false);
    const [isCustomSubmitting, setIsCustomSubmitting] = useState(false);

    // --- Fetch project doc for title & applied mood ---
    useEffect(() => {
        if (!projectId) return;
        const unsub = onSnapshot(doc(db, "projects", projectId), (snap) => {
            const data = snap.data();
            if (data) {
                setProjectTitle(data.title || "");
                const dbSelectedId = data.selected_mood_id || null;
                setAppliedMoodId(dbSelectedId);

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

    // --- Auto-focus the applied moodboard on initial load ---
    const hasAutoFocused = useRef(false);
    useEffect(() => {
        if (hasAutoFocused.current || moods.length === 0 || !appliedMoodId || appliedMoodId === 'custom_upload') return;
        const idx = moods.findIndex(m => m.id === appliedMoodId);
        if (idx !== -1) {
            setSelectedIdx(idx);
            hasAutoFocused.current = true;
        }
    }, [moods, appliedMoodId]);

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

    // --- AUTO-TRIGGER: When arriving from breakdown import, skip manual step ---
    const autoTriggeredRef = useRef(false);
    useEffect(() => {
        // Only auto-trigger once, only during onboarding, only when Firestore has loaded
        // and confirmed no moods exist yet
        if (
            isOnboarding &&
            firestoreLoaded &&
            moods.length === 0 &&
            !autoTriggeredRef.current &&
            !isRegenerating
        ) {
            autoTriggeredRef.current = true;
            generateMoods();
        }
    }, [isOnboarding, firestoreLoaded, moods.length, isRegenerating, generateMoods]);

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
        setIsCustomSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('project_id', projectId);
            formData.append('file', result.file);
            if (result.mode === 'manual' && result.manualParams) {
                formData.append('manual_params', JSON.stringify(result.manualParams));
            }

            await api.post(
                '/api/v1/shot/analyze_custom_moodboard',
                formData,
                { headers: { 'Content-Type': 'multipart/form-data' } }
            );

            toastSuccess('Custom moodboard added to options');
            setShowCustomModal(false);
        } catch (e: any) {
            toastError(e.response?.data?.detail || 'Custom upload failed');
        } finally {
            setIsCustomSubmitting(false);
        }
    };

    // --- Delete Moodboard Option ---
    const handleDeleteMood = async (moodId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const toastId = toast.loading("Deleting moodboard...");
        try {
            await api.post("/api/v1/shot/delete_moodboard_option", {
                project_id: projectId,
                mood_option_id: moodId,
            });
            toast.success("Moodboard deleted", { id: toastId });
        } catch (error: any) {
            toast.error(error.response?.data?.detail || "Failed to delete moodboard", { id: toastId });
        }
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

                // Backend always enqueues deep asset extraction after moodboard lock-in.
                // Stay on this page and poll script_status until "ready".
                setPhase("extracting");
            } else { toastError("Failed to apply mood"); setPhase("select"); }
        } catch (e: any) {
            toastError(e.response?.data?.detail || "Selection failed");
            setPhase("select");
        }
    };

    // --- Extraction Polling: Watch script_status until "ready" ---
    const extractionToastedRef = useRef(false);
    useEffect(() => {
        if (phase !== "extracting") return;

        // Safety timeout — if extraction takes > 5 minutes, navigate anyway
        const timeout = setTimeout(() => {
            toastError("Extraction is taking longer than expected. You can check back later.");
            router.push(`/project/${projectId}/preproduction?episode_id=${episodeId}`);
        }, 5 * 60 * 1000);

        // Listen to project document for script_status changes
        const unsub = onSnapshot(doc(db, "projects", projectId), (snap) => {
            const data = snap.data();
            if (!data) return;

            // Check for extraction error (backend writes this on Phase 3 failure)
            if (data.extraction_error && !extractionToastedRef.current) {
                extractionToastedRef.current = true;
                toast("Character details couldn't be auto-extracted. You can fill them in manually.", {
                    icon: "⚠️",
                    duration: 6000,
                });
                // Don't wait for "ready" — navigate immediately on failure
                clearTimeout(timeout);
                router.push(`/project/${projectId}/preproduction?episode_id=${episodeId}`);
                return;
            }

            // Navigate when extraction completes successfully
            if (data.script_status === "ready") {
                clearTimeout(timeout);
                toastSuccess("Project setup complete!");
                router.push(`/project/${projectId}/preproduction?episode_id=${episodeId}`);
            }

            // Navigate on explicit failure status as well
            if (data.script_status === "failed") {
                clearTimeout(timeout);
                toastError("Extraction failed. You can manually configure assets.");
                router.push(`/project/${projectId}/preproduction?episode_id=${episodeId}`);
            }
        });

        return () => {
            clearTimeout(timeout);
            unsub();
        };
    }, [phase, projectId, episodeId, router]);

    // --- Extraction Step Timer: Fake progress through 4 steps ---
    useEffect(() => {
        if (phase !== "extracting") {
            setExtractionStep(0);
            return;
        }
        const interval = setInterval(() => {
            setExtractionStep(prev => (prev < 3 ? prev + 1 : prev));
        }, 4000);
        return () => clearInterval(interval);
    }, [phase]);

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
                    <Link href={preproductionUrl} className="flex items-center gap-2 text-white/40 hover:text-white transition-colors no-underline group">
                        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                        <span className="text-[10px] font-bold tracking-[2px] uppercase">Pre-Production</span>
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
                        <button onClick={() => generateMoods()} disabled={isRegenerating}
                            className="flex items-center gap-2 px-4 py-1.5 text-[10px] font-bold text-white/40 uppercase tracking-[1px] border border-white/[0.08] rounded-md hover:text-white hover:border-white/20 hover:bg-white/[0.04] transition-all cursor-pointer disabled:opacity-30">
                            <Undo2 size={12} />
                            Back to Originals
                        </button>
                    )}

                    {selectedMood && (
                        <button onClick={() => generateMoods()} disabled={isRegenerating}
                            className="flex items-center gap-2 px-4 py-1.5 text-[10px] font-bold text-white/40 uppercase tracking-[1px] border border-white/[0.08] rounded-md hover:text-white hover:border-white/20 hover:bg-white/[0.04] transition-all cursor-pointer disabled:opacity-30">
                            <RefreshCw size={12} className={isRegenerating ? "animate-spin" : ""} />
                            Regenerate
                        </button>
                    )}

                    {/* Close — back to pre-production (hidden during onboarding) */}
                    {!isOnboarding && (
                        <Link href={preproductionUrl}
                            className="flex items-center gap-2 px-4 py-1.5 text-[10px] font-bold text-white/40 uppercase tracking-[1px] border border-white/[0.08] rounded-md hover:text-white hover:border-white/20 hover:bg-white/[0.04] transition-all no-underline">
                            <X size={12} />
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
            {phase === "select" && selectedMood && (
                <>
                    {/* ── HERO BACKGROUND IMAGE ── */}
                    <div key={selectedMood.id + (selectedMood.image_url || '')} className="absolute inset-0 z-0" style={{ animation: "heroFade 0.8s ease both" }}>
                        {selectedMood.image_url ? (
                            <img src={selectedMood.image_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
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
                    <div className="absolute inset-0 z-30 flex items-start pointer-events-none overflow-y-auto">
                        <div key={selectedMood.id} className="ml-16 max-w-lg mt-[15vh] pb-[220px]" style={{ animation: "labelReveal 0.5s ease both" }}>
                            {/* Mood index + badges */}
                            <div className="flex items-center gap-3 mb-4">
                                <div className="h-[1px] w-10 bg-[#E50914]/40" />
                                <span className="text-[9px] font-mono text-[#E50914]/60 uppercase tracking-[4px]">
                                    {isViewingVariations ? "Variation" : "Mood"} {selectedIdx + 1} of {totalCount}
                                </span>
                                {isViewingVariations && (
                                    <span className="flex items-center gap-1 text-[8px] font-bold text-purple-400/80 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded uppercase tracking-wider">
                                        <Sparkles size={9} /> Variation
                                    </span>
                                )}
                                {isApplied && (
                                    <span className="flex items-center gap-1 text-[8px] font-bold text-emerald-400/80 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded uppercase tracking-wider">
                                        <Check size={9} /> Applied
                                    </span>
                                )}
                            </div>

                            {/* Big name */}
                            <h1 className="text-6xl md:text-7xl font-display uppercase tracking-tight leading-[0.9] mb-6 text-white">
                                {selectedMood.name}
                            </h1>

                            {/* Attributes */}
                            <div className="space-y-0 border-l border-white/[0.06] pl-5">
                                <AttrTag icon={<Palette size={13} />} label="Color Palette" value={selectedMood.color_palette} />
                                <AttrTag icon={<Sun size={13} />} label="Lighting" value={selectedMood.lighting} />
                                <AttrTag icon={<Layers size={13} />} label="Texture" value={selectedMood.texture} />
                                <AttrTag icon={<CloudFog size={13} />} label="Atmosphere" value={selectedMood.atmosphere} />
                            </div>

                            {/* Image generating indicator */}
                            {selectedMood.status !== "ready" && (
                                <div className="flex items-center gap-2 mt-6">
                                    <Loader2 size={12} className="animate-spin text-[#E50914]/40" />
                                    <span className="text-[9px] text-white/20 uppercase tracking-[3px] font-mono">Rendering preview...</span>
                                </div>
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

                        <div className="flex h-[130px] border-t border-white/[0.04] bg-[#020202]/80 backdrop-blur-md">
                            {moods.map((mood, idx) => {
                                const active = idx === selectedIdx;
                                const hasImage = mood.status === "ready" && mood.image_url;
                                const isMoodApplied = mood.id === appliedMoodId;
                                return (
                                    <button key={mood.id}
                                        onClick={() => setSelectedIdx(idx)}
                                        className={`relative flex-1 overflow-hidden transition-all duration-500 cursor-pointer group
                                            ${idx > 0 ? 'border-l border-white/[0.03]' : ''}
                                            ${isMoodApplied ? 'flex-[1.6] opacity-100 ring-1 ring-emerald-500/50' : active ? 'flex-[1.8] opacity-100' : 'opacity-40 hover:opacity-70'}`}
                                    >
                                        {hasImage ? (
                                            <img src={mood.image_url!} alt={mood.name}
                                                className={`absolute inset-0 w-full h-full object-cover transition-all duration-700
                                                    ${isMoodApplied ? 'scale-100 brightness-[0.85]' : active ? 'scale-100 brightness-90' : 'scale-110 brightness-50 group-hover:brightness-75 group-hover:scale-105'}`}
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

                                        {/* Applied indicator — emerald glow line + badge */}
                                        {isMoodApplied && (
                                            <>
                                                <div className="absolute top-0 inset-x-0 h-[2px] bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.6)]" />
                                                <div className="absolute bottom-0 inset-x-0 h-[2px] bg-emerald-400/40" />
                                                <div className="absolute top-2 right-2 flex items-center gap-1 bg-emerald-500/30 border border-emerald-400/50 rounded-full px-2 py-0.5 backdrop-blur-sm">
                                                    <Check size={8} className="text-emerald-300" />
                                                    <span className="text-[7px] font-bold text-emerald-300 uppercase tracking-wider">Applied</span>
                                                </div>
                                            </>
                                        )}

                                        {/* Delete button — hover-visible, hidden for applied */}
                                        {!isMoodApplied && (
                                            <div
                                                onClick={(e) => handleDeleteMood(mood.id, e)}
                                                className="absolute top-2 left-2 z-50 p-1.5 rounded-md bg-black/40 backdrop-blur-md border border-white/10 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 hover:border-red-500/50 transition-all cursor-pointer"
                                            >
                                                <Trash2 size={12} className="text-white/60 hover:text-red-400 transition-colors" />
                                            </div>
                                        )}

                                        {/* Label */}
                                        <div className="absolute bottom-0 inset-x-0 p-2.5">
                                            <span className={`text-[9px] font-bold uppercase tracking-wider block truncate
                                                ${isMoodApplied ? 'text-emerald-300' : active ? 'text-white' : 'text-white/50'}`}>
                                                {mood.name}
                                            </span>
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
                                className="relative flex-1 min-w-[80px] overflow-hidden border-l border-white/[0.03] transition-all duration-500 cursor-pointer group opacity-70 hover:opacity-100"
                            >
                                <div className="absolute inset-0 bg-[#0a0a0a] flex flex-col items-center justify-center gap-1.5 border border-dashed border-white/20 m-1 rounded group-hover:border-white/40 transition-all">
                                    <div className="w-6 h-6 rounded-full border border-white/50 flex items-center justify-center group-hover:border-white group-hover:bg-white/10 transition-all">
                                        <span className="text-white/70 text-sm font-light group-hover:text-white transition-colors">+</span>
                                    </div>
                                    <span className="text-[8px] text-white/60 uppercase tracking-[2px] font-bold group-hover:text-white transition-colors">Custom</span>
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
                            <div className="flex items-center gap-4">
                                {selectedMood.status === "ready" && (
                                    <button
                                        onClick={() => generateVariations(selectedMood.id)}
                                        disabled={isGeneratingVariations}
                                        className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-[2px] border border-white/10 bg-white/5 text-white/70 hover:text-white hover:border-white/30 hover:bg-white/10 transition-all cursor-pointer disabled:opacity-30"
                                    >
                                        {isGeneratingVariations ? (
                                            <><Loader2 size={13} className="animate-spin" /> Generating...</>
                                        ) : (
                                            <><Sparkles size={13} className="text-white/50" /> Generate More Like This</>
                                        )}
                                    </button>
                                )}
                                <button onClick={handleConfirm}
                                    disabled={isApplied}
                                    className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-[2px] transition-all cursor-pointer
                                        ${isApplied
                                            ? 'bg-emerald-900/30 text-emerald-400/60 border border-emerald-500/20 cursor-default'
                                            : 'bg-[#E50914] hover:bg-[#ff1a25] text-white shadow-[0_0_20px_rgba(229,9,20,0.2)] hover:shadow-[0_0_30px_rgba(229,9,20,0.4)]'}`}
                                    style={!isApplied ? { animation: "pulseGlow 2.5s ease-in-out infinite" } : undefined}>
                                    {isApplied ? (
                                        <><Check size={13} /> Applied</>
                                    ) : (
                                        <>Apply This Mood <ChevronRight size={13} /></>
                                    )}
                                </button>
                            </div>
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

            {/* ══════════════════════ EXTRACTING (Phase 3) ══════════════════════ */}
            {phase === "extracting" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center z-50">
                    {/* Scoped keyframes */}
                    <style>{`
                        @keyframes extractGlow {
                            0%, 100% { opacity: 0.4; transform: scale(1); }
                            50% { opacity: 1; transform: scale(1.05); }
                        }
                        @keyframes extractScan {
                            0% { transform: translateX(-100%); }
                            100% { transform: translateX(300%); }
                        }
                        @keyframes extractFloat {
                            0%, 100% { transform: translateY(0); }
                            50% { transform: translateY(-6px); }
                        }
                    `}</style>

                    <div className="absolute inset-0 bg-[#030303]" />

                    {/* Ambient glow */}
                    <div className="absolute top-[20%] left-[30%] w-[500px] h-[400px] rounded-full blur-[150px] pointer-events-none"
                        style={{ background: "radial-gradient(circle, rgba(229,9,20,0.06) 0%, transparent 70%)", animation: "extractGlow 8s ease-in-out infinite" }} />
                    <div className="absolute bottom-[10%] right-[20%] w-[300px] h-[300px] rounded-full blur-[120px] pointer-events-none"
                        style={{ background: "radial-gradient(circle, rgba(229,9,20,0.04) 0%, transparent 70%)", animation: "extractGlow 6s ease-in-out infinite 2s" }} />

                    <div className="relative z-10 flex flex-col items-center max-w-md px-8">
                        {/* Pulsing brain icon */}
                        <div className="relative w-20 h-20 mb-8 flex items-center justify-center" style={{ animation: "extractFloat 4s ease-in-out infinite" }}>
                            <div className="absolute inset-0 rounded-full border border-white/[0.04]" />
                            <div className="absolute inset-0 rounded-full border border-[#E50914]/30 border-t-transparent animate-spin" style={{ animationDuration: "2s" }} />
                            <div className="absolute inset-2 rounded-full border border-[#E50914]/15 border-b-transparent animate-spin" style={{ animationDuration: "3s", animationDirection: "reverse" }} />
                            <BrainCircuit size={22} className="text-[#E50914]" style={{ animation: "extractGlow 3s ease-in-out infinite" }} />
                        </div>

                        <h3 className="text-xl uppercase tracking-[3px] font-display mb-2 text-white">Setting Up Your Project</h3>
                        <p className="text-[10px] text-white/30 uppercase tracking-[3px] font-mono text-center mb-8">
                            Extracting characters, locations & visual traits...
                        </p>

                        {/* Step indicators — timer-driven progression */}
                        <div className="w-full space-y-2 mb-8">
                            {[
                                { label: "Visual direction locked" },
                                { label: "Extracting characters" },
                                { label: "Extracting locations" },
                                { label: "Applying visual aesthetic" },
                            ].map((step, i) => {
                                const isDone = i < extractionStep + 1;
                                const isActive = i === extractionStep + 1;
                                // Step 0 ("Visual direction locked") is always done
                                const done = i === 0 || isDone;
                                const active = !done && isActive;

                                return (
                                    <div key={step.label}
                                        className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-all duration-700 ${active ? "bg-white/[0.03]" : ""}`}
                                        style={{ opacity: done || active ? 1 : 0.4, transition: "all 0.7s ease" }}>
                                        <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 border transition-all duration-700 ${
                                            done ? "border-emerald-500/40 bg-emerald-500/10" : active ? "border-[#E50914]/40 bg-[#E50914]/10" : "border-white/[0.06]"
                                        }`}>
                                            {done ? (
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                            ) : active ? (
                                                <div className="w-1.5 h-1.5 rounded-full bg-[#E50914] animate-pulse" />
                                            ) : (
                                                <div className="w-1 h-1 rounded-full bg-white/10" />
                                            )}
                                        </div>
                                        <span className={`text-[10px] tracking-[1.5px] uppercase font-mono transition-colors duration-700 ${
                                            done ? "text-emerald-400/50" : active ? "text-white/80" : "text-neutral-700"
                                        }`}>{step.label}</span>
                                        {active && (
                                            <div className="ml-auto w-16 h-[2px] bg-white/[0.04] rounded-full overflow-hidden">
                                                <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-[#E50914] to-transparent"
                                                    style={{ animation: "extractScan 1.5s ease-in-out infinite" }} />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Bottom progress bar */}
                        <div className="w-full h-[2px] bg-white/[0.04] rounded-full overflow-hidden">
                            <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-[#E50914] to-transparent"
                                style={{ animation: "extractScan 2s ease-in-out infinite" }} />
                        </div>
                    </div>
                </div>
            )}



            {/* Custom Moodboard Modal */}
            <CustomMoodboardModal
                isOpen={showCustomModal}
                onClose={() => setShowCustomModal(false)}
                onSubmit={handleCustomSubmit}
                isSubmitting={isCustomSubmitting}
            />
        </main>
    );
}
