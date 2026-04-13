/**
 * Playground API — Dedicated API layer for the B2C Playground workspace.
 *
 * All calls route to /api/v1/playground/* and reuse the shared `api` axios
 * instance (auth + org headers are injected automatically).
 *
 * This module is completely isolated from the Studio API functions in lib/api.ts.
 */

import { api } from "@/lib/api";

// ═══════════════════════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════════════════════

export interface PlaygroundAsset {
    id: string;
    name: string;
    type: "character" | "location" | "product";
    description?: string;
    visual_traits?: Record<string, string>;
    image_url?: string;
    atmosphere?: string;
    lighting?: string;
    product_metadata?: Record<string, any>;
    status?: string;
    created_at?: any;
    updated_at?: any;
}

export interface PlaygroundAssetCreateParams {
    asset_type: "characters" | "locations" | "products";
    asset_id?: string;
    name: string;
    description?: string;
    visual_traits?: Record<string, string>;
    image_url?: string;
    product_metadata?: Record<string, any>;
    atmosphere?: string;
    lighting?: string;
}

export interface PlaygroundGeneration {
    id: string;
    status: "generating" | "completed" | "failed" | "error";
    prompt?: string;
    shot_type?: string;
    aspect_ratio?: string;
    style?: string;
    characters?: string[];
    location?: string;
    products?: string[];
    provider?: string;
    model_tier?: string;
    image_url?: string;
    video_url?: string;
    video_status?: "animating" | "completed" | "failed" | null;
    error_code?: string;
    error_message?: string;
    created_at?: any;
}

export interface PlaygroundGenerateParams {
    prompt: string;
    characters?: string;         // comma-separated asset IDs
    location?: string;           // single asset ID
    products?: string;           // comma-separated asset IDs
    aspect_ratio?: string;
    style?: string;
    shot_type?: string;
    image_provider?: string;
    model_tier?: string;
    style_palette?: string;
    style_lighting?: string;
    style_mood?: string;
    reference_image?: File | null;
    ref_image_urls?: string[];        // pre-existing GCS URLs (drag-and-drop)
}

export interface PlaygroundAnimateParams {
    generation_id: string;
    image_url?: string;
    prompt: string;
    provider: string;
    end_frame_url?: string;
    duration?: string;
    mode?: string;
    aspect_ratio?: string;
    negative_prompt?: string;
    cfg_scale?: number;
    sound?: string;
    multi_shot?: boolean;
    shot_type?: string;
    multi_prompt?: any[];
    element_list?: Record<string, any>[];
    voice_list?: Record<string, any>[];
    watermark?: boolean;
    reference_image_urls?: string[];
    reference_video_urls?: string[];
    reference_video_durations?: number[];
    reference_audio_urls?: string[];
    parent_task_id?: string;
    quality?: string;
    video_url?: string;
    source_video_duration?: number;
    trim_start?: number;
    trim_end?: number;
}


// ═══════════════════════════════════════════════════════════════
//  IMAGE GENERATION
// ═══════════════════════════════════════════════════════════════

/**
 * Generate an image in the Playground workspace.
 * Uses FormData to support optional reference_image upload.
 */
export const playgroundGenerate = async (params: PlaygroundGenerateParams) => {
    const formData = new FormData();

    formData.append("prompt", params.prompt);
    if (params.characters) formData.append("characters", params.characters);
    if (params.location) formData.append("location", params.location);
    if (params.products) formData.append("products", params.products);
    if (params.aspect_ratio) formData.append("aspect_ratio", params.aspect_ratio);
    if (params.style) formData.append("style", params.style);
    if (params.shot_type) formData.append("shot_type", params.shot_type);
    if (params.image_provider) formData.append("image_provider", params.image_provider);
    if (params.model_tier) formData.append("model_tier", params.model_tier);
    if (params.style_palette) formData.append("style_palette", params.style_palette);
    if (params.style_lighting) formData.append("style_lighting", params.style_lighting);
    if (params.style_mood) formData.append("style_mood", params.style_mood);
    if (params.reference_image) formData.append("reference_image", params.reference_image);
    if (params.ref_image_urls?.length) formData.append("ref_image_urls", params.ref_image_urls.join(","));

    const res = await api.post("/api/v1/playground/generate", formData);
    return res.data;
};


// ═══════════════════════════════════════════════════════════════
//  VIDEO ANIMATION
// ═══════════════════════════════════════════════════════════════

/**
 * Animate a Playground generation (image → video).
 * JSON payload — no file upload needed.
 */
export const playgroundAnimate = async (params: PlaygroundAnimateParams) => {
    const res = await api.post("/api/v1/playground/animate", params);
    return res.data;
};


// ═══════════════════════════════════════════════════════════════
//  ASSET CRUD
// ═══════════════════════════════════════════════════════════════

/**
 * Create or update an asset in the user's Playground.
 */
export const createPlaygroundAsset = async (
    data: PlaygroundAssetCreateParams
): Promise<{ status: string; asset_id: string }> => {
    const res = await api.post("/api/v1/playground/assets", data);
    return res.data;
};

/**
 * List all assets of a given type in the user's Playground.
 */
export const listPlaygroundAssets = async (
    assetType: "characters" | "locations" | "products"
): Promise<{ status: string; assets: PlaygroundAsset[] }> => {
    const res = await api.get(`/api/v1/playground/assets/${assetType}`);
    return res.data;
};

/**
 * Upload a reference/main image for a Playground asset via backend proxy.
 * The backend handles GCS upload and updates Firestore with the resulting URL.
 */
export const uploadPlaygroundAssetImage = async (
    assetType: "characters" | "locations" | "products",
    assetId: string,
    file: File
): Promise<{ status: string; image_url: string }> => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await api.post(
        `/api/v1/playground/assets/${assetType}/${assetId}/upload-image`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
    );
    return res.data;
};

/**
 * Update an existing Playground asset.
 */
export const updatePlaygroundAsset = async (
    assetType: "characters" | "locations" | "products",
    assetId: string,
    data: Partial<Omit<PlaygroundAssetCreateParams, "asset_type">>
): Promise<{ status: string }> => {
    const res = await api.put(
        `/api/v1/playground/assets/${assetType}/${assetId}`,
        data
    );
    return res.data;
};

/**
 * Delete a Playground asset.
 */
export const deletePlaygroundAsset = async (
    assetType: "characters" | "locations" | "products",
    assetId: string
): Promise<{ status: string }> => {
    const res = await api.delete(
        `/api/v1/playground/assets/${assetType}/${assetId}`
    );
    return res.data;
};

/**
 * Generate an AI visual for a Playground asset based on its traits.
 * The backend builds a type-appropriate prompt and uses Gemini to render the image.
 */
export const generatePlaygroundAssetVisual = async (
    assetType: "characters" | "locations" | "products",
    assetId: string,
    params?: { prompt?: string; style?: string; aspect_ratio?: string }
): Promise<{ status: string; image_url: string }> => {
    const res = await api.post(
        `/api/v1/playground/assets/${assetType}/${assetId}/generate`,
        params || {}
    );
    return res.data;
};

// ═══════════════════════════════════════════════════════════════
//  GENERATIONS FEED
// ═══════════════════════════════════════════════════════════════

/**
 * List recent Playground generations for the current user.
 * Note: For real-time updates, use the Firestore onSnapshot listener
 * in PlaygroundContext instead. This endpoint is for initial hydration
 * or non-reactive contexts.
 */
export const listPlaygroundGenerations = async (
    limit: number = 50
): Promise<{ status: string; generations: PlaygroundGeneration[] }> => {
    const res = await api.get(`/api/v1/playground/generations`, {
        params: { limit },
    });
    return res.data;
};

// ═══════════════════════════════════════════════════════════════
//  PROMPT ENHANCEMENT (Magic Enhance)
// ═══════════════════════════════════════════════════════════════

/**
 * Call the Studio's enhance_prompt endpoint to expand a simple
 * user prompt into a cinematic, descriptive prompt.
 * Reuses POST /api/v1/shot/enhance_prompt — no credit charge.
 */
export const playgroundEnhancePrompt = async (params: {
    prompt: string;
    provider?: string;
    aspect_ratio?: string;
    shot_type?: string;
}): Promise<string> => {
    const res = await api.post('/api/v1/shot/enhance_prompt', params);
    return res.data?.enhanced_prompt || params.prompt;
};
