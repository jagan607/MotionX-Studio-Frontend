"use client";

import React from "react";
import { LayoutGrid, Clapperboard, ArrowRight, Plus, Wand2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import {
    DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, DragEndEvent
} from '@dnd-kit/core';
import {
    SortableContext, sortableKeyboardCoordinates, rectSortingStrategy, arrayMove
} from '@dnd-kit/sortable';
import { SceneCard, SceneData } from "@/components/studio/SceneCard";
import { Asset } from "@/lib/types";

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
    episodeId
}) => {
    const router = useRouter();

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

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
                        onClick={onManualAdd}
                        disabled={isExtending}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#111] border border-[#333] hover:border-[#555] text-[9px] font-bold text-[#888] hover:text-white uppercase tracking-wider transition-colors rounded disabled:opacity-50"
                    >
                        <Plus size={11} /> Add Scene
                    </button>
                    <button
                        onClick={onAutoExtend}
                        disabled={isExtending || scenes.length === 0}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-900/10 border border-red-900/30 hover:border-red-500/50 text-[9px] font-bold text-red-400 hover:text-red-300 uppercase tracking-wider transition-colors rounded disabled:opacity-50"
                    >
                        {isExtending ? <Loader2 size={11} className="animate-spin" /> : <Wand2 size={11} />}
                        {isExtending ? "Extending..." : "Auto-Extend"}
                    </button>
                </div>
            </div>

            {/* --- GRID CONTENT --- */}
            <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-[#020202]">
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
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6 pb-20">
                                {scenes.map((scene) => (
                                    <div key={scene.id} className="scene-card-wrapper group relative">
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
                                            onDelete={onDeleteScene}
                                            episodeId={episodeId}
                                            projectId={projectId}
                                        />
                                    </div>
                                ))}
                            </div>
                        </SortableContext>
                    </DndContext>
                )}
            </div>
        </div>
    );
};