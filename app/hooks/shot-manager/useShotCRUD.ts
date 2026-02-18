import { doc, setDoc, deleteDoc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { arrayMove } from "@dnd-kit/sortable";
import { toastError } from "@/lib/toast";

export const useShotCRUD = (
    projectId: string,
    episodeId: string,
    sceneId: string | null,
    shots: any[],
    setShots: (shots: any[]) => void
) => {

    const handleAddShot = async (currentScene: any) => {
        if (!sceneId) return;

        // 1. Calculate ID
        let maxId = 0;
        shots.forEach(s => {
            try {
                const parts = s.id.split('_');
                if (parts.length > 1) {
                    const num = parseInt(parts[1], 10);
                    if (!isNaN(num) && num > maxId) maxId = num;
                }
            } catch (e) { }
        });
        const newShotId = `shot_${String(maxId + 1).padStart(2, '0')} `;

        // 2. Calculate Order
        const currentMaxOrder = shots.length > 0 ? Math.max(...shots.map(s => s.order || 0)) : -1;

        // 3. Inherit Scene Context
        // We prefer 'location_name' if injected by UI (resolved asset name), otherwise fallback to 'location' (header)
        const fallbackAction = currentScene?.description || currentScene?.summary || "";
        const sceneLocationName = currentScene?.location_name || currentScene?.location || "";
        const sceneLocationId = currentScene?.location_id || "";

        const shotRef = doc(db, "projects", projectId, "episodes", episodeId, "scenes", sceneId, "shots", newShotId);

        await setDoc(shotRef, {
            id: newShotId,
            shot_type: "Wide Shot",
            visual_action: fallbackAction,
            video_prompt: "",
            characters: [],
            // [FIXED] Explicitly inherit products array if present in scene
            products: currentScene?.products || [],
            // [FIXED] Explicitly map scene location to shot
            location: sceneLocationName,
            location_id: sceneLocationId,
            status: "draft",
            order: currentMaxOrder + 1,
            created_at: new Date().toISOString()
        });
    };

    const updateShot = async (shotId: string, field: string, value: any) => {
        if (!sceneId) return;
        const shotRef = doc(db, "projects", projectId, "episodes", episodeId, "scenes", sceneId, "shots", shotId);
        await setDoc(shotRef, { [field]: value }, { merge: true });
    };

    const handleDeleteShot = async (shotId: string) => {
        if (!sceneId) return;
        const shotRef = doc(db, "projects", projectId, "episodes", episodeId, "scenes", sceneId, "shots", shotId);
        await deleteDoc(shotRef);
    };

    const handleDragEnd = async (event: any) => {
        if (!sceneId) return;
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const oldIndex = shots.findIndex((s) => s.id === active.id);
        const newIndex = shots.findIndex((s) => s.id === over.id);

        const newShots = arrayMove(shots, oldIndex, newIndex);
        setShots(newShots); // Optimistic

        try {
            const batch = writeBatch(db);
            newShots.forEach((shot, index) => {
                if (shot.order !== index) {
                    const shotRef = doc(db, "projects", projectId, "episodes", episodeId, "scenes", sceneId, "shots", shot.id);
                    batch.update(shotRef, { order: index });
                }
            });
            await batch.commit();
        } catch (error) {
            console.error(error);
            toastError("Failed to save order");
        }
    };

    return { handleAddShot, updateShot, handleDeleteShot, handleDragEnd };
};