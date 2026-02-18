import { doc, writeBatch } from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { toastError } from "@/lib/toast";

export const useShotMedia = (
    projectId: string,
    episodeId: string,
    sceneId: string | null,
    shots: any[],
    setShots: (shots: any[]) => void,
    setTerminalLog: (log: string[] | ((prev: string[]) => string[])) => void
) => {

    const wipeShotImagesOnly = async () => {
        if (!sceneId || shots.length === 0) return;
        const shotsWithMedia = shots.filter(s => s.image_url || s.video_url);
        if (shotsWithMedia.length === 0) return;

        setTerminalLog(prev => [...prev, "> CLEARING EXISTING MEDIA..."]);
        try {
            const storagePromises: Promise<void>[] = [];
            const batch = writeBatch(db);

            shotsWithMedia.forEach((shot) => {
                // Use storage ref for deletion
                if (shot.image_url) storagePromises.push(deleteObject(ref(storage, shot.image_url)).catch(() => { }));
                if (shot.video_url) storagePromises.push(deleteObject(ref(storage, shot.video_url)).catch(() => { }));

                // FIX: Renamed 'ref' to 'shotRef' to avoid conflict
                const shotRef = doc(db, "projects", projectId, "episodes", episodeId, "scenes", sceneId, "shots", shot.id);
                batch.update(shotRef, { image_url: null, video_url: null, status: "draft" });
            });

            await Promise.all(storagePromises);
            await batch.commit();
            setTerminalLog(prev => [...prev, "> MEDIA CLEARED."]);
        } catch (error) {
            toastError("Failed to clear media");
        }
    };

    const wipeSceneData = async () => {
        if (!sceneId) return;
        setTerminalLog(prev => [...prev, "> PURGING SCENE DATA..."]);

        try {
            const storagePromises: Promise<void>[] = [];
            shots.forEach((shot) => {
                if (shot.image_url) storagePromises.push(deleteObject(ref(storage, shot.image_url)).catch(() => { }));
                if (shot.video_url) storagePromises.push(deleteObject(ref(storage, shot.video_url)).catch(() => { }));
            });
            await Promise.all(storagePromises);

            const batch = writeBatch(db);
            shots.forEach((shot) => {
                const shotRef = doc(db, "projects", projectId, "episodes", episodeId, "scenes", sceneId, "shots", shot.id);
                batch.delete(shotRef);
            });
            await batch.commit();

            setShots([]);
            setTerminalLog(prev => [...prev, "> SCENE RESET COMPLETE."]);
        } catch (error) {
            toastError("Failed to reset scene");
        }
    };

    return { wipeShotImagesOnly, wipeSceneData };
};