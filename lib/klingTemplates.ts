/**
 * klingTemplates.ts — Kling 3.0 Playground Templates
 *
 * 10 Emotional Families (writer-mode templates from the Kling V3 Emotional System)
 *
 * Templates use the no-dialogue branch with medium intensity + visible expression
 * baked in, and reference the input image for character continuity.
 */

// ═══════════════════════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════════════════════

export type EmotionFamily =
    | "tender" | "heavy" | "tense" | "fearful" | "detached"
    | "reflective" | "hopeful" | "persuasive" | "dominant" | "broken";

export interface KlingTemplate {
    id: string;
    emotionFamily: EmotionFamily;
    title: string;
    subtitle: string;
    accent: string;
    emoji: string;
    promptText: string;
    previewVideoUrl?: string;
    requiredImages: 0 | 1;
}

// ═══════════════════════════════════════════════════════════════
//  EMOTION FAMILY METADATA
// ═══════════════════════════════════════════════════════════════

export const EMOTION_FAMILIES: Record<EmotionFamily, { label: string; writer: string; accent: string; emoji: string }> = {
    tender:     { label: "Tender",      writer: "Chekhov",           accent: "#F472B6", emoji: "🕊️" },
    heavy:      { label: "Heavy",       writer: "Ishiguro",          accent: "#6366F1", emoji: "🪨" },
    tense:      { label: "Tense",       writer: "Pinter",            accent: "#EF4444", emoji: "⚡" },
    fearful:    { label: "Fearful",     writer: "Shirley Jackson",   accent: "#64748B", emoji: "😰" },
    detached:   { label: "Detached",    writer: "Camus",             accent: "#94A3B8", emoji: "🧊" },
    reflective: { label: "Reflective",  writer: "Virginia Woolf",    accent: "#A78BFA", emoji: "💭" },
    hopeful:    { label: "Hopeful",     writer: "Tagore",            accent: "#FBBF24", emoji: "🌅" },
    persuasive: { label: "Persuasive",  writer: "Ibsen",             accent: "#F97316", emoji: "🎯" },
    dominant:   { label: "Dominant",    writer: "Patricia Highsmith", accent: "#DC2626", emoji: "👑" },
    broken:     { label: "Broken",      writer: "Bergman",           accent: "#78716C", emoji: "💔" },
};

// ═══════════════════════════════════════════════════════════════
//  TEMPLATES (no-dialogue + medium intensity + visible expression)
// ═══════════════════════════════════════════════════════════════

export const KLING_TEMPLATES: KlingTemplate[] = [
    {
        id: "kling-emo-tender", emotionFamily: "tender",
        title: "Tender Moment", subtitle: "Chekhov — soft, intimate, vulnerable",
        accent: "#F472B6", emoji: "🕊️", requiredImages: 1,
        promptText: "The character from the reference image in a quiet, softly lit interior space. A quiet tender moment shaped by softness, care, and emotional openness. The feeling shows through gentle attention, slight hesitation, softened features, and the way they hold themselves in the space. The emotion should feel intimate and human, never exaggerated, with small pauses and delicate physical behavior carrying the moment. Make the warmth clearly readable, with natural softness and emotional presence. Let the tenderness read clearly in the eyes, face, and timing without becoming overly dramatic.",
    },
    {
        id: "kling-emo-heavy", emotionFamily: "heavy",
        title: "Heavy Silence", subtitle: "Ishiguro — restrained sorrow, inner weight",
        accent: "#6366F1", emoji: "🪨", requiredImages: 1,
        promptText: "The character from the reference image in a still, muted environment. A restrained emotional moment shaped by inner heaviness, quiet sorrow, or emotional fatigue. The feeling should be carried rather than performed, visible through slowed reactions, tired posture, distant focus, and the effort of staying composed. The body should seem burdened by something inward, with the emotion living in restraint more than display. Make the emotional weight clearly present in posture, timing, and subdued reactions. Let the sorrow register openly in the face and stillness while retaining control.",
    },
    {
        id: "kling-emo-tense", emotionFamily: "tense",
        title: "Tense Standoff", subtitle: "Pinter — friction, restraint, unresolved",
        accent: "#EF4444", emoji: "⚡", requiredImages: 1,
        promptText: "The character from the reference image in a confined, charged interior. A tense moment driven by emotional pressure, restraint, and unresolved friction. The feeling should appear through stillness, sharpened attention, guarded body language, clipped movement, and pauses that feel loaded. The character should seem to be holding back speech, action, or reaction, letting the tension gather in timing and presence. Make the friction clearly legible in pauses, posture, and eye contact. Let the strain show openly in the face, timing, and voice while still controlled.",
    },
    {
        id: "kling-emo-fearful", emotionFamily: "fearful",
        title: "Fearful Unease", subtitle: "Shirley Jackson — watchful, disturbed",
        accent: "#64748B", emoji: "😰", requiredImages: 1,
        promptText: "The character from the reference image in a shadowy, unsettling space. A moment shaped by unease, watchfulness, and intimate fear. The emotion should show through unsettled breath, delayed reactions, cautious movement, and the sense that the character is trying to remain composed while feeling slightly unsafe. The behavior should feel psychologically real and subtly disturbed rather than theatrical. Make the instability readable in breath, timing, and alert behavior. Let the unease register clearly in the eyes, breath, and hesitation.",
    },
    {
        id: "kling-emo-detached", emotionFamily: "detached",
        title: "Detached Calm", subtitle: "Camus — distant, numb, withdrawn",
        accent: "#94A3B8", emoji: "🧊", requiredImages: 1,
        promptText: "The character from the reference image in a sparse, neutral environment. A cool, emotionally withdrawn moment shaped by distance, numbness, or inward absence. The emotion should live in what does not react, what does not move, and what remains untouched. The performance should feel sparse, clear, and human, with minimal emotional signaling and a quiet sense of separation from the surrounding world. Make the distance clearly readable in stillness and lack of urgency. Let the emotional absence register clearly through flat affect and sparse reaction.",
    },
    {
        id: "kling-emo-reflective", emotionFamily: "reflective",
        title: "Reflective Thought", subtitle: "Virginia Woolf — inward, contemplative",
        accent: "#A78BFA", emoji: "💭", requiredImages: 1,
        promptText: "The character from the reference image in a quiet, naturally lit space near a window. A private reflective moment where thought quietly reshapes the face and body. The emotion should move inwardly but remain visible through gaze, breath, pauses, and subtle changes in attention. The character should seem to be passing through memory, realization, or feeling in real time, with the shot holding that inward transition. Make the inward process clearly readable in face, breath, and pauses. Let the internal process read clearly in the eyes, mouth, and breath.",
    },
    {
        id: "kling-emo-hopeful", emotionFamily: "hopeful",
        title: "Hopeful Glow", subtitle: "Tagore — warm, relieved, luminous",
        accent: "#FBBF24", emoji: "🌅", requiredImages: 1,
        promptText: "The character from the reference image in a warmly lit, open space. A gentle emotional moment touched by warmth, relief, or the return of hope. The feeling should appear through softened features, quiet openness, eased posture, and the sense that emotional light is re-entering the body. The tone should feel graceful, human, and earned rather than decorative. Make the warmth clearly readable, with quiet emotional renewal. Let the warmth read clearly in the face, timing, and openness of the body.",
    },
    {
        id: "kling-emo-persuasive", emotionFamily: "persuasive",
        title: "Persuasive Force", subtitle: "Ibsen — intentional, urgent, purposeful",
        accent: "#F97316", emoji: "🎯", requiredImages: 1,
        promptText: "The character from the reference image in a focused, intimate setting. A moment shaped by the effort to reach someone emotionally, even without words. The character should seem driven by intention, urgency, and the need to affect another person or the course of the interaction. The emotion should show through leaning energy, focused attention, and the visible strain of wanting a response or change. Make the intention clear, with readable emotional stakes and purposeful energy. Let the emotional objective show clearly in the face, voice, and body.",
    },
    {
        id: "kling-emo-dominant", emotionFamily: "dominant",
        title: "Dominant Presence", subtitle: "Patricia Highsmith — controlled, commanding",
        accent: "#DC2626", emoji: "👑", requiredImages: 1,
        promptText: "The character from the reference image in a composed, architecturally strong environment. A controlled moment defined by quiet power, psychological command, and precision. The pressure should come through stillness, gaze, timing, and the sense that the character owns the emotional space without needing dramatic movement. The mood should feel composed, sharp, and subtly threatening. Make the power clearly felt through presence and timing. Let the authority and threat register clearly in face, voice, and stillness.",
    },
    {
        id: "kling-emo-broken", emotionFamily: "broken",
        title: "Broken Composure", subtitle: "Bergman — fractured, raw, overwhelmed",
        accent: "#78716C", emoji: "💔", requiredImages: 1,
        promptText: "The character from the reference image in a dim, isolated space. A raw emotional moment where composure is no longer fully holding. The feeling should show through unstable breath, exposed eyes, disrupted stillness, and the visible effort to keep from collapsing inward or outward. The performance should stay intimate and truthful rather than theatrical, with the body carrying emotional overload. Make the emotional strain clearly visible, with composure under pressure. Let the fracture show clearly in breath, face, and timing.",
    },
];
