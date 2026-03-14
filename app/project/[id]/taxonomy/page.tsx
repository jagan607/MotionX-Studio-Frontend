"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { api, generateTaxonomy, selectTaxonomy, processScript, checkJobStatus } from "@/lib/api";
import { TaxonomyMetrics, ArchetypeMatch, TaxonomyResponse } from "@/lib/types";
import {
    Loader2, Check, Lock, ArrowLeft, AlertCircle,
    RefreshCw, ChevronRight, Clapperboard, Camera,
    Lightbulb, Palette, Aperture, Zap
} from "lucide-react";
import { toast } from "react-hot-toast";
import { toastError, toastSuccess } from "@/lib/toast";
import Link from "next/link";
import TaxonomyHeatmap from "@/components/taxonomy/TaxonomyHeatmap";

// ─────────────────────────────────────────────────────────────────────────────
// BLUEPRINT ICONS
// ─────────────────────────────────────────────────────────────────────────────

const BLUEPRINT_FIELDS: {
    key: keyof ArchetypeMatch["blueprint"];
    label: string;
    Icon: React.ComponentType<any>;
}[] = [
    { key: "emotional_philosophy", label: "Emotional Philosophy", Icon: Lightbulb },
    { key: "camera_movement", label: "Camera Movement", Icon: Camera },
    { key: "lens_rules", label: "Lens Rules", Icon: Aperture },
    { key: "lighting_color", label: "Lighting & Color", Icon: Palette },
];

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function TaxonomyPage() {
    const params = useParams();
    const router = useRouter();
    const projectId = params.id as string;

    // --- State ---
    const [phase, setPhase] = useState<"loading" | "select" | "locking" | "processing" | "error">("loading");
    const [scriptMetrics, setScriptMetrics] = useState<TaxonomyMetrics | null>(null);
    const [topMatches, setTopMatches] = useState<ArchetypeMatch[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState("");
    const [projectTitle, setProjectTitle] = useState("");
    const [projectMeta, setProjectMeta] = useState<any>(null);
    const [processingProgress, setProcessingProgress] = useState("");
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Cleanup poll interval on unmount
    useEffect(() => {
        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, []);

    // --- Fetch project metadata for display ---
    useEffect(() => {
        if (!projectId) return;
        const unsub = onSnapshot(doc(db, "projects", projectId), (snap) => {
            const data = snap.data();
            if (data) {
                setProjectTitle(data.title || "");
                setProjectMeta(data);
            }
        });
        return () => unsub();
    }, [projectId]);

    // --- Generate taxonomy on mount ---
    const runTaxonomy = useCallback(async () => {
        setPhase("loading");
        setErrorMessage("");
        try {
            const result = await generateTaxonomy(projectId);

            // Backend returns metrics at top level, not nested under script_metrics
            const extractedMetrics: TaxonomyMetrics = {
                dialogue_action_ratio: result.dialogue_action_ratio ?? result.script_metrics?.dialogue_action_ratio ?? 0,
                fragmentation_whitespace: result.fragmentation_whitespace ?? result.script_metrics?.fragmentation_whitespace ?? 0,
                character_interiority: result.character_interiority ?? result.script_metrics?.character_interiority ?? 0,
                thematic_subtext: result.thematic_subtext ?? result.script_metrics?.thematic_subtext ?? 0,
                scene_duration_pacing: result.scene_duration_pacing ?? result.script_metrics?.scene_duration_pacing ?? 0,
            };

            if (result.top_matches?.length > 0) {
                setScriptMetrics(extractedMetrics);
                setTopMatches(result.top_matches.slice(0, 3));
                setSelectedId(result.top_matches[0].id);
                setPhase("select");
            } else {
                setErrorMessage("No archetype matches were generated. Please try again.");
                setPhase("error");
            }
        } catch (e: any) {
            console.error("[Taxonomy] Generation error:", e);
            setErrorMessage(e.response?.data?.detail || e.message || "Taxonomy analysis failed.");
            setPhase("error");
        }
    }, [projectId]);

    useEffect(() => {
        if (projectId) runTaxonomy();
    }, [projectId, runTaxonomy]);

    // --- Lock In Handler (with Job Polling) ---
    const handleLockIn = async () => {
        if (!selectedId) return;
        setPhase("locking");
        setProcessingProgress("");

        try {
            // 1. Lock in the archetype
            await selectTaxonomy(projectId, selectedId);
            toastSuccess("Cinematic Identity locked in!");

            // 2. Trigger the deferred script parsing worker
            setPhase("processing");
            setProcessingProgress("Initiating script parsing...");

            const processRes = await processScript(
                projectId,
                projectMeta?.script_title || projectTitle,
                projectMeta?.runtime_seconds || 60,
                projectMeta?.target_episode_id
            );

            const jobId = processRes.job_id;
            setProcessingProgress("Parsing Script DNA...");

            // 3. Poll the job until completion
            pollRef.current = setInterval(async () => {
                try {
                    const job = await checkJobStatus(jobId);

                    if (job.progress) {
                        setProcessingProgress(job.progress);
                    }

                    if (job.status === "completed") {
                        if (pollRef.current) clearInterval(pollRef.current);
                        pollRef.current = null;
                        toastSuccess("Script parsed successfully!");
                        router.push(`/project/${projectId}/moodboard?onboarding=true`);
                    } else if (job.status === "failed") {
                        if (pollRef.current) clearInterval(pollRef.current);
                        pollRef.current = null;
                        toastError(job.error || "Script parsing failed.");
                        setErrorMessage(job.error || "Script parsing failed. Please try again.");
                        setPhase("error");
                    }
                } catch (pollErr) {
                    console.error("[Taxonomy] Poll error:", pollErr);
                }
            }, 1000);

        } catch (e: any) {
            console.error("[Taxonomy] Lock-in error:", e);
            toastError(e.response?.data?.detail || "Failed to lock in archetype.");
            setPhase("select");
        }
    };

    // --- Selected archetype object ---
    const selectedArchetype = topMatches.find((m) => m.id === selectedId) || null;

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────────────

    return (
        <main className="min-h-screen bg-[#020202] text-white">
            <style jsx global>{`
                @keyframes taxFadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes taxPulse { 0%,100% { opacity: 0.4; } 50% { opacity: 1; } }
                @keyframes taxGlow { 0%,100% { box-shadow: 0 0 20px rgba(229,9,20,0.15); } 50% { box-shadow: 0 0 40px rgba(229,9,20,0.35); } }
                @keyframes taxDNA { 0% { background-position: 0% 50%; } 100% { background-position: 200% 50%; } }
            `}</style>

            {/* ══════════════════════ TOP BAR ══════════════════════ */}
            <div className="sticky top-0 z-50 h-14 flex items-center justify-between px-6 bg-[#020202]/90 backdrop-blur-md border-b border-white/[0.04]">
                <div className="flex items-center gap-4">
                    <Link
                        href={`/project/${projectId}/script`}
                        className="flex items-center gap-2 text-white/40 hover:text-white transition-colors no-underline group"
                    >
                        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                        <span className="text-[10px] font-bold tracking-[2px] uppercase">Script</span>
                    </Link>
                    {projectTitle && (
                        <>
                            <div className="w-px h-4 bg-white/10" />
                            <span className="text-[10px] text-white/25 font-mono uppercase tracking-wider truncate max-w-[200px]">
                                {projectTitle}
                            </span>
                        </>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-3 py-1 bg-[#E50914]/10 border border-[#E50914]/30 rounded-full">
                        <Clapperboard size={10} className="text-[#E50914]" />
                        <span className="text-[8px] font-bold text-[#E50914] uppercase tracking-widest">
                            Cinematic DNA
                        </span>
                    </div>
                </div>
            </div>

            {/* ══════════════════════ LOADING ══════════════════════ */}
            {phase === "loading" && (
                <div className="flex flex-col items-center justify-center min-h-[80vh] gap-6" style={{ animation: "taxFadeIn 0.6s ease both" }}>
                    <div className="relative w-20 h-20">
                        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#E50914] animate-spin" style={{ animationDuration: "1.5s" }} />
                        <div className="absolute inset-0 rounded-full border-2 border-transparent border-b-[#E50914]/30 animate-spin" style={{ animationDuration: "3s", animationDirection: "reverse" }} />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Zap size={24} className="text-[#E50914]" style={{ animation: "taxPulse 2s ease-in-out infinite" }} />
                        </div>
                    </div>
                    <div className="text-center">
                        <h2 className="text-2xl uppercase tracking-wide mb-2 font-display">Analyzing Script DNA</h2>
                        <p className="text-[11px] text-white/30 tracking-[3px] uppercase font-mono">
                            Extracting cinematic metrics from your screenplay...
                        </p>
                    </div>
                </div>
            )}

            {/* ══════════════════════ ERROR ══════════════════════ */}
            {phase === "error" && (
                <div className="flex flex-col items-center justify-center min-h-[80vh] gap-6" style={{ animation: "taxFadeIn 0.6s ease both" }}>
                    <div className="w-20 h-20 rounded-full border border-[#E50914]/30 flex items-center justify-center">
                        <AlertCircle size={32} className="text-[#E50914]" />
                    </div>
                    <div className="text-center max-w-md">
                        <h2 className="text-2xl uppercase tracking-wide mb-3 font-display">Analysis Failed</h2>
                        <p className="text-[12px] text-neutral-500 mb-8 leading-relaxed">{errorMessage}</p>
                        <button
                            onClick={runTaxonomy}
                            className="flex items-center gap-2 px-8 py-3 rounded-lg bg-[#E50914] hover:bg-[#ff1a25] text-white text-[11px] font-bold uppercase tracking-[2px] transition-all cursor-pointer mx-auto"
                        >
                            <RefreshCw size={14} /> Try Again
                        </button>
                    </div>
                </div>
            )}

            {/* ══════════════════════ LOCKING / PROCESSING ══════════════════════ */}
            {(phase === "locking" || phase === "processing") && (
                <div className="flex flex-col items-center justify-center min-h-[80vh] gap-6" style={{ animation: "taxFadeIn 0.6s ease both" }}>
                    <div className="relative w-20 h-20">
                        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#E50914] animate-spin" style={{ animationDuration: "1.2s" }} />
                        <div className="absolute inset-0 flex items-center justify-center">
                            {phase === "locking" ? (
                                <Lock size={24} className="text-[#E50914]" />
                            ) : (
                                <Clapperboard size={24} className="text-[#E50914]" style={{ animation: "taxPulse 1.5s ease-in-out infinite" }} />
                            )}
                        </div>
                    </div>
                    <div className="text-center">
                        <h2 className="text-2xl uppercase tracking-wide mb-2 font-display">
                            {phase === "locking" ? "Locking Cinematic Identity" : "Parsing Script DNA"}
                        </h2>
                        <p className="text-[11px] text-white/30 tracking-[3px] uppercase font-mono">
                            {phase === "locking"
                                ? "Applying archetype blueprint to your project..."
                                : processingProgress || "Initiating script parsing..."}
                        </p>
                    </div>
                </div>
            )}

            {/* ══════════════════════ SELECT ══════════════════════ */}
            {phase === "select" && scriptMetrics && topMatches.length > 0 && (
                <div className="max-w-6xl mx-auto px-6 py-10" style={{ animation: "taxFadeIn 0.8s ease both" }}>

                    {/* ── Header ── */}
                    <div className="text-center mb-10">
                        <div className="flex items-center justify-center gap-3 mb-4">
                            <div className="h-[1px] w-12 bg-[#E50914]/30" />
                            <span className="text-[9px] font-mono text-[#E50914]/60 uppercase tracking-[4px]">
                                Cinematic Taxonomy
                            </span>
                            <div className="h-[1px] w-12 bg-[#E50914]/30" />
                        </div>
                        <h1 className="text-4xl md:text-5xl font-display uppercase tracking-tight mb-3">
                            Choose Your Visual Identity
                        </h1>
                        <p className="text-[12px] text-white/30 max-w-lg mx-auto leading-relaxed">
                            We analyzed your script and found the closest cinematic archetypes.
                            Select one to define the visual language of your project.
                        </p>
                    </div>

                    {/* ── HEATMAP ── */}
                    <div className="mb-12 bg-[#080808] border border-white/[0.06] rounded-xl p-6">
                        <div className="flex items-center gap-2 mb-5">
                            <div className="w-2 h-2 rounded-full bg-[#E50914]" />
                            <span className="text-[10px] font-bold text-white/50 uppercase tracking-[2px]">
                                Script–Archetype Correlation Matrix
                            </span>
                        </div>
                        <TaxonomyHeatmap
                            scriptMetrics={scriptMetrics}
                            topMatches={topMatches}
                        />
                    </div>

                    {/* ── ARCHETYPE CARDS ── */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
                        {topMatches.map((archetype, idx) => {
                            const isSelected = selectedId === archetype.id;
                            return (
                                <button
                                    key={archetype.id}
                                    onClick={() => setSelectedId(archetype.id)}
                                    className={`relative text-left p-6 rounded-xl border-2 transition-all duration-300 cursor-pointer group ${
                                        isSelected
                                            ? "bg-[#E50914]/[0.06] border-[#E50914] shadow-[0_0_30px_rgba(229,9,20,0.15)]"
                                            : "bg-[#080808] border-white/[0.06] hover:border-white/[0.15] hover:bg-[#0A0A0A]"
                                    }`}
                                >
                                    {/* Match badge */}
                                    <div className="flex items-center justify-between mb-4">
                                        <span className={`text-[9px] font-mono uppercase tracking-[3px] ${
                                            isSelected ? "text-[#E50914]" : "text-white/30"
                                        }`}>
                                            #{idx + 1} Match
                                        </span>
                                        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                            isSelected
                                                ? "bg-[#E50914]/20 text-[#E50914] border border-[#E50914]/30"
                                                : "bg-white/[0.06] text-white/50 border border-white/[0.08]"
                                        }`}>
                                            {archetype.match_percentage}%
                                        </div>
                                    </div>

                                    {/* Name */}
                                    <h3 className={`text-xl font-display uppercase tracking-wide mb-5 ${
                                        isSelected ? "text-white" : "text-white/70"
                                    }`}>
                                        {archetype.name}
                                    </h3>

                                    {/* Blueprint rules */}
                                    <div className="space-y-3">
                                        {BLUEPRINT_FIELDS.map(({ key, label, Icon }) => (
                                            <div key={key} className="flex items-start gap-3">
                                                <Icon
                                                    size={13}
                                                    className={`mt-0.5 shrink-0 ${
                                                        isSelected ? "text-[#E50914]/60" : "text-white/20"
                                                    }`}
                                                />
                                                <div>
                                                    <span className="text-[8px] font-mono text-white/20 uppercase tracking-[2px] block mb-0.5">
                                                        {label}
                                                    </span>
                                                    <span className={`text-[11px] leading-relaxed ${
                                                        isSelected ? "text-white/70" : "text-white/40"
                                                    }`}>
                                                        {archetype.blueprint[key]}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Selection indicator */}
                                    {isSelected && (
                                        <div className="absolute top-4 right-4 w-6 h-6 rounded-full bg-[#E50914] flex items-center justify-center">
                                            <Check size={14} className="text-white" />
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* ── LOCK IN CTA ── */}
                    <div className="flex flex-col items-center gap-4">
                        <button
                            onClick={handleLockIn}
                            disabled={!selectedId}
                            className="flex items-center gap-3 px-10 py-4 rounded-xl bg-[#E50914] hover:bg-[#ff1a25] text-white text-[12px] font-bold uppercase tracking-[2px] transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed shadow-[0_0_25px_rgba(229,9,20,0.2)] hover:shadow-[0_0_40px_rgba(229,9,20,0.4)]"
                            style={{ animation: "taxGlow 3s ease-in-out infinite" }}
                        >
                            <Lock size={16} />
                            Lock In Cinematic Identity
                            <ChevronRight size={16} />
                        </button>
                        {selectedArchetype && (
                            <p className="text-[10px] text-white/25 font-mono uppercase tracking-[2px]">
                                Selecting: {selectedArchetype.name} ({selectedArchetype.match_percentage}% match)
                            </p>
                        )}
                    </div>
                </div>
            )}
        </main>
    );
}
