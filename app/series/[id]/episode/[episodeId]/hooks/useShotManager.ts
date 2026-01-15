import { useState, useEffect } from "react";
import { collection, onSnapshot, doc, setDoc, writeBatch, deleteDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { API_BASE_URL } from "@/lib/config";
import { arrayMove } from "@dnd-kit/sortable";

export const useShotManager = (seriesId: string, episodeId: string, activeSceneId: string | null) => {
    const [shots, setShots] = useState<any[]>([]);
    const [loadingShots, setLoadingShots] = useState<Set<string>>(new Set());
    const [isAutoDirecting, setIsAutoDirecting] = useState(false);
    const [terminalLog, setTerminalLog] = useState<string[]>([]);
    const [aspectRatio, setAspectRatio] = useState("9:16");

    // Real-time listener
    useEffect(() => {
        if (!activeSceneId) return;
        const q = collection(db, "series", seriesId, "episodes", episodeId, "scenes", activeSceneId, "shots");
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const shotData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            shotData.sort((a, b) => a.id.localeCompare(b.id));
            setShots(shotData);
        });
        return () => unsubscribe();
    }, [activeSceneId, seriesId, episodeId]);

    // Helpers
    const addLoadingShot = (id: string) => setLoadingShots(prev => new Set(prev).add(id));
    const removeLoadingShot = (id: string) => setLoadingShots(prev => { const next = new Set(prev); next.delete(id); return next; });

    // CRUD
    const handleAddShot = async (currentScene: any) => {
        if (!activeSceneId) return;
        const newShotId = `shot_${String(shots.length + 1).padStart(2, '0')}`;
        await setDoc(doc(db, "series", seriesId, "episodes", episodeId, "scenes", activeSceneId, "shots", newShotId), {
            type: "Wide Shot",
            prompt: currentScene?.visual_action || "",
            characters: [],
            location: currentScene?.location || "",
            status: "draft"
        });
    };

    const updateShot = async (shotId: string, field: string, value: any) => {
        const ref = doc(db, "series", seriesId, "episodes", episodeId, "scenes", activeSceneId!, "shots", shotId);
        await setDoc(ref, { [field]: value }, { merge: true });
    };

    // --- UPDATED: Removed window.confirm logic here ---
    const handleDeleteShot = async (shotId: string) => {
        // Confirmation is now handled by the UI component (DeleteConfirmModal)
        const ref = doc(db, "series", seriesId, "episodes", episodeId, "scenes", activeSceneId!, "shots", shotId);
        await deleteDoc(ref);
    };

    const handleDragEnd = (event: any) => {
        const { active, over } = event;
        if (active.id !== over.id) {
            const oldIndex = shots.findIndex((s) => s.id === active.id);
            const newIndex = shots.findIndex((s) => s.id === over.id);
            setShots(arrayMove(shots, oldIndex, newIndex));
        }
    };

    // APIs
    const handleAutoDirect = async (currentScene: any) => {
        setIsAutoDirecting(true);
        setTerminalLog(["> INITIALIZING AI DIRECTOR..."]);
        const formData = new FormData();
        formData.append("series_id", seriesId);
        formData.append("episode_id", episodeId);
        formData.append("scene_id", activeSceneId!);
        formData.append("scene_action", currentScene.visual_action || "");
        formData.append("characters", currentScene.characters?.join(", ") || "None");
        formData.append("location", currentScene.location || "Unknown");

        try {
            const idToken = await auth.currentUser?.getIdToken();
            const res = await fetch(`${API_BASE_URL}/api/v1/shot/suggest_shots`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${idToken}` },
                body: formData
            });
            const data = await res.json();
            if (res.ok && data.shots) {
                setTerminalLog(prev => [...prev, "> GENERATING SHOT LIST..."]);
                const batch = writeBatch(db);
                const newShotsToRender: any[] = [];
                data.shots.forEach((shot: any, index: number) => {
                    const newShotId = `shot_${String(index + 1).padStart(2, '0')}`;
                    const docRef = doc(db, "series", seriesId, "episodes", episodeId, "scenes", activeSceneId!, "shots", newShotId);
                    const payload = { id: newShotId, type: shot.type, prompt: shot.description, characters: shot.characters || [], location: shot.location || "", status: "draft" };
                    batch.set(docRef, payload);
                    newShotsToRender.push(payload);
                });
                await batch.commit();
                setIsAutoDirecting(false);
                // Trigger Generation Loop
                for (const shot of newShotsToRender) {
                    await handleRenderShot(shot, currentScene);
                    await new Promise(r => setTimeout(r, 1500));
                }
            }
        } catch (e) { console.error(e); setIsAutoDirecting(false); }
    };

    const handleRenderShot = async (shot: any, currentScene: any) => {
        addLoadingShot(shot.id);
        const formData = new FormData();
        formData.append("series_id", seriesId);
        formData.append("episode_id", episodeId);
        formData.append("scene_id", activeSceneId!);
        formData.append("shot_id", shot.id);
        formData.append("shot_prompt", shot.prompt);
        formData.append("shot_type", shot.type);
        formData.append("characters", Array.isArray(shot.characters) ? shot.characters.join(",") : "");
        formData.append("location", shot.location || currentScene?.location || "");
        formData.append("aspect_ratio", aspectRatio);

        try {
            const idToken = await auth.currentUser?.getIdToken();
            await fetch(`${API_BASE_URL}/api/v1/shot/generate_shot`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${idToken}` },
                body: formData
            });
        } catch (e) { console.error(e); }
        finally { removeLoadingShot(shot.id); }
    };

    const handleAnimateShot = async (shot: any) => {
        if (!shot.image_url) return alert("Generate image first");
        try {
            const idToken = await auth.currentUser?.getIdToken();
            const formData = new FormData();
            formData.append("series_id", seriesId);
            formData.append("episode_id", episodeId);
            formData.append("scene_id", activeSceneId!);
            formData.append("shot_id", shot.id);
            formData.append("image_url", shot.image_url);
            formData.append("prompt", shot.prompt || "Cinematic movement");

            await fetch(`${API_BASE_URL}/api/v1/shot/animate_shot`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${idToken}` },
                body: formData
            });
        } catch (e) { console.error(e); alert("Animation failed"); }
    };

    return {
        shots, loadingShots, isAutoDirecting, terminalLog, aspectRatio, setAspectRatio,
        handleAddShot, updateShot, handleDeleteShot, handleDragEnd, handleAutoDirect,
        handleRenderShot, handleAnimateShot
    };
};