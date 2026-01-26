import axios from "axios";
import { auth } from "@/lib/firebase"; // Your firebase config
import { API_BASE_URL } from "./config"; // Your backend URL (e.g., http://localhost:8000)

// 1. Create the Axios Instance
export const api = axios.create({
    baseURL: `${API_BASE_URL}`, // Automatically prefixes all URLs
    headers: {
        "Content-Type": "application/json",
    },
});

// 2. The "Auth Interceptor" (The Magic Part)
// Before every request, this code runs automatically.
api.interceptors.request.use(
    async (config) => {
        // Check if a user is logged in
        const user = auth.currentUser;

        if (user) {
            // Get the fresh token (forceRefresh=false)
            const token = await user.getIdToken();
            // Inject it into the headers
            config.headers.Authorization = `Bearer ${token}`;
        }

        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// 3. Response Interceptor (Optional: Global Error Handling)
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            console.error("Unauthorized! Redirecting to login...");
            // You could trigger a redirect here if needed
        }
        return Promise.reject(error);
    }
);

// --- 4. Legacy Helpers (Refactored to use the new instance) ---

export const checkJobStatus = async (jobId: string) => {
    try {
        // Now uses the authenticated instance automatically
        const response = await api.get(`/api/v1/script/job_status/${jobId}`);
        return response.data;
    } catch (error: any) {
        // Handle specific 404s gracefully for polling
        if (error.response && error.response.status === 404) {
            return { status: "unknown", error: "Job not found" };
        }
        console.error("Polling Error:", error);
        return { status: "failed", error: "Network connection failed" };
    }
};