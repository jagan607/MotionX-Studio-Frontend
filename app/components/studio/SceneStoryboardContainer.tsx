"use client";

import React, { useMemo, useState, useEffect } from "react";
import { Toaster, toast } from "react-hot-toast";

// --- IMPORTS ---
import { StoryboardOverlay } from "../storyboard/StoryboardOverlay";
import { useShotManager } from "@/app/hooks/useShotManager";
import { SceneData } from "@/components/studio/SceneCard";
import { Asset } from "@/lib/types";

// --- FIREBASE IMPORTS ---
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface SceneStoryboardContainerProps {
    isOpen: boolean;
    onClose: () => void;
    projectId: string;
    episodeId: string;
    scene: SceneData; // The initial scene clicked from the grid
    projectAssets: { characters: Asset[], locations: Asset[] };
    seriesTitle: string;
    credits: number;
}

// Helper to sanitize errors so React doesn't crash
const safeError = (e: any) => {
    console.error("Safe Error Catch:", e);
    // Handle Pydantic/FastAPI error objects
    if (typeof e === 'object' && e !== null) {
        if (e.detail && Array.isArray(e.detail)) return e.detail[0].msg; // FastAPI standard
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

    // 1. Internal State for Scene Switching
    const [activeSceneData, setActiveSceneData] = useState<SceneData>(scene);

    // NEW: State for the real Episode Title
    const [realEpisodeTitle, setRealEpisodeTitle] = useState<string>(
        episodeId === 'main' ? "FEATURE FILM" : `EPISODE ${episodeId}`
    );

    // Sync state if the prop changes
    useEffect(() => {
        if (scene) {
            setActiveSceneData(scene);
        }
    }, [scene]);

    // NEW: Fetch Real Episode Title
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
        () => toast.error("Insufficient Credits! Please top up.")
    );

    // 3. Handler to switch scenes from inside the Overlay
    const handleSceneSwitch = (newScene: SceneData) => {
        setActiveSceneData(newScene);
    };

    // 4. Create a "Safe Proxy" of the Manager
    const safeShotMgr = useMemo(() => ({
        ...rawShotMgr,
        handleRenderShot: async (shot: any, sceneData: any, refFile?: File | null) => {
            try {
                return await rawShotMgr.handleRenderShot(shot, sceneData, refFile);
            } catch (e: any) {
                const msg = safeError(e);
                toast.error(msg);
                throw new Error(msg);
            }
        },
        handleAnimateShot: async (shot: any, provider: 'kling' | 'seedance' = 'kling', endFrameUrl?: string | null) => {
            try {
                return await rawShotMgr.handleAnimateShot(shot, provider, endFrameUrl);
            } catch (e: any) {
                const msg = safeError(e);
                toast.error(msg);
                throw new Error(msg);
            }
        },
        handleGenerateVoiceover: async (shot: any) => {
            try {
                return await rawShotMgr.handleGenerateVoiceover(shot);
            } catch (e: any) {
                const msg = safeError(e);
                toast.error(msg);
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
                toast.error(msg);
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
            toast.success("VFX Frame Updated");
        } catch (e) {
            console.error("Failed to apply inpaint:", e);
            toast.error("Failed to save changes");
        }
    };

    if (!isOpen || !activeSceneData) return null;

    return (
        <div className="relative z-[100]">
            <Toaster
                position="bottom-right"
                toastOptions={{
                    style: {
                        background: '#0A0A0A',
                        color: '#fff',
                        border: '1px solid #333',
                        borderRadius: '0px',
                        fontFamily: 'monospace',
                        fontSize: '12px',
                        padding: '12px 16px',
                    },
                    success: {
                        iconTheme: { primary: '#DC2626', secondary: '#fff' },
                        style: { border: '1px solid #111' }
                    },
                    error: {
                        iconTheme: { primary: '#DC2626', secondary: '#fff' },
                        style: { border: '1px solid #DC2626' }
                    }
                }}
            />

            <StoryboardOverlay
                activeSceneId={activeSceneData.id}
                currentScene={activeSceneData}
                credits={credits}
                styles={{}}
                seriesId={projectId}
                episodeId={episodeId}
                castMembers={projectAssets?.characters || []}
                locations={projectAssets?.locations || []}
                seriesName={seriesTitle || "UNTITLED PROJECT"}

                // UPDATED: Pass the real fetched title
                episodeTitle={realEpisodeTitle}

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
                tourStep={0}
                onTourNext={() => { }}
                onTourComplete={() => { }}
            />
        </div>
    );
};