"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "react-hot-toast";

// --- COMPONENTS ---
import { StudioLayout } from "@/components/ui/StudioLayout";
import { StudioControlBar } from "@/components/studio/StudioControlBar";
import { SceneCard, SceneData } from "@/components/studio/SceneCard";

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

    // Asset DB (For Intelligence)
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
            // A. Fetch Core Project & Assets
            const [projData, assetData] = await Promise.all([
                fetchProject(projectId),
                fetchProjectAssets(projectId)
            ]);

            setProject(projData);
            setAssets(assetData);

            // B. Handle Movie vs. Series Logic
            if (projData.type === 'micro_drama') {
                // Fetch Episodes
                const eps = await fetchEpisodes(projectId);
                setEpisodes(eps);

                if (eps.length > 0) {
                    setActiveEpisodeId(eps[0].id);
                } else {
                    // No episodes yet? Handle empty state if needed
                    setActiveEpisodeId("empty");
                }
            } else {
                // Movie: Use the default ID (or a fixed identifier like 'main')
                setActiveEpisodeId(projData.default_episode_id || "main");
            }

        } catch (e) {
            console.error(e);
            toast.error("Failed to load studio configuration");
        } finally {
            setLoading(false);
        }
    };

    // --- 2. FETCH SCENES WHEN EPISODE CHANGE ---
    useEffect(() => {
        if (!activeEpisodeId || activeEpisodeId === "empty") return;
        loadScenes(activeEpisodeId);
    }, [activeEpisodeId]);

    const loadScenes = async (epId: string) => {
        try {
            // API Call: Fetch scenes for this specific episode/container
            // Note: Ensure your backend supports filtering by ?container_id=...
            const data = await fetchScenes(projectId, epId);

            // Transform API data to SceneData interface if needed
            // For now assuming direct mapping matches
            setScenes(data.scenes || []);

        } catch (e) {
            console.error("Failed to load scenes", e);
            toast.error("Could not fetch scenes");
        }
    };

    // --- 3. CALCULATE STATS ---
    const calculateStats = () => {
        const totalAssets = assets.characters.length + assets.locations.length;

        // Calculate rudimentary visual progress
        // (In the future, check scene.status === 'approved' or has images)
        const visualProgress = scenes.length > 0
            ? Math.round((scenes.filter(s => s.status === 'approved').length / scenes.length) * 100)
            : 0;

        return {
            sceneCount: scenes.length,
            assetCount: totalAssets,
            visualProgress
        };
    };

    // --- 4. NAVIGATION HANDLERS ---
    const handleOpenStoryboard = (sceneId: string) => {
        // Navigate to the specific scene's visual editor
        // We might create a route like /project/[id]/scene/[sceneId] later
        toast("Opening Storyboard... (Next Feature)");
        // router.push(`/project/${projectId}/scene/${sceneId}`);
    };

    const handleEditScript = (sceneId: string) => {
        // Navigate to script editor, focusing on this scene
        router.push(`/project/${projectId}/script?scene=${sceneId}`);
    };

    // --- RENDER ---
    if (loading || !project) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center text-motion-red">
                <Loader2 className="animate-spin" size={32} />
            </div>
        );
    }

    return (
        <StudioLayout>
            <div className="min-h-screen bg-black text-white font-sans flex flex-col">

                {/* A. CONTROLS HUD */}
                <StudioControlBar
                    project={project}
                    episodes={episodes}
                    activeEpisodeId={activeEpisodeId}
                    onEpisodeChange={setActiveEpisodeId}
                    stats={calculateStats()}
                />

                {/* B. MAIN WORKSPACE */}
                <div className="flex-1 p-8 bg-[#050505]">
                    {scenes.length === 0 ? (
                        <div className="h-[60vh] flex flex-col items-center justify-center text-neutral-600 border border-dashed border-[#222] rounded-xl bg-[#090909]/50">
                            <p className="font-display uppercase tracking-widest text-lg mb-2 text-neutral-400">
                                No Scenes Detected
                            </p>
                            <p className="text-xs font-mono mb-6 max-w-md text-center leading-relaxed">
                                The Production Terminal is empty. Go to the Script Editor to write your screenplay or create your first episode.
                            </p>
                            <button
                                onClick={() => router.push(`/project/${projectId}/script`)}
                                className="px-6 py-3 bg-white text-black text-[10px] font-bold tracking-widest rounded hover:bg-neutral-200 transition-colors flex items-center gap-2"
                            >
                                <Plus size={14} /> OPEN SCRIPT EDITOR
                            </button>
                        </div>
                    ) : (
                        // MASONRY GRID LAYOUT
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6 pb-20">
                            {scenes.map((scene) => (
                                <SceneCard
                                    key={scene.id}
                                    scene={scene}
                                    projectAssets={assets}
                                    onOpenStoryboard={handleOpenStoryboard}
                                />
                            ))}
                        </div>
                    )}
                </div>

            </div>
        </StudioLayout>
    );
}