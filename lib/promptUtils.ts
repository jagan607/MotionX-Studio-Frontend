// --- LOCATION PROMPT BUILDER ---
export const constructLocationPrompt = (
    locationName: string,
    visualTraits: string | string[] | any, // Expanded to handle String (UI), Array (DB), or Object (Legacy/Type)
    allTraits: any, // The full flat object containing atmosphere, lighting, terrain
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

    // 2. Base Identity (Force "Empty")
    let prompt = `${context} of an empty ${subject}`;

    // 3. Terrain/Setting (Grounding)
    if (allTraits.terrain) prompt += `, situated in ${allTraits.terrain}`;

    prompt += "."; // End subject clause

    // 4. Specific Visual Details (The "Ingredients")
    let details: string[] = [];

    if (typeof visualTraits === 'string') {
        // Handle live string input from UI (e.g. "mist, dark")
        details = visualTraits.split(',').map(s => s.trim()).filter(s => s.length > 0);
    }
    else if (Array.isArray(visualTraits)) {
        // Handle DB Array (e.g. ["mist", "dark"])
        details = visualTraits;
    }
    else if (visualTraits && typeof visualTraits === 'object') {
        // Handle Legacy or Typed Objects
        if (visualTraits.environment) details.push(visualTraits.environment);
        if (visualTraits.architectural_style) details.push(visualTraits.architectural_style);

        // Handle 'LocationVisualTraits' interface (keywords property)
        if (visualTraits.keywords) {
            const kw = Array.isArray(visualTraits.keywords)
                ? visualTraits.keywords
                : visualTraits.keywords.split(',');
            details = [...details, ...kw];
        }
    }

    if (details.length > 0) prompt += ` Visual Details: ${details.join(', ')}.`;

    // 5. Atmosphere & Lighting (The "Vibe")
    if (allTraits.atmosphere) prompt += ` Atmosphere: ${allTraits.atmosphere}.`;
    if (allTraits.lighting) prompt += ` Lighting: ${allTraits.lighting}.`;

    // 6. Style & Genre (Aesthetic wrapper)
    if (genre) prompt += ` Genre: ${genre}.`;
    if (style) prompt += ` Style: ${style}.`;

    // 7. FINAL SAFETY LOCK (Negative constraints as positive text for DALL-E)
    prompt += " Scene must be completely empty, devoid of people, no characters, architectural photography.";

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

    // 5. Genre & Style (Passed dynamically from Project Config)
    if (genre) prompt += ` Genre: ${genre}.`;
    if (style) prompt += ` Style: ${style}.`;

    return prompt;
};