import axios from "axios";
import { auth, db } from "@/lib/firebase";
import { API_BASE_URL } from "./config";
import { Project } from "./types";
import { collection, collectionGroup, doc, getDoc, getDocs, limit, orderBy, query, where } from "firebase/firestore";

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
    const res = await api.post(`/api/v1/assets/${projectId}/generate`, {
        asset_id: assetId,
        type,
        prompt,
        style,
        aspect_ratio,
        use_ref: useRef
    });
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

export const fetchUserDashboardProjects = async (uid: string): Promise<DashboardProject[]> => {
    try {
        const q = query(
            collection(db, "projects"),
            where("owner_id", "==", uid),
            orderBy("updated_at", "desc")
        );

        const snap = await getDocs(q).catch((e) => {
            console.error("⚠️ SORT FAILED. Missing Index? Click the link in the error above.", e);
            return getDocs(query(collection(db, "projects"), where("owner_id", "==", uid)));
        });

        const projectData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as DashboardProject));

        const enriched = await Promise.all(projectData.map(async (p) => {
            let vid: string | null = null;
            let img: string | null = null;

            try {
                // 1. Try to get media from Rendered Shots
                // Get all episodes for this project
                const episodesRef = collection(db, "projects", p.id, "episodes");
                const episodesSnap = await getDocs(query(episodesRef, limit(5)));

                // Search through episodes -> scenes -> shots
                episodeLoop: for (const epDoc of episodesSnap.docs) {
                    const scenesRef = collection(epDoc.ref, "scenes");
                    const scenesSnap = await getDocs(query(scenesRef, limit(10)));

                    for (const sceneDoc of scenesSnap.docs) {
                        const shotsRef = collection(sceneDoc.ref, "shots");
                        const shotsSnap = await getDocs(query(
                            shotsRef,
                            where("status", "==", "rendered"),
                            limit(5)
                        ));

                        for (const shotDoc of shotsSnap.docs) {
                            const data = shotDoc.data();
                            if (!vid && data.video_url) vid = data.video_url;
                            if (!img && data.image_url) img = data.image_url;
                            if (vid && img) break episodeLoop; // Found both, stop
                        }

                        if (vid && img) break; // Found both, stop scene loop
                    }
                }

                // 2. Fallback: If no image found in shots, check Assets (characters)
                if (!img) {
                    const charsRef = collection(db, "projects", p.id, "characters");
                    const charsSnap = await getDocs(query(charsRef, limit(3)));
                    for (const charDoc of charsSnap.docs) {
                        const charData = charDoc.data();
                        if (charData.image_url) {
                            img = charData.image_url;
                            break;
                        }
                    }
                }

                // 3. Fallback: Check locations
                if (!img) {
                    const locsRef = collection(db, "projects", p.id, "locations");
                    const locsSnap = await getDocs(query(locsRef, limit(3)));
                    for (const locDoc of locsSnap.docs) {
                        const locData = locDoc.data();
                        if (locData.image_url) {
                            img = locData.image_url;
                            break;
                        }
                    }
                }

            } catch (e) {
                console.warn(`Preview fetch failed for ${p.id}`, e);
            }
            return { ...p, previewVideo: vid, previewImage: img };
        }));

        return enriched;
    } catch (e) {
        console.error("Dashboard Load Error", e);
        return [];
    }
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
        const q = query(
            collectionGroup(db, 'shots'),
            where("status", "==", "rendered"),
            orderBy("created_at", "desc"),
            limit(50)
        );

        const snap = await getDocs(q);

        let valid = snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter((s: any) => s.image_url || s.video_url);

        return valid.sort(() => 0.5 - Math.random());
    } catch (e) {
        console.error("Feed Load Error", e);
        return [];
    }
};