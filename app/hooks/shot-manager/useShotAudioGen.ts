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

        console.log("shot", shot);
        if (!text) {
            throw new Error("No dialogue or voiceover text found in shot.");
        }

        try {
            const payload = {
                text: text,
                voice_id: voiceId,
                emotion: shot.emotion || "Neutral", // Optional
                project_id: projectId,
                episode_id: episodeId,
                scene_id: sceneId,
                shot_id: shot.id
            };

            const res = await api.post("/api/v1/shot/generate_voiceover", payload);
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
        if (!audioUrl && !audioFile) return toast.error("No audio provided");
        if (!sceneId) return;

        const shotRef = doc(db, "projects", projectId, "episodes", episodeId, "scenes", sceneId, "shots", shot.id);
        await setDoc(shotRef, { video_status: "processing" }, { merge: true });

        try {
            let finalAudioUrl = audioUrl;

            // 1. If user uploaded a file, upload it first to get a URL
            if (audioFile) {
                const uploadFormData = new FormData();
                uploadFormData.append("file", audioFile);

                const uploadRes = await api.post("/api/v1/shot/upload_temp_audio", uploadFormData, {
                    headers: { "Content-Type": "multipart/form-data" }
                });
                finalAudioUrl = uploadRes.data.url;
            }

            if (!finalAudioUrl) throw new Error("Audio upload failed");

            // 2. Send Pure JSON Request using the Class structure
            const payload = {
                project_id: projectId,
                episode_id: episodeId,
                scene_id: sceneId,
                shot_id: shot.id,
                video_url: shot.video_url,
                audio_url: finalAudioUrl // Now we always have a URL string
            };

            await api.post("/api/v1/shot/lipsync_shot", payload);

            toast.success("Lip Sync Queued");
        } catch (e: any) {
            console.error(e);
            toast.error(e.response?.data?.detail || "Lip Sync failed");
            await setDoc(shotRef, { video_status: "ready" }, { merge: true });
        }
    };

    return { handleGenerateVoiceover, handleLipSyncShot };
};