/**
 * Quick Start Templates — pre-filled project configurations
 * that let new users create a project with one click.
 */

export interface ProjectTemplate {
    id: string;
    title: string;
    genre: string;
    synopsis: string;
    type: "movie" | "micro_drama" | "ad";
    style: "realistic" | "animation_2d" | "animation_3d";
    aspectRatio: "16:9" | "9:16" | "21:9" | "4:5" | "1:1";
    runtime: number; // seconds
    label: string;
    subtitle: string;
    accent: string;
    icon: string; // emoji
    /** Which persona goals this template is shown for (null = all) */
    forGoals: string[] | null;
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
    {
        id: "instagram_reel",
        title: "Urban Fashion Reel",
        genre: "Lifestyle",
        synopsis: "A 30-second Instagram Reel showcasing street fashion in a neon-lit city at night. Quick cuts between a model walking through rain-soaked alleys, striking poses under flickering signs, and close-ups of accessories catching the light. Moody, stylish, cinematic.",
        type: "movie",
        style: "realistic",
        aspectRatio: "9:16",
        runtime: 30,
        label: "Instagram Reel",
        subtitle: "30s vertical • street fashion",
        accent: "#E50914",
        icon: "📱",
        forGoals: ["social_clips", "explore"],
    },
    {
        id: "scifi_chase",
        title: "Neon Pursuit",
        genre: "Sci-Fi Thriller",
        synopsis: "A tense 60-second short film scene. Year 2087, Neo-Tokyo. A rogue android sprints through a rain-drenched marketplace, knocking over holographic vendor stalls. A bounty hunter in a long coat follows, tracking the android's heat signature on a wrist device. They lock eyes across a crowded intersection. The android ducks into an alley — the hunter draws a plasma weapon. Ends on a freeze frame.",
        type: "movie",
        style: "realistic",
        aspectRatio: "16:9",
        runtime: 60,
        label: "Short Film Scene",
        subtitle: "60s cinematic • sci-fi thriller",
        accent: "#3B82F6",
        icon: "🎬",
        forGoals: ["short_film", "explore"],
    },
    {
        id: "product_ad",
        title: "Luxury Watch Reveal",
        genre: "Commercial",
        synopsis: "A premium 30-second product commercial for a luxury chronograph watch. Opens with extreme macro shots of the watch mechanism ticking in slow motion, light catching the sapphire crystal. Camera pulls back to reveal the watch on a wrist against a dark marble surface. Golden hour light streams through venetian blinds. Final shot: the watch levitating with particles of light. Elegant, aspirational, cinematic.",
        type: "ad",
        style: "realistic",
        aspectRatio: "16:9",
        runtime: 30,
        label: "Product Ad",
        subtitle: "30s landscape • luxury commercial",
        accent: "#D4A843",
        icon: "📢",
        forGoals: ["brand_content", "explore"],
    },
    {
        id: "anime_mv",
        title: "Cherry Blossom Dreams",
        genre: "Romance",
        synopsis: "A 45-second anime music video. A girl sits on a rooftop at sunset, cherry blossom petals drifting past. She looks at an old photograph, smiles, and the wind carries the petals into a kaleidoscope of memories — running through school hallways, laughing in summer rain, watching fireworks. The memories dissolve back into petals. She stands, looks at the horizon with hope. Beautiful, emotional, dreamlike.",
        type: "movie",
        style: "animation_2d",
        aspectRatio: "16:9",
        runtime: 45,
        label: "Anime Music Video",
        subtitle: "45s landscape • 2D animation",
        accent: "#EC4899",
        icon: "🌸",
        forGoals: ["short_film", "social_clips", "explore"],
    },
];

/**
 * Get templates for a specific user persona goal.
 * Returns all templates if goal is null/undefined.
 */
export function getTemplatesForGoal(goal?: string | null): ProjectTemplate[] {
    if (!goal) return PROJECT_TEMPLATES;
    return PROJECT_TEMPLATES.filter(t => t.forGoals === null || t.forGoals.includes(goal));
}
