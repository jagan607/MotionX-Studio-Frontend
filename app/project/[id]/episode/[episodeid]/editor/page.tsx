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
import { api, fetchProject } from "@/lib/api";
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

    // UI State
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // Loading States
    const [isProcessing, setIsProcessing] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // 1. FETCH PROJECT DETAILS (For Header)
    useEffect(() => {
        if (!projectId) return;
        fetchProject(projectId)
            .then(setProject)
            .catch(err => console.error("Failed to load project info", err));
    }, [projectId]);

    // 2. REAL-TIME SCENES SYNC
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
                        // renderProgress removed
                        activeEpisodeId={episodeId}
                        onOpenSettings={() => setIsSettingsOpen(true)}
                    />
                }

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