import { LocationProfile, CharacterProfile } from "@/lib/types";

// --- LOCATION PROMPT BUILDER ---
export const constructLocationPrompt = (
    locationName: string,
    traits: LocationProfile['visual_traits'],
    additionalData?: Partial<LocationProfile> // Pass atmosphere, lighting, terrain
): string => {
    // 1. Start with the Subject
    let prompt = `Cinematic wide shot of ${locationName.toUpperCase()}`;

    const details: string[] = [];

    // 2. Handle the New Array Structure
    if (Array.isArray(traits)) {
        details.push(...traits);
    }
    // 3. Handle the Old Object Structure (Fallback)
    else if (traits && typeof traits === 'object') {
        const t = traits as any;
        if (t.environment) details.push(t.environment);
        if (t.architectural_style) details.push(`${t.architectural_style} architecture`);
        if (t.weather) details.push(`${t.weather} weather`);
        if (t.color_palette) details.push(`${t.color_palette} color palette`);
        if (t.vibe) details.push(`${t.vibe} vibe`);
    }

    // 4. Incorporate New Top-Level Fields
    if (additionalData?.terrain) details.push(`${additionalData.terrain} environment`);
    if (additionalData?.atmosphere) details.push(`${additionalData.atmosphere} atmosphere`);
    if (additionalData?.lighting) details.push(`${additionalData.lighting} lighting`);

    if (details.length > 0) {
        prompt += `. Visual details: ${details.join(', ')}`;
    }

    // 5. Technical Boilerplate
    const techSpecs = "Highly detailed, 8k resolution, photorealistic, depth of field, professional cinematography, unreal engine 5 render.";

    return `${prompt}. ${techSpecs}`;
};


// --- CHARACTER PROMPT BUILDER ---
export const constructCharacterPrompt = (
    charName: string,
    traits: any,
    additionalData?: any // Added to capture top-level physical_description
): string => {
    let prompt = `Cinematic portrait of ${charName.toUpperCase()}`;
    const details: string[] = [];

    // Prioritize the comprehensive physical description if it exists
    if (additionalData?.physical_description) {
        details.push(additionalData.physical_description);
    }

    if (traits) {
        if (traits.age) details.push(`${traits.age}`);
        if (traits.ethnicity) details.push(traits.ethnicity);
        if (traits.hair) details.push(`hair: ${traits.hair}`);
        if (traits.clothing) details.push(`clothing: ${traits.clothing}`);
        // Support for vibe as a top-level field or trait
        const vibe = additionalData?.vibe || traits.vibe;
        if (vibe) details.push(`vibe: ${vibe}`);
    }

    if (details.length > 0) {
        prompt += `, ${details.join(', ')}`;
    }

    const techSpecs = "8k resolution, photorealistic, detailed skin texture, dramatic lighting, sharp focus, masterpiece.";
    return `${prompt}. ${techSpecs}`;
};