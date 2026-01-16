// lib/elevenLabs.ts

import { API_BASE_URL } from "@/lib/config"; // Ensure this points to your Python backend (e.g., http://localhost:8000)

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
        // CALL YOUR PYTHON BACKEND
        const response = await fetch(`${API_BASE_URL}/api/v1/voice/list`, {
            method: 'GET',
            headers: {
                // If your backend requires auth tokens, add them here:
                // 'Authorization': `Bearer ${token}` 
            }
        });

        if (!response.ok) throw new Error('Failed to fetch voices from backend');

        const voices = await response.json();
        return voices;
    } catch (error) {
        console.error("Voice Fetch Error:", error);
        return [];
    }
};