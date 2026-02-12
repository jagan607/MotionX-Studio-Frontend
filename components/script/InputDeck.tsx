"use client";

import React, { useState, useRef, useEffect } from "react";
import {
    Upload, Terminal, Sparkles, X, Disc, Cpu, Loader2, Lock,
    ChevronRight, Database, FastForward, ArrowRight, Clock
} from "lucide-react";
import { toast } from "react-hot-toast";
import { api, checkJobStatus } from "@/lib/api";
import { MotionButton } from "@/components/ui/MotionButton";
import { ContextReference } from "@/app/components/script/ContextSelectorModal";

interface InputDeckProps {
    projectId: string;
    projectTitle: string;
    projectType: "movie" | "micro_drama" | "ad";
    episodeId?: string | null;

    initialTitle?: string;
    initialScript?: string;
    initialRuntime?: string | number;

    // Previous Episode Data for Continuity
    previousEpisode?: {
        id: string;
        episode_number: number;
        title: string;
        script_preview: string;
    } | null;

    onSuccess: (redirectUrl: string) => void;
    onCancel: () => void;
    onStatusChange?: (status: string) => void;

    isModal?: boolean;
    className?: string;
    contextReferences?: ContextReference[];
}

export const InputDeck: React.FC<InputDeckProps> = ({
    projectId,
    projectTitle,
    projectType,
    episodeId,
    initialTitle = "",
    initialScript = "",
    initialRuntime = "",
    previousEpisode = null,
    onSuccess,
    onCancel,
    onStatusChange,
    isModal = false,
    className = "",
    contextReferences = []
}) => {
    const [title, setTitle] = useState("");
    const [runtime, setRuntime] = useState<string | number>("");
    const [synopsisText, setSynopsisText] = useState("");
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [pastedScript, setPastedScript] = useState("");
    const [isUploading, setIsUploading] = useState(false);
    const [runtimeError, setRuntimeError] = useState(false);

    // User Instructions for Continuity
    const [continuityInstruction, setContinuityInstruction] = useState("");

    const [logs, setLogs] = useState<string[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const logsContainerRef = useRef<HTMLDivElement>(null);

    // [CHANGED] Group 'ad' and 'movie' as single-unit types
    const isSingleUnit = projectType === "movie" || projectType === "ad";
    const isNewEpisodeMode = !episodeId || episodeId === "new_placeholder";

    // --- SCROLL TO BOTTOM OF LOGS ---
    useEffect(() => {
        if (logsContainerRef.current) {
            logsContainerRef.current.scrollTo({
                top: logsContainerRef.current.scrollHeight,
                behavior: "smooth"
            });
        }
    }, [logs]);

    // --- STATE SYNC ---
    useEffect(() => {
        // [CHANGED] Use isSingleUnit instead of isMovie
        if (isSingleUnit) setTitle(projectTitle);
        else setTitle(initialTitle || "");

        setRuntime(initialRuntime || "");
    }, [isSingleUnit, projectTitle, initialTitle, initialRuntime]);

    useEffect(() => {
        setSynopsisText(initialScript || "");
        setPastedScript("");
        setSelectedFile(null);
    }, [initialScript, episodeId]);

    const isUpdateMode = !!episodeId && !!initialScript && episodeId !== "new_placeholder";

    const isModified =
        (title || "") !== (initialTitle || "") ||
        (runtime || "") !== (initialRuntime || "") ||
        (synopsisText || "") !== (initialScript || "") ||
        !!selectedFile ||
        !!pastedScript;

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) setSelectedFile(e.target.files[0]);
    };

    const addLog = (message: string) => {
        setLogs(prev => {
            if (prev[prev.length - 1] === message) return prev;
            return [...prev, message];
        });
        if (onStatusChange) onStatusChange(message);
    };

    // --- MAIN PROTOCOL EXECUTION ---
    const executeProtocol = async (mode: 'standard' | 'continuity' = 'standard') => {
        // [CHANGED] Validation uses isSingleUnit
        if (!title && !isSingleUnit) { toast.error("ENTER IDENTIFIER (TITLE)"); return; }
        if (!runtime) {
            setRuntimeError(true);
            toast.error("ENTER RUNTIME");
            return;
        }

        const formData = new FormData();
        formData.append("project_id", projectId);
        formData.append("script_title", title || projectTitle);

        if (runtime) {
            formData.append("runtime", String(runtime));
        }

        if (episodeId && episodeId !== "new_placeholder") {
            formData.append("episode_id", episodeId);
        }

        // --- HANDLE CONTINUITY MODE ---
        if (mode === 'continuity' && previousEpisode) {
            addLog("INITIALIZING CONTINUITY PROTOCOL...");
            formData.append("source_type", "continuation");
            formData.append("previous_episode_id", previousEpisode.id);

            if (continuityInstruction.trim()) {
                const instructionBlob = new Blob([continuityInstruction], { type: "text/plain" });
                formData.append("file", new File([instructionBlob], "instruction.txt"));
            } else {
                const defaultBlob = new Blob(["Continue the story naturally from the previous scene."], { type: "text/plain" });
                formData.append("file", new File([defaultBlob], "instruction.txt"));
            }
        }
        // --- HANDLE STANDARD MODE ---
        else {
            if (contextReferences && contextReferences.length > 0) {
                const contextPayload = {
                    references: contextReferences.map(ref => ({
                        source: ref.sourceLabel || "Context Ref",
                        header: ref.header || "Unknown Scene",
                        content: ref.summary || ""
                    }))
                };
                formData.append("smart_context", JSON.stringify(contextPayload));
            }

            if (synopsisText.trim()) {
                const content = `[TYPE: SYNOPSIS/TREATMENT]\n\n${synopsisText}`;
                const blob = new Blob([content], { type: "text/plain" });
                formData.append("file", new File([blob], "synopsis.txt"));
            } else if (pastedScript.trim()) {
                const blob = new Blob([pastedScript], { type: "text/plain" });
                formData.append("file", new File([blob], "terminal_paste.txt"));
            } else if (selectedFile) {
                formData.append("file", selectedFile);
            } else {
                toast.error("PROVIDE INPUT VIA ONE METHOD");
                return;
            }
        }

        setIsUploading(true);
        setLogs([]);
        if (mode === 'standard') addLog("INITIALIZING UPLINK...");

        try {
            const res = await api.post("/api/v1/script/upload-script", formData, {
                headers: { "Content-Type": "multipart/form-data" }
            });

            const jobId = res.data.job_id;
            addLog("PAYLOAD ACCEPTED. JOB ID: " + jobId.substring(0, 8));
            addLog("WAITING FOR WORKER NODE...");

            const pollInterval = setInterval(async () => {
                const job = await checkJobStatus(jobId);

                if (job.progress) {
                    addLog(job.progress.toUpperCase());
                }

                if (job.status === "completed") {
                    clearInterval(pollInterval);
                    addLog("SEQUENCE COMPLETE. REDIRECTING...");
                    if (job.redirect_url) {
                        setTimeout(() => onSuccess(job.redirect_url), 800);
                    } else {
                        toast.error("Redirect coordinates missing.");
                        setIsUploading(false);
                    }
                } else if (job.status === "failed") {
                    clearInterval(pollInterval);
                    setIsUploading(false);
                    addLog("ERROR: " + (job.error || "UNKNOWN FAILURE"));
                    toast.error(job.error || "Ingestion Failed");
                }
            }, 1000);

        } catch (e: any) {
            console.error(e);
            setIsUploading(false);
            const errorMsg = e.response?.data?.detail || e.message;
            addLog("FATAL ERROR: " + errorMsg);
            toast.error(`Protocol Failed: ${errorMsg}`);
        }
    };

    const getButtonText = () => {
        if (isUpdateMode) return isModified ? "MODIFY SCRIPT" : "SCRIPT SYNCED";
        if (synopsisText.trim()) return "GENERATE & INGEST";
        return "INITIALIZE INGESTION";
    };

    const isButtonEnabled = () => {
        if (isUpdateMode) return isModified;
        // [CHANGED] Validation uses isSingleUnit
        if (!title && !isSingleUnit) return false;
        return !!(synopsisText.trim() || pastedScript.trim() || selectedFile);
    };

    return (
        <div className={`flex flex-col bg-neutral-900/30 border border-neutral-800 rounded-xl shadow-2xl ${className}`}>

            <div className="flex flex-col p-6 gap-6">

                {/* DYNAMIC SESSION IDENTIFIER & RUNTIME */}
                <div className="shrink-0 flex gap-4">
                    {/* TITLE INPUT */}
                    <div className="flex-1">
                        <label className="text-[9px] font-mono text-motion-text-muted uppercase tracking-widest mb-2 block">
                            {/* [CHANGED] Label logic */}
                            {isSingleUnit ? "Project Script Title" : "Episode Identifier"}
                        </label>
                        {/* [CHANGED] Render logic uses isSingleUnit */}
                        {isSingleUnit ? (
                            <div className="flex items-center justify-between w-full border-b border-neutral-700 py-2">
                                <span className="text-xl font-display text-white/50 uppercase select-none">
                                    {projectTitle || "UNTITLED PROJECT"}
                                </span>
                                <div className="flex items-center gap-2 text-neutral-600">
                                    <span className="text-[9px] font-mono">LOCKED</span>
                                    <Lock size={14} />
                                </div>
                            </div>
                        ) : (
                            <input
                                className="w-full bg-transparent border-b border-neutral-700 py-2 text-xl font-display text-white placeholder:text-neutral-600 focus:outline-none focus:border-motion-red transition-colors uppercase"
                                placeholder={`ENTER EPISODE TITLE...`}
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                disabled={isUploading}
                            />
                        )}
                    </div>

                    {/* RUNTIME INPUT */}
                    <div className="w-[140px]">
                        <label className="text-[9px] font-mono text-motion-text-muted uppercase tracking-widest mb-2 block flex items-center gap-1">
                            <Clock size={10} /> Runtime (Mins) <span className="text-motion-red">*</span>
                        </label>
                        <input
                            type="number"
                            className={`w-full bg-transparent border-b py-2 text-xl font-mono text-white placeholder:text-neutral-600 focus:outline-none focus:border-motion-red transition-colors ${runtimeError ? 'border-red-500' : 'border-neutral-700'}`}
                            placeholder="e.g 45"
                            value={runtime}
                            onChange={(e) => {
                                setRuntime(e.target.value);
                                if (e.target.value) setRuntimeError(false);
                            }}
                            disabled={isUploading}
                        />
                    </div>
                </div>

                {/* --- 1. CONTINUITY CARD --- */}
                {previousEpisode && isNewEpisodeMode && !isUploading && (
                    <div className="relative group overflow-hidden rounded-lg border border-blue-900/30 bg-blue-950/10 hover:border-blue-600/50 transition-colors">
                        <div className="absolute top-0 left-0 w-1 h-full bg-blue-600" />
                        <div className="p-5">
                            <div className="flex items-center gap-2 mb-2">
                                <FastForward size={14} className="text-blue-400" />
                                <span className="text-[10px] font-bold uppercase tracking-widest text-blue-200">
                                    Continue from {previousEpisode.title || `Episode ${previousEpisode.episode_number}`}
                                </span>
                            </div>

                            <p className="text-[10px] text-blue-200/60 line-clamp-2 font-mono mb-4 pl-1 border-l border-blue-800">
                                "{previousEpisode.script_preview || "No preview available..."}"
                            </p>

                            <div className="flex gap-3">
                                <input
                                    type="text"
                                    className="flex-[2] bg-black/40 border border-blue-900/50 rounded px-4 py-3 text-xs text-white placeholder:text-blue-200/30 focus:outline-none focus:border-blue-500 transition-colors"
                                    placeholder="Enter direction for the next scene..."
                                    value={continuityInstruction}
                                    onChange={(e) => setContinuityInstruction(e.target.value)}
                                />

                                <MotionButton
                                    onClick={() => executeProtocol('continuity')}
                                    disabled={!title}
                                    className="flex-1 bg-blue-900/40 hover:bg-blue-800 border-blue-500/20 text-blue-100/80 px-4 py-3 h-auto text-[10px] shadow-none hover:shadow-lg transition-all"
                                >
                                    AUTO-GENERATE <ArrowRight size={12} className="ml-2" />
                                </MotionButton>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- 2. OR DIVIDER --- */}
                {previousEpisode && isNewEpisodeMode && !isUploading && (
                    <div className="flex items-center gap-4 shrink-0 opacity-50">
                        <div className="flex-1 h-px bg-neutral-800"></div>
                        <span className="text-[9px] font-bold tracking-widest text-neutral-500">OR START FRESH</span>
                        <div className="flex-1 h-px bg-neutral-800"></div>
                    </div>
                )}

                {/* --- 3. STANDARD GENERATION --- */}
                <div className={`flex flex-col ${previousEpisode && isNewEpisodeMode ? 'opacity-80 hover:opacity-100 transition-opacity' : ''}`}>
                    <div className="flex items-center justify-between mb-2 shrink-0">
                        <div className="flex items-center gap-2">
                            <Sparkles size={14} className="text-motion-red" />
                            <span className="text-[10px] font-bold tracking-[1px] uppercase text-white">Manual Generation</span>
                            <span className="text-[9px] text-motion-text-muted">PRIMARY</span>
                        </div>

                        {contextReferences.length > 0 && (
                            <div className="flex items-center gap-1 text-[9px] font-bold text-blue-400 bg-blue-900/20 px-2 py-0.5 rounded border border-blue-900/50">
                                <Database size={10} />
                                {contextReferences.length} REFS ACTIVE
                            </div>
                        )}
                    </div>

                    <div className="relative h-[200px]">
                        <textarea
                            className="w-full h-full bg-black/40 border border-neutral-700 p-4 font-sans text-sm text-motion-text placeholder:text-neutral-600 focus:outline-none focus:border-motion-red resize-none leading-relaxed rounded-lg"
                            placeholder={contextReferences.length > 0
                                ? "Describe the next events (AI will use context references)..."
                                : "Describe your scene..."}
                            value={synopsisText}
                            onChange={(e) => setSynopsisText(e.target.value)}
                            disabled={isUploading}
                        />
                        <div className="absolute bottom-3 right-3 flex items-center gap-2 text-[9px] font-mono text-motion-red bg-motion-red/10 px-2 py-1 rounded">
                            <Cpu size={10} /> STORY_ENGINE_V2
                        </div>
                    </div>
                </div>

                {/* SECONDARY INPUTS */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 shrink-0">
                    <div onClick={() => !isUploading && fileInputRef.current?.click()} className={`h-16 border border-dashed border-neutral-700 flex flex-col items-center justify-center gap-2 group rounded-lg transition-all ${isUploading ? 'opacity-50 cursor-not-allowed' : 'hover:border-neutral-500 cursor-pointer hover:bg-white/5'}`}>
                        <input type="file" ref={fileInputRef} hidden onChange={handleFileSelect} accept=".pdf,.docx,.txt" disabled={isUploading} />
                        {selectedFile ? (
                            <div className="text-[10px] font-bold text-white truncate max-w-[150px]">{selectedFile.name}</div>
                        ) : (
                            <div className="flex items-center gap-2 text-[10px] text-neutral-600 group-hover:text-neutral-400">
                                <Upload size={12} /> UPLOAD FILE
                            </div>
                        )}
                    </div>
                    <textarea
                        className="w-full h-16 bg-black/30 border border-neutral-700 p-3 font-mono text-[10px] text-green-500 placeholder:text-green-900/50 focus:outline-none focus:border-green-600 resize-none leading-relaxed rounded-lg"
                        placeholder="// PASTE..."
                        value={pastedScript}
                        onChange={(e) => setPastedScript(e.target.value)}
                        disabled={isUploading}
                    />
                </div>

                {isModal && (
                    <div className="mt-4 pt-4 border-t border-neutral-800">
                        <button onClick={onCancel} className="w-full py-2 flex items-center justify-center gap-2 text-[10px] font-bold tracking-widest text-motion-text-muted hover:text-motion-red transition-colors">
                            <X size={14} /> ABORT
                        </button>
                    </div>
                )}
            </div>

            {/* FOOTER */}
            <div className="shrink-0 p-4 border-t border-neutral-800 bg-black/30 min-h-[5.5rem] flex flex-col justify-center">
                {isUploading ? (
                    <div className="w-full h-32 bg-black border border-neutral-800 rounded p-3 font-mono text-[10px] overflow-hidden flex flex-col">
                        <div className="flex items-center justify-between text-neutral-500 mb-2 pb-1 border-b border-neutral-900">
                            <span className="flex items-center gap-2"><Loader2 className="animate-spin" size={10} /> PROCESSING</span>
                            <span>SEQ_ID_{Math.floor(Math.random() * 1000)}</span>
                        </div>
                        <div ref={logsContainerRef} className="flex-1 overflow-y-auto space-y-1 scrollbar-hide">
                            {logs.map((log, i) => (
                                <div key={i} className="flex gap-2 text-neutral-400">
                                    <span className="text-neutral-700">➜</span>
                                    <span className={i === logs.length - 1 ? "text-green-500 animate-pulse" : ""}>
                                        {log}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <MotionButton
                        onClick={() => executeProtocol('standard')}
                        disabled={!isButtonEnabled()}
                        className="w-full py-3"
                    >
                        {getButtonText()}
                    </MotionButton>
                )}
            </div>
        </div>
    );
};