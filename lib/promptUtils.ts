// --- LOCATION PROMPT BUILDER ---
export const constructLocationPrompt = (
    locationName: string,
    visualTraits: string | string[] | any, // Handle String (UI), Array (DB), or Object (Legacy)
    allTraits: any,
    genre: string,
    style: string
): string => {
    // 1. Analyze Name (Parse INT./EXT.)
    let subject = locationName;
    let context = "wide shot"; // default

    const upperName = locationName.toUpperCase();
    if (upperName.includes("INT.") || upperName.includes("INTERIOR")) {
        subject = locationName.replace(/INT\.|INTERIOR/gi, "").trim();
        context = "cinematic interior shot";
    } else if (upperName.includes("EXT.") || upperName.includes("EXTERIOR")) {
        subject = locationName.replace(/EXT\.|EXTERIOR/gi, "").trim();
        context = "cinematic exterior wide shot";
    }

    // 2. Base Identity
    let prompt = `${context} of an empty ${subject}`;

    // 3. Terrain/Setting
    if (allTraits.terrain) prompt += `, situated in ${allTraits.terrain}`;

    prompt += ".";

    // 4. Specific Visual Details
    let details: string[] = [];

    if (typeof visualTraits === 'string') {
        details = visualTraits.split(',').map(s => s.trim()).filter(s => s.length > 0);
    }
    else if (Array.isArray(visualTraits)) {
        details = visualTraits;
    }
    else if (visualTraits && typeof visualTraits === 'object') {
        if (visualTraits.environment) details.push(visualTraits.environment);
        if (visualTraits.architectural_style) details.push(visualTraits.architectural_style);
        if (visualTraits.keywords) {
            const kw = Array.isArray(visualTraits.keywords)
                ? visualTraits.keywords
                : visualTraits.keywords.split(',');
            details = [...details, ...kw];
        }
    }

    if (details.length > 0) prompt += ` Visual Details: ${details.join(', ')}.`;

    // 5. Atmosphere & Lighting
    if (allTraits.atmosphere) prompt += ` Atmosphere: ${allTraits.atmosphere}.`;
    if (allTraits.lighting) prompt += ` Lighting: ${allTraits.lighting}.`;

    // 6. Style & Genre
    if (genre) prompt += ` Genre: ${genre}.`;
    if (style) prompt += ` Style: ${style}.`;

    // 7. Safety Lock
    prompt += " Scene must be completely empty, devoid of people, no characters, architectural photography.";

    return prompt;
};


// --- CHARACTER PROMPT BUILDER ---
export const constructCharacterPrompt = (
    charName: string,
    traits: any,
    allTraits: any,
    genre: string,
    style: string
): string => {
    let prompt = `Cinematic portrait of ${charName.toUpperCase()}`;

    const demographics = [];
    if (traits.age) demographics.push(traits.age);
    if (traits.ethnicity) demographics.push(traits.ethnicity);

    if (demographics.length > 0) {
        prompt += `, ${demographics.join(', ')}.`;
    } else {
        prompt += `.`;
    }

    if (traits.clothing) prompt += ` Wearing ${traits.clothing}.`;
    if (traits.hair) prompt += ` Hair: ${traits.hair}.`;
    if (traits.vibe) prompt += ` Vibe: ${traits.vibe}.`;

    if (allTraits.physical_description) {
        prompt += ` Description: ${allTraits.physical_description}.`;
    }

    if (genre) prompt += ` Genre: ${genre}.`;
    if (style) prompt += ` Style: ${style}.`;

    return prompt;
};


// --- [NEW] PRODUCT PROMPT BUILDER ---
export const constructProductPrompt = (
    productName: string,
    traits: any, // Expects flattened object: { brandName, category, materials, colors, features }
    genre: string,
    style: string
): string => {
    // 1. Base Subject & Brand
    let prompt = `Cinematic commercial product shot of ${productName}`;

    if (traits.brandName && traits.brandName.trim()) {
        prompt += ` by ${traits.brandName}`;
    }
    prompt += ".";

    // 2. Core Identity
    if (traits.category) prompt += ` Category: ${traits.category}.`;

    // 3. Visual DNA
    if (traits.materials) prompt += ` Materials: ${traits.materials}.`;
    if (traits.colors) prompt += ` Brand Colors: ${traits.colors}.`;

    // 4. Key Selling Points
    if (traits.features) prompt += ` Key Features visible: ${traits.features}.`;

    // 5. Aesthetic Wrapper
    if (style) prompt += ` Style: ${style}.`;

    // 6. Technical Spec
    prompt += " High-end advertising photography, 8k resolution, hero lighting, sharp focus.";

    return prompt;
};