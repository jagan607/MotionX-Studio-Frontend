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
    GripVertical, CheckCircle2, Sparkles,
    AlignLeft, Clock, Film, Scissors, Cpu, Terminal, Activity, Loader2, ChevronDown, Layers, PlayCircle,
    ArrowLeft
} from "lucide-react";

// --- TYPES ---
export interface WorkstationScene {
    id: string;
    scene_number: number;
    header: string;
    summary: string;
    time?: string;
    [key: string]: any;
}

// --- NEW CONTEXT INTERFACE ---
export interface EpisodeContext {
    episodes: any[];
    currentEpisodeId: string;
    onSwitchEpisode: (id: string) => void;
}

interface ScriptWorkstationProps {
    title: string;
    backLink: string;
    commitLabel: string;
    customHeader?: React.ReactNode;

    // Context for Series Navigation
    episodeContext?: EpisodeContext;

    scenes: WorkstationScene[];
    onReorder: (newOrder: WorkstationScene[]) => void;
    onRewrite: (sceneId: string, instruction: string) => Promise<void>;
    onCommit: () => void;
    isProcessing: boolean;
    isCommitting: boolean;
}

export const ScriptWorkstation: React.FC<ScriptWorkstationProps> = ({
    title,
    backLink,
    commitLabel,
    customHeader,
    episodeContext,
    scenes,
    onReorder,
    onRewrite,
    onCommit,
    isProcessing,
    isCommitting
}) => {
    const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
    const [aiInstruction, setAiInstruction] = useState("");

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIndex = scenes.findIndex((i) => i.id === active.id);
            const newIndex = scenes.findIndex((i) => i.id === over.id);
            const newOrder = arrayMove(scenes, oldIndex, newIndex);
            const reindexed = newOrder.map((s, idx) => ({ ...s, scene_number: idx + 1 }));
            onReorder(reindexed);
        }
    };

    const handleExecuteAi = async () => {
        if (!activeSceneId || !aiInstruction.trim()) return;
        await onRewrite(activeSceneId, aiInstruction);
        setAiInstruction("");
    };

    const activeScene = scenes.find(s => s.id === activeSceneId);

    return (
        <div className="fixed inset-0 z-50 bg-[#050505] text-[#EEE] font-sans overflow-hidden flex flex-col">
            <style jsx global>{`
                ::-webkit-scrollbar { width: 6px; }
                ::-webkit-scrollbar-track { background: #050505; }
                ::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
                ::-webkit-scrollbar-thumb:hover { background: #555; }
                
                .action-btn { background-color: #DC2626; color: white; text-transform: uppercase; font-weight: 800; letter-spacing: 1px; transition: all 0.2s ease; border: 1px solid #EF4444; }
                .action-btn:hover { background-color: #B91C1C; box-shadow: 0 0 20px rgba(220, 38, 38, 0.4); }
                .ai-input { background: rgba(10,10,10,0.5); border: 1px solid #333; color: #EEE; font-family: 'Courier New', monospace; }
                .ai-input:focus { outline: none; border-color: #DC2626; background: rgba(20,20,20,0.8); }
                
                /* Styled Select */
                .ep-select {
                    -webkit-appearance: none;
                    background-color: transparent;
                    color: white;
                    font-size: 11px;
                    font-weight: 800;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    border: none;
                    cursor: pointer;
                    outline: none;
                    padding-right: 1.5em;
                    width: 100%;
                    text-overflow: ellipsis;
                }
                .ep-select option { background-color: #111; color: #EEE; padding: 10px; }
            `}</style>

            {/* HEADER */}
            {customHeader ? customHeader : (
                <header className="h-16 border-b border-[#222] bg-[#080808] flex items-center justify-between px-6 shrink-0 z-50">
                    {/* Fallback Header Content (Unchanged) */}
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
                        <button onClick={onCommit} disabled={isCommitting} className="action-btn px-6 py-2 text-[10px] flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                            {isCommitting ? <Sparkles size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                            {commitLabel}
                        </button>
                    </div>
                </header>
            )}

            {/* WORKSPACE */}
            <div className="flex-1 flex overflow-hidden relative z-40">

                {/* LEFT: TIMELINE */}
                <div className="flex-1 flex flex-col bg-[#050505] relative border-r border-[#222]">

                    {/* HIGHLIGHTED TOOLBAR */}
                    <div className="h-14 border-b border-[#222] bg-[#080808] flex items-center justify-between px-4 shrink-0">
                        {episodeContext && episodeContext.episodes.length > 0 ? (
                            // --- EPISODE SELECTOR (Enhanced) ---
                            <div className="flex items-center gap-3 w-full max-w-[70%]">
                                <div className="h-8 w-8 bg-red-900/20 border border-red-900/50 flex items-center justify-center rounded-sm shrink-0">
                                    <Layers size={14} className="text-red-500" />
                                </div>
                                <div className="flex-1 relative group bg-[#111] border border-[#222] hover:border-[#444] transition-colors rounded-sm h-8 flex items-center px-3">
                                    <span className="absolute -top-2 left-2 bg-[#080808] px-1 text-[8px] font-mono text-[#555] uppercase tracking-widest leading-none">
                                        Active Reel
                                    </span>
                                    <select
                                        className="ep-select"
                                        value={episodeContext.currentEpisodeId}
                                        onChange={(e) => episodeContext.onSwitchEpisode(e.target.value)}
                                    >
                                        {episodeContext.episodes.map((ep) => (
                                            <option key={ep.id} value={ep.id}>
                                                {ep.episode_number ? `#${ep.episode_number} - ` : ''}{ep.title || "UNTITLED REEL"}
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDown size={10} className="absolute right-3 text-red-600 pointer-events-none" />
                                </div>
                            </div>
                        ) : (
                            // --- STATIC HEADER ---
                            <div className="text-[10px] font-bold text-[#555] uppercase tracking-widest flex items-center gap-2">
                                <Scissors size={12} /> Timeline
                            </div>
                        )}

                        <div className="flex items-center gap-2">
                            <div className="text-[9px] font-mono text-[#444] bg-[#111] px-2 py-1 rounded-sm border border-[#222]">
                                {scenes.length} CLIPS
                            </div>
                        </div>
                    </div>

                    {/* CONTENT */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                        {scenes.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center opacity-30 gap-3">
                                <Film size={32} className="text-[#333]" />
                                <span className="text-xs font-mono">NO SCENE DATA FOUND</span>
                            </div>
                        ) : (
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
                        )}

                        {scenes.length > 0 && (
                            <div className="h-20 flex items-center justify-center border-t border-dashed border-[#222] mt-4">
                                <span className="text-[9px] font-mono text-[#333]">END OF SEQUENCE</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT: AI CONSOLE */}
                <div className="w-[400px] bg-[#080808] flex flex-col shrink-0 border-l border-[#222]">
                    <div className="h-14 border-b border-[#222] bg-[#080808] flex items-center justify-between px-6 shrink-0">
                        <div className="text-[10px] font-bold text-[#555] uppercase tracking-widest flex items-center gap-2">
                            <Cpu size={12} /> Director Console
                        </div>
                        <div className={`w-2 h-2 rounded-full ${isProcessing ? 'bg-yellow-500 animate-pulse' : 'bg-green-900'}`} />
                    </div>

                    <div className="flex-1 p-6 flex flex-col">
                        {activeScene ? (
                            <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-300">
                                <div className="mb-6 p-4 border border-[#222] bg-[#0C0C0C] rounded-sm relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-red-600" />
                                    <div className="text-[9px] font-mono text-red-500 mb-1 uppercase">Target Locked</div>
                                    <div className="text-xl font-bold text-white mb-2 line-clamp-1">
                                        SCENE {String(activeScene.scene_number).padStart(2, '0')}
                                    </div>
                                    <div className="text-[10px] text-[#888] uppercase tracking-widest font-bold truncate border-t border-[#222] pt-2 mt-2">
                                        {activeScene.header || "NO HEADER DATA"}
                                    </div>
                                </div>

                                <div className="flex-1 flex flex-col gap-4">
                                    <div className="flex items-center gap-2 text-[10px] font-bold text-[#888] uppercase">
                                        <Terminal size={12} /> Modification Prompt
                                    </div>
                                    <textarea
                                        value={aiInstruction}
                                        onChange={(e) => setAiInstruction(e.target.value)}
                                        placeholder="// Enter directorial commands...&#10;> Make the dialogue more intense&#10;> Change setting to night&#10;> Add rain effect"
                                        className="ai-input w-full flex-1 p-4 text-xs resize-none rounded-sm placeholder:text-[#444]"
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
                                        <button onClick={() => setActiveSceneId(null)} className="px-4 py-3 border border-[#333] text-[10px] font-bold text-[#666] hover:text-white hover:bg-[#111] transition-colors uppercase tracking-widest rounded-sm">
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center opacity-40 gap-4">
                                <div className="w-16 h-16 rounded-full border border-[#333] flex items-center justify-center bg-[#0A0A0A]">
                                    <PlayCircle size={24} className="text-[#666]" />
                                </div>
                                <div>
                                    <div className="text-xs font-bold text-[#666] uppercase tracking-widest mb-1">System Idle</div>
                                    <div className="text-[10px] font-mono text-[#444]">SELECT A SCENE TO MODIFY</div>
                                </div>
                            </div>
                        )}
                    </div>
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

function SortableSceneCard({ scene, index, isActive, onEdit }: any) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: scene.id });
    const style = { transform: CSS.Transform.toString(transform), transition };

    return (
        <div
            ref={setNodeRef}
            style={style}
            onClick={onEdit}
            className={`group relative flex w-full border transition-all duration-200 cursor-pointer ${isActive ? 'bg-[#111] border-[#444] border-l-2 border-l-red-600 shadow-lg z-10' : 'bg-[#0A0A0A] border-[#222] hover:border-[#444] hover:bg-[#0E0E0E]'}`}
        >
            <div {...attributes} {...listeners} className="w-8 flex items-center justify-center border-r border-[#222] cursor-grab active:cursor-grabbing hover:bg-[#151515] transition-colors" onClick={(e) => e.stopPropagation()}>
                <GripVertical size={14} className="text-[#333] group-hover:text-[#666]" />
            </div>
            <div className="flex-1 p-4 overflow-hidden">
                <div className="flex items-center gap-3 mb-2">
                    <span className={`text-lg font-mono font-bold ${isActive ? 'text-red-500' : 'text-[#444]'}`}>{String(index + 1).padStart(2, '0')}</span>
                    {/* Fallback to summary or generic text if header is completely missing */}
                    <span className="text-xs font-bold text-white uppercase tracking-wider truncate flex-1">
                        {scene.header || scene.slugline || "UNKNOWN SCENE"}
                    </span>
                    {scene.time && <span className="ml-auto text-[9px] font-mono text-[#444] bg-[#151515] px-2 py-0.5 rounded-full whitespace-nowrap">{scene.time}</span>}
                </div>
                <p className="text-xs text-[#888] leading-relaxed font-mono line-clamp-2 pl-9 border-l border-[#222]">
                    {scene.summary || scene.content || "No visual description available."}
                </p>
            </div>
            <div className={`w-10 flex items-center justify-center border-l border-[#222] transition-colors ${isActive ? 'bg-red-900/10' : 'bg-transparent'}`}>
                <Sparkles size={14} className={isActive ? 'text-red-500' : 'text-[#333] group-hover:text-[#666]'} />
            </div>
        </div>
    );
}