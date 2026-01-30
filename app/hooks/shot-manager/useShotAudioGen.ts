import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { api } from "@/lib/api";
import { toast } from "react-hot-toast";

export const useShotAudioGen = (
    projectId: string,
    episodeId: string,
    sceneId: string | null
) => {

    const handleGenerateVoiceover = async (text: string, voiceId: string) => {
        try {
            const formData = new FormData();
            formData.append("text", text);
            formData.append("voice_id", voiceId);

            const res = await api.post("/api/v1/shot/generate_voiceover", formData);
            return res.data.audio_url || null;
        } catch (e) {
            return null;
        }
    };

    const handleLipSyncShot = async (shot: any, audioUrl: string | null, audioFile: File | null) => {
        if (!shot.video_url) return toast.error("No video to sync");

        const shotRef = doc(db, "projects", projectId, "episodes", episodeId, "scenes", sceneId!, "shots", shot.id);
        await setDoc(shotRef, { video_status: "processing" }, { merge: true });

        try {
            const formData = new FormData();
            formData.append("project_id", projectId);
            formData.append("episode_id", episodeId);
            formData.append("scene_id", sceneId!);
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