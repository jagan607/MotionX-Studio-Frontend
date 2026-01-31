"use client";

import React, { useState, useEffect, useRef } from "react";
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
    ArrowLeft, GripVertical, CheckCircle, Sparkles, X, FileText, Cpu, AlignLeft, Hash, Clock
} from "lucide-react";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "react-hot-toast";
import { api } from "@/lib/api";
import Link from "next/link";

// --- DESIGN SYSTEM IMPORTS ---
import { StudioLayout } from "@/components/ui/StudioLayout";
import { MotionButton } from "@/components/ui/MotionButton";

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

    // Intent tracking
    const [isCommitting, setIsCommitting] = useState(false);
    const isCommittingRef = useRef(false);

    // 1. REAL-TIME SYNC
    useEffect(() => {
        if (!draftId || !projectId) return;

        const unsub = onSnapshot(doc(db, "projects", projectId, "drafts", draftId), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setDraft(data);

                if (!isProcessing) {
                    const stableScenes = (data.scenes || []).map((s: any, i: number) => ({
                        ...s,
                        id: s.id || `scene_${i}`
                    }));
                    setScenes(stableScenes);
                }
            } else {
                if (!isCommittingRef.current) {
                    toast.error("Draft not found");
                    router.push(`/project/${projectId}/script`);
                }
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
            const reindexed = newOrder.map((s, idx) => ({ ...s, scene_number: idx + 1 }));
            setScenes(reindexed);

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
            const updatedScenes = [...scenes];
            updatedScenes[sceneIndex] = { ...targetScene, summary: newText };
            setScenes(updatedScenes);

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
        isCommittingRef.current = true;

        try {
            await api.post("api/v1/script/commit-draft", {
                project_id: projectId,
                draft_id: draftId
            });

            toast.success("Sequence Approved");
            router.push(`/project/${projectId}/assets`);

        } catch (e: any) {
            console.error(e);
            toast.error("Failed to finalize: " + (e.response?.data?.detail || e.message));
            setIsCommitting(false);
            isCommittingRef.current = false;
        }
    };

    return (
        <StudioLayout>
            <div className="min-h-screen bg-[#050505] text-[#EEE] font-sans selection:bg-red-900/30 p-8 pb-32">

                {/* --- HEADER --- */}
                <header className="flex flex-col xl:flex-row justify-between items-start xl:items-end mb-10 gap-6 border-b border-[#222] pb-6">
                    <div className="w-full xl:w-auto">
                        <Link href={`/project/${projectId}/script`} className="inline-flex items-center gap-2 text-[10px] font-bold tracking-[2px] text-[#555] hover:text-white mb-4 transition-colors group">
                            <ArrowLeft size={12} className="group-hover:-translate-x-1 transition-transform" /> SCRIPT SOURCE
                        </Link>

                        <div className="flex items-center gap-3 mb-2">
                            <div className="h-2 w-2 bg-red-600 animate-pulse rounded-full" />
                            <h1 className="text-4xl font-display font-bold uppercase tracking-tighter text-white leading-none">
                                SEQUENCE <span className="text-[#333]">EDITOR</span>
                            </h1>
                        </div>

                        <div className="flex gap-6 mt-2 text-xs font-mono text-[#666]">
                            <span className="flex items-center gap-2"><AlignLeft size={12} /> {draft?.title || "UNTITLED"}</span>
                            <span className="flex items-center gap-2"><Hash size={12} /> {scenes.length} SCENES</span>
                            <span className="flex items-center gap-2"><Clock size={12} /> EST. {scenes.length * 2} MINS</span>
                        </div>
                    </div>

                    <div className="w-full xl:w-auto">
                        <MotionButton onClick={handleCommit} loading={isCommitting} className="w-full xl:w-auto px-8 py-3 text-xs tracking-[0.2em] font-bold">
                            <CheckCircle size={14} className="mr-2" /> APPROVE SEQUENCE
                        </MotionButton>
                    </div>
                </header>

                {/* --- MAIN WORKSPACE --- */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[calc(100vh-250px)]">

                    {/* LEFT: SCENE TIMELINE (Scrollable) */}
                    <div className="lg:col-span-8 flex flex-col h-full overflow-hidden">
                        <div className="bg-[#0A0A0A] border border-[#222] p-2 flex items-center justify-between mb-4">
                            <span className="text-[10px] font-bold uppercase text-[#666] tracking-widest pl-2">Timeline Strip</span>
                            <span className="text-[10px] font-mono text-[#444]">AUTO-SAVE ENABLED</span>
                        </div>

                        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3 pb-20">
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
                    </div>

                    {/* RIGHT: AI CONSOLE (Sticky) */}
                    <div className="lg:col-span-4 h-full flex flex-col">
                        <div className="bg-[#0E0E0E] border border-[#222] h-full flex flex-col">

                            {/* Console Header */}
                            <div className="h-10 border-b border-[#222] bg-[#111] flex items-center px-4 justify-between shrink-0">
                                <div className="flex items-center gap-2">
                                    <Cpu size={14} className="text-red-600" />
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#AAA]">Director AI</span>
                                </div>
                                <div className="h-1.5 w-1.5 bg-green-500 rounded-full shadow-[0_0_5px_#22c55e]" />
                            </div>

                            {/* Console Content */}
                            <div className="flex-1 p-6 flex flex-col">
                                {activeSceneId ? (
                                    <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-2 duration-300">
                                        <div className="mb-6">
                                            <div className="text-[9px] font-mono text-[#555] uppercase mb-1">TARGET LOCK</div>
                                            <div className="text-sm font-bold text-white border-l-2 border-red-600 pl-3 py-1">
                                                SCENE {String(scenes.find(s => s.id === activeSceneId)?.scene_number).padStart(2, '0')}
                                            </div>
                                        </div>

                                        <div className="flex-1 flex flex-col gap-4">
                                            <div className="relative group flex-1">
                                                <div className="absolute top-0 left-0 text-[9px] font-mono bg-[#0E0E0E] px-2 text-[#666] -mt-2 ml-2">INSTRUCTION INPUT</div>
                                                <textarea
                                                    value={aiInstruction}
                                                    onChange={(e) => setAiInstruction(e.target.value)}
                                                    placeholder="// Enter directorial commands...&#10;> Make it darker&#10;> Add rain&#10;> Remove dialogue"
                                                    className="w-full h-full bg-[#050505] border border-[#333] p-4 text-xs font-mono text-[#DDD] placeholder-[#333] focus:border-red-600 focus:outline-none transition-colors resize-none leading-relaxed"
                                                />
                                            </div>

                                            <MotionButton onClick={handleAiRewrite} loading={isProcessing} className="w-full py-4 text-xs font-bold tracking-[0.1em]">
                                                <Sparkles size={14} className="mr-2" /> EXECUTE REWRITE
                                            </MotionButton>

                                            <button
                                                onClick={() => setActiveSceneId(null)}
                                                className="text-[10px] font-bold text-[#444] hover:text-[#888] tracking-widest uppercase py-2 transition-colors border border-transparent hover:border-[#222]"
                                            >
                                                CANCEL OPERATION
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-center opacity-50 space-y-4">
                                        <div className="h-16 w-16 border border-[#333] rounded-full flex items-center justify-center bg-[#050505]">
                                            <Sparkles size={24} className="text-[#333]" />
                                        </div>
                                        <div>
                                            <div className="text-xs font-bold text-[#666] uppercase tracking-widest mb-1">System Idle</div>
                                            <div className="text-[10px] font-mono text-[#444]">SELECT A SCENE STRIP TO BEGIN</div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </StudioLayout>
    );
}

// --- SUB-COMPONENT: SCENE STRIP ---
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
            onClick={onEdit}
            className={`
                group relative flex items-stretch border-l-2 transition-all duration-200 cursor-pointer
                ${isActive
                    ? 'bg-[#111] border-l-red-600 border-y border-r border-y-[#222] border-r-[#222] shadow-[0_0_20px_rgba(0,0,0,0.5)] z-10 scale-[1.01]'
                    : 'bg-[#080808] border-l-[#333] border-y border-r border-transparent hover:bg-[#0C0C0C] hover:border-y-[#222] hover:border-r-[#222]'}
            `}
        >
            {/* Drag Handle */}
            <div
                {...attributes} {...listeners}
                className="w-10 bg-[#050505] border-r border-[#222] flex items-center justify-center cursor-grab active:cursor-grabbing text-[#333] hover:text-[#666] transition-colors"
                onClick={(e) => e.stopPropagation()}
            >
                <GripVertical size={16} />
            </div>

            {/* Scene Info */}
            <div className="flex-1 p-4">
                <div className="flex items-baseline gap-3 mb-2 border-b border-[#222] pb-2">
                    <span className={`text-lg font-display font-bold ${isActive ? 'text-red-600' : 'text-[#444] group-hover:text-[#666]'}`}>
                        {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className={`text-xs font-bold uppercase tracking-wider ${isActive ? 'text-white' : 'text-[#888]'}`}>
                        {scene.header}
                    </span>
                    <span className="ml-auto text-[9px] font-mono text-[#444] uppercase">{scene.time || "N/A"}</span>
                </div>

                <p className={`text-sm leading-relaxed font-serif ${isActive ? 'text-[#CCC]' : 'text-[#666]'}`}>
                    {scene.summary}
                </p>
            </div>

            {/* Status Indicator / Edit Icon */}
            <div className={`w-12 flex items-center justify-center border-l border-[#222] transition-colors ${isActive ? 'bg-red-900/10' : 'bg-transparent'}`}>
                {isActive ? (
                    <div className="h-2 w-2 bg-red-600 rounded-full shadow-[0_0_8px_#DC2626]" />
                ) : (
                    <Sparkles size={14} className="text-[#333] group-hover:text-[#666]" />
                )}
            </div>
        </div>
    );
}