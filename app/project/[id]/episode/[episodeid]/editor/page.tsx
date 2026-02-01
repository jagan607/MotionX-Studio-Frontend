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
    writeBatch,
    getDocs // Required for lazy loading context
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

    // 1. FETCH CONTEXT (Project Info & Episode List)
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
                    // Movie Logic: Ensure at least one reel exists visually
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

    // 2. REAL-TIME SCENES SYNC (FIXED DATA MAPPING)
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

                // 1. HEADER MAPPING
                // DB uses 'slugline' primarily, but we check others for robustness
                const headerText =
                    data.slugline ||
                    data.header ||
                    data.scene_header ||
                    data.title ||
                    "";

                const fallbackHeader = (data.int_ext && data.location)
                    ? `${data.int_ext}. ${data.location} - ${data.time || ''}`
                    : "UNKNOWN SCENE";

                // 2. SUMMARY MAPPING
                // DB uses 'synopsis' primarily for the description
                const summaryText =
                    data.synopsis ||
                    data.summary ||
                    data.action ||
                    data.description ||
                    "";

                loadedScenes.push({
                    id: doc.id,
                    scene_number: data.scene_number,
                    header: headerText || fallbackHeader,
                    summary: summaryText,
                    time: data.time || "",
                    status: data.status || "draft",

                    // 3. METADATA MAPPING (Cast & Location)
                    cast_ids: data.cast_ids || data.characters || [],
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

    // NEW: Fetch function for Context Matrix (Lazy Loads other episodes)
    const fetchRemoteScenes = async (targetEpisodeId: string) => {
        try {
            const q = query(
                collection(db, "projects", projectId, "episodes", targetEpisodeId, "scenes"),
                orderBy("scene_number", "asc")
            );
            const snapshot = await getDocs(q);

            // Map raw docs to clean context objects
            return snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    scene_number: data.scene_number,
                    header: data.slugline || data.header || "UNKNOWN SCENE",
                    summary: data.synopsis || data.summary || "",
                };
            });
        } catch (e) {
            console.error("Context Load Error:", e);
            toast.error("Failed to load context scenes");
            return [];
        }
    };

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

    // UPDATED: Handle Rewrite now accepts Context References
    const handleRewrite = async (sceneId: string, instruction: string, contextRefs?: any[]) => {
        setIsProcessing(true);
        const currentIndex = scenes.findIndex(s => s.id === sceneId);
        const targetScene = scenes[currentIndex];

        if (!targetScene) {
            setIsProcessing(false);
            return;
        }

        try {
            // 1. Gather Standard Local Context
            const prevScene = currentIndex > 0 ? scenes[currentIndex - 1] : null;
            const nextScene = currentIndex < scenes.length - 1 ? scenes[currentIndex + 1] : null;

            // 2. Format Custom Context References (from Matrix)
            const memoryReferences = contextRefs?.map(ref => ({
                source: ref.sourceLabel, // e.g., "EP 1 • SC 5"
                header: ref.header,
                content: ref.summary
            })) || [];

            // 3. Build Rich Payload
            const contextPayload = {
                project_genre: (project as any)?.genre || "Cinematic",
                project_style: (project as any)?.style || "Realistic",

                // Immediate Flow
                previous_scene_summary: prevScene ? prevScene.summary : "Start of Episode",
                next_scene_header: nextScene ? nextScene.header : "End of Episode",

                // Character Awareness
                characters: targetScene.cast_ids || [],

                // The "Brain" - Long Term Memory
                custom_references: memoryReferences
            };

            // 4. Send to Backend
            const res = await api.post("api/v1/script/rewrite-scene", {
                original_text: targetScene.summary,
                instruction: instruction,
                context: `Scene Heading: ${targetScene.header}`,
                smart_context: contextPayload
            });

            const newText = res.data.new_text;

            const ref = doc(db, "projects", projectId, "episodes", episodeId, "scenes", sceneId);
            // Updating 'synopsis' as it is the primary read field
            await updateDoc(ref, {
                synopsis: newText,
                summary: newText, // Backfill for compatibility
                status: 'draft'
            });

            toast.success("Scene rewritten with Context");
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

                // FIX: Ensure Context Modal always gets the episode list (Movies & Series)
                contextEpisodes={episodes}

                scenes={scenes}

                // Actions
                onReorder={handleReorder}
                onRewrite={handleRewrite}
                onCommit={handleExit}

                // Context Matrix Integration
                onFetchRemoteScenes={fetchRemoteScenes}

                isProcessing={isProcessing}
                isCommitting={false}
            />
        </>
    );
}