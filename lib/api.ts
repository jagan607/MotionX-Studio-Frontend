import { API_BASE_URL } from "./config";

export const checkJobStatus = async (jobId: string) => {
    try {
        const response = await fetch(`${API_BASE_URL}/api/v1/script/job_status/${jobId}`);

        if (!response.ok) {
            // If 404, the job might not exist yet, or server error
            return { status: "unknown", error: "Job not found" };
        }

        return await response.json();
    } catch (error) {
        console.error("Polling Error:", error);
        return { status: "failed", error: "Network connection failed" };
    }
};