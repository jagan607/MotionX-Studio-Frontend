"use client";

import React from "react";
import { LayoutGrid, Clapperboard, ArrowRight } from "lucide-react";
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
            // Re-index scene numbers starting from 1
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

                <div className="flex gap-2">
                    <div className="text-[9px] font-mono text-[#333]">
                        MODE: BOARD_VIEW
                    </div>
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
                            No scenes found in this sequence. Please return to the Script Editor to generate breakdown.
                        </p>
                        <button
                            onClick={() => router.push(`/project/${projectId}/script`)}
                            className="flex items-center gap-2 px-5 py-2.5 bg-[#111] border border-[#333] hover:border-white text-[10px] font-bold text-[#888] hover:text-white uppercase transition-colors"
                        >
                            <ArrowRight size={12} /> GO TO SCRIPT EDITOR
                        </button>
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