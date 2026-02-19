"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors
} from '@dnd-kit/core';
import {
    SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { arrayMove } from "@dnd-kit/sortable";
import {
    ArrowLeft, Save, Sparkles, GripVertical, CheckCircle, Trash2, XCircle, Loader2, FileCode
} from "lucide-react";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toastError, toastSuccess } from "@/lib/toast";
import { API_BASE_URL } from "@/lib/config";

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
    const { id: seriesId, draftId } = useParams() as { id: string, draftId: string };
    const router = useRouter();

    const [draft, setDraft] = useState<any>(null);
    const [scenes, setScenes] = useState<DraftScene[]>([]);
    const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
    const [aiInstruction, setAiInstruction] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);

    // 1. REAL-TIME SYNC & PERSISTENCE
    useEffect(() => {
        if (!draftId) return;
        const unsub = onSnapshot(doc(db, "series", seriesId, "drafts", draftId), (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                setDraft(data);

                // Ensure scenes have stable IDs for Drag & Drop
                // We only update state if it's a fresh load to avoid jitter during drag
                if (!isProcessing) {
                    const stableScenes = (data.scenes || []).map((s: any, i: number) => ({
                        ...s,
                        id: s.id || `scene_${i}_${Date.now()}`
                    }));
                    setScenes(stableScenes);
                }
            } else {
                toastError("Draft not found");
                router.push(`/series/${seriesId}`);
            }
        });
        return () => unsub();
    }, [draftId, seriesId, router]);

    // 2. DRAG & DROP SENSORS
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragEnd = async (event: any) => {
        const { active, over } = event;
        if (active.id !== over.id) {
            setScenes((items) => {
                const oldIndex = items.findIndex((i) => i.id === active.id);
                const newIndex = items.findIndex((i) => i.id === over.id);
                const newOrder = arrayMove(items, oldIndex, newIndex);

                // Update Scene Numbers based on new order
                const reindexed = newOrder.map((s, idx) => ({ ...s, scene_number: idx + 1 }));

                // Persist to Firestore
                updateDoc(doc(db, "series", seriesId, "drafts", draftId), {
                    scenes: reindexed
                }).catch(() => toastError("Failed to save order"));

                return reindexed;
            });
        }
    };

    // 3. AI REWRITE LOGIC
    const handleAiRewrite = async () => {
        if (!activeSceneId || !aiInstruction) return toastError("Select a scene and enter instructions");

        setIsProcessing(true);

        const sceneIndex = scenes.findIndex(s => s.id === activeSceneId);
        if (sceneIndex === -1) return;

        const targetScene = scenes[sceneIndex];

        try {
            const res = await fetch(`${API_BASE_URL}/api/v1/script/rewrite-scene`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    original_text: targetScene.summary,
                    instruction: aiInstruction,
                    context: `Scene Heading: ${targetScene.header}`
                })
            });

            const data = await res.json();
            if (data.status !== 'success') throw new Error(data.detail || "Rewrite failed");

            // Update Local State Optimistically
            const updatedScenes = [...scenes];
            updatedScenes[sceneIndex] = { ...targetScene, summary: data.new_text };
            setScenes(updatedScenes);

            // Save to DB
            await updateDoc(doc(db, "series", seriesId, "drafts", draftId), {
                scenes: updatedScenes
            });

            setAiInstruction("");
            setActiveSceneId(null);
            toastSuccess("Scene rewritten successfully");

        } catch (e) {
            console.error(e);
            toastError("AI Rewrite Failed");
        } finally {
            setIsProcessing(false);
        }
    };

    // 4. COMMIT / APPROVE LOGIC
    const handleCommit = async () => {
        setIsProcessing(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/v1/script/commit-draft`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ series_id: seriesId, draft_id: draftId })
            });

            const data = await res.json();

            if (data.status === 'success') {
                toastSuccess("Sequence Approved & Created");
                // Give a small delay for user to see success
                setTimeout(() => {
                    router.push(`/series/${seriesId}`);
                }, 500);
            } else {
                throw new Error(data.detail || "Commit failed");
            }
        } catch (e: any) {
            console.error(e);
            toastError(e.message || "Failed to Finalize Sequence");
            setIsProcessing(false);
        }
    };

    // --- STYLES ---
    const containerStyle = { backgroundColor: '#030303', minHeight: '100vh', padding: '40px 60px', color: '#EEE', fontFamily: 'Inter, sans-serif' };

    return (
        <div style={containerStyle}>

            {/* HEADER */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '40px', alignItems: 'center', borderBottom: '1px solid #222', paddingBottom: '20px' }}>
                <div style={{ display: 'flex', gap: '30px', alignItems: 'center' }}>

                    {/* ABORT BUTTON */}
                    <button
                        onClick={() => router.push(`/series/${seriesId}`)}
                        style={{
                            background: 'transparent', border: '1px solid #333', color: '#666',
                            padding: '12px 20px', cursor: 'pointer', display: 'flex',
                            alignItems: 'center', gap: '8px', fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#666'; e.currentTarget.style.color = '#FFF'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#333'; e.currentTarget.style.color = '#666'; }}
                    >
                        <XCircle size={16} /> EXIT LAB
                    </button>

                    <div>
                        <div style={{ fontSize: '10px', color: '#E50914', letterSpacing: '2px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <FileCode size={12} /> SCRIPT LAB // STAGING
                        </div>
                        <h1 style={{ fontFamily: 'Anton, sans-serif', fontSize: '32px', textTransform: 'uppercase', margin: 0, color: 'white' }}>
                            {draft?.title || "UNTITLED WORKSPACE"}
                        </h1>
                    </div>
                </div>

                {/* COMMIT BUTTON */}
                <button
                    onClick={handleCommit}
                    disabled={isProcessing}
                    style={{
                        backgroundColor: '#FFFFFF', color: 'black', border: 'none',
                        padding: '15px 40px', fontWeight: 'bold', letterSpacing: '1px', fontSize: '12px',
                        cursor: isProcessing ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', gap: '10px',
                        opacity: isProcessing ? 0.5 : 1,
                        boxShadow: '0 0 20px rgba(0, 255, 65, 0.2)'
                    }}
                >
                    {isProcessing ? <Loader2 className="force-spin" size={18} /> : <CheckCircle size={18} />}
                    {isProcessing ? "PROCESSING..." : "APPROVE SEQUENCE"}
                </button>
            </div>

            {/* WORKSPACE GRID */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '40px' }}>

                {/* LEFT: DRAGGABLE SCENE LIST */}
                <div>
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext items={scenes} strategy={verticalListSortingStrategy}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                {scenes.map((scene, i) => (
                                    <SortableSceneCard
                                        key={scene.id}
                                        scene={scene}
                                        index={i}
                                        isActive={activeSceneId === scene.id}
                                        onEdit={() => setActiveSceneId(scene.id)}
                                    />
                                ))}
                            </div>
                        </SortableContext>
                    </DndContext>
                </div>

                {/* RIGHT: AI MODIFIER PANEL (Sticky) */}
                <div style={{ position: 'sticky', top: '40px', height: 'fit-content' }}>
                    <div style={{
                        border: '1px solid #222', padding: '30px', backgroundColor: '#080808',
                        boxShadow: '0 10px 40px rgba(0,0,0,0.5)', borderRadius: '4px'
                    }}>
                        <div style={{ fontSize: '10px', color: '#E50914', marginBottom: '20px', letterSpacing: '2px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Sparkles size={12} /> AI DIRECTOR
                        </div>

                        {activeSceneId ? (
                            <>
                                <div style={{ marginBottom: '20px', fontSize: '13px', color: '#AAA', borderBottom: '1px solid #222', paddingBottom: '15px' }}>
                                    <span style={{ color: '#E50914', fontWeight: 'bold' }}>MODIFYING: </span>
                                    SCENE {scenes.find(s => s.id === activeSceneId)?.scene_number}
                                </div>

                                <textarea
                                    value={aiInstruction}
                                    onChange={(e) => setAiInstruction(e.target.value)}
                                    placeholder="Instructions (e.g., 'Make the dialogue more tense', 'Change setting to night', 'Add a plot twist')..."
                                    style={{
                                        width: '100%', height: '120px', backgroundColor: '#111',
                                        border: '1px solid #333', color: 'white', padding: '15px',
                                        fontSize: '13px', fontFamily: 'Inter, sans-serif', marginBottom: '20px',
                                        outline: 'none', resize: 'none', lineHeight: '1.5'
                                    }}
                                />

                                <button
                                    onClick={handleAiRewrite}
                                    disabled={isProcessing}
                                    style={{
                                        width: '100%', padding: '15px', backgroundColor: '#E50914',
                                        color: 'white', border: 'none', cursor: isProcessing ? 'not-allowed' : 'pointer',
                                        display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px',
                                        fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', opacity: isProcessing ? 0.7 : 1
                                    }}
                                >
                                    {isProcessing ? <Loader2 className="force-spin" size={14} /> : <Sparkles size={14} />}
                                    EXECUTE REWRITE
                                </button>

                                <button
                                    onClick={() => setActiveSceneId(null)}
                                    style={{ marginTop: '15px', width: '100%', background: 'none', border: 'none', color: '#666', fontSize: '10px', cursor: 'pointer', fontWeight: 'bold', letterSpacing: '1px' }}
                                >
                                    CANCEL SELECTION
                                </button>
                            </>
                        ) : (
                            <div style={{
                                border: '1px dashed #222', padding: '60px 20px', textAlign: 'center', color: '#444', fontSize: '12px',
                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px'
                            }}>
                                <Sparkles size={24} style={{ opacity: 0.2 }} />
                                SELECT A SCENE FROM THE LEFT TO MODIFY WITH AI
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}

// --- SUB-COMPONENT: Sortable Card ---
function SortableSceneCard({ scene, index, isActive, onEdit }: any) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: scene.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        // Blue/Cyan Theme for Active State
        backgroundColor: isActive ? 'rgba(6, 182, 212, 0.05)' : '#080808',
        border: isActive ? '1px solid #E50914' : '1px solid #1A1A1A',
        padding: '25px',
        cursor: 'default',
        display: 'flex',
        gap: '20px',
        marginBottom: '0', // Handled by gap in parent
        position: 'relative' as const,
        boxShadow: isActive ? '0 0 20px rgba(6, 182, 212, 0.1)' : 'none'
    };

    return (
        <div ref={setNodeRef} style={style}>
            {/* Drag Handle */}
            <div
                {...attributes} {...listeners}
                style={{ cursor: 'grab', color: isActive ? '#E50914' : '#444', display: 'flex', alignItems: 'center', paddingRight: '10px' }}
                title="Drag to Reorder"
            >
                <GripVertical size={20} />
            </div>

            {/* Content */}
            <div style={{ flex: 1 }}>
                <div style={{
                    fontSize: '10px',
                    color: isActive ? '#E50914' : '#666',
                    fontFamily: 'monospace', marginBottom: '8px', fontWeight: 'bold', letterSpacing: '1px'
                }}>
                    SCENE {index + 1} // {scene.header} // {scene.time}
                </div>
                <div style={{
                    fontSize: '14px', lineHeight: '1.6',
                    color: isActive ? '#FFF' : '#CCC',
                    fontFamily: 'Inter, sans-serif'
                }}>
                    {scene.summary}
                </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', alignItems: 'center', paddingLeft: '20px', borderLeft: '1px solid #222' }}>
                <button
                    onClick={onEdit}
                    title="Edit with AI"
                    style={{
                        background: isActive ? '#E50914' : 'transparent',
                        border: isActive ? 'none' : '1px solid #333',
                        borderRadius: '4px',
                        width: '36px', height: '36px', display: 'flex', alignItems: 'center',
                        justifyContent: 'center',
                        color: isActive ? 'white' : '#666',
                        cursor: 'pointer', transition: 'all 0.2s'
                    }}
                >
                    <Sparkles size={16} />
                </button>
            </div>
        </div>
    );
}