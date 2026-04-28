"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { Bot, Send, Loader2, Sparkles, MessageSquare, X, ChevronRight, Rocket, ExternalLink, Copy, Check, Layers, PanelRight } from "lucide-react";
import { API_BASE_URL } from "@/lib/config";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";

interface Message {
    role: "user" | "assistant";
    content: string;
}

// Context detection from URL
function detectContext(pathname: string): { hint: string; label: string; suggestions: string[] } {
    // Must check /project/new BEFORE the generic /project/:id matcher
    if (pathname === "/project/new") return {
        hint: "new_project",
        label: "New Project",
        suggestions: [
            "Help me brainstorm a story concept",
            "What format works best for a 30-second ad?",
            "Guide me through creating my first film",
            "I have a script idea — help me refine it",
        ],
    };

    // Production sub-pages — storyboard, episode, studio, draft, script
    if (pathname.match(/\/project\/[^/]+\/(storyboard|episode|studio|draft)/)) return {
        hint: "production",
        label: "Storyboard",
        suggestions: [
            "Write shot prompts for this scene",
            "What camera angles work for a chase?",
            "Help me direct this scene cinematically",
            "Suggest lighting for a tense night scene",
        ],
    };

    // Pre-production sub-pages — preproduction, moodboard, treatment, assets, taxonomy, adaptation, script
    if (pathname.match(/\/project\/[^/]+\/(preproduction|moodboard|treatment|assets|taxonomy|adaptation|script)/)) return {
        hint: "preproduction",
        label: "Pre-Production",
        suggestions: [
            "How do I write better character descriptions?",
            "Suggest a color palette for this project",
            "Tips for creating consistent character looks",
            "What makes a good location reference?",
        ],
    };

    // Post-production
    if (pathname.includes("/postprod")) return {
        hint: "postprod",
        label: "Post-Production",
        suggestions: [
            "How should I pace my cuts for a trailer?",
            "Tips for adding sound design to scenes",
            "When should I use lip-sync vs voiceover?",
            "How to create a cinematic color grade?",
        ],
    };

    // Generic project page (director console / overview)
    if (pathname.match(/\/project\/[^/]+$/)) return {
        hint: "production",
        label: "Production",
        suggestions: [
            "How do I write a good shot prompt?",
            "Suggest camera movements for a dialogue scene",
            "How to maintain visual consistency across shots?",
            "Tips for Seedance 2.0 prompt writing",
        ],
    };

    if (pathname.includes("/playground")) return {
        hint: "playground",
        label: "Playground",
        suggestions: [
            "Write a prompt for a cinematic sunrise",
            "How do I use reference images effectively?",
            "Suggest a dramatic 5-second shot idea",
            "Tips for realistic human movement prompts",
        ],
    };
    if (pathname.includes("/explore")) return {
        hint: "explore",
        label: "Explore",
        suggestions: [
            "How can I get more views on my shots?",
            "What makes a good community showcase shot?",
            "Suggest trending visual styles to try",
            "How to build a portfolio on MotionX?",
        ],
    };
    return {
        hint: "dashboard",
        label: "Dashboard",
        suggestions: [
            "How should I structure a 60-second ad?",
            "What's the best workflow for a short film?",
            "Help me brainstorm a story concept",
            "Guide me through my first project",
        ],
    };
}

// Extract project ID from URL
function extractProjectId(pathname: string): string | null {
    const match = pathname.match(/\/project\/([^/]+)/);
    return match ? match[1] : null;
}

// Scrape visible page context from DOM to give the Director real-time awareness
function scrapePageContext(): Record<string, string> {
    const ctx: Record<string, string> = {};
    try {
        // Page title from h1
        const h1 = document.querySelector("h1");
        if (h1?.textContent?.trim()) ctx.page_title = h1.textContent.trim().slice(0, 100);

        // Section title from h2/h3
        const h2 = document.querySelector("h2, h3");
        if (h2?.textContent?.trim()) ctx.section_title = h2.textContent.trim().slice(0, 100);

        // Scene info: scan ALL buttons and spans for "SCENE X: ..." pattern
        const allElements = document.querySelectorAll("button, span, p, h1, h2, h3, h4, div");
        for (const el of allElements) {
            const text = (el.textContent?.trim() || "");
            // Match "SCENE 1: EXT. ALLEYWAY" or similar
            if (/^SCENE\s+\d+/i.test(text) && text.length < 200 && !ctx.current_scene) {
                ctx.current_scene = text.slice(0, 200);
            }
            // Match "EXT. ..." or "INT. ..." standalone
            if (/^(EXT\.|INT\.)\s/i.test(text) && text.length < 150 && !ctx.scene_info) {
                ctx.scene_info = text.slice(0, 150);
            }
            // Match screenplay-like text (long descriptions with character actions)
            if (!ctx.screenplay && text.length > 50 && text.length < 500 && el.tagName === "P") {
                const words = text.split(/\s+/);
                // Heuristic: screenplay text has character names (ALL CAPS words) and action verbs
                if (words.some(w => /^[A-Z]{3,}$/.test(w)) || text.toLowerCase().includes("camera") || text.toLowerCase().includes("shot")) {
                    ctx.screenplay = text.slice(0, 300);
                }
            }
        }

        // ── SHOT-LEVEL AWARENESS ──
        const h3el = document.querySelector("h3");
        if (h3el?.textContent?.includes("EMPTY SEQUENCE")) {
            ctx.shot_status = "EMPTY — no shots yet. Needs Auto-Direct or manual shot creation.";
        } else {
            let shotCount = 0;
            document.querySelectorAll("span, div").forEach(el => {
                if (/^SHOT\s+\d+/i.test(el.textContent?.trim() || "")) shotCount++;
            });
            if (shotCount > 0) ctx.shot_status = `${shotCount} shots on storyboard`;
        }

        // ── CREDIT BALANCE ──
        document.querySelectorAll("div").forEach(el => {
            const t = el.textContent?.trim() || "";
            if (/^\d+\.\d{2}$/.test(t)) {
                const parent = el.parentElement?.textContent || "";
                if (/credit/i.test(parent)) ctx.user_credits = t;
            }
        });

        // Context badges (genre, project type)
        const contextBadges: string[] = [];
        document.querySelectorAll("span").forEach(el => {
            const t = el.textContent?.trim() || "";
            if (t.length > 3 && t.length < 60 && /^[A-Z\s/·•\-]+$/.test(t) && !/^(CREDITS|TOP UP|CLOSE|OPEN|SAVE)/.test(t)) {
                contextBadges.push(t);
            }
        });
        if (contextBadges.length > 0 && contextBadges.length < 8) {
            ctx.visible_badges = contextBadges.slice(0, 5).join(" | ");
        }

        // Project name from document title or nav
        if (document.title && !document.title.includes("localhost")) {
            ctx.browser_title = document.title.slice(0, 100);
        }

        // Current prompt in any visible textarea (not the director chat input)
        const textarea = document.querySelector("textarea:not([class*='director'])") as HTMLTextAreaElement;
        if (textarea?.value?.trim()) {
            ctx.current_prompt = textarea.value.trim().slice(0, 200);
        }
    } catch {
        // Silently ignore DOM errors
    }
    return ctx;
}

// ── Action parsing ──────────────────────────────────────────────
interface ParsedAction {
    type: "create_project" | "navigate" | "copy_to_playground" | "navigate_scene" | "open_panel";
    payload: string;
    label?: string;
}

function parseActions(text: string): { clean: string; actions: ParsedAction[] } {
    const actions: ParsedAction[] = [];

    // Helper: extract a short title from a create_project payload
    const extractTitle = (payload: string): string => {
        // Try to get first ~4 meaningful words
        const stopWords = new Set(["a", "an", "the", "in", "on", "at", "for", "with", "and", "or", "of", "to", "is", "by", "about"]);
        const words = payload.split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w.toLowerCase()));
        const title = words.slice(0, 4).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
        return title ? `Create: ${title}…` : "Create This Project";
    };

    // 1. Match complete action tags (with `s` flag for multiline payloads)
    let clean = text.replace(/\{\{ACTION:([\s\S]*?)\}\}/g, (_, inner) => {
        const normalized = inner.replace(/\n/g, " ").trim();
        const parts = normalized.split("|");
        const type = parts[0]?.trim();
        if (type === "create_project") {
            const payload = parts.slice(1).join("|").trim();
            actions.push({ type: "create_project", payload, label: extractTitle(payload) });
        } else if (type === "navigate") {
            actions.push({ type: "navigate", payload: parts[1]?.trim() || "/", label: parts[2]?.trim() || "Open" });
        } else if (type === "copy_to_playground") {
            actions.push({ type: "copy_to_playground", payload: parts.slice(1).join("|").trim(), label: "Paste in Playground" });
        } else if (type === "navigate_scene") {
            const sceneNum = parts[1]?.trim() || "1";
            actions.push({ type: "navigate_scene", payload: sceneNum, label: parts[2]?.trim() || `Go to Scene ${sceneNum}` });
        } else if (type === "open_panel") {
            const panel = parts[1]?.trim() || "";
            const panelLabels: Record<string, string> = { set_design: "Open Set Design", wardrobe: "Open Wardrobe", cinematography: "Open Scene Mood", script: "Open Script" };
            actions.push({ type: "open_panel", payload: panel, label: parts[2]?.trim() || panelLabels[panel] || `Open ${panel}` });
        }
        return "";
    });

    // 2. Catch truncated/unclosed action tags (e.g. {{ACTION:copy_to_playground|prompt text... without closing }})
    clean = clean.replace(/\{\{ACTION:([\s\S]*)$/g, (_, inner) => {
        const normalized = inner.replace(/\n/g, " ").trim();
        const parts = normalized.split("|");
        const type = parts[0]?.trim();
        const payload = parts.slice(1).join("|").trim();
        if (type === "create_project" && payload) {
            actions.push({ type: "create_project", payload, label: extractTitle(payload) });
        } else if (type === "navigate") {
            actions.push({ type: "navigate", payload: parts[1]?.trim() || "/", label: parts[2]?.trim() || "Open" });
        } else if (type === "copy_to_playground" && payload) {
            actions.push({ type: "copy_to_playground", payload, label: "Paste in Playground" });
        } else if (type === "navigate_scene") {
            actions.push({ type: "navigate_scene", payload: parts[1]?.trim() || "1", label: parts[2]?.trim() || `Go to Scene ${parts[1]?.trim() || "1"}` });
        } else if (type === "open_panel" && payload) {
            actions.push({ type: "open_panel", payload, label: parts[2]?.trim() || `Open ${payload}` });
        }
        return "";
    });

    return { clean: clean.trim(), actions };
}

// ── Inline markdown renderer ────────────────────────────────────
function renderLine(line: string) {
    return line.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g).map((part, pi) => {
        if (part.startsWith('**') && part.endsWith('**'))
            return <strong key={pi} className="text-white/90 font-semibold">{part.slice(2, -2)}</strong>;
        if (part.startsWith('*') && part.endsWith('*'))
            return <em key={pi} className="text-white/45">{part.slice(1, -1)}</em>;
        if (part.startsWith('`') && part.endsWith('`'))
            return <code key={pi} className="text-[10px] bg-white/[0.06] px-1.5 py-0.5 rounded text-[#E50914]/60 font-mono">{part.slice(1, -1)}</code>;
        return <span key={pi}>{part}</span>;
    });
}

// ── Copyable prompt block ───────────────────────────────────────
function PromptBlock({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);
    const copy = () => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        toast.success("Prompt copied!", { id: "copy", duration: 1500 });
        setTimeout(() => setCopied(false), 2000);
    };
    return (
        <div className="my-2 relative group rounded-lg border border-white/[0.06] bg-white/[0.02] overflow-hidden">
            <div className="px-3 py-2.5 text-[10.5px] text-white/50 leading-relaxed font-mono whitespace-pre-wrap">
                {text}
            </div>
            <button
                onClick={copy}
                className="absolute top-1.5 right-1.5 w-7 h-7 rounded-md flex items-center justify-center bg-black/40 border border-white/[0.06] text-white/25 hover:text-white/60 hover:bg-black/60 transition-all cursor-pointer opacity-0 group-hover:opacity-100"
                title="Copy prompt"
            >
                {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
            </button>
        </div>
    );
}

// ── MessageContent with action buttons & copyable prompts ───────
function MessageContent({ content, onAction, actionLoading }: {
    content: string;
    onAction: (action: ParsedAction) => void;
    actionLoading: string | null;
}) {
    const { clean, actions } = parseActions(content);

    // Split content into regular lines and blockquote prompts
    const blocks: { type: "text" | "prompt"; content: string }[] = [];
    let currentText: string[] = [];

    for (const line of clean.split('\n')) {
        if (line.startsWith('> ')) {
            // Flush any accumulated text
            if (currentText.length > 0) {
                blocks.push({ type: "text", content: currentText.join('\n') });
                currentText = [];
            }
            // Strip `> ` prefix and outer quotes
            let promptText = line.slice(2).trim();
            if ((promptText.startsWith('"') && promptText.endsWith('"')) ||
                (promptText.startsWith('\u201c') && promptText.endsWith('\u201d'))) {
                promptText = promptText.slice(1, -1);
            }
            blocks.push({ type: "prompt", content: promptText });
        } else {
            currentText.push(line);
        }
    }
    if (currentText.length > 0) {
        blocks.push({ type: "text", content: currentText.join('\n') });
    }

    return (
        <div className="text-[11.5px] leading-[1.7]">
            {blocks.map((block, bi) =>
                block.type === "prompt" ? (
                    <PromptBlock key={bi} text={block.content} />
                ) : (
                    <div key={bi} className="whitespace-pre-wrap">
                        {block.content.split('\n').map((line, li) => (
                            <p key={li} className="mb-1.5 last:mb-0">{renderLine(line)}</p>
                        ))}
                    </div>
                )
            )}
            {actions.length > 0 && (
                <div className="mt-3 flex flex-col gap-1.5">
                    {actions.map((action, ai) => (
                        <button
                            key={ai}
                            onClick={() => onAction(action)}
                            disabled={!!actionLoading}
                            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[#E50914]/20 bg-[#E50914]/[0.06] text-[11px] font-semibold text-white/80 hover:bg-[#E50914]/[0.12] hover:border-[#E50914]/30 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-wait w-full group"
                        >
                            {actionLoading === `${action.type}-${ai}` ? (
                                <Loader2 size={13} className="animate-spin text-[#E50914]" />
                            ) : action.type === "create_project" ? (
                                <Rocket size={13} className="text-[#E50914] group-hover:rotate-12 transition-transform" />
                            ) : action.type === "copy_to_playground" ? (
                                <Copy size={13} className="text-[#E50914]/70" />
                            ) : action.type === "navigate_scene" ? (
                                <Layers size={13} className="text-[#E50914]/70" />
                            ) : action.type === "open_panel" ? (
                                <PanelRight size={13} className="text-[#E50914]/70" />
                            ) : (
                                <ExternalLink size={13} className="text-[#E50914]/60" />
                            )}
                            <span>{action.label}</span>
                            {action.type === "create_project" && (
                                <span className="ml-auto text-[8px] text-white/15 font-mono">auto-pilot</span>
                            )}
                            {action.type === "copy_to_playground" && (
                                <span className="ml-auto text-[8px] text-white/15 font-mono">1-click</span>
                            )}
                            {(action.type === "navigate_scene" || action.type === "open_panel") && (
                                <span className="ml-auto text-[8px] text-white/15 font-mono">instant</span>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function DirectorChat() {
    const pathname = usePathname();
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [streaming, setStreaming] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const ctx = detectContext(pathname);
    const projectId = extractProjectId(pathname);

    // ── P0-3: DYNAMIC SMART SUGGESTIONS ──
    // Generate context-aware suggestion chips from DOM state
    const getSmartSuggestions = useCallback((): string[] => {
        const pageCtx = scrapePageContext();
        const smart: string[] = [];

        // Scene-specific suggestions
        if (pageCtx.current_scene) {
            const sceneName = pageCtx.current_scene.replace(/^SCENE\s+\d+:?\s*/i, "").trim();
            if (pageCtx.shot_status?.includes("EMPTY")) {
                smart.push(`Auto-direct ${sceneName || "this scene"}`);
                smart.push("Write shot prompts for this scene");
            } else if (pageCtx.shot_status) {
                smart.push("Review and improve my shot prompts");
                smart.push("Suggest camera angles for this scene");
            }
        }

        // Credit-aware suggestion
        if (pageCtx.user_credits) {
            const credits = parseFloat(pageCtx.user_credits);
            if (credits < 5) {
                smart.push("How can I make the most of my remaining credits?");
            }
        }

        // Fill remaining slots with context defaults
        const remaining = 4 - smart.length;
        if (remaining > 0) {
            smart.push(...ctx.suggestions.slice(0, remaining));
        }

        return smart.slice(0, 4);
    }, [ctx.suggestions, pathname]);

    // ── P0-4: PROACTIVE GREETING ──
    const getGreeting = useCallback((): string => {
        const pageCtx = scrapePageContext();

        if (pageCtx.current_scene) {
            const status = pageCtx.shot_status || "scene loaded";
            return `Working on ${pageCtx.current_scene.slice(0, 60)} — ${status}`;
        }
        if (ctx.hint === "new_project") {
            return "Ready to create something amazing";
        }
        if (ctx.hint === "playground") {
            return "Quick generation mode — describe any shot";
        }
        return "What are you working on?";
    }, [ctx.hint, pathname]);

    // Don't render on landing page or onboarding
    const isPublicPage = pathname === "/" || pathname.startsWith("/onboarding") || pathname.startsWith("/login");

    // Keyboard shortcut: Ctrl+Shift+A or Cmd+Shift+A
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "a") {
                e.preventDefault();
                setOpen(prev => !prev);
            }
            // Escape to close
            if (e.key === "Escape" && open) {
                setOpen(false);
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [open]);

    // Clear chat when navigating to a new page — show fresh suggestions
    useEffect(() => {
        setMessages([]);
        setInput("");
        setStreaming(false);
        setActionLoading(null);
    }, [pathname]);

    // Auto-scroll
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, streaming]);

    // Focus input when opened
    useEffect(() => {
        if (open && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 150);
        }
    }, [open]);

    const sendMessage = useCallback(async (text?: string) => {
        const msg = (text || input).trim();
        if (!msg || streaming) return;

        const userMsg: Message = { role: "user", content: msg };
        const newMessages = [...messages, userMsg];
        setMessages(newMessages);
        setInput("");
        setStreaming(true);
        setMessages(prev => [...prev, { role: "assistant", content: "" }]);

        try {
            const token = await (await import("@/lib/firebase")).auth.currentUser?.getIdToken();
            if (!token) throw new Error("Not authenticated");

            const res = await fetch(`${API_BASE_URL}/api/v1/ai/director-chat`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                },
                body: JSON.stringify({
                    messages: newMessages.map(m => ({ role: m.role, content: m.content })),
                    project_id: projectId,
                    context_hint: ctx.hint,
                    page_context: scrapePageContext(),
                }),
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const reader = res.body?.getReader();
            if (!reader) throw new Error("No stream reader");

            const decoder = new TextDecoder();
            let buffer = "";
            let fullText = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";
                for (const line of lines) {
                    if (!line.startsWith("data: ")) continue;
                    const raw = line.slice(6).trim();
                    if (!raw) continue;
                    try {
                        const data = JSON.parse(raw);
                        if (data.chunk) {
                            fullText += data.chunk;
                            setMessages(prev => {
                                const updated = [...prev];
                                updated[updated.length - 1] = { role: "assistant", content: fullText };
                                return updated;
                            });
                        }
                        if (data.error) {
                            fullText += `\n\n_Error: ${data.error}_`;
                            setMessages(prev => {
                                const updated = [...prev];
                                updated[updated.length - 1] = { role: "assistant", content: fullText };
                                return updated;
                            });
                        }
                    } catch { /* skip */ }
                }
            }
        } catch {
            setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                    role: "assistant",
                    content: "Sorry, I couldn't connect right now. Please try again.",
                };
                return updated;
            });
        } finally {
            setStreaming(false);
        }
    }, [input, messages, streaming, projectId, ctx.hint]);

    // Handle Director actions (create project, navigate, copy_to_playground)
    const handleAction = useCallback(async (action: ParsedAction) => {
        if (action.type === "copy_to_playground") {
            navigator.clipboard.writeText(action.payload);
            if (pathname.startsWith("/playground")) {
                // Directly inject into the prompt bar via custom event
                window.dispatchEvent(new CustomEvent("director-paste-prompt", { detail: action.payload }));
            } else {
                // Navigate to playground with prompt in URL
                toast.loading("Opening Playground...", { id: "copy-pg", duration: 2000 });
                const encoded = encodeURIComponent(action.payload);
                router.push(`/playground?prompt=${encoded}`);
                setOpen(false);
            }
            return;
        }

        if (action.type === "navigate") {
            const target = action.payload;
            // Guard: don't navigate to the same project the user is already in
            if (projectId && target.match(/^\/project\/[^/]+$/) && pathname.startsWith(`/project/${projectId}`)) {
                toast.success("You're already in this project!", { id: "director-nav", duration: 1500 });
                return;
            }
            setActionLoading("navigate-0");
            toast.loading("Opening...", { id: "director-nav", duration: 3000 });
            setOpen(false);
            router.push(target);
            return;
        }

        if (action.type === "navigate_scene") {
            const sceneNum = parseInt(action.payload, 10);
            window.dispatchEvent(new CustomEvent("director-navigate-scene", { detail: { sceneNumber: sceneNum } }));
            toast.success(`Switching to Scene ${sceneNum}`, { id: "director-scene", duration: 2000 });
            return;
        }

        if (action.type === "open_panel") {
            window.dispatchEvent(new CustomEvent("director-open-panel", { detail: { panel: action.payload } }));
            const panelNames: Record<string, string> = { set_design: "Set Design", wardrobe: "Wardrobe", cinematography: "Scene Mood", script: "Script" };
            toast.success(`Opening ${panelNames[action.payload] || action.payload}`, { id: "director-panel", duration: 2000 });
            return;
        }

        if (action.type === "create_project") {
            setActionLoading("create_project-0");
            try {
                const { api, invalidateDashboardCache } = await import("@/lib/api");
                const { auth, db } = await import("@/lib/firebase");
                const { doc, setDoc } = await import("firebase/firestore");

                const scriptText = action.payload;
                // Generate title from first meaningful words
                const stopWords = new Set(["a", "an", "the", "in", "on", "at", "for", "with", "and", "or", "of", "to", "from", "by", "about", "like", "my", "is"]);
                const words = scriptText.split(/\s+/).filter(w => !stopWords.has(w.toLowerCase()) && w.length > 2);
                const title = words.slice(0, 3).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ") || "AI Director Project";

                // Create project
                const res = await api.post("/api/v1/project/create", {
                    title, genre: "Drama", type: "movie", aspect_ratio: "16:9", style: "realistic", runtime_seconds: 60,
                });
                const newProjectId = res.data.id;
                await setDoc(doc(db, "projects", newProjectId), { is_quickstart: true, created_by: "ai_director" }, { merge: true });
                if (auth.currentUser) invalidateDashboardCache(auth.currentUser.uid);

                // Upload script
                const blob = new Blob([scriptText], { type: "text/plain" });
                const formData = new FormData();
                formData.append("project_id", newProjectId);
                formData.append("script_title", title);
                formData.append("runtime_seconds", "60");
                formData.append("file", new File([blob], "script.txt"));
                await api.post("/api/v1/script/upload-script", formData, { headers: { "Content-Type": "multipart/form-data" } });

                toast.success("Project created! Redirecting to pre-production...");
                setOpen(false);
                router.push(`/project/${newProjectId}/preproduction`);
            } catch (e: any) {
                toast.error(e.response?.data?.detail || "Failed to create project");
            } finally {
                setActionLoading(null);
            }
        }
    }, [router, pathname]);

    if (isPublicPage) return null;

    return (
        <>
            {/* ── Edge tab trigger (always visible) ── */}
            <button
                onClick={() => setOpen(true)}
                className={`fixed top-1/2 -translate-y-1/2 right-0 z-[150] flex items-center gap-1.5 py-3 px-1.5 rounded-l-xl border border-r-0 border-white/[0.06] transition-all cursor-pointer group ${open ? 'translate-x-full opacity-0 pointer-events-none' : 'translate-x-0 opacity-100'}`}
                style={{
                    background: "linear-gradient(180deg, rgba(229,9,20,0.10), rgba(10,10,10,0.95))",
                    backdropFilter: "blur(12px)",
                    writingMode: "vertical-rl",
                    textOrientation: "mixed",
                    boxShadow: "-4px 0 20px rgba(0,0,0,0.4)",
                }}
                title="AI Director (⌘⇧A)"
            >
                <Bot size={14} className="text-[#E50914] rotate-90 group-hover:scale-110 transition-transform" />
                <span className="text-[9px] font-bold uppercase tracking-[2px] text-white/40 group-hover:text-white/70 transition-colors">Director</span>
                <span className="w-1.5 h-1.5 bg-[#E50914] rounded-full animate-pulse shadow-[0_0_6px_rgba(229,9,20,0.6)] rotate-90" />
            </button>

            {/* ── Side Panel ── */}
            <div
                className={`fixed top-0 right-0 z-[160] h-full w-[380px] max-w-[85vw] flex flex-col border-l border-white/[0.08] transition-transform duration-300 ease-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
                style={{
                    background: "#080808",
                    boxShadow: open ? "-4px 0 16px rgba(0,0,0,0.3)" : "none",
                }}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.05] shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #E50914, #8B0000)" }}>
                            <Bot size={16} className="text-white" />
                        </div>
                        <div>
                            <span className="text-[12px] font-bold text-white block leading-tight">AI Director</span>
                            <div className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                                <span className="text-[8px] text-white/25 font-mono uppercase tracking-wider">
                                    {streaming ? "Thinking..." : ctx.label}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <button onClick={() => setMessages([])} className="w-7 h-7 rounded-lg flex items-center justify-center text-white/15 hover:text-white/40 hover:bg-white/[0.04] transition-all cursor-pointer bg-transparent border-none" title="New chat">
                            <MessageSquare size={13} />
                        </button>
                        <button onClick={() => setOpen(false)} className="w-7 h-7 rounded-lg flex items-center justify-center text-white/15 hover:text-white/40 hover:bg-white/[0.04] transition-all cursor-pointer bg-transparent border-none" title="Close (Esc)">
                            <X size={13} />
                        </button>
                    </div>
                </div>

                {/* Context badge */}
                <div className="px-4 py-2 border-b border-white/[0.03] shrink-0">
                    <div className="flex items-center gap-2 text-[8px]">
                        <span className="text-white/15 font-mono uppercase tracking-wider">Context:</span>
                        <span className="px-2 py-0.5 rounded-full bg-[#E50914]/[0.08] border border-[#E50914]/10 text-[#E50914]/50 font-bold uppercase tracking-wider">{ctx.label}</span>
                        {projectId && (
                            <span className="px-2 py-0.5 rounded-full bg-white/[0.03] border border-white/[0.06] text-white/20 font-mono truncate max-w-[120px]">
                                {projectId.slice(0, 8)}...
                            </span>
                        )}
                        <span className="ml-auto text-white/10">⌘⇧A</span>
                    </div>
                </div>

                {/* Messages */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 no-scrollbar">
                    {messages.length === 0 ? (
                        <div className="flex flex-col h-full">
                            {/* Welcome */}
                            <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
                                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5" style={{ background: "linear-gradient(135deg, rgba(229,9,20,0.12), transparent)" }}>
                                    <Sparkles size={22} className="text-[#E50914]/40" />
                                </div>
                                <h3 className="text-[14px] font-bold text-white/70 mb-2">{getGreeting()}</h3>
                                <p className="text-[11px] text-white/20 mb-6 max-w-[280px] leading-relaxed">
                                    I can help with story, cinematography, prompt craft, and anything filmmaking. Context-aware for {ctx.label.toLowerCase()}.
                                </p>
                            </div>
                            {/* Suggestions */}
                            <div className="shrink-0 space-y-1.5 pb-2">
                                <span className="text-[8px] font-mono text-white/10 uppercase tracking-[2px] px-1">Suggestions</span>
                                {getSmartSuggestions().map((s, i) => (
                                    <button key={i} onClick={() => sendMessage(s)}
                                        className="w-full text-left group flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-white/[0.04] bg-white/[0.015] text-[11px] text-white/30 hover:text-white/60 hover:border-white/[0.1] hover:bg-white/[0.03] transition-all cursor-pointer">
                                        <ChevronRight size={10} className="text-[#E50914]/30 group-hover:text-[#E50914]/60 shrink-0 transition-colors" />
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        messages.map((msg, i) => (
                            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                                <div className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 ${
                                    msg.role === "user"
                                        ? "bg-[#E50914]/12 border border-[#E50914]/15 text-white/80"
                                        : "bg-white/[0.025] border border-white/[0.04] text-white/60"
                                }`}>
                                    {msg.role === "assistant" && msg.content === "" && streaming ? (
                                        <div className="flex items-center gap-2 py-1">
                                            <Loader2 size={12} className="animate-spin text-[#E50914]/50" />
                                            <span className="text-[9px] text-white/20 font-mono">Thinking...</span>
                                        </div>
                                    ) : (
                                        <MessageContent
                                            content={msg.content}
                                            onAction={handleAction}
                                            actionLoading={actionLoading}
                                        />
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                    {streaming && messages.length > 0 && messages[messages.length - 1].content !== "" && (
                        <div className="flex justify-start">
                            <span className="inline-block w-1.5 h-4 bg-[#E50914]/40 animate-pulse rounded-full ml-1" />
                        </div>
                    )}
                </div>

                {/* Input */}
                <div className="shrink-0 border-t border-white/[0.05] p-3 bg-black/30">
                    <div className={`flex items-end gap-2 rounded-xl border p-2.5 transition-all ${
                        input ? "border-[#E50914]/20 bg-[#E50914]/[0.02]" : "border-white/[0.05] bg-white/[0.015]"
                    } focus-within:border-[#E50914]/25`}>
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    sendMessage();
                                }
                            }}
                            placeholder="Ask the AI Director..."
                            className="flex-1 bg-transparent text-[12px] text-white placeholder-white/15 focus:outline-none resize-none leading-relaxed caret-[#E50914] min-h-[20px] max-h-[100px]"
                            rows={1}
                            disabled={streaming}
                        />
                        <button
                            onClick={() => sendMessage()}
                            disabled={!input.trim() || streaming}
                            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all cursor-pointer disabled:opacity-15 disabled:cursor-not-allowed border-none"
                            style={{
                                background: input.trim() ? "linear-gradient(135deg, #E50914, #B30710)" : "rgba(255,255,255,0.04)",
                            }}
                        >
                            {streaming ? <Loader2 size={12} className="animate-spin text-white/50" /> : <Send size={12} className="text-white" />}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
