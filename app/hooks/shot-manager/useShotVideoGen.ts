import { api } from "@/lib/api";
import { toast } from "react-hot-toast";

export const useShotVideoGen = (
    projectId: string,
    episodeId: string,
    sceneId: string | null
) => {

    // UPDATED: Added provider type and endFrameUrl (nullable)
    const handleAnimateShot = async (
        shot: any,
        provider: 'kling' | 'seedance' = 'kling',
        endFrameUrl?: string | null
    ) => {
        if (!shot.image_url) return toast.error("No image to animate");

        try {
            const formData = new FormData();
            formData.append("project_id", projectId);
            formData.append("episode_id", episodeId);
            formData.append("scene_id", sceneId!);
            formData.append("shot_id", shot.id);
            formData.append("image_url", shot.image_url);
            formData.append("prompt", shot.video_prompt || "Cinematic motion");
            formData.append("provider", provider);

            // NEW: Handle Morphing
            if (endFrameUrl) {
                formData.append("end_frame_url", endFrameUrl);
            }

            await api.post("/api/v1/shot/animate_shot", formData);
            toast.success("Animation Queued");
        } catch (e: any) {
            toast.error(e.response?.data?.detail || "Animation request failed");
        }
    };

    return { handleAnimateShot };
};