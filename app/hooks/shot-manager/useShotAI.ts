import { doc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { api } from "@/lib/api"; // Correct import
import { toast } from "react-hot-toast";
import { useState } from "react";

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
        const sceneLocation = currentScene.location || "Unknown";
        let sceneChars = Array.isArray(currentScene.characters) ? currentScene.characters.join(", ") : (currentScene.characters || "");

        const payload = {
            project_id: projectId,
            episode_id: episodeId,
            scene_id: sceneId,
            scene_action: sceneAction,
            characters: sceneChars,
            location: sceneLocation
        };

        try {
            // Updated to use api.post (no manual headers needed)
            const res = await api.post("/api/v1/shot/suggest_shots", payload);

            if (res.data && res.data.shots) {
                setTerminalLog(prev => [...prev, "> WRITING SHOT LIST..."]);
                const batch = writeBatch(db);

                res.data.shots.forEach((shot: any, index: number) => {
                    const newShotId = `shot_${String(index + 1).padStart(2, '0')}`;
                    const shotRef = doc(db, "projects", projectId, "episodes", episodeId, "scenes", sceneId, "shots", newShotId);

                    let charArray: string[] = [];
                    if (typeof shot.characters === 'string') {
                        charArray = shot.characters.split(',').map((c: string) => c.trim()).filter((c: string) => c);
                    } else if (Array.isArray(shot.characters)) {
                        charArray = shot.characters;
                    }

                    batch.set(shotRef, {
                        id: newShotId,
                        shot_type: shot.shot_type,
                        visual_action: shot.image_prompt || shot.description || "",
                        video_prompt: shot.video_prompt || "",
                        characters: charArray,
                        location: sceneLocation,
                        status: "draft",
                        order: index,
                        created_at: new Date().toISOString()
                    });
                });

                await batch.commit();
            }
        } catch (e: any) {
            console.error(e);
            toast.error(e.response?.data?.detail || "Auto-Direct failed");
        } finally {
            setIsAutoDirecting(false);
        }
    };

    return { isAutoDirecting, handleAutoDirect };
};