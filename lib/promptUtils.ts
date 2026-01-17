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
    traits: any
): string => {
    // 1. Start with the Subject
    let prompt = `Cinematic portrait of ${charName.toUpperCase()}`;

    if (traits) {
        const details: string[] = [];

        // Support for the structure returned for characters like 'Maya'
        if (traits.age) details.push(`${traits.age}`);
        if (traits.ethnicity) details.push(`${traits.ethnicity}`);
        if (traits.hair) details.push(`hair: ${traits.hair}`);
        if (traits.clothing) details.push(`clothing: ${traits.clothing}`);
        if (traits.vibe) details.push(`vibe: ${traits.vibe}`);

        // Physicality (Fallbacks for different AI outputs)
        if (traits.facial_features) details.push(traits.facial_features);
        if (traits.body_type) details.push(`${traits.body_type} build`);

        if (details.length > 0) {
            prompt += `, ${details.join(', ')}`;
        }
    }

    // 2. Technical Boilerplate
    const techSpecs = "8k resolution, photorealistic, detailed skin texture, dramatic lighting, sharp focus, masterpiece.";

    return `${prompt}. ${techSpecs}`;
};