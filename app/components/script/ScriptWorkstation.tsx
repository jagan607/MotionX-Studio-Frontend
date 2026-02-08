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

export interface LocationAsset {
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
    customFooter?: React.ReactNode;

    episodeContext?: EpisodeContext;
    contextEpisodes?: any[];
    scenes: WorkstationScene[];

    // ASSETS
    availableCharacters?: Character[];
    availableLocations?: LocationAsset[];

    // NEW: Controlled Selection Props (Optional)
    // If provided, the parent controls selection. If not, this component manages it internally.
    activeSceneId?: string | null;
    onSetActiveScene?: (id: string | null) => void;

    // Actions
    onReorder: (newOrder: WorkstationScene[]) => void;
    onRewrite: (sceneId: string, instruction: string, contextRefs?: ContextReference[]) => Promise<void>;
    onCommit: () => void;
    onAddScene?: () => void;
    onDeleteScene?: (id: string) => void;
    onUpdateCast?: (sceneId: string, newCast: string[]) => void;
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
    availableLocations = [],

    // Destructure controlled props
    activeSceneId: controlledActiveId,
    onSetActiveScene: setControlledActiveId,

    onReorder,
    onRewrite,
    onAddScene,
    onDeleteScene,
    onUpdateCast,
    onUpdateScene,
    onFetchRemoteScenes,
    isProcessing
}) => {
    // Internal state fallback (for when parent doesn't control selection)
    const [internalActiveId, setInternalActiveId] = useState<string | null>(null);
    const [isContextModalOpen, setIsContextModalOpen] = useState(false);
    const [selectedContext, setSelectedContext] = useState<ContextReference[]>([]);

    // Determine effective state (Controlled vs Internal)
    const isControlled = controlledActiveId !== undefined;
    const activeSceneId = isControlled ? controlledActiveId : internalActiveId;

    // Unified Handler
    const handleSetActiveScene = (id: string | null) => {
        if (isControlled && setControlledActiveId) {
            setControlledActiveId(id);
        } else {
            setInternalActiveId(id);
        }
    };

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
                    // Use unified handler
                    onSetActiveScene={handleSetActiveScene}
                    onReorder={onReorder}
                    onAddScene={onAddScene}
                    onDeleteScene={onDeleteScene}
                    customFooter={customFooter}
                />

                <DirectorConsole
                    activeScene={activeScene}
                    availableCharacters={availableCharacters}
                    availableLocations={availableLocations}
                    selectedContext={selectedContext}
                    isProcessing={isProcessing}

                    // Handlers
                    onUpdateCast={onUpdateCast}
                    onUpdateScene={onUpdateScene}
                    onExecuteAi={handleExecuteAi}
                    onOpenContextModal={() => setIsContextModalOpen(true)}
                    onRemoveContextRef={removeContextRef}
                    onCancelSelection={() => handleSetActiveScene(null)}
                />
            </div>
        </div>
    );
};