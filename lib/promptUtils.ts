import { LocationProfile, CharacterProfile } from "@/lib/types";

// --- LOCATION PROMPT BUILDER ---
export const constructLocationPrompt = (
    locationName: string,
    traits: LocationProfile['visual_traits']
): string => {
    // 1. Start with the Subject
    let prompt = `Cinematic wide shot of ${locationName}`;

    // 2. Append Visual Traits
    if (traits) {
        const details = [];

        if (traits.environment) details.push(`set in a ${traits.environment}`);
        if (traits.architectural_style) details.push(`${traits.architectural_style} architecture`);
        if (traits.time_of_day) details.push(`during ${traits.time_of_day}`);
        if (traits.weather) details.push(`${traits.weather} weather`);
        if (traits.lighting) details.push(`${traits.lighting} lighting`);
        if (traits.color_palette) details.push(`${traits.color_palette} color palette`);
        if (traits.vibe) details.push(`atmosphere is ${traits.vibe}`);

        if (details.length > 0) {
            prompt += `. Location details: ${details.join(', ')}.`;
        }
    }

    // 3. Technical Boilerplate
    const techSpecs = "Highly detailed, 8k resolution, photorealistic, depth of field, professional cinematography, unreal engine 5 render.";

    return `${prompt} ${techSpecs}`;
};


// --- CHARACTER PROMPT BUILDER ---
export const constructCharacterPrompt = (
    charName: string,
    traits: any // Using 'any' for flexibility, or define strict VisualTraits interface
): string => {
    // 1. Start with the Subject
    let prompt = `Cinematic portrait of ${charName}`;

    // 2. Append Visual Traits
    if (traits) {
        const details = [];

        // Basic Demographics
        if (traits.age) details.push(`${traits.age} years old`);
        if (traits.ethnicity) details.push(`${traits.ethnicity}`);
        if (traits.gender) details.push(`${traits.gender}`); // Optional if implied by name

        // Physicality
        if (traits.hair) details.push(`with ${traits.hair} hair`);
        if (traits.facial_features) details.push(`${traits.facial_features}`);
        if (traits.body_type) details.push(`${traits.body_type} build`);

        // Style & Vibe
        if (traits.clothing) details.push(`wearing ${traits.clothing}`);
        if (traits.accessories) details.push(`wearing ${traits.accessories}`);
        if (traits.vibe) details.push(`exuding a ${traits.vibe} vibe`);

        if (details.length > 0) {
            prompt += `, ${details.join(', ')}.`;
        }
    }

    // 3. Technical Boilerplate
    const techSpecs = "8k resolution, photorealistic, detailed skin texture, dramatic lighting, sharp focus.";

    return `${prompt} ${techSpecs}`;
};