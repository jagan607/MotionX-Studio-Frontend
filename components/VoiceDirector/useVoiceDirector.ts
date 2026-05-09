/**
 * useVoiceDirector.ts
 * 
 * Core hook for the Voice AI Director WebSocket connection.
 * Handles:
 *   - WebSocket lifecycle (connect/disconnect/reconnect)
 *   - Audio capture via ScriptProcessorNode → PCM16 conversion
 *   - Audio playback via AudioContext
 *   - Tool call / action event forwarding
 *   - Session state management
 *   - Barge-in (interrupt agent mid-speech)
 *   - DOM scraping for context awareness
 *   - Proactive navigation context updates
 */

"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { API_BASE_URL } from "@/lib/config";

// Derive WebSocket URL from the HTTP API base
const WS_BASE = API_BASE_URL.replace(/^http/, "ws");

export type VoiceSessionState =
    | "idle"           // Not connected
    | "connecting"     // Establishing connection
    | "ready"          // Connected, waiting for push-to-talk
    | "recording"      // User is speaking (push-to-talk held)
    | "processing"     // Audio sent, waiting for response
    | "responding"     // Director is speaking back
    | "error";         // Connection error

export interface VoiceAction {
    action: string;
    args: Record<string, unknown>;
}

export interface VoiceTranscriptEntry {
    role: "user" | "assistant";
    text: string;
    timestamp: number;
}

interface UseVoiceDirectorOptions {
    onAction?: (action: VoiceAction) => void;
    onTranscript?: (entry: VoiceTranscriptEntry) => void;
    onError?: (message: string) => void;
}

// ── Reconnection config ──────────────────────────────────────────
const RECONNECT_MAX_ATTEMPTS = 3;
const RECONNECT_BASE_DELAY_MS = 2000;

export function useVoiceDirector(options: UseVoiceDirectorOptions = {}) {
    const { onAction, onTranscript, onError } = options;
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const [state, setState] = useState<VoiceSessionState>("idle");
    const [assistantText, setAssistantText] = useState("");
    const [userText, setUserText] = useState("");
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Refs for persistent values across renders
    const wsRef = useRef<WebSocket | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const playbackQueueRef = useRef<Float32Array[]>([]);
    const isPlayingRef = useRef(false);
    const assistantTextRef = useRef("");
    const onActionRef = useRef(onAction);
    const onTranscriptRef = useRef(onTranscript);
    const onErrorRef = useRef(onError);

    // Reconnection state
    const reconnectAttemptsRef = useRef(0);
    const intentionalDisconnectRef = useRef(false);
    const wasConnectedRef = useRef(false);

    // Keep callback refs current
    useEffect(() => { onActionRef.current = onAction; }, [onAction]);
    useEffect(() => { onTranscriptRef.current = onTranscript; }, [onTranscript]);
    useEffect(() => { onErrorRef.current = onError; }, [onError]);

    // ── Context Detection ────────────────────────────────────────────
    const getContextHint = useCallback((): string => {
        if (pathname === "/project/new") return "new_project";
        if (pathname.match(/\/project\/[^/]+\/moodboard/)) return "moodboard";
        if (pathname.match(/\/project\/[^/]+\/draft/)) return "draft_review";
        if (pathname.match(/\/project\/[^/]+\/script/)) return "script_management";
        if (pathname.match(/\/project\/[^/]+\/(storyboard|episode|studio)/)) return "production";
        if (pathname.match(/\/project\/[^/]+\/(preproduction|treatment|assets|adaptation|taxonomy|workflow)/)) return "preproduction";
        if (pathname.includes("/postprod")) return "postprod";
        if (pathname.match(/\/project\/[^/]+$/)) return "project_hub";
        if (pathname.includes("/playground")) return "playground";
        if (pathname.includes("/explore")) return "explore";
        if (pathname.includes("/pricing")) return "pricing";
        return "dashboard";
    }, [pathname]);

    const getProjectId = useCallback((): string => {
        const match = pathname.match(/\/project\/([^/]+)/);
        return match ? match[1] : "";
    }, [pathname]);

    const getEpisodeId = useCallback((): string => {
        return searchParams.get("episode_id") || "";
    }, [searchParams]);

    // ── Audio Playback ───────────────────────────────────────────────

    const playNextChunk = useCallback(() => {
        if (!audioContextRef.current || playbackQueueRef.current.length === 0) {
            isPlayingRef.current = false;
            return;
        }

        isPlayingRef.current = true;
        const chunk = playbackQueueRef.current.shift()!;

        const buffer = audioContextRef.current.createBuffer(1, chunk.length, 24000);
        buffer.getChannelData(0).set(chunk);

        const source = audioContextRef.current.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContextRef.current.destination);
        source.onended = () => playNextChunk();
        source.start();
    }, []);

    const enqueueAudio = useCallback((base64Audio: string) => {
        try {
            // Decode base64 → PCM16 Int16Array → Float32Array
            const binaryStr = atob(base64Audio);
            const bytes = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) {
                bytes[i] = binaryStr.charCodeAt(i);
            }
            const int16 = new Int16Array(bytes.buffer);
            const float32 = new Float32Array(int16.length);
            for (let i = 0; i < int16.length; i++) {
                float32[i] = int16[i] / 32768;
            }

            playbackQueueRef.current.push(float32);

            if (!isPlayingRef.current) {
                playNextChunk();
            }
        } catch {
            // Silently skip corrupt audio chunks
        }
    }, [playNextChunk]);

    // ── Flush playback (for barge-in) ────────────────────────────────

    const flushPlayback = useCallback(() => {
        playbackQueueRef.current = [];
        isPlayingRef.current = false;
        // Stop any currently playing audio by closing and recreating context
        if (audioContextRef.current && audioContextRef.current.state !== "closed") {
            audioContextRef.current.close().catch(() => {});
            audioContextRef.current = new AudioContext({ sampleRate: 24000 });
        }
    }, []);

    // ── WebSocket Message Handler ────────────────────────────────────

    const handleMessage = useCallback((event: MessageEvent) => {
        try {
            const msg = JSON.parse(event.data);

            switch (msg.type) {
                case "session_ready":
                    setState("ready");
                    reconnectAttemptsRef.current = 0; // Reset on successful connection
                    wasConnectedRef.current = true;
                    break;

                case "audio":
                    setState("responding");
                    enqueueAudio(msg.audio);
                    break;

                case "transcript":
                    if (msg.role === "assistant") {
                        assistantTextRef.current += msg.delta || "";
                        setAssistantText(assistantTextRef.current);
                    } else if (msg.role === "user" && msg.text) {
                        setUserText(msg.text);
                        onTranscriptRef.current?.({
                            role: "user",
                            text: msg.text,
                            timestamp: Date.now(),
                        });
                    }
                    break;

                case "action":
                    onActionRef.current?.({
                        action: msg.action,
                        args: msg.args || {},
                    });
                    break;

                case "response_done":
                    // Director finished speaking
                    if (assistantTextRef.current) {
                        onTranscriptRef.current?.({
                            role: "assistant",
                            text: assistantTextRef.current,
                            timestamp: Date.now(),
                        });
                    }
                    assistantTextRef.current = "";
                    setAssistantText("");
                    setState("ready");
                    break;

                case "session_warning":
                    // Session nearing time limit
                    onErrorRef.current?.(msg.message || "Session ending soon.");
                    break;

                case "session_expired":
                    // Hard cap reached
                    onErrorRef.current?.(msg.message || "Session time limit reached.");
                    setState("idle");
                    break;

                case "error":
                    const errMsg = msg.message || "Voice session error";
                    setErrorMessage(errMsg);
                    setState("error");
                    onErrorRef.current?.(errMsg);
                    break;
            }
        } catch {
            // Ignore parse errors
        }
    }, [enqueueAudio]);

    // ── Connect ──────────────────────────────────────────────────────

    const connect = useCallback(async () => {
        if (wsRef.current?.readyState === WebSocket.OPEN) return;

        setState("connecting");
        setErrorMessage(null);
        intentionalDisconnectRef.current = false;

        try {
            // Lazy import to avoid Turbopack HMR module factory issues
            const { auth } = await import("@/lib/firebase");
            const user = auth.currentUser;
            if (!user) {
                setState("error");
                setErrorMessage("Not authenticated");
                return;
            }

            const token = await user.getIdToken();
            const projectId = getProjectId();
            const contextHint = getContextHint();

            const params = new URLSearchParams({
                token,
                project_id: projectId,
                context_hint: contextHint,
            });

            const url = `${WS_BASE}/ws/voice-director?${params.toString()}`;
            const ws = new WebSocket(url);

            ws.onopen = () => {
                // Connection established, waiting for session_ready
                setState("connecting");
            };

            ws.onmessage = handleMessage;

            ws.onclose = (event) => {
                wsRef.current = null;
                stopAudioCapture();

                if (event.code === 4003) {
                    setErrorMessage("Voice Director requires a Pro plan.");
                    onErrorRef.current?.("Voice Director requires a Pro plan.");
                    setState("error");
                } else if (event.code === 4002) {
                    setErrorMessage("Insufficient credits for voice session.");
                    onErrorRef.current?.("Insufficient credits.");
                    setState("error");
                } else if (event.code === 4004) {
                    setErrorMessage("You already have an active voice session in another tab.");
                    onErrorRef.current?.("Active session in another tab.");
                    setState("error");
                } else if (event.code === 4005) {
                    // Session expired — don't reconnect
                    setState("idle");
                } else if (!intentionalDisconnectRef.current && wasConnectedRef.current) {
                    // Unexpected disconnect — try to reconnect
                    attemptReconnect();
                } else {
                    setState("idle");
                }
            };

            ws.onerror = () => {
                // onerror always fires before onclose, so just log
                // actual handling happens in onclose
            };

            wsRef.current = ws;

            // Initialize AudioContext for playback
            if (!audioContextRef.current || audioContextRef.current.state === "closed") {
                audioContextRef.current = new AudioContext({ sampleRate: 24000 });
            }
            if (audioContextRef.current.state === "suspended") {
                await audioContextRef.current.resume();
            }

        } catch (e: unknown) {
            setState("error");
            const errMsg = e instanceof Error ? e.message : "Failed to connect";
            setErrorMessage(errMsg);
        }
    }, [getProjectId, getContextHint, handleMessage]);

    // ── Auto-Reconnect ───────────────────────────────────────────────

    const attemptReconnect = useCallback(() => {
        if (reconnectAttemptsRef.current >= RECONNECT_MAX_ATTEMPTS) {
            setState("error");
            setErrorMessage("Connection lost. Please reconnect manually.");
            onErrorRef.current?.("Connection lost after multiple attempts.");
            return;
        }

        reconnectAttemptsRef.current++;
        const delay = RECONNECT_BASE_DELAY_MS * Math.pow(2, reconnectAttemptsRef.current - 1);

        setState("connecting");
        setErrorMessage(`Reconnecting... (attempt ${reconnectAttemptsRef.current}/${RECONNECT_MAX_ATTEMPTS})`);

        setTimeout(() => {
            if (!intentionalDisconnectRef.current) {
                connect();
            }
        }, delay);
    }, [connect]);

    // ── Audio Capture ────────────────────────────────────────────────

    const startAudioCapture = useCallback(async () => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: 24000,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true,
                },
            });
            mediaStreamRef.current = stream;

            // Ensure AudioContext is at 24kHz for OpenAI
            if (!audioContextRef.current || audioContextRef.current.sampleRate !== 24000 || audioContextRef.current.state === "closed") {
                audioContextRef.current?.close().catch(() => {});
                audioContextRef.current = new AudioContext({ sampleRate: 24000 });
            }

            const source = audioContextRef.current.createMediaStreamSource(stream);
            sourceRef.current = source;

            // ScriptProcessorNode for PCM16 capture
            const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;

            processor.onaudioprocess = (e) => {
                if (wsRef.current?.readyState !== WebSocket.OPEN) return;

                const inputData = e.inputBuffer.getChannelData(0);
                const pcm16 = new Int16Array(inputData.length);
                for (let i = 0; i < inputData.length; i++) {
                    pcm16[i] = Math.max(-1, Math.min(1, inputData[i])) * 32767;
                }

                // Int16Array → base64
                const bytes = new Uint8Array(pcm16.buffer);
                let binary = "";
                for (let i = 0; i < bytes.length; i++) {
                    binary += String.fromCharCode(bytes[i]);
                }
                const base64 = btoa(binary);

                wsRef.current.send(JSON.stringify({
                    type: "audio",
                    audio: base64,
                }));
            };

            source.connect(processor);
            processor.connect(audioContextRef.current.destination);

            setState("recording");
        } catch {
            onErrorRef.current?.("Microphone access denied.");
            setState("ready");
        }
    }, []);

    const stopAudioCapture = useCallback(() => {
        if (processorRef.current) {
            processorRef.current.disconnect();
            processorRef.current = null;
        }
        if (sourceRef.current) {
            sourceRef.current.disconnect();
            sourceRef.current = null;
        }
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(t => t.stop());
            mediaStreamRef.current = null;
        }
    }, []);

    // ── Push-to-Talk Controls ────────────────────────────────────────

    const startTalking = useCallback(async () => {
        // Allow barge-in: if agent is responding, interrupt it
        if (state === "responding") {
            flushPlayback();
            // Cancel the current response on OpenAI side
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ type: "cancel" }));
            }
            assistantTextRef.current = "";
            setAssistantText("");
        } else if (state !== "ready") {
            return;
        }

        // Clear previous transcript
        setUserText("");

        await startAudioCapture();
    }, [state, startAudioCapture, flushPlayback]);

    const stopTalking = useCallback(() => {
        if (state !== "recording") return;

        stopAudioCapture();
        setState("processing");

        // Tell backend we're done speaking
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: "input_done" }));
        }
    }, [state, stopAudioCapture]);

    // ── Disconnect ───────────────────────────────────────────────────

    const disconnect = useCallback(() => {
        intentionalDisconnectRef.current = true;
        reconnectAttemptsRef.current = 0;
        stopAudioCapture();
        flushPlayback();

        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }

        setState("idle");
        setAssistantText("");
        setUserText("");
        setErrorMessage(null);
        wasConnectedRef.current = false;
    }, [stopAudioCapture, flushPlayback]);

    // ── Cleanup on unmount only (NOT on navigation) ────────────────

    useEffect(() => {
        return () => {
            // Only disconnect when the component truly unmounts (app close)
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
            audioContextRef.current?.close().catch(() => {});
        };
    }, []);

    // ── Scrape visible page content for the voice agent ──

    const scrapePageContext = useCallback((): string => {
        const parts: string[] = [];

        // ── Project title from header ──
        const projectTitle = document.querySelector("[data-project-title]");
        if (projectTitle?.textContent) parts.push(`Project: ${projectTitle.textContent.trim()}`);

        // ── Generic: main heading ──
        const h1 = document.querySelector("h1");
        if (h1?.textContent) parts.push(`Page heading: ${h1.textContent.trim()}`);

        // ════════════════════════════════════════════════════════════
        //  DRAFT REVIEW — scene list from data attributes
        // ════════════════════════════════════════════════════════════
        const draftEl = document.querySelector("[data-draft-scenes]");
        if (draftEl) {
            try {
                const draftScenes = JSON.parse((draftEl as HTMLElement).dataset.draftScenes || "[]");
                if (draftScenes.length > 0) {
                    const sceneSummaries = draftScenes.map((s: any) =>
                        `  Scene ${s.n}: ${s.h || "No header"}${s.t ? ` (${s.t})` : ""}${s.c ? ` | Cast: ${s.c}` : ""}${s.s ? `\n    → ${s.s}` : ""}`
                    );
                    parts.push(`DRAFT SCENES (${draftScenes.length} total — use scene_number 1 to ${draftScenes.length}):\n${sceneSummaries.join("\n")}`);
                }
            } catch { /* ignore parse errors */ }
        }

        // ════════════════════════════════════════════════════════════
        //  PREPRODUCTION CANVAS — scenes, characters, locations
        // ════════════════════════════════════════════════════════════
        const sceneNodes = document.querySelectorAll("[data-node-type='scene']");
        if (sceneNodes.length > 0) {
            const sceneSummaries = Array.from(sceneNodes).map(el => {
                const h = el as HTMLElement;
                const num = h.dataset.nodeSceneNumber || "?";
                const title = h.dataset.nodeTitle || "";
                const sub = h.dataset.nodeSubtitle || "";
                const hasImg = h.dataset.nodeHasImage === "true";
                return `  Scene ${num}: ${title}${sub ? ` — ${sub}` : ""}${hasImg ? " [has image]" : ""}`;
            });
            parts.push(`SCENES ON CANVAS (${sceneNodes.length}):\n${sceneSummaries.join("\n")}`);
        }

        const charNodes = document.querySelectorAll("[data-node-type='character']");
        if (charNodes.length > 0) {
            const charList = Array.from(charNodes).map(el => {
                const h = el as HTMLElement;
                const name = h.dataset.nodeTitle || "Unknown";
                const hasImg = h.dataset.nodeHasImage === "true";
                const generating = h.dataset.nodeIsGenerating === "true";
                return `  ${name}${hasImg ? " [has portrait]" : " [no portrait]"}${generating ? " [generating...]" : ""}`;
            });
            parts.push(`CHARACTERS (${charNodes.length}):\n${charList.join("\n")}`);
        }

        const locNodes = document.querySelectorAll("[data-node-type='location']");
        if (locNodes.length > 0) {
            const locList = Array.from(locNodes).map(el => {
                const h = el as HTMLElement;
                const name = h.dataset.nodeTitle || "Unknown";
                const hasImg = h.dataset.nodeHasImage === "true";
                return `  ${name}${hasImg ? " [has image]" : " [no image]"}`;
            });
            parts.push(`LOCATIONS (${locNodes.length}):\n${locList.join("\n")}`);
        }

        const productNodes = document.querySelectorAll("[data-node-type='product']");
        if (productNodes.length > 0) {
            const prodList = Array.from(productNodes).map(el => (el as HTMLElement).dataset.nodeTitle || "").filter(Boolean);
            parts.push(`PRODUCTS: ${prodList.join(", ")}`);
        }

        // ════════════════════════════════════════════════════════════
        //  ACTIVE SCENE (Storyboard context)
        // ════════════════════════════════════════════════════════════
        const activeSceneEl = document.querySelector("[data-active-scene-id]");
        if (activeSceneEl) {
            const as = activeSceneEl as HTMLElement;
            const num = as.dataset.activeSceneNumber || "?";
            const slug = as.dataset.activeSceneSlugline || "";
            const loc = as.dataset.activeSceneLocation || "";
            const cast = as.dataset.activeSceneCast || "";
            parts.push(`ACTIVE SCENE: Scene ${num} — ${slug}\n  Location: ${loc}\n  Cast: ${cast}`);
        }

        // ════════════════════════════════════════════════════════════
        //  STORYBOARD — detailed shot-by-shot breakdown
        // ════════════════════════════════════════════════════════════
        const shotCards = document.querySelectorAll("[data-shot-id]");
        if (shotCards.length > 0) {
            const shotSummaries: string[] = [];
            let withImage = 0, withVideo = 0, generating = 0, errors = 0, upscaled = 0;

            shotCards.forEach(el => {
                const h = el as HTMLElement;
                const idx = h.dataset.shotIndex || "?";
                const type = h.dataset.shotType || "unset";
                const status = h.dataset.shotStatus || "unknown";
                const loc = h.dataset.shotLocation || "";
                const prompt = h.dataset.shotPrompt || "";
                const chars = h.dataset.shotCharacters || "";
                const linked = h.dataset.shotIsLinked === "true";
                const pinned = h.dataset.shotIsPinned === "true";

                if (status === "image_ready" || status === "video_ready") withImage++;
                if (status === "video_ready") withVideo++;
                if (status === "generating" || status === "animating") generating++;
                if (status === "error") errors++;
                if (h.dataset.shotIsUpscaled === "true") upscaled++;

                // Build compact shot summary
                let summary = `  Shot ${idx}: ${type}`;
                if (loc) summary += ` @ ${loc}`;
                summary += ` [${status}]`;
                if (chars) summary += ` — cast: ${chars}`;
                if (linked) summary += " 🔗linked";
                if (pinned) summary += " 📌pinned";
                if (prompt) summary += `\n    prompt: "${prompt}"`;
                shotSummaries.push(summary);
            });

            parts.push(
                `STORYBOARD (${shotCards.length} shots):\n` +
                `  Stats: ${withImage} rendered, ${withVideo} animated, ${generating} in progress, ${errors} failed, ${upscaled} upscaled to 4K\n` +
                shotSummaries.join("\n")
            );
        }

        // ════════════════════════════════════════════════════════════
        //  MOODBOARD — visual style options
        // ════════════════════════════════════════════════════════════
        const moodCards = document.querySelectorAll("[data-mood-name]");
        if (moodCards.length > 0) {
            const moodList = Array.from(moodCards).map(el => {
                const h = el as HTMLElement;
                const name = h.dataset.moodName || "Unknown";
                const selected = h.dataset.moodSelected === "true";
                const applied = h.dataset.moodApplied === "true";
                const atmosphere = h.dataset.moodAtmosphere || "";
                const status = h.dataset.moodStatus || "";
                let label = `  ${name}`;
                if (applied) label += " ✅ APPLIED";
                else if (selected) label += " 👈 selected";
                if (status === "generating") label += " [generating...]";
                if (atmosphere) label += ` — ${atmosphere}`;
                return label;
            });
            parts.push(`MOODBOARD OPTIONS (${moodCards.length}):\n${moodList.join("\n")}`);
        }

        // ════════════════════════════════════════════════════════════
        //  DASHBOARD — visible project cards
        // ════════════════════════════════════════════════════════════
        const projectCards = document.querySelectorAll("[data-project-card-title]");
        if (projectCards.length > 0) {
            const projList = Array.from(projectCards)
                .slice(0, 10) // cap at 10
                .map(el => (el as HTMLElement).dataset.projectCardTitle || "")
                .filter(Boolean);
            parts.push(`PROJECTS ON DASHBOARD: ${projList.join(", ")}`);
        }

        // ════════════════════════════════════════════════════════════
        //  DRAFT REVIEW — full scene breakdown
        // ════════════════════════════════════════════════════════════
        const draftScenes = document.querySelectorAll("[data-draft-scene]");
        if (draftScenes.length > 0) {
            const draftDetails = Array.from(draftScenes).map(el => {
                const h = el as HTMLElement;
                const num = h.dataset.draftSceneNumber || "?";
                const header = h.dataset.draftSceneHeader || "";
                const time = h.dataset.draftSceneTime || "";
                const cast = h.dataset.draftSceneCast || "";
                const action = h.dataset.draftSceneAction || "";
                const active = h.dataset.draftSceneActive === "true";
                let line = `  Scene ${num}: ${header}`;
                if (time) line += ` [${time}]`;
                if (cast) line += ` cast: ${cast}`;
                if (active) line += " << SELECTED";
                if (action) line += `\n    Action: ${action.slice(0, 150)}`;
                return line;
            });
            parts.push(`DRAFT REVIEW (${draftScenes.length} scenes). Use edit_scene tool to modify:\n${draftDetails.join("\n")}`);

        }

        // ════════════════════════════════════════════════════════════
        //  ACTIVE PANELS — open modals/sidebars
        // ════════════════════════════════════════════════════════════
        const assetModal = document.querySelector("[data-asset-modal-open='true']");
        if (assetModal) parts.push("ASSET MODAL is open");

        const scriptModal = document.querySelector("[data-script-modal-open='true']");
        if (scriptModal) parts.push("SCRIPT EDITOR is open");

        return parts.join("\n");
    }, []);

    // ── Send context update on page navigation ──

    const prevPathnameRef = useRef(pathname);

    useEffect(() => {
        // Skip the initial mount
        if (prevPathnameRef.current === pathname) return;
        prevPathnameRef.current = pathname;

        if (wsRef.current?.readyState === WebSocket.OPEN) {
            const contextHint = getContextHint();
            const projectId = getProjectId();
            const episodeId = getEpisodeId();

            // Delay so the new page DOM has rendered
            setTimeout(() => {
                const pageContent = scrapePageContext();
                const contextUpdate = [
                    `User navigated to: ${pathname}`,
                    `Phase: ${contextHint}`,
                    projectId ? `Project ID: ${projectId}` : "No project selected",
                    episodeId ? `Episode ID: ${episodeId}` : "",
                    pageContent || "Page content loading...",
                ].filter(Boolean).join("\n");

                wsRef.current?.send(JSON.stringify({
                    type: "context_update",
                    context: contextUpdate,
                }));
            }, 1500);
        }
    }, [pathname, getContextHint, getProjectId, getEpisodeId, scrapePageContext]);

    // ── Expose a method to push live context updates ──
    const sendContext = useCallback((context: string) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: "context_update",
                context,
            }));
        }
    }, []);

    return {
        state,
        assistantText,
        userText,
        errorMessage,
        connect,
        disconnect,
        startTalking,
        stopTalking,
        sendContext,
        isConnected: state !== "idle" && state !== "error",
    };
}
