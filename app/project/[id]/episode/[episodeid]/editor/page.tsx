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
import { api, fetchProject, fetchEpisodes } from "@/lib/api";
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
    const [scenes, setScenes] = useState<WorkstationScene[]>([]);
    const [project, setProject] = useState<Project | null>(null);
    const [episodes, setEpisodes] = useState<any[]>([]);

    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // 1. FETCH CONTEXT
    useEffect(() => {
        if (!projectId) return;

        const loadContext = async () => {
            try {
                const [projData, epsData] = await Promise.all([
                    fetchProject(projectId),
                    fetchEpisodes(projectId)
                ]);

                setProject(projData);

                let eps = Array.isArray(epsData) ? epsData : (epsData.episodes || []);

                if (projData.type === 'movie') {
                    const mainReelId = projData.default_episode_id || "main";
                    if (eps.length === 0) {
                        eps = [{ id: mainReelId, title: "Main Picture Reel", episode_number: 1 }];
                    }
                    setEpisodes(eps);
                } else {
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

    // 2. REAL-TIME SCENES SYNC (CORRECTED DATA MAPPING)
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

                // --- 1. HEADER MAPPING (Prioritize 'slugline') ---
                // Based on screenshots: 'slugline' ("INT. CLASSROOM") is the key field.
                const headerText =
                    data.slugline ||
                    data.header ||
                    data.scene_header ||
                    data.title ||
                    "";

                // Fallback construction if slugline is missing
                const fallbackHeader = (data.int_ext && data.location)
                    ? `${data.int_ext}. ${data.location} - ${data.time || ''}`
                    : "UNKNOWN SCENE";

                // --- 2. SUMMARY MAPPING (Prioritize 'synopsis') ---
                // Based on screenshots: 'synopsis' contains the visual description.
                const summaryText =
                    data.synopsis ||
                    data.summary ||
                    data.action ||
                    data.description ||
                    data.visuals ||
                    "";

                loadedScenes.push({
                    id: doc.id,
                    scene_number: data.scene_number,
                    header: headerText || fallbackHeader,
                    summary: summaryText,
                    time: data.time || "", // Screenshot confirms 'time' field exists
                    status: data.status || "draft",

                    // --- 3. METADATA MAPPING ---
                    // Screenshot confirms 'cast_ids' is the array of strings
                    cast_ids: data.cast_ids || [],
                    location_id: data.location_id || "",

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

    const handleSwitchEpisode = (newEpisodeId: string) => {
        if (newEpisodeId === episodeId) return;
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
        const currentIndex = scenes.findIndex(s => s.id === sceneId);
        const targetScene = scenes[currentIndex];

        if (!targetScene) {
            setIsProcessing(false);
            return;
        }

        try {
            // GATHER SMART CONTEXT
            const prevScene = currentIndex > 0 ? scenes[currentIndex - 1] : null;
            const nextScene = currentIndex < scenes.length - 1 ? scenes[currentIndex + 1] : null;

            const contextPayload = {
                project_genre: (project as any)?.genre || "Cinematic",
                project_style: (project as any)?.style || "Realistic",
                previous_scene_summary: prevScene ? prevScene.summary : "Start of Episode",
                next_scene_header: nextScene ? nextScene.header : "End of Episode",
                characters: (targetScene as any).cast_ids || []
            };

            const res = await api.post("api/v1/script/rewrite-scene", {
                original_text: targetScene.summary,
                instruction: instruction,
                context: `Scene Heading: ${targetScene.header}`,
                smart_context: contextPayload
            });

            const newText = res.data.new_text;

            const ref = doc(db, "projects", projectId, "episodes", episodeId, "scenes", sceneId);
            // We update 'synopsis' because that's the field we read from
            await updateDoc(ref, {
                synopsis: newText,
                summary: newText, // Update legacy field just in case
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
            <ProjectSettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                project={project}
                onUpdate={setProject}
            />

            <ScriptWorkstation
                title="SCENE MANAGER"
                backLink={`/project/${projectId}/assets`}
                commitLabel="RETURN TO STUDIO"

                customHeader={
                    <StudioHeader
                        projectTitle={project?.title || "Loading..."}
                        projectId={projectId}
                        activeEpisodeId={episodeId}
                        onOpenSettings={() => setIsSettingsOpen(true)}
                    />
                }

                episodeContext={project?.type === 'micro_drama' ? {
                    episodes: episodes,
                    currentEpisodeId: episodeId,
                    onSwitchEpisode: handleSwitchEpisode
                } : undefined}

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