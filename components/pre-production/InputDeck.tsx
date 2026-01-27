"use client";

import React, { useState, useRef } from "react";
import {
    Upload, Terminal, Sparkles, X, Disc, Cpu, Loader2, FileText, ArrowRight
} from "lucide-react";
import { toast } from "react-hot-toast";
import { api, checkJobStatus } from "@/lib/api";
import { MotionButton } from "@/components/ui/MotionButton";

type InputMethod = 'upload' | 'paste' | 'synopsis';

interface InputDeckProps {
    projectId: string;
    onSuccess: (redirectUrl: string) => void;
    onCancel: () => void;
    isModal?: boolean; // Toggles 'Abort' button visibility
}

export const InputDeck: React.FC<InputDeckProps> = ({ projectId, onSuccess, onCancel, isModal = false }) => {
    // --- STATE ---
    const [inputMethod, setInputMethod] = useState<InputMethod>('upload');
    const [title, setTitle] = useState("");

    // Input Data
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [pastedScript, setPastedScript] = useState("");
    const [synopsisText, setSynopsisText] = useState("");

    // Processing
    const [isUploading, setIsUploading] = useState(false);
    const [statusText, setStatusText] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- HANDLERS ---
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) setSelectedFile(e.target.files[0]);
    };

    const executeProtocol = async () => {
        if (!title) { toast.error("ENTER IDENTIFIER (TITLE)"); return; }

        // 1. Prepare Payload
        const formData = new FormData();
        formData.append("project_id", projectId);
        formData.append("script_title", title);

        if (inputMethod === 'upload') {
            if (!selectedFile) { toast.error("NO FILE SELECTED"); return; }
            formData.append("file", selectedFile);
        }
        else if (inputMethod === 'paste') {
            if (!pastedScript.trim()) { toast.error("BUFFER EMPTY"); return; }
            const blob = new Blob([pastedScript], { type: "text/plain" });
            formData.append("file", new File([blob], "terminal_paste.txt"));
        }
        else if (inputMethod === 'synopsis') {
            if (!synopsisText.trim()) { toast.error("SYNOPSIS EMPTY"); return; }
            const content = `[TYPE: SYNOPSIS/TREATMENT]\n\n${synopsisText}`;
            const blob = new Blob([content], { type: "text/plain" });
            formData.append("file", new File([blob], "synopsis.txt"));
        }

        // 2. Execute
        setIsUploading(true);
        setStatusText("INITIALIZING UPLINK...");

        try {
            // Step A: Upload & Trigger Job
            // Axios handles FormData Content-Type automatically, but we can be explicit
            const res = await api.post("/api/v1/script/upload-script", formData, {
                headers: { "Content-Type": "multipart/form-data" }
            });

            const jobId = res.data.job_id;
            setStatusText("AI ANALYZING SCRIPT STRUCTURE...");

            // Step B: Poll for Completion
            const pollInterval = setInterval(async () => {
                const job = await checkJobStatus(jobId);

                if (job.progress && job.status !== "completed") {
                    setStatusText(job.progress.toUpperCase());
                }

                if (job.status === "completed") {
                    clearInterval(pollInterval);
                    if (job.redirect_url) {
                        onSuccess(job.redirect_url);
                    } else {
                        toast.error("Redirect coordinates missing.");
                        setIsUploading(false);
                    }
                } else if (job.status === "failed") {
                    clearInterval(pollInterval);
                    setIsUploading(false);
                    toast.error(job.error || "Ingestion Failed");
                }
            }, 2000);

        } catch (e: any) {
            console.error(e);
            setIsUploading(false);
            const errorMsg = e.response?.data?.detail || e.message;
            toast.error(`Protocol Failed: ${errorMsg}`);
        }
    };

    // --- RENDER HELPERS ---
    const MenuOption = ({ id, icon: Icon, label }: { id: InputMethod, icon: any, label: string }) => (
        <button
            onClick={() => setInputMethod(id)}
            className={`
        w-full flex items-center gap-3 px-4 py-3 mb-2 text-[10px] font-bold tracking-[1px] uppercase transition-all
        ${inputMethod === id
                    ? 'bg-motion-surface border-l-2 border-motion-red text-white'
                    : 'text-motion-text-muted hover:bg-motion-surface/50 hover:text-motion-text'}
      `}
        >
            <Icon size={14} className={inputMethod === id ? "text-motion-red" : "text-current"} />
            {label}
        </button>
    );

    return (
        <div className="w-[900px] h-[600px] bg-motion-bg border border-motion-border flex shadow-[0_0_100px_rgba(0,0,0,0.8)] relative overflow-hidden mx-auto">
            {/* SCANLINE EFFECT */}
            <div className="absolute inset-0 pointer-events-none z-10 opacity-10 bg-[linear-gradient(to_bottom,transparent_50%,rgba(0,0,0,0.5)_50%)] bg-[length:100%_4px]" />

            {/* SIDEBAR */}
            <div className="w-[260px] bg-[#080808] border-r border-motion-border p-6 flex flex-col justify-between z-20">
                <div>
                    <div className="text-[9px] text-motion-text-muted font-bold tracking-[2px] mb-6">INPUT PROTOCOL</div>
                    <MenuOption id="upload" icon={Upload} label="Data Upload" />
                    <MenuOption id="paste" icon={Terminal} label="Terminal Paste" />
                    <MenuOption id="synopsis" icon={Sparkles} label="AI Generation" />
                </div>

                {isModal && (
                    <button
                        onClick={onCancel}
                        className="flex items-center gap-2 text-[10px] font-bold tracking-widest text-motion-text-muted hover:text-motion-red transition-colors"
                    >
                        <X size={14} /> ABORT SEQUENCE
                    </button>
                )}
            </div>

            {/* CONTENT AREA */}
            <div className="flex-1 bg-motion-bg/95 p-10 flex flex-col z-20 relative">

                {/* IDENTIFIER INPUT */}
                <div className="mb-8">
                    <input
                        className="w-full bg-transparent border-b border-motion-border py-4 text-2xl font-display text-white placeholder:text-motion-text-muted/50 focus:outline-none focus:border-motion-red transition-colors uppercase"
                        placeholder="ENTER SCENE/EPISODE IDENTIFIER..."
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        disabled={isUploading}
                        autoFocus
                    />
                </div>

                {/* DYNAMIC INPUT AREA */}
                <div className="flex-1 mb-8 relative">
                    {inputMethod === 'upload' && (
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className="h-full border border-dashed border-motion-border hover:border-motion-text hover:bg-motion-surface/50 transition-all cursor-pointer flex flex-col items-center justify-center gap-4 group"
                        >
                            <input type="file" ref={fileInputRef} hidden onChange={handleFileSelect} accept=".pdf,.docx,.txt" />
                            {selectedFile ? (
                                <div className="text-center animate-in fade-in zoom-in">
                                    <Disc size={40} className="text-motion-red mb-4 animate-spin-slow mx-auto" />
                                    <div className="font-bold text-sm tracking-widest text-white">{selectedFile.name}</div>
                                    <div className="text-[10px] text-motion-text-muted mt-2">READY FOR DECRYPTION</div>
                                </div>
                            ) : (
                                <>
                                    <Upload size={32} className="text-motion-text-muted group-hover:text-motion-text transition-colors" />
                                    <div className="text-[10px] font-bold tracking-widest text-motion-text-muted">DRAG SCRIPT FILE OR CLICK</div>
                                </>
                            )}
                        </div>
                    )}

                    {inputMethod === 'paste' && (
                        <textarea
                            className="w-full h-full bg-[#090909] border border-motion-border p-6 font-mono text-xs text-[#00FF41] placeholder:text-green-900 focus:outline-none resize-none leading-relaxed"
                            placeholder="// PASTE RAW SCRIPT DATA HERE..."
                            value={pastedScript}
                            onChange={(e) => setPastedScript(e.target.value)}
                            disabled={isUploading}
                        />
                    )}

                    {inputMethod === 'synopsis' && (
                        <div className="h-full flex flex-col">
                            <textarea
                                className="flex-1 bg-[#090909] border border-motion-border p-6 font-sans text-sm text-motion-text placeholder:text-motion-text-muted focus:outline-none resize-none leading-relaxed mb-3"
                                placeholder="Describe the sequence... (e.g., A cyberpunk detective chases a rogue android through a neon market...)"
                                value={synopsisText}
                                onChange={(e) => setSynopsisText(e.target.value)}
                                disabled={isUploading}
                            />
                            <div className="flex items-center gap-2 text-[10px] font-mono text-motion-red">
                                <Cpu size={12} /> AI AGENT ACTIVE: STORY_ENGINE_V2
                            </div>
                        </div>
                    )}
                </div>

                {/* FOOTER ACTIONS */}
                <div className="mt-auto">
                    {isUploading && (
                        <div className="flex justify-between items-center text-[10px] font-mono text-motion-red mb-3">
                            <span className="animate-pulse">{statusText}</span>
                            <Loader2 className="animate-spin" size={12} />
                        </div>
                    )}

                    <MotionButton
                        onClick={executeProtocol}
                        loading={isUploading}
                        disabled={!title || (inputMethod === 'upload' && !selectedFile)}
                    >
                        {inputMethod === 'synopsis' ? "GENERATE & INGEST" : "INITIALIZE INGESTION"}
                    </MotionButton>
                </div>
            </div>
        </div>
    );
};