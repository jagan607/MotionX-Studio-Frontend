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

// --- 2. MOODBOARD & PROJECT ---
export interface Moodboard {
    [key: string]: any; // Allows dynamic keys (color, lighting, texture, etc.)
}

export interface Project {
    id: string;
    name: string;
    moodboard?: Moodboard; // <--- The Source of Truth
    // Add other project fields as needed (owner_id, created_at, etc.)
}

// --- 3. ASSET PROFILES ---
export interface CharacterProfile {
    id: string;
    name: string;
    type: "character";
    project_id: string;

    // Visuals
    image_url?: string;
    visual_traits: CharacterVisualTraits;

    // Voice
    voice_suggestion?: string;
    voice_config?: {
        voice_id?: string;
        voice_name?: string;
        provider?: string;
        stability?: number;
        similarity_boost?: number;
        suggestion?: string;
    };

    status: "pending" | "generating" | "active";
    prompt?: string;
    base_prompt?: string; // Legacy/Fallback
}

export interface LocationProfile {
    id: string;
    name: string;
    type: "location";
    project_id: string;

    // Visuals
    image_url?: string;
    visual_traits: LocationVisualTraits;

    status: "pending" | "generating" | "active";
    prompt?: string;
    base_prompt?: string; // Legacy/Fallback
}

// --- 4. THE UNIFIED ASSET TYPE ---
export type Asset = CharacterProfile | LocationProfile;


// --- 5. SCENE / SHOT INTERFACES ---
export interface Scene {
    id: string;
    scene_number: number;
    header: string;
    summary: string;
    location_id: string; // Links to LocationProfile
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