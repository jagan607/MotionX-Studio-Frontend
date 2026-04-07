"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
    ArrowLeft, Upload, Loader2, CheckCircle2, AlertTriangle, XCircle,
    Play, ChevronRight, Sparkles, Zap, Edit3, RefreshCw,
    Image as ImageIcon, Video, Clock, CreditCard, FileJson,
    ArrowRight, ExternalLink, Download, RotateCcw,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { analyzeWorkflow, executeWorkflow, getWorkflowStatus } from "@/lib/api";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";

// ═══════════════════════════════════════════════════════════
//  WORKFLOW LAB — ComfyUI Import, Translate, Execute
//  3-phase flow: Upload → Preview → Monitor
// ═══════════════════════════════════════════════════════════

type Phase = "upload" | "preview" | "executing" | "done";

interface WorkflowOperation {
    type: string;
    intent: string;
    provider: string;
    composed_prompt: string;
    estimated_credits: number;
    parameters: Record<string, any>;
}

interface WorkflowAnalysis {
    workflow_id: string;
    pipeline_type: string;
    summary: string;
    confidence: number;
    operations: WorkflowOperation[];
    user_inputs_required: { key: string; label: string; type: string }[];
    warnings: string[];
    total_estimated_credits: number;
    heuristic_match: boolean;
}

interface StepStatus {
    status: "pending" | "running" | "completed" | "failed";
    output_url?: string;
    error?: string;
    credits_charged?: number;
}

// ── Provider badges ──
const PROVIDER_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    "seedance-2": { bg: "bg-violet-500/10", text: "text-violet-400", border: "border-violet-500/20" },
    "kling": { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20" },
    "gemini": { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
};

// ── Type icons ──
const TYPE_ICONS: Record<string, React.ReactNode> = {
    "image_gen": <ImageIcon size={14} />,
    "video_edit": <Video size={14} />,
    "face_swap": <RotateCcw size={14} />,
    "generative_edit": <Edit3 size={14} />,
    "motion_transfer": <RefreshCw size={14} />,
    "upscale": <Zap size={14} />,
};

export default function WorkflowLabPage() {
    const params = useParams();
    const router = useRouter();
    const projectId = params.id as string;

    // ── State ──
    const [phase, setPhase] = useState<Phase>("upload");
    const [isDragging, setIsDragging] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysis, setAnalysis] = useState<WorkflowAnalysis | null>(null);
    const [fileName, setFileName] = useState("");

    // Preview edits
    const [promptOverrides, setPromptOverrides] = useState<Record<number, string>>({});
    const [providerOverrides, setProviderOverrides] = useState<Record<number, string>>({});
    const [userInputs, setUserInputs] = useState<Record<string, string>>({});
    const [uploadingInputs, setUploadingInputs] = useState<Record<string, boolean>>({});

    // Execution
    const [executionId, setExecutionId] = useState<string | null>(null);
    const [stepStatuses, setStepStatuses] = useState<StepStatus[]>([]);
    const [isExecuting, setIsExecuting] = useState(false);
    const [overallStatus, setOverallStatus] = useState<string>("pending");

    const fileInputRef = useRef<HTMLInputElement>(null);
    const pollRef = useRef<NodeJS.Timeout | null>(null);

    // ══════════════════════════════════════════════
    //  PHASE 1: UPLOAD & ANALYZE
    // ══════════════════════════════════════════════

    const handleFileUpload = useCallback(async (file: File) => {
        if (!file.name.endsWith(".json")) {
            toast.error("Please upload a ComfyUI workflow JSON file");
            return;
        }
        setFileName(file.name);
        setIsAnalyzing(true);
        setAnalysis(null);

        try {
            const result = await analyzeWorkflow(file);
            setAnalysis(result);
            setPhase("preview");
            // Initialize prompt overrides from analysis
            const prompts: Record<number, string> = {};
            result.operations?.forEach((op: WorkflowOperation, i: number) => {
                prompts[i] = op.composed_prompt || "";
            });
            setPromptOverrides(prompts);
            toast.success(`Workflow analyzed — ${result.operations?.length || 0} steps detected`);
        } catch (err: any) {
            toast.error(err?.response?.data?.detail || "Analysis failed");
        } finally {
            setIsAnalyzing(false);
        }
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) handleFileUpload(file);
    }, [handleFileUpload]);

    // ══════════════════════════════════════════════
    //  USER INPUT FILE UPLOAD (images/videos)
    // ══════════════════════════════════════════════

    const handleUserInputUpload = async (key: string, file: File) => {
        setUploadingInputs(prev => ({ ...prev, [key]: true }));
        try {
            const storageRef = ref(storage, `projects/${projectId}/workflow_inputs/${Date.now()}_${file.name}`);
            const snapshot = await uploadBytes(storageRef, file);
            const url = await getDownloadURL(snapshot.ref);
            setUserInputs(prev => ({ ...prev, [key]: url }));
            toast.success(`${key} uploaded`);
        } catch {
            toast.error(`Failed to upload ${key}`);
        } finally {
            setUploadingInputs(prev => ({ ...prev, [key]: false }));
        }
    };

    // ══════════════════════════════════════════════
    //  PHASE 3: EXECUTE & POLL
    // ══════════════════════════════════════════════

    const handleExecute = async () => {
        if (!analysis) return;

        // Validate required inputs
        const missing = analysis.user_inputs_required?.filter(inp => !userInputs[inp.key]);
        if (missing?.length) {
            toast.error(`Please provide: ${missing.map(m => m.label).join(", ")}`);
            return;
        }

        setIsExecuting(true);
        setPhase("executing");

        try {
            // Build overrides
            const pOverrides: Record<string, string> = {};
            const provOverrides: Record<string, string> = {};
            Object.entries(promptOverrides).forEach(([idx, prompt]) => {
                if (prompt !== analysis.operations[Number(idx)]?.composed_prompt) {
                    pOverrides[`step_${idx}`] = prompt;
                }
            });
            Object.entries(providerOverrides).forEach(([idx, prov]) => {
                if (prov !== analysis.operations[Number(idx)]?.provider) {
                    provOverrides[`step_${idx}`] = prov;
                }
            });

            const result = await executeWorkflow({
                workflow_id: analysis.workflow_id,
                project_id: projectId,
                user_inputs: userInputs,
                prompt_overrides: Object.keys(pOverrides).length ? pOverrides : undefined,
                provider_overrides: Object.keys(provOverrides).length ? provOverrides : undefined,
            });

            setExecutionId(result.execution_id);
            setStepStatuses(analysis.operations.map(() => ({ status: "pending" })));

            // Start polling
            startPolling(result.execution_id);
        } catch (err: any) {
            toast.error(err?.response?.data?.detail || "Execution failed");
            setPhase("preview");
            setIsExecuting(false);
        }
    };

    const startPolling = (execId: string) => {
        if (pollRef.current) clearInterval(pollRef.current);

        pollRef.current = setInterval(async () => {
            try {
                const status = await getWorkflowStatus(execId);
                setOverallStatus(status.status);
                setStepStatuses(status.steps || []);

                if (status.status === "completed" || status.status === "failed") {
                    if (pollRef.current) clearInterval(pollRef.current);
                    setIsExecuting(false);
                    setPhase("done");
                    if (status.status === "completed") {
                        toast.success("Workflow completed successfully!");
                    } else {
                        toast.error("Workflow failed — check step details");
                    }
                }
            } catch {
                // Silent retry
            }
        }, 3000);
    };

    // Cleanup polling on unmount
    useEffect(() => {
        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, []);

    // ══════════════════════════════════════════════
    //  RENDER
    // ══════════════════════════════════════════════

    return (
        <div className="fixed inset-0 bg-[#030303] text-white overflow-hidden flex flex-col">
            <style jsx global>{`
                @keyframes wfFadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes wfPulse { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }
                @keyframes wfSlideIn { from { opacity: 0; transform: translateX(-20px); } to { opacity: 1; transform: translateX(0); } }
                @keyframes wfGlow { 0%,100% { box-shadow: 0 0 20px rgba(6, 182, 212, 0.15); } 50% { box-shadow: 0 0 40px rgba(6, 182, 212, 0.3); } }
            `}</style>

            {/* ── Top Bar ── */}
            <div className="relative z-10 h-14 flex items-center justify-between px-8 border-b border-white/[0.04] shrink-0"
                 style={{ animation: "wfFadeUp 0.4s ease both" }}>
                <Link href={`/project/${projectId}`} className="flex items-center gap-2 text-white/30 hover:text-white transition-colors no-underline group">
                    <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
                    <span className="text-[10px] font-bold tracking-[3px] uppercase">Project Hub</span>
                </Link>
                <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-cyan-500/60" style={{ animation: "wfPulse 2s ease infinite" }} />
                    <span className="text-[9px] font-mono text-white/20 uppercase tracking-[3px]">Workflow Lab</span>
                </div>
            </div>

            {/* ── Ambient Background ── */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-20%] right-[-15%] w-[50%] h-[50%] bg-cyan-500/[0.02] rounded-full blur-[120px]" />
                <div className="absolute bottom-[-20%] left-[-10%] w-[40%] h-[40%] bg-violet-500/[0.015] rounded-full blur-[100px]" />
            </div>

            {/* ── Main Content ── */}
            <div className="relative z-10 flex-1 overflow-y-auto">
                <div className="max-w-5xl mx-auto px-8 py-10">

                    {/* ═══ PHASE 1: UPLOAD ═══ */}
                    {phase === "upload" && (
                        <div style={{ animation: "wfFadeUp 0.5s ease both" }}>
                            {/* Title */}
                            <div className="text-center mb-10">
                                <div className="flex items-center justify-center gap-3 mb-4">
                                    <div className="h-[1px] w-12 bg-gradient-to-r from-transparent to-cyan-500/30" />
                                    <span className="text-[9px] font-mono text-cyan-500/40 uppercase tracking-[5px]">Import</span>
                                    <div className="h-[1px] w-12 bg-gradient-to-l from-transparent to-cyan-500/30" />
                                </div>
                                <h1 className="text-4xl md:text-5xl font-['Anton'] uppercase tracking-tight text-white leading-[0.9] mb-3">
                                    Workflow Lab
                                </h1>
                                <p className="text-[12px] text-white/20 max-w-md mx-auto">
                                    Upload your ComfyUI workflow JSON and we&apos;ll translate it into MotionX operations
                                </p>
                            </div>

                            {/* Drop Zone */}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".json"
                                className="hidden"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleFileUpload(file);
                                    e.target.value = "";
                                }}
                            />

                            <div
                                onClick={() => !isAnalyzing && fileInputRef.current?.click()}
                                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
                                onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }}
                                onDrop={handleDrop}
                                className={`
                                    max-w-2xl mx-auto h-[320px] border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-5 transition-all cursor-pointer relative overflow-hidden
                                    ${isDragging
                                        ? "border-cyan-500/60 bg-cyan-500/[0.04] scale-[1.01]"
                                        : "border-white/[0.08] bg-white/[0.01] hover:border-cyan-500/30 hover:bg-white/[0.02]"
                                    }
                                    ${isAnalyzing ? "pointer-events-none opacity-70" : ""}
                                `}
                                style={isDragging ? { animation: "wfGlow 1.5s ease infinite" } : {}}
                            >
                                {isAnalyzing ? (
                                    <>
                                        <Loader2 size={36} className="animate-spin text-cyan-400" />
                                        <div className="text-center">
                                            <span className="text-sm font-bold text-cyan-300 block mb-1">Analyzing Workflow</span>
                                            <span className="text-[9px] font-mono text-cyan-500/60 uppercase tracking-[3px]">
                                                Parsing nodes • Classifying operations • Translating
                                            </span>
                                        </div>
                                        <span className="text-[10px] text-white/20">{fileName}</span>
                                    </>
                                ) : (
                                    <>
                                        <div className={`w-20 h-20 rounded-2xl flex items-center justify-center transition-all ${
                                            isDragging ? "bg-cyan-500/10 border border-cyan-500/30" : "bg-white/[0.03] border border-white/[0.06]"
                                        }`}>
                                            <FileJson size={32} className={isDragging ? "text-cyan-400" : "text-white/20"} />
                                        </div>
                                        <div className="text-center">
                                            <h3 className="text-lg font-bold text-white mb-1">
                                                {isDragging ? "Drop your workflow" : "Upload ComfyUI Workflow"}
                                            </h3>
                                            <p className="text-[10px] text-white/30 font-mono uppercase tracking-widest">.JSON • API or Workflow Format</p>
                                        </div>
                                        <p className="text-[10px] text-white/15 max-w-sm text-center">
                                            Supports 60+ node types: Face Swap, ControlNet, Style Transfer, Upscale, txt2img, img2img, and more
                                        </p>
                                    </>
                                )}
                            </div>

                            {/* Supported workflows chips */}
                            <div className="flex flex-wrap justify-center gap-2 mt-8 max-w-lg mx-auto">
                                {["Face Swap", "De-aging", "Style Transfer", "txt2img", "img2img", "Upscale", "Video V2V", "ControlNet"].map(label => (
                                    <span key={label} className="px-3 py-1.5 rounded-full text-[8px] font-bold tracking-[1px] uppercase bg-white/[0.03] border border-white/[0.06] text-white/25">
                                        {label}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ═══ PHASE 2: PIPELINE PREVIEW ═══ */}
                    {(phase === "preview" && analysis) && (
                        <div style={{ animation: "wfFadeUp 0.5s ease both" }}>
                            {/* Header */}
                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <CheckCircle2 size={16} className="text-cyan-400" />
                                        <h2 className="text-2xl font-['Anton'] uppercase tracking-tight">Pipeline Preview</h2>
                                    </div>
                                    <p className="text-[10px] text-white/30">{analysis.summary}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className={`px-3 py-1 rounded-full text-[8px] font-bold tracking-[2px] uppercase border ${
                                        analysis.heuristic_match
                                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                            : "bg-violet-500/10 text-violet-400 border-violet-500/20"
                                    }`}>
                                        {analysis.heuristic_match ? "⚡ INSTANT MATCH" : "🤖 AI TRANSLATED"}
                                    </span>
                                    <span className="text-[9px] font-mono text-white/20">
                                        {Math.round(analysis.confidence * 100)}% confidence
                                    </span>
                                </div>
                            </div>

                            {/* Warnings */}
                            {analysis.warnings?.length > 0 && (
                                <div className="mb-6 space-y-2">
                                    {analysis.warnings.map((w, i) => (
                                        <div key={i} className="flex items-start gap-2 px-4 py-2.5 bg-amber-500/[0.06] border border-amber-500/20 rounded-lg">
                                            <AlertTriangle size={12} className="text-amber-400 shrink-0 mt-0.5" />
                                            <span className="text-[9px] text-amber-300/80">{w}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Pipeline Steps */}
                            <div className="space-y-3 mb-8">
                                {analysis.operations.map((op, idx) => {
                                    const provColor = PROVIDER_COLORS[op.provider] || { bg: "bg-white/5", text: "text-white/50", border: "border-white/10" };
                                    return (
                                        <div key={idx}
                                            className="relative border border-white/[0.06] bg-white/[0.015] rounded-xl p-5 hover:border-cyan-500/20 transition-all group"
                                            style={{ animation: `wfSlideIn 0.4s ease ${idx * 0.1}s both` }}
                                        >
                                            {/* Step connector line */}
                                            {idx < analysis.operations.length - 1 && (
                                                <div className="absolute left-8 -bottom-3 w-px h-3 bg-gradient-to-b from-white/10 to-transparent" />
                                            )}

                                            <div className="flex items-start gap-4">
                                                {/* Step Number */}
                                                <div className="w-10 h-10 rounded-xl bg-cyan-500/[0.08] border border-cyan-500/20 flex items-center justify-center shrink-0">
                                                    <span className="text-sm font-bold text-cyan-400">{idx + 1}</span>
                                                </div>

                                                {/* Content */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        {/* Type Icon */}
                                                        <span className="text-white/40">{TYPE_ICONS[op.type] || <Sparkles size={14} />}</span>
                                                        <span className="text-xs font-bold text-white uppercase tracking-wide">{op.intent?.replace(/_/g, " ") || op.type}</span>

                                                        {/* Provider Badge */}
                                                        <span className={`px-2 py-0.5 rounded text-[7px] font-bold tracking-[1px] uppercase border ${provColor.bg} ${provColor.text} ${provColor.border}`}>
                                                            {op.provider}
                                                        </span>

                                                        {/* Credits */}
                                                        <span className="ml-auto flex items-center gap-1 text-[9px] font-mono text-amber-400/60">
                                                            <CreditCard size={10} />
                                                            {op.estimated_credits} cr
                                                        </span>
                                                    </div>

                                                    {/* Editable Prompt */}
                                                    <textarea
                                                        value={promptOverrides[idx] ?? op.composed_prompt}
                                                        onChange={(e) => setPromptOverrides(prev => ({ ...prev, [idx]: e.target.value }))}
                                                        className="w-full bg-black/30 border border-white/[0.06] rounded-lg px-3 py-2 text-[10px] text-white/70 placeholder:text-white/20 resize-none focus:outline-none focus:border-cyan-500/30 transition-colors leading-relaxed"
                                                        rows={2}
                                                    />

                                                    {/* Provider Switcher */}
                                                    <div className="flex items-center gap-1.5 mt-2">
                                                        <span className="text-[7px] text-white/20 uppercase tracking-wider mr-1">Provider:</span>
                                                        {["gemini", "seedance-2", "kling"].map(prov => (
                                                            <button
                                                                key={prov}
                                                                onClick={() => setProviderOverrides(prev => ({ ...prev, [idx]: prov }))}
                                                                className={`px-2 py-0.5 rounded text-[7px] font-bold tracking-wider uppercase transition-all border ${
                                                                    (providerOverrides[idx] || op.provider) === prov
                                                                        ? `${PROVIDER_COLORS[prov]?.bg || "bg-white/10"} ${PROVIDER_COLORS[prov]?.text || "text-white"} ${PROVIDER_COLORS[prov]?.border || "border-white/20"}`
                                                                        : "bg-transparent text-white/20 border-white/[0.04] hover:border-white/10"
                                                                }`}
                                                            >
                                                                {prov}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* User Inputs Required */}
                            {analysis.user_inputs_required?.length > 0 && (
                                <div className="mb-8 p-5 border border-white/[0.06] bg-white/[0.015] rounded-xl">
                                    <h3 className="text-xs font-bold text-white uppercase tracking-[2px] mb-4 flex items-center gap-2">
                                        <Upload size={12} className="text-cyan-400" />
                                        Required Inputs
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {analysis.user_inputs_required.map(inp => (
                                            <div key={inp.key} className="relative">
                                                <label className="text-[8px] font-bold text-white/40 uppercase tracking-widest mb-1.5 block">{inp.label}</label>
                                                <input
                                                    type="file"
                                                    accept={inp.type === "video" ? "video/*" : "image/*"}
                                                    className="hidden"
                                                    id={`input-${inp.key}`}
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) handleUserInputUpload(inp.key, file);
                                                        e.target.value = "";
                                                    }}
                                                />
                                                <button
                                                    onClick={() => document.getElementById(`input-${inp.key}`)?.click()}
                                                    disabled={uploadingInputs[inp.key]}
                                                    className={`w-full px-3 py-3 rounded-lg border border-dashed transition-all text-center ${
                                                        userInputs[inp.key]
                                                            ? "border-emerald-500/30 bg-emerald-500/[0.04]"
                                                            : "border-white/10 bg-black/20 hover:border-cyan-500/30"
                                                    }`}
                                                >
                                                    {uploadingInputs[inp.key] ? (
                                                        <Loader2 size={14} className="animate-spin text-cyan-400 mx-auto" />
                                                    ) : userInputs[inp.key] ? (
                                                        <span className="text-[9px] text-emerald-400 flex items-center justify-center gap-1.5">
                                                            <CheckCircle2 size={10} /> Uploaded
                                                        </span>
                                                    ) : (
                                                        <span className="text-[9px] text-white/30">
                                                            Click to upload {inp.type}
                                                        </span>
                                                    )}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Bottom Bar */}
                            <div className="flex items-center justify-between p-5 bg-black/40 border border-white/[0.06] rounded-xl sticky bottom-4">
                                <div className="flex items-center gap-6">
                                    <div>
                                        <span className="text-[7px] font-bold text-white/20 uppercase tracking-widest block">Total Cost</span>
                                        <span className="text-xl font-['Anton'] text-amber-400">
                                            {analysis.total_estimated_credits}
                                            <span className="text-xs text-amber-400/40 ml-1">credits</span>
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-[7px] font-bold text-white/20 uppercase tracking-widest block">Steps</span>
                                        <span className="text-xl font-['Anton'] text-cyan-400">{analysis.operations.length}</span>
                                    </div>
                                    <div>
                                        <span className="text-[7px] font-bold text-white/20 uppercase tracking-widest block">Pipeline</span>
                                        <span className="text-xs font-bold text-white/50 uppercase">{analysis.pipeline_type?.replace(/_/g, " ")}</span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => { setPhase("upload"); setAnalysis(null); }}
                                        className="px-4 py-2.5 rounded-lg border border-white/[0.06] text-[9px] font-bold text-white/40 uppercase tracking-wider hover:bg-white/5 transition-all"
                                    >
                                        Start Over
                                    </button>
                                    <button
                                        onClick={handleExecute}
                                        disabled={isExecuting}
                                        className="px-8 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black text-[10px] font-bold uppercase tracking-[3px] transition-all shadow-[0_0_20px_rgba(6,182,212,0.25)] hover:shadow-[0_0_30px_rgba(6,182,212,0.4)] flex items-center gap-2 disabled:opacity-50"
                                    >
                                        {isExecuting ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                                        Execute Pipeline
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ═══ PHASE 3: EXECUTION MONITOR ═══ */}
                    {(phase === "executing" || phase === "done") && analysis && (
                        <div style={{ animation: "wfFadeUp 0.5s ease both" }}>
                            {/* Header */}
                            <div className="text-center mb-10">
                                <h2 className="text-3xl font-['Anton'] uppercase tracking-tight mb-2">
                                    {phase === "done"
                                        ? overallStatus === "completed" ? "Pipeline Complete" : "Pipeline Failed"
                                        : "Executing Pipeline"
                                    }
                                </h2>
                                <p className="text-[10px] text-white/20 font-mono uppercase tracking-[3px]">
                                    {analysis.summary}
                                </p>
                            </div>

                            {/* Steps Status */}
                            <div className="max-w-2xl mx-auto space-y-4">
                                {analysis.operations.map((op, idx) => {
                                    const status = stepStatuses[idx] || { status: "pending" };
                                    const provColor = PROVIDER_COLORS[op.provider] || { bg: "bg-white/5", text: "text-white/50", border: "border-white/10" };

                                    return (
                                        <div key={idx}
                                            className={`border rounded-xl p-5 transition-all ${
                                                status.status === "completed" ? "border-emerald-500/30 bg-emerald-500/[0.03]"
                                                : status.status === "running" ? "border-cyan-500/30 bg-cyan-500/[0.03]"
                                                : status.status === "failed" ? "border-red-500/30 bg-red-500/[0.03]"
                                                : "border-white/[0.06] bg-white/[0.01]"
                                            }`}
                                            style={{ animation: `wfSlideIn 0.4s ease ${idx * 0.1}s both` }}
                                        >
                                            <div className="flex items-center gap-4">
                                                {/* Status Icon */}
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                                    status.status === "completed" ? "bg-emerald-500/10 border border-emerald-500/20"
                                                    : status.status === "running" ? "bg-cyan-500/10 border border-cyan-500/20"
                                                    : status.status === "failed" ? "bg-red-500/10 border border-red-500/20"
                                                    : "bg-white/[0.03] border border-white/[0.06]"
                                                }`}>
                                                    {status.status === "completed" && <CheckCircle2 size={16} className="text-emerald-400" />}
                                                    {status.status === "running" && <Loader2 size={16} className="animate-spin text-cyan-400" />}
                                                    {status.status === "failed" && <XCircle size={16} className="text-red-400" />}
                                                    {status.status === "pending" && <Clock size={14} className="text-white/20" />}
                                                </div>

                                                {/* Info */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-bold text-white uppercase tracking-wide">
                                                            Step {idx + 1}: {op.intent?.replace(/_/g, " ") || op.type}
                                                        </span>
                                                        <span className={`px-2 py-0.5 rounded text-[7px] font-bold uppercase border ${provColor.bg} ${provColor.text} ${provColor.border}`}>
                                                            {op.provider}
                                                        </span>
                                                    </div>
                                                    <p className="text-[9px] text-white/30 mt-1 truncate">
                                                        {promptOverrides[idx] || op.composed_prompt}
                                                    </p>
                                                    {status.status === "failed" && status.error && (
                                                        <p className="text-[9px] text-red-400/80 mt-1">{status.error}</p>
                                                    )}
                                                </div>

                                                {/* Status Badge */}
                                                <span className={`text-[8px] font-bold uppercase tracking-[2px] ${
                                                    status.status === "completed" ? "text-emerald-400"
                                                    : status.status === "running" ? "text-cyan-400"
                                                    : status.status === "failed" ? "text-red-400"
                                                    : "text-white/15"
                                                }`} style={status.status === "running" ? { animation: "wfPulse 1.5s ease infinite" } : {}}>
                                                    {status.status}
                                                </span>
                                            </div>

                                            {/* Output Preview */}
                                            {status.status === "completed" && status.output_url && (
                                                <div className="mt-3 pt-3 border-t border-white/[0.04] flex items-center gap-3">
                                                    <div className="w-16 h-10 rounded overflow-hidden bg-black border border-white/[0.06]">
                                                        {status.output_url.match(/\.(mp4|webm|mov)/) ? (
                                                            <video src={status.output_url} className="w-full h-full object-cover" muted />
                                                        ) : (
                                                            <img src={status.output_url} alt="Output" className="w-full h-full object-cover" />
                                                        )}
                                                    </div>
                                                    <a href={status.output_url} target="_blank" rel="noopener noreferrer"
                                                       className="text-[8px] text-cyan-400 hover:text-white flex items-center gap-1 transition-colors">
                                                        <ExternalLink size={8} /> View Output
                                                    </a>
                                                    {status.credits_charged !== undefined && (
                                                        <span className="text-[8px] text-amber-400/50 font-mono ml-auto">
                                                            {status.credits_charged} credits used
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Done actions */}
                            {phase === "done" && (
                                <div className="flex justify-center gap-4 mt-8" style={{ animation: "wfFadeUp 0.5s ease 0.3s both" }}>
                                    <button
                                        onClick={() => { setPhase("upload"); setAnalysis(null); setStepStatuses([]); setExecutionId(null); }}
                                        className="px-6 py-2.5 rounded-lg border border-white/[0.06] text-[9px] font-bold text-white/40 uppercase tracking-wider hover:bg-white/5 transition-all flex items-center gap-2"
                                    >
                                        <RotateCcw size={10} /> New Workflow
                                    </button>
                                    <Link href={`/project/${projectId}`}
                                        className="px-6 py-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-[9px] font-bold text-cyan-400 uppercase tracking-wider hover:bg-cyan-500/20 transition-all flex items-center gap-2 no-underline"
                                    >
                                        Back to Project <ArrowRight size={10} />
                                    </Link>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
