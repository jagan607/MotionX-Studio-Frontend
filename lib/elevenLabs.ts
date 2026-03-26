// lib/elevenLabs.ts

import { api } from "@/lib/api";

export interface Voice {
    voice_id: string;
    name: string;
    preview_url: string;
    labels: {
        accent?: string;
        description?: string;
        age?: string;
        gender?: string;
        use_case?: string;
    };
    category?: string;
}

export const fetchElevenLabsVoices = async (): Promise<Voice[]> => {
    try {
        const res = await api.get("/api/v1/voice/list");
        return res.data;
    } catch (error) {
        console.error("Voice Fetch Error:", error);
        return [];
    }
};