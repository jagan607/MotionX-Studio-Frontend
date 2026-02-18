import toast from "react-hot-toast";

/**
 * Extracts a clean, human-readable message from any error shape.
 * Prevents raw JSON / API error objects from appearing in toasts.
 */
const sanitizeError = (input: unknown): string => {
    if (typeof input === "string") {
        // Truncate raw JSON-like strings (e.g. "503 UNAVAILABLE. {'error': ...}")
        const jsonStart = input.indexOf("{");
        if (jsonStart > 0) {
            return input.slice(0, jsonStart).trim().replace(/\.$/, "");
        }
        return input;
    }
    if (input && typeof input === "object") {
        const obj = input as Record<string, any>;
        // Axios / fetch response shapes
        if (obj.response?.data?.detail) return String(obj.response.data.detail);
        if (obj.response?.data?.message) return String(obj.response.data.message);
        // Google / Vertex AI error shape
        if (obj.error?.message) return String(obj.error.message);
        // Generic shapes
        if (obj.message) return String(obj.message);
        if (obj.detail) {
            if (Array.isArray(obj.detail)) return obj.detail[0]?.msg || "Request failed";
            return String(obj.detail);
        }
        if (obj.msg) return String(obj.msg);
    }
    return "Something went wrong";
};

// --- Core helpers ---
export const toastSuccess = (msg: string) =>
    toast.success(msg);

export const toastError = (msg: unknown) =>
    toast.error(sanitizeError(msg));

export const toastInfo = (msg: string) =>
    toast(msg);
