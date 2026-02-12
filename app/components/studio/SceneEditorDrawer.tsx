"use client";

import React, { useState } from "react";
import { X } from "lucide-react";
import { DirectorConsole } from "@/app/components/script/DirectorConsole";
import { ContextSelectorModal, ContextReference } from "@/app/components/script/ContextSelectorModal";
import { SceneData } from "@/components/studio/SceneCard";

interface SceneEditorDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    scene: SceneData | null;
    availableCharacters: { id: string; name: string }[];
    availableLocations: { id: string; name: string }[];
    episodes: any[];
    isProcessing: boolean;
    onUpdateScene: (sceneId: string, updates: Partial<SceneData>) => void;
    onUpdateCast: (sceneId: string, newCast: string[]) => void;
    onRewrite: (sceneId: string, instruction: string, contextRefs?: ContextReference[]) => Promise<void>;
    onFetchRemoteScenes: (episodeId: string) => Promise<any[]>;
}

export const SceneEditorDrawer: React.FC<SceneEditorDrawerProps> = ({
    isOpen,
    onClose,
    scene,
    availableCharacters,
    availableLocations,
    episodes,
    isProcessing,
    onUpdateScene,
    onUpdateCast,
    onRewrite,
    onFetchRemoteScenes,
}) => {
    const [isContextModalOpen, setIsContextModalOpen] = useState(false);
    const [selectedContext, setSelectedContext] = useState<ContextReference[]>([]);

    const handleExecuteAi = async (instruction: string) => {
        if (!scene || !instruction.trim()) return;
        await onRewrite(scene.id, instruction, selectedContext);
    };

    const removeContextRef = (id: string) => {
        setSelectedContext(prev => prev.filter(r => r.id !== id));
    };

    return (
        <>
            {/* BACKDROP */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] transition-opacity"
                    onClick={onClose}
                />
            )}

            {/* DRAWER PANEL */}
            <div
                className={`fixed top-0 right-0 h-full w-[420px] bg-[#080808] border-l border-[#222] z-[70]
                    transform transition-transform duration-300 ease-in-out
                    ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
            >
                {/* CLOSE BUTTON */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-10 p-2 rounded bg-[#111] border border-[#333] text-[#666] hover:text-white hover:border-[#555] transition-colors"
                >
                    <X size={14} />
                </button>

                {/* DIRECTOR CONSOLE (Reused) */}
                <DirectorConsole
                    activeScene={scene}
                    availableCharacters={availableCharacters}
                    availableLocations={availableLocations}
                    selectedContext={selectedContext}
                    isProcessing={isProcessing}
                    onUpdateCast={onUpdateCast}
                    onUpdateScene={onUpdateScene}
                    onExecuteAi={handleExecuteAi}
                    onOpenContextModal={() => setIsContextModalOpen(true)}
                    onRemoveContextRef={removeContextRef}
                    onCancelSelection={onClose}
                />
            </div>

            {/* CONTEXT SELECTOR MODAL */}
            <ContextSelectorModal
                isOpen={isContextModalOpen}
                onClose={() => setIsContextModalOpen(false)}
                episodes={episodes}
                onFetchScenes={onFetchRemoteScenes}
                initialSelection={selectedContext}
                onConfirm={(newSelection) => setSelectedContext(newSelection)}
            />
        </>
    );
};
