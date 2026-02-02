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
    ref_image_url?: string; // <--- NEW: Reference Image URL

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
    ref_image_url?: string; // <--- NEW: Reference Image URL

    visual_traits: LocationVisualTraits;
    status?: "pending" | "processing" | "generating" | "active" | "failed";
    prompt?: string;
    base_prompt?: string;
    created_at?: any;
}

// --- 4. THE UNIFIED ASSET TYPE ---
export type Asset = CharacterProfile | LocationProfile;

// --- 5. PROJECT INTERFACE ---
export interface Project {
    id: string;
    title: string;
    type: 'movie' | 'micro_drama';
    default_episode_id?: string;
    aspect_ratio?: string;
    genre?: string;
    moodboard?: Moodboard;
    created_at?: any;
    updated_at?: any;
    user_id?: string;
}

// --- 6. SCENE & SHOT INTERFACES ---
export interface Scene {
    id: string;
    scene_number: number;
    header: string;
    summary: string;
    location_id: string; // Links to LocationProfile ID
    characters: string[]; // List of Character Names or IDs
    time: string;
    visual_prompt: string;
    dialogue?: Record<string, string>; // JSON Object: { "MAYA": "Hello" }
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

    // Media & Status
    image_url?: string;
    video_url?: string;
    video_status?: 'queued' | 'processing' | 'completed' | 'failed' | null;
    status?: 'draft' | 'rendered' | 'animating' | 'completed';

    created_at?: string;
}