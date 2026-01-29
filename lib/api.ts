import axios from "axios";
import { auth } from "@/lib/firebase"; // Your firebase config
import { API_BASE_URL } from "./config"; // Your backend URL (e.g., http://localhost:8000)
import { Project } from "./types"; // Import the type for better safety

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

// Trigger AI Image Generation
export const triggerAssetGeneration = async (
    projectId: string,
    assetId: string,
    type: string,
    prompt?: string,
    style?: any,
    aspect_ratio?: string
) => {
    const res = await api.post(`/api/v1/assets/${projectId}/generate`, {
        asset_id: assetId,
        type,
        prompt,
        style,
        aspect_ratio
    });
    return res.data;
};