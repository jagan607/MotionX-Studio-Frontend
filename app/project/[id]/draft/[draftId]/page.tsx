"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent
} from '@dnd-kit/core';
import {
    SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { arrayMove } from "@dnd-kit/sortable";
import {
    ArrowLeft, GripVertical, CheckCircle, Sparkles, X, FileText, Cpu
} from "lucide-react";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "react-hot-toast";
import { api } from "@/lib/api";

// --- DESIGN SYSTEM IMPORTS ---
import { StudioLayout } from "@/components/ui/StudioLayout";
import { MotionButton } from "@/components/ui/MotionButton";
import Link from "next/link";

// --- TYPES ---
interface DraftScene {
    id: string;
    scene_number: number;
    header: string;
    summary: string;
    visual_prompt?: string;
    time?: string;
    characters?: string[];
}

export default function ScriptLab() {
    const params = useParams();
    const router = useRouter();
    const projectId = params.id as string;
    const draftId = params.draftId as string;

    const [draft, setDraft] = useState<any>(null);
    const [scenes, setScenes] = useState<DraftScene[]>([]);
    const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
    const [aiInstruction, setAiInstruction] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);
    const [isCommitting, setIsCommitting] = useState(false);

    // 1. REAL-TIME SYNC (Targeting Projects Collection)
    useEffect(() => {
        if (!draftId || !projectId) return;

        const unsub = onSnapshot(doc(db, "projects", projectId, "drafts", draftId), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setDraft(data);

                // Update scenes state only if not currently dragging/processing to avoid jitter
                if (!isProcessing) {
                    const stableScenes = (data.scenes || []).map((s: any, i: number) => ({
                        ...s,
                        id: s.id || `scene_${i}` // Fallback ID
                    }));
                    setScenes(stableScenes);
                }
            } else {
                toast.error("Draft not found");
                router.push(`/project/${projectId}/script`);
            }
        });
        return () => unsub();
    }, [draftId, projectId, router, isProcessing]);

    // 2. DRAG & DROP CONFIG
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIndex = scenes.findIndex((i) => i.id === active.id);
            const newIndex = scenes.findIndex((i) => i.id === over.id);

            const newOrder = arrayMove(scenes, oldIndex, newIndex);

            // Re-index scene numbers
            const reindexed = newOrder.map((s, idx) => ({ ...s, scene_number: idx + 1 }));
            setScenes(reindexed); // Optimistic update

            // Persist
            try {
                await updateDoc(doc(db, "projects", projectId, "drafts", draftId), {
                    scenes: reindexed
                });
            } catch (e) {
                toast.error("Failed to save order");
            }
        }
    };

    // 3. AI REWRITE
    const handleAiRewrite = async () => {
        if (!activeSceneId || !aiInstruction) {
            toast.error("Select a scene and enter instructions");
            return;
        }

        setIsProcessing(true);
        const sceneIndex = scenes.findIndex(s => s.id === activeSceneId);
        const targetScene = scenes[sceneIndex];

        try {
            const res = await api.post("api/v1/script/rewrite-scene", {
                original_text: targetScene.summary,
                instruction: aiInstruction,
                context: `Scene Heading: ${targetScene.header}`
            });

            const newText = res.data.new_text;

            // Optimistic Update
            const updatedScenes = [...scenes];
            updatedScenes[sceneIndex] = { ...targetScene, summary: newText };
            setScenes(updatedScenes);

            // DB Update
            await updateDoc(doc(db, "projects", projectId, "drafts", draftId), {
                scenes: updatedScenes
            });

            setAiInstruction("");
            toast.success("Scene rewritten.");
        } catch (e) {
            console.error(e);
            toast.error("AI Rewrite Failed");
        } finally {
            setIsProcessing(false);
        }
    };

    // 4. COMMIT DRAFT
    const handleCommit = async () => {
        setIsCommitting(true);
        try {
            await api.post("api/v1/script/commit-draft", {
                project_id: projectId,
                draft_id: draftId
            });

            toast.success("Sequence Approved");
            // Redirect to Stage 4: Assets
            router.push(`/project/${projectId}/assets`);

        } catch (e: any) {
            console.error(e);
            toast.error("Failed to finalize: " + (e.response?.data?.detail || e.message));
            setIsCommitting(false);
        }
    };

    return (
        <StudioLayout>
            {/* NAV */}
            <div className="flex items-center justify-between mb-8">
                <Link href={`/project/${projectId}/script`} className="inline-flex items-center gap-2 text-[10px] font-bold tracking-[2px] text-motion-text-muted hover:text-motion-text transition-colors">
                    <ArrowLeft size={14} /> BACK TO SCRIPT
                </Link>

                <div className="flex items-center gap-2 text-[10px] font-mono text-motion-red bg-motion-red/10 px-3 py-1 border border-motion-red/20">
                    <FileText size={12} /> SCRIPT LAB // STAGING
                </div>
            </div>

            {/* HEADER */}
            <div className="flex items-end justify-between mb-12 border-b border-motion-border pb-6">
                <div>
                    <h1 className="text-4xl font-display uppercase mb-2">{draft?.title || "UNTITLED SEQUENCE"}</h1>
                    <p className="text-motion-text-muted text-xs font-mono tracking-widest">
                        SCENES: {scenes.length} // DETECTED CAST: {draft?.detected_characters?.length || 0}
                    </p>
                </div>

                <div className="w-[200px]">
                    <MotionButton onClick={handleCommit} loading={isCommitting}>
                        <CheckCircle size={16} /> APPROVE SEQUENCE
                    </MotionButton>
                </div>
            </div>

            {/* MAIN GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* LEFT: DRAGGABLE LIST */}
                <div className="lg:col-span-2 space-y-4">
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext items={scenes} strategy={verticalListSortingStrategy}>
                            {scenes.map((scene, i) => (
                                <SortableSceneCard
                                    key={scene.id}
                                    scene={scene}
                                    index={i}
                                    isActive={activeSceneId === scene.id}
                                    onEdit={() => setActiveSceneId(scene.id)}
                                />
                            ))}
                        </SortableContext>
                    </DndContext>
                </div>

                {/* RIGHT: AI DIRECTOR (Sticky) */}
                <div className="lg:col-span-1">
                    <div className="sticky top-8 bg-motion-surface border border-motion-border p-6">
                        <div className="flex items-center gap-2 text-[10px] font-bold tracking-[2px] text-motion-red mb-6">
                            <Cpu size={14} /> AI DIRECTOR
                        </div>

                        {activeSceneId ? (
                            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                                <div className="mb-4 text-xs text-motion-text-muted border-b border-motion-border pb-3">
                                    <span className="text-white font-bold">MODIFYING: </span>
                                    SCENE {scenes.find(s => s.id === activeSceneId)?.scene_number}
                                </div>

                                <textarea
                                    value={aiInstruction}
                                    onChange={(e) => setAiInstruction(e.target.value)}
                                    placeholder="Enter instructions (e.g., 'Make the dialogue more tense', 'Change setting to night')..."
                                    className="w-full h-32 bg-motion-bg border border-motion-border p-4 text-xs text-motion-text placeholder:text-motion-text-muted focus:outline-none focus:border-motion-red resize-none mb-4"
                                />

                                <MotionButton onClick={handleAiRewrite} loading={isProcessing} variant="outline" className="mb-3">
                                    <Sparkles size={14} /> EXECUTE REWRITE
                                </MotionButton>

                                <button
                                    onClick={() => setActiveSceneId(null)}
                                    className="w-full text-center text-[10px] font-bold tracking-widest text-motion-text-muted hover:text-white transition-colors"
                                >
                                    CANCEL SELECTION
                                </button>
                            </div>
                        ) : (
                            <div className="border border-dashed border-motion-border p-8 text-center">
                                <Sparkles size={24} className="text-motion-text-muted mx-auto mb-4 opacity-50" />
                                <div className="text-[10px] font-bold tracking-widest text-motion-text-muted">
                                    SELECT A SCENE TO MODIFY WITH AI
                                </div>
                            </div>
                        )}
                    </div>
                </div>

            </div>

            <div className="h-20" />
        </StudioLayout>
    );
}

// --- SUB-COMPONENT: Sortable Card ---
function SortableSceneCard({ scene, index, isActive, onEdit }: any) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: scene.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`
                group relative flex gap-4 p-6 border transition-all duration-200
                ${isActive
                    ? 'bg-motion-surface border-motion-red shadow-[0_0_30px_rgba(255,0,0,0.1)]'
                    : 'bg-transparent border-motion-border hover:border-motion-text/50'}
            `}
        >
            {/* Drag Handle */}
            <div
                {...attributes} {...listeners}
                className="cursor-grab text-motion-text-muted hover:text-white flex items-start pt-1 outline-none"
            >
                <GripVertical size={18} />
            </div>

            {/* Content */}
            <div className="flex-1 cursor-default" onClick={onEdit}>
                <div className={`text-[10px] font-mono font-bold tracking-wider mb-2 ${isActive ? 'text-motion-red' : 'text-motion-text-muted'}`}>
                    SCENE {String(index + 1).padStart(2, '0')} // {scene.header} // {scene.time}
                </div>
                <div className="text-sm text-motion-text leading-relaxed font-sans opacity-90">
                    {scene.summary}
                </div>
            </div>

            {/* Edit Trigger */}
            <button
                onClick={(e) => { e.stopPropagation(); onEdit(); }}
                className={`
                    w-8 h-8 flex items-center justify-center border transition-all
                    ${isActive
                        ? 'bg-motion-red border-motion-red text-white'
                        : 'bg-transparent border-motion-border text-motion-text-muted hover:text-white hover:border-white'}
                `}
            >
                <Sparkles size={14} />
            </button>
        </div>
    );
}