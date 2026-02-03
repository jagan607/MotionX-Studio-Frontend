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
import { CheckCircle2, FileText } from "lucide-react";

// --- COMPONENTS ---
import { ScriptWorkstation, WorkstationScene } from "@/app/components/script/ScriptWorkstation";
import { MotionButton } from "@/components/ui/MotionButton";

export default function DraftPage() {
    const params = useParams();
    const router = useRouter();
    const projectId = params.id as string;
    const draftId = params.draftId as string;

    // Data State
    const [scenes, setScenes] = useState<WorkstationScene[]>([]);

    // Context State (Required for Add Reference Modal)
    const [episodes, setEpisodes] = useState<any[]>([]);

    // Loading States
    const [isProcessing, setIsProcessing] = useState(false);
    const [isCommitting, setIsCommitting] = useState(false);

    // Refs for safety
    const isCommittingRef = useRef(false);

    // 1. REAL-TIME DATA SYNC (Draft)
    useEffect(() => {
        if (!draftId || !projectId) return;

        const unsub = onSnapshot(doc(db, "projects", projectId, "drafts", draftId), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();

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
                // Filter out ghost episodes if any, similar to editor page
                eps = eps.filter((e: any) => !(e.title === "Main Script" && e.synopsis === "Initial setup"));
                setEpisodes(eps);
            } catch (err) {
                console.error("Failed to load project context", err);
            }
        };
        loadContext();
    }, [projectId]);

    // 3. HANDLER: FETCH REMOTE SCENES (Enables Context Modal)
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

    // 4. HANDLER: REORDER
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

    // 5. HANDLER: AI REWRITE
    const handleRewrite = async (sceneId: string, instruction: string, contextRefs?: any[]) => {
        setIsProcessing(true);
        const sceneIndex = scenes.findIndex(s => s.id === sceneId);
        if (sceneIndex === -1) return;

        const targetScene = scenes[sceneIndex];

        try {
            // Build Payload with Context
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

    // 6. HANDLER: COMMIT (APPROVE)
    const handleCommit = async () => {
        setIsCommitting(true);
        isCommittingRef.current = true;

        try {
            await api.post("api/v1/script/commit-draft", {
                project_id: projectId,
                draft_id: draftId
            });

            toast.success("Sequence Approved");

            // --- FIX: ADD ONBOARDING PARAM ---
            router.push(`/project/${projectId}/assets?onboarding=true`);

        } catch (e: any) {
            console.error(e);
            toast.error("Failed to finalize: " + (e.response?.data?.detail || e.message));
            setIsCommitting(false);
            isCommittingRef.current = false;
        }
    };

    // --- 7. CUSTOM HEADER ---
    const DraftHeader = (
        <div className="h-20 border-b border-[#222] bg-[#080808] flex items-center justify-between px-8 shrink-0">
            {/* LEFT: TITLE ONLY (Back Removed) */}
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-3 text-[#EEE]">
                    <div>
                        <div className="text-lg font-bold tracking-wide leading-none">SCENE SEQUENCE EDITOR</div>
                        <div className="text-[10px] font-mono text-[#555] mt-1">DRAFT MODE • UNSAVED CHANGES</div>
                    </div>
                </div>
            </div>

            {/* RIGHT: APPROVE BUTTON */}
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

            // Pass episodes for context modal
            contextEpisodes={episodes}

            // Actions
            onReorder={handleReorder}
            onRewrite={handleRewrite}
            onCommit={handleCommit}

            // Enable Context Modal by passing this function
            onFetchRemoteScenes={fetchRemoteScenes}

            isProcessing={isProcessing}
            isCommitting={isCommitting}
        />
    );
}