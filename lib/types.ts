export interface CharacterProfile {
    id: string;
    name: string;
    face_sample_url?: string;
    image_url?: string;
    voice_config?: {
        voice_id?: string;
        voice_name?: string;
    };
    status?: string;
    visual_traits?: any;
}

export interface LocationProfile {
    id: string;
    name: string;
    image_url?: string;
    visual_traits?: {
        environment?: string;
        time_of_day?: string;
        architectural_style?: string;
        lighting?: string;
        weather?: string;
        vibe?: string;
        color_palette?: string;
    };
    base_prompt?: string;
    status?: 'active' | 'draft';
}