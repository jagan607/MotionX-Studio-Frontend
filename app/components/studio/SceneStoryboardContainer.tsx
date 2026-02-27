"use client";

import React, { useMemo, useState, useEffect } from "react";
import { toastError, toastSuccess } from "@/lib/toast";

// --- IMPORTS ---
import { StoryboardOverlay } from "../storyboard/StoryboardOverlay";
import { useShotManager } from "@/app/hooks/useShotManager";
import { VideoProvider, AnimateOptions } from "@/app/hooks/shot-manager/useShotVideoGen";
import { SceneData } from "@/components/studio/SceneCard";
import { Asset } from "@/lib/types";
import { useTour } from "@/hooks/useTour";

// --- FIREBASE IMPORTS ---
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface SceneStoryboardContainerProps {
    isOpen: boolean;
    onClose: () => void;
    projectId: string;
    episodeId: string;
    scene: SceneData;
    // [FIXED] Added products to the type definition
    projectAssets: {
        characters: Asset[],
        locations: Asset[],
        products: Asset[]
    };
    seriesTitle: string;
    credits: number;
}

// Helper to sanitize errors so React doesn't crash
const safeError = (e: any) => {
    console.error("Safe Error Catch:", e);
    if (typeof e === 'object' && e !== null) {
        if (e.detail && Array.isArray(e.detail)) return e.detail[0].msg;
        if (e.message) return e.message;
        if (e.msg) return e.msg;
    }
    return String(e) || "An unexpected error occurred";
};

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

    // Tour
    const sbTour = useTour("storyboard_tour");

    // 1. Internal State for Scene Switching
    const [activeSceneData, setActiveSceneData] = useState<SceneData>(scene);

    // State for the real Episode Title
    const [realEpisodeTitle, setRealEpisodeTitle] = useState<string>(
        episodeId === 'main' ? "FEATURE FILM" : `EPISODE ${episodeId}`
    );
    const [realScript, setRealScript] = useState<string>("");
    const [realRuntime, setRealRuntime] = useState<string | number>(""); // [NEW]

    // Sync state if the prop changes
    useEffect(() => {
        if (scene) {
            setActiveSceneData(scene);
        }
    }, [scene]);

    // Fetch Real Episode Title
    useEffect(() => {
        const fetchEpisodeTitle = async () => {
            if (!projectId || !episodeId || episodeId === 'main') return;

            try {
                const epRef = doc(db, "projects", projectId, "episodes", episodeId);
                const epSnap = await getDoc(epRef);

                if (epSnap.exists()) {
                    const data = epSnap.data();
                    if (data.title) {
                        setRealEpisodeTitle(data.title.toUpperCase());
                    }
                    if (data.script_preview) {
                        setRealScript(data.script_preview);
                    }
                    if (data.runtime) {
                        setRealRuntime(data.runtime);
                    }
                }
            } catch (err) {
                console.error("Error fetching episode title:", err);
            }
        };

        fetchEpisodeTitle();
    }, [projectId, episodeId]);


    // 2. Initialize the Hook with the ACTIVE scene ID
    const rawShotMgr = useShotManager(
        projectId,
        episodeId,
        activeSceneData?.id || "",
        () => toastError("Insufficient Credits! Please top up.")
    );

    // 3. Handler to switch scenes from inside the Overlay
    const handleSceneSwitch = (newScene: SceneData) => {
        setActiveSceneData(newScene);
    };

    // 4. Create a "Safe Proxy" of the Manager
    const safeShotMgr = useMemo(() => ({
        ...rawShotMgr,
<<<<<<< HEAD
        handleRenderShot: async (shot: any, sceneData: any, refFile?: File | null, provider?: 'gemini' | 'seedream', continuityRefId?: string | null, modelTier?: 'flash' | 'pro') => {
            try {
                return await rawShotMgr.handleRenderShot(shot, sceneData, refFile, provider, continuityRefId, modelTier);
=======
        handleRenderShot: async (shot: any, sceneData: any, refFile?: File | null, provider?: 'gemini' | 'seedream', continuityRefId?: string | null, cameraTransform?: any, cameraShotType?: string) => {
            try {
                return await rawShotMgr.handleRenderShot(shot, sceneData, refFile, provider, continuityRefId, cameraTransform, cameraShotType);
>>>>>>> ee6e98a (Camera orbit functionality added for camera control)
            } catch (e: any) {
                const msg = safeError(e);
                toastError(msg);
                throw new Error(msg);
            }
        },
        handleAnimateShot: async (shot: any, provider: VideoProvider = 'kling', endFrameUrl?: string | null, options?: AnimateOptions) => {
            try {
                return await rawShotMgr.handleAnimateShot(shot, provider, endFrameUrl, options);
            } catch (e: any) {
                const msg = safeError(e);
                toastError(msg);
                throw new Error(msg);
            }
        },
        handleText2Video: async (shot: any, options?: AnimateOptions & { negative_prompt?: string }) => {
            try {
                return await rawShotMgr.handleText2Video(shot, options);
            } catch (e: any) {
                const msg = safeError(e);
                toastError(msg);
                throw new Error(msg);
            }
        },
        handleGenerateVoiceover: async (shot: any) => {
            try {
                return await rawShotMgr.handleGenerateVoiceover(shot);
            } catch (e: any) {
                const msg = safeError(e);
                toastError(msg);
                throw new Error(msg);
            }
        },
        handleInpaintShot: async (
            shotId: string,
            prompt: string,
            maskBase64: string,
            originalImageUrl: string,
            refImages: File[]
        ) => {
            try {
                // @ts-ignore
                return await rawShotMgr.handleInpaintShot(shotId, prompt, maskBase64, originalImageUrl, refImages);
            } catch (e: any) {
                const msg = safeError(e);
                toastError(msg);
                throw new Error(msg);
            }
        }
    }), [rawShotMgr]);

    const [inpaintData, setInpaintData] = React.useState<{ src: string, shotId: string } | null>(null);

    const handleApplyInpaint = async (newImageUrl: string) => {
        if (!inpaintData) return;
        try {
            await rawShotMgr.updateShot(inpaintData.shotId, "image_url", newImageUrl);
            setInpaintData(null);
            toastSuccess("VFX Frame Updated");
        } catch (e) {
            console.error("Failed to apply inpaint:", e);
            toastError("Failed to save changes");
        }
    };

    if (!isOpen || !activeSceneData) return null;

    return (
        <div className="relative z-[100]">


            <StoryboardOverlay
                activeSceneId={activeSceneData.id}
                currentScene={activeSceneData}
                credits={credits}
                styles={{}}
                seriesId={projectId}
                episodeId={episodeId}
                castMembers={projectAssets?.characters || []}
                locations={projectAssets?.locations || []}

                // [FIXED] Pass products down to the overlay
                products={projectAssets?.products || []}

                seriesName={seriesTitle || "UNTITLED PROJECT"}
                episodeTitle={realEpisodeTitle}
                initialScript={realScript}
                initialRuntime={realRuntime} // [NEW] Pass runtime

                shotMgr={safeShotMgr}
                onClose={onClose}
                onDeleteShot={rawShotMgr.handleDeleteShot}
                onSceneChange={handleSceneSwitch}
                inpaintData={inpaintData}
                setInpaintData={setInpaintData}
                onSaveInpaint={async (prompt: string, maskBase64: string, refImages: File[]) => {
                    if (!inpaintData) return null;

                    return await safeShotMgr.handleInpaintShot(
                        inpaintData.shotId,
                        prompt,
                        maskBase64,
                        inpaintData.src,
                        refImages
                    );
                }}
                onApplyInpaint={handleApplyInpaint}
                onZoom={() => { }}
                onDownload={() => { }}
                tourStep={sbTour.step}
                onTourNext={sbTour.nextStep}
                onTourComplete={sbTour.completeTour}
            />
        </div>
    );
};