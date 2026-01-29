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

// --- 2. ASSET PROFILES ---
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
        suggestion?: string; // Added for compatibility with your modal
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

// --- 3. THE UNIFIED ASSET TYPE (Add this!) ---
export type Asset = CharacterProfile | LocationProfile;


// --- 4. SCENE / SHOT INTERFACES ---
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