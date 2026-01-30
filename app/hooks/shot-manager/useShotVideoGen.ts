import { api } from "@/lib/api";
import { toast } from "react-hot-toast";

export const useShotVideoGen = (
    projectId: string,
    episodeId: string,
    sceneId: string | null
) => {

    const handleAnimateShot = async (shot: any, provider: string = 'kling') => {
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

            await api.post("/api/v1/shot/animate_shot", formData);
        } catch (e: any) {
            toast.error(e.response?.data?.detail || "Animation request failed");
        }
    };

    return { handleAnimateShot };
};