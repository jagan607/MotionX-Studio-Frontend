"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { InputDeck } from "@/components/script/InputDeck";
import {
    Terminal, ShieldCheck, Cpu, HardDrive,
    Zap, Clapperboard, Layers, ChevronDown, Film, Plus,
    Loader2, Edit3, AlertCircle
} from "lucide-react";
import { fetchProject, fetchEpisodes } from "@/lib/api";
import { Project } from "@/lib/types";
import { toast } from "react-hot-toast";
import { collection, getDocs, limit, query } from "firebase/firestore";
import { db } from "@/lib/firebase";

// --- LAYOUT COMPONENTS ---
import { StudioLayout } from "@/app/components/studio/StudioLayout";
import { StudioHeader } from "@/app/components/studio/StudioHeader";
import { ProjectSettingsModal } from "@/app/components/studio/ProjectSettingsModal";

export default function ScriptIngestionPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const projectId = params.id as string;

    // --- DATA STATE ---
    const [project, setProject] = useState<Project | null>(null);
    const [episodes, setEpisodes] = useState<any[]>([]);
    const [selectedEpisodeId, setSelectedEpisodeId] = useState<string | null>(null);

    // --- UI STATE ---
    const [loading, setLoading] = useState(true);
    const [activeStatus, setActiveStatus] = useState<string>("Waiting for data stream...");
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // --- GATEWAY STATE (Safety Check) ---
    const [hasExistingScenes, setHasExistingScenes] = useState(false);
    const [checkingScenes, setCheckingScenes] = useState(false);

    // 1. LOAD PROJECT & EPISODES
    useEffect(() => {
        const loadData = async () => {
            if (!projectId) return;
            try {
                const proj = await fetchProject(projectId);
                setProject(proj);

                const epsData = await fetchEpisodes(projectId);
                let eps = Array.isArray(epsData) ? epsData : (epsData.episodes || []);

                if (proj.type === 'movie') {
                    setEpisodes(eps);
                    const targetId = proj.default_episode_id || "main";
                    const found = eps.find((e: any) => e.id === targetId);
                    setSelectedEpisodeId(found ? found.id : (eps[0]?.id || targetId));
                } else {
                    eps = eps.sort((a: any, b: any) => (a.episode_number || 0) - (b.episode_number || 0));
                    const realEpisodes = eps.filter((e: any) => e.synopsis !== "Initial setup");
                    const finalEpisodes = realEpisodes.length > 0 ? realEpisodes : eps;
                    setEpisodes(finalEpisodes);

                    // Handle "New Mode" or Default Selection
                    if (searchParams.get("mode") === "new") {
                        setSelectedEpisodeId(null);
                    } else if (finalEpisodes.length > 0) {
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
    }, [projectId, searchParams]);

    // 2. CHECK FOR EXISTING SCENES (Gateway Logic)
    useEffect(() => {
        const checkScenes = async () => {
            if (!selectedEpisodeId || selectedEpisodeId === "new_placeholder") {
                setHasExistingScenes(false);
                return;
            }

            setCheckingScenes(true);
            try {
                const q = query(collection(db, "projects", projectId, "episodes", selectedEpisodeId, "scenes"), limit(1));
                const snap = await getDocs(q);

                const exists = !snap.empty;
                setHasExistingScenes(exists);

                if (exists) {
                    setActiveStatus("Active sequence detected.");
                } else {
                    setActiveStatus("Waiting for data stream...");
                }
            } catch (e) {
                console.error("Scene check failed", e);
            } finally {
                setCheckingScenes(false);
            }
        };

        checkScenes();
    }, [selectedEpisodeId, projectId]);

    // --- HANDLERS ---
    const handleEpisodeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        if (val === "new_placeholder") return;
        setSelectedEpisodeId(val);
        toast.success(`Switched to ${e.target.options[e.target.selectedIndex].text}`);
    };

    const handleNewEpisode = () => {
        setSelectedEpisodeId(null);
        setActiveStatus("Ready for new sequence...");
        setHasExistingScenes(false);
        toast("New Sequence Initialized", { icon: '✨' });
    };

    const handleIngestStatus = (status: string) => {
        setActiveStatus(status);
    };

    const handleUpdateProject = (updatedProject: Project) => {
        setProject(updatedProject);
    };

    const activeEpisode = episodes.find(e => e.id === selectedEpisodeId);
    const currentTitle = project?.type === 'movie' ? (project.title) : (activeEpisode?.title || "");
    const currentScript = activeEpisode?.script_preview || "";

    if (loading || !project) {
        return (
            <div className="fixed inset-0 bg-[#050505] flex items-center justify-center text-red-600 gap-3">
                <Loader2 className="animate-spin" />
                <span className="font-mono text-xs tracking-widest">INITIALIZING TERMINAL...</span>
            </div>
        );
    }

    return (
        <StudioLayout>
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

            {/* --- STUDIO HEADER --- */}
            <StudioHeader
                projectId={projectId}
                projectTitle={project.title}
                activeEpisodeId={selectedEpisodeId || ""}
                onOpenSettings={() => setIsSettingsOpen(true)}
            />

            {/* --- SETTINGS MODAL --- */}
            <ProjectSettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                project={project}
                onUpdate={handleUpdateProject}
            />

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
                            {project.title}
                        </h1>
                        <div className="flex items-center gap-2 mb-6">
                            <span className="inline-block px-3 py-1 bg-white/5 border border-white/10 text-[10px] font-mono text-white/70 uppercase tracking-widest rounded">
                                {project.type?.replace('_', ' ') || "N/A"}
                            </span>
                        </div>

                        {/* EPISODE SELECTOR */}
                        {project.type !== 'movie' && (
                            <div className="animate-in fade-in slide-in-from-left-4 duration-500">
                                <div className="text-[10px] font-bold text-neutral-500 uppercase mb-2 flex items-center gap-2 tracking-widest">
                                    <Layers size={14} /> Active Reel
                                </div>
                                <div className="flex gap-2">
                                    <div className="relative group flex-1">
                                        <select value={selectedEpisodeId || "new_placeholder"} onChange={handleEpisodeChange} className="w-full appearance-none bg-black/50 border border-white/10 text-white text-xs font-mono uppercase tracking-wider py-3 pl-4 pr-10 rounded-lg hover:border-red-600/50 hover:bg-white/5 focus:outline-none focus:border-red-600 transition-all cursor-pointer">
                                            {episodes.map((ep) => (
                                                <option key={ep.id} value={ep.id} className="bg-[#050505] text-neutral-300">
                                                    {ep.title || `EPISODE ${ep.episode_number}`}
                                                </option>
                                            ))}
                                            {selectedEpisodeId === null && <option value="new_placeholder" disabled>-- CREATING NEW --</option>}
                                            {episodes.length === 0 && selectedEpisodeId !== null && <option disabled>No Reels Available</option>}
                                        </select>
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-500 group-hover:text-white transition-colors">
                                            <ChevronDown size={14} />
                                        </div>
                                    </div>
                                    <button onClick={handleNewEpisode} className="px-4 bg-red-600/10 border border-red-600/50 rounded-lg hover:bg-red-600 hover:text-white text-red-500 transition-all shadow-[0_0_15px_rgba(220,38,38,0.2)] hover:shadow-[0_0_20px_rgba(220,38,38,0.5)]">
                                        <Plus size={18} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="p-10 space-y-10">
                        {/* Static Info */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 text-[11px] font-bold text-white uppercase tracking-widest">
                                <Terminal size={14} className="text-red-500" /> Ingestion Protocol
                            </div>
                            <p className="text-xs text-neutral-400 leading-relaxed pl-4 border-l-2 border-red-600/30">
                                This terminal accepts raw screenplay data. The Neural Engine will parse headers, action lines, and dialogue blocks automatically.
                            </p>
                        </div>

                        {/* DYNAMIC ANALYSIS BOX */}
                        <div className="p-5 bg-gradient-to-br from-white/5 to-transparent border border-white/5 rounded-lg relative overflow-hidden group">
                            <div className="absolute inset-0 bg-red-600/5 translate-y-full group-hover:translate-y-0 transition-transform duration-700 pointer-events-none" />
                            <div className="flex items-center gap-3 mb-3">
                                <Cpu size={18} className="text-white" />
                                <span className="text-xs font-bold text-white uppercase tracking-wider">Analysis Engine</span>
                            </div>
                            <div className="text-[10px] font-mono text-neutral-400 h-10 flex items-center">
                                <span className="animate-pulse text-green-500 mr-2">➜</span>
                                <span className="text-neutral-300">{activeStatus}</span>
                            </div>
                            {activeStatus !== "Waiting for data stream..." && !hasExistingScenes && (
                                <div className="w-full h-0.5 bg-neutral-800 mt-2 overflow-hidden">
                                    <div className="h-full bg-red-600 w-1/3 animate-indeterminate-bar" />
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="mt-auto p-6 border-t border-white/5 bg-black/60 flex justify-between">
                        <div className="flex items-center gap-2 text-[10px] text-neutral-500 font-mono"><ShieldCheck size={12} /> ENCRYPTED</div>
                        <div className="flex items-center gap-2 text-[10px] text-neutral-500 font-mono"><HardDrive size={12} /> LOCAL</div>
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

                    <div className="flex-1 overflow-y-auto p-12 pb-32 flex flex-col items-center justify-start scroll-smooth">
                        <div className="w-full max-w-4xl relative z-10 shrink-0">

                            {/* GATEWAY LOGIC: Check if scenes exist */}
                            {checkingScenes ? (
                                <div className="flex flex-col items-center justify-center py-32 gap-4">
                                    <Loader2 className="w-8 h-8 animate-spin text-red-600" />
                                    <span className="text-xs font-mono text-neutral-500 tracking-widest">SCANNING REEL DATA...</span>
                                </div>
                            ) : hasExistingScenes ? (
                                // --- ACTIVE SEQUENCE DETECTED (Safe Mode) ---
                                <div className="bg-[#050505]/80 border border-red-900/30 rounded-xl p-12 shadow-2xl backdrop-blur-md flex flex-col items-center text-center animate-in fade-in zoom-in-95">
                                    <div className="w-16 h-16 bg-red-900/10 rounded-full flex items-center justify-center mb-6 border border-red-500/20">
                                        <AlertCircle size={32} className="text-red-500" />
                                    </div>
                                    <h2 className="text-2xl font-bold text-white uppercase tracking-tight mb-2">Active Sequence Detected</h2>
                                    <p className="text-sm text-neutral-400 max-w-md mb-8 leading-relaxed">
                                        This reel already contains parsed scenes. Entering ingestion mode will allow you to overwrite the existing script, but you might lose current scene data.
                                    </p>

                                    <div className="flex gap-4">
                                        <button
                                            onClick={() => router.push(`/project/${projectId}/episode/${selectedEpisodeId}/editor`)}
                                            className="px-8 py-4 bg-green-600 hover:bg-green-500 text-white font-bold text-xs uppercase tracking-widest rounded transition-all shadow-lg hover:shadow-green-900/50 flex items-center gap-2"
                                        >
                                            <Edit3 size={14} /> Open Scene Manager
                                        </button>

                                        <button
                                            onClick={() => setHasExistingScenes(false)}
                                            className="px-8 py-4 bg-transparent border border-neutral-700 hover:border-red-600 hover:text-red-500 text-neutral-500 font-bold text-xs uppercase tracking-widest rounded transition-all"
                                        >
                                            Overwrite (New Draft)
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                // --- STANDARD INPUT DECK ---
                                <div className="bg-[#050505]/80 border border-white/10 rounded-xl p-8 shadow-2xl backdrop-blur-md deck-root relative group">
                                    <div className="absolute -inset-[1px] bg-gradient-to-r from-red-600/0 via-red-600/20 to-red-600/0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                                    <div className="flex justify-between items-end mb-8 pb-4 border-b border-white/5">
                                        <div>
                                            <h2 className="text-xl font-bold text-white uppercase tracking-tight">Data Entry</h2>
                                            {project?.type !== 'movie' && (
                                                <div className="text-[10px] font-mono text-neutral-500 mt-1 flex items-center gap-1">
                                                    TARGET: <Film size={10} />
                                                    <span className={selectedEpisodeId === null ? "text-red-500 font-bold" : "text-white"}>
                                                        {selectedEpisodeId === null ? "NEW SEQUENCE" : (activeEpisode?.title || "UNKNOWN REEL")}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-[10px] font-mono text-neutral-500">UPLOAD OR PASTE</div>
                                    </div>

                                    <InputDeck
                                        projectId={projectId}
                                        projectTitle={project?.title || ""}
                                        projectType={project?.type || "micro_drama"}
                                        episodeId={selectedEpisodeId}
                                        initialTitle={currentTitle}
                                        initialScript={currentScript}
                                        isModal={false}
                                        className="w-full"
                                        onCancel={() => router.push("/dashboard")}
                                        onSuccess={(url) => router.push(url)}
                                        onStatusChange={handleIngestStatus}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </StudioLayout>
    );
}