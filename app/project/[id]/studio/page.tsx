"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "react-hot-toast";

// --- API & TYPES ---
import {
    fetchProject,
    fetchProjectAssets,
    fetchScenes,
    fetchEpisodes
} from "@/lib/api";
import { Project, Asset } from "@/lib/types";
import { SceneData } from "@/components/studio/SceneCard";

// --- STUDIO COMPONENTS ---
import { StudioLayout } from "@/app/components/studio/StudioLayout";
import { StudioHeader } from "@/app/components/studio/StudioHeader";
import { ReelSidebar } from "@/app/components/studio/ReelSidebar";
import { SceneBin } from "@/app/components/studio/SceneBin";
import { ProjectSettingsModal } from "@/app/components/studio/ProjectSettingsModal";
import { SceneStoryboardContainer } from "@/app/components/studio/SceneStoryboardContainer";

export default function StudioPage() {
    const params = useParams();
    const router = useRouter();
    const projectId = params.id as string;

    // --- STATE ---
    const [loading, setLoading] = useState(true);
    const [project, setProject] = useState<Project | null>(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

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

                    // Filter Logic: Hide Ghost Episode
                    const realEpisodes = eps.filter((e: any) => e.synopsis !== "Initial setup");
                    const finalEpisodes = realEpisodes.length > 0 ? realEpisodes : eps;

                    setEpisodes(finalEpisodes);

                    if (finalEpisodes.length > 0) {
                        setActiveEpisodeId(finalEpisodes[0].id);
                    } else {
                        setActiveEpisodeId("empty");
                        if (eps.length === 0) toast("No episodes found.");
                    }
                } catch (epError) {
                    console.error("Episode Fetch Error:", epError);
                    toast.error("Failed to load episodes");
                }
            } else {
                // Movie: Single Main Reel
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

    // --- 3. COMPUTED STATS ---
    const calculateStats = () => {
        const visualProgress = scenes.length > 0
            ? Math.round((scenes.filter(s => s.status === 'approved').length / scenes.length) * 100)
            : 0;

        return {
            sceneCount: scenes.length,
            visualProgress,
            assetCount: assets.characters.length + assets.locations.length,
            format: (project as any)?.aspect_ratio || "16:9"
        };
    };

    const stats = calculateStats();
    const activeReelTitle = episodes.find(e => e.id === activeEpisodeId)?.title || "Active Reel";

    // --- HANDLERS ---
    const handleNewEpisode = () => {
        router.push(`/project/${projectId}/script?mode=new`);
    };

    const handleUpdateProject = (updatedProject: Project) => {
        setProject(updatedProject);
    };

    if (loading || !project) {
        return (
            <div className="fixed inset-0 bg-[#050505] flex flex-col items-center justify-center gap-4 text-red-600">
                <Loader2 className="animate-spin" size={32} />
                <span className="text-xs font-mono tracking-widest text-[#444]">LOADING STUDIO ENVIRONMENT...</span>
            </div>
        );
    }

    return (
        <StudioLayout>
            {/* HEADER */}
            <StudioHeader
                projectId={projectId}
                projectTitle={project.title}
                renderProgress={stats.visualProgress}
                activeEpisodeId={activeEpisodeId} // <--- PASSED HERE
                onOpenSettings={() => setIsSettingsOpen(true)}
            />

            {/* MAIN CONTENT ROW */}
            <div className="flex-1 flex overflow-hidden relative z-40">

                {/* SIDEBAR */}
                <ReelSidebar
                    episodes={episodes}
                    activeEpisodeId={activeEpisodeId}
                    onSelectEpisode={setActiveEpisodeId}
                    onNewEpisode={handleNewEpisode}
                    metadata={{
                        sceneCount: stats.sceneCount,
                        assetCount: stats.assetCount,
                        format: stats.format
                    }}
                />

                {/* SCENE BIN */}
                <SceneBin
                    scenes={scenes}
                    activeReelTitle={activeReelTitle}
                    projectId={projectId}
                    projectAssets={assets}
                    onOpenStoryboard={setSelectedScene}
                />
            </div>

            {/* MODALS */}
            <ProjectSettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                project={project}
                onUpdate={handleUpdateProject}
            />

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
        </StudioLayout>
    );
}