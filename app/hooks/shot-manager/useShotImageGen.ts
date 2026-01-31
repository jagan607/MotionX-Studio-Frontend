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
                const mb = data.moodboard || {};
                style = mb.style || data.style || "Cinematic, Realistic";
                genre = data.genre || "Drama";
            }
        } catch (e) { console.warn("Failed to fetch project style", e); }

        // 2. Prepare FormData Payload
        // Since backend uses UploadFile, we must use FormData, not JSON.
        const formData = new FormData();

        // Append text fields matches GenerateShotRequest model
        formData.append("project_id", projectId);
        formData.append("episode_id", episodeId);
        formData.append("scene_id", sceneId);
        formData.append("shot_id", shot.id);
        formData.append("scene_action", `${shot.visual_action || shot.action} ${style}`.trim());
        formData.append("characters", Array.isArray(shot.characters) ? shot.characters.join(",") : (shot.characters || ""));
        formData.append("location", shot.location || "");
        formData.append("shot_type", shot.shot_type || "Wide Shot");
        formData.append("aspect_ratio", aspectRatio);
        formData.append("image_provider", provider);
        formData.append("style", style);
        formData.append("genre", genre);

        // 3. Append File if it exists
        // FastAPI will map this to 'reference_image: UploadFile'
        if (referenceFile) {
            formData.append("reference_image", referenceFile);
        }

        try {
            // Note: When sending FormData, axios/api wrapper usually handles Content-Type automatically.
            const res = await api.post("/api/v1/images/generate_shot", formData);

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

            await api.post("/api/v1/shot/finalize_shot", formData);
            toast.success("Shot Finalized");
        } catch (e: any) {
            toast.error(getErrorMessage(e));
        } finally {
            removeLoadingShot(shot.id);
        }
    };

    return { handleRenderShot, handleFinalizeShot };
};