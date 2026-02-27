import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { api } from "@/lib/api";
import { toastError, toastSuccess } from "@/lib/toast";

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
        provider: 'gemini' | 'seedream' = 'gemini',
        continuityRefId?: string | null,
        cameraTransform?: any,
        cameraShotType?: string,
        modelTier: 'flash' | 'pro' = 'flash'
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
        let actionPrompt = `${shot.visual_action || shot.action} ${style}`.trim();

        // [NEW] If Gizmo was used, prepend the exact camera phrasing to the prompt
        if (cameraShotType) {
            actionPrompt = `[Camera: ${cameraShotType}] ${actionPrompt}`;
        }

        formData.append("scene_action", actionPrompt);

        // [EXISTING] Characters
        formData.append("characters", Array.isArray(shot.characters) ? shot.characters.join(",") : (shot.characters || ""));

        // [NEW] Products & Location ID
        // Send comma-separated list of product IDs
        formData.append("products", Array.isArray(shot.products) ? shot.products.join(",") : (shot.products || ""));

        // Send specific location ID if available (more precise than name)
        if (shot.location_id) {
            formData.append("location_id", shot.location_id);
        }

        formData.append("location", shot.location || "");
        formData.append("shot_type", shot.shot_type || "Wide Shot");
        formData.append("aspect_ratio", aspectRatio);
        formData.append("image_provider", provider);
        formData.append("style", style);
        formData.append("genre", genre);

        // [NEW] Camera transform data
        console.log("PAYLOAD DEBUG: cameraTransform", cameraTransform, "cameraShotType", cameraShotType);
        if (cameraTransform) {
            formData.append("camera_transform", JSON.stringify(cameraTransform));
        }
        if (cameraShotType) {
            // Include auto-derived shot type from gizmo
            formData.append("camera_shot_type", cameraShotType);
        }

        // [NEW] Continuity reference shot (overrides default N-1 behavior)
        if (continuityRefId) {
            formData.append("continuity_shot_id", continuityRefId);
        }

        // 3. Append File if it exists
        if (referenceFile) {
            formData.append("reference_image", referenceFile);
        }

        // [NEW] Append the model tier
        formData.append("model_tier", modelTier);

        try {
<<<<<<< HEAD
            const res = await api.post("/api/v1/images/generate_shot", formData);
=======
            const endpoint = cameraTransform ? "/api/v1/shot/reimagine_shot" : "/api/v1/images/generate_shot";
            // FIX: Explicitly set Content-Type to multipart/form-data
            const res = await api.post(endpoint, formData, {
                headers: { "Content-Type": "multipart/form-data" }
            });
>>>>>>> ee6e98a (Camera orbit functionality added for camera control)

            toastSuccess(`Generating with ${provider}...`);
        } catch (e: any) {
            console.error(e);
            await updateDoc(shotRef, { status: "failed" });

            if (e.response && e.response.status === 402) {
                if (onLowCredits) onLowCredits();
                else toastError("Insufficient Credits");
            } else {
                toastError(getErrorMessage(e));
            }
        } finally {
            removeLoadingShot(shot.id);
        }
    };

    const handleUpscaleShot = async (shot: any) => {
        if (!shot.image_url) {
            toastError("Shot has no image to upscale");
            return;
        }
        if (shot.is_upscaled) {
            toastError("Shot is already upscaled to 4K");
            return;
        }
        addLoadingShot(shot.id);

        try {
            const { upscaleShot } = await import("@/lib/api");
            await upscaleShot(projectId, episodeId, sceneId!, shot.id, 'pro');
            toastSuccess("4K upscale started");
        } catch (e: any) {
            const msg = e.response?.data?.detail || e.response?.data?.message || getErrorMessage(e);
            toastError(msg);
        } finally {
            removeLoadingShot(shot.id);
        }
    };

    const handleInpaintShot = async (
        shotId: string,
        prompt: string,
        maskBase64: string,
        originalImageUrl: string,
        refImages: File[]
    ): Promise<string | null> => {
        if (!sceneId) return null;

        const shotRef = doc(db, "projects", projectId, "episodes", episodeId, "scenes", sceneId, "shots", shotId);

        try {
            await updateDoc(shotRef, { status: "inpainting" });

            const formData = new FormData();
            formData.append("project_id", projectId);
            formData.append("shot_id", shotId);
            formData.append("prompt", prompt);

            formData.append("original_image_url", originalImageUrl);

            formData.append("mask_image_base64", maskBase64);

            refImages.forEach((file) => {
                formData.append("reference_images", file);
            });

            const res = await api.post("/api/v1/shot/inpaint_shot", formData);

            if (res.data.image_url) {
                return res.data.image_url;
            }
            return null;

        } catch (e: any) {
            console.error(e);
            toastError(getErrorMessage(e));
            await updateDoc(shotRef, { status: "failed" });
            return null;
        }
    };

    return { handleRenderShot, handleUpscaleShot, handleInpaintShot };
};