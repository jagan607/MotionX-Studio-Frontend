"use client";

import React, { useState } from "react";
import { ContextSelectorModal, ContextReference } from "./ContextSelectorModal";
import { ScriptTimeline } from "./ScriptTimeline";
import { DirectorConsole } from "./DirectorConsole";

export interface WorkstationScene {
    id: string;
    scene_number: number;
    header: string;
    summary: string;
    time?: string;
    cast_ids?: string[];
    characters?: string[];
    location_id?: string;
    [key: string]: any;
}

export interface Character {
    id: string;
    name: string;
}

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
    // Allow injecting custom controls at the bottom of the list
    customFooter?: React.ReactNode;

    episodeContext?: EpisodeContext;
    contextEpisodes?: any[];
    scenes: WorkstationScene[];
    availableCharacters?: Character[];

    // Actions
    onReorder: (newOrder: WorkstationScene[]) => void;
    onRewrite: (sceneId: string, instruction: string, contextRefs?: ContextReference[]) => Promise<void>;
    onCommit: () => void;
    onAddScene?: () => void;
    onDeleteScene?: (id: string) => void;
    onUpdateCast?: (sceneId: string, newCast: string[]) => void;

    // NEW: Handler for manual scene edits (Header/Summary)
    onUpdateScene?: (sceneId: string, updates: Partial<WorkstationScene>) => void;

    onFetchRemoteScenes?: (episodeId: string) => Promise<any[]>;

    isProcessing: boolean;
    isCommitting: boolean;
}

export const ScriptWorkstation: React.FC<ScriptWorkstationProps> = ({
    customHeader,
    customFooter,
    episodeContext,
    contextEpisodes,
    scenes,
    availableCharacters = [],
    onReorder,
    onRewrite,
    onAddScene,
    onDeleteScene,
    onUpdateCast,
    onUpdateScene, // <--- Destructure new prop
    onFetchRemoteScenes,
    isProcessing
}) => {
    const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
    const [isContextModalOpen, setIsContextModalOpen] = useState(false);
    const [selectedContext, setSelectedContext] = useState<ContextReference[]>([]);

    const handleExecuteAi = async (instruction: string) => {
        if (!activeSceneId || !instruction.trim()) return;
        await onRewrite(activeSceneId, instruction, selectedContext);
    };

    const removeContextRef = (id: string) => {
        setSelectedContext(prev => prev.filter(r => r.id !== id));
    };

    const activeScene = scenes.find(s => s.id === activeSceneId) || null;

    return (
        <div className="fixed inset-0 z-50 bg-[#050505] text-[#EEE] font-sans overflow-hidden flex flex-col">
            <style jsx global>{`
                ::-webkit-scrollbar { width: 6px; }
                ::-webkit-scrollbar-track { background: #050505; }
                ::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
                ::-webkit-scrollbar-thumb:hover { background: #555; }
            `}</style>

            {customHeader}

            {onFetchRemoteScenes && (
                <ContextSelectorModal
                    isOpen={isContextModalOpen}
                    onClose={() => setIsContextModalOpen(false)}
                    episodes={contextEpisodes || episodeContext?.episodes || []}
                    onFetchScenes={onFetchRemoteScenes}
                    initialSelection={selectedContext}
                    onConfirm={(newSelection) => setSelectedContext(newSelection)}
                />
            )}

            <div className="flex-1 flex overflow-hidden relative z-40">
                <ScriptTimeline
                    scenes={scenes}
                    activeSceneId={activeSceneId}
                    episodeContext={episodeContext}
                    onSetActiveScene={setActiveSceneId}
                    onReorder={onReorder}
                    onAddScene={onAddScene}
                    onDeleteScene={onDeleteScene}
                    customFooter={customFooter}
                />

                <DirectorConsole
                    activeScene={activeScene}
                    availableCharacters={availableCharacters}
                    selectedContext={selectedContext}
                    isProcessing={isProcessing}

                    // Handlers
                    onUpdateCast={onUpdateCast}
                    onUpdateScene={onUpdateScene} // <--- Pass down to Console
                    onExecuteAi={handleExecuteAi}
                    onOpenContextModal={() => setIsContextModalOpen(true)}
                    onRemoveContextRef={removeContextRef}
                    onCancelSelection={() => setActiveSceneId(null)}
                />
            </div>
        </div>
    );
};