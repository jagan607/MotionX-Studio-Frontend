"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    collection,
    onSnapshot,
    query,
    orderBy,
    doc,
    updateDoc,
    writeBatch
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "react-hot-toast";
import { api, fetchProject, fetchEpisodes } from "@/lib/api"; // Added fetchEpisodes
import { Project } from "@/lib/types";

// --- COMPONENTS ---
import { ScriptWorkstation, WorkstationScene } from "@/app/components/script/ScriptWorkstation";
import { StudioHeader } from "@/app/components/studio/StudioHeader";
import { ProjectSettingsModal } from "@/app/components/studio/ProjectSettingsModal";

export default function SceneManagerPage() {
    const params = useParams();
    const router = useRouter();

    const projectId = params.id as string;
    const episodeId = params.episodeid as string;

    // --- STATE ---
    // Content Data
    const [scenes, setScenes] = useState<WorkstationScene[]>([]);
    const [project, setProject] = useState<Project | null>(null);
    const [episodes, setEpisodes] = useState<any[]>([]); // New: Full Episode List

    // UI State
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // Loading States
    const [isProcessing, setIsProcessing] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // 1. FETCH PROJECT & EPISODES (Context)
    useEffect(() => {
        if (!projectId) return;

        const loadContext = async () => {
            try {
                const [projData, epsData] = await Promise.all([
                    fetchProject(projectId),
                    fetchEpisodes(projectId)
                ]);

                setProject(projData);

                // --- Process Episodes (Consistent with Studio/Script Pages) ---
                let eps = Array.isArray(epsData) ? epsData : (epsData.episodes || []);

                if (projData.type === 'movie') {
                    // Movie Logic: Ensure at least the main reel exists visually
                    const mainReelId = projData.default_episode_id || "main";
                    if (eps.length === 0) {
                        eps = [{ id: mainReelId, title: "Main Picture Reel", episode_number: 1 }];
                    }
                    setEpisodes(eps);
                } else {
                    // Series Logic: Sort and Filter
                    eps = eps.sort((a: any, b: any) => (a.episode_number || 0) - (b.episode_number || 0));
                    const realEpisodes = eps.filter((e: any) => e.synopsis !== "Initial setup");
                    setEpisodes(realEpisodes.length > 0 ? realEpisodes : eps);
                }

            } catch (err) {
                console.error("Failed to load project context", err);
                toast.error("Failed to load project details");
            }
        };

        loadContext();
    }, [projectId]);

    // 2. REAL-TIME SCENES SYNC (Content)
    useEffect(() => {
        if (!projectId || !episodeId) return;

        const q = query(
            collection(db, "projects", projectId, "episodes", episodeId, "scenes"),
            orderBy("scene_number", "asc")
        );

        const unsub = onSnapshot(q, (snapshot) => {
            const loadedScenes: WorkstationScene[] = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                loadedScenes.push({
                    id: doc.id,
                    scene_number: data.scene_number,
                    header: data.header || "UNKNOWN SCENE",
                    summary: data.summary || "",
                    time: data.time || "",
                    status: data.status || "draft",
                    ...data
                });
            });

            if (!isProcessing) {
                setScenes(loadedScenes);
                setIsLoading(false);
            }
        }, (error) => {
            console.error("Firestore Error:", error);
            toast.error("Connection Failed");
            setIsLoading(false);
        });

        return () => unsub();
    }, [projectId, episodeId, isProcessing]);

    // --- HANDLERS ---

    // NEW: Handle Context Switch via Dropdown
    const handleSwitchEpisode = (newEpisodeId: string) => {
        if (newEpisodeId === episodeId) return;
        // Navigate to the new URL. Next.js App Router will handle the re-render.
        router.push(`/project/${projectId}/episode/${newEpisodeId}/editor`);
        toast.loading("Switching Reel...", { duration: 800 });
    };

    const handleReorder = async (newOrder: WorkstationScene[]) => {
        setScenes(newOrder);
        try {
            const batch = writeBatch(db);
            newOrder.forEach((scene, index) => {
                const ref = doc(db, "projects", projectId, "episodes", episodeId, "scenes", scene.id);
                if (scene.scene_number !== index + 1) {
                    batch.update(ref, { scene_number: index + 1 });
                }
            });
            await batch.commit();
        } catch (e) {
            console.error(e);
            toast.error("Failed to save order");
        }
    };

    const handleRewrite = async (sceneId: string, instruction: string) => {
        setIsProcessing(true);
        const targetScene = scenes.find(s => s.id === sceneId);

        if (!targetScene) {
            setIsProcessing(false);
            return;
        }

        try {
            const res = await api.post("api/v1/script/rewrite-scene", {
                original_text: targetScene.summary,
                instruction: instruction,
                context: `Scene Heading: ${targetScene.header}`
            });

            const newText = res.data.new_text;

            const ref = doc(db, "projects", projectId, "episodes", episodeId, "scenes", sceneId);
            await updateDoc(ref, {
                summary: newText,
                status: 'draft'
            });

            toast.success("Scene rewritten");
        } catch (e) {
            console.error(e);
            toast.error("AI Rewrite Failed");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleExit = () => {
        router.push(`/project/${projectId}/assets`);
    };

    // --- RENDER ---

    if (isLoading) {
        return (
            <div className="fixed inset-0 bg-[#050505] flex items-center justify-center text-white font-mono text-xs gap-3">
                <div className="w-2 h-2 bg-red-600 animate-pulse rounded-full"></div>
                LOADING SCENE DATA...
            </div>
        );
    }

    return (
        <>
            {/* SETTINGS MODAL (For Header Config Button) */}
            <ProjectSettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                project={project}
                onUpdate={setProject}
            />

            <ScriptWorkstation
                // Layout Config
                title="SCENE MANAGER"
                backLink={`/project/${projectId}/assets`}
                commitLabel="RETURN TO STUDIO"

                // INJECT STUDIO HEADER
                customHeader={
                    <StudioHeader
                        projectTitle={project?.title || "Loading..."}
                        projectId={projectId}
                        activeEpisodeId={episodeId}
                        onOpenSettings={() => setIsSettingsOpen(true)}
                    />
                }

                // INJECT EPISODE CONTEXT (For Dropdown)
                episodeContext={project?.type === 'micro_drama' ? {
                    episodes: episodes,
                    currentEpisodeId: episodeId,
                    onSwitchEpisode: handleSwitchEpisode
                } : undefined} // Undefined context = Static "Timeline" label (for Movies)

                // Data & Actions
                scenes={scenes}
                onReorder={handleReorder}
                onRewrite={handleRewrite}
                onCommit={handleExit}
                isProcessing={isProcessing}
                isCommitting={false}
            />
        </>
    );
}