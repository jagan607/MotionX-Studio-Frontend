import { doc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { api } from "@/lib/api";
import { toastError } from "@/lib/toast";
import { useState } from "react";

// Helper to match backend CAPS_CAPS format
const simpleSanitize = (text: string) => text.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();

export const useShotAI = (
    projectId: string,
    episodeId: string,
    sceneId: string | null,
    setTerminalLog: (log: string[] | ((prev: string[]) => string[])) => void
) => {
    const [isAutoDirecting, setIsAutoDirecting] = useState(false);

    const handleAutoDirect = async (currentScene: any, overrideSummary?: string) => {
        if (!sceneId) return;
        setIsAutoDirecting(true);
        setTerminalLog(prev => [...prev, "> INITIALIZING AI DIRECTOR..."]);

        const sceneAction = overrideSummary || currentScene.summary || currentScene.synopsis || "";

        // Extract Strict Location Data
        const sceneLocationName = currentScene.location_name || currentScene.location || "Unknown";
        const sceneLocationId = currentScene.location_id || "";

        // Extract Products context
        const sceneProductsArray = currentScene.products || [];
        const sceneProductsString = Array.isArray(sceneProductsArray) ? sceneProductsArray.join(", ") : "";

        let sceneChars = Array.isArray(currentScene.characters) ? currentScene.characters.join(", ") : (currentScene.characters || "");

        // Prepare payload for AI
        const payload = {
            project_id: projectId,
            episode_id: episodeId,
            scene_id: sceneId,
            scene_action: sceneAction,
            characters: sceneChars,
            location: sceneLocationName,
            products: sceneProductsString,
            scene_duration: currentScene.estimated_duration_seconds || 0
        };

        try {
            const res = await api.post("/api/v1/shot/suggest_shots", payload);

            if (res.data && res.data.shots) {
                setTerminalLog(prev => [...prev, "> WRITING SHOT LIST..."]);
                const batch = writeBatch(db);

                res.data.shots.forEach((shot: any, index: number) => {
                    const newShotId = `shot_${String(index + 1).padStart(2, '0')}`;
                    const shotRef = doc(db, "projects", projectId, "episodes", episodeId, "scenes", sceneId, "shots", newShotId);

                    // 1. Sanitize Character IDs
                    let charArray: string[] = [];
                    if (Array.isArray(shot.characters)) {
                        charArray = shot.characters.map((c: string) => simpleSanitize(c));
                    }

                    // 2. [FIXED] Strict Product Handling
                    let productArray: string[] = [];

                    // IF the AI returns an array (even empty), we use it.
                    // This respects shots that have NO products (e.g. atmospheric shots).
                    if (Array.isArray(shot.products)) {
                        productArray = shot.products.map((p: string) => simpleSanitize(p));
                    }
                    // ONLY fallback if the key is completely missing (undefined/null)
                    // Inherit scene products so non-ad projects still propagate props to generate_shot
                    else if (sceneProductsArray.length > 0) {
                        productArray = sceneProductsArray.map((p: string) => simpleSanitize(p));
                    }

                    batch.set(shotRef, {
                        id: newShotId,
                        shot_type: shot.shot_type,
                        visual_action: shot.image_prompt || shot.description || "",
                        video_prompt: shot.video_prompt || "",
                        characters: charArray,
                        products: productArray,
                        estimated_duration: shot.estimated_duration || 0,

                        // Prefer AI-returned shot location, fallback to scene location
                        location: shot.location || sceneLocationName,
                        location_id: shot.location ? shot.location.replace(/[\s.]+/g, '_').toUpperCase() : sceneLocationId,

                        status: "draft",
                        order: index,
                        created_at: new Date().toISOString()
                    });
                });

                await batch.commit();
                setTerminalLog(prev => [...prev, "> SHOT LIST GENERATED SUCCESSFULLY."]);
            }
        } catch (e: any) {
            console.error(e);
            const errorMsg = e.response?.data?.detail || "Auto-Direct failed";
            setTerminalLog(prev => [...prev, `> ERROR: ${errorMsg.toUpperCase()}`]);
            toastError(errorMsg);
        } finally {
            setIsAutoDirecting(false);
        }
    };

    return { isAutoDirecting, handleAutoDirect };
};