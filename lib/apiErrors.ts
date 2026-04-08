/**
 * apiErrors.ts
 *
 * Shared error-extraction utilities for the MotionX frontend.
 * All API error handling should go through these helpers so that
 * raw provider/backend errors are never shown verbatim to users.
 */

import { getErrorUIConfig } from './errorDictionary';

/**
 * Extracts the most meaningful human-readable error message from
 * any API error shape (Axios, fetch, plain Error, or raw string).
 *
 * Priority:
 *   1. response.data.detail  (FastAPI / backend HTTP errors)
 *   2. response.data.message
 *   3. response.data.error
 *   4. e.message             (regular JS Error)
 *   5. fallback string
 */
export const getApiErrorMessage = (
    e: unknown,
    fallback = "Operation failed"
): string => {
    if (!e) return fallback;
    if (typeof e === "string") return e || fallback;

    const obj = e as Record<string, any>;

    // Axios-style response
    const data = obj?.response?.data;
    if (data) {
        if (typeof data.detail === "string") return data.detail;
        if (Array.isArray(data.detail)) return data.detail[0]?.msg || fallback;
        if (typeof data.message === "string") return data.message;
        if (typeof data.error === "string") return data.error;
    }

    // Fetch-style or plain Error
    if (typeof obj.message === "string" && obj.message) return obj.message;

    return fallback;
};

// ---------------------------------------------------------------------------
// Known provider error patterns and their user-friendly translations
// ---------------------------------------------------------------------------

const VIDEO_ERROR_MAP: Array<{ pattern: RegExp; message: string }> = [
    { pattern: /content.?policy|safety|blocked|nsfw/i, message: "Video blocked due to content policy. Please edit the prompt." },
    { pattern: /timeout|timed.?out/i, message: "Video generation timed out. Please try again." },
    { pattern: /quota|rate.?limit|limit.?exceeded/i, message: "Provider quota exceeded. Please try again later." },
    { pattern: /insufficient.?credits?|credit/i, message: "Insufficient credits for video generation." },
    { pattern: /invalid.?image|image.?format/i, message: "Source image format not supported. Please regenerate the shot image first." },
    { pattern: /model.?not.?available|provider.?error/i, message: "Video provider is temporarily unavailable. Try a different provider." },
    { pattern: /audio.?sync|lip.?sync/i, message: "Lip sync failed. Please check that your video has a clear face." },
    { pattern: /no.?face|face.?not.?detected/i, message: "No face detected in the video. Lip sync requires a visible face." },
];

/**
 * Translates raw provider error strings into user-friendly messages.
 * Used for video animation and lip sync Firestore error fields.
 *
 * NEW: When an error_code is provided, it takes priority over regex matching
 * by looking up the structured ERROR_UI_DICTIONARY.
 */
export const inferVideoErrorMessage = (
    raw: string | null | undefined,
    errorCode?: string | null
): string => {
    // New structured path: use error_code dictionary lookup first
    if (errorCode) {
        const config = getErrorUIConfig(errorCode, raw);
        return `${config.title} — ${config.message}`;
    }

    // Legacy fallback: regex pattern matching on raw error strings
    if (!raw) return "Video generation failed. Please try again.";

    for (const { pattern, message } of VIDEO_ERROR_MAP) {
        if (pattern.test(raw)) return message;
    }

    // If the raw message is short (< 120 chars) and not JSON-like, show it directly
    if (raw.length < 120 && !raw.includes("{") && !raw.includes('"')) {
        return raw;
    }

    return "Video generation failed. Please try again.";
};

