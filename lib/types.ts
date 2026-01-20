export interface CharacterProfile {
    id: string;
    name: string;
    face_sample_url?: string;
    image_url?: string;
    voice_config?: {
        voice_id?: string;
        voice_name?: string;
        provider?: string;
        suggestion?: string; // AI voice suggestion
    };
    status?: string;
    visual_traits?: any;
    base_prompt?: string;
}

export interface LocationProfile {
    id: string;
    name: string;           // Maps to "name" (Full Header)
    raw_name?: string;      // Maps to "raw_name" (Core Name)
    image_url?: string;

    // Core traits extracted by AI
    visual_traits?: string[];
    atmosphere?: string;    // Maps to "atmosphere"
    lighting?: string;      // Maps to "lighting"
    terrain?: 'indoor' | 'outdoor' | string; // Maps to "terrain"

    base_prompt?: string;
    description?: string;   // Composite description used by the backend
    status?: 'active' | 'draft' | 'script_detected' | 'auto_detected' | string;
}

// --- NEW: SHOT INTERFACE ---
export interface Shot {
    id: string;
    shot_type: string;

    // Prompts
    visual_action: string;      // Mapped from 'image_prompt' (Static)
    video_prompt?: string;      // Mapped from 'video_prompt' (Motion) - NEW

    // Context
    location?: string;          // NEW
    characters: string[];       // Array of Character Names

    // Media & Status
    image_url?: string;
    video_url?: string;
    video_status?: 'queued' | 'processing' | 'completed' | 'failed' | null;
    status?: 'draft' | 'rendered' | 'animating' | 'completed';

    created_at?: string;
}