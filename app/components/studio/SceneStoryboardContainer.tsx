"use client";

import React from "react";
import { Toaster } from "react-hot-toast";

// --- IMPORTS ---
import { StoryboardOverlay } from "../storyboard/StoryboardOverlay";
import { useShotManager } from "@/app/hooks/useShotManager";
import { SceneData } from "@/components/studio/SceneCard";
import { Asset } from "@/lib/types";

interface SceneStoryboardContainerProps {
    isOpen: boolean;
    onClose: () => void;
    projectId: string;
    episodeId: string; // Pass "main" for movies
    scene: SceneData;
    projectAssets: { characters: Asset[], locations: Asset[] };
    seriesTitle: string; // We map the Project Title to this prop
    credits: number;
}

export const SceneStoryboardContainer: React.FC<SceneStoryboardContainerProps> = ({
    isOpen,
    onClose,
    projectId,
    episodeId,
    scene,
    projectAssets,
    seriesTitle,
    credits
}) => {
    // 1. Initialize the Hook (The Brain)
    const shotMgr = useShotManager(
        projectId,
        episodeId,
        scene.id,
        () => alert("Low Credits! Please top up.")
    );

    if (!isOpen) return null;

    // 2. Render the Overlay (The Body)
    return (
        <>
            <Toaster position="bottom-right" />
            <StoryboardOverlay
                activeSceneId={scene.id}
                currentScene={scene}
                credits={credits}
                styles={{}}

                // --- REQUIRED FIX: Pass IDs for Navigation ---
                seriesId={projectId}   // Maps Project ID -> Series ID
                episodeId={episodeId}  // Maps Episode ID
                // ---------------------------------------------

                // Asset Mapping
                castMembers={projectAssets.characters}
                locations={projectAssets.locations}

                // Context Mapping
                seriesName={seriesTitle}
                episodeTitle={episodeId === 'main' ? "FEATURE FILM" : `EPISODE ${episodeId}`}

                // Pass the initialized Hook
                shotMgr={shotMgr}

                // Handlers
                onClose={onClose}
                onDeleteShot={shotMgr.handleDeleteShot}

                // Placeholders 
                inpaintData={null}
                setInpaintData={() => { }}
                onSaveInpaint={async () => null}
                onApplyInpaint={() => { }}
                onZoom={() => { }}
                onDownload={() => { }}
                tourStep={0}
                onTourNext={() => { }}
                onTourComplete={() => { }}
            />
        </>
    );
};