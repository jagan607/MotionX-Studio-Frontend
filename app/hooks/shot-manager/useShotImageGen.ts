import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { api } from "@/lib/api";
import { toast } from "react-hot-toast";

export const useShotImageGen = (
    projectId: string,
    episodeId: string,
    sceneId: string | null,
    addLoadingShot: (id: string) => void,
    removeLoadingShot: (id: string) => void,
    onLowCredits?: () => void
) => {

    const handleRenderShot = async (shot: any, aspectRatio: string, referenceFile?: File | null) => {
        addLoadingShot(shot.id);

        let style = "";
        try {
            const projectRef = doc(db, "projects", projectId);
            const pSnap = await getDoc(projectRef);
            if (pSnap.exists()) {
                const mb = pSnap.data().moodboard || {};
                style = mb.style || pSnap.data().style || "Cinematic, Realistic";
            }
        } catch (e) { }

        const formData = new FormData();
        formData.append("project_id", projectId);
        formData.append("episode_id", episodeId);
        formData.append("scene_id", sceneId!);
        formData.append("shot_id", shot.id);
        formData.append("shot_prompt", `${shot.visual_action} ${style}`.trim());
        formData.append("shot_type", shot.shot_type || "Wide Shot");
        formData.append("characters", Array.isArray(shot.characters) ? shot.characters.join(",") : "");
        formData.append("location", shot.location || "");
        formData.append("aspect_ratio", aspectRatio);

        if (referenceFile) formData.append("reference_image", referenceFile);

        try {
            await api.post("/api/v1/shot/generate_shot", formData);
        } catch (e: any) {
            if (e.response && e.response.status === 402) {
                if (onLowCredits) onLowCredits();
            } else {
                toast.error(e.response?.data?.detail || "Generation failed");
            }
        } finally {
            removeLoadingShot(shot.id);
        }
    };

    const handleFinalizeShot = async (shot: any) => {
        if (!shot.image_url) return;
        addLoadingShot(shot.id);

        try {
            const formData = new FormData();
            formData.append("project_id", projectId);
            formData.append("episode_id", episodeId);
            formData.append("scene_id", sceneId!);
            formData.append("shot_id", shot.id);
            formData.append("image_url", shot.image_url);

            await api.post("/api/v1/shot/finalize_shot", formData);
            toast.success("Shot Finalized");
        } catch (e: any) {
            toast.error(e.response?.data?.detail || "Finalization failed");
        } finally {
            removeLoadingShot(shot.id);
        }
    };

    return { handleRenderShot, handleFinalizeShot };
};