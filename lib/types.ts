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

// --- 2. MOODBOARD ---
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

// --- 4. THE UNIFIED ASSET TYPE ---
export type Asset = CharacterProfile | LocationProfile | ProductProfile;

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
    status: "draft" | "approved";
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

    video_status?: 'queued' | 'processing' | 'completed' | 'failed' | null;
    status?: 'draft' | 'rendered' | 'animating' | 'completed' | 'finalized';

    morph_to_next?: boolean; // Added for UI logic

    // 4K Upscale
    is_upscaled?: boolean;
    upscale_status?: 'processing' | 'completed' | 'error' | null;
    upscale_error?: string;
    image_url_original?: string;

    // [NEW] Persisted Video Settings
    video_settings?: {
        duration?: '3' | '5' | '10' | '15';
        mode?: 'std' | 'pro';
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