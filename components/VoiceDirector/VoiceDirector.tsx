/**
 * VoiceDirector.tsx
 *
 * Main Voice AI Director component — replaces DirectorChat for Pro+ users.
 * Renders a floating mic orb (bottom-right) with push-to-talk voice interaction.
 *
 * Architecture:
 *   - Pro+ users → Voice Director (floating mic orb)
 *   - Free users → Voice Director (locked orb with upgrade prompt)
 *   - Fallback: If no mic access or WebSocket fails → toast error
 *
 * Mounted globally in layout.tsx, always visible (except on public pages).
 */

"use client";

import { useCallback, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "react-hot-toast";
import { useCredits } from "@/hooks/useCredits";
import { useVoiceDirector, VoiceAction } from "./useVoiceDirector";
import VoiceMicButton from "./VoiceMicButton";

// ── Helpers ──────────────────────────────────────────────────────

/**
 * Injects the one-time CSS keyframes for the visual click effect.
 * Called lazily on first use.
 */
let glowStyleInjected = false;
function injectGlowStyles() {
    if (glowStyleInjected) return;
    glowStyleInjected = true;
    const style = document.createElement("style");
    style.textContent = `
        @keyframes voiceDirectorGlow {
            0%   { box-shadow: 0 0 0 0 rgba(229,9,20,0.6), 0 0 15px rgba(229,9,20,0.3); transform: scale(1); }
            40%  { box-shadow: 0 0 0 8px rgba(229,9,20,0.15), 0 0 30px rgba(229,9,20,0.2); transform: scale(1.03); }
            100% { box-shadow: 0 0 0 0 rgba(229,9,20,0), 0 0 0 rgba(229,9,20,0); transform: scale(1); }
        }
        .voice-director-glow {
            animation: voiceDirectorGlow 0.8s ease-out !important;
            z-index: 9999 !important;
            position: relative;
        }
    `;
    document.head.appendChild(style);
}

/**
 * Visually "click" a DOM element — adds a glowing pulse ring, scrolls
 * into view, then triggers a real click. Returns true if element found.
 */
function simulateVisualClick(selector: string, delayMs = 400): Promise<boolean> {
    return new Promise((resolve) => {
        injectGlowStyles();
        const el = document.querySelector(selector) as HTMLElement | null;
        if (!el) {
            resolve(false);
            return;
        }

        // Scroll into view smoothly
        el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });

        // Add the glow effect
        el.classList.add("voice-director-glow");

        // After the glow settles, click it
        setTimeout(() => {
            el.click();
            // Remove glow class after animation completes
            setTimeout(() => el.classList.remove("voice-director-glow"), 800);
            resolve(true);
        }, delayMs);
    });
}

/**
 * Map a path like /project/CURRENT/storyboard → the matching data-nav-target value.
 * Falls back to null if no mapping exists.
 */
function mapPathToNavTarget(path: string): string | null {
    // Extract the last meaningful segment
    const normalised = path.replace(/\/$/, "").toLowerCase();

    if (normalised === "/project/new" || normalised.endsWith("/new")) return "new-project";
    if (normalised === "/dashboard") return "dashboard";
    if (normalised.endsWith("/preproduction")) return "preproduction";
    if (normalised.endsWith("/storyboard") || normalised.endsWith("/studio")) return "production";
    if (normalised.endsWith("/postprod")) return "postproduction";
    if (normalised.endsWith("/moodboard")) return "moodboard";
    if (normalised === "/playground") return "playground";
    if (normalised === "/explore") return "explore";

    return null;
}

/** Extract the real project ID from the current URL */
function extractProjectId(pathname: string): string | null {
    const match = pathname.match(/\/project\/([a-zA-Z0-9_-]{8,})/);
    if (!match) return null;
    const id = match[1];
    const reserved = ["new", "active", "current", "settings"];
    if (reserved.includes(id.toLowerCase())) return null;
    return id;
}

/** Get the last known project ID from URL or localStorage fallback */
function getCurrentProjectId(pathname: string): string | null {
    // Try URL first
    const fromUrl = extractProjectId(pathname);
    if (fromUrl) {
        // Cache it for fallback when on non-project pages (e.g., /project/new)
        try { localStorage.setItem("__mx_last_project_id", fromUrl); } catch {}
        return fromUrl;
    }
    // Fallback: check localStorage (set during project creation or last visit)
    try { return localStorage.getItem("__mx_last_project_id"); } catch { return null; }
}

/**
 * Resolve a path from the LLM — replace CURRENT placeholder or any
 * project ID segment with the real current project ID.
 */
function resolveProjectPath(path: string, currentId: string | null): string {
    if (!currentId) return path;
    const m = path.match(/^(\/project\/)([^/]+)(\/.*)?$/);
    if (!m) return path;
    const [, prefix, , rest = ""] = m;
    return `${prefix}${currentId}${rest}`;
}

/**
 * Append episode_id query param to project sub-pages that need it.
 */
function appendEpisodeId(path: string, episodeId: string | null): string {
    if (!episodeId) return path;
    // Only append for moodboard and storyboard pages
    if (path.includes("/moodboard") || path.includes("/storyboard") || path.includes("/episode")) {
        const separator = path.includes("?") ? "&" : "?";
        return `${path}${separator}episode_id=${episodeId}`;
    }
    return path;
}

// ── Throttle helper for tool call rate limiting ──────────────────
const ACTION_COOLDOWN_MS = 1500;

export default function VoiceDirector() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const router = useRouter();
    const { plan } = useCredits();

    // Public pages — don't render
    const isPublicPage =
        pathname === "/" ||
        pathname.startsWith("/onboarding") ||
        pathname.startsWith("/login");

    // Plan check
    const isVoiceEnabled =
        plan === "pro" || plan === "studio" || plan === "enterprise";

    // Ref to send feedback — filled after hook is called
    const sendContextRef = useRef<(ctx: string) => void>(() => {});
    const lastActionTimeRef = useRef(0);

    const sendFeedback = useCallback((message: string) => {
        if (typeof sendContextRef.current === "function") {
            sendContextRef.current(`[ACTION RESULT] ${message}`);
        } else {
            console.warn("[VoiceDirector] sendContext not ready, feedback dropped:", message);
        }
    }, []);

    // ── Action Handler ───────────────────────────────────────────────

    const handleAction = useCallback(
        (action: VoiceAction) => {
            // Rate limiting: prevent rapid-fire tool calls
            const now = Date.now();
            if (now - lastActionTimeRef.current < ACTION_COOLDOWN_MS) {
                console.warn("[VoiceDirector] Action throttled:", action.action);
                return;
            }
            lastActionTimeRef.current = now;

            const currentProjectId = getCurrentProjectId(pathname);
            const currentEpisodeId = searchParams.get("episode_id");

            try {
                switch (action.action) {
                    case "navigate_to_page": {
                        const rawPath = action.args.path as string;
                        const label = (action.args.label as string) || "page";
                        let path = resolveProjectPath(rawPath, currentProjectId);
                        path = appendEpisodeId(path, currentEpisodeId);

                        // Try to find and visually click a matching nav element
                        const navTarget = mapPathToNavTarget(rawPath);
                        if (navTarget) {
                            simulateVisualClick(`[data-nav-target="${navTarget}"]`).then((found) => {
                                if (!found) {
                                    // Fallback: no matching element on screen, use router
                                    router.push(path);
                                }
                                sendFeedback(`✅ Navigated to ${label}`);
                            });
                        } else {
                            // No nav mapping — direct router push
                            router.push(path);
                            sendFeedback(`✅ Navigated to ${label} (${path})`);
                        }
                        toast.success(`Opening ${label}...`, {
                            id: "voice-nav",
                            duration: 2000,
                        });
                        break;
                    }

                    case "create_project": {
                        const concept = action.args.concept as string;
                        const title = (action.args.title as string) || "";
                        const genre = (action.args.genre as string) || "";
                        const typeMap: Record<string, string> = {
                            movie: "film", film: "film",
                            series: "series", micro_drama: "series",
                            ad: "ad", commercial: "ad",
                            trailer: "trailer",
                        };
                        const rawType = (action.args.type as string) || "movie";
                        const format = typeMap[rawType.toLowerCase()] || "film";
                        const aspect_ratio = (action.args.aspect_ratio as string) || "16:9";
                        const runtime_seconds = (action.args.runtime_seconds as number) || 60;

                        toast.loading("🎬 Setting up your project...", {
                            id: "voice-create",
                        });

                        const payload = {
                            concept,
                            title: title || concept.split(/[.\n]/)[0].slice(0, 60).trim() || "Untitled Project",
                            genre: genre || "Drama",
                            format,
                            aspect_ratio,
                            runtime_seconds,
                        };

                        // Store creation payload for the /project/new page to pick up
                        try {
                            sessionStorage.setItem("__mx_voice_create", JSON.stringify(payload));
                        } catch {}

                        // If already on /project/new, dispatch event directly (router.push is a no-op for same page)
                        if (window.location.pathname === "/project/new") {
                            console.log("[VoiceDirector] Already on /project/new, dispatching voice-create-project event");
                            window.dispatchEvent(new CustomEvent("voice-create-project", { detail: payload }));
                        } else {
                            router.push("/project/new");
                        }

                        sendFeedback(
                            `✅ Navigating to project creation — I'll fill in the details visually. ` +
                            `Tell the user to watch the screen as the project is being set up.`
                        );
                        break;
                    }

                    case "navigate_to_scene": {
                        const sceneNum = action.args.scene_number as number;
                        // Step 1: Open the scene dropdown (visually)
                        const dropdownBtn = document.querySelector("#tour-sb-scene-selector button") as HTMLElement;
                        if (dropdownBtn) {
                            dropdownBtn.click();
                            // Step 2: After dropdown renders, click the target scene
                            setTimeout(async () => {
                                const clicked = await simulateVisualClick(`[data-scene-number="${sceneNum}"]`);
                                if (!clicked) {
                                    window.dispatchEvent(
                                        new CustomEvent("director-navigate-scene", {
                                            detail: { sceneNumber: sceneNum },
                                        })
                                    );
                                }
                            }, 300);
                        } else {
                            // No dropdown on screen — programmatic fallback
                            window.dispatchEvent(
                                new CustomEvent("director-navigate-scene", {
                                    detail: { sceneNumber: sceneNum },
                                })
                            );
                        }
                        toast.success(`Switching to Scene ${sceneNum}`, {
                            id: "voice-scene",
                            duration: 2000,
                        });
                        sendFeedback(`✅ Navigated to Scene ${sceneNum}`);
                        break;
                    }

                    case "open_panel": {
                        const panel = action.args.panel as string;
                        const panelNames: Record<string, string> = {
                            set_design: "Set Design",
                            wardrobe: "Wardrobe",
                            cinematography: "Scene Mood",
                            script: "Script",
                        };
                        // Wardrobe and cinematography are inside the "More" menu
                        const needsMoreMenu = ["wardrobe", "cinematography"].includes(panel);
                        if (needsMoreMenu) {
                            // Step 1: Open the More menu
                            const moreBtn = document.querySelector('[data-nav-target="more-menu"]') as HTMLElement;
                            if (moreBtn) {
                                moreBtn.click();
                                // Step 2: After menu renders, click the panel button
                                setTimeout(async () => {
                                    const clicked = await simulateVisualClick(`[data-panel-target="${panel}"]`);
                                    if (!clicked) {
                                        window.dispatchEvent(new CustomEvent("director-open-panel", { detail: { panel } }));
                                    }
                                }, 300);
                            } else {
                                window.dispatchEvent(new CustomEvent("director-open-panel", { detail: { panel } }));
                            }
                        } else {
                            // set_design / script — directly visible
                            simulateVisualClick(`[data-panel-target="${panel}"]`).then((found) => {
                                if (!found) {
                                    window.dispatchEvent(new CustomEvent("director-open-panel", { detail: { panel } }));
                                }
                            });
                        }
                        toast.success(
                            `Opening ${panelNames[panel] || panel}`,
                            { id: "voice-panel", duration: 2000 }
                        );
                        sendFeedback(`✅ Opened ${panelNames[panel] || panel} panel`);
                        break;
                    }

                    case "suggest_prompt": {
                        const prompt = action.args.prompt as string;
                        navigator.clipboard.writeText(prompt);

                        if (pathname.startsWith("/playground")) {
                            window.dispatchEvent(
                                new CustomEvent("director-paste-prompt", {
                                    detail: prompt,
                                })
                            );
                            toast.success("Prompt pasted!", {
                                id: "voice-prompt",
                                duration: 2000,
                            });
                            sendFeedback("✅ Prompt pasted into playground input");
                        } else {
                            toast.success("Prompt copied to clipboard!", {
                                id: "voice-prompt",
                                duration: 2000,
                            });
                            sendFeedback("✅ Prompt copied to clipboard. User can paste it into a shot.");
                        }
                        break;
                    }

                    case "edit_scene": {
                        const sceneNum = action.args.scene_number as number;
                        const edits: Record<string, any> = {};
                        if (action.args.header) edits.header = action.args.header;
                        if (action.args.time) edits.time = action.args.time;
                        if (action.args.action) edits.action = action.args.action;
                        if (action.args.rewrite_instruction) edits.rewrite_instruction = action.args.rewrite_instruction;
                        if (action.args.cast_updates) edits.cast_updates = action.args.cast_updates;

                        const isRewrite = !!edits.rewrite_instruction;
                        const changeDesc = edits.rewrite_instruction || edits.header || edits.time || "updated";
                        const toastId = `voice-edit-scene-${sceneNum}`;

                        // Show loading toast — stays until the action completes
                        toast.loading(
                            isRewrite
                                ? `✍️ Rewriting Scene ${sceneNum}...`
                                : `📝 Updating Scene ${sceneNum}...`,
                            { id: toastId }
                        );

                        // Emit processing state so the draft page can show per-scene spinners
                        window.dispatchEvent(
                            new CustomEvent("voice-scene-processing", {
                                detail: { sceneNumber: sceneNum, processing: true },
                            })
                        );

                        // Dispatch the actual edit — listen for completion
                        window.dispatchEvent(
                            new CustomEvent("director-edit-scene", {
                                detail: {
                                    sceneNumber: sceneNum,
                                    edits,
                                    onComplete: () => {
                                        toast.success(`✅ Scene ${sceneNum} updated!`, { id: toastId, duration: 3000 });
                                        window.dispatchEvent(
                                            new CustomEvent("voice-scene-processing", {
                                                detail: { sceneNumber: sceneNum, processing: false },
                                            })
                                        );
                                    },
                                    onError: (msg: string) => {
                                        toast.error(`❌ Scene ${sceneNum}: ${msg}`, { id: toastId, duration: 4000 });
                                        window.dispatchEvent(
                                            new CustomEvent("voice-scene-processing", {
                                                detail: { sceneNumber: sceneNum, processing: false },
                                            })
                                        );
                                    },
                                },
                            })
                        );

                        sendFeedback(`✅ Applied edit to Scene ${sceneNum}: ${changeDesc}`);
                        break;
                    }

                    case "select_moodboard": {
                        const moodIndex = action.args.mood_index as number | undefined;
                        const moodName = action.args.mood_name as string | undefined;
                        const confirm = action.args.confirm as boolean | undefined;
                        window.dispatchEvent(
                            new CustomEvent("director-select-moodboard", {
                                detail: { moodIndex, moodName, confirm: confirm || false },
                            })
                        );
                        if (confirm) {
                            toast.loading("🎨 Applying visual mood...", { id: "voice-mood" });
                            setTimeout(() => toast.success("✅ Mood applied!", { id: "voice-mood", duration: 3000 }), 4000);
                        } else {
                            toast.success("🎨 Mood selected for preview", { id: "voice-mood", duration: 2000 });
                        }
                        sendFeedback(confirm ? "✅ Mood applied" : "✅ Mood selected for preview");
                        break;
                    }

                    case "edit_shot": {
                        const shotNum = action.args.shot_number as number;
                        const shotEdits: Record<string, any> = {};
                        if (action.args.prompt) shotEdits.prompt = action.args.prompt;
                        if (action.args.shot_type) shotEdits.shot_type = action.args.shot_type;
                        window.dispatchEvent(
                            new CustomEvent("director-edit-shot", {
                                detail: { shotNumber: shotNum, edits: shotEdits },
                            })
                        );
                        toast.success(`Editing Shot ${shotNum}...`, {
                            id: "voice-shot-edit",
                            duration: 2000,
                        });
                        sendFeedback(`✅ Updated Shot ${shotNum}`);
                        break;
                    }

                    case "generate_shot": {
                        const genShotNum = action.args.shot_number as number | undefined;
                        const genType = (action.args.type as string) || "image";
                        if (genType === "all" || !genShotNum || genShotNum === 0) {
                            // Click the GENERATE SCENE button
                            simulateVisualClick('button[style*="GENERATE"]').then((found) => {
                                if (!found) {
                                    window.dispatchEvent(
                                        new CustomEvent("director-generate-shot", {
                                            detail: { shotNumber: 0, type: "all" },
                                        })
                                    );
                                }
                            });
                            toast.loading("🎬 Generating all shots...", {
                                id: "voice-gen",
                            });
                        } else {
                            window.dispatchEvent(
                                new CustomEvent("director-generate-shot", {
                                    detail: { shotNumber: genShotNum, type: genType },
                                })
                            );
                            toast.loading(
                                `${genType === "video" ? "🎥 Animating" : "🖼️ Generating"} Shot ${genShotNum}...`,
                                { id: "voice-gen" }
                            );
                        }
                        sendFeedback(`✅ ${genType === "video" ? "Animation" : "Generation"} triggered`);
                        break;
                    }

                    case "open_node": {
                        const nodeType = action.args.node_type as string;
                        const nodeTitle = action.args.node_title as string | undefined;
                        const sceneNumber = action.args.scene_number as number | undefined;

                        let selector = "";
                        if (sceneNumber) {
                            selector = `[data-node-scene-number="${sceneNumber}"]`;
                        } else if (nodeTitle) {
                            // Try exact title match first, then partial
                            selector = `[data-node-type="${nodeType}"][data-node-title="${nodeTitle}"]`;
                        } else {
                            // Just find the first node of this type
                            selector = `[data-node-type="${nodeType}"]`;
                        }

                        simulateVisualClick(selector).then(async (found) => {
                            if (!found && nodeTitle) {
                                // Partial match fallback: find any node whose title contains the search
                                const allNodes = document.querySelectorAll(`[data-node-type="${nodeType}"]`);
                                for (const el of allNodes) {
                                    const title = (el as HTMLElement).dataset.nodeTitle || "";
                                    if (title.toLowerCase().includes(nodeTitle.toLowerCase())) {
                                        await simulateVisualClick(`[data-node-id="${(el as HTMLElement).dataset.nodeId}"]`);
                                        return;
                                    }
                                }
                                // No visual match — dispatch event for programmatic handling
                                window.dispatchEvent(
                                    new CustomEvent("director-open-node", {
                                        detail: { nodeType, nodeTitle, sceneNumber },
                                    })
                                );
                            }
                        });
                        toast.success(`Opening ${nodeTitle || nodeType}...`, {
                            id: "voice-node",
                            duration: 2000,
                        });
                        sendFeedback(`✅ Opened ${nodeTitle || nodeType} node`);
                        break;
                    }

                    case "navigate_to_shot": {
                        const navShotNum = action.args.shot_number as number;
                        // Scroll to the shot card and highlight it
                        const shotEl = document.querySelector(`[data-shot-index="${navShotNum}"]`) as HTMLElement;
                        if (shotEl) {
                            shotEl.scrollIntoView({ behavior: "smooth", block: "center" });
                            simulateVisualClick(`[data-shot-index="${navShotNum}"]`);
                        }
                        toast.success(`Shot ${navShotNum}`, {
                            id: "voice-shot-nav",
                            duration: 1500,
                        });
                        sendFeedback(`✅ Scrolled to Shot ${navShotNum}`);
                        break;
                    }

                    case "generate_asset": {
                        const assetType = action.args.asset_type as string;
                        const assetName = action.args.asset_name as string | undefined;
                        const genAll = action.args.all as boolean | undefined;
                        window.dispatchEvent(
                            new CustomEvent("director-generate-asset", {
                                detail: { assetType, assetName, all: genAll || !assetName },
                            })
                        );
                        const label = genAll || !assetName
                            ? `all ${assetType}s`
                            : assetName;
                        toast.loading(`🎨 Generating ${label}...`, {
                            id: "voice-gen-asset",
                        });
                        sendFeedback(`✅ Triggered ${assetType} generation for ${label}`);
                        break;
                    }

                    default:
                        sendFeedback(`⚠️ Unknown action: ${action.action}`);
                        break;
                }
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : "Action failed";
                toast.error(msg, { id: "voice-error", duration: 4000 });
                sendFeedback(`❌ Action "${action.action}" FAILED: ${msg}. Inform the user.`);
            }
        },
        [router, pathname, searchParams, sendFeedback]
    );

    // ── Error Handler ────────────────────────────────────────────────

    const handleError = useCallback((message: string) => {
        toast.error(message, { id: "voice-error", duration: 4000 });
    }, []);

    // ── Upgrade Handler ──────────────────────────────────────────────

    const handleUpgradeClick = useCallback(() => {
        toast(
            "Voice Director is a Pro feature. Upgrade your plan to unlock voice interaction.",
            {
                id: "voice-upgrade",
                duration: 4000,
                icon: "🎙️",
                style: {
                    borderLeft: "3px solid #E50914",
                },
            }
        );
    }, []);

    // ── Voice Director Hook ──────────────────────────────────────────

    const voice = useVoiceDirector({
        onAction: handleAction,
        onError: handleError,
    });

    // Wire up the feedback ref — use direct assignment, not useEffect,
    // to ensure it's available before any action handler fires
    sendContextRef.current = voice.sendContext;

    if (isPublicPage) return null;

    return (
        <VoiceMicButton
            state={voice.state}
            assistantText={voice.assistantText}
            userText={voice.userText}
            errorMessage={voice.errorMessage}
            isLocked={!isVoiceEnabled}
            onConnect={voice.connect}
            onDisconnect={voice.disconnect}
            onStartTalking={voice.startTalking}
            onStopTalking={voice.stopTalking}
            onUpgradeClick={handleUpgradeClick}
        />
    );
}
