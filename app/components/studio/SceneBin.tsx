"use client";

import React, { useEffect, useRef, useState } from "react";
import { LayoutGrid, Clapperboard, ArrowRight, Plus, Wand2, Loader2, X } from "lucide-react";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import { useRouter } from "next/navigation";
import {
    DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, DragEndEvent
} from '@dnd-kit/core';
import {
    SortableContext, sortableKeyboardCoordinates, rectSortingStrategy, arrayMove
} from '@dnd-kit/sortable';
import { SceneCard, SceneData } from "@/components/studio/SceneCard";
import { Asset } from "@/lib/types";
import { DirectorConsole } from "@/app/components/script/DirectorConsole";
import { ContextSelectorModal, ContextReference } from "@/app/components/script/ContextSelectorModal";

interface SceneBinProps {
    scenes: SceneData[];
    activeReelTitle: string;
    projectId: string;
    projectAssets: {
        characters: Asset[];
        locations: Asset[];
    };
    projectType?: 'movie' | 'ad' | 'music_video';
    onOpenStoryboard: (scene: SceneData) => void;
    onReorder: (newScenes: SceneData[]) => void;
    onEditScene: (scene: SceneData) => void;
    onDeleteScene: (sceneId: string) => void;
    onManualAdd: () => void;
    onAutoExtend: () => void;
    isExtending: boolean;
    className?: string;
    episodeId: string;

    // --- Inline Edit Panel Props ---
    editingScene: SceneData | null;
    onCloseEdit: () => void;
    availableCharacters: { id: string; name: string }[];
    availableLocations: { id: string; name: string }[];
    availableProducts?: { id: string; name: string }[];
    episodes: any[];
    isProcessing: boolean;
    onUpdateScene: (sceneId: string, updates: Partial<SceneData>) => void;
    onUpdateCast: (sceneId: string, newCast: string[]) => void;
    onRewrite: (sceneId: string, instruction: string, contextRefs?: ContextReference[]) => Promise<void>;
    onFetchRemoteScenes: (episodeId: string) => Promise<any[]>;
}

export const SceneBin: React.FC<SceneBinProps> = ({
    scenes,
    activeReelTitle,
    projectId,
    projectAssets,
    projectType = 'movie',
    onOpenStoryboard,
    onReorder,
    onEditScene,
    onDeleteScene,
    onManualAdd,
    onAutoExtend,
    isExtending,
    className = "",
    episodeId,
    // Inline edit props
    editingScene,
    onCloseEdit,
    availableCharacters,
    availableLocations,
    availableProducts = [],
    episodes,
    isProcessing,
    onUpdateScene,
    onUpdateCast,
    onRewrite,
    onFetchRemoteScenes,
}) => {
    const router = useRouter();
    const isEditing = !!editingScene;

    // --- Context Selector State (moved from SceneEditorDrawer) ---
    const [isContextModalOpen, setIsContextModalOpen] = useState(false);
    const [selectedContext, setSelectedContext] = useState<ContextReference[]>([]);

    // Reset context when editing scene changes
    useEffect(() => {
        setSelectedContext([]);
    }, [editingScene?.id]);

    const handleExecuteAi = async (instruction: string) => {
        if (!editingScene || !instruction.trim()) return;
        await onRewrite(editingScene.id, instruction, selectedContext);
    };

    const removeContextRef = (id: string) => {
        setSelectedContext(prev => prev.filter(r => r.id !== id));
    };

    // --- DELETE CONFIRMATION STATE ---
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDeleteClick = (sceneId: string) => {
        setPendingDeleteId(sceneId);
    };

    const handleConfirmDelete = async () => {
        if (!pendingDeleteId) return;
        setIsDeleting(true);
        try {
            await onDeleteScene(pendingDeleteId);
        } finally {
            setIsDeleting(false);
            setPendingDeleteId(null);
        }
    };

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    // --- AUTO-SCROLL LOGIC ---
    const bottomRef = useRef<HTMLDivElement>(null);
    const shouldScroll = useRef(false);
    const editingCardRef = useRef<HTMLDivElement>(null);

    // Only scroll when the flag is set (by Add/Extend clicks)
    useEffect(() => {
        if (shouldScroll.current) {
            shouldScroll.current = false;
            setTimeout(() => {
                bottomRef.current?.scrollIntoView({ behavior: "smooth" });
            }, 100);
        }
    }, [scenes.length]);

    // Scroll when Auto-Extend starts (to show loading skeleton)
    useEffect(() => {
        if (isExtending) {
            setTimeout(() => {
                bottomRef.current?.scrollIntoView({ behavior: "smooth" });
            }, 100);
        }
    }, [isExtending]);

    // Scroll the editing card into view when selected
    useEffect(() => {
        if (editingScene) {
            setTimeout(() => {
                editingCardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
            }, 150);
        }
    }, [editingScene?.id]);

    const handleAddClick = () => {
        shouldScroll.current = true;
        onManualAdd();
    };

    const handleExtendClick = () => {
        shouldScroll.current = true;
        onAutoExtend();
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIndex = scenes.findIndex((s) => s.id === active.id);
            const newIndex = scenes.findIndex((s) => s.id === over.id);
            const newOrder = arrayMove(scenes, oldIndex, newIndex);
            const reindexed = newOrder.map((s, idx) => ({ ...s, scene_number: idx + 1 }));
            onReorder(reindexed);
        }
    };

    return (
        <div className={`flex-1 bg-[#020202] flex flex-col relative ${className}`}>

            {/* --- BIN TOOLBAR --- */}
            <div className="h-12 border-b border-[#222] bg-[#080808] flex items-center justify-between px-6 shrink-0">
                <div className="flex items-center gap-2 text-[10px] font-bold text-[#555] uppercase tracking-widest">
                    <LayoutGrid size={14} />
                    <span className="text-[#888]">{activeReelTitle}</span> <span className="text-[#333]">/</span> SCENE BIN
                </div>

                {/* ADD SCENE CONTROLS */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleAddClick}
                        disabled={isExtending}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#111] border border-[#333] hover:border-[#555] text-[9px] font-bold text-[#888] hover:text-white uppercase tracking-wider transition-colors rounded disabled:opacity-50"
                    >
                        <Plus size={11} /> Add Scene
                    </button>
                    <button
                        onClick={handleExtendClick}
                        disabled={isExtending || scenes.length === 0}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-900/10 border border-red-900/30 hover:border-red-500/50 text-[9px] font-bold text-red-400 hover:text-red-300 uppercase tracking-wider transition-colors rounded disabled:opacity-50"
                    >
                        {isExtending ? <Loader2 size={11} className="animate-spin" /> : <Wand2 size={11} />}
                        {isExtending ? "Extending..." : "Auto-Extend"}
                    </button>
                </div>
            </div>

            {/* --- MAIN CONTENT: GRID + INLINE EDIT PANEL --- */}
            <div className="flex-1 flex overflow-hidden">

                {/* GRID CONTENT (shrinks when editing) */}
                <div className={`flex-1 overflow-y-auto p-6 md:p-8 bg-[#020202] transition-all duration-300 ease-in-out ${isEditing ? 'min-w-0' : ''}`}>
                    {scenes.length === 0 ? (
                        // EMPTY STATE
                        <div className="h-full flex flex-col items-center justify-center opacity-50">
                            <Clapperboard size={32} className="text-[#333] mb-4" />
                            <div className="text-xs font-bold text-[#666] tracking-widest uppercase mb-2">Reel is Empty</div>
                            <p className="text-[10px] font-mono text-[#444] max-w-xs text-center mb-6">
                                No scenes found in this sequence. Add a scene manually or use Auto-Extend.
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={onManualAdd}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-[#111] border border-[#333] hover:border-white text-[10px] font-bold text-[#888] hover:text-white uppercase transition-colors"
                                >
                                    <Plus size={12} /> Add First Scene
                                </button>
                                <button
                                    onClick={() => router.push(`/project/${projectId}/script`)}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-[#111] border border-[#333] hover:border-white text-[10px] font-bold text-[#888] hover:text-white uppercase transition-colors"
                                >
                                    <ArrowRight size={12} /> Script Editor
                                </button>
                            </div>
                        </div>
                    ) : (
                        // SORTABLE GRID LAYOUT
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                            <SortableContext items={scenes.map(s => s.id)} strategy={rectSortingStrategy}>
                                <div className={`grid gap-6 pb-20 transition-all duration-300
                                    ${isEditing
                                        ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3'
                                        : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4'
                                    }`}
                                >
                                    {scenes.map((scene) => (
                                        <div
                                            key={scene.id}
                                            className="scene-card-wrapper group relative"
                                            ref={editingScene?.id === scene.id ? editingCardRef : undefined}
                                        >
                                            {/* Tech Accents */}
                                            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[#333] z-10 pointer-events-none" />
                                            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[#333] z-10 pointer-events-none" />

                                            {/* The Card Component */}
                                            <SceneCard
                                                scene={scene}
                                                projectAssets={projectAssets}
                                                projectType={projectType}
                                                onOpenStoryboard={onOpenStoryboard}
                                                onEdit={onEditScene}
                                                onDelete={handleDeleteClick}
                                                episodeId={episodeId}
                                                projectId={projectId}
                                                isEditing={editingScene?.id === scene.id}
                                            />
                                        </div>
                                    ))}

                                    {/* LOADING SKELETON (Auto-Extend) */}
                                    {isExtending && (
                                        <div className="relative aspect-video bg-[#050505] border border-[#222] rounded-lg overflow-hidden flex flex-col animate-pulse">
                                            <div className="h-8 border-b border-[#222] bg-[#0A0A0A] flex items-center justify-between px-3">
                                                <div className="w-16 h-3 bg-[#111] rounded" />
                                                <div className="w-12 h-3 bg-[#111] rounded" />
                                            </div>
                                            <div className="flex-1 p-4 space-y-3">
                                                <div className="w-3/4 h-3 bg-[#111] rounded" />
                                                <div className="w-full h-3 bg-[#111] rounded" />
                                                <div className="w-5/6 h-3 bg-[#111] rounded" />
                                            </div>
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <div className="flex flex-col items-center gap-2 text-[#444]">
                                                    <Loader2 size={24} className="animate-spin" />
                                                    <span className="text-[10px] font-bold uppercase tracking-widest">Generating Scene...</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    <div ref={bottomRef} className="w-full h-1" />
                                </div>
                            </SortableContext>
                        </DndContext>
                    )}
                </div>

                {/* --- INLINE EDIT PANEL --- */}
                <div
                    className={`shrink-0 bg-[#080808] border-l border-[#222] overflow-hidden transition-all duration-300 ease-in-out
                        ${isEditing ? 'w-[380px] opacity-100' : 'w-0 opacity-0 border-l-0'}`}
                >
                    {/* Panel inner content (always rendered for smooth transitions) */}
                    <div className="w-[380px] h-full flex flex-col overflow-hidden">
                        {/* PANEL HEADER */}
                        <div className="h-12 border-b border-[#222] bg-[#0A0A0A] flex items-center justify-between px-4 shrink-0">
                            <div className="flex items-center gap-2">
                                <span className="text-[9px] font-mono text-[#555] uppercase tracking-widest">Editing Scene</span>
                                <span className="text-sm font-bold text-red-500 font-mono">
                                    {editingScene ? String(editingScene.scene_number).padStart(2, '0') : '--'}
                                </span>
                            </div>
                            <button
                                onClick={onCloseEdit}
                                className="p-1.5 rounded bg-[#111] border border-[#333] text-[#666] hover:text-white hover:border-[#555] transition-colors"
                            >
                                <X size={14} />
                            </button>
                        </div>

                        {/* DIRECTOR CONSOLE (Reused) */}
                        {editingScene && (
                            <DirectorConsole
                                activeScene={editingScene}
                                availableCharacters={availableCharacters}
                                availableLocations={availableLocations}
                                availableProducts={availableProducts}
                                projectType={projectType}
                                selectedContext={selectedContext}
                                isProcessing={isProcessing}
                                onUpdateCast={onUpdateCast}
                                onUpdateScene={onUpdateScene}
                                onExecuteAi={handleExecuteAi}
                                onOpenContextModal={() => setIsContextModalOpen(true)}
                                onRemoveContextRef={removeContextRef}
                                onCancelSelection={onCloseEdit}
                            />
                        )}
                    </div>
                </div>
            </div>

            {/* DELETE CONFIRMATION MODAL */}
            {pendingDeleteId && (
                <DeleteConfirmModal
                    title="Delete Scene"
                    message="Are you sure you want to delete this scene? This action cannot be undone."
                    isDeleting={isDeleting}
                    onConfirm={handleConfirmDelete}
                    onCancel={() => setPendingDeleteId(null)}
                />
            )}

            {/* CONTEXT SELECTOR MODAL */}
            <ContextSelectorModal
                isOpen={isContextModalOpen}
                onClose={() => setIsContextModalOpen(false)}
                episodes={episodes}
                onFetchScenes={onFetchRemoteScenes}
                initialSelection={selectedContext}
                onConfirm={(newSelection) => setSelectedContext(newSelection)}
            />
        </div>
    );
};