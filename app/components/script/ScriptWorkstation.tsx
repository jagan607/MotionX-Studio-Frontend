"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
    DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent
} from '@dnd-kit/core';
import {
    SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable, arrayMove
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    ArrowLeft, GripVertical, CheckCircle2, Sparkles,
    AlignLeft, Clock, Film, Scissors, Cpu, Terminal, Activity, Loader2
} from "lucide-react";

// --- TYPES ---
export interface WorkstationScene {
    id: string;
    scene_number: number;
    header: string;
    summary: string;
    time?: string;
    [key: string]: any; // Allow flexibility for extra fields
}

interface ScriptWorkstationProps {
    // Configuration
    title: string;
    backLink: string;
    commitLabel: string;

    // NEW: Optional Custom Header (For Studio Integration)
    customHeader?: React.ReactNode;

    // Data State
    scenes: WorkstationScene[];

    // Actions
    onReorder: (newOrder: WorkstationScene[]) => void;
    onRewrite: (sceneId: string, instruction: string) => Promise<void>;
    onCommit: () => void;

    // Loading States
    isProcessing: boolean; // AI Loading
    isCommitting: boolean; // Save/Commit Loading
}

export const ScriptWorkstation: React.FC<ScriptWorkstationProps> = ({
    title,
    backLink,
    commitLabel,
    customHeader, // Destructure new prop
    scenes,
    onReorder,
    onRewrite,
    onCommit,
    isProcessing,
    isCommitting
}) => {
    const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
    const [aiInstruction, setAiInstruction] = useState("");

    // --- DRAG & DROP SENSORS ---
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), // Prevent accidental drags on click
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIndex = scenes.findIndex((i) => i.id === active.id);
            const newIndex = scenes.findIndex((i) => i.id === over.id);

            const newOrder = arrayMove(scenes, oldIndex, newIndex);

            // Re-index scene numbers locally for UI consistency immediately
            const reindexed = newOrder.map((s, idx) => ({ ...s, scene_number: idx + 1 }));

            onReorder(reindexed);
        }
    };

    // --- AI HANDLER ---
    const handleExecuteAi = async () => {
        if (!activeSceneId || !aiInstruction.trim()) return;
        await onRewrite(activeSceneId, aiInstruction);
        setAiInstruction(""); // Clear input on success
    };

    const activeScene = scenes.find(s => s.id === activeSceneId);

    return (
        <div className="fixed inset-0 z-50 bg-[#050505] text-[#EEE] font-sans overflow-hidden flex flex-col">

            {/* --- GLOBAL STYLES --- */}
            <style jsx global>{`
                ::-webkit-scrollbar { width: 6px; }
                ::-webkit-scrollbar-track { background: #050505; }
                ::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
                ::-webkit-scrollbar-thumb:hover { background: #555; }

                .action-btn {
                    background-color: #DC2626;
                    color: white;
                    text-transform: uppercase;
                    font-weight: 800;
                    letter-spacing: 1px;
                    transition: all 0.2s ease;
                    border: 1px solid #EF4444;
                }
                .action-btn:hover {
                    background-color: #B91C1C;
                    box-shadow: 0 0 20px rgba(220, 38, 38, 0.4);
                }
                .ai-input {
                    background: rgba(10,10,10,0.5);
                    border: 1px solid #333;
                    color: #EEE;
                    font-family: 'Courier New', monospace;
                }
                .ai-input:focus {
                    outline: none;
                    border-color: #DC2626;
                    background: rgba(20,20,20,0.8);
                }
            `}</style>

            {/* --- HEADER LOGIC --- */}
            {customHeader ? (
                // 1. Render Custom Studio Header if provided
                customHeader
            ) : (
                // 2. Fallback to Default Internal Header (For Ingestion/Drafts)
                <header className="h-16 border-b border-[#222] bg-[#080808] flex items-center justify-between px-6 shrink-0 z-50">
                    <div className="flex items-center gap-8">
                        <Link href={backLink} className="flex items-center gap-2 text-[#666] hover:text-white transition-colors group">
                            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                            <span className="text-[10px] font-bold tracking-[0.2em] uppercase">Back</span>
                        </Link>

                        <div className="h-6 w-[1px] bg-[#222]" />

                        <div className="flex items-center gap-3">
                            <Film size={16} className="text-red-600" />
                            <span className="text-lg font-display font-bold uppercase text-white tracking-tight">{title}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="hidden md:flex gap-6 text-[10px] font-mono text-[#444]">
                            <span className="flex items-center gap-2"><AlignLeft size={12} /> {scenes.length} SCENES</span>
                            <span className="flex items-center gap-2"><Clock size={12} /> EST. DURATION: {scenes.length * 2}M</span>
                        </div>

                        <button
                            onClick={onCommit}
                            disabled={isCommitting}
                            className="action-btn px-6 py-2 text-[10px] flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isCommitting ? <Sparkles size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                            {commitLabel}
                        </button>
                    </div>
                </header>
            )}

            {/* --- MAIN WORKSPACE --- */}
            <div className="flex-1 flex overflow-hidden relative z-40">

                {/* LEFT: TIMELINE (Scrollable) */}
                <div className="flex-1 flex flex-col bg-[#050505] relative border-r border-[#222]">
                    {/* Toolbar */}
                    <div className="h-10 border-b border-[#222] bg-[#0A0A0A] flex items-center justify-between px-4 shrink-0">
                        <div className="text-[10px] font-bold text-[#555] uppercase tracking-widest flex items-center gap-2">
                            <Scissors size={12} /> Timeline
                        </div>
                        <div className="text-[9px] font-mono text-[#333]">AUTO-SAVE: ACTIVE</div>
                    </div>

                    {/* Draggable List */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
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

                        <div className="h-20 flex items-center justify-center border-t border-dashed border-[#222] mt-4">
                            <span className="text-[9px] font-mono text-[#333]">END OF SEQUENCE</span>
                        </div>
                    </div>
                </div>

                {/* RIGHT: AI INSPECTOR (Sticky Sidebar) */}
                <div className="w-[400px] bg-[#080808] flex flex-col shrink-0">

                    {/* Inspector Header */}
                    <div className="h-10 border-b border-[#222] bg-[#0A0A0A] flex items-center justify-between px-4 shrink-0">
                        <div className="text-[10px] font-bold text-[#555] uppercase tracking-widest flex items-center gap-2">
                            <Cpu size={12} /> Director Console
                        </div>
                        <div className={`w-2 h-2 rounded-full ${isProcessing ? 'bg-yellow-500 animate-pulse' : 'bg-green-900'}`} />
                    </div>

                    {/* Inspector Content */}
                    <div className="flex-1 p-6 flex flex-col">
                        {activeScene ? (
                            <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-300">

                                {/* Selected Scene Info */}
                                <div className="mb-6 p-4 border border-[#222] bg-[#0C0C0C] rounded-sm relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-red-600" />
                                    <div className="text-[9px] font-mono text-red-500 mb-1 uppercase">Target Locked</div>
                                    <div className="text-xl font-bold text-white mb-2">
                                        SCENE {String(activeScene.scene_number).padStart(2, '0')}
                                    </div>
                                    <div className="text-[10px] text-[#666] uppercase tracking-widest truncate">
                                        {activeScene.header || "UNKNOWN HEADER"}
                                    </div>
                                </div>

                                {/* AI Input Area */}
                                <div className="flex-1 flex flex-col gap-4">
                                    <div className="flex items-center gap-2 text-[10px] font-bold text-[#888] uppercase">
                                        <Terminal size={12} /> Modification Prompt
                                    </div>

                                    <textarea
                                        value={aiInstruction}
                                        onChange={(e) => setAiInstruction(e.target.value)}
                                        placeholder="// Enter directorial commands...&#10;> Make the dialogue more intense&#10;> Change setting to night&#10;> Add rain effect"
                                        className="ai-input w-full flex-1 p-4 text-xs resize-none rounded-sm placeholder:text-[#333]"
                                    />

                                    <div className="flex gap-2 pt-4">
                                        <button
                                            onClick={handleExecuteAi}
                                            disabled={isProcessing || !aiInstruction.trim()}
                                            className="action-btn flex-1 py-3 text-[10px] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {isProcessing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                                            EXECUTE AI
                                        </button>

                                        <button
                                            onClick={() => setActiveSceneId(null)}
                                            className="px-4 py-3 border border-[#333] text-[10px] font-bold text-[#666] hover:text-white hover:bg-[#111] transition-colors uppercase tracking-widest rounded-sm"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center opacity-40 gap-4">
                                <div className="w-16 h-16 rounded-full border border-[#333] flex items-center justify-center">
                                    <Sparkles size={24} className="text-[#666]" />
                                </div>
                                <div>
                                    <div className="text-xs font-bold text-[#666] uppercase tracking-widest mb-1">System Idle</div>
                                    <div className="text-[10px] font-mono text-[#444]">SELECT A SCENE TO MODIFY</div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Bottom Status */}
                    <div className="p-4 border-t border-[#222] bg-[#050505]">
                        <div className="flex items-center gap-2 text-[9px] font-mono text-[#444]">
                            <Activity size={10} /> AI_ENGINE_V2: READY
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- SUB-COMPONENT: SORTABLE CARD ---
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
                group relative flex w-full border border-transparent transition-all duration-200 cursor-pointer
                ${isActive
                    ? 'bg-[#111] border-[#333] border-l-2 border-l-red-600 shadow-lg z-10'
                    : 'bg-[#0A0A0A] border-[#222] hover:border-[#444] hover:bg-[#0E0E0E]'}
            `}
        >
            {/* Grip Handle */}
            <div
                {...attributes} {...listeners}
                className="w-8 flex items-center justify-center border-r border-[#222] cursor-grab active:cursor-grabbing hover:bg-[#151515] transition-colors"
                onClick={(e) => e.stopPropagation()}
            >
                <GripVertical size={14} className="text-[#333] group-hover:text-[#666]" />
            </div>

            {/* Content */}
            <div className="flex-1 p-4">
                <div className="flex items-center gap-3 mb-2">
                    <span className={`text-lg font-mono font-bold ${isActive ? 'text-red-500' : 'text-[#444]'}`}>
                        {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                        {scene.header}
                    </span>
                    {scene.time && (
                        <span className="ml-auto text-[9px] font-mono text-[#444] bg-[#151515] px-2 py-0.5 rounded-full">
                            {scene.time}
                        </span>
                    )}
                </div>

                <p className="text-xs text-[#888] leading-relaxed font-mono line-clamp-2 pl-9 border-l border-[#222]">
                    {scene.summary}
                </p>
            </div>

            {/* Edit Trigger */}
            <div className={`w-10 flex items-center justify-center border-l border-[#222] transition-colors ${isActive ? 'bg-red-900/10' : 'bg-transparent'}`}>
                <Sparkles size={14} className={isActive ? 'text-red-500' : 'text-[#333] group-hover:text-[#666]'} />
            </div>
        </div>
    );
}