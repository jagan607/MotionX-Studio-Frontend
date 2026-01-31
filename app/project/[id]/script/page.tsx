"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { InputDeck } from "@/components/script/InputDeck";
import {
    ArrowLeft, Terminal, ShieldCheck, Cpu, HardDrive,
    Zap, Clapperboard, CheckCircle2,
    Loader2, Layers, ChevronDown, Film
} from "lucide-react";
import { fetchProject, fetchEpisodes } from "@/lib/api";
import { Project } from "@/lib/types";
import Link from "next/link";
import { toast } from "react-hot-toast";

export default function ScriptIngestionPage() {
    const params = useParams();
    const router = useRouter();
    const projectId = params.id as string;

    const [project, setProject] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);
    const [timecode, setTimecode] = useState("00:00:00:00");

    // SERIES STATE
    const [episodes, setEpisodes] = useState<any[]>([]);
    const [selectedEpisodeId, setSelectedEpisodeId] = useState<string | null>(null);

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
        const loadData = async () => {
            if (!projectId) return;
            try {
                const proj = await fetchProject(projectId);
                setProject(proj);

                // ALWAYS fetch episodes (containers) to get script data
                // Even movies have a "main" episode container that holds the script_preview
                const epsData = await fetchEpisodes(projectId);
                let eps = Array.isArray(epsData) ? epsData : (epsData.episodes || []);

                if (proj.type === 'movie') {
                    // Movie Logic: Load the episodes so we can access the data
                    setEpisodes(eps);

                    // Auto-select the default episode (usually "main" or the only one present)
                    const targetId = proj.default_episode_id || "main";
                    const found = eps.find((e: any) => e.id === targetId);
                    setSelectedEpisodeId(found ? found.id : (eps[0]?.id || targetId));
                } else {
                    // Series Logic: Sort and Filter
                    eps = eps.sort((a: any, b: any) => (a.episode_number || 0) - (b.episode_number || 0));

                    // Hide ghost episode if real content exists
                    const realEpisodes = eps.filter((e: any) => e.synopsis !== "Initial setup");
                    const finalEpisodes = realEpisodes.length > 0 ? realEpisodes : eps;

                    setEpisodes(finalEpisodes);

                    // Default to first available episode
                    if (finalEpisodes.length > 0) {
                        setSelectedEpisodeId(finalEpisodes[0].id);
                    }
                }
            } catch (error) {
                console.error("Failed to load project details", error);
                toast.error("Failed to load project data");
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [projectId]);

    const handleEpisodeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectedEpisodeId(e.target.value);
        toast.success(`Switched to ${e.target.options[e.target.selectedIndex].text}`);
    };

    // --- HELPER: GET CURRENT EPISODE DATA ---
    const activeEpisode = episodes.find(e => e.id === selectedEpisodeId);

    // Title: Movies use Project Title, Series use Episode Title
    const currentTitle = project?.type === 'movie' ? (project.title) : (activeEpisode?.title || "");

    // Script: Always pull from the active container (Works for both Movie "main" and Series episodes)
    const currentScript = activeEpisode?.script_preview || "";

    return (
        <div className="fixed inset-0 z-50 bg-[#020202] text-white font-sans overflow-hidden flex flex-col">

            {/* --- CINEMATIC STYLES --- */}
            <style jsx global>{`
                button[type="submit"], .deck-root button[type="submit"] {
                    background-color: #DC2626 !important;
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
                button[type="submit"]:hover {
                    background-color: #B91C1C !important;
                    box-shadow: 0 0 50px rgba(220, 38, 38, 0.6) !important;
                    transform: scale(1.01);
                }
                .deck-root > div {
                    background: transparent !important;
                    border: none !important;
                    box-shadow: none !important;
                    padding: 0 !important;
                    max-width: 100% !important;
                }
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
                svg { max-width: 48px; max-height: 48px; }
            `}</style>

            {/* --- HEADER --- */}
            <header className="h-20 bg-transparent flex items-center justify-between px-8 z-50 relative border-b border-white/5">
                <div className="flex items-center gap-8">
                    <button
                        onClick={() => router.push("/dashboard")}
                        className="flex items-center gap-3 text-neutral-400 hover:text-white transition-colors group"
                    >
                        <div className="p-2 bg-white/5 rounded group-hover:bg-white/10 transition-colors">
                            <ArrowLeft size={16} />
                        </div>
                        <span className="text-xs font-bold tracking-[0.2em] uppercase">Abort</span>
                    </button>

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

                <div className="absolute top-[-20%] left-[-10%] w-[800px] h-[800px] bg-red-600/5 rounded-full blur-[150px] pointer-events-none" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[800px] h-[800px] bg-blue-600/5 rounded-full blur-[150px] pointer-events-none" />

                {/* LEFT: INFO PANEL */}
                <div className="w-[360px] border-r border-white/5 flex flex-col shrink-0 relative bg-black/40 backdrop-blur-xl">
                    <div className="p-10 border-b border-white/5">
                        <div className="text-[10px] font-bold text-neutral-500 uppercase mb-4 flex items-center gap-2 tracking-widest">
                            <Clapperboard size={14} className="text-red-600" /> Target Project
                        </div>
                        <h1 className="text-3xl font-display font-bold uppercase text-white leading-[0.9] mb-4 tracking-tight shadow-black drop-shadow-lg break-words">
                            {project?.title || "UNTITLED"}
                        </h1>
                        <div className="flex items-center gap-2 mb-6">
                            <span className="inline-block px-3 py-1 bg-white/5 border border-white/10 text-[10px] font-mono text-white/70 uppercase tracking-widest rounded">
                                {project?.type?.replace('_', ' ') || "N/A"}
                            </span>
                        </div>

                        {/* EPISODE SELECTOR (Dropdown) */}
                        {/* Only show for non-movies OR if we want debugging access to movie containers */}
                        {project?.type !== 'movie' && (
                            <div className="animate-in fade-in slide-in-from-left-4 duration-500">
                                <div className="text-[10px] font-bold text-neutral-500 uppercase mb-2 flex items-center gap-2 tracking-widest">
                                    <Layers size={14} /> Active Reel
                                </div>
                                <div className="relative group">
                                    <select
                                        value={selectedEpisodeId || ""}
                                        onChange={handleEpisodeChange}
                                        className="w-full appearance-none bg-black/50 border border-white/10 text-white text-xs font-mono uppercase tracking-wider py-3 pl-4 pr-10 rounded-lg hover:border-red-600/50 hover:bg-white/5 focus:outline-none focus:border-red-600 transition-all cursor-pointer"
                                    >
                                        {episodes.map((ep) => (
                                            <option key={ep.id} value={ep.id} className="bg-[#050505] text-neutral-300">
                                                {ep.title || `EPISODE ${ep.episode_number}`}
                                            </option>
                                        ))}
                                        {episodes.length === 0 && <option disabled>No Reels Available</option>}
                                    </select>
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-500 group-hover:text-white transition-colors">
                                        <ChevronDown size={14} />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="p-10 space-y-10">
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 text-[11px] font-bold text-white uppercase tracking-widest">
                                <Terminal size={14} className="text-red-500" /> Ingestion Protocol
                            </div>
                            <p className="text-xs text-neutral-400 leading-relaxed pl-4 border-l-2 border-red-600/30">
                                This terminal accepts raw screenplay data. The Neural Engine will parse headers, action lines, and dialogue blocks automatically.
                                {project?.type !== 'movie' && " Ensure the correct reel is selected above."}
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
                    <div className="h-12 border-b border-white/5 flex items-center justify-between px-8 bg-black/20">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
                            <Zap size={12} className="text-yellow-500" /> Live Data Feed
                        </div>
                        <div className="text-[10px] font-mono text-neutral-600">INPUT_STREAM_READY</div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-12 flex flex-col items-center">
                        <div className="w-full max-w-4xl relative z-10">
                            {/* Glass Panel Container for InputDeck */}
                            <div className="bg-[#050505]/80 border border-white/10 rounded-xl p-8 shadow-2xl backdrop-blur-md deck-root relative group">
                                {/* Glowing Border Effect on Hover */}
                                <div className="absolute -inset-[1px] bg-gradient-to-r from-red-600/0 via-red-600/20 to-red-600/0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                                <div className="flex justify-between items-end mb-8 pb-4 border-b border-white/5">
                                    <div>
                                        <h2 className="text-xl font-bold text-white uppercase tracking-tight">Data Entry</h2>
                                        {project?.type !== 'movie' && (
                                            <div className="text-[10px] font-mono text-neutral-500 mt-1 flex items-center gap-1">
                                                TARGET: <Film size={10} />
                                                <span className="text-white">
                                                    {episodes.find(e => e.id === selectedEpisodeId)?.title || "UNKNOWN REEL"}
                                                </span>
                                            </div>
                                        )}
                                    </div>
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
                                        episodeId={selectedEpisodeId}

                                        // PASS INITIAL DATA HERE
                                        initialTitle={currentTitle}
                                        initialScript={currentScript}

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