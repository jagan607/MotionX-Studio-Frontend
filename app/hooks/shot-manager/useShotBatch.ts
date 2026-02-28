import { useState, useRef } from "react";
import { api } from "@/lib/api";
import { toastSuccess, toastError } from "@/lib/toast";

export const useShotBatch = (
    shotsRef: React.MutableRefObject<any[]>,
    handleRenderShot: (shot: any, aspectRatio: string) => Promise<void>,
    projectId: string,
    episodeId: string,
    activeSceneId: string | null,
    modelTier: 'flash' | 'pro' = 'flash'
) => {
    const [isGeneratingAll, setIsGeneratingAll] = useState(false);
    const [isStopping, setIsStopping] = useState(false);
    const cancelGenerationRef = useRef(false);

    const stopGeneration = () => {
        cancelGenerationRef.current = true;
        setIsStopping(true);
    };

    const handleGenerateAll = async (aspectRatio: string) => {
        const shots = shotsRef.current;
        if (!shots.length || !activeSceneId) return;

        setIsGeneratingAll(true);
        setIsStopping(false);
        cancelGenerationRef.current = false;

        try {
            // Extract all camera transforms & shot types for the batch
            const cameraTransforms: Record<string, any> = {};
            const cameraShotTypes: Record<string, string> = {};
            shots.forEach(shot => {
                if (shot.camera_transform) {
                    cameraTransforms[shot.id] = shot.camera_transform;
                }
                if (shot.camera_shot_type) {
                    cameraShotTypes[shot.id] = shot.camera_shot_type;
                }
            });

            const formData = new FormData();
            formData.append("project_id", projectId);
            formData.append("episode_id", episodeId);
            formData.append("scene_id", activeSceneId);
            formData.append("image_provider", "gemini");
            formData.append("aspect_ratio", aspectRatio);
            formData.append("style", "");

            if (Object.keys(cameraTransforms).length > 0) {
                formData.append("camera_transforms", JSON.stringify(cameraTransforms));
            }
            if (Object.keys(cameraShotTypes).length > 0) {
                formData.append("camera_shot_types", JSON.stringify(cameraShotTypes));
            }
            formData.append("model_tier", modelTier);

            const res = await api.post("/api/v1/images/generate_scene", formData);

            if (res.data.status === "queued") {
                toastSuccess(`Generating ${res.data.shot_count || shots.length} shots...`);
            } else {
                toastError("Failed to queue scene generation");
            }
        } catch (e: any) {
            console.error("[BatchGen] Scene generation error:", e);
            toastError(e.response?.data?.detail || "Scene generation failed");
        }

        // The Firestore listener will update shot statuses in real-time
        // We keep isGeneratingAll true until all shots have rendered
        // Poll briefly to detect when shots are done
        const waitForCompletion = async () => {
            const maxWait = 300000; // 5 min max
            const pollInterval = 3000;
            let elapsed = 0;

            while (elapsed < maxWait && !cancelGenerationRef.current) {
                await new Promise(r => setTimeout(r, pollInterval));
                elapsed += pollInterval;

                const current = shotsRef.current;
                const allDone = current.every(
                    (s: any) => s.image_url || s.status === "rendered" || s.status === "error"
                );
                if (allDone) break;
            }

            setIsGeneratingAll(false);
            setIsStopping(false);
        };

        waitForCompletion();
    };

    return { isGeneratingAll, isStopping, stopGeneration, handleGenerateAll };
};