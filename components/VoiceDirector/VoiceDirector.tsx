/**
 * VoiceDirector.tsx
 *
 * Main AI Director component — side panel with voice + text chat.
 * Renders a toggle button (bottom-right) that opens a slide-out panel.
 *
 * Architecture:
 *   - Pro+ users → Full panel with voice + text chat
 *   - Free users → Locked toggle with upgrade prompt
 *   - Fallback: If no mic access or WebSocket fails → text-only mode
 *
 * Mounted globally in layout.tsx, always visible (except on public pages).
 */

"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "react-hot-toast";
import { useCredits } from "@/hooks/useCredits";
import { useVoiceDirector, VoiceAction } from "./useVoiceDirector";
import DirectorPanel, { type ChatMessage } from "./DirectorPanel";
import DirectorToggle from "./DirectorToggle";

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
            0%   { box-shadow: 0 0 0 0 rgba(212,10,18,0.6), 0 0 15px rgba(212,10,18,0.3); transform: scale(1); }
            40%  { box-shadow: 0 0 0 8px rgba(212,10,18,0.15), 0 0 30px rgba(212,10,18,0.2); transform: scale(1.03); }
            100% { box-shadow: 0 0 0 0 rgba(212,10,18,0), 0 0 0 rgba(212,10,18,0); transform: scale(1); }
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
 * Scrape the current UI state after an action, giving the AI "vision".
 * Detects open modals, form fields, available buttons, and loading states.
 * Returns a structured text description the model can use to decide next steps.
 */
function scrapeCurrentUI(): string {
    const parts: string[] = [];

    // ── 0. Current page detection ──
    const path = window.location.pathname;
    parts.push(`📍 PAGE: ${path}`);

    // ── 1. Detect open modals/dialogs ──
    const modals = document.querySelectorAll(
        '[role="dialog"], [data-agent-modal], [data-state="open"][role="dialog"]'
    );

    if (modals.length > 0) {
        for (const modal of modals) {
            const htmlModal = modal as HTMLElement;
            const modalType = htmlModal.dataset.agentModal || "dialog";
            const modalTitle = htmlModal.dataset.agentModalTitle || "";
            const heading = modal.querySelector('h1, h2, h3, [class*="title"]');
            const headingText = heading?.textContent?.trim() || modalTitle || "Dialog";

            parts.push(`\n📋 MODAL OPEN: "${headingText}" (${modalType})`);

            // Scrape visible form fields
            const inputs = modal.querySelectorAll('input:not([type="hidden"]), textarea, select');
            const fieldParts: string[] = [];
            for (const input of inputs) {
                const htmlInput = input as HTMLInputElement;
                // Try to find associated label
                const label = htmlInput.placeholder ||
                    htmlInput.closest('[class*="field"]')?.querySelector('label, [class*="label"]')?.textContent?.trim() ||
                    htmlInput.getAttribute('aria-label') ||
                    htmlInput.name || "";
                const value = htmlInput.value?.slice(0, 80) || "";
                if (label || value) {
                    fieldParts.push(`  ${label}: ${value || "(empty)"}`);
                }
            }
            if (fieldParts.length > 0) {
                parts.push("  FIELDS:");
                parts.push(...fieldParts.slice(0, 10)); // Cap at 10 fields
            }

            // Scrape buttons in the modal
            const buttons = modal.querySelectorAll('button, [role="button"]');
            const btnParts: string[] = [];
            for (const btn of buttons) {
                const htmlBtn = btn as HTMLElement;
                const text = htmlBtn.textContent?.trim().slice(0, 40);
                if (!text || text.length < 2) continue;
                const agent = htmlBtn.dataset.agent;
                const disabled = htmlBtn.hasAttribute("disabled");
                const selector = agent ? `[data-agent='${agent}']` : "";
                const status = disabled ? " (disabled)" : "";
                btnParts.push(`  ${disabled ? "⊘" : "🎯"} ${selector ? `${selector} ` : ""}${text}${status}`);
            }
            if (btnParts.length > 0) {
                parts.push("  ACTIONS:");
                parts.push(...btnParts);
            }
        }
    } else {
        // ── 2. No modal — scrape page-level actions ──
        const agents = document.querySelectorAll("[data-agent]");
        if (agents.length > 0) {
            parts.push("\n🎯 AVAILABLE ACTIONS:");
            for (const el of agents) {
                const htmlEl = el as HTMLElement;
                const agent = htmlEl.dataset.agent || "";
                const text = htmlEl.textContent?.trim().slice(0, 40) || "";
                const disabled = htmlEl.hasAttribute("disabled");
                if (text.length < 2) continue;
                parts.push(`  ${disabled ? "⊘" : "•"} [data-agent='${agent}'] ${text}${disabled ? " (disabled)" : ""}`);
            }
        }
    }

    // ── 3. Detect loading/processing states ──
    const spinners = document.querySelectorAll('.animate-spin, [aria-busy="true"]');
    if (spinners.length > 0) {
        parts.push("\n⏳ LOADING: A process is in progress...");
    }

    // ── 4. Detect canvas cards (preproduction) ──
    const nodeCards = document.querySelectorAll("[data-node-type]");
    if (nodeCards.length > 0 && modals.length === 0) {
        const cardSummary: string[] = [];
        for (const card of nodeCards) {
            const htmlCard = card as HTMLElement;
            const type = htmlCard.dataset.nodeType || "";
            const title = htmlCard.dataset.nodeTitle || "";
            if (title) cardSummary.push(`${type}:${title}`);
        }
        if (cardSummary.length > 0) {
            parts.push(`\n📇 CANVAS CARDS: ${cardSummary.join(", ")}`);
        }
    }

    // ── 5. Detect shot cards (storyboard) ──
    const shotCards = document.querySelectorAll("[data-shot-index]");
    if (shotCards.length > 0 && modals.length === 0) {
        const shotSummary: string[] = [];
        for (const shot of shotCards) {
            const htmlShot = shot as HTMLElement;
            const idx = htmlShot.dataset.shotIndex || "?";
            const status = htmlShot.dataset.shotStatus || "unknown";
            const hasImage = htmlShot.dataset.shotHasImage === "true";
            const hasVideo = htmlShot.dataset.shotHasVideo === "true";
            const prompt = htmlShot.dataset.shotPrompt || "";
            shotSummary.push(`Shot ${idx}: ${status}${hasImage ? " 🖼️" : ""}${hasVideo ? " 🎬" : ""}${prompt ? ` "${prompt.slice(0, 50)}..."` : ""}`);
        }
        if (shotSummary.length > 0) {
            parts.push(`\n🎬 SHOTS (${shotCards.length} total):`);
            parts.push(...shotSummary.slice(0, 15)); // Cap at 15 shots
        }
    } else if (path.includes("/storyboard") && shotCards.length === 0 && modals.length === 0) {
        // Storyboard page with NO shots — important context!
        parts.push("\n⚠️ STORYBOARD IS EMPTY — no shots exist yet. User should Auto-Direct to generate shots.");
    }

    // ── 6. Detect empty states ──
    const emptyStates = document.querySelectorAll('[class*="empty"], [class*="Empty"]');
    for (const el of emptyStates) {
        const text = (el as HTMLElement).textContent?.trim().slice(0, 80);
        if (text && text.length > 5) {
            parts.push(`\n📭 EMPTY STATE: "${text}"`);
            break; // Only show first empty state
        }
    }

    // ── 7. Scene context (if scene selector visible) ──
    const sceneSelector = document.querySelector("[data-agent='scene-selector']");
    if (sceneSelector) {
        const sceneText = (sceneSelector as HTMLElement).textContent?.trim().slice(0, 60);
        if (sceneText) parts.push(`\n🎬 ACTIVE SCENE: ${sceneText}`);
    }

    return parts.join("\n");
}

/**
 * Wait for UI to settle after an action, then scrape the updated state.
 * Waits up to maxWaitMs for the DOM to change (modal appear, etc.)
 */
async function scrapeAfterAction(delayMs = 600): Promise<string> {
    await new Promise(r => setTimeout(r, delayMs));
    return scrapeCurrentUI();
}

/**
 * Find a DOM element by CSS selector, with text-based fallback.
 * Supports: data-agent selectors, standard CSS, and "button:has-text('...')" pseudo.
 */
function findElement(selector: string): HTMLElement | null {

    // ── 1. Handle custom "has-text" pseudo (with or without tag prefix) ──
    const textMatch = selector.match(/^(\w+)?:?has-text\(\s*['"](.+)['"]\s*\)$/i);
    if (textMatch) {
        const [, tag, text] = textMatch;
        const searchTag = tag || "*";
        const elements = document.querySelectorAll(searchTag);
        for (const el of elements) {
            if ((el as HTMLElement).textContent?.trim().toLowerCase().includes(text.toLowerCase())) {
                return el as HTMLElement;
            }
        }
    }

    // ── 2. Standard CSS selector (wrapped in try/catch for invalid selectors) ──
    try {
        const el = document.querySelector(selector) as HTMLElement | null;
        if (el) {
            return el;
        }
    } catch (e) {
    }

    // ── 3. data-node-title case-insensitive matching ──
    const nodeTitleMatch = selector.match(/data-node-title=['"]([^'"]+)['"]/i);
    if (nodeTitleMatch) {
        const targetTitle = nodeTitleMatch[1].replace(/[_-]/g, " ").toLowerCase().trim();
        const nodeTypeMatch = selector.match(/data-node-type=['"]([^'"]+)['"]/i);
        const nodeType = nodeTypeMatch ? nodeTypeMatch[1].toLowerCase() : null;

        const candidates = nodeType
            ? document.querySelectorAll(`[data-node-type='${nodeType}']`)
            : document.querySelectorAll("[data-node-title]");

        for (const node of candidates) {
            const domTitle = ((node as HTMLElement).dataset.nodeTitle || "").replace(/[_-]/g, " ").toLowerCase().trim();
            if (domTitle === targetTitle || domTitle.includes(targetTitle) || targetTitle.includes(domTitle)) {
                return node as HTMLElement;
            }
        }
    }

    // ── 4. data-agent partial matching ──
    if (selector.startsWith("[data-agent")) {
        const valueMatch = selector.match(/data-agent=['"]([^'"]+)['"]/);
        if (valueMatch) {
            const agentValue = valueMatch[1];
            const exact = document.querySelector(`[data-agent="${agentValue}"]`) as HTMLElement;
            if (exact) {
                return exact;
            }
            const all = document.querySelectorAll("[data-agent]");
            for (const node of all) {
                const val = (node as HTMLElement).dataset.agent || "";
                if (val.includes(agentValue) || agentValue.includes(val)) {
                    return node as HTMLElement;
                }
            }
        }
    }

    // ── 5. Text-based fallback: search visible interactive elements ──
    const selectorText = selector
        .replace(/^.*has-text\(\s*['"]?/i, "")
        .replace(/['"]?\s*\).*$/, "")
        .replace(/\[data-[a-z-]+=['"]?([^'"\]]+)['"]?\]/gi, "$1")
        .replace(/[-_]/g, " ")
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .filter(w => !["data", "node", "type", "agent", "character", "location", "scene", "product"].includes(w))
        .join(" ");


    if (selectorText && selectorText.length > 2) {
        const nodeEls = document.querySelectorAll("[data-node-title]");
        for (const node of nodeEls) {
            const title = ((node as HTMLElement).dataset.nodeTitle || "").replace(/[-_]/g, " ").toLowerCase();
            if (title && (title.includes(selectorText) || selectorText.includes(title))) {
                return node as HTMLElement;
            }
        }

        const agentEls = document.querySelectorAll("[data-agent]");
        for (const node of agentEls) {
            const htmlEl = node as HTMLElement;
            const agentVal = (htmlEl.dataset.agent || "").replace(/[-_]/g, " ").toLowerCase();
            const text = htmlEl.textContent?.trim().toLowerCase() || "";
            if (agentVal.includes(selectorText) || selectorText.includes(agentVal) ||
                text.includes(selectorText) || selectorText.includes(text)) {
                return htmlEl;
            }
        }

        const interactives = document.querySelectorAll("button, a, [role='button'], input[type='submit']");
        for (const node of interactives) {
            const text = (node as HTMLElement).textContent?.trim().toLowerCase() || "";
            if (text && (text.includes(selectorText) || selectorText.includes(text))) {
                return node as HTMLElement;
            }
        }

        // Step 5d: Word-level fuzzy match — "generate asset" should match "generate ai"
        const selectorWords = selectorText.split(/\s+/).filter(w => w.length > 2);
        if (selectorWords.length > 0) {
            for (const node of interactives) {
                const text = (node as HTMLElement).textContent?.trim().toLowerCase() || "";
                const matchCount = selectorWords.filter(w => text.includes(w)).length;
                if (matchCount >= Math.ceil(selectorWords.length * 0.5) && text.length < 50) {
                    return node as HTMLElement;
                }
            }
        }
    }

    // ── 6. Modal-aware: look for buttons inside open modals ───────────
    const modal = document.querySelector('[role="dialog"], [data-agent-modal]') as HTMLElement;
    if (modal) {
        const modalBtns = modal.querySelectorAll("button");
        for (const btn of modalBtns) {
            const btnText = btn.textContent?.trim().toLowerCase() || "";
            // Match common agent action keywords to button text
            if (selector.includes("generate") && (btnText.includes("generate") || btnText.includes("generating"))) {
                return btn as HTMLElement;
            }
            if (selector.includes("save") && btnText.includes("save")) {
                return btn as HTMLElement;
            }
            if (selector.includes("close") && (btnText.includes("×") || btnText.includes("close") || btn.querySelector("svg"))) {
                return btn as HTMLElement;
            }
        }
    }

    return null;
}

/**
 * Visually "click" a DOM element — adds a glowing pulse ring, scrolls
 * into view, then triggers a real click. Returns true if element found.
 *
 * For CanvasNode elements (which use pointerdown→pointerup instead of click),
 * dispatches a proper pointer event sequence so onEdit() fires correctly.
 */
function simulateVisualClick(selector: string, delayMs = 600): Promise<boolean> {
    return new Promise((resolve) => {
        injectGlowStyles();
        const el = findElement(selector);
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
            // Check if this is a CanvasNode (uses pointer events, not click)
            const isCanvasNode = el.hasAttribute("data-node-type");
            if (isCanvasNode) {
                // CanvasNode needs pointerdown → pointerup to trigger onEdit
                const rect = el.getBoundingClientRect();
                const cx = rect.left + rect.width / 2;
                const cy = rect.top + rect.height / 2;
                const pointerOpts = {
                    bubbles: true,
                    cancelable: true,
                    clientX: cx,
                    clientY: cy,
                    pointerId: 1,
                    pointerType: "mouse" as const,
                };
                el.dispatchEvent(new PointerEvent("pointerdown", pointerOpts));
                // Small delay to simulate real tap, then pointerup (no movement = click)
                setTimeout(() => {
                    el.dispatchEvent(new PointerEvent("pointerup", pointerOpts));
                }, 50);
            } else {
                el.click();
            }
            // Remove glow class after animation completes
            setTimeout(() => el.classList.remove("voice-director-glow"), 800);
            resolve(true);
        }, delayMs);
    });
}

/**
 * Visually type text into an input/textarea with animated effect.
 */
async function simulateTyping(
    selector: string,
    text: string,
    clearFirst: boolean = true
): Promise<boolean> {
    injectGlowStyles();
    const el = findElement(selector) as HTMLInputElement | HTMLTextAreaElement | null;
    if (!el) return false;

    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.focus();
    el.classList.add("voice-director-glow");

    // Ensure it's an input or textarea
    if (el.tagName !== "INPUT" && el.tagName !== "TEXTAREA") {
        console.warn(`[VoiceDirector] simulateTyping: Element is a ${el.tagName}, not an input. Selector was: ${selector}`);
        setTimeout(() => el.classList.remove("voice-director-glow"), 600);
        return false;
    }

    if (clearFirst) {
        try {
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype,
                "value"
            )?.set;
            nativeInputValueSetter?.call(el, "");
        } catch (e) {
            el.value = "";
        }
        el.dispatchEvent(new Event("input", { bubbles: true }));
    }

    // Type character by character for visual effect
    for (let i = 0; i < text.length; i++) {
        const partial = text.slice(0, i + 1);
        try {
            const nativeSetter = Object.getOwnPropertyDescriptor(
                el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype,
                "value"
            )?.set;
            nativeSetter?.call(el, partial);
        } catch (e) {
            el.value = partial;
        }
        el.dispatchEvent(new Event("input", { bubbles: true }));
        // Speed: fast for long text, visible for short
        await new Promise((r) => setTimeout(r, text.length > 50 ? 10 : 30));
    }

    // Dispatch change event
    el.dispatchEvent(new Event("change", { bubbles: true }));
    setTimeout(() => el.classList.remove("voice-director-glow"), 600);
    return true;
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
const ACTION_COOLDOWN_MS = 300;

// ── Unique ID generator for messages ──────────────────────────────
let _msgId = 0;
const nextMsgId = () => `msg_${Date.now()}_${++_msgId}`;

export default function VoiceDirector() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const router = useRouter();
    const { plan, isEnterprise } = useCredits();

    // Panel open/close state (open by default)
    const [isPanelOpen, setIsPanelOpen] = useState(true);
    const [hasUnread, setHasUnread] = useState(false);

    // Message history
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    
    // Voice Selection
    const [selectedVoice, setSelectedVoice] = useState("coral");

    // Public pages — don't render
    const isPublicPage =
        pathname === "/" ||
        pathname.startsWith("/onboarding") ||
        pathname.startsWith("/login") ||
        pathname.startsWith("/share");

    // Plan check
    const isVoiceEnabled =
        isEnterprise || plan === "pro" || plan === "studio" || plan === "enterprise";

    // Refs to send feedback — filled after hook is called
    const sendContextRef = useRef<(ctx: string) => void>(() => {});
    const sendActionResultRef = useRef<(success: boolean, message: string) => void>(() => {});
    const sendTextRef = useRef<(text: string) => void>(() => {});
    const lastActionTimeRef = useRef(0);
    const lastAssistantTextRef = useRef("");
    const [isAgentBusy, setIsAgentBusy] = useState(false);
    const stopAgentRef = useRef(false);

    /** Send real tool execution result back to Gemini agent + show in chat */
    const sendFeedback = useCallback((message: string, success = true) => {
        // Send FULL message (including UI scrape) to backend for Gemini
        if (typeof sendActionResultRef.current === "function") {
            sendActionResultRef.current(success, message);
        }
        // Show only the SHORT summary in chat (first line, before UI scrape)
        const chatText = message.split("\n")[0];
        setMessages((prev) => [
            ...prev,
            {
                id: nextMsgId(),
                role: "action" as const,
                text: chatText,
                timestamp: Date.now(),
                actionStatus: success ? "success" : "error",
            },
        ]);
    }, []);

    // ── Action Handler ───────────────────────────────────────────────

    const handleStopAgent = useCallback(() => {
        stopAgentRef.current = true;
        setIsAgentBusy(false);
        setMessages((prev) => [
            ...prev,
            {
                id: nextMsgId(),
                role: "action" as const,
                text: "⏹️ Agent stopped by user",
                timestamp: Date.now(),
                actionStatus: "error",
            },
        ]);
        // Send stop signal to backend
        sendFeedback("🛑 AGENT STOPPED BY USER. Do not continue with further actions. Acknowledge the stop.", false);
    }, [sendFeedback]);

    const handleAction = useCallback(
        async (action: VoiceAction) => {
            // Check if agent was stopped
            if (stopAgentRef.current) {
                console.warn("[VoiceDirector] Agent stopped, ignoring action:", action.action);
                return;
            }

            // Rate limiting: prevent rapid-fire UI tool calls
            // But skip cooldown for backend-only/informational actions
            const skipCooldown = ["agent_progress", "think", "check_project_status", "get_scene_shots", "edit_shot", "refresh_page"].includes(action.action);
            const now = Date.now();
            if (!skipCooldown && now - lastActionTimeRef.current < ACTION_COOLDOWN_MS) {
                console.warn("[VoiceDirector] Action throttled:", action.action);
                return;
            }
            if (!skipCooldown) lastActionTimeRef.current = now;

            // Mark agent as busy
            setIsAgentBusy(true);
            stopAgentRef.current = false;

            const currentProjectId = getCurrentProjectId(pathname);
            const currentEpisodeId = searchParams.get("episode_id");

            try {
                switch (action.action) {
                    // ── Agent Progress (intermediate status during long chains) ──
                    case "agent_progress": {
                        const progressMsg = (action.args.message as string) || "Working...";
                        setMessages((prev) => [
                            ...prev,
                            {
                                id: nextMsgId(),
                                role: "action" as const,
                                text: progressMsg,
                                timestamp: Date.now(),
                                actionStatus: "pending",
                            },
                        ]);
                        // No feedback needed — this is informational only
                        return;
                    }

                    // ── Thinking/Planning Tool ─────────────────────────
                    case "think": {
                        const reasoning = action.args.reasoning as string;
                        setMessages((prev) => [
                            ...prev,
                            {
                                id: nextMsgId(),
                                role: "action" as const,
                                text: `🧠 ${reasoning}`,
                                timestamp: Date.now(),
                                actionStatus: "pending",
                            },
                        ]);
                        // Do NOT send feedback — the backend think tool doesn't wait for it
                        // Sending feedback here causes a race condition where click_element
                        // consumes this stale feedback instead of the real click result
                        break;
                    }

                    case "check_project_status": {
                        const desc = (action.args.description as string) || "Checking project status...";
                        setMessages((prev) => [
                            ...prev,
                            {
                                id: nextMsgId(),
                                role: "action" as const,
                                text: `📊 ${desc}`,
                                timestamp: Date.now(),
                                actionStatus: "pending",
                            },
                        ]);
                        // No feedback — backend handles this server-side
                        break;
                    }

                    // ── UI-Level Tools ─────────────────────────────────
                    case "click_element": {
                        const selector = action.args.selector as string;
                        const desc = (action.args.description as string) || selector;
                        
                        // Add action status to chat
                        setMessages((prev) => [
                            ...prev,
                            {
                                id: nextMsgId(),
                                role: "action" as const,
                                text: `🖱️ Clicking: ${desc}`,
                                timestamp: Date.now(),
                                actionStatus: "pending",
                            },
                        ]);

                        const found = await simulateVisualClick(selector);
                        if (found) {
                            // Wait for UI to settle (modals open, dropdowns render)
                            const uiState = await scrapeAfterAction(700);
                            sendFeedback(`✅ Clicked: ${desc}\n${uiState}`);
                        } else {
                            // ── RETRY: Wait 500ms and try once more (handles HMR lag, modal animations) ──
                            await new Promise((r) => setTimeout(r, 500));
                            const retryFound = await simulateVisualClick(selector);
                            if (retryFound) {
                                const uiState = await scrapeAfterAction(700);
                                sendFeedback(`✅ Clicked (retry): ${desc}\n${uiState}`);
                            } else {
                                sendFeedback(`❌ Could not find: ${desc} (selector: ${selector}). The element may not be on the current page.\n${scrapeCurrentUI()}`, false);
                            }
                        }
                        break;
                    }

                    case "type_text": {
                        const selector = action.args.selector as string;
                        const text = action.args.text as string;
                        const clearFirst = action.args.clear_first !== false;
                        const desc = (action.args.description as string) || `Typing into ${selector}`;
                        
                        setMessages((prev) => [
                            ...prev,
                            {
                                id: nextMsgId(),
                                role: "action" as const,
                                text: `⌨️ ${desc}`,
                                timestamp: Date.now(),
                                actionStatus: "pending",
                            },
                        ]);

                        const typed = await simulateTyping(selector, text, clearFirst);
                        if (typed) {
                            const uiState = await scrapeAfterAction(300);
                            sendFeedback(`✅ Typed: "${text.slice(0, 50)}${text.length > 50 ? '...' : ''}"\n${uiState}`);
                        } else {
                            sendFeedback(`❌ Could not find input: ${selector}\n${scrapeCurrentUI()}`, false);
                        }
                        break;
                    }

                    case "scroll_to_element": {
                        const selector = action.args.selector as string;
                        const desc = (action.args.description as string) || selector;
                        
                        const el = findElement(selector);
                        if (el) {
                            el.scrollIntoView({ behavior: "smooth", block: "center" });
                            el.classList.add("voice-director-glow");
                            setTimeout(() => el.classList.remove("voice-director-glow"), 1500);
                            const uiState = await scrapeAfterAction(300);
                            sendFeedback(`✅ Scrolled to: ${desc}\n${uiState}`);
                        } else {
                            sendFeedback(`❌ Could not find: ${desc}\n${scrapeCurrentUI()}`, false);
                        }
                        break;
                    }

                    // ── Existing handlers ─────────────────────────────
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

                    case "refresh_page": {
                        // Agent wrote to Firestore directly — refresh to show updates
                        const reason = (action.args.reason as string) || "Data updated";
                        console.log(`🔄 Agent requested page refresh: ${reason}`);
                        router.refresh();
                        sendFeedback(`✅ Page refreshed: ${reason}`);
                        break;
                    }

                    default:
                        sendFeedback(`⚠️ Unknown action: ${action.action}`);
                        break;
                }
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : "Action failed";
                toast.error(msg, { id: "voice-error", duration: 4000 });
                sendFeedback(`Action "${action.action}" FAILED: ${msg}. Inform the user.`, false);
            } finally {
                setIsAgentBusy(false);
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
                    borderLeft: "3px solid #D40A12",
                },
            }
        );
    }, []);

    // ── Voice Director Hook ──────────────────────────────────────────

    const voice = useVoiceDirector({
        onAction: handleAction,
        onError: handleError,
        onTranscript: useCallback((entry: { role: string; text: string; timestamp: number }) => {
            if (entry.role === "assistant" && entry.text) {
                setMessages((prev) => [
                    // Remove pending progress indicators but KEEP 🧠 thinking messages
                    ...prev.filter((m) => {
                        if (m.role !== "action" || m.actionStatus !== "pending") return true;
                        // Keep thinking messages — they show the agent's reasoning
                        if (m.text.startsWith("🧠")) return true;
                        return false;
                    }),
                    {
                        id: nextMsgId(),
                        role: "assistant" as const,
                        text: entry.text,
                        timestamp: entry.timestamp,
                    },
                ]);
                if (!isPanelOpen) setHasUnread(true);
            }
        }, [isPanelOpen]),
    });

    // Wire up the feedback refs
    sendContextRef.current = voice.sendContext;
    sendActionResultRef.current = voice.sendActionResult;
    sendTextRef.current = voice.sendTextMessage;

    // Keep a live ref to voice.state so polling closures can read it
    const voiceStateRef = useRef(voice.state);
    voiceStateRef.current = voice.state;

    // ── Track assistant responses and add to message history ──
    useEffect(() => {
        // When assistantText changes and we have new text, capture it
        if (voice.assistantText && voice.assistantText !== lastAssistantTextRef.current) {
            lastAssistantTextRef.current = voice.assistantText;
        }
    }, [voice.assistantText]);

    // When response finishes — assistant text is committed via onTranscript callback above

    // Track user speech transcripts
    useEffect(() => {
        if (voice.userText) {
            // Only add if it's not already the last user message
            setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "user" && last.text === voice.userText) return prev;
                return [
                    ...prev,
                    {
                        id: nextMsgId(),
                        role: "user",
                        text: voice.userText,
                        timestamp: Date.now(),
                    },
                ];
            });
        }
    }, [voice.userText]);

    // ── Text send handler ──
    const handleSendText = useCallback(
        (text: string) => {
            // Add user message to history
            setMessages((prev) => [
                ...prev,
                {
                    id: nextMsgId(),
                    role: "user",
                    text,
                    timestamp: Date.now(),
                },
            ]);
            // Auto-connect if not connected
            if (!voice.isConnected) {
                voice.connect(selectedVoice);
                // Poll until the WebSocket session is actually ready, then send
                const interval = setInterval(() => {
                    if (
                        voiceStateRef.current === "ready" &&
                        sendTextRef.current
                    ) {
                        sendTextRef.current(text);
                        clearInterval(interval);
                    }
                }, 300);
                // Safety: stop polling after 10s
                setTimeout(() => clearInterval(interval), 10000);
            } else {
                voice.sendTextMessage(text);
            }
        },
        [voice, selectedVoice]
    );

    // Clear unread when panel opens
    useEffect(() => {
        if (isPanelOpen) setHasUnread(false);
    }, [isPanelOpen]);

    useEffect(() => {
        const handleOpen = () => setIsPanelOpen(true);
        window.addEventListener('open-voice-director', handleOpen);
        return () => window.removeEventListener('open-voice-director', handleOpen);
    }, []);

    if (isPublicPage) return null;

    return (
        <div className={isPanelOpen ? "h-full shrink-0" : ""}>
            <DirectorToggle
                isOpen={isPanelOpen}
                onClick={() => setIsPanelOpen(true)}
                voiceState={voice.state}
                isLocked={!isVoiceEnabled}
                hasUnread={hasUnread}
            />
            <DirectorPanel
                isOpen={isPanelOpen}
                onClose={() => setIsPanelOpen(false)}
                onMinimize={() => setIsPanelOpen(false)}
                voiceState={voice.state}
                assistantText={voice.assistantText}
                userText={voice.userText}
                errorMessage={voice.errorMessage}
                isLocked={!isVoiceEnabled}
                onConnect={() => voice.connect(selectedVoice)}
                onDisconnect={voice.disconnect}
                onStartTalking={voice.startTalking}
                onStopTalking={voice.stopTalking}
                onUpgradeClick={handleUpgradeClick}
                onSendText={handleSendText}
                messages={messages}
                isAgentBusy={isAgentBusy}
                onStopAgent={handleStopAgent}
                selectedVoice={selectedVoice}
                onVoiceChange={(v) => {
                    setSelectedVoice(v);
                    if (voice.isConnected) {
                        voice.disconnect();
                        setTimeout(() => voice.connect(v), 500);
                    }
                }}
            />
        </div>
    );
}
