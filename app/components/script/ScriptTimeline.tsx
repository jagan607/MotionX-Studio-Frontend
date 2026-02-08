"use client";

import React, { useState } from "react";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent
} from '@dnd-kit/core';
import {
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    arrayMove
} from '@dnd-kit/sortable';
import { Layers, Scissors, Clock, Film, Plus, ChevronDown } from "lucide-react";

// INTERNAL IMPORTS
import { SortableSceneCard } from "./SortableSceneCard";
import { WorkstationScene, EpisodeContext } from "./ScriptWorkstation";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";

interface ScriptTimelineProps {
    scenes: WorkstationScene[];
    activeSceneId: string | null;
    episodeContext?: EpisodeContext;
    onSetActiveScene: (id: string) => void;
    onReorder: (newOrder: WorkstationScene[]) => void;
    onAddScene?: () => void;
    onDeleteScene?: (id: string) => Promise<void> | void;

    // NEW: Accept custom footer controls
    customFooter?: React.ReactNode;
}

export const ScriptTimeline: React.FC<ScriptTimelineProps> = ({
    scenes,
    activeSceneId,
    episodeContext,
    onSetActiveScene,
    onReorder,
    onAddScene,
    onDeleteScene,
    customFooter // <--- Destructure new prop
}) => {
    // --- STATE FOR DELETE MODAL ---
    const [sceneToDelete, setSceneToDelete] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

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
            // Re-index scene numbers
            const reindexed = newOrder.map((s, idx) => ({ ...s, scene_number: idx + 1 }));
            onReorder(reindexed);
        }
    };

    // --- HANDLER: CONFIRM DELETE ---
    const confirmDelete = async () => {
        if (!sceneToDelete || !onDeleteScene) return;

        setIsDeleting(true);
        try {
            await onDeleteScene(sceneToDelete);
        } catch (error) {
            console.error("Delete failed", error);
        } finally {
            setIsDeleting(false);
            setSceneToDelete(null);
        }
    };

    // Calculate approx duration (1 min per 200 words is standard screenplay rule)
    const totalWords = scenes.reduce((acc, s) => acc + (s.summary?.split(" ").length || 0), 0);
    const estDuration = Math.ceil(totalWords / 200);

    return (
        <>
            {/* DELETE MODAL */}
            {sceneToDelete && (
                <DeleteConfirmModal
                    title="DELETE SCENE?"
                    message="This will permanently delete this scene description and all associated metadata. This action cannot be undone."
                    isDeleting={isDeleting}
                    onConfirm={confirmDelete}
                    onCancel={() => setSceneToDelete(null)}
                />
            )}

            <div className="flex-1 flex flex-col bg-[#050505] relative border-r border-[#222]">

                {/* --- TOOLBAR --- */}
                <div className="h-14 border-b border-[#222] bg-[#080808] flex items-center justify-between px-4 shrink-0">
                    {episodeContext && episodeContext.episodes.length > 0 ? (
                        <div className="flex items-center gap-3 w-full max-w-[70%]">
                            <div className="h-8 w-8 bg-red-900/20 border border-red-900/50 flex items-center justify-center rounded-sm shrink-0">
                                <Layers size={14} className="text-red-500" />
                            </div>
                            <div className="flex-1 relative group bg-[#111] border border-[#222] hover:border-[#444] transition-colors rounded-sm h-8 flex items-center px-3">
                                <span className="absolute -top-2 left-2 bg-[#080808] px-1 text-[8px] font-mono text-[#555] uppercase tracking-widest leading-none">
                                    Active Reel
                                </span>
                                <select
                                    className="absolute inset-0 opacity-0 cursor-pointer w-full"
                                    value={episodeContext.currentEpisodeId}
                                    onChange={(e) => episodeContext.onSwitchEpisode(e.target.value)}
                                >
                                    {episodeContext.episodes.map((ep) =>
                                        <option key={ep.id} value={ep.id}>{ep.title}</option>
                                    )}
                                </select>
                                <div className="flex items-center justify-between w-full pointer-events-none">
                                    <span className="text-[11px] font-bold text-white uppercase truncate">
                                        {episodeContext.episodes.find(e => e.id === episodeContext.currentEpisodeId)?.title || "Untitled"}
                                    </span>
                                    <ChevronDown size={10} className="text-red-600" />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-[10px] font-bold text-[#555] uppercase tracking-widest flex items-center gap-2">
                            <Scissors size={12} /> Timeline
                        </div>
                    )}
                    <div className="flex items-center gap-2">
                        <div className="text-[9px] font-mono text-[#444] flex items-center gap-2 bg-[#111] px-3 py-1 rounded-sm border border-[#222]">
                            <Clock size={10} /> EST. {estDuration}M
                        </div>
                    </div>
                </div>

                {/* --- SCENE LIST --- */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2 pb-20 scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent">
                    {scenes.length === 0 ? (
                        <div className="h-40 flex flex-col items-center justify-center opacity-30 gap-3 border border-dashed border-[#222] rounded-lg">
                            <Film size={32} className="text-[#333]" />
                            <span className="text-xs font-mono">NO SCENE DATA FOUND</span>
                        </div>
                    ) : (
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                            <SortableContext items={scenes.map(s => s.id)} strategy={verticalListSortingStrategy}>
                                {scenes.map((scene, i) => (
                                    <SortableSceneCard
                                        key={scene.id}
                                        scene={scene}
                                        index={i}
                                        isActive={activeSceneId === scene.id}
                                        onEdit={() => onSetActiveScene(scene.id)}
                                        onDelete={(id) => onDeleteScene && setSceneToDelete(id)}
                                    />
                                ))}
                            </SortableContext>
                        </DndContext>
                    )}

                    {/* --- ADD CONTROLS (FOOTER) --- */}
                    <div className="pt-4">
                        {customFooter ? (
                            // Render New Dual-Action Controls
                            customFooter
                        ) : (
                            // Fallback to Old Single Button
                            onAddScene && (
                                <button
                                    onClick={onAddScene}
                                    className="w-full h-12 border border-dashed border-[#333] rounded-sm flex items-center justify-center gap-2 text-[#555] hover:text-[#CCC] hover:border-[#666] hover:bg-[#111] transition-all group"
                                >
                                    <Plus size={16} className="group-hover:scale-110 transition-transform" />
                                    <span className="text-[10px] font-bold uppercase tracking-widest">Add New Scene</span>
                                </button>
                            )
                        )}
                    </div>

                    {scenes.length > 0 && (
                        <div className="h-10 flex items-center justify-center border-t border-dashed border-[#222] mt-4 opacity-30">
                            <span className="text-[9px] font-mono text-[#333]">END OF SEQUENCE</span>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};