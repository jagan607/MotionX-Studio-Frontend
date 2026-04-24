import { useState, useEffect, useRef } from "react";
import { collection, doc, onSnapshot, setDoc } from "firebase/firestore";
import { db, storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { toastSuccess, toastError } from "@/lib/toast";
import { inferVideoErrorMessage } from "@/lib/apiErrors";

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

    // Auto-Direct state — LIFTED from useShotAI.
    // Driven by both optimistic API response (via setter passed to useShotAI)
    // AND authoritative Firestore `auto_direct_status` field.
    const [isAutoDirecting, setIsAutoDirecting] = useState(false);

    const [aspectRatio, setAspectRatio] = useState("16:9");

    const shotsRef = useRef<any[]>([]);
    useEffect(() => { shotsRef.current = shots; }, [shots]);

    // Track which shot errors have already been toasted
    const failedToastedIds = useRef<Set<string>>(new Set());

    // Track whether we've already shown the "complete" toast for the current session
    // to prevent re-toasting on every snapshot update
    const autoDirectCompleteToasted = useRef<string | null>(null);

    // Helper functions for loading state
    const addLoadingShot = (id: string) => setLoadingShots(prev => new Set(prev).add(id));
    const removeLoadingShot = (id: string) => setLoadingShots(prev => { const next = new Set(prev); next.delete(id); return next; });

    // --- 1. REAL-TIME SHOTS SYNC ---
    useEffect(() => {
        if (!projectId || !episodeId || !activeSceneId) return;

        const shotsCollectionRef = collection(db, "projects", projectId, "episodes", episodeId, "scenes", activeSceneId, "shots");

        const unsubscribe = onSnapshot(shotsCollectionRef, (snapshot) => {
            const shotData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
            // Sort by order, then by creation time
            shotData.sort((a: any, b: any) => {
                const orderA = a.order ?? Number.MAX_SAFE_INTEGER;
                const orderB = b.order ?? Number.MAX_SAFE_INTEGER;
                if (orderA !== orderB) return orderA - orderB;
                return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
            });

            // Surface async failures via toast (once per event)
            shotData.forEach(shot => {
                // 1. Image/Action Failure
                if (shot.status === "failed" && !failedToastedIds.current.has(`${shot.id}_status`)) {
                    failedToastedIds.current.add(`${shot.id}_status`);
                    toastError(shot.error_message || "Image generation failed");
                }
                // 2. Upscale Failure
                if (shot.upscale_status === "failed" && !failedToastedIds.current.has(`${shot.id}_upscale`)) {
                    failedToastedIds.current.add(`${shot.id}_upscale`);
                    toastError(shot.upscale_error || "Upscale failed");
                }
            });

            setShots(shotData);
        });

        return () => unsubscribe();
    }, [projectId, episodeId, activeSceneId]);

    // --- 2. REAL-TIME SCENE DOC SYNC (ai_logs + auto_direct_status) ---
    // Single persistent listener on the scene document. Handles:
    //   - ai_logs: real-time terminal log updates from the worker
    //   - auto_direct_status: transitions (processing → complete | failed)
    //   - Page refresh resilience: picks up current status on mount
    //
    // CRITICAL: We reset isAutoDirecting + terminalLog at the TOP of this
    // effect so that switching scenes immediately clears stale state from
    // the previous scene before the new listener's first snapshot arrives.
    useEffect(() => {
        if (!projectId || !episodeId || !activeSceneId) return;

        // Flush stale state from the previous scene immediately.
        // The first snapshot callback below will set the correct state
        // for the newly-active scene.
        setIsAutoDirecting(false);
        setTerminalLog([]);

        const sceneDocRef = doc(db, "projects", projectId, "episodes", episodeId, "scenes", activeSceneId);

        const unsubscribe = onSnapshot(sceneDocRef, (docSnap) => {
            if (!docSnap.exists()) return;
            const data = docSnap.data();

            // --- AI Terminal Logs ---
            if (data?.ai_logs && Array.isArray(data.ai_logs)) {
                setTerminalLog(data.ai_logs);
            } else {
                setTerminalLog([]);
            }

            // --- Auto-Direct Status (authoritative source of truth) ---
            const status = data?.auto_direct_status;

            if (status === "processing") {
                // Worker is running — ensure loading UI is shown
                // (covers page refresh during processing)
                setIsAutoDirecting(true);
            } else if (status === "complete") {
                setIsAutoDirecting(false);

                // Toast once per completion — keyed by sceneId to avoid
                // re-toasting when the user switches scenes and comes back
                const toastKey = `${activeSceneId}_complete`;
                if (autoDirectCompleteToasted.current !== toastKey) {
                    autoDirectCompleteToasted.current = toastKey;
                    const shotCount = data.auto_direct_shot_count || 0;
                    toastSuccess(`${shotCount} shots generated successfully.`);
                }
            } else if (status === "failed") {
                setIsAutoDirecting(false);

                const toastKey = `${activeSceneId}_failed`;
                if (autoDirectCompleteToasted.current !== toastKey) {
                    autoDirectCompleteToasted.current = toastKey;
                    toastError("Shot generation failed. Your credits have been refunded.");
                }
            } else {
                // No status or unknown status (idle scene) — ensure loader is off
                setIsAutoDirecting(false);
            }
        });

        return () => unsubscribe();
    }, [projectId, episodeId, activeSceneId]);

    // Reset the toast dedup key when switching scenes
    useEffect(() => {
        autoDirectCompleteToasted.current = null;
    }, [activeSceneId]);


    // --- COMPOSITION ---

    const crud = useShotCRUD(projectId, episodeId, activeSceneId, shots, setShots);

    // Note: We use a special wrapper for wipe to allow UI state updates (AI Loader) if needed
    const media = useShotMedia(projectId, episodeId, activeSceneId, shots, setShots, setTerminalLog);

    // useShotAI now receives setIsAutoDirecting and onLowCredits
    const ai = useShotAI(projectId, episodeId, activeSceneId, setIsAutoDirecting, onLowCredits);

    const imageGen = useShotImageGen(projectId, episodeId, activeSceneId, addLoadingShot, removeLoadingShot, onLowCredits);

    const videoGen = useShotVideoGen(projectId, episodeId, activeSceneId, addLoadingShot, removeLoadingShot);

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

        // AI — isAutoDirecting is now managed here, not in useShotAI
        isAutoDirecting,
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
        handleUpscaleShot: (shot: any, modelTier: 'flash' | 'pro' = 'pro') => imageGen.handleUpscaleShot(shot, modelTier),
        handleInpaintShot: imageGen.handleInpaintShot,
        handleShotImageUpload, // <--- EXPOSED HERE

        // Video
        handleAnimateShot: (
            shot: any,
            provider: VideoProvider = 'seedance-2',
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