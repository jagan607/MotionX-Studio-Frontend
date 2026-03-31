import axios from "axios";
import { auth, db, storage } from "@/lib/firebase";
import { API_BASE_URL } from "./config";
import { Project, TaxonomyResponse } from "./types";
import { collection, collectionGroup, doc, getDoc, getDocs, limit, orderBy, query, updateDoc, where } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getActiveWorkspaceSlug } from "@/app/context/WorkspaceContext";

// 1. Create the Axios Instance
export const api = axios.create({
    baseURL: `${API_BASE_URL}`,
    headers: {
        "Content-Type": "application/json",
    },
});

// 2. Auth Interceptor
api.interceptors.request.use(
    async (config) => {
        const user = auth.currentUser;
        if (user) {
            const token = await user.getIdToken();
            config.headers.Authorization = `Bearer ${token}`;
        }
        // Inject workspace org header if active
        const orgSlug = getActiveWorkspaceSlug();
        if (orgSlug) {
            config.headers['X-Org-Id'] = orgSlug;
        }
        // Let the browser set Content-Type + boundary for FormData
        if (config.data instanceof FormData) {
            delete config.headers['Content-Type'];
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// 3. Response Interceptor
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            console.error("Unauthorized! Redirecting to login...");
        }
        return Promise.reject(error);
    }
);

// --- 4. PROJECT HELPERS ---

export const fetchProject = async (projectId: string): Promise<Project> => {
    const res = await api.get(`/api/v1/project/${projectId}`);
    return res.data;
};

// --- 5. SCRIPT & JOB HELPERS ---

export const checkJobStatus = async (jobId: string) => {
    try {
        const response = await api.get(`/api/v1/script/job_status/${jobId}`);
        return response.data;
    } catch (error: any) {
        if (error.response && error.response.status === 404) {
            return { status: "unknown", error: "Job not found" };
        }
        console.error("Polling Error:", error);
        return { status: "failed", error: "Network connection failed" };
    }
};

// --- 6. ASSET MANAGEMENT ---

export const fetchProjectAssets = async (projectId: string) => {
    const res = await api.get(`/api/v1/assets/${projectId}/all`);
    return res.data;
};

export const createAsset = async (projectId: string, data: any) => {
    return await api.post(`/api/v1/assets/${projectId}/create`, data);
};

export const updateAsset = async (projectId: string, assetType: string, assetId: string, data: any) => {
    return await api.put(`/api/v1/assets/${projectId}/${assetType}/${assetId}`, data);
};

export const deleteAsset = async (projectId: string, type: string, assetId: string) => {
    return await api.delete(`/api/v1/assets/${projectId}/${type}/${assetId}`);
};

export const uploadAssetReference = async (projectId: string, assetType: string, assetId: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return await api.post(`/api/v1/assets/${projectId}/${assetType}/${assetId}/upload-reference`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
    });
};

export const uploadAssetMain = async (projectId: string, assetType: string, assetId: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return await api.post(`/api/v1/assets/${projectId}/${assetType}/${assetId}/upload-main`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
    });
};

export const triggerAssetGeneration = async (
    projectId: string,
    assetId: string,
    type: string,
    prompt?: string,
    style?: any,
    aspect_ratio?: string,
    useRef?: boolean
) => {
    const body: Record<string, any> = {
        asset_id: assetId,
        type,
        prompt,
        aspect_ratio,
    };
    // Only include style if it has actual content
    if (style && Object.keys(style).length > 0) {
        body.style = style;
    }
    if (useRef !== undefined) {
        body.use_ref = useRef;
    }
    const res = await api.post(`/api/v1/assets/${projectId}/generate`, body);
    return res.data;
};

// --- 7. SHOT GENERATION (NEW - Fixes 422 Error) ---

export const generateShotImage = async (
    projectId: string,
    shotId: string,
    prompt: string,
    referenceFile?: File | null,
    provider: 'gemini' | 'seedream' = 'gemini'
) => {
    // 1. Create FormData
    const formData = new FormData();

    // 2. Append Fields
    formData.append("project_id", projectId);
    formData.append("shot_id", shotId);
    formData.append("prompt", prompt);
    formData.append("provider", provider);

    // 3. Append File (If exists)
    if (referenceFile) {
        formData.append("reference_image", referenceFile);
    }

    // 4. Send (Browser sets boundary automatically)
    const res = await api.post("/api/v1/images/generate_shot", formData);
    return res.data;
};

export const saveCameraTransform = async (
    projectId: string,
    episodeId: string,
    sceneId: string,
    shotId: string,
    cameraTransform: any
) => {
    try {
        const response = await api.post('/api/v1/shot/save_camera_transform', {
            project_id: projectId,
            episode_id: episodeId,
            scene_id: sceneId,
            shot_id: shotId,
            camera_transform: cameraTransform,
        });
        return response.data;
    } catch (error) {
        console.error("Error saving camera transform:", error);
        throw error;
    }
};

// --- 8. STUDIO & SCENES ---

export const fetchScenes = async (projectId: string, containerId?: string) => {
    const query = containerId ? `?container_id=${containerId}` : '';
    const res = await api.get(`/api/v1/script/${projectId}/scenes${query}`);
    return res.data;
};

export const fetchEpisodes = async (projectId: string) => {
    const res = await api.get(`/api/v1/project/${projectId}/episodes`);
    return res.data;
};

export interface DashboardProject extends Project {
    previewVideo?: string | null;
    previewImage?: string | null;
}

// --- CACHE SYSTEM ---
const projectCache: Record<string, { data: DashboardProject[], timestamp: number }> = {};
const CACHE_TTL = 1000 * 60 * 5; // 5 Minutes

export const invalidateDashboardCache = (uid: string) => {
    delete projectCache[uid];
};

// 1. Fast Load: Project list from backend (RBAC-filtered)
export const fetchUserProjectsBasic = async (uid: string): Promise<DashboardProject[]> => {
    // Check Cache
    if (projectCache[uid] && (Date.now() - projectCache[uid].timestamp < CACHE_TTL)) {
        return projectCache[uid].data;
    }

    try {
        const res = await api.get("/api/v1/project/list");

        const data = res.data;
        // Backend returns { projects: [...] } or a flat array — handle both
        let projects: DashboardProject[] = (data.projects || data || []).map((p: any) => ({
            ...p,
            id: p.id || p.project_id,
        }));

        // Sort by most recently updated (or created) first
        projects.sort((a, b) => {
            const dateA = new Date(a.updated_at || a.created_at || 0).getTime();
            const dateB = new Date(b.updated_at || b.created_at || 0).getTime();
            return dateB - dateA;
        });

        // Note: project scoping (B2C vs enterprise) is now handled by the backend
        // via the X-Org-Id header injected by the Axios interceptor.

        // Update Cache
        projectCache[uid] = { data: projects, timestamp: Date.now() };

        return projects;
    } catch (e) {
        console.error("[fetchUserProjectsBasic] Network error:", e);
        return [];
    }
}

// [NEW] 2. Slow Load: Hydrate a single project with media
export const enrichProjectPreview = async (p: DashboardProject): Promise<DashboardProject> => {
    let vid: string | null = null;
    let img: string | null = null;

    try {
        // 1. Try to get media from Rendered Shots
        const episodesRef = collection(db, "projects", p.id, "episodes");
        const episodesSnap = await getDocs(query(episodesRef, limit(5)));

        episodeLoop: for (const epDoc of episodesSnap.docs) {
            const scenesRef = collection(epDoc.ref, "scenes");
            const scenesSnap = await getDocs(query(scenesRef, limit(5))); // Reduced limit for speed

            for (const sceneDoc of scenesSnap.docs) {
                const shotsRef = collection(sceneDoc.ref, "shots");
                const shotsSnap = await getDocs(query(
                    shotsRef,
                    where("status", "==", "rendered"),
                    limit(3) // Reduced limit
                ));

                for (const shotDoc of shotsSnap.docs) {
                    const data = shotDoc.data();
                    if (!vid && data.video_url) vid = data.video_url;
                    if (!img && data.image_url) img = data.image_url;
                    if (vid && img) break episodeLoop;
                }
                if (vid && img) break;
            }
        }

        // 2. Fallback: Assets
        if (!img) {
            const charsRef = collection(db, "projects", p.id, "characters");
            const charsSnap = await getDocs(query(charsRef, limit(3)));
            for (const charDoc of charsSnap.docs) {
                const charData = charDoc.data();
                if (charData.image_url) { img = charData.image_url; break; }
            }
        }

        if (!img) {
            const locsRef = collection(db, "projects", p.id, "locations");
            const locsSnap = await getDocs(query(locsRef, limit(3)));
            for (const locDoc of locsSnap.docs) {
                const locData = locDoc.data();
                if (locData.image_url) { img = locData.image_url; break; }
            }
        }

    } catch (e) {
        console.warn(`Preview fetch failed for ${p.id}`, e);
    }

    return { ...p, previewVideo: vid, previewImage: img };
};

// [DEPRECATED] - Kept for backward compatibility if needed, but redirects to new logic
export const fetchUserDashboardProjects = async (uid: string): Promise<DashboardProject[]> => {
    const basics = await fetchUserProjectsBasic(uid);
    // Resolve all sequentially or parallel depending on need, current usage was blocking.
    // For legacy support, we await all.
    return await Promise.all(basics.map(enrichProjectPreview));
};

export const fetchUserCredits = async (userId: string): Promise<number> => {
    try {
        const userRef = doc(db, "users", userId);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
            return snap.data().credits || 0;
        }
        return 0;
    } catch (e) {
        console.error("Credits Load Error", e);
        return 0;
    }
};

export const fetchGlobalFeed = async () => {
    try {
        const res = await fetch('/api/v1/feed/global');
        if (!res.ok) throw new Error(`Feed API returned ${res.status}`);
        return await res.json();
    } catch (e) {
        console.error("Feed Load Error:", e);
        return [];
    }
};

// --- 9. TREATMENT NOTES ---

export const generateTreatment = async (projectId: string, episodeId: string) => {
    const res = await api.post("/api/v1/shot/generate_treatment", {
        project_id: projectId,
        episode_id: episodeId,
    });
    return res.data;
};

export const updateTreatment = async (projectId: string, episodeId: string, sections: Record<string, string>) => {
    const res = await api.put("/api/v1/shot/update_treatment", {
        project_id: projectId,
        episode_id: episodeId,
        sections,
    });
    return res.data;
};

export const exportTreatmentPdf = async (projectId: string, episodeId: string) => {
    const res = await api.post("/api/v1/shot/export_treatment_pdf", {
        project_id: projectId,
        episode_id: episodeId,
    }, { responseType: 'blob' });
    return res.data;
};

// --- 10. 4K UPSCALE ---

export const upscaleShot = async (
    projectId: string,
    episodeId: string,
    sceneId: string,
    shotId: string,
    modelTier: 'flash' | 'pro' = 'pro'
) => {
    const res = await api.post("/api/v1/shot/upscale_shot", {
        project_id: projectId,
        episode_id: episodeId,
        scene_id: sceneId,
        shot_id: shotId,
        model_tier: modelTier,
    });
    return res.data;
};

// --- 11. ANIMATION ---

export const animateShot = async (params: {
    project_id: string;
    episode_id: string;
    scene_id: string;
    shot_id: string;
    image_url: string;
    prompt?: string;
    provider?: string;
    duration?: string;
    mode?: string;
    aspect_ratio?: string;
}) => {
    const res = await api.post("/api/v1/shot/animate_shot", params);
    return res.data;
};

export const preflightSeedance2 = async (params: Record<string, any>): Promise<{
    estimated_cost: number;
    warnings: string[];
}> => {
    const res = await api.post("/api/v1/shot/preflight_seedance2", params);
    return res.data;
};

export const uploadStyleRef = async (projectId: string, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await api.post(`/api/v1/adaptation/project/${projectId}/upload_style_ref`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
};

// --- 12. SCENE MOOD ---

export const getSceneMood = async (projectId: string, episodeId: string, sceneId: string) => {
    const res = await api.get(`/api/v1/shot/project/${projectId}/episode/${episodeId}/scene/${sceneId}/mood`);
    return res.data;
};

export const updateSceneMood = async (
    projectId: string,
    episodeId: string,
    sceneId: string,
    mood: { color_palette?: string; lighting?: string; texture?: string; atmosphere?: string }
) => {
    const res = await api.put(`/api/v1/shot/project/${projectId}/episode/${episodeId}/scene/${sceneId}/mood`, mood);
    return res.data;
};

// --- 13. TAXONOMY / CINEMATIC ARCHETYPE ---



/**
 * Upload script file to Firebase Storage and save the URL to the project doc.
 * This is the NEW flow — raw file goes to storage first, parsing happens later.
 */
export const uploadScriptToStorage = async (
    projectId: string,
    file: File
): Promise<string> => {
    const storageRef = ref(storage, `projects/${projectId}/scripts/${Date.now()}_${file.name}`);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);

    // Persist the URL to the project document
    const projectRef = doc(db, "projects", projectId);
    await updateDoc(projectRef, {
        script_file_url: downloadURL,
        script_status: "uploaded",
    });

    return downloadURL;
};

/**
 * Generate taxonomy analysis from the uploaded script.
 * Backend reads script_file_url + project metadata to compute metrics.
 */
export const generateTaxonomy = async (
    projectId: string
): Promise<TaxonomyResponse> => {
    const res = await api.post("/api/v1/taxonomy/generate-taxonomy", {
        project_id: projectId,
    });
    return res.data;
};

/**
 * Lock in the selected cinematic archetype for the project.
 */
export const selectTaxonomy = async (
    projectId: string,
    archetypeId: string
) => {
    const res = await api.post("/api/v1/taxonomy/select-taxonomy", {
        project_id: projectId,
        archetype_id: archetypeId,
    });
    return res.data;
};

/**
 * Trigger the deferred script parsing/ingestion worker.
 * Called AFTER taxonomy is locked in.
 */
export const processScript = async (
    projectId: string,
    scriptTitle: string,
    runtimeSeconds: number,
    episodeId?: string
) => {
    const res = await api.post("/api/v1/script/process-script", {
        project_id: projectId,
        script_title: scriptTitle,
        runtime_seconds: runtimeSeconds,
        ...(episodeId && { episode_id: episodeId }),
    });
    return res.data;
};

// --- 14. POST-PRODUCTION ---

export const saveTimeline = async (
    projectId: string,
    episodeId: string,
    tracks: any[],
    transitions: any[],
    duration: number,
    fps: number
) => {
    const res = await api.post("/api/v1/postprod/save_timeline", {
        project_id: projectId,
        episode_id: episodeId,
        tracks,
        transitions,
        duration,
        fps,
    });
    return res.data;
};

export const loadTimeline = async (projectId: string, episodeId: string = "main") => {
    const res = await api.get(`/api/v1/postprod/load_timeline/${projectId}`, {
        params: { episode_id: episodeId },
    });
    return res.data;
};

export const aiEditTimeline = async (
    projectId: string,
    episodeId: string,
    prompt: string,
    scope: "clip" | "scene" | "global" = "global",
    targetIds: string[] = []
) => {
    const res = await api.post("/api/v1/postprod/ai_edit", {
        project_id: projectId,
        episode_id: episodeId,
        prompt,
        scope,
        target_ids: targetIds,
    });
    return res.data;
};

export const exportTimeline = async (
    projectId: string,
    episodeId: string,
    config: {
        aspect_ratio: string;
        resolution: string;
        format: string;
        watermark: boolean;
        platform: string;
        fps: number;
    }
) => {
    const res = await api.post("/api/v1/postprod/export", {
        project_id: projectId,
        episode_id: episodeId,
        ...config,
    });
    return res.data;
};


// ═══════════════════════════════════════════════════════════
//   AI VIDEO-TO-VIDEO FEATURES
// ═══════════════════════════════════════════════════════════

/**
 * Upload a reference motion video to Firebase Storage.
 * Returns the download URL for use in motion transfer API calls.
 */
export const uploadMotionRefVideo = async (
    projectId: string,
    file: File
): Promise<string> => {
    const storageRef = ref(
        storage,
        `projects/${projectId}/postprod/motion_refs/${Date.now()}_${file.name}`
    );
    const snapshot = await uploadBytes(storageRef, file);
    return await getDownloadURL(snapshot.ref);
};

export const motionTransfer = async (
    projectId: string,
    episodeId: string,
    sceneId: string,
    shotId: string,
    imageUrl: string,
    videoUrl: string,
    prompt: string = "",
    provider: "kling" | "seedance-2" = "kling",
    motionDirection: "video" | "image" = "video",
    version: string = "2.6"
) => {
    const res = await api.post("/api/v1/postprod/motion_transfer", {
        project_id: projectId,
        episode_id: episodeId,
        scene_id: sceneId,
        shot_id: shotId,
        image_url: imageUrl,
        video_url: videoUrl,
        prompt,
        provider,
        motion_direction: motionDirection,
        version,
    });
    return res.data;
};

export const videoEdit = async (
    projectId: string,
    episodeId: string,
    sceneId: string,
    shotId: string,
    videoUrl: string,
    prompt: string,
    provider: "kling" | "seedance-2" = "kling",
    imageUrl?: string,
    duration: string = "5",
    aspectRatio: string = "16:9",
    referenceImageUrls: string[] = [],
    trimStart?: number,
    trimEnd?: number,
) => {
    const res = await api.post("/api/v1/postprod/video_edit", {
        project_id: projectId,
        episode_id: episodeId,
        scene_id: sceneId,
        shot_id: shotId,
        video_url: videoUrl,
        image_url: imageUrl || undefined,
        prompt,
        provider,
        duration,
        aspect_ratio: aspectRatio,
        reference_image_urls: referenceImageUrls,
        trim_start: trimStart,
        trim_end: trimEnd,
    });
    return res.data;
};

export const generativeEdit = async (
    projectId: string,
    episodeId: string,
    sceneId: string,
    shotId: string,
    videoUrl: string,
    frameImageUrl: string,
    selectionBounds: { x: number; y: number; width: number; height: number },
    editPrompt: string,
    editAction: "remove" | "replace" | "restyle" | "custom" = "replace",
    referenceImageUrl?: string,
    aspectRatio: string = "16:9",
    trimStart?: number,
    trimEnd?: number,
) => {
    const res = await api.post("/api/v1/postprod/generative_edit", {
        project_id: projectId,
        episode_id: episodeId,
        scene_id: sceneId,
        shot_id: shotId,
        video_url: videoUrl,
        frame_image_url: frameImageUrl,
        selection_bounds: selectionBounds,
        edit_prompt: editPrompt,
        edit_action: editAction,
        reference_image_url: referenceImageUrl || undefined,
        aspect_ratio: aspectRatio,
        trim_start: trimStart,
        trim_end: trimEnd,
    });
    return res.data;
};

export const revertVideo = async (
    projectId: string,
    episodeId: string,
    sceneId: string,
    shotId: string,
    videoUrl: string,
) => {
    const res = await api.post("/api/v1/postprod/revert_video", {
        project_id: projectId,
        episode_id: episodeId,
        scene_id: sceneId,
        shot_id: shotId,
        video_url: videoUrl,
    });
    return res.data;
};

// ═══════════════ SFX & BGM Generation ═══════════════

export const generateSfx = async (
    projectId: string,
    prompt: string,
    durationSeconds?: number,
    promptInfluence: number = 0.3,
) => {
    const res = await api.post("/api/v1/postprod/generate_sfx", {
        project_id: projectId,
        prompt,
        duration_seconds: durationSeconds,
        prompt_influence: promptInfluence,
    });
    return res.data;
};

export const generateBgm = async (
    projectId: string,
    prompt: string,
    durationSeconds: number = 30,
    forceInstrumental: boolean = true,
) => {
    const res = await api.post("/api/v1/postprod/generate_bgm", {
        project_id: projectId,
        prompt,
        duration_seconds: durationSeconds,
        force_instrumental: forceInstrumental,
    });
    return res.data;
};