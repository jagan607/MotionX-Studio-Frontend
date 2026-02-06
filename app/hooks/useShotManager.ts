import { useState, useEffect, useRef } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

// Sub-hooks (Relative imports to the folder created in Step 1)
import { useShotCRUD } from "./shot-manager/useShotCRUD";
import { useShotMedia } from "./shot-manager/useShotMedia";
import { useShotAI } from "./shot-manager/useShotAI";
import { useShotImageGen } from "./shot-manager/useShotImageGen";
import { useShotVideoGen } from "./shot-manager/useShotVideoGen";
import { useShotAudioGen } from "./shot-manager/useShotAudioGen";
import { useShotBatch } from "./shot-manager/useShotBatch";

export const useShotManager = (
    projectId: string,
    episodeId: string,
    activeSceneId: string | null,
    onLowCredits?: () => void
) => {
    // --- SHARED STATE ---
    const [shots, setShots] = useState<any[]>([]);
    const [loadingShots, setLoadingShots] = useState<Set<string>>(new Set());
    const [terminalLog, setTerminalLog] = useState<string[]>([]);
    const [aspectRatio, setAspectRatio] = useState("16:9");

    // Ref for Batch Operations to access latest state
    const shotsRef = useRef<any[]>([]);
    useEffect(() => { shotsRef.current = shots; }, [shots]);

    // Helper functions for loading state
    const addLoadingShot = (id: string) => setLoadingShots(prev => new Set(prev).add(id));
    const removeLoadingShot = (id: string) => setLoadingShots(prev => { const next = new Set(prev); next.delete(id); return next; });

    // --- REAL-TIME SYNC ---
    useEffect(() => {
        if (!projectId || !episodeId || !activeSceneId) return;

        // UNIFIED PROJECT PATH
        const q = collection(db, "projects", projectId, "episodes", episodeId, "scenes", activeSceneId, "shots");

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const shotData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            shotData.sort((a: any, b: any) => {
                const orderA = a.order ?? Number.MAX_SAFE_INTEGER;
                const orderB = b.order ?? Number.MAX_SAFE_INTEGER;
                if (orderA !== orderB) return orderA - orderB;
                return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
            });
            setShots(shotData);
        });
        return () => unsubscribe();
    }, [projectId, episodeId, activeSceneId]);

    // --- COMPOSITION ---

    const crud = useShotCRUD(projectId, episodeId, activeSceneId, shots, setShots);

    // Note: We use a special wrapper for wipe to allow UI state updates (AI Loader) if needed
    const media = useShotMedia(projectId, episodeId, activeSceneId, shots, setShots, setTerminalLog);

    const ai = useShotAI(projectId, episodeId, activeSceneId, setTerminalLog);

    const imageGen = useShotImageGen(projectId, episodeId, activeSceneId, addLoadingShot, removeLoadingShot, onLowCredits);

    const videoGen = useShotVideoGen(projectId, episodeId, activeSceneId);

    const audioGen = useShotAudioGen(projectId, episodeId, activeSceneId);

    // Batch depends on ImageGen logic
    const batch = useShotBatch(shotsRef, (shot, ar) => imageGen.handleRenderShot(shot, ar));

    // --- PUBLIC API (Aggregated) ---
    return {
        // State
        shots,
        loadingShots,
        terminalLog,
        aspectRatio,
        setAspectRatio,

        // CRUD
        handleAddShot: crud.handleAddShot,
        updateShot: crud.updateShot,
        handleDeleteShot: crud.handleDeleteShot,
        handleDragEnd: crud.handleDragEnd,

        // Media
        wipeShotImagesOnly: media.wipeShotImagesOnly,
        // Wrap wipeSceneData to handle UI loading state here if desired, or pass setTerminalLog
        wipeSceneData: async () => {
            // Optional: You could set isAutoDirecting here if you want the spinner
            await media.wipeSceneData();
        },

        // AI
        isAutoDirecting: ai.isAutoDirecting,
        handleAutoDirect: ai.handleAutoDirect,

        // Image
        handleRenderShot: (shot: any, scene: any, refFile?: File | null) => imageGen.handleRenderShot(shot, aspectRatio, refFile),
        handleFinalizeShot: imageGen.handleFinalizeShot,
        handleInpaintShot: imageGen.handleInpaintShot,

        // Video
        handleAnimateShot: (
            shot: any,
            provider: 'kling' | 'seedance' = 'kling',
            endFrameUrl?: string | null
        ) => videoGen.handleAnimateShot(shot, provider, endFrameUrl),

        // Audio
        handleGenerateVoiceover: audioGen.handleGenerateVoiceover,
        handleLipSyncShot: audioGen.handleLipSyncShot,

        // Batch
        isGeneratingAll: batch.isGeneratingAll,
        isStopping: batch.isStopping,
        handleGenerateAll: () => batch.handleGenerateAll(aspectRatio),
        stopGeneration: batch.stopGeneration
    };
};