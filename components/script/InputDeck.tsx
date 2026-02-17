"use client";

import React, { useState, useRef, useEffect } from "react";
import {
    Upload, Terminal, Sparkles, X, Disc, Cpu, Loader2, Lock,
    ChevronRight, Database, FastForward, ArrowRight, Clock,
    FileText, Clipboard, AlertCircle, CheckCircle2
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
    onOpenContextModal?: () => void;

    // Episode Switching
    episodes?: any[];
    onSwitchEpisode?: (id: string) => void;
}

type InputMethod = 'ai' | 'upload' | 'paste' | 'current';

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
    contextReferences = [],
    onOpenContextModal,
    episodes = [],
    onSwitchEpisode
}) => {
    // --- STATE ---
    const [title, setTitle] = useState("");
    const [runtime, setRuntime] = useState<string | number>("");

    // Input Methods State
    const [activeTab, setActiveTab] = useState<InputMethod>('ai');
    const [synopsisText, setSynopsisText] = useState("");
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [pastedScript, setPastedScript] = useState("");

    // Validation & Processing State
    const [isUploading, setIsUploading] = useState(false);
    const [runtimeError, setRuntimeError] = useState(false);
    const [titleError, setTitleError] = useState(false);

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
        // If there's an existing script, default to the 'current' tab to show it
        // Keep AI assistant textarea clean for fresh prompts
        if (initialScript) {
            setActiveTab('current');
        } else {
            setActiveTab('ai');
        }
        // Clear AI synopsis when switching episodes
        setSynopsisText("");
        setPastedScript("");
        setSelectedFile(null);
    }, [initialScript, episodeId]);

    const isUpdateMode = !!episodeId && !!initialScript && episodeId !== "new_placeholder";

    // Check modification based on active tab
    const hasNewContent =
        (activeTab === 'ai' && !!synopsisText.trim()) ||
        (activeTab === 'upload' && !!selectedFile) ||
        (activeTab === 'paste' && !!pastedScript.trim());

    const isModified =
        (title || "") !== (initialTitle || "") ||
        (runtime || "") !== (initialRuntime || "") ||
        hasNewContent;

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

    const handleTabChange = (tab: InputMethod) => {
        if (isUploading) return;
        setActiveTab(tab);
    };

    // Derived: whether an existing script is available for the 'current' tab
    const hasExistingScript = !!initialScript && isUpdateMode;

    // --- MAIN PROTOCOL EXECUTION ---
    const executeProtocol = async (mode: 'standard' | 'continuity' = 'standard') => {
        // 1. VALIDATION
        let isValid = true;

        if (!title && !isSingleUnit) {
            setTitleError(true);
            isValid = false;
        } else {
            setTitleError(false);
        }

        if (!runtime) {
            setRuntimeError(true);
            isValid = false;
        } else {
            setRuntimeError(false);
        }

        if (!isValid) {
            toast.error("Please fill in all required fields", { icon: "🚨" });
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

            // Only send data from the active tab
            if (activeTab === 'ai') {
                if (!synopsisText.trim()) {
                    toast.error("Please enter a synopsis or story description");
                    return;
                }
                const content = `[TYPE: SYNOPSIS/TREATMENT]\n\n${synopsisText}`;
                const blob = new Blob([content], { type: "text/plain" });
                formData.append("file", new File([blob], "synopsis.txt"));
            }
            else if (activeTab === 'paste') {
                if (!pastedScript.trim()) {
                    toast.error("Please paste your script text");
                    return;
                }
                const blob = new Blob([pastedScript], { type: "text/plain" });
                formData.append("file", new File([blob], "terminal_paste.txt"));
            }
            else if (activeTab === 'upload') {
                if (!selectedFile) {
                    toast.error("Please select a file to upload");
                    return;
                }
                formData.append("file", selectedFile);
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
            addLog("Payload received. Job ID: " + jobId.substring(0, 8));
            addLog("Waiting for worker node...");

            const pollInterval = setInterval(async () => {
                const job = await checkJobStatus(jobId);

                if (job.progress) {
                    addLog(job.progress); // Removed .toUpperCase() for friendlier logs
                }

                if (job.status === "completed") {
                    clearInterval(pollInterval);
                    addLog("Sequence complete. Redirecting...");
                    if (job.redirect_url) {
                        setTimeout(() => onSuccess(job.redirect_url), 800);
                    } else {
                        toast.error("Redirect coordinates missing.");
                        setIsUploading(false);
                    }
                } else if (job.status === "failed") {
                    clearInterval(pollInterval);
                    setIsUploading(false);
                    addLog("Error: " + (job.error || "Unknown Failure"));
                    toast.error(job.error || "Ingestion Failed");
                }
            }, 1000);

        } catch (e: any) {
            console.error(e);
            setIsUploading(false);
            const errorMsg = e.response?.data?.detail || e.message;
            addLog("Fatal Error: " + errorMsg);
            toast.error(`Protocol Failed: ${errorMsg}`);
        }
    };

    const getButtonText = () => {
        if (activeTab === 'current') return "Script Up to Date";
        if (activeTab === 'ai') return "Generate Script";
        if (activeTab === 'upload') return "Upload & Process";
        if (activeTab === 'paste') return "Process Script";
        return "Initialize";
    };

    // Helper to determine if we should enable the submit button
    const isButtonEnabled = () => {
        // Must have runtime
        if (!runtime) return false;

        // Multi-episode must have title
        if (!title && !isSingleUnit) return false;

        // Current tab is read-only, no submission from it
        if (activeTab === 'current') return false;

        // Active tab must have content
        if (activeTab === 'ai' && !synopsisText.trim()) return false;
        if (activeTab === 'upload' && !selectedFile) return false;
        if (activeTab === 'paste' && !pastedScript.trim()) return false;

        return true;
    };

    // --- RENDERERS ---

    const renderTabs = () => (
        <div className="flex items-center gap-1 p-1 bg-black/20 border border-white/5 rounded-lg mb-4">
            {/* Show 'Current Script' tab only when an existing script is present */}
            {hasExistingScript && (
                <button
                    onClick={() => handleTabChange('current')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 text-[10px] font-bold uppercase tracking-wider rounded transition-all
                        ${activeTab === 'current' ? 'bg-white/10 text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/5'}
                    `}
                >
                    <FileText size={12} className={activeTab === 'current' ? "text-green-400" : ""} />
                    Current Script
                </button>
            )}
            <button
                onClick={() => handleTabChange('ai')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-[10px] font-bold uppercase tracking-wider rounded transition-all
                    ${activeTab === 'ai' ? 'bg-white/10 text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/5'}
                `}
            >
                <Sparkles size={12} className={activeTab === 'ai' ? "text-motion-red" : ""} />
                AI Assistant
            </button>
            <button
                onClick={() => handleTabChange('upload')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-[10px] font-bold uppercase tracking-wider rounded transition-all
                    ${activeTab === 'upload' ? 'bg-white/10 text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/5'}
                `}
            >
                <Upload size={12} />
                Upload File
            </button>
            <button
                onClick={() => handleTabChange('paste')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-[10px] font-bold uppercase tracking-wider rounded transition-all
                    ${activeTab === 'paste' ? 'bg-white/10 text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/5'}
                `}
            >
                <Clipboard size={12} />
                Paste Script
            </button>
        </div>
    );

    return (
        <div className={`flex flex-col bg-neutral-900/30 border border-neutral-800 rounded-xl shadow-2xl ${className}`}>

            <div className="flex flex-col p-6 gap-6">

                {/* --- 1. MANDATORY FIELDS (TITLE & RUNTIME) --- */}
                <div className="shrink-0 flex gap-4 items-start">
                    {/* TITLE INPUT / DROPDOWN */}
                    <div className="flex-1">
                        <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                            Title
                            {/* Dynamic: hide REQUIRED when field is filled or single unit */}
                            {(!title && !isSingleUnit) && (
                                <span className="text-red-500 bg-red-950/30 px-1.5 rounded text-[8px] border border-red-900/30 animate-in fade-in duration-200">REQUIRED</span>
                            )}
                            {(!!title || isSingleUnit) && (
                                <CheckCircle2 size={12} className="text-green-600 animate-in fade-in duration-200" />
                            )}
                        </label>

                        {isSingleUnit ? (
                            <div className="flex items-center justify-between w-full border-b border-neutral-700 py-2 group cursor-help relative">
                                <span className="text-xl font-display text-white/50 uppercase select-none">
                                    {projectTitle || "Untitled Project"}
                                </span>
                                <div className="flex items-center gap-2 text-neutral-600">
                                    <span className="text-[9px] font-mono">LOCKED</span>
                                    <Lock size={14} />
                                </div>
                                {/* Tooltip */}
                                <div className="absolute top-full left-0 mt-2 w-max px-2 py-1 bg-neutral-800 text-neutral-400 text-[9px] rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                    Title inherited from project settings
                                </div>
                            </div>
                        ) : (
                            // EPISODIC: Check if we have episodes to show a dropdown
                            (episodes && episodes.length > 0 && onSwitchEpisode) ? (
                                <div className="relative">
                                    <select
                                        className={`w-full bg-transparent border-b py-2 text-xl font-display text-white focus:outline-none focus:border-motion-red transition-colors uppercase appearance-none cursor-pointer
                                            ${titleError ? 'border-red-500/50' : 'border-neutral-700'}
                                        `}
                                        value={isNewEpisodeMode ? 'new' : episodeId || 'new'}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === 'new') {
                                                onSwitchEpisode('new');
                                            } else {
                                                onSwitchEpisode(val);
                                            }
                                        }}
                                        disabled={isUploading}
                                    >
                                        <option value="new" className="bg-neutral-900 text-white font-bold">+ Create New Episode</option>
                                        {episodes.map(ep => (
                                            <option key={ep.id} value={ep.id} className="bg-neutral-900 text-white">
                                                {ep.title || `Episode ${ep.episode_number}`}
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronRight className="absolute right-0 top-3 text-neutral-500 pointer-events-none rotate-90" size={14} />

                                    {/* If NEW selected, we might still want to edit the title? 
                                        Actually, for 'New', we probably want a text input. 
                                        But the request says "dropdown here itself". 
                                        Hybrid approach: Dropdown selects context. If 'new', we might need a separate input for the NEW title.
                                        But usually, 'New Episode' implies we are creating one. 
                                        Let's keep it simple: Dropdown selects WHICH episode.
                                        If 'new' is selected, we show a secondary input for the title below or ideally, the dropdown IS the selector, and we have an input for the title.
                                        
                                        Wait, if I select "Ep 1", I am EDITING Ep 1. I can't change its title here easily without proper write-back.
                                        Let's assume this dropdown REPLACES the title input for *switching* context.
                                        BUT user still needs to NAME a new episode.
                                        
                                        So: 
                                        1. Dropdown to Switch Context.
                                        2. If 'new', Input for Title.
                                        3. If 'existing', Input for Title (to rename) or just Display? The current flow allows renaming.
                                    */}

                                    {/* Let's render the Title Input BELOW the dropdown if we are in 'New' mode, OR if we want to allow renaming. 
                                        Actually, "giving a dropdown" might mean REPLACING the text input with a selector.
                                        But we need to output a string 'title'.
                                        
                                        Best UX:
                                        Row 1: "Editing: [Dropdown]"
                                        Row 2: "Title Input" (pre-filled)
                                        
                                        But to save space, let's keep the Input. The dropdown can be a small switcher nearby.
                                        OR, the user request: "drop down here itself" means the main input becomes a dropdown.
                                        
                                        If I select "New", the value is "New Episode"? No.
                                        
                                        Let's try a hybrid: 
                                        The main field is the Title Input.
                                        But we add a small "Switch Episode" dropdown above or beside it?
                                        
                                        Re-reading: "give an dropdown here itself if project type is episodic".
                                        
                                        Let's go with:
                                        Label: "Episode"
                                        Component: Dropdown [New Episode, Ep 1, Ep 2...]
                                        
                                        IF 'New Episode' selected -> Show "Title" input.
                                        IF 'Ep 1' selected -> Show "Title" input (pre-filled, editable).
                                    */}
                                </div>
                            ) : (
                                // Fallback standard input
                                <div className="relative">
                                    <input
                                        className={`w-full bg-transparent border-b py-2 text-xl font-display text-white placeholder:text-neutral-700 focus:outline-none focus:border-motion-red transition-colors uppercase
                                            ${titleError ? 'border-red-500/50' : 'border-neutral-700'}
                                        `}
                                        placeholder="e.g. The Pilot"
                                        value={title}
                                        onChange={(e) => {
                                            setTitle(e.target.value);
                                            if (e.target.value) setTitleError(false);
                                        }}
                                        disabled={isUploading}
                                    />
                                    {titleError && <AlertCircle className="absolute right-0 top-3 text-red-500 animate-pulse" size={14} />}
                                </div>
                            )
                        )}

                        {/* Secondary Title Input for Episodic (when dropdown is present) */}
                        {!isSingleUnit && episodes && episodes.length > 0 && onSwitchEpisode && (
                            <div className="mt-2 animate-in fade-inSlide-in-from-top-1">
                                <input
                                    className="w-full bg-transparent border-b border-neutral-800 py-1 text-sm font-display text-neutral-300 placeholder:text-neutral-700 focus:outline-none focus:border-neutral-600 transition-colors uppercase"
                                    placeholder={isNewEpisodeMode ? "Name your new episode..." : "Rename episode..."}
                                    value={title}
                                    onChange={(e) => {
                                        setTitle(e.target.value);
                                        if (e.target.value) setTitleError(false);
                                    }}
                                    disabled={isUploading}
                                />
                            </div>
                        )}
                    </div>

                    {/* RUNTIME INPUT */}
                    <div className="w-[160px]">
                        <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                            Runtime
                            {/* Dynamic: hide REQUIRED when field is filled */}
                            {!runtime && (
                                <span className="text-red-500 bg-red-950/30 px-1.5 rounded text-[8px] border border-red-900/30 animate-in fade-in duration-200">REQUIRED</span>
                            )}
                            {!!runtime && (
                                <CheckCircle2 size={12} className="text-green-600 animate-in fade-in duration-200" />
                            )}
                        </label>
                        <div className="relative">
                            <input
                                type="number"
                                className={`w-full bg-transparent border-b py-2 text-xl font-mono text-white placeholder:text-neutral-700 focus:outline-none focus:border-motion-red transition-colors 
                                    ${runtimeError ? 'border-red-500/50 text-red-100' : 'border-neutral-700'}
                                `}
                                placeholder="mins"
                                value={runtime}
                                onChange={(e) => {
                                    setRuntime(e.target.value);
                                    if (e.target.value) setRuntimeError(false);
                                }}
                                disabled={isUploading}
                            />
                            {runtimeError && <AlertCircle className="absolute right-0 top-3 text-red-500 animate-pulse" size={14} />}
                            <span className="absolute right-0 top-3 text-[10px] text-neutral-600 font-mono pointer-events-none right-6">MINS</span>
                        </div>
                    </div>
                </div>

                {/* --- CONTINUITY CARD --- */}
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

                {/* DIVIDER if Continuity exists */}
                {previousEpisode && isNewEpisodeMode && !isUploading && (
                    <div className="flex items-center gap-4 shrink-0 opacity-50">
                        <div className="flex-1 h-px bg-neutral-800"></div>
                        <span className="text-[9px] font-bold tracking-widest text-neutral-500">OR WRITE A NEW SCRIPT</span>
                        <div className="flex-1 h-px bg-neutral-800"></div>
                    </div>
                )}

                {/* DIVIDER for standard flow */}
                {(!previousEpisode || !isNewEpisodeMode) && (
                    <div className="h-px bg-white/5 w-full my-1" />
                )}

                {/* DIVIDER for standard flow */}
                {(!previousEpisode || !isNewEpisodeMode) && (
                    <div className="h-px bg-white/5 w-full my-1" />
                )}



                {/* --- 2. INPUT TABS --- */}
                {renderTabs()}

                {/* --- 3. INPUT CONTENT --- */}

                {/* D. CURRENT SCRIPT TAB (read-only preview) */}
                {activeTab === 'current' && hasExistingScript && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] text-neutral-400">
                                This is the current script for this episode. Switch to another tab to replace it.
                            </span>
                            <span className="text-[9px] font-bold text-green-500 bg-green-900/20 px-2 py-0.5 rounded border border-green-900/50 flex items-center gap-1">
                                <CheckCircle2 size={10} /> SYNCED
                            </span>
                        </div>
                        <div className="relative h-[240px]">
                            <textarea
                                className="w-full h-full bg-black/20 border border-neutral-800 p-4 font-mono text-xs text-neutral-300 resize-none leading-relaxed rounded-lg cursor-default"
                                value={initialScript}
                                readOnly
                            />
                        </div>
                    </div>
                )}

                {/* A. AI ASSISTANT TAB */}
                {activeTab === 'ai' && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] text-neutral-400">
                                Describe your story, characters, and setting. Our AI will generate a formatted screenplay.
                            </span>
                            {contextReferences.length > 0 && (
                                <div className="flex items-center gap-1 text-[9px] font-bold text-blue-400 bg-blue-900/20 px-2 py-0.5 rounded border border-blue-900/50">
                                    <Database size={10} />
                                    {contextReferences.length} ACTIVE
                                </div>
                            )}
                        </div>
                        <div className="relative h-[240px]">
                            <textarea
                                className="w-full h-full bg-black/40 border border-neutral-700 p-4 font-sans text-sm text-motion-text placeholder:text-neutral-600 focus:outline-none focus:border-motion-red resize-none leading-relaxed rounded-lg transition-colors"
                                placeholder={contextReferences.length > 0
                                    ? "Describe the next events including character actions and dialogue..."
                                    : "e.g. Interior apartment, day. Two friends discuss the future of AI..."}
                                value={synopsisText}
                                onChange={(e) => setSynopsisText(e.target.value)}
                                disabled={isUploading}
                            />

                            {/* NEW CONTEXT MATRIX LOCATION - FLOATING ACTION */}
                            {onOpenContextModal && (
                                <div className="absolute top-3 right-3 flex items-center gap-2">
                                    {contextReferences.length > 0 && (
                                        <div className="flex items-center gap-1">
                                            {contextReferences.slice(0, 2).map(ref => (
                                                <span key={ref.id} className="text-[8px] font-mono bg-blue-900/30 text-blue-200 px-1.5 py-0.5 rounded border border-blue-500/20 backdrop-blur-sm">
                                                    {ref.sourceLabel}
                                                </span>
                                            ))}
                                            {contextReferences.length > 2 && (
                                                <span className="text-[8px] font-mono bg-blue-900/30 text-blue-200 px-1.5 py-0.5 rounded border border-blue-500/20 backdrop-blur-sm">
                                                    +{contextReferences.length - 2}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                    <button
                                        onClick={onOpenContextModal}
                                        className="flex items-center gap-1.5 text-[9px] font-bold text-blue-400 hover:text-white bg-black/60 hover:bg-blue-900/60 pl-2 pr-2.5 py-1 rounded-full border border-blue-900/30 transition-all backdrop-blur-sm uppercase shadow-lg"
                                        title="Configure AI Context Memory"
                                    >
                                        <Database size={10} />
                                        {contextReferences.length > 0 ? "Edit Context" : "Add Context"}
                                    </button>
                                </div>
                            )}
                            {/* Subtle branding */}
                            <div className="absolute bottom-3 right-3 flex items-center gap-2 text-[9px] font-mono text-neutral-700">
                                <Cpu size={10} /> AI_ENGINE_READY
                            </div>
                        </div>
                    </div>
                )}

                {/* B. UPLOAD TAB */}
                {activeTab === 'upload' && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div
                            onClick={() => !isUploading && fileInputRef.current?.click()}
                            className={`
                                h-[240px] border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-4 transition-all cursor-pointer relative overflow-hidden
                                ${isUploading ? 'opacity-50 cursor-not-allowed border-neutral-800' : 'hover:border-neutral-500 hover:bg-white/5 border-neutral-800 bg-black/20'}
                                ${selectedFile ? 'border-green-900/50 bg-green-900/5' : ''}
                            `}
                        >
                            <input type="file" ref={fileInputRef} hidden onChange={handleFileSelect} accept=".pdf,.docx,.txt" disabled={isUploading} />

                            {selectedFile ? (
                                <>
                                    <div className="w-16 h-16 rounded-full bg-green-900/20 flex items-center justify-center text-green-500 mb-2">
                                        <FileText size={32} />
                                    </div>
                                    <div className="text-center">
                                        <div className="text-sm font-bold text-white mb-1">{selectedFile.name}</div>
                                        <div className="text-[10px] font-mono text-green-400 uppercase tracking-wider">
                                            {(selectedFile.size / 1024).toFixed(1)} KB • READY TO UPLOAD
                                        </div>
                                    </div>
                                    <div className="absolute top-4 right-4 text-green-500">
                                        <CheckCircle2 size={20} />
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="w-16 h-16 rounded-full bg-[#111] flex items-center justify-center text-neutral-600 group-hover:text-white transition-colors">
                                        <Upload size={24} />
                                    </div>
                                    <div className="text-center">
                                        <h3 className="text-sm font-bold text-white mb-1">Click to Upload Script</h3>
                                        <p className="text-[10px] text-neutral-500 font-mono uppercase tracking-widest">PDF • DOCX • TXT</p>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* C. PASTE TAB */}
                {activeTab === 'paste' && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] text-neutral-400">
                                Paste your screenplay text directly. Standard screenplay formatting is recommended but not required.
                            </span>
                        </div>
                        <textarea
                            className="w-full h-[240px] bg-black/40 border border-neutral-700 p-4 font-mono text-xs text-green-100 placeholder:text-neutral-700 focus:outline-none focus:border-green-600 resize-none leading-relaxed rounded-lg"
                            placeholder="INT. COFFEE SHOP - DAY..."
                            value={pastedScript}
                            onChange={(e) => setPastedScript(e.target.value)}
                            disabled={isUploading}
                        />
                    </div>
                )}


            </div>

            {/* FOOTER */}
            <div className="shrink-0 p-4 border-t border-neutral-800 bg-black/30 min-h-[5.5rem] flex flex-col justify-center rounded-b-xl">
                {isUploading ? (
                    <div className="w-full h-32 bg-black border border-neutral-800 rounded p-4 font-mono text-[10px] overflow-hidden flex flex-col ring-1 ring-white/5">
                        <div className="flex items-center justify-between text-neutral-500 mb-2 pb-2 border-b border-neutral-900">
                            <span className="flex items-center gap-2 text-white"><Loader2 className="animate-spin text-motion-red" size={12} /> Processing your script...</span>
                        </div>
                        <div ref={logsContainerRef} className="flex-1 overflow-y-auto space-y-1.5 scrollbar-hide">
                            {logs.map((log, i) => (
                                <div key={i} className="flex gap-2 text-neutral-400">
                                    <span className="text-neutral-700">➜</span>
                                    <span className={i === logs.length - 1 ? "text-green-400 font-bold" : ""}>
                                        {log}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="flex gap-3">
                        {isModal && (
                            <button
                                onClick={onCancel}
                                className="px-6 py-4 rounded-lg bg-neutral-800/50 hover:bg-neutral-800 text-[10px] font-bold tracking-widest text-neutral-400 hover:text-white transition-colors uppercase"
                            >
                                Cancel
                            </button>
                        )}
                        <MotionButton
                            onClick={() => executeProtocol('standard')}
                            className={`flex-1 py-4 text-xs tracking-widest font-bold ${activeTab === 'current' ? 'opacity-60' : ''}`}
                            disabled={!isButtonEnabled()}
                        >
                            {getButtonText()} {activeTab !== 'current' && <ArrowRight size={14} className="ml-2" />}
                        </MotionButton>
                    </div>
                )}
            </div>
        </div>
    );
};