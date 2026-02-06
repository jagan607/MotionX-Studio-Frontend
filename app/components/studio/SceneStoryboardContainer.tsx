"use client";

import React, { useMemo } from "react";
import { Toaster, toast } from "react-hot-toast";

// --- IMPORTS ---
import { StoryboardOverlay } from "../storyboard/StoryboardOverlay";
import { useShotManager } from "@/app/hooks/useShotManager";
import { SceneData } from "@/components/studio/SceneCard";
import { Asset } from "@/lib/types";

interface SceneStoryboardContainerProps {
    isOpen: boolean;
    onClose: () => void;
    projectId: string;
    episodeId: string;
    scene: SceneData;
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

    // 1. Initialize the Hook
    // We pass a simple void function for onLowCredits as defined in your useShotManager
    const rawShotMgr = useShotManager(
        projectId,
        episodeId,
        scene.id,
        () => toast.error("Insufficient Credits! Please top up.")
    );

    // 2. Create a "Safe Proxy" of the Manager
    // This wraps the dangerous async functions. If they fail, we catch the object, 
    // toast a STRING (preventing the crash), and re-throw a string.
    const safeShotMgr = useMemo(() => ({
        ...rawShotMgr,

        // Wrap Image Generation
        handleRenderShot: async (shot: any, sceneData: any, refFile?: File | null) => {
            try {
                return await rawShotMgr.handleRenderShot(shot, sceneData, refFile);
            } catch (e: any) {
                const msg = safeError(e);
                toast.error(msg); // Toast the string
                throw new Error(msg); // Re-throw string so UI stops loading
            }
        },

        // Wrap Video Generation
        handleAnimateShot: async (shot: any, provider: 'kling' | 'seedance' = 'kling', endFrameUrl?: string | null) => {
            try {
                return await rawShotMgr.handleAnimateShot(shot, provider, endFrameUrl);
            } catch (e: any) {
                const msg = safeError(e);
                toast.error(msg);
                throw new Error(msg);
            }
        },

        // Wrap Audio Generation
        handleGenerateVoiceover: async (shot: any) => {
            try {
                return await rawShotMgr.handleGenerateVoiceover(shot);
            } catch (e: any) {
                const msg = safeError(e);
                toast.error(msg);
                throw new Error(msg);
            }
        },

        // Wrap Inpaint Generation
        handleInpaintShot: async (shotId: string, prompt: string, maskBase64: string, refImages: File[]) => {
            try {
                // @ts-ignore - Dynamic key access on hook return
                return await rawShotMgr.handleInpaintShot(shotId, prompt, maskBase64, refImages);
            } catch (e: any) {
                const msg = safeError(e);
                toast.error(msg);
                throw new Error(msg);
            }
        }
    }), [rawShotMgr]);

    // --- STATE FOR INPAINTING ---
    const [inpaintData, setInpaintData] = React.useState<{ src: string, shotId: string } | null>(null);

    // --- HANDLER FOR APPLYING INPAINT RESULTS ---
    const handleApplyInpaint = async (newImageUrl: string) => {
        if (!inpaintData) return;
        try {
            // 1. Update the shot manager locally and persist
            await rawShotMgr.updateShot(inpaintData.shotId, "image_url", newImageUrl);

            // 2. Close modal
            setInpaintData(null);
            toast.success("VFX Frame Updated");
        } catch (e) {
            console.error("Failed to apply inpaint:", e);
            toast.error("Failed to save changes");
        }
    };

    if (!isOpen) return null;

    return (
        <div className="relative z-[100]">
            {/* 3. Dark Mode Toaster (Prevents white box in dark UI) */}
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

            {/* 4. The Overlay UI */}
            <StoryboardOverlay
                activeSceneId={scene.id}
                currentScene={scene}
                credits={credits}
                styles={{}}

                // --- NAVIGATION IDS ---
                seriesId={projectId}
                episodeId={episodeId}

                // --- ASSET MAPPING ---
                castMembers={projectAssets?.characters || []}
                locations={projectAssets?.locations || []}

                // --- CONTEXT ---
                seriesName={seriesTitle || "UNTITLED PROJECT"}
                episodeTitle={episodeId === 'main' ? "FEATURE FILM" : `EPISODE ${episodeId}`}

                // --- PASS THE SAFE MANAGER ---
                shotMgr={safeShotMgr}

                // --- HANDLERS ---
                onClose={onClose}
                onDeleteShot={rawShotMgr.handleDeleteShot}

                inpaintData={inpaintData}
                setInpaintData={setInpaintData}
                onSaveInpaint={async (prompt: string, maskBase64: string, refImages: File[]) => {
                    if (!inpaintData) return null;
                    return await safeShotMgr.handleInpaintShot(inpaintData.shotId, prompt, maskBase64, refImages);
                }}
                onApplyInpaint={handleApplyInpaint}

                // --- PLACEHOLDERS ---
                onZoom={() => { }}
                onDownload={() => { }}
                tourStep={0}
                onTourNext={() => { }}
                onTourComplete={() => { }}
            />
        </div>
    );
};