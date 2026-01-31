"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { InputDeck } from "@/components/script/InputDeck";
import {
    ArrowLeft, Terminal, ShieldCheck, Cpu, HardDrive,
    Zap, Clapperboard, CheckCircle2,
    Loader2
} from "lucide-react";
import { fetchProject } from "@/lib/api";
import { Project } from "@/lib/types";
import Link from "next/link";

export default function ScriptIngestionPage() {
    const params = useParams();
    const router = useRouter();
    const projectId = params.id as string;

    const [project, setProject] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);
    const [timecode, setTimecode] = useState("00:00:00:00");

    // Timecode logic
    useEffect(() => {
        const interval = setInterval(() => {
            const now = new Date();
            const ms = Math.floor(now.getMilliseconds() / 10).toString().padStart(2, '0');
            const s = now.getSeconds().toString().padStart(2, '0');
            const m = now.getMinutes().toString().padStart(2, '0');
            const h = now.getHours().toString().padStart(2, '0');
            setTimecode(`${h}:${m}:${s}:${ms}`);
        }, 40);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const loadProjectData = async () => {
            if (!projectId) return;
            try {
                const data = await fetchProject(projectId);
                setProject(data);
            } catch (error) {
                console.error("Failed to load project details", error);
            } finally {
                setLoading(false);
            }
        };
        loadProjectData();
    }, [projectId]);

    return (
        <div className="fixed inset-0 z-50 bg-[#020202] text-white font-sans overflow-hidden flex flex-col">

            {/* --- CINEMATIC STYLES --- */}
            <style jsx global>{`
                /* 1. BUTTON FIX: Solid Red, High Contrast */
                button[type="submit"], 
                .deck-root button {
                    background-color: #DC2626 !important;
                    background-image: none !important;
                    border: 1px solid #EF4444 !important;
                    color: white !important;
                    font-weight: 900 !important;
                    letter-spacing: 2px !important;
                    text-transform: uppercase !important;
                    padding: 20px !important;
                    box-shadow: 0 0 30px rgba(220, 38, 38, 0.4) !important;
                    border-radius: 4px !important;
                    margin-top: 24px !important;
                }
                button[type="submit"]:hover,
                .deck-root button:hover {
                    background-color: #B91C1C !important;
                    box-shadow: 0 0 50px rgba(220, 38, 38, 0.6) !important;
                    transform: scale(1.01);
                }

                /* 2. INPUT DECK RESETS: Remove floating card look */
                .deck-root > div {
                    background: transparent !important;
                    border: none !important;
                    box-shadow: none !important;
                    padding: 0 !important;
                    max-width: 100% !important;
                }

                /* 3. TEXTAREA STYLING: Code Editor Feel */
                textarea {
                    background-color: rgba(10, 10, 10, 0.6) !important;
                    border: 1px solid #333 !important;
                    color: #E0E0E0 !important;
                    font-family: 'Courier New', monospace !important;
                    font-size: 14px !important;
                    line-height: 1.6 !important;
                    padding: 20px !important;
                    border-radius: 4px !important;
                    backdrop-filter: blur(10px);
                }
                textarea:focus {
                    border-color: #777 !important;
                    background-color: rgba(20, 20, 20, 0.8) !important;
                    outline: none !important;
                }

                /* 4. UPLOAD BOX STYLING */
                input[type="file"], .upload-box {
                    border: 2px dashed #333 !important;
                    background: rgba(255, 255, 255, 0.03) !important;
                    border-radius: 6px !important;
                    transition: all 0.3s ease;
                }
                input[type="file"]:hover, .upload-box:hover {
                    border-color: #666 !important;
                    background: rgba(255, 255, 255, 0.05) !important;
                }
                
                /* 5. SVG ICON FIX: Prevent giant icons */
                svg {
                    max-width: 48px; 
                    max-height: 48px;
                }
            `}</style>

            {/* --- HEADER --- */}
            <header className="h-20 bg-transparent flex items-center justify-between px-8 z-50 relative border-b border-white/5">
                <div className="flex items-center gap-8">
                    <Link href="/dashboard" className="flex items-center gap-3 text-neutral-400 hover:text-white transition-colors group">
                        <div className="p-2 bg-white/5 rounded group-hover:bg-white/10 transition-colors">
                            <ArrowLeft size={16} />
                        </div>
                        <span className="text-xs font-bold tracking-[0.2em] uppercase">Abort</span>
                    </Link>

                    <div className="h-8 w-[1px] bg-white/10" />

                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <div className="w-2.5 h-2.5 bg-red-600 rounded-full animate-pulse z-10 relative" />
                            <div className="absolute inset-0 bg-red-600 blur-sm animate-pulse" />
                        </div>
                        <span className="text-xs font-mono text-red-500 font-bold tracking-widest uppercase">REC {timecode}</span>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-green-900/20 border border-green-900/30 rounded text-[10px] font-bold text-green-500 tracking-wider">
                        <CheckCircle2 size={12} />
                        SYSTEM SECURE
                    </div>
                </div>
            </header>

            {/* --- MAIN LAYOUT --- */}
            <div className="flex-1 flex overflow-hidden relative z-40">

                {/* Background Spotlights */}
                <div className="absolute top-[-20%] left-[-10%] w-[800px] h-[800px] bg-red-600/5 rounded-full blur-[150px] pointer-events-none" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[800px] h-[800px] bg-blue-600/5 rounded-full blur-[150px] pointer-events-none" />

                {/* LEFT: INFO PANEL (Frosted Glass) */}
                <div className="w-[360px] border-r border-white/5 flex flex-col shrink-0 relative bg-black/40 backdrop-blur-xl">
                    <div className="p-10 border-b border-white/5">
                        <div className="text-[10px] font-bold text-neutral-500 uppercase mb-4 flex items-center gap-2 tracking-widest">
                            <Clapperboard size={14} className="text-red-600" /> Target Project
                        </div>
                        <h1 className="text-4xl font-display font-bold uppercase text-white leading-[0.9] mb-4 tracking-tight shadow-black drop-shadow-lg">
                            {project?.title || "UNTITLED"}
                        </h1>
                        <span className="inline-block px-3 py-1 bg-white/5 border border-white/10 text-[10px] font-mono text-white/70 uppercase tracking-widest rounded">
                            {project?.type?.replace('_', ' ') || "N/A"}
                        </span>
                    </div>

                    <div className="p-10 space-y-10">
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 text-[11px] font-bold text-white uppercase tracking-widest">
                                <Terminal size={14} className="text-red-500" /> Ingestion Protocol
                            </div>
                            <p className="text-xs text-neutral-400 leading-relaxed pl-4 border-l-2 border-red-600/30">
                                This terminal accepts raw screenplay data. The Neural Engine will parse headers, action lines, and dialogue blocks automatically.
                            </p>
                        </div>

                        <div className="p-5 bg-gradient-to-br from-white/5 to-transparent border border-white/5 rounded-lg">
                            <div className="flex items-center gap-3 mb-2">
                                <Cpu size={18} className="text-white" />
                                <span className="text-xs font-bold text-white uppercase tracking-wider">Analysis Engine</span>
                            </div>
                            <div className="text-[10px] text-neutral-500">
                                Waiting for data stream...
                            </div>
                        </div>
                    </div>

                    <div className="mt-auto p-6 border-t border-white/5 bg-black/60 flex justify-between">
                        <div className="flex items-center gap-2 text-[10px] text-neutral-500 font-mono">
                            <ShieldCheck size={12} /> ENCRYPTED
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-neutral-500 font-mono">
                            <HardDrive size={12} /> LOCAL
                        </div>
                    </div>
                </div>

                {/* RIGHT: INTERACTIVE CONSOLE */}
                <div className="flex-1 flex flex-col relative bg-black/20">

                    {/* Top Status Bar */}
                    <div className="h-12 border-b border-white/5 flex items-center justify-between px-8 bg-black/20">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
                            <Zap size={12} className="text-yellow-500" /> Live Data Feed
                        </div>
                        <div className="text-[10px] font-mono text-neutral-600">INPUT_STREAM_READY</div>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 overflow-y-auto p-12 flex flex-col items-center">
                        <div className="w-full max-w-4xl relative z-10">

                            {/* Glass Panel Container for InputDeck */}
                            <div className="bg-[#050505]/80 border border-white/10 rounded-xl p-8 shadow-2xl backdrop-blur-md deck-root relative group">

                                {/* Glowing Border Effect on Hover */}
                                <div className="absolute -inset-[1px] bg-gradient-to-r from-red-600/0 via-red-600/20 to-red-600/0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                                <div className="flex justify-between items-end mb-8 pb-4 border-b border-white/5">
                                    <h2 className="text-xl font-bold text-white uppercase tracking-tight">Data Entry</h2>
                                    <div className="text-[10px] font-mono text-neutral-500">UPLOAD OR PASTE</div>
                                </div>

                                {loading ? (
                                    <div className="flex flex-col items-center justify-center py-32 gap-4">
                                        <Loader2 className="w-8 h-8 animate-spin text-red-600" />
                                        <span className="text-xs font-mono text-neutral-500 tracking-widest">INITIALIZING...</span>
                                    </div>
                                ) : (
                                    <InputDeck
                                        projectId={projectId}
                                        projectTitle={project?.title || ""}
                                        projectType={project?.type || "micro_drama"}
                                        isModal={false}
                                        className="w-full"
                                        onCancel={() => router.push("/dashboard")}
                                        onSuccess={(url) => router.push(url)}
                                    />
                                )}
                            </div>

                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}