"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    doc,
    onSnapshot,
    updateDoc,
    collection,
    query,
    orderBy,
    getDocs
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "react-hot-toast";
import { api, fetchEpisodes } from "@/lib/api";
import { CheckCircle2 } from "lucide-react";
import { v4 as uuidv4 } from 'uuid';

// --- COMPONENTS ---
import { ScriptWorkstation, WorkstationScene } from "@/app/components/script/ScriptWorkstation";
import { MotionButton } from "@/components/ui/MotionButton";
import { AddSceneControls } from "@/components/script/AddSceneControls";

export default function DraftPage() {
    const params = useParams();
    const router = useRouter();
    const projectId = params.id as string;
    const draftId = params.draftId as string;

    // Data State
    const [scenes, setScenes] = useState<WorkstationScene[]>([]);
    const [draftMeta, setDraftMeta] = useState<any>({});

    // Context State
    const [episodes, setEpisodes] = useState<any[]>([]);

    // Loading States
    const [isProcessing, setIsProcessing] = useState(false);
    const [isCommitting, setIsCommitting] = useState(false);
    const [isExtending, setIsExtending] = useState(false);

    // Refs for safety
    const isCommittingRef = useRef(false);

    // 1. REAL-TIME DATA SYNC (Draft)
    useEffect(() => {
        if (!draftId || !projectId) return;

        const unsub = onSnapshot(doc(db, "projects", projectId, "drafts", draftId), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();

                setDraftMeta({
                    target_episode_id: data.target_episode_id,
                    title: data.title
                });

                if (!isProcessing && !isCommitting) {
                    const stableScenes = (data.scenes || []).map((s: any, i: number) => ({
                        ...s,
                        id: s.id || `scene_${i}`,
                        scene_number: i + 1
                    }));
                    setScenes(stableScenes);
                }
            } else {
                if (!isCommittingRef.current) {
                    toast.error("Draft sequence not found");
                    router.push(`/project/${projectId}/script`);
                }
            }
        });
        return () => unsub();
    }, [draftId, projectId, router, isProcessing, isCommitting]);

    // 2. FETCH EPISODES (For Context Matrix)
    useEffect(() => {
        if (!projectId) return;
        const loadContext = async () => {
            try {
                const epsData = await fetchEpisodes(projectId);
                let eps = Array.isArray(epsData) ? epsData : (epsData.episodes || []);
                eps = eps.filter((e: any) => !(e.title === "Main Script" && e.synopsis === "Initial setup"));
                setEpisodes(eps);
            } catch (err) {
                console.error("Failed to load project context", err);
            }
        };
        loadContext();
    }, [projectId]);

    // --- HANDLERS ---

    const fetchRemoteScenes = async (targetEpisodeId: string) => {
        try {
            const q = query(
                collection(db, "projects", projectId, "episodes", targetEpisodeId, "scenes"),
                orderBy("scene_number", "asc")
            );
            const snapshot = await getDocs(q);
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

    const handleReorder = async (newOrder: WorkstationScene[]) => {
        setScenes(newOrder);
        try {
            await updateDoc(doc(db, "projects", projectId, "drafts", draftId), {
                scenes: newOrder
            });
        } catch (e) {
            console.error(e);
            toast.error("Failed to sync order");
        }
    };

    const handleAddScene = async () => {
        try {
            const newScene: WorkstationScene = {
                id: `scene_${uuidv4().slice(0, 8)}`,
                scene_number: scenes.length + 1,
                header: "INT. UNTITLED SCENE - DAY",
                summary: "",
                cast_ids: [],
                time: "DAY"
            };

            const newScenes = [...scenes, newScene];
            setScenes(newScenes);

            await updateDoc(doc(db, "projects", projectId, "drafts", draftId), {
                scenes: newScenes
            });
            toast.success("New Scene Added");
        } catch (e) {
            console.error("Add Scene Error:", e);
            toast.error("Failed to add scene");
        }
    };

    const handleAutoExtend = async () => {
        if (scenes.length === 0) {
            toast.error("Need context to extend!");
            return;
        }

        setIsExtending(true);
        try {
            const lastScene = scenes[scenes.length - 1];

            const payload = {
                project_id: projectId,
                episode_id: draftMeta.target_episode_id || "main",
                previous_scene: {
                    location: lastScene.header,
                    time_of_day: lastScene.time,
                    visual_action: lastScene.summary,
                    characters: lastScene.cast_ids || lastScene.characters
                }
            };

            const res = await api.post("/api/v1/script/extend-scene", payload);
            const generatedScene = res.data.scene;

            const newScene: WorkstationScene = {
                id: `scene_${uuidv4().slice(0, 8)}`,
                scene_number: scenes.length + 1,
                header: generatedScene.slugline || "EXT. NEW SCENE - DAY",
                summary: generatedScene.visual_action || generatedScene.synopsis || "",
                time: generatedScene.time_of_day || "DAY",
                cast_ids: generatedScene.characters || [],
                characters: generatedScene.characters || []
            };

            const newScenes = [...scenes, newScene];
            setScenes(newScenes);

            await updateDoc(doc(db, "projects", projectId, "drafts", draftId), {
                scenes: newScenes
            });

            toast.success("Narrative Extended!");

        } catch (e) {
            console.error("Auto Extend Error:", e);
            toast.error("Failed to extend narrative");
        } finally {
            setIsExtending(false);
        }
    };

    // NEW: Handle Manual Edits (Director Console)
    const handleUpdateScene = async (sceneId: string, updates: Partial<WorkstationScene>) => {
        try {
            // Update local array first
            const updatedScenes = scenes.map(s => {
                if (s.id === sceneId) {
                    return { ...s, ...updates };
                }
                return s;
            });

            setScenes(updatedScenes);

            // Commit array to Firestore
            await updateDoc(doc(db, "projects", projectId, "drafts", draftId), {
                scenes: updatedScenes
            });
            toast.success("Scene Updated");
        } catch (e) {
            console.error("Update Scene Error:", e);
            toast.error("Failed to save changes");
        }
    };

    const handleDeleteScene = async (sceneId: string) => {
        try {
            const newScenes = scenes.filter(s => s.id !== sceneId);
            const reindexed = newScenes.map((s, idx) => ({ ...s, scene_number: idx + 1 }));

            setScenes(reindexed);

            await updateDoc(doc(db, "projects", projectId, "drafts", draftId), {
                scenes: reindexed
            });
            toast.success("Scene Removed");
        } catch (e) {
            console.error("Delete Error:", e);
            toast.error("Failed to delete scene");
        }
    };

    const handleUpdateCast = async (sceneId: string, newCast: string[]) => {
        try {
            const newScenes = scenes.map(s => {
                if (s.id === sceneId) {
                    return { ...s, cast_ids: newCast, characters: newCast };
                }
                return s;
            });
            setScenes(newScenes);
            await updateDoc(doc(db, "projects", projectId, "drafts", draftId), {
                scenes: newScenes
            });
        } catch (e) {
            console.error("Update Cast Error:", e);
        }
    };

    const handleRewrite = async (sceneId: string, instruction: string, contextRefs?: any[]) => {
        setIsProcessing(true);
        const sceneIndex = scenes.findIndex(s => s.id === sceneId);
        if (sceneIndex === -1) return;

        const targetScene = scenes[sceneIndex];

        try {
            const memoryReferences = contextRefs?.map(ref => ({
                source: ref.sourceLabel,
                header: ref.header,
                content: ref.summary
            })) || [];

            const smartContext = {
                previous_scene_summary: sceneIndex > 0 ? scenes[sceneIndex - 1].summary : "Start of Sequence",
                custom_references: memoryReferences
            };

            const res = await api.post("api/v1/script/rewrite-scene", {
                original_text: targetScene.summary,
                instruction: instruction,
                context: `Scene Heading: ${targetScene.header}`,
                smart_context: smartContext
            });

            const newText = res.data.new_text;
            const updatedScenes = [...scenes];
            updatedScenes[sceneIndex] = { ...targetScene, summary: newText };

            setScenes(updatedScenes);

            await updateDoc(doc(db, "projects", projectId, "drafts", draftId), {
                scenes: updatedScenes
            });

            toast.success("Scene rewritten");
        } catch (e) {
            console.error(e);
            toast.error("AI Rewrite Failed");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleCommit = async () => {
        setIsCommitting(true);
        isCommittingRef.current = true;

        try {
            await api.post("api/v1/script/commit-draft", {
                project_id: projectId,
                draft_id: draftId
            });

            toast.success("Sequence Approved");
            router.push(`/project/${projectId}/assets?onboarding=true`);

        } catch (e: any) {
            console.error(e);
            toast.error("Failed to finalize: " + (e.response?.data?.detail || e.message));
            setIsCommitting(false);
            isCommittingRef.current = false;
        }
    };

    const DraftHeader = (
        <div className="h-20 border-b border-[#222] bg-[#080808] flex items-center justify-between px-8 shrink-0">
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-3 text-[#EEE]">
                    <div>
                        <div className="text-lg font-bold tracking-wide leading-none">SCENE SEQUENCE EDITOR</div>
                        <div className="text-[10px] font-mono text-[#555] mt-1">DRAFT MODE • UNSAVED CHANGES</div>
                    </div>
                </div>
            </div>
            <div className="w-[240px]">
                <MotionButton
                    onClick={handleCommit}
                    loading={isCommitting}
                    disabled={isProcessing}
                    className="shadow-[0_0_30px_rgba(220,38,38,0.2)]"
                >
                    <CheckCircle2 size={16} strokeWidth={2.5} /> APPROVE SEQUENCE
                </MotionButton>
            </div>
        </div>
    );

    return (
        <ScriptWorkstation
            title="SEQUENCE EDITOR"
            backLink={`/project/${projectId}/script`}
            commitLabel="APPROVE SEQUENCE"

            customHeader={DraftHeader}

            scenes={scenes}
            contextEpisodes={episodes}

            // Actions
            onReorder={handleReorder}
            onRewrite={handleRewrite}
            onCommit={handleCommit}
            onFetchRemoteScenes={fetchRemoteScenes}
            onUpdateCast={handleUpdateCast}
            onDeleteScene={handleDeleteScene}
            onUpdateScene={handleUpdateScene} // <--- PASSED HERE

            // INJECT CONTROLS
            customFooter={
                <AddSceneControls
                    onManualAdd={handleAddScene}
                    onAutoExtend={handleAutoExtend}
                    isExtending={isExtending}
                    disabled={scenes.length === 0}
                />
            }

            isProcessing={isProcessing}
            isCommitting={isCommitting}
        />
    );
}