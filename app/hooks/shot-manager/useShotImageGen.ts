import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { api } from "@/lib/api";
import { toast } from "react-hot-toast";

// Helper to handle API errors
const getErrorMessage = (e: any) => {
    return e.response?.data?.detail || "Generation failed";
};

export const useShotImageGen = (
    projectId: string,
    episodeId: string,
    sceneId: string | null,
    addLoadingShot: (id: string) => void,
    removeLoadingShot: (id: string) => void,
    onLowCredits?: () => void
) => {

    const handleRenderShot = async (
        shot: any,
        aspectRatio: string,
        referenceFile?: File | null,
        provider: 'gemini' | 'seedream' = 'gemini'
    ) => {
        if (!sceneId) return;

        addLoadingShot(shot.id);

        // Optimistic UI Update
        const shotRef = doc(db, "projects", projectId, "episodes", episodeId, "scenes", sceneId, "shots", shot.id);
        await updateDoc(shotRef, { status: "generating" });

        let style = "";
        let genre = "Cinematic";

        // 1. Fetch Project Style/Genre
        try {
            const projectRef = doc(db, "projects", projectId);
            const pSnap = await getDoc(projectRef);
            if (pSnap.exists()) {
                const data = pSnap.data();
                style = data.style || "Cinematic, Realistic";
                genre = data.genre || "Drama";
            }
        } catch (e) { console.warn("Failed to fetch project style", e); }

        // 2. Prepare FormData Payload
        const formData = new FormData();

        // Append text fields
        formData.append("project_id", projectId);
        formData.append("episode_id", episodeId);
        formData.append("scene_id", sceneId);
        formData.append("shot_id", shot.id);

        // Combine action + style for better results
        const actionPrompt = `${shot.visual_action || shot.action} ${style}`.trim();
        formData.append("scene_action", actionPrompt);

        formData.append("characters", Array.isArray(shot.characters) ? shot.characters.join(",") : (shot.characters || ""));
        formData.append("location", shot.location || "");
        formData.append("shot_type", shot.shot_type || "Wide Shot");
        formData.append("aspect_ratio", aspectRatio);
        formData.append("image_provider", provider);
        formData.append("style", style);
        formData.append("genre", genre);

        // 3. Append File if it exists
        if (referenceFile) {
            formData.append("reference_image", referenceFile);
        }

        try {
            // FIX: Explicitly set Content-Type to multipart/form-data
            // This overrides the 'application/json' default in your lib/api.ts
            const res = await api.post("/api/v1/images/generate_shot", formData, {
                headers: { "Content-Type": "multipart/form-data" }
            });

            if (res.data.status === "queued") {
                toast.success(`Generating with ${provider}...`);
            }
        } catch (e: any) {
            console.error(e);
            await updateDoc(shotRef, { status: "failed" });

            if (e.response && e.response.status === 402) {
                if (onLowCredits) onLowCredits();
                else toast.error("Insufficient Credits");
            } else {
                toast.error(getErrorMessage(e));
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

            // Same fix here for consistency, although finalize usually doesn't send files
            await api.post("/api/v1/shot/finalize_shot", formData, {
                headers: { "Content-Type": "multipart/form-data" }
            });

            toast.success("Shot Finalized");
        } catch (e: any) {
            toast.error(getErrorMessage(e));
        } finally {
            removeLoadingShot(shot.id);
        }
    };

    const handleInpaintShot = async (
        shotId: string,
        prompt: string,
        maskBase64: string,
        refImages: File[]
    ): Promise<string | null> => {
        if (!sceneId) return null;

        // Optimistic update not needed for modal driven flow usually, but good for consistency
        const shotRef = doc(db, "projects", projectId, "episodes", episodeId, "scenes", sceneId, "shots", shotId);

        try {
            await updateDoc(shotRef, { status: "inpainting" }); // Optional status

            const formData = new FormData();
            formData.append("project_id", projectId);
            formData.append("episode_id", episodeId);
            formData.append("scene_id", sceneId);
            formData.append("shot_id", shotId);
            formData.append("prompt", prompt);

            // Convert Base64 Mask to Blob
            const response = await fetch(maskBase64);
            const blob = await response.blob();
            formData.append("mask_image", blob, "mask.png");

            // Append Ref Images
            refImages.forEach((file, index) => {
                formData.append(`ref_image_${index}`, file);
            });

            // Call API
            // Note: Using a specific endpoint for inpainting. 
            // If backend is unified, this might need to change to /generate_shot with type="inpaint"
            const res = await api.post("/api/v1/images/inpaint_shot", formData, {
                headers: { "Content-Type": "multipart/form-data" }
            });

            // Return the new image URL from response
            if (res.data.image_url) {
                return res.data.image_url;
            }
            return null;

        } catch (e: any) {
            console.error(e);
            toast.error(getErrorMessage(e));
            await updateDoc(shotRef, { status: "failed" });
            return null;
        }
    };

    return { handleRenderShot, handleFinalizeShot, handleInpaintShot };
};