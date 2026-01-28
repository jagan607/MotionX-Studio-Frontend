"use client";

import React, { useState, useRef } from "react";
import {
    Upload, Terminal, Sparkles, X, Disc, Cpu, Loader2
} from "lucide-react";
import { toast } from "react-hot-toast";
import { api, checkJobStatus } from "@/lib/api";
import { MotionButton } from "@/components/ui/MotionButton";

interface InputDeckProps {
    projectId: string;
    onSuccess: (redirectUrl: string) => void;
    onCancel: () => void;
    isModal?: boolean;
    className?: string;
}

export const InputDeck: React.FC<InputDeckProps> = ({
    projectId, onSuccess, onCancel, isModal = false, className = ""
}) => {
    const [title, setTitle] = useState("");

    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [pastedScript, setPastedScript] = useState("");
    const [synopsisText, setSynopsisText] = useState("");

    const [isUploading, setIsUploading] = useState(false);
    const [statusText, setStatusText] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) setSelectedFile(e.target.files[0]);
    };

    // Smart submission: prioritize synopsis > paste > upload
    const executeProtocol = async () => {
        if (!title) { toast.error("ENTER IDENTIFIER (TITLE)"); return; }

        const formData = new FormData();
        formData.append("project_id", projectId);
        formData.append("script_title", title);

        // Priority: Synopsis > Paste > Upload
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

        setIsUploading(true);
        setStatusText("INITIALIZING UPLINK...");

        try {
            const res = await api.post("api/v1/script/upload-script", formData, {
                headers: { "Content-Type": "multipart/form-data" }
            });

            const jobId = res.data.job_id;
            setStatusText("AI ANALYZING SCRIPT STRUCTURE...");

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

    // Determine button text based on which input has content
    const getButtonText = () => {
        if (synopsisText.trim()) return "GENERATE & INGEST";
        return "INITIALIZE INGESTION";
    };

    // Determine if button should be enabled
    const isButtonEnabled = () => {
        if (!title) return false;
        return synopsisText.trim() || pastedScript.trim() || selectedFile;
    };

    return (
        <div className={`flex flex-col bg-neutral-900/30 border border-neutral-800 rounded-xl shadow-2xl h-full ${className}`}>

            {/* CONTENT - NO SCROLL */}
            <div className="flex-1 flex flex-col p-6 min-h-0">

                {/* SESSION IDENTIFIER */}
                <div className="mb-6 shrink-0">
                    <label className="text-[9px] font-mono text-motion-text-muted uppercase tracking-widest mb-2 block">
                        Session Identifier
                    </label>
                    <input
                        className="w-full bg-transparent border-b border-neutral-700 py-2 text-xl font-display text-white placeholder:text-neutral-600 focus:outline-none focus:border-motion-red transition-colors uppercase"
                        placeholder="ENTER SCENE / EPISODE TITLE..."
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        disabled={isUploading}
                        autoFocus
                    />
                </div>

                {/* PRIMARY: AI GENERATION */}
                <div className="mb-5 flex-1 flex flex-col min-h-0">
                    <div className="flex items-center gap-2 mb-2 shrink-0">
                        <Sparkles size={14} className="text-motion-red" />
                        <span className="text-[10px] font-bold tracking-[1px] uppercase text-white">AI Generation</span>
                        <span className="text-[9px] text-motion-text-muted ml-auto">PRIMARY</span>
                    </div>
                    <div className="relative h-[200px]">
                        <textarea
                            className="w-full h-full bg-black/40 border border-neutral-700 p-4 font-sans text-sm text-motion-text placeholder:text-neutral-600 focus:outline-none focus:border-motion-red resize-none leading-relaxed rounded-lg"
                            placeholder="Describe your scene... (e.g., A cyberpunk detective chases a rogue android through a neon-lit market...)"
                            value={synopsisText}
                            onChange={(e) => setSynopsisText(e.target.value)}
                            disabled={isUploading}
                        />
                        <div className="absolute bottom-3 right-3 flex items-center gap-2 text-[9px] font-mono text-motion-red bg-motion-red/10 px-2 py-1 rounded">
                            <Cpu size={10} /> STORY_ENGINE_V2
                        </div>
                    </div>
                </div>

                {/* OR DIVIDER */}
                <div className="flex items-center gap-4 my-4 shrink-0">
                    <div className="flex-1 h-px bg-neutral-800"></div>
                    <span className="text-[10px] font-bold tracking-widest text-neutral-500">OR</span>
                    <div className="flex-1 h-px bg-neutral-800"></div>
                </div>

                {/* SECONDARY: UPLOAD & PASTE - Side by Side */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 shrink-0">

                    {/* DATA UPLOAD */}
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <Upload size={12} className="text-neutral-500" />
                            <span className="text-[10px] font-bold tracking-[1px] uppercase text-neutral-400">Data Upload</span>
                        </div>
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className="h-20 border border-dashed border-neutral-700 hover:border-neutral-500 hover:bg-white/5 transition-all cursor-pointer flex flex-col items-center justify-center gap-2 group rounded-lg">
                            <input type="file" ref={fileInputRef} hidden onChange={handleFileSelect} accept=".pdf,.docx,.txt" />
                            {selectedFile ? (
                                <div className="text-center animate-in fade-in zoom-in">
                                    <Disc size={16} className="text-motion-red mb-1 animate-spin-slow mx-auto" />
                                    <div className="font-bold text-[10px] tracking-widest text-white truncate max-w-[150px]">{selectedFile.name}</div>
                                </div>
                            ) : (
                                <>
                                    <Upload size={16} className="text-neutral-600 group-hover:text-neutral-400 transition-colors" />
                                    <div className="text-[9px] font-bold tracking-widest text-neutral-600 group-hover:text-neutral-400">
                                        CLICK TO UPLOAD
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* TERMINAL PASTE */}
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <Terminal size={12} className="text-neutral-500" />
                            <span className="text-[10px] font-bold tracking-[1px] uppercase text-neutral-400">Terminal Paste</span>
                        </div>
                        <textarea
                            className="w-full h-20 bg-black/30 border border-neutral-700 p-3 font-mono text-[11px] text-green-500 placeholder:text-green-900/50 focus:outline-none focus:border-green-600 resize-none leading-relaxed rounded-lg"
                            placeholder="// PASTE SCRIPT..."
                            value={pastedScript}
                            onChange={(e) => setPastedScript(e.target.value)}
                            disabled={isUploading}
                        />
                    </div>
                </div>

                {/* ABORT BUTTON (Modal only) */}
                {isModal && (
                    <div className="mt-4 pt-4 border-t border-neutral-800">
                        <button
                            onClick={onCancel}
                            className="w-full py-2 flex items-center justify-center gap-2 text-[10px] font-bold tracking-widest text-motion-text-muted hover:text-motion-red transition-colors"
                        >
                            <X size={14} /> ABORT SEQUENCE
                        </button>
                    </div>
                )}
            </div>

            {/* FOOTER: Fixed at bottom */}
            <div className="shrink-0 p-4 border-t border-neutral-800 bg-black/30">
                {isUploading && (
                    <div className="flex justify-between items-center text-[10px] font-mono text-motion-red mb-2">
                        <span className="animate-pulse">{statusText}</span>
                        <Loader2 className="animate-spin" size={12} />
                    </div>
                )}

                <MotionButton
                    onClick={executeProtocol}
                    loading={isUploading}
                    disabled={!isButtonEnabled()}
                    className="w-full py-3"
                >
                    {getButtonText()}
                </MotionButton>
            </div>
        </div>
    );
};