/**
 * playgroundTemplates.ts — Seedance 2.0 Template Data + Prompt Assembly
 *
 * Two families:
 *   1. Superhero Transformation (5 styles × 3 durations)
 *   2. Fight Family (4 fight types × 3 durations)
 */

// ═══════════════════════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════════════════════

export type TemplateFamily = "superhero" | "fight";
export type Duration = "5" | "10" | "15";

export type SuperheroStyle = "ground" | "mystic" | "tech" | "dark" | "water";
export type FightType = "hand" | "weapon" | "superhero_combat" | "hybrid";
export type FightOutcome = "a_wins" | "b_wins" | "unresolved";

export interface PlaygroundTemplate {
    id: string;
    family: TemplateFamily;
    title: string;
    subtitle: string;
    style?: SuperheroStyle;
    fightType?: FightType;
    duration: Duration;
    accent: string;
    emoji: string;
    previewVideoUrl?: string;
    /** Number of character images required */
    requiredImages: 1 | 2;
    /** Supports optional location image */
    supportsLocation: boolean;
}

// ═══════════════════════════════════════════════════════════════
//  STYLE / FIGHT TYPE METADATA
// ═══════════════════════════════════════════════════════════════

export const SUPERHERO_STYLES: Record<SuperheroStyle, { label: string; accent: string; emoji: string }> = {
    ground: { label: "Ground / Land", accent: "#D4A843", emoji: "⛰️" },
    mystic: { label: "Mystic / Magical", accent: "#A855F7", emoji: "✨" },
    tech:   { label: "Tech / Futuristic", accent: "#3B82F6", emoji: "⚡" },
    dark:   { label: "Dark / Shadow", accent: "#6B7280", emoji: "🌑" },
    water:  { label: "Water / Elemental", accent: "#06B6D4", emoji: "🌊" },
};

export const FIGHT_TYPES: Record<FightType, { label: string; accent: string; emoji: string }> = {
    hand:             { label: "Hand Combat", accent: "#EF4444", emoji: "👊" },
    weapon:           { label: "Weapon Combat", accent: "#F59E0B", emoji: "⚔️" },
    superhero_combat: { label: "Superhero Combat", accent: "#8B5CF6", emoji: "💥" },
    hybrid:           { label: "Hybrid Combat", accent: "#EC4899", emoji: "🔥" },
};

const DURATIONS: Duration[] = ["5", "10", "15"];
const BASE_VIDEO_PATH = "https://firebasestorage.googleapis.com/v0/b/motionx-studio.firebasestorage.app/o/playground%2Ftemplates%2F";

/**
 * Real preview video URLs for templates that have uploaded previews.
 * Falls back to the auto-generated path pattern for templates without a preview.
 */
const PREVIEW_VIDEOS: Record<string, string> = {
    // Superhero Transformation — first 3 styles (5s default view)
    "superhero_ground_5s": "https://firebasestorage.googleapis.com/v0/b/motionx-studio.firebasestorage.app/o/Templates%2FSeedance%2F02177692531338700000000000000000000ffffac177f3ba0372f.mp4?alt=media&token=e9077f95-8047-46ad-8903-f75b9f349df8",
    "superhero_mystic_5s": "https://firebasestorage.googleapis.com/v0/b/motionx-studio.firebasestorage.app/o/Templates%2FSeedance%2F02177692613092800000000000000000000ffffac14e6d28e52ae.mp4?alt=media&token=4c61b1fd-c941-4a93-8c47-d9ba08970cf6",
    "superhero_tech_5s":   "https://firebasestorage.googleapis.com/v0/b/motionx-studio.firebasestorage.app/o/Templates%2FSeedance%2F02177692658702800000000000000000000ffffac19284442f654.mp4?alt=media&token=5ff776ff-de75-4c76-b881-f86b5bbd7d7a",
    // Fight — Superhero Combat
    "fight_superhero_combat_5s": "https://firebasestorage.googleapis.com/v0/b/motionx-studio.firebasestorage.app/o/Templates%2FSeedance%2F121b358e-afe5-49d2-b069-2e3db1aaabfd.mp4?alt=media&token=6139eb80-fdcc-482f-809a-54d1c8028564",
};

// ═══════════════════════════════════════════════════════════════
//  GENERATE TEMPLATE LIST
// ═══════════════════════════════════════════════════════════════

function generateSuperheroTemplates(): PlaygroundTemplate[] {
    const templates: PlaygroundTemplate[] = [];
    for (const [style, meta] of Object.entries(SUPERHERO_STYLES)) {
        for (const dur of DURATIONS) {
            const id = `superhero_${style}_${dur}s`;
            templates.push({
                id,
                family: "superhero",
                title: meta.label,
                subtitle: `${dur}s Transformation`,
                style: style as SuperheroStyle,
                duration: dur,
                accent: meta.accent,
                emoji: meta.emoji,
                previewVideoUrl: PREVIEW_VIDEOS[id] || `${BASE_VIDEO_PATH}${id}.mp4?alt=media`,
                requiredImages: 1,
                supportsLocation: true,
            });
        }
    }
    return templates;
}

function generateFightTemplates(): PlaygroundTemplate[] {
    const templates: PlaygroundTemplate[] = [];
    for (const [fType, meta] of Object.entries(FIGHT_TYPES)) {
        for (const dur of DURATIONS) {
            const id = `fight_${fType}_${dur}s`;
            templates.push({
                id,
                family: "fight",
                title: meta.label,
                subtitle: `${dur}s Fight Scene`,
                fightType: fType as FightType,
                duration: dur,
                accent: meta.accent,
                emoji: meta.emoji,
                previewVideoUrl: PREVIEW_VIDEOS[id] || `${BASE_VIDEO_PATH}${id}.mp4?alt=media`,
                requiredImages: 2,
                supportsLocation: true,
            });
        }
    }
    return templates;
}

export const ALL_TEMPLATES: PlaygroundTemplate[] = [
    ...generateSuperheroTemplates(),
    ...generateFightTemplates(),
];

export const SUPERHERO_TEMPLATES = ALL_TEMPLATES.filter(t => t.family === "superhero");
export const FIGHT_TEMPLATES = ALL_TEMPLATES.filter(t => t.family === "fight");


// ═══════════════════════════════════════════════════════════════
//  PROMPT ASSEMBLY — SUPERHERO TRANSFORMATION
// ═══════════════════════════════════════════════════════════════

const SUPERHERO_IDENTITY = `Use @image1 as the primary reference for the character, preserving the same face, body presence, and overall visual identity. Use @image1 as the visual starting point for the transformation, keeping the character grounded in the scene and atmosphere already present in the image.`;

const SUPERHERO_STYLE_PROMPTS: Record<SuperheroStyle, Record<Duration, string>> = {
    ground: {
        "5": `Create a 5-second cinematic superhero transformation shot. Begin with the character in ordinary form. The transformation should happen swiftly and decisively, driven by a single ground-based anchor such as a sudden force pulse rising from below, a hard impact through the ground beneath the character, or a dense earth-energy surge around the feet. As soon as the anchor activates, power climbs rapidly through the legs and torso, changing posture, silhouette, and costume in one fast progression. The body becomes stronger and more rooted as a durable land-based superhero suit forms in forceful layers with reinforced textures, armored details, and a bold heroic shape. Let the environment react through subtle dust lift, vibration, and low energy ripples that remain connected to @image1. The camera should use a quick push-in or low-angle sweep. End with a sharp full-body reveal of the fully transformed ground superhero in a stable, powerful stance.`,
        "10": `Create a 10-second cinematic superhero transformation scene with fast multi-cut choreography. Begin with the character in ordinary form. A ground-based transformation starts with force rising from below. Cut quickly between the trigger, the feet reacting to ground energy, the legs and torso being overtaken by dense power, the hands tightening with strength, and the character's expression shifting into focused power. Show the costume forming in stages through fast visual beats: reinforced boots, layered torso armor, gauntlet details, and a stronger silhouette locking into place. Let the scene and atmosphere deepen with dust, vibration, and contained force ripples while preserving continuity. Keep the camera active with low-angle closeups, side sweeps, push-ins, and rapid reframing. End with a strong full-body reveal of the completed ground superhero in a commanding stance.`,
        "15": `Create a 15-second cinematic superhero transformation scene with dynamic multi-cut choreography. Begin by briefly showing the character in ordinary form within the visual world implied by @image1. A ground-based transformation begins as force rises through the ground and feeds into the body. Intercut the environment reacting with dust, vibration, and low force ripples with the character's transformation: the stance becoming more rooted, the spine straightening, the shoulders broadening, and the costume forming progressively into a durable ground-based superhero suit with reinforced textures, strong boots, armored details, and a bold heroic silhouette. Use changing shot scales and active camera choreography, including wide shots, low angles, body closeups, expression shots, and moving three-quarter views. End with a powerful full-body reveal of the completed ground superhero in a stable, commanding stance.`,
    },
    mystic: {
        "5": `Create a 5-second cinematic superhero transformation shot. Begin with the character in ordinary form. The transformation should happen swiftly and decisively, driven by a single mystical anchor such as a glowing pendant, a hand gesture activating a sigil, a floating rune, or a sudden circle of arcane light appearing around the character. As soon as the anchor activates, radiant magical energy spreads rapidly around the body in one elegant surge. Arcane symbols flash into view, light rings or sigils revolve briefly around the character, and the posture shifts from ordinary to centered, composed, and powerful. The ordinary clothing transforms quickly into a refined mystical superhero costume with luminous details, arcane design language, and a strong enchanted silhouette. Let the scene and atmosphere gain subtle glow, particles, and magical atmosphere while preserving continuity. Use a quick push-in or short circular sweep. End with a sharp full-body reveal of the completed mystical superhero surrounded by controlled magical aura.`,
        "10": `Create a 10-second cinematic superhero transformation scene with fast multi-cut choreography. Begin with the character in ordinary form. A mystical transformation starts and unfolds through quick visual beats: a glowing sigil, magical object, hand gesture, or burst of arcane light triggers the change. Cut between the trigger, the face reacting to power, the hands channeling energy, and the torso as enchanted light spreads over the body. Show the costume forming in stages: magical textures appearing over the torso, glowing trim developing along the arms and shoulders, arcane symbols locking into place, and the silhouette becoming more regal and powerful. Let the image-world gain atmospheric glow, floating particles, and reflected light. Keep the camera varied with push-ins, closeups, circular motion, side sweeps, and reframed medium shots. End with a strong full-body reveal of the completed mystical superhero.`,
        "15": `Create a 15-second cinematic superhero transformation scene with dynamic multi-cut choreography. Begin by briefly showing the character in ordinary form within the image-world. A mystical transformation begins through an arcane trigger such as a glowing sigil, magical object, rune circle, or concentrated burst of enchanted light. Intercut the character's changing body language, expression, and costume with moments that show magical energy gathering in the space. The posture shifts from ordinary to poised and commanding. The ordinary clothing evolves step by step into a refined mystical superhero costume with luminous textures, arcane patterns, enchanted trim, layered magical surfaces, and a strong elegant silhouette. Let the environment respond with glow, drifting energy, light reflection, and suspended magical particles. Use closeups of face, hands, torso, and costume details along with wider shots that show the arcane energy surrounding the character. End with a powerful full-body reveal of the completed mystical superhero standing in a calm but commanding magical stance.`,
    },
    tech: {
        "5": `Create a 5-second cinematic superhero transformation shot. Begin with the character in ordinary form. The transformation should happen swiftly and decisively, driven by a single technological anchor such as a wrist device, glowing core, digital interface, visor activation, holographic command, or energy pulse from a piece of tech. As soon as the anchor activates, light sweeps across the body, digital patterns scan the character, and glowing circuitry spreads rapidly over the skin and clothing. Segmented armor or nanotech components form in one fast progression, locking around the torso, arms, legs, and shoulders with clean mechanical precision. Let the scene and atmosphere gain reflected interface light and subtle tech atmosphere while preserving continuity. Use a quick push-in, short orbit, or clean low-angle sweep. End with a sharp full-body reveal of the fully transformed tech superhero with a strong futuristic stance.`,
        "10": `Create a 10-second cinematic superhero transformation scene with fast multi-cut choreography. Begin with the character in ordinary form. A high-tech transformation begins and unfolds through rapid beats triggered by a device activation, a glowing energy core, visor interface, holographic system, or scanning pulse. Cut between the trigger, the face reacting to power, the eyes reflecting interface light, the hands and arms being overtaken by digital energy, and the torso as illuminated circuitry spreads and armor components assemble. Show the suit forming in distinct stages: boots locking into place, gauntlets forming, chest armor assembling around a glowing core, and shoulder or back components completing the silhouette. Let the image-world gain energy flicker, digital glow, and subtle system-response behavior. Keep the camera kinetic with fast push-ins, low-angle closeups, side sweeps, short orbits, and reframed medium shots. End with a strong full-body reveal of the completed futuristic superhero.`,
        "15": `Create a 15-second cinematic superhero transformation scene with dynamic multi-cut choreography. Begin by showing the character in ordinary form within the visual world implied by @image1. A futuristic transformation begins through a clear tech-based trigger such as an activated device, a glowing power core, a holographic system, or a signal pulse. Intercut the character's body and expression changes with moments that show scanning light, digital overlays, and reactive tech atmosphere in the environment. The first wave appears as scanning energy moving over the body, followed by glowing circuitry spreading across the torso, arms, and legs. The ordinary clothing evolves in stages into a sleek futuristic suit with segmented armor, structured gauntlets, reinforced boots, luminous circuitry lines, chest-core detailing, and a sharp advanced silhouette. Use closeups of the eyes, hands, chest core, and armor assembly along with wider moving shots that keep the character as the focal point. End with a powerful full-body reveal of the completed tech superhero.`,
    },
    dark: {
        "5": `Create a 5-second cinematic superhero transformation shot. Begin with the character in ordinary form. The transformation should happen swiftly and decisively, driven by a single dark visual anchor such as a shadow pulse spreading from the feet, a dark emblem igniting, smoke gathering unnaturally around one hand, or a sudden surge of controlled black energy. As soon as the anchor activates, dark energy climbs rapidly around the body, with smoke, shadow trails, drifting particles, and controlled aura wrapping the character in one fast progression. The posture shifts from ordinary to composed, dangerous, and powerful. The ordinary clothing transforms rapidly into a sleek dark superhero costume with a sharp silhouette, armored or tactical surfaces, dramatic shadow-toned detailing, and a strong antihero heroic presence. Let the image-world darken or intensify naturally. Use a quick push-in, short low-angle sweep, or controlled orbit. End with a sharp full-body reveal of the fully transformed dark superhero surrounded by controlled shadow aura.`,
        "10": `Create a 10-second cinematic superhero transformation scene with fast multi-cut choreography. Begin with the character in ordinary form. A dark transformation begins and unfolds through rapid visual beats. Open with a strong activation such as a pulse of shadow energy, a black energy flare through the hand or chest, smoke gathering around the body, or a symbol igniting in the frame. Cut between the trigger, the face reacting to power, the eyes sharpening with dark focus, the hands drawing in shadow energy, and the torso as dark force spreads over the body. Show the costume forming in stages: boots or lower-leg armor darkening and locking in place, gauntlets and forearm details forming, chest armor or a shadow emblem appearing, shoulder and upper-body structure sharpening the silhouette, and the antihero form becoming complete. Let the image-world deepen with shadow atmosphere, smoke, or dimmed light while preserving continuity. Use fast push-ins, low-angle closeups, side sweeps, short orbits, and quick body-detail shots. End with a strong full-body reveal of the completed dark superhero.`,
        "15": `Create a 15-second cinematic superhero transformation scene with dynamic multi-cut choreography. Begin by showing the character in ordinary form within the visual world implied by @image1. A dark transformation begins through a clear shadow-based trigger such as smoke gathering unnaturally, a black aura rising from the ground, an energy pulse igniting from the chest or hand, or darkness spreading across the body in a controlled wave. Intercut the character's body and expression changes with moments that show the environment reacting. The first phase appears as drifting shadow particles, black mist, and dark energy wrapping the body. As the sequence continues, the posture becomes more composed, powerful, and commanding. The ordinary clothing evolves step by step into a sleek dark superhero costume with a sharp silhouette, armored or tactical surfaces, shadow-toned detailing, gauntlet and boot structure, and a strong antihero heroic form. Let the environment deepen with drifting smoke, dimmed light, and subtle energy tension. Use closeups of eyes, hands, torso, boots, and costume formation along with wider hero framings. End with a powerful full-body reveal of the completed dark superhero.`,
    },
    water: {
        "5": `Create a 5-second cinematic superhero transformation shot. Begin with the character in ordinary form. The transformation should happen swiftly and decisively, driven by a single water-based visual anchor such as a floating droplet suspended unnaturally, a ring of water forming around the hand or feet, a sudden upward splash, or a pulse of liquid energy wrapping around the body. As soon as the anchor activates, water energy rises and spirals around the character in one fast elegant surge, with droplets, mist, ripples, and fluid motion moving across the body. The posture shifts quickly from ordinary to composed, balanced, and powerful. The ordinary clothing transforms rapidly into a sleek water-based superhero costume with hydrodynamic contours, reflective liquid textures, flowing armor-like surfaces, and luminous aquatic details. Let the image-world gain subtle moisture, reflections, drifting mist, or liquid atmosphere while preserving continuity. Use a quick push-in, fluid side arc, or short circular sweep. End with a sharp full-body reveal of the fully transformed water superhero surrounded by controlled liquid energy.`,
        "10": `Create a 10-second cinematic superhero transformation scene with fast multi-cut choreography. Begin with the character in ordinary form. A water-based transformation begins and unfolds through a sequence of rapid visual beats. Open with a strong water activation such as liquid gathering in the air, a circular current forming around the body, a rising splash, or suspended droplets locking into a moving pattern. Cut between the trigger, the face reacting to the power, the eyes catching reflected water light, the hands channeling liquid force, and the torso as currents and rippling energy spread over the body. Show the costume forming in stages: lower-leg and boot structures forming with fluid contours, forearm and hand details emerging through reflective layers, torso armor or aquatic textures locking into place, and shoulder or upper-body forms completing the silhouette. Let the image-world gain mist, reflected highlights, suspended droplets, and soft spray while preserving continuity. Keep the camera kinetic with closeups, push-ins, side sweeps, fluid arcs, and reframed medium shots. End with a strong full-body reveal of the completed water superhero.`,
        "15": `Create a 15-second cinematic superhero transformation scene with dynamic multi-cut choreography. Begin by briefly showing the character in ordinary form within the visual world implied by @image1. A water-based transformation begins through a clear liquid-energy trigger such as a suspended droplet cluster, a ring of water moving around the character, an upward surge, or a gathering current that responds directly to the body. Intercut the character's body, expression, and costume evolution with moments that show the image-world reacting through mist, ripples, reflected light, drifting spray, and fluid motion in the surrounding space. The posture shifts from ordinary to balanced, composed, and fluidly powerful. The ordinary clothing evolves in stages into a sleek water superhero costume with hydrodynamic forms, reflective liquid textures, luminous blue-green detailing, layered aquatic surfaces, and a refined powerful silhouette. Use closeups of the eyes, hands, torso, legs, and costume details along with sweeping side arcs, circular motion, and wider frames that show the environment responding. End with a strong full-body reveal of the completed water superhero.`,
    },
};

const LOCATION_OVERRIDE = `Use @image2 as the location reference, guiding the environment, composition, and visual mood of the scene. Keep the transformation visually connected to the location. Let the location react to the energy according to style. Keep the character as the visual center of the scene.`;

export function assembleSuperheroPrompt(
    style: SuperheroStyle,
    duration: Duration,
    hasLocation: boolean
): string {
    let prompt = SUPERHERO_IDENTITY + " " + SUPERHERO_STYLE_PROMPTS[style][duration];
    if (hasLocation) {
        prompt += " " + LOCATION_OVERRIDE;
    }
    return prompt;
}


// ═══════════════════════════════════════════════════════════════
//  PROMPT ASSEMBLY — FIGHT FAMILY
// ═══════════════════════════════════════════════════════════════

const FIGHT_IDENTITY = `Use @image1 as the primary reference for Fighter A and @image2 as the primary reference for Fighter B. Preserve both fighters' face, body presence, and overall visual identity throughout.`;

const FIGHT_PROMPTS: Record<FightType, Record<Duration, string>> = {
    hand: {
        "5": `Open with both fighters already in active confrontation. Show immediate physical tension and a short active setup. Fighter A or Fighter B launches the first strike. Show a punch, kick, shove, or rush-in attack in a clean medium shot. Show the counter beat—block, dodge, parry, body slip, or close-range reaction. Show the decisive micro-escalation: a second strike, a counter-combination, or a forceful close-range collision.`,
        "10": `Brief active setup of both fighters in the same space. First clean strike or rush-in attempt. Counter beat—block, dodge, slip, or defensive turn. Closeup of facial intensity or body strain. A fast combination or exchange of two quick movements. Wider geography beat showing distance, stance, and movement rhythm. Close-range impact beat—body hit, sweep attempt, shove, or clinch moment. Reversal or momentum shift. Decisive offensive beat by the fighter who is meant to gain advantage, or a mutual clash if unresolved.`,
        "15": `Establish the space and both fighters in active readiness. They circle, step in, or read each other. First committed strike. Defensive response. Closeup of intent, breathing, or body strain. Short burst combination or rush sequence. Wider shot showing fight geography. A clinch, sweep, shove, or takedown attempt. The defender recovers or reverses. Another pressure beat with visible physical exertion. Momentum tilts toward one side or remains contested. Strong exchange closeup. Decisive offensive beat. The losing fighter is compromised, or both are still engaged if unresolved.`,
    },
    weapon: {
        "5": `Open with both fighters already in motion and entering a weapon exchange. Show the first strike or intercepting block. Cut to a tight closeup of weapon collision, grip tension, sparks, or impact detail. Show a quick counter or push-off that changes momentum.`,
        "10": `Brief active setup showing both fighters and their weapons. First attack beat. Defensive weapon response or parry. Tight closeup of weapon collision or grip. Facial intensity shot showing strain or focus. Wider shot showing spacing and weapon rhythm. A stronger attack or near-miss that raises tension. Counterattack or reversal. Decisive clash or dominant offensive beat.`,
        "15": `Establish both fighters and the surrounding space. Show weapon readiness and tension. First committed attack. Block or evasive response. Closeup of weapon detail or impact strain. Another exchange showing rhythm and distance. Wider geography beat. Strong weapon collision with environment reaction if appropriate. Near-miss or advantage shift. Counterattack. Pressure beat where one fighter pushes harder. Tight impact or expression shot. Decisive offensive beat.`,
    },
    superhero_combat: {
        "5": `Open on an active confrontation with both powers beginning to manifest. One fighter attacks first or both collide head-on with powers. Show a tighter impact beat with energy, force, and reaction. Let the environment react. Show the reversal or dominant counter.`,
        "10": `Active setup with visible power buildup. First power attack or collision. Face or body closeup showing exertion and energy channeling. Defensive move, evasion, or counter-power. Close collision beat—hands, energy, or body impact. Show environment reaction—shockwave, debris, light shift, or distortion. Momentum shifts. One fighter is pressured or forced back. Decisive offensive beat.`,
        "15": `Establish the location and both fighters. Active readiness and power manifestation. First serious powered attack. Absorb, evade, or counter. Closeup of power manifestation. Strong clash. Wider shot showing fight geography. More visible location reaction. Pressure beat or apparent threat from one side. Turnaround or stronger activation. Reaction shot under pressure. Dominance shot or mutual collision depending on outcome. Decisive finishing beat or unresolved climax.`,
    },
    hybrid: {
        "5": `Open with both fighters in immediate confrontation and mixed-combat readiness. Show the first layered attack—physical, weapon, or power-assisted. Counter beat with a different mode of response, keeping contrast clear. Show a dominant mixed-combat collision or reversal.`,
        "10": `Active setup. First offensive beat. Closeup of a contrasting response—weapon, power, or physical counter. Expression or body-strain shot. Layered collision beat. Wider geography beat. Escalation using a second combat mode. Reversal or pressure shift. Decisive offensive beat or final clash.`,
        "15": `Establish fighters and environment. Show mixed-combat readiness. First attack. Counter using a different combat mode. Closeup of weapon, power, or body detail. First strong layered clash. Wider geography beat. Environmental reaction or movement through space. Pressure sequence. Reversal or counter-escalation. Dominant offensive beat starts forming. Tight impact or expression beat. Decisive finishing beat or major unresolved clash.`,
    },
};

const OUTCOME_CLAUSES: Record<FightOutcome, string> = {
    a_wins: "The fight should end with Fighter A gaining a clear final advantage and controlling the last frame.",
    b_wins: "The fight should end with Fighter B gaining a clear final advantage and controlling the last frame.",
    unresolved: "The fight should end in a tense unresolved state, with both fighters still active and the conflict still alive in the final frame.",
};

const FIGHT_LOCATION_CLAUSE = `If a location image is provided, use it as the environment reference and keep the fight visually grounded in that space.`;

export function assembleFightPrompt(
    fightType: FightType,
    duration: Duration,
    outcome: FightOutcome,
    hasLocation: boolean
): string {
    let prompt = FIGHT_IDENTITY + " " + FIGHT_PROMPTS[fightType][duration];
    prompt += " " + OUTCOME_CLAUSES[outcome];
    if (hasLocation) {
        prompt += " " + FIGHT_LOCATION_CLAUSE;
    }
    return prompt;
}
