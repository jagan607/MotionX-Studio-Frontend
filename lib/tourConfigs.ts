/**
 * Central config file for all onboarding tour steps.
 * Each TourStep maps to a DOM element via `targetId`.
 * Add `id={step.targetId}` to the corresponding element in the page.
 */

export interface TourStep {
    targetId: string;       // The DOM element id to spotlight
    title: string;          // Tooltip header (uppercase, short)
    body: string;           // Tooltip description text
    placement: "top" | "bottom" | "left" | "right"; // Where to place tooltip relative to target
    arrowSide?: "left" | "right"; // Which side of the tooltip box the arrow appears on
}

// --- DASHBOARD TOUR ---
export const DASHBOARD_TOUR_STEPS: TourStep[] = [
    {
        targetId: "tour-monitor",
        title: "PROJECT PREVIEW",
        body: "This monitor previews your active project. Click a project in the film strip below to switch, or double-click to open it.",
        placement: "bottom",
    },
    {
        targetId: "tour-project-grid",
        title: "YOUR PROJECTS",
        body: "Your project library. We've added a sample project to get you started — click to preview, double-click to open.",
        placement: "top",
    },
    {
        targetId: "tour-hero-actions",
        title: "QUICK ACTIONS",
        body: "Start a new project, jump into the Playground for instant AI generation, or explore what the community has created.",
        placement: "left",
    },
    {
        targetId: "tour-templates",
        title: "PROJECT TEMPLATES",
        body: "Kickstart your project with a template. Describe your idea or pick a pre-built template — AI will generate your script, scenes, and storyboard automatically.",
        placement: "top",
    },
    {
        targetId: "tour-credits-target",
        title: "YOUR CREDITS",
        body: "Every AI generation (images, videos, auto-direct) costs credits. You start with 30 free credits. Top up anytime to keep creating.",
        placement: "bottom",
        arrowSide: "right",
    },
];

// --- SERIES PAGE TOUR ---
// Target ID: "tour-series-new-ep"
export const SERIES_TOUR_STEPS: TourStep[] = [
    {
        targetId: "tour-series-new-ep",
        title: "INITIALIZE SEQUENCE",
        body: "Initialize your first Episode Sequence here. You can upload an existing script (PDF/TXT) or start with a blank slate.",
        placement: "bottom",
        arrowSide: "right",
    },
];

// --- EPISODE PAGE TOUR ---
// Target ID: "tour-assets-target"
export const EPISODE_TOUR_STEPS: TourStep[] = [
    {
        targetId: "tour-assets-target",
        title: "ASSET LAB",
        body: "AI has auto-detected Characters & Locations from your script. Review casting here before filming.",
        placement: "bottom",
        arrowSide: "right",
    },
];

// --- STORYBOARD TOOLBAR TOUR (always present — fires on first storyboard visit) ---
// Target IDs: tour-sb-scene-selector, tour-sb-autodirect, tour-sb-add-shot, tour-sb-credits, tour-sb-context-strip
export const STORYBOARD_TOOLBAR_TOUR_STEPS: TourStep[] = [
    {
        targetId: "tour-sb-scene-selector",
        title: "SCENE SWITCHER",
        body: "Jump between scenes without closing the board. Your entire episode timeline is one click away.",
        placement: "bottom",
        arrowSide: "left",
    },
    {
        targetId: "tour-sb-autodirect",
        title: "AI DIRECTOR",
        body: "Let AI auto-create a shot list with camera angles, prompts, and casting based on your scene summary.",
        placement: "bottom",
    },
    {
        targetId: "tour-sb-add-shot",
        title: "ADD SHOTS",
        body: "Manually add blank shots to your sequence. You control the shot count and can drag to reorder.",
        placement: "bottom",
    },
    {
        targetId: "tour-sb-credits",
        title: "CREDITS",
        body: "Your generation fuel. Each AI render, animation, or voiceover costs credits. Top up here when low.",
        placement: "bottom",
        arrowSide: "right",
    },
    {
        targetId: "tour-sb-context-strip",
        title: "SCENE CONTEXT",
        body: "Edit your scene summary, review location, time of day, and cast. Changes here influence AI shot generation.",
        placement: "bottom",
    },
];

// --- STORYBOARD SHOT CARD TOUR (fires after shots are created) ---
// Target IDs: tour-sb-shot-card, tour-sb-shot-card-prompt, tour-sb-shot-card-gen, tour-sb-shot-card-settings
export const STORYBOARD_SHOT_CARD_TOUR_STEPS: TourStep[] = [
    {
        targetId: "tour-sb-shot-card",
        title: "SHOT CARD",
        body: "Each card is one shot. Configure casting, prompts, choose your AI engine, then hit GENERATE. Drag to reorder.",
        placement: "right",
    },
    {
        targetId: "tour-sb-shot-card-prompt",
        title: "IMAGE PROMPT",
        body: "Describe what you want to see in this shot. AI will compose the image using your cast, location, and visual style. You can also attach a reference image.",
        placement: "bottom",
    },
    {
        targetId: "tour-sb-shot-card-gen",
        title: "GENERATE IMAGE",
        body: "Click here to render the AI frame. Each generation costs credits (shown on the button). You can re-generate as many times as you want.",
        placement: "top",
    },
    {
        targetId: "tour-sb-shot-card-settings",
        title: "ANIMATE THIS SHOT",
        body: "Open Shot Settings to fine-tune, then generate a video animation from your still frame. This is where your storyboard comes to life.",
        placement: "top",
    },
];

// Combined steps for backward compatibility (legacy usage)
export const STORYBOARD_TOUR_STEPS: TourStep[] = [
    ...STORYBOARD_TOOLBAR_TOUR_STEPS,
    ...STORYBOARD_SHOT_CARD_TOUR_STEPS,
];

// --- SHOT SETTINGS (EDITOR PANEL) TOUR ---
export const SHOT_SETTINGS_TOUR_STEPS: TourStep[] = [
    {
        targetId: "tour-shot-preview",
        title: "SHOT PREVIEW",
        body: "Your shot's current frame — a still image or animated video. Review how it looks before tweaking the prompt.",
        placement: "right",
    },
    {
        targetId: "tour-shot-prompt",
        title: "VIDEO PROMPT",
        body: "Describe the motion and action you want. Type @ to reference characters or images. Hit 'Enhance' to let AI auto-upgrade your prompt.",
        placement: "right",
    },
    {
        targetId: "tour-shot-provider",
        title: "AI ENGINE",
        body: "Choose your video generation engine. Seedance 2.0 excels at cinematic motion, Kling v3 Omni supports multi-reference, and Kling v3 offers element control.",
        placement: "left",
    },
    {
        targetId: "tour-shot-controls",
        title: "DURATION & QUALITY",
        body: "Set the clip duration (4–15 seconds) and resolution (720p for drafts, 1080p for final renders). Longer clips cost more credits.",
        placement: "left",
    },
    {
        targetId: "tour-shot-refmedia",
        title: "REFERENCE MEDIA",
        body: "Add character images, scene references, or audio to guide the AI. Your base shot image is auto-included. Use @tags in your prompt to anchor them.",
        placement: "left",
    },
    {
        targetId: "tour-shot-animate-btn",
        title: "GENERATE VIDEO",
        body: "Once everything is set, hit this button to animate your still frame into a cinematic video clip. Credits will be deducted based on duration and quality.",
        placement: "top",
    },
];

// --- STUDIO PAGE TOUR ---
// Target IDs: tour-studio-credits, tour-studio-ctas, tour-studio-switcher,
//             tour-studio-scene-card, tour-studio-edit-scene, tour-studio-open-sb, tour-studio-sidebar
export const STUDIO_TOUR_STEPS: TourStep[] = [
    {
        targetId: "tour-studio-credits",
        title: "PRODUCTION FUEL",
        body: "Your credit balance lives here. Every AI generation (scripts, images, video) draws from this pool.",
        placement: "bottom",
        arrowSide: "right",
    },
    {
        targetId: "tour-studio-ctas",
        title: "COMMAND BAR",
        body: "Add scenes manually, let AI auto-extend your narrative, edit the script, or manage your asset database — all from here.",
        placement: "bottom",
    },
    {
        targetId: "tour-studio-switcher",
        title: "PROJECT SWITCHER",
        body: "Jump between projects instantly. Your full project library is one click away.",
        placement: "bottom",
        arrowSide: "left",
    },
    {
        targetId: "tour-studio-scene-card",
        title: "SCENE CARD",
        body: "Each card represents one scene. You can see the synopsis, location, and cast at a glance. Drag to reorder.",
        placement: "right",
    },
    {
        targetId: "tour-studio-edit-scene",
        title: "EDIT SCENE",
        body: "Click the pencil to open the Director Console. Rewrite dialogue, reassign cast, change locations — all with AI assistance.",
        placement: "bottom",
    },
    {
        targetId: "tour-studio-open-sb",
        title: "OPEN STORYBOARD",
        body: "This is where the magic happens. Open the storyboard to generate AI frames and animate your shots.",
        placement: "top",
    },
    {
        targetId: "tour-studio-sidebar",
        title: "REEL SIDEBAR",
        body: "Switch between episodes (reels) here. Each reel holds its own set of scenes and storyboards.",
        placement: "right",
    },
];

// --- ASSET MANAGER TOUR ---
// Target IDs: tour-am-cast-tab, tour-am-register-new, tour-am-generate-all, tour-am-asset-card
export const ASSET_MANAGER_TOUR_STEPS: TourStep[] = [
    {
        targetId: "tour-am-cast-tab",
        title: "ASSET CATEGORIES",
        body: "Switch between Cast, Locations, and Products. Each tab holds a separate database of assets.",
        placement: "bottom",
        arrowSide: "left",
    },
    {
        targetId: "tour-am-register-new",
        title: "REGISTER NEW",
        body: "Create a new character, location, or product manually. You can define visual traits, voice, and more.",
        placement: "right",
    },
    {
        targetId: "tour-am-generate-all",
        title: "BATCH RENDER",
        body: "Generate images for all assets in the current category at once. Great for quickly visualizing a cast list.",
        placement: "bottom",
        arrowSide: "right",
    },
    {
        targetId: "tour-am-asset-card",
        title: "ASSET CARD",
        body: "This is a single asset. Use REGEN to create new variations, or CONFIG to fine-tune details like voice and appearance.",
        placement: "right",
    },
];

// --- PRE-PRODUCTION CANVAS TOUR ---
export const PREPRODUCTION_TOUR_STEPS: TourStep[] = [
    {
        targetId: "tour-preprod-canvas",
        title: "PRODUCTION CANVAS",
        body: "This is your visual map. Scenes appear as clapperboards, characters as Polaroid cards, and locations as cinematic frames — all connected by wires showing relationships.",
        placement: "bottom",
    },
    {
        targetId: "tour-preprod-toolbar",
        title: "ASSET TOOLBAR",
        body: "Add new characters, locations, or props to your canvas. Open the Moodboard to set your film's visual direction. Each tool creates a new draggable node.",
        placement: "right",
    },
    {
        targetId: "tour-preprod-assets-btn",
        title: "ASSET MANAGER",
        body: "Open the full asset database. Browse all characters, locations, and products — bulk-generate visuals, configure voice profiles, and fine-tune details.",
        placement: "bottom",
        arrowSide: "right",
    },
    {
        targetId: "tour-preprod-script-btn",
        title: "SCRIPT EDITOR",
        body: "Upload or paste your screenplay here. The AI will extract scenes, characters, and locations automatically and populate them on the canvas.",
        placement: "bottom",
    },
    {
        targetId: "tour-preprod-scene-nav",
        title: "SCENE NAVIGATOR",
        body: "Jump between scenes instantly. Each scene shows its character count and locations. Click a scene to fly the canvas to its cluster.",
        placement: "left",
    },
    {
        targetId: "tour-preprod-minimap",
        title: "MINIMAP",
        body: "A bird's-eye view of your entire production. The white rectangle shows your current viewport — click anywhere to navigate large projects.",
        placement: "left",
    },
    {
        targetId: "tour-preprod-production-btn",
        title: "GO TO PRODUCTION",
        body: "Once your characters and locations are set, head to Production to start generating storyboard frames and animating your shots.",
        placement: "bottom",
        arrowSide: "right",
    },
];

// --- ASSET CONFIGURATION TOUR (inside the AssetModal) ---
export const ASSET_CONFIG_TOUR_STEPS: TourStep[] = [
    {
        targetId: "tour-assetcfg-header",
        title: "CONFIGURATION STUDIO",
        body: "This is where you define every detail of a character, location, or product. The header shows the asset name and type.",
        placement: "bottom",
    },
    {
        targetId: "tour-assetcfg-traits",
        title: "VISUAL TRAITS",
        body: "Define appearance details — age, ethnicity, build, hair, clothing, and vibe for characters; atmosphere and lighting for locations. These traits auto-generate the AI prompt.",
        placement: "bottom",
    },
    {
        targetId: "tour-assetcfg-visuals",
        title: "AI GENERATION",
        body: "Upload a reference photo to guide the AI, or use the auto-generated prompt to create a visual. You can also upload your own image directly or inpaint edits.",
        placement: "top",
    },
    {
        targetId: "tour-assetcfg-actions",
        title: "SAVE & GENERATE",
        body: "Save Configuration persists your trait edits. Generate AI creates a new image using the prompt and reference. Characters also support voice casting via the voice bar above.",
        placement: "top",
    },
];

// --- POST-PRODUCTION TOUR ---
export const POSTPRODUCTION_TOUR_STEPS: TourStep[] = [
    {
        targetId: "tour-postprod-preview",
        title: "VIDEO PREVIEW",
        body: "Watch your assembled cut here. Select a clip in the timeline below to preview it, or press Space to play the full sequence.",
        placement: "bottom",
    },
    {
        targetId: "tour-postprod-transport",
        title: "TRANSPORT CONTROLS",
        body: "Play, pause, scrub, split clips, adjust speed, and undo/redo edits. Use keyboard shortcuts like Space, B (split), and ⌘Z (undo) for speed.",
        placement: "top",
    },
    {
        targetId: "tour-postprod-timeline",
        title: "TIMELINE",
        body: "Drag and reorder video clips. Trim edges, adjust clip speed, add SFX and background music tracks to build your final edit.",
        placement: "top",
    },
    {
        targetId: "tour-postprod-export",
        title: "EXPORT",
        body: "When your edit is ready, click Export to render your final video. Choose resolution and format, then download or share your finished film.",
        placement: "bottom",
        arrowSide: "right",
    },
];

// --- PLAYGROUND TOUR ---
// Target IDs: tour-pg-templates, tour-pg-prompt, tour-pg-assets, tour-pg-grid, tour-pg-settings
export const PLAYGROUND_TOUR_STEPS: TourStep[] = [
    {
        targetId: "tour-pg-templates",
        title: "VIDEO TEMPLATES",
        body: "Pick a pre-made prompt + style to get started instantly. Each template is optimized for a specific look — fashion, cinematic, product, and more. Just click to apply it to your prompt bar.",
        placement: "left",
    },
    {
        targetId: "tour-pg-assets",
        title: "YOUR ASSETS",
        body: "Upload character references, locations, and products here. Use @tags in your prompt to anchor them — the AI will use their appearance to guide generation.",
        placement: "right",
    },
    {
        targetId: "tour-pg-prompt",
        title: "PROMPT BAR",
        body: "Type what you want to see. Use @ to tag your uploaded characters and locations. Hit the ✨ wand to let AI expand your prompt, then press Enter or click Generate.",
        placement: "top",
    },
    {
        targetId: "tour-pg-settings",
        title: "STYLE CONTROLS",
        body: "Fine-tune your generation — choose the AI engine (Gemini / SeedReam), aspect ratio, shot type, and visual style. These settings apply to every generation.",
        placement: "top",
        arrowSide: "left",
    },
    {
        targetId: "tour-pg-grid",
        title: "GENERATION FEED",
        body: "Your AI creations appear here in real-time. Click any image to expand, animate it into video, or drag it onto the prompt bar as a reference. Right-click for more options.",
        placement: "bottom",
    },
];

