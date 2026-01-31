import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { api } from "@/lib/api";
import { toast } from "react-hot-toast";

export const useShotAudioGen = (
    projectId: string,
    episodeId: string,
    sceneId: string | null
) => {

    // FIX: Updated signature to accept the full 'shot' object
    const handleGenerateVoiceover = async (shot: any) => {
        // Validate inside the function
        const text = shot.voiceover_text || shot.dialogue || "";
        const voiceId = shot.voice_id || "default_voice"; // Fallback or handle error

        if (!text) {
            throw new Error("No dialogue or voiceover text found in shot.");
        }

        try {
            const formData = new FormData();
            formData.append("text", text);
            formData.append("voice_id", voiceId);

            // Optional: Pass context if backend needs it to update DB directly
            formData.append("project_id", projectId);
            formData.append("episode_id", episodeId);
            formData.append("scene_id", sceneId!);
            formData.append("shot_id", shot.id);

            const res = await api.post("/api/v1/shot/generate_voiceover", formData);

            const audioUrl = res.data.audio_url;

            // Update Firestore immediately if successful
            if (audioUrl && sceneId) {
                const shotRef = doc(db, "projects", projectId, "episodes", episodeId, "scenes", sceneId, "shots", shot.id);
                await setDoc(shotRef, {
                    audio_url: audioUrl,
                    audio_status: "ready"
                }, { merge: true });
            }

            return audioUrl || null;
        } catch (e: any) {
            console.error(e);
            throw new Error(e.response?.data?.detail || "Voiceover generation failed");
        }
    };

    const handleLipSyncShot = async (shot: any, audioUrl: string | null, audioFile: File | null) => {
        if (!shot.video_url) return toast.error("No video to sync");
        if (!sceneId) return;

        const shotRef = doc(db, "projects", projectId, "episodes", episodeId, "scenes", sceneId, "shots", shot.id);
        await setDoc(shotRef, { video_status: "processing" }, { merge: true });

        try {
            const formData = new FormData();
            formData.append("project_id", projectId);
            formData.append("episode_id", episodeId);
            formData.append("scene_id", sceneId);
            formData.append("shot_id", shot.id);
            formData.append("video_url", shot.video_url);
            if (audioUrl) formData.append("audio_url", audioUrl);
            if (audioFile) formData.append("audio_file", audioFile);

            await api.post("/api/v1/shot/lipsync_shot", formData);
            toast.success("Lip Sync Queued");
        } catch (e: any) {
            toast.error(e.response?.data?.detail || "Lip Sync failed");
            await setDoc(shotRef, { video_status: "ready" }, { merge: true });
        }
    };

    return { handleGenerateVoiceover, handleLipSyncShot };
};