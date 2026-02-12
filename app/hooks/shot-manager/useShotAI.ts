import { doc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { api } from "@/lib/api";
import { toast } from "react-hot-toast";
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
            products: sceneProductsString // Send product context to Gemini
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
                    // This prevents accidentally wiping products if an older AI model is used.
                    else if (sceneProductsArray.length > 0) {
                        // Optional: You could fallback to inherit, or default to empty.
                        // For Ads, safer to default to empty so users manually add products rather than polluting every shot.
                        productArray = [];
                    }

                    batch.set(shotRef, {
                        id: newShotId,
                        shot_type: shot.shot_type,
                        visual_action: shot.image_prompt || shot.description || "",
                        video_prompt: shot.video_prompt || "",
                        characters: charArray,
                        products: productArray, // Accurate assignment

                        // Strict Inheritance: Force Scene Location
                        location: sceneLocationName,
                        location_id: sceneLocationId,

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
            toast.error(errorMsg);
        } finally {
            setIsAutoDirecting(false);
        }
    };

    return { isAutoDirecting, handleAutoDirect };
};