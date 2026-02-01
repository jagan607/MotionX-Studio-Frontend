import axios from "axios";
import { auth, db } from "@/lib/firebase"; // Your firebase config
import { API_BASE_URL } from "./config"; // Your backend URL (e.g., http://localhost:8000)
import { Project } from "./types"; // Import the type for better safety
import { collection, collectionGroup, doc, getDoc, getDocs, limit, orderBy, query, where } from "firebase/firestore";

// 1. Create the Axios Instance
export const api = axios.create({
    baseURL: `${API_BASE_URL}`, // Automatically prefixes all URLs
    headers: {
        "Content-Type": "application/json",
    },
});

// 2. The "Auth Interceptor" (The Magic Part)
api.interceptors.request.use(
    async (config) => {
        const user = auth.currentUser;

        if (user) {
            const token = await user.getIdToken();
            config.headers.Authorization = `Bearer ${token}`;
        }

        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// 3. Response Interceptor (Global Error Handling)
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

// Fetch the project document (to get the Moodboard)
export const fetchProject = async (projectId: string): Promise<Project> => {
    // Assumes you have a router @ /api/v1/project/{id}
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

// Fetch all assets (The Grid)
export const fetchProjectAssets = async (projectId: string) => {
    // Returns { characters: [...], locations: [...] }
    const res = await api.get(`/api/v1/assets/${projectId}/all`);
    return res.data;
};

// Create a new asset (Supports Atomic Payload: Name + Traits + Voice)
export const createAsset = async (projectId: string, data: any) => {
    // 'data' can now include { name, type, visual_traits, voice_config, prompt }
    return await api.post(`/api/v1/assets/${projectId}/create`, data);
};

// Update traits, prompt, or status
export const updateAsset = async (projectId: string, assetType: string, assetId: string, data: any) => {
    // assetType should be "character" or "location"
    return await api.put(`/api/v1/assets/${projectId}/${assetType}/${assetId}`, data);
};

// Delete an asset
export const deleteAsset = async (projectId: string, type: string, assetId: string) => {
    return await api.delete(`/api/v1/assets/${projectId}/${type}/${assetId}`);
};

// Upload Reference Image
export const uploadAssetReference = async (projectId: string, assetType: string, assetId: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return await api.post(`/api/v1/assets/${projectId}/${assetType}/${assetId}/upload-reference`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
    });
};

// NEW: Upload Main Image (Direct override)
export const uploadAssetMain = async (projectId: string, assetType: string, assetId: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return await api.post(`/api/v1/assets/${projectId}/${assetType}/${assetId}/upload-main`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
    });
};

// Trigger Asset AI Image Generation
export const triggerAssetGeneration = async (
    projectId: string,
    assetId: string,
    type: string,
    prompt?: string,
    style?: any,
    aspect_ratio?: string,
    useRef?: boolean // <--- NEW PARAMETER
) => {
    const res = await api.post(`/api/v1/assets/${projectId}/generate`, {
        asset_id: assetId,
        type,
        prompt,
        style,
        aspect_ratio,
        use_ref: useRef // <--- PASS TO BACKEND (snake_case)
    });
    return res.data;
};

// --- 7. STUDIO & SCENES (New) ---

// Fetch Scenes for a specific "Container" (Episode ID or Project ID for movies)
export const fetchScenes = async (projectId: string, containerId?: string) => {
    // If containerId is missing (Movie), the backend should handle the default logic
    const query = containerId ? `?container_id=${containerId}` : '';
    const res = await api.get(`/api/v1/script/${projectId}/scenes${query}`);
    return res.data;
    // Expects: { scenes: [...], stats: {...} }
};

// Fetch Episodes (For Micro-Dramas / Series)
export const fetchEpisodes = async (projectId: string) => {
    const res = await api.get(`/api/v1/project/${projectId}/episodes`);
    return res.data;
    // Expects: [{ id: "ep1", title: "Pilot", number: 1 }, ...]
};

export interface DashboardProject extends Project {
    previewVideo?: string | null;
    previewImage?: string | null;
}

// 1. Fetch User Projects with Smart Previews
export const fetchUserDashboardProjects = async (uid: string): Promise<DashboardProject[]> => {
    try {
        // A. Fetch from "projects" collection (Unified)
        const q = query(
            collection(db, "projects"),
            where("owner_id", "==", uid),
            orderBy("created_at", "desc")
        );

        // Fallback query in case index is missing
        const snap = await getDocs(q).catch(() =>
            getDocs(query(collection(db, "projects"), where("owner_id", "==", uid)))
        );

        const projectData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as DashboardProject));

        // B. Deep Search for Preview Media
        const enriched = await Promise.all(projectData.map(async (p) => {
            let vid = null, img = p.moodboard?.cover_image || null;

            try {
                let scenesRef;

                if (p.type === 'movie') {
                    // Movie: Scenes are direct children
                    scenesRef = collection(db, "projects", p.id, "scenes");
                } else {
                    // Series: Check first episode
                    const eps = await getDocs(query(collection(db, "projects", p.id, "episodes"), limit(1)));
                    if (!eps.empty) {
                        scenesRef = collection(db, "projects", p.id, "episodes", eps.docs[0].id, "scenes");
                    }
                }

                if (scenesRef) {
                    const scs = await getDocs(query(scenesRef, limit(1)));
                    if (!scs.empty) {
                        // Check shots in the first scene
                        const shotsRef = collection(scs.docs[0].ref, "shots");
                        const shs = await getDocs(query(shotsRef, where("status", "==", "rendered"), limit(3)));

                        vid = shs.docs.find(d => d.data().video_url)?.data().video_url || null;
                        if (!img) img = shs.docs.find(d => d.data().image_url)?.data().image_url || null;
                    }
                }
            } catch (e) {
                console.warn(`Preview fetch failed for ${p.id}`, e);
            }

            console.log("Enriched Project", { ...p, previewVideo: vid, previewImage: img });
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

// 2. Fetch Global Feed
export const fetchGlobalFeed = async () => {
    try {
        const snap = await getDocs(query(collectionGroup(db, 'shots'), limit(40)));
        let valid = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter((s: any) => s.image_url || s.video_url);
        // Simple shuffle
        return valid.sort(() => 0.5 - Math.random());
    } catch (e) {
        console.error("Feed Load Error", e);
        return [];
    }
};