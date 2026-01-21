// lib/promptUtils.ts


// --- LOCATION PROMPT BUILDER ---
export const constructLocationPrompt = (
    locationName: string,
    visualTraits: string[] | any, // Can be array or object depending on legacy data
    allTraits: any, // The full flat object containing atmosphere, lighting, terrain
    genre: string,
    style: string
): string => {
    // 1. Base Identity
    let prompt = `Cinematic wide shot of ${locationName.toUpperCase()}.`;

    // 2. Atmosphere & Lighting (The "Vibe")
    if (allTraits.atmosphere) prompt += ` Atmosphere: ${allTraits.atmosphere}.`;
    if (allTraits.lighting) prompt += ` Lighting: ${allTraits.lighting}.`;

    // 3. Specific Visual Details (The "Ingredients")
    // Handle if visualTraits is an array (new schema) or object (legacy fallback)
    if (Array.isArray(visualTraits) && visualTraits.length > 0) {
        prompt += ` Visual details: ${visualTraits.join(', ')}.`;
    } else if (visualTraits && typeof visualTraits === 'object' && !Array.isArray(visualTraits)) {
        // Fallback for any legacy object structure
        const details = [];
        if (visualTraits.environment) details.push(visualTraits.environment);
        if (visualTraits.architectural_style) details.push(visualTraits.architectural_style);
        if (details.length > 0) prompt += ` Visual details: ${details.join(', ')}.`;
    }

    // 4. Terrain/Setting
    if (allTraits.terrain) prompt += ` Setting: ${allTraits.terrain}.`;

    // 5. Genre & Style
    if (genre) prompt += ` Genre: ${genre}.`;
    if (style) prompt += ` Style: ${style}.`;

    // 6. Hardcoded Stylistic Suffix (Ensures high quality)
    prompt += "Detailed facial features, dramatic lighting, 8k";

    return prompt;
};


// --- CHARACTER PROMPT BUILDER ---
export const constructCharacterPrompt = (
    charName: string,
    traits: any, // The specific visual_traits object (age, hair, etc.)
    allTraits: any, // The full object (in case we need top-level fields like physical_description)
    genre: string,
    style: string
): string => {
    // 1. Base Identity & Demographics
    let prompt = `Cinematic portrait of ${charName.toUpperCase()}`;

    const demographics = [];
    if (traits.age) demographics.push(traits.age);
    if (traits.ethnicity) demographics.push(traits.ethnicity);

    if (demographics.length > 0) {
        prompt += `, ${demographics.join(', ')}.`;
    } else {
        prompt += `.`;
    }

    // 2. Physical Appearance
    if (traits.clothing) prompt += ` Wearing ${traits.clothing}.`;
    if (traits.hair) prompt += ` Hair: ${traits.hair}.`;

    // 3. Character Vibe/Aura
    if (traits.vibe) prompt += ` Vibe: ${traits.vibe}.`;

    // 4. Fallback for "Physical Description" (if used in ingestion)
    if (allTraits.physical_description) {
        prompt += ` Description: ${allTraits.physical_description}.`;
    }

    // retrieve genre and style from the series DB using getStorage in firebase.ts and append to the prompt
    // storage is a function in firebase.ts that returns the series data
    if (genre) prompt += ` Genre: ${genre}.`;
    if (style) prompt += ` Style: ${style}.`;

    // 5. Hardcoded Stylistic Suffix
    prompt += " Detailed facial features, dramatic lighting, 8k";

    return prompt;
};