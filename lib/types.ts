// lib/types.ts

// --- 1. SHARED TRAITS (Matches Backend) ---
export interface CharacterVisualTraits {
    age: string;
    ethnicity: string;
    hair: string;
    clothing: string;
    vibe: string;
}

export interface LocationVisualTraits {
    terrain: string;      // e.g. "indoor", "outdoor"
    atmosphere: string;   // e.g. "tense", "cozy"
    lighting: string;     // e.g. "dim flickering light"
    keywords: string;     // Comma-separated string (e.g. "messy, neon, cramped")
}

// [NEW] Product Traits for Ads
export interface ProductVisualTraits {
    category: string;     // e.g. "Electronics", "Beverage"
    material: string;     // e.g. "Metallic", "Glass", "Matte"
    lighting_style: string; // e.g. "Studio High Key", "Natural"
    brand_colors: string; // e.g. "#FF0000, #FFFFFF"
}

// --- 2. MOODBOARD ---
export interface Moodboard {
    [key: string]: any; // Allows dynamic keys (color, lighting, texture, etc.)
}

// --- 3. ASSET PROFILES ---
export interface CharacterProfile {
    id: string;
    name: string;
    type: "character";
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
}

export interface LocationProfile {
    id: string;
    name: string;
    type: "location";
    project_id: string;

    image_url?: string;
    ref_image_url?: string;

    visual_traits: LocationVisualTraits;
    status?: "pending" | "processing" | "generating" | "active" | "failed";
    prompt?: string;
    base_prompt?: string;
    created_at?: any;
}

// [NEW] Product Profile for Commercials
export interface ProductProfile {
    id: string;
    name: string;
    type: "product";
    project_id: string;

    description: string;
    brand_guidelines?: string;

    image_url?: string;       // Generated "Hero Shot"
    ref_image_urls?: string[]; // Array of uploaded reference images (Front, Side, etc.)

    visual_traits?: ProductVisualTraits;

    status?: "pending" | "processing" | "generating" | "active" | "failed";
    created_at?: any;
}

// --- 4. THE UNIFIED ASSET TYPE ---
// Updated to include ProductProfile
export type Asset = CharacterProfile | LocationProfile | ProductProfile;

// --- 5. PROJECT INTERFACE ---
export interface Project {
    id: string;
    title: string;
    // [CHANGED] Added 'ad' to supported types
    type: 'movie' | 'micro_drama' | 'ad';

    default_episode_id?: string; // Critical for Movie/Ad navigation
    aspect_ratio?: string;
    genre?: string;
    moodboard?: Moodboard;
    created_at?: any;
    updated_at?: any;
    user_id?: string;

    // Optional stats
    episode_count?: number;
    product_count?: number;
    script_status?: string;
}

// --- 6. SCENE & SHOT INTERFACES ---
export interface Scene {
    id: string;
    scene_number: number;
    header: string;
    summary: string;

    location_id: string;
    characters: string[];
    products?: string[]; // [NEW] Link products to scenes

    time: string;
    visual_prompt: string;
    dialogue?: Record<string, string>;
    status: "draft" | "approved";
}

export interface Shot {
    id: string;
    shot_type: string;

    // Prompts
    visual_action: string;
    video_prompt?: string;

    // Context
    location_id?: string;
    characters: string[];
    products?: string[]; // [NEW] Link products to shots

    // Media & Status
    image_url?: string;
    video_url?: string;
    video_status?: 'queued' | 'processing' | 'completed' | 'failed' | null;
    status?: 'draft' | 'rendered' | 'animating' | 'completed';

    created_at?: string;
}