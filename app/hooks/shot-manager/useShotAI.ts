import { api } from "@/lib/api";
import { toastError, toastSuccess } from "@/lib/toast";
import { getApiErrorMessage } from "@/lib/apiErrors";

/**
 * useShotAI — Fire-and-forget Auto-Direct hook.
 *
 * The POST /suggest_shots endpoint now returns 202 Accepted immediately.
 * The background worker writes shots to Firestore; the parent hook
 * (useShotManager) listens to the scene document for status transitions.
 *
 * This hook only owns the API call and error handling.
 * `isAutoDirecting` state is lifted to useShotManager and driven by
 * both the optimistic 202 response and the authoritative Firestore
 * `auto_direct_status` field.
 */
export const useShotAI = (
    projectId: string,
    episodeId: string,
    sceneId: string | null,
    setIsAutoDirecting: (v: boolean) => void,
    onLowCredits?: () => void
) => {

    const handleAutoDirect = async (currentScene: any, overrideSummary?: string) => {
        if (!sceneId) return;

        // Optimistic: show loading UI immediately
        setIsAutoDirecting(true);

        const sceneAction = overrideSummary || currentScene.summary || currentScene.synopsis || "";

        // Extract Strict Location Data
        const sceneLocationName = currentScene.location_name || currentScene.location || "Unknown";
        const sceneLocationId = currentScene.location_id || "";

        // Extract Products context
        const sceneProductsArray = currentScene.products || [];
        const sceneProductsString = Array.isArray(sceneProductsArray) ? sceneProductsArray.join(", ") : "";

        let sceneChars = Array.isArray(currentScene.characters) ? currentScene.characters.join(", ") : (currentScene.characters || "");

        // Prepare payload for AI
        const payload = {
            project_id: projectId,
            episode_id: episodeId,
            scene_id: sceneId,
            scene_action: sceneAction,
            characters: sceneChars,
            location: sceneLocationName,
            location_id: sceneLocationId,
            products: sceneProductsString,
            scene_duration: currentScene.estimated_duration_seconds || 0,
            regenerate_set: false
        };

        try {
            const res = await api.post("/api/v1/shot/suggest_shots", payload);

            if (res.status === 202 || res.data?.status === "processing") {
                // Job is queued — the onSnapshot listener in useShotManager
                // handles the rest (ai_logs, auto_direct_status transitions).
                toastSuccess("Auto-Direct started. You'll see results in real-time.");
                return;
            }

            // Unexpected success status — log but don't crash
            console.warn("[useShotAI] Unexpected response status:", res.status, res.data);

        } catch (e: any) {
            console.error("[useShotAI] Auto-Direct error:", e);

            if (e.response?.status === 402) {
                // Insufficient credits — trigger the credit purchase modal
                if (onLowCredits) {
                    onLowCredits();
                } else {
                    toastError("Insufficient credits. Please top up to use Auto-Direct.");
                }
            } else {
                const errorMsg = getApiErrorMessage(e, "Auto-Direct failed");
                toastError(errorMsg);
            }

            // Revert optimistic state on error — the API call itself failed,
            // so no background worker is running.
            setIsAutoDirecting(false);
        }
    };

    return { handleAutoDirect };
};