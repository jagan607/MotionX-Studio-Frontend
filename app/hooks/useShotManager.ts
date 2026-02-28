import { useState, useEffect, useRef } from "react";
import { collection, doc, onSnapshot, setDoc } from "firebase/firestore";
import { db, storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { toastSuccess, toastError } from "@/lib/toast";

// Sub-hooks (Relative imports)
import { useShotCRUD } from "./shot-manager/useShotCRUD";
import { useShotMedia } from "./shot-manager/useShotMedia";
import { useShotAI } from "./shot-manager/useShotAI";
import { useShotImageGen } from "./shot-manager/useShotImageGen";
import { useShotVideoGen, VideoProvider, AnimateOptions } from "./shot-manager/useShotVideoGen";
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

    // Terminal Log State (Now driven by DB + Local actions)
    const [terminalLog, setTerminalLog] = useState<string[]>([]);

    const [aspectRatio, setAspectRatio] = useState("16:9");

    // Ref for Batch Operations to access latest state
    const shotsRef = useRef<any[]>([]);
    useEffect(() => { shotsRef.current = shots; }, [shots]);

    // Helper functions for loading state
    const addLoadingShot = (id: string) => setLoadingShots(prev => new Set(prev).add(id));
    const removeLoadingShot = (id: string) => setLoadingShots(prev => { const next = new Set(prev); next.delete(id); return next; });

    // --- 1. REAL-TIME SHOTS SYNC ---
    useEffect(() => {
        if (!projectId || !episodeId || !activeSceneId) return;

        const shotsRef = collection(db, "projects", projectId, "episodes", episodeId, "scenes", activeSceneId, "shots");

        const unsubscribe = onSnapshot(shotsRef, (snapshot) => {
            const shotData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // Sort by order, then by creation time
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

    // --- 2. REAL-TIME LOGS SYNC (NEW) ---
    // This listens to the Scene Document for 'ai_logs' updates from the backend
    useEffect(() => {
        if (!projectId || !episodeId || !activeSceneId) return;

        const sceneDocRef = doc(db, "projects", projectId, "episodes", episodeId, "scenes", activeSceneId);

        const unsubscribe = onSnapshot(sceneDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                // If backend has pushed logs, sync them to local state
                if (data?.ai_logs && Array.isArray(data.ai_logs)) {
                    setTerminalLog(data.ai_logs);
                }
            }
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

    // Batch depends on Scene ID + project context — always uses 'flash' for cost efficiency
    const batch = useShotBatch(shotsRef, (shot, ar) => imageGen.handleRenderShot(shot, ar, null, undefined, null, shot.camera_transform, shot.camera_shot_type), projectId, episodeId, activeSceneId, 'flash');

    // --- MANUAL IMAGE UPLOAD (Integrated directly for now) ---
    const handleShotImageUpload = async (shot: any, file: File) => {
        if (!activeSceneId) return;
        addLoadingShot(shot.id);

        try {
            // storage path: projects/{projectId}/episodes/{episodeId}/scenes/{sceneId}/shots/{shotId}_{timestamp}
            const storagePath = `projects/${projectId}/episodes/${episodeId}/scenes/${activeSceneId}/shots/${shot.id}_${Date.now()}`;
            const storageRef = ref(storage, storagePath);

            await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(storageRef);

            // Update Firestore with new image URL
            const shotRef = doc(db, "projects", projectId, "episodes", episodeId, "scenes", activeSceneId, "shots", shot.id);
            await setDoc(shotRef, {
                image_url: downloadURL,
                status: "finalized"
            }, { merge: true });

            toastSuccess("Image uploaded successfully");
        } catch (error) {
            console.error("Upload failed", error);
            toastError("Failed to upload image");
        } finally {
            removeLoadingShot(shot.id);
        }
    };

    // --- PUBLIC API (Aggregated) ---
    return {
        // State
        shots,
        loadingShots,
        terminalLog, // UI consumes this
        setTerminalLog, // Exposed in case manual updates needed
        aspectRatio,
        setAspectRatio,

        // CRUD
        handleAddShot: crud.handleAddShot,
        updateShot: crud.updateShot,
        handleDeleteShot: crud.handleDeleteShot,
        handleDragEnd: crud.handleDragEnd,

        // Media
        wipeShotImagesOnly: media.wipeShotImagesOnly,
        wipeSceneData: async () => {
            await media.wipeSceneData();
        },

        // AI
        isAutoDirecting: ai.isAutoDirecting,
        handleAutoDirect: ai.handleAutoDirect,

        // Image — modelTier passed from individual shot card
        handleRenderShot: (
            shot: any,
            scene: any,
            refFile?: File | null,
            provider?: 'gemini' | 'seedream',
            continuityRefId?: string | null,
            cameraTransform?: any,
            cameraShotType?: string
            , modelTier: 'flash' | 'pro' = 'flash') => imageGen.handleRenderShot(shot, aspectRatio, refFile, provider, continuityRefId, cameraTransform, cameraShotType, modelTier),
        handleUpscaleShot: imageGen.handleUpscaleShot,
        handleInpaintShot: imageGen.handleInpaintShot,
        handleShotImageUpload, // <--- EXPOSED HERE

        // Video
        handleAnimateShot: (
            shot: any,
            provider: VideoProvider = 'kling',
            endFrameUrl?: string | null,
            options?: AnimateOptions
        ) => videoGen.handleAnimateShot(shot, provider, endFrameUrl, options),

        handleText2Video: (
            shot: any,
            options?: AnimateOptions & { negative_prompt?: string }
        ) => videoGen.handleText2Video(shot, options),

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