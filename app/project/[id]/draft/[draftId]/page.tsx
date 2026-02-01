"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "react-hot-toast";
import { api } from "@/lib/api";

// --- IMPORT THE SMART COMPONENT ---
import { ScriptWorkstation, WorkstationScene } from "@/app/components/script/ScriptWorkstation";

export default function DraftPage() {
    const params = useParams();
    const router = useRouter();
    const projectId = params.id as string;
    const draftId = params.draftId as string;

    // Data State
    const [scenes, setScenes] = useState<WorkstationScene[]>([]);

    // Loading States
    const [isProcessing, setIsProcessing] = useState(false);
    const [isCommitting, setIsCommitting] = useState(false);

    // Refs for safety
    const isCommittingRef = useRef(false);

    // 1. REAL-TIME DATA SYNC
    useEffect(() => {
        if (!draftId || !projectId) return;

        const unsub = onSnapshot(doc(db, "projects", projectId, "drafts", draftId), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();

                // Only update local state if we aren't currently waiting on an AI operation
                // (Prevents jitter if Firestore updates mid-generation)
                if (!isProcessing && !isCommitting) {
                    const stableScenes = (data.scenes || []).map((s: any, i: number) => ({
                        ...s,
                        id: s.id || `scene_${i}`, // Ensure ID exists
                        scene_number: i + 1
                    }));
                    setScenes(stableScenes);
                }
            } else {
                // Draft was likely committed and deleted
                if (!isCommittingRef.current) {
                    toast.error("Draft sequence not found");
                    router.push(`/project/${projectId}/script`);
                }
            }
        });
        return () => unsub();
    }, [draftId, projectId, router, isProcessing, isCommitting]);

    // 2. HANDLER: REORDER
    const handleReorder = async (newOrder: WorkstationScene[]) => {
        // Optimistic Update
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

    // 3. HANDLER: AI REWRITE
    const handleRewrite = async (sceneId: string, instruction: string) => {
        setIsProcessing(true);
        const sceneIndex = scenes.findIndex(s => s.id === sceneId);
        if (sceneIndex === -1) return;

        const targetScene = scenes[sceneIndex];

        try {
            const res = await api.post("api/v1/script/rewrite-scene", {
                original_text: targetScene.summary,
                instruction: instruction,
                context: `Scene Heading: ${targetScene.header}`
            });

            const newText = res.data.new_text;

            // Construct new array
            const updatedScenes = [...scenes];
            updatedScenes[sceneIndex] = { ...targetScene, summary: newText };

            // Optimistic update
            setScenes(updatedScenes);

            // Persist to DB
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

    // 4. HANDLER: COMMIT (APPROVE)
    const handleCommit = async () => {
        setIsCommitting(true);
        isCommittingRef.current = true;

        try {
            await api.post("api/v1/script/commit-draft", {
                project_id: projectId,
                draft_id: draftId
            });

            toast.success("Sequence Approved");

            // Redirect to Assets to start visualizing
            router.push(`/project/${projectId}/assets`);

        } catch (e: any) {
            console.error(e);
            toast.error("Failed to finalize: " + (e.response?.data?.detail || e.message));
            setIsCommitting(false);
            isCommittingRef.current = false;
        }
    };

    return (
        <ScriptWorkstation
            // Config
            title="SEQUENCE EDITOR"
            backLink={`/project/${projectId}/script`}
            commitLabel="APPROVE SEQUENCE"

            // Data
            scenes={scenes}

            // Actions
            onReorder={handleReorder}
            onRewrite={handleRewrite}
            onCommit={handleCommit}

            // States
            isProcessing={isProcessing}
            isCommitting={isCommitting}
        />
    );
}