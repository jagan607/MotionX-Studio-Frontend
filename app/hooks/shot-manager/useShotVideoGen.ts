import { api } from "@/lib/api";
import { toast } from "react-hot-toast";

export const useShotVideoGen = (
    projectId: string,
    episodeId: string,
    sceneId: string | null
) => {

    const handleAnimateShot = async (
        shot: any,
        provider: 'kling' | 'seedance' = 'kling',
        endFrameUrl?: string | null
    ) => {
        if (!shot.image_url) return toast.error("No image to animate");

        try {
            // FIX: Use JSON Payload instead of FormData
            const payload = {
                project_id: projectId,
                episode_id: episodeId,
                scene_id: sceneId!,
                shot_id: shot.id,
                image_url: shot.image_url,
                prompt: shot.video_prompt || "Cinematic motion",
                provider: provider,
                end_frame_url: endFrameUrl || null
            };

            await api.post("/api/v1/shot/animate_shot", payload);
            toast.success("Animation Queued");
        } catch (e: any) {
            toast.error(e.response?.data?.detail || "Animation request failed");
        }
    };

    return { handleAnimateShot };
};