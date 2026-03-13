// --- 1. SHARED TRAITS (Matches Backend) ---
export interface CharacterVisualTraits {
    age: string;
    ethnicity: string;
    hair: string;
    clothing: string;
    vibe: string;
}

export interface LocationVisualTraits {
    terrain: string;
    atmosphere: string;
    lighting: string;
    keywords: string;
}

// [NEW] Product Traits for Ads
export interface ProductVisualTraits {
    category: string;
    material: string;
    lighting_style: string;
    brand_colors: string;
}

// --- 2. SCENE MOOD ---
export interface SceneMood {
    color_palette?: string;
    lighting?: string;
    texture?: string;
    atmosphere?: string;
}

// --- 3. MOODBOARD ---
export interface Moodboard {
    [key: string]: any;
}

// --- 3. ASSET PROFILES ---
export interface CharacterProfile {
    id: string;
    name: string;
    type: "character";
    character_type?: "human" | "animal" | "creature" | "robot" | "primary"; // "primary" is legacy, treat as "human"
    project_id: string;

    image_url?: string;
    ref_image_url?: string;

    visual_traits: CharacterVisualTraits;
    voice_sample?: string;
    voice_suggestion?: string;
    voice_config?: {
        voice_id?: string;
        voice_name?: string;
        provider?: string;
        stability?: number;
        similarity_boost?: number;
        suggestion?: string;
    };

    status?: "pending" | "processing" | "generating" | "active" | "failed";
    prompt?: string;
    base_prompt?: string;
    created_at?: any;
    kling_element_id?: string;
}

export interface LocationProfile {
    id: string;
    name: string;
    type: "location";
    project_id: string;

    image_url?: string;
    ref_image_url?: string;
    /** @deprecated Legacy field — new locations generate only `image_url`. Retained for old Firestore docs. */
    image_views?: {
        wide?: string;
        front?: string;
        left?: string;
        right?: string;
    };

    visual_traits: LocationVisualTraits;
    status?: "pending" | "processing" | "generating" | "active" | "failed";
    prompt?: string;
    base_prompt?: string;
    created_at?: any;
    kling_element_id?: string;
    world_id?: string | null;     // Links to a World document if worlds have been detected
}

// [FIXED] Product Profile - Added 'prompt' and 'product_metadata'
export interface ProductProfile {
    id: string;
    name: string;
    type: "product";
    project_id: string;

    description?: string;
    category?: string; // top-level category (weapon, vehicle, tool, etc.) — defaults to "other"
    brand_guidelines?: string;

    image_url?: string;
    ref_image_url?: string;

    // Metadata container
    product_metadata?: {
        brand_metadata?: {
            brand_name?: string;
        };
        category?: string;
        visual_dna?: {
            materials?: string[];
            brand_colors?: string[];
        };
        marketing?: {
            key_features?: string[];
        };
    };

    status?: "pending" | "processing" | "generating" | "active" | "failed";
    created_at?: any;

    prompt?: string;
    kling_element_id?: string; // [NEW] Kling 3.0 Element ID
}

// --- 4. WORLD PROFILE ---
export interface WorldMoodboardStyle {
    color_palette: string;
    lighting: string;
    texture: string;
    atmosphere: string;
}

export interface WorldProfile {
    id: string;
    name: string;
    type: "world";
    project_id: string;

    description: string;
    visual_traits: string[];
    geography: string;
    technology_level: string;
    time_period: string;
    atmosphere: string;

    moodboard_style: WorldMoodboardStyle;
    moodboard_image_url: string | null;
    image_url: string | null;
    ref_image_url?: string | null;

    location_ids: string[];

    status: "active" | "pending";
    created_at?: string;
    created_by?: string;
    prompt?: string;
    kling_element_id?: string;
}

export interface WorldDetectionJobStatus {
    status: "queued" | "processing" | "completed" | "failed";
    progress?: string;
    is_multi_world?: boolean;
    world_count?: number;
    world_ids?: string[];
    error_message?: string;
}

// --- 5. THE UNIFIED ASSET TYPE ---
export type Asset = CharacterProfile | LocationProfile | ProductProfile | WorldProfile;

// --- 5. PROJECT INTERFACE ---
export interface Project {
    id: string;
    title: string;
    type: 'movie' | 'micro_drama' | 'ad' | 'ugc';

    default_episode_id?: string;
    aspect_ratio?: string;
    genre?: string;
    ugc_setup?: 'podcast' | 'talking_head' | 'voiceover_broll' | 'tutorial' | 'vlog';
    moodboard?: Moodboard;
    created_at?: any;
    updated_at?: any;
    user_id?: string;

    episode_count?: number;
    product_count?: number;
    script_status?: string;

    // RBAC collaboration fields
    tenant_id?: string | null;
    team_ids?: string[];
    is_global?: boolean;
}

// --- 6. SCENE & SHOT INTERFACES ---
export interface SceneDialogue {
    speaker: string;
    line: string;
}

export interface Scene {
    id: string;
    scene_number: number;
    header: string;
    summary: string;

    location_id: string;
    characters: string[];
    products?: string[];

    time: string;
    visual_prompt: string;
    dialogue?: Record<string, string>;
    dialogues?: SceneDialogue[];                // NEW – structured dialogues
    estimated_duration_seconds?: number;        // NEW – scene duration estimate
    mood?: SceneMood;                           // NEW – per-scene visual mood
    status: "draft" | "approved";
}

export interface CameraTransform {
    x: number;   // Camera X position (lateral offset)
    y: number;   // Camera Y position (height)
    z: number;   // Camera Z position (depth/distance)
    rx: number;  // Rotation around X axis in degrees (pitch)
    ry: number;  // Rotation around Y axis in degrees (yaw)
    fov: number; // Field of view / focal length equiv
}

export interface VideoHistoryEntry {
    url: string;
    provider: string;       // e.g., 'kling-v3', 'seedance-2'
    prompt: string;
    mode: string;
    duration: number;
    aspect_ratio: string;
    credits_charged: number;
    created_at: any;         // Firestore Timestamp
    task_id: string;
}

export interface Shot {
    id: string;
    shot_type: string;

    visual_action: string;
    video_prompt?: string;

    location_id?: string;
    location?: string; // Added for UI convenience

    characters: string[];
    products?: string[]; // Ensure this exists

    image_url?: string;
    video_url?: string;
    lipsync_url?: string; // Added for UI

    // [NEW] Video generation history (1:N)
    video_history?: VideoHistoryEntry[];

    camera_transform?: CameraTransform;
    camera_shot_type?: string;

    video_status?: 'queued' | 'processing' | 'completed' | 'failed' | 'error' | null;
    status?: 'draft' | 'rendered' | 'animating' | 'completed' | 'finalized';

    morph_to_next?: boolean; // Added for UI logic

    // 4K Upscale
    is_upscaled?: boolean;
    upscale_status?: 'processing' | 'completed' | 'error' | null;
    upscale_error?: string;
    image_url_original?: string;

    // [NEW] Persisted Video Settings
    video_settings?: {
        provider?: string;
        duration?: '3' | '5' | '10' | '15';
        mode?: 'std' | 'pro';
        quality?: 'fast' | 'pro';
        aspect_ratio?: string;
        reference_image_urls?: string[];
        end_frame_url?: string | null;  // Seedance 2.0 start-to-end frame
        negative_prompt?: string;
        cfg_scale?: number;
        sound?: 'on' | 'off';
        watermark?: boolean;
        multi_shot?: boolean;
        shot_type?: 'intelligence' | 'customize';
        element_list?: string[]; // IDs
        voice_list?: string[]; // IDs
    };

    created_at?: string;
}