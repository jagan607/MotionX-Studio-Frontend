"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    Loader2, Plus, Clapperboard, Film, LayoutGrid,
    MonitorPlay, ArrowLeft, Layers, CheckCircle2,
    FileText, Database, ArrowRight
} from "lucide-react";
import { toast } from "react-hot-toast";
import Link from "next/link";

// --- COMPONENTS ---
import { SceneCard, SceneData } from "@/components/studio/SceneCard";
import { SceneStoryboardContainer } from "@/app/components/studio/SceneStoryboardContainer";

// --- API & TYPES ---
import {
    fetchProject,
    fetchProjectAssets,
    fetchScenes,
    fetchEpisodes
} from "@/lib/api";
import { Project, Asset } from "@/lib/types";

export default function StudioPage() {
    const params = useParams();
    const router = useRouter();
    const projectId = params.id as string;

    // --- STATE ---
    const [loading, setLoading] = useState(true);
    const [project, setProject] = useState<Project | null>(null);

    // Series State
    const [episodes, setEpisodes] = useState<any[]>([]);
    const [activeEpisodeId, setActiveEpisodeId] = useState<string>("");

    // Content State
    const [scenes, setScenes] = useState<SceneData[]>([]);

    // UI State
    const [selectedScene, setSelectedScene] = useState<SceneData | null>(null);

    // Asset DB
    const [assets, setAssets] = useState<{
        characters: Asset[],
        locations: Asset[]
    }>({ characters: [], locations: [] });

    // --- 1. INITIAL LOAD ---
    useEffect(() => {
        initializeStudio();
    }, [projectId]);

    const initializeStudio = async () => {
        try {
            const [projData, assetData] = await Promise.all([
                fetchProject(projectId),
                fetchProjectAssets(projectId)
            ]);

            setProject(projData);
            setAssets(assetData);

            // Handle Movie vs. Series Logic
            if (projData.type === 'micro_drama') {
                try {
                    const epsData = await fetchEpisodes(projectId);
                    let eps = Array.isArray(epsData) ? epsData : (epsData.episodes || []);

                    // Sort by episode number
                    eps = eps.sort((a: any, b: any) => (a.episode_number || 0) - (b.episode_number || 0));

                    // --- FILTER LOGIC: HIDE GHOST EPISODE ---
                    // If we have actual content (episodes without "Initial setup"), 
                    // we filter out the default ghost episode.
                    const realEpisodes = eps.filter((e: any) => e.synopsis !== "Initial setup");

                    // Fallback: If 'realEpisodes' is empty (brand new project), show the ghost so UI isn't broken.
                    const finalEpisodes = realEpisodes.length > 0 ? realEpisodes : eps;

                    setEpisodes(finalEpisodes);

                    if (finalEpisodes.length > 0) {
                        setActiveEpisodeId(finalEpisodes[0].id);
                    } else {
                        setActiveEpisodeId("empty");
                        // Only toast if it's truly empty (no ghost, no real)
                        if (eps.length === 0) toast("No episodes found.");
                    }
                } catch (epError) {
                    console.error("Episode Fetch Error:", epError);
                    toast.error("Failed to load episodes");
                }
            } else {
                // For movies, we simulate a single "Main Reel"
                const mainReelId = projData.default_episode_id || "main";
                setEpisodes([{ id: mainReelId, title: "Main Picture Reel", episode_number: 1 }]);
                setActiveEpisodeId(mainReelId);
            }

        } catch (e) {
            console.error(e);
            toast.error("Failed to load studio configuration");
        } finally {
            setLoading(false);
        }
    };

    // --- 2. FETCH SCENES ---
    useEffect(() => {
        if (!activeEpisodeId || activeEpisodeId === "empty") return;
        loadScenes(activeEpisodeId);
    }, [activeEpisodeId]);

    const loadScenes = async (epId: string) => {
        try {
            const data = await fetchScenes(projectId, epId);
            const sceneList = data.scenes || (Array.isArray(data) ? data : []);
            setScenes(sceneList);
        } catch (e) {
            console.error("Failed to load scenes", e);
            toast.error("Could not fetch scenes");
        }
    };

    // --- 3. STATS ---
    const calculateStats = () => {
        const visualProgress = scenes.length > 0
            ? Math.round((scenes.filter(s => s.status === 'approved').length / scenes.length) * 100)
            : 0;

        return {
            sceneCount: scenes.length,
            visualProgress
        };
    };

    const stats = calculateStats();

    // --- HANDLERS ---
    const handleOpenStoryboard = (scene: SceneData) => {
        setSelectedScene(scene);
    };

    // --- RENDER ---
    if (loading || !project) {
        return (
            <div className="fixed inset-0 bg-[#050505] flex flex-col items-center justify-center gap-4 text-red-600">
                <Loader2 className="animate-spin" size={32} />
                <span className="text-xs font-mono tracking-widest text-[#444]">LOADING STUDIO ENVIRONMENT...</span>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 bg-[#050505] text-[#EEE] font-sans overflow-hidden flex flex-col">

            {/* --- CSS OVERRIDES --- */}
            <style jsx global>{`
                div[class*="rounded-"], div[class*="rounded"] {
                    border-radius: 0px !important;
                }
                .scene-card-wrapper > div {
                    background-color: #0A0A0A !important;
                    border: 1px solid #222 !important;
                    box-shadow: none !important;
                    transition: all 0.2s ease;
                }
                .scene-card-wrapper > div:hover {
                    border-color: #555 !important;
                    background-color: #0F0F0F !important;
                }
                ::-webkit-scrollbar { width: 6px; }
                ::-webkit-scrollbar-track { background: #050505; }
                ::-webkit-scrollbar-thumb { background: #333; }
            `}</style>

            {/* --- HEADER --- */}
            <header className="h-20 border-b border-[#222] bg-[#080808] flex items-center justify-between px-8 shrink-0 z-50">
                <div className="flex items-center gap-8">
                    <Link href="/dashboard" className="flex items-center gap-2 text-[#666] hover:text-white transition-colors group">
                        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                        <span className="text-[10px] font-bold tracking-[0.2em] uppercase">Dashboard</span>
                    </Link>

                    <div className="h-8 w-[1px] bg-[#222]" />

                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <MonitorPlay size={16} className="text-red-600" />
                            <h1 className="text-xl font-display font-bold uppercase text-white tracking-tight leading-none">
                                VISUALIZATION STUDIO
                            </h1>
                        </div>
                        <div className="text-[10px] font-mono text-[#555] uppercase tracking-widest">
                            {project.title}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <div className="flex bg-[#0A0A0A] border border-[#222]">
                        <button
                            onClick={() => router.push(`/project/${projectId}/script`)}
                            className="flex items-center gap-2 px-4 py-2 border-r border-[#222] hover:bg-[#111] transition-colors group"
                        >
                            <FileText size={12} className="text-[#666] group-hover:text-white" />
                            <span className="text-[10px] font-bold text-[#666] group-hover:text-white uppercase tracking-widest">Script</span>
                        </button>
                        <button
                            onClick={() => router.push(`/project/${projectId}/assets`)}
                            className="flex items-center gap-2 px-4 py-2 hover:bg-[#111] transition-colors group"
                        >
                            <Database size={12} className="text-[#666] group-hover:text-white" />
                            <span className="text-[10px] font-bold text-[#666] group-hover:text-white uppercase tracking-widest">Assets</span>
                        </button>
                    </div>

                    <div className="h-8 w-[1px] bg-[#222]" />

                    <div className="flex flex-col items-end">
                        <div className="text-[10px] font-mono text-[#666] mb-1 uppercase tracking-widest flex items-center gap-2">
                            {stats.visualProgress === 100 ? <CheckCircle2 size={10} className="text-green-500" /> : null}
                            RENDER PROGRESS: <span className="text-white">{stats.visualProgress}%</span>
                        </div>
                        <div className="w-40 h-1 bg-[#1A1A1A]">
                            <div className="h-full bg-red-600 transition-all duration-700 ease-out" style={{ width: `${stats.visualProgress}%` }} />
                        </div>
                    </div>
                </div>
            </header>

            {/* --- MAIN WORKSPACE --- */}
            <div className="flex-1 flex overflow-hidden relative z-40">

                {/* LEFT: REEL SELECTOR */}
                <div className="w-[280px] bg-[#050505] border-r border-[#222] flex flex-col shrink-0">
                    <div className="p-6 border-b border-[#222]">
                        <div className="text-[10px] font-bold text-[#444] uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Layers size={14} /> Active Reels
                        </div>

                        <div className="space-y-1">
                            {episodes.map((ep) => (
                                <button
                                    key={ep.id}
                                    onClick={() => setActiveEpisodeId(ep.id)}
                                    className={`w-full flex items-center justify-between px-4 py-3 text-[10px] font-bold tracking-widest uppercase transition-all border border-transparent
                                    ${activeEpisodeId === ep.id
                                            ? "bg-[#111] text-white border-[#222] border-l-2 border-l-red-600"
                                            : "text-[#555] hover:text-[#AAA] hover:bg-[#0A0A0A]"}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <Film size={14} />
                                        <span className="truncate max-w-[140px]" title={ep.title}>
                                            {ep.title || `EPISODE ${ep.episode_number}`}
                                        </span>
                                    </div>
                                    {activeEpisodeId === ep.id && <div className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse" />}
                                </button>
                            ))}
                            {episodes.length === 0 && (
                                <div className="text-[10px] text-[#444] text-center py-4 italic">
                                    No active reels found.
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="p-6 mt-auto">
                        <div className="p-4 bg-[#0A0A0A] border border-[#222] flex flex-col gap-2">
                            <div className="flex justify-between items-center text-[9px] text-[#666] font-mono">
                                <span>SCENE COUNT</span>
                                <span className="text-white">{stats.sceneCount}</span>
                            </div>
                            <div className="flex justify-between items-center text-[9px] text-[#666] font-mono">
                                <span>ASSET DB</span>
                                <span className="text-white">{assets.characters.length + assets.locations.length}</span>
                            </div>
                            <div className="flex justify-between items-center text-[9px] text-[#666] font-mono">
                                <span>FORMAT</span>
                                <span className="text-white">{(project as any)?.aspect_ratio || "16:9"}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT: SCENE BIN */}
                <div className="flex-1 bg-[#020202] flex flex-col relative">
                    <div className="h-12 border-b border-[#222] bg-[#080808] flex items-center justify-between px-6 shrink-0">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-[#555] uppercase tracking-widest">
                            <LayoutGrid size={14} />
                            {episodes.find(e => e.id === activeEpisodeId)?.title || "Active Reel"} / Scene Bin
                        </div>

                        <div className="flex gap-2">
                            <div className="text-[9px] font-mono text-[#333]">
                                MODE: BOARD_VIEW
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-[#020202]">
                        {scenes.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center opacity-50">
                                <Clapperboard size={32} className="text-[#333] mb-4" />
                                <div className="text-xs font-bold text-[#666] tracking-widest uppercase mb-2">Reel is Empty</div>
                                <p className="text-[10px] font-mono text-[#444] max-w-xs text-center mb-6">
                                    No scenes found in this sequence. Please return to the Script Editor to generate breakdown.
                                </p>
                                <button
                                    onClick={() => router.push(`/project/${projectId}/script`)}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-[#111] border border-[#333] hover:border-white text-[10px] font-bold text-[#888] hover:text-white uppercase transition-colors"
                                >
                                    <ArrowRight size={12} /> GO TO SCRIPT EDITOR
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
                                {scenes.map((scene) => (
                                    <div key={scene.id} className="scene-card-wrapper group relative">
                                        <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[#333] z-10 pointer-events-none" />
                                        <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[#333] z-10 pointer-events-none" />

                                        <SceneCard
                                            scene={scene}
                                            projectAssets={assets}
                                            onOpenStoryboard={handleOpenStoryboard}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {selectedScene && (
                <SceneStoryboardContainer
                    isOpen={!!selectedScene}
                    onClose={() => setSelectedScene(null)}
                    projectId={projectId}
                    episodeId={activeEpisodeId || "main"}
                    scene={selectedScene}
                    projectAssets={assets}
                    seriesTitle={project.title}
                    credits={99}
                />
            )}
        </div>
    );
}