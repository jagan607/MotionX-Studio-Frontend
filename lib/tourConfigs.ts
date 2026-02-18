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
// Target IDs: "tour-credits-target", "tour-new-series-target"
export const DASHBOARD_TOUR_STEPS: TourStep[] = [
    {
        targetId: "tour-credits-target",
        title: "SYSTEM CREDITS",
        body: "This is your production fuel. Every AI generation consumes credits. Keep an eye on this meter.",
        placement: "bottom",
        arrowSide: "right",
    },
    {
        targetId: "tour-new-series-target",
        title: "START CREATING",
        body: "Ready to direct? Click here to initialize a new Series and start generating your script.",
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

// --- STORYBOARD OVERLAY TOUR ---
// Target IDs: tour-sb-scene-selector, tour-sb-generate-all, tour-sb-autodirect,
//             tour-sb-add-shot, tour-sb-credits, tour-sb-context-strip, tour-sb-shot-card
export const STORYBOARD_TOUR_STEPS: TourStep[] = [
    {
        targetId: "tour-sb-scene-selector",
        title: "SCENE SWITCHER",
        body: "Jump between scenes without closing the board. Your entire episode timeline is one click away.",
        placement: "bottom",
        arrowSide: "left",
    },
    {
        targetId: "tour-sb-generate-all",
        title: "BATCH GENERATE",
        body: "Fire off AI generation for every shot in one go. Use STOP to halt mid-run if needed.",
        placement: "bottom",
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
        arrowSide: "left",
    },
    {
        targetId: "tour-sb-shot-card",
        title: "SHOT CARD",
        body: "Each card is one shot. Configure casting, prompts, choose your AI engine (SEEDREAM / GEMINI), then hit GENERATE. Drag to reorder.",
        placement: "right",
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
