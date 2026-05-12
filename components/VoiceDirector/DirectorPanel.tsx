/**
 * DirectorPanel.tsx
 *
 * Slide-out side panel for the AI Director — supports both voice and text chat.
 * Replaces the floating mic orb with a Cursor/Copilot-style conversation panel.
 */

"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
    Mic,
    MicOff,
    X,
    Minimize2,
    Send,
    Loader2,
    Volume2,
    Sparkles,
    ChevronRight,
} from "lucide-react";
import type { VoiceSessionState } from "./useVoiceDirector";

// ── Message Types ────────────────────────────────────────────────

export interface ChatMessage {
    id: string;
    role: "user" | "assistant" | "action";
    text: string;
    timestamp: number;
    /** For action messages */
    actionStatus?: "pending" | "success" | "error";
}

interface DirectorPanelProps {
    isOpen: boolean;
    onClose: () => void;
    onMinimize: () => void;
    // Voice state
    voiceState: VoiceSessionState;
    assistantText: string;
    userText: string;
    errorMessage: string | null;
    isLocked: boolean;
    // Voice controls
    onConnect: (voice?: string) => void;
    onDisconnect: () => void;
    onStartTalking: () => void;
    onStopTalking: () => void;
    onUpgradeClick: () => void;
    // Text chat
    onSendText: (text: string) => void;
    // Message history
    messages: ChatMessage[];
    // Agent stop control
    isAgentBusy?: boolean;
    onStopAgent?: () => void;
    // Voice Selection
    selectedVoice?: string;
    onVoiceChange?: (voice: string) => void;
}

export default function DirectorPanel({
    isOpen,
    onClose,
    onMinimize,
    voiceState,
    assistantText,
    errorMessage,
    isLocked,
    onConnect,
    onDisconnect,
    onStartTalking,
    onStopTalking,
    onUpgradeClick,
    onSendText,
    messages,
    isAgentBusy,
    onStopAgent,
    selectedVoice = "coral",
    onVoiceChange,
}: DirectorPanelProps) {
    const [inputText, setInputText] = useState("");
    const [isSending, setIsSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const holdTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isHoldingRef = useRef(false);

    const isConnected = voiceState !== "idle" && voiceState !== "error";
    const isRecording = voiceState === "recording";
    const isProcessing = voiceState === "processing";
    const isResponding = voiceState === "responding";
    const isThinking = isSending || isProcessing;

    // Auto-scroll to bottom — use rAF to ensure DOM has painted
    const scrollToBottom = useCallback(() => {
        requestAnimationFrame(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        });
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, messages.length, assistantText, scrollToBottom]);

    // Observe DOM mutations in messages container (action status updates, etc.)
    useEffect(() => {
        const container = messagesContainerRef.current;
        if (!container) return;
        const observer = new MutationObserver(() => {
            setTimeout(scrollToBottom, 100);
        });
        observer.observe(container, { childList: true, subtree: true, characterData: true });
        return () => observer.disconnect();
    }, [scrollToBottom]);

    // Focus input when panel opens
    useEffect(() => {
        if (isOpen && !isLocked) {
            setTimeout(() => inputRef.current?.focus(), 300);
        }
    }, [isOpen, isLocked]);

    // Show thinking indicator while waiting for response
    useEffect(() => {
        if (isResponding || assistantText) {
            setIsSending(false);
        }
    }, [isResponding, assistantText]);

    // Safety timeout — if no response within 60s, stop showing "thinking"
    useEffect(() => {
        if (!isSending) return;
        const timer = setTimeout(() => {
            setIsSending(false);
        }, 60_000);
        return () => clearTimeout(timer);
    }, [isSending]);

    // ── Text Send ────────────────────────────────────────────────
    const handleSend = useCallback(() => {
        const text = inputText.trim();
        if (!text) return;
        setInputText("");
        setIsSending(true);
        onSendText(text);
    }, [inputText, onSendText]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
            }
        },
        [handleSend]
    );

    // ── Push-to-Talk (mic button) ────────────────────────────────
    const handleMicDown = useCallback(
        (e: React.PointerEvent) => {
            e.preventDefault();
            if (isLocked) {
                onUpgradeClick();
                return;
            }
            if (!isConnected) {
                onConnect();
                return;
            }
            if (voiceState !== "ready") return;

            isHoldingRef.current = true;
            holdTimeoutRef.current = setTimeout(() => {
                if (isHoldingRef.current) onStartTalking();
            }, 150);
        },
        [voiceState, isLocked, isConnected, onConnect, onStartTalking, onUpgradeClick]
    );

    const handleMicUp = useCallback(() => {
        isHoldingRef.current = false;
        if (holdTimeoutRef.current) {
            clearTimeout(holdTimeoutRef.current);
            holdTimeoutRef.current = null;
        }
        if (voiceState === "recording") onStopTalking();
    }, [voiceState, onStopTalking]);

    // ── Status indicator ─────────────────────────────────────────
    const statusDot = isConnected
        ? isRecording
            ? "bg-red-500 animate-pulse"
            : isResponding
                ? "bg-[#E50914] animate-pulse"
                : "bg-emerald-500"
        : "bg-white/20";

    const statusText = isRecording
        ? "Listening..."
        : isProcessing
            ? "Thinking..."
            : isResponding
                ? "Speaking..."
                : isConnected
                    ? "Ready"
                    : "Offline";

    if (!isOpen) return null;

    return (
        <div
            className="w-[380px] shrink-0 h-full flex flex-col border-l border-white/[0.06]"
            style={{ background: "#0a0a0a" }}
        >
            {/* ── Header ─────────────────────────────────────────── */}
            <div
                className="flex items-center justify-between px-5 py-4 shrink-0"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
            >
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{
                            background: "linear-gradient(135deg, rgba(229,9,20,0.15), rgba(229,9,20,0.05))",
                            border: "1px solid rgba(229,9,20,0.15)",
                        }}
                    >
                        <Sparkles size={14} className="text-[#E50914]" />
                    </div>
                    <div>
                        <h2 className="text-[13px] font-semibold text-white/90 tracking-tight">
                            AI Director
                        </h2>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${statusDot}`} />
                            <span className="text-[9px] text-white/30 uppercase tracking-wider font-medium">
                                {statusText}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    {isConnected && (
                        <button
                            onClick={onDisconnect}
                            className="w-7 h-7 rounded-md flex items-center justify-center text-white/20 hover:text-red-400/70 hover:bg-white/[0.04] transition-all cursor-pointer"
                            title="End session"
                        >
                            <MicOff size={13} />
                        </button>
                    )}
                    <button
                        onClick={onMinimize}
                        className="w-7 h-7 rounded-md flex items-center justify-center text-white/20 hover:text-white/50 hover:bg-white/[0.04] transition-all cursor-pointer"
                        title="Minimize"
                    >
                        <Minimize2 size={13} />
                    </button>
                    <button
                        onClick={onClose}
                        className="w-7 h-7 rounded-md flex items-center justify-center text-white/20 hover:text-white/50 hover:bg-white/[0.04] transition-all cursor-pointer"
                        title="Close"
                    >
                        <X size={13} />
                    </button>
                </div>
            </div>

            {/* ── Messages ────────────────────────────────────────── */}
            <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scrollbar-thin scrollbar-thumb-white/5">
                {messages.length === 0 && !assistantText && (
                    <div className="flex flex-col items-center justify-center h-full text-center px-6 opacity-60">
                        <div
                            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                            style={{
                                background: "linear-gradient(135deg, rgba(229,9,20,0.1), rgba(229,9,20,0.03))",
                                border: "1px solid rgba(229,9,20,0.08)",
                            }}
                        >
                            <Sparkles size={22} className="text-[#E50914]/50" />
                        </div>
                        <p className="text-[13px] text-white/50 leading-relaxed">
                            Your AI Director is ready to help.
                            <br />
                            Type a message or hold the mic to talk.
                        </p>
                        {!isConnected && (
                            <button
                                onClick={isLocked ? onUpgradeClick : () => onConnect()}
                                className="mt-4 px-4 py-2 rounded-lg text-[11px] font-medium transition-all cursor-pointer"
                                style={{
                                    background: "linear-gradient(135deg, rgba(229,9,20,0.2), rgba(229,9,20,0.08))",
                                    border: "1px solid rgba(229,9,20,0.15)",
                                    color: "rgba(229,9,20,0.8)",
                                }}
                            >
                                {isLocked ? "Upgrade to Pro" : "Start Session"}
                            </button>
                        )}
                    </div>
                )}

                {messages.map((msg) => (
                    <MessageBubble key={msg.id} message={msg} />
                ))}

                {/* Live assistant streaming text */}
                {assistantText && (
                    <div className="flex gap-2.5 items-start">
                        <div
                            className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5"
                            style={{
                                background: "linear-gradient(135deg, rgba(229,9,20,0.2), rgba(229,9,20,0.05))",
                                border: "1px solid rgba(229,9,20,0.12)",
                            }}
                        >
                            <Sparkles size={10} className="text-[#E50914]/70" />
                        </div>
                        <div
                            className="rounded-xl rounded-tl-sm px-3.5 py-2.5 max-w-[85%]"
                            style={{
                                background: "rgba(255,255,255,0.03)",
                                border: "1px solid rgba(255,255,255,0.05)",
                            }}
                        >
                            <p className="text-[13px] text-white/90 leading-relaxed">
                                {assistantText}
                                <span className="inline-block w-1.5 h-3.5 bg-[#E50914]/50 ml-1 animate-pulse rounded-sm" />
                            </p>
                        </div>
                    </div>
                )}

                {/* Thinking indicator — shows for both voice processing and text chat */}
                {isThinking && !assistantText && (
                    <div className="flex gap-2.5 items-center">
                        <div
                            className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                            style={{
                                background: "linear-gradient(135deg, rgba(229,9,20,0.2), rgba(229,9,20,0.05))",
                                border: "1px solid rgba(229,9,20,0.12)",
                            }}
                        >
                            <Loader2 size={10} className="text-[#E50914]/70 animate-spin" />
                        </div>
                        <div className="flex gap-1.5 items-center">
                            <span className="text-[11px] text-white/40">Thinking</span>
                            {[0, 1, 2].map((i) => (
                                <span
                                    key={i}
                                    className="w-1.5 h-1.5 rounded-full bg-white/30"
                                    style={{
                                        animation: `dotPulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* ── Error Banner ──────────────────────────────────── */}
            {errorMessage && (
                <div className="px-4 py-2 shrink-0" style={{ borderTop: "1px solid rgba(239,68,68,0.1)" }}>
                    <p className="text-[10px] text-red-400/70">{errorMessage}</p>
                </div>
            )}

            {/* ── Input Area ──────────────────────────────────────── */}
            <div
                className="px-4 py-3 shrink-0"
                style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
            >
                {/* Recording indicator */}
                {isRecording && (
                    <div className="flex items-center gap-2 mb-2 px-1">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-[10px] text-red-400/70 font-medium">Recording... release to send</span>
                        <div className="flex items-center gap-[2px] ml-auto">
                            {[...Array(5)].map((_, i) => (
                                <span
                                    key={i}
                                    className="w-[2px] bg-red-400/40 rounded-full"
                                    style={{
                                        height: `${6 + Math.random() * 10}px`,
                                        animation: `waveform ${0.3 + i * 0.1}s ease-in-out infinite alternate`,
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex flex-col gap-2 mb-2 px-1">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] text-white/40 uppercase tracking-widest font-semibold flex items-center gap-1.5">
                            Voice Persona
                        </span>
                        <select
                            value={selectedVoice}
                            onChange={(e) => onVoiceChange?.(e.target.value)}
                            className="bg-[#111] border border-white/10 text-white/80 text-[10px] rounded py-1 pl-1 pr-1 outline-none hover:border-white/20 focus:border-[#E50914]/50 transition-colors cursor-pointer w-[110px]"
                        >
                            <option value="coral">Coral (Default)</option>
                            <option value="alloy">Alloy (Neutral)</option>
                            <option value="echo">Echo (Warm)</option>
                            <option value="fable">Fable (British)</option>
                            <option value="onyx">Onyx (Deep)</option>
                            <option value="nova">Nova (Energetic)</option>
                            <option value="shimmer">Shimmer (Bright)</option>
                            <option value="ash">Ash (Soft)</option>
                            <option value="sage">Sage (Calm)</option>
                        </select>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {isAgentBusy ? (
                        /* ── Stop Agent Button ── */
                        <button
                            onClick={onStopAgent}
                            className="flex-1 flex items-center justify-center gap-2 rounded-xl px-3.5 transition-all cursor-pointer group"
                            style={{
                                background: "linear-gradient(135deg, rgba(239,68,68,0.15), rgba(239,68,68,0.05))",
                                border: "1px solid rgba(239,68,68,0.2)",
                                height: "42px",
                            }}
                        >
                            <span className="w-3 h-3 rounded-sm bg-red-500 group-hover:bg-red-400 transition-colors" />
                            <span className="text-[13px] font-medium text-red-400 group-hover:text-red-300 tracking-wide">
                                Stop Agent
                            </span>
                        </button>
                    ) : (
                        /* ── Normal Input ── */
                        <div
                            className="flex-1 flex items-center rounded-xl px-3.5 transition-all"
                            style={{
                                background: "rgba(255,255,255,0.03)",
                                border: "1px solid rgba(255,255,255,0.06)",
                                height: "42px",
                            }}
                        >
                            <input
                                ref={inputRef}
                                type="text"
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={
                                    isRecording
                                        ? "Listening..."
                                        : "Type a message..."
                                }
                                disabled={isRecording}
                                className="flex-1 bg-transparent text-[13px] text-white/90 placeholder:text-white/25 outline-none disabled:opacity-30"
                            />
                            {inputText.trim() && (
                                <button
                                    onClick={handleSend}
                                    className="ml-2 w-7 h-7 rounded-lg flex items-center justify-center text-[#E50914] hover:bg-[#E50914]/10 transition-all cursor-pointer"
                                >
                                    <Send size={13} />
                                </button>
                            )}
                        </div>
                    )}

                    {/* Mic Button */}
                    <button
                        onPointerDown={handleMicDown}
                        onPointerUp={handleMicUp}
                        onPointerLeave={handleMicUp}
                        className={`
                            w-[42px] h-[42px] rounded-xl flex items-center justify-center shrink-0 transition-all cursor-pointer select-none
                            ${isRecording ? "scale-110" : ""}
                        `}
                        style={{
                            background: isRecording
                                ? "linear-gradient(135deg, #E50914, #FF2D2D)"
                                : isConnected
                                    ? "linear-gradient(135deg, rgba(229,9,20,0.25), rgba(229,9,20,0.1))"
                                    : "rgba(255,255,255,0.04)",
                            border: isRecording
                                ? "1px solid rgba(229,9,20,0.5)"
                                : "1px solid rgba(255,255,255,0.06)",
                            boxShadow: isRecording
                                ? "0 0 20px rgba(229,9,20,0.3)"
                                : "none",
                        }}
                        title={
                            isLocked
                                ? "Upgrade to Pro"
                                : !isConnected
                                    ? "Click to connect"
                                    : voiceState === "ready"
                                        ? "Hold to talk"
                                        : ""
                        }
                    >
                        {voiceState === "connecting" ? (
                            <Loader2 size={16} className="text-white/50 animate-spin" />
                        ) : isRecording ? (
                            <Mic size={16} className="text-white animate-pulse" />
                        ) : isResponding ? (
                            <Volume2 size={16} className="text-[#E50914]/70" />
                        ) : (
                            <Mic size={16} className={isConnected ? "text-[#E50914]/70" : "text-white/25"} />
                        )}
                    </button>
                </div>

                {/* Hint */}
                {isConnected && voiceState === "ready" && !inputText && (
                    <p className="text-[8px] text-white/10 mt-1.5 px-1 font-mono tracking-wider">
                        Hold mic or press Space to talk · Type to chat
                    </p>
                )}
            </div>

            {/* ── Keyframes ── */}
            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes waveform {
                    0% { height: 4px; }
                    100% { height: 16px; }
                }
                @keyframes dotPulse {
                    0%, 100% { opacity: 0.2; transform: scale(0.8); }
                    50% { opacity: 0.8; transform: scale(1.2); }
                }
            ` }} />
        </div>
    );
}

// ── Message Bubble Component ─────────────────────────────────────

function MessageBubble({ message }: { message: ChatMessage }) {
    if (message.role === "action") {
        // Special rendering for thinking/planning messages
        if (message.text.startsWith("🧠")) {
            return (
                <div
                    className="mx-2 my-1.5 rounded-lg px-3 py-2.5"
                    style={{
                        background: "linear-gradient(135deg, rgba(139,92,246,0.1), rgba(59,130,246,0.06))",
                        border: "1px solid rgba(139,92,246,0.15)",
                    }}
                >
                    <div className="flex items-center gap-1.5 mb-1.5">
                        <span style={{ fontSize: "10px" }}>🧠</span>
                        <span style={{
                            fontSize: "9px",
                            fontWeight: 600,
                            color: "rgba(167,139,250,0.8)",
                            textTransform: "uppercase" as const,
                            letterSpacing: "0.1em",
                        }}>Thinking</span>
                    </div>
                    <p style={{
                        fontSize: "12px",
                        color: "rgba(255,255,255,0.55)",
                        lineHeight: "1.5",
                        fontStyle: "italic",
                        margin: 0,
                    }}>
                        {message.text.replace(/^🧠\s*/, "")}
                    </p>
                </div>
            );
        }

        const icon =
            message.actionStatus === "success" ? "✅" :
            message.actionStatus === "error" ? "❌" : "⏳";
        return (
            <div className="flex items-center gap-2 px-2 py-1.5">
                <span className="text-[11px]">{icon}</span>
                <span className="text-[11px] text-white/50 leading-snug">{message.text}</span>
            </div>
        );
    }

    if (message.role === "user") {
        return (
            <div className="flex justify-end">
                <div
                    className="rounded-xl rounded-br-sm px-3.5 py-2.5 max-w-[85%]"
                    style={{
                        background: "rgba(229,9,20,0.06)",
                        border: "1px solid rgba(229,9,20,0.08)",
                    }}
                >
                    <p className="text-[13px] text-white/90 leading-relaxed">{message.text}</p>
                </div>
            </div>
        );
    }

    // Assistant
    return (
        <div className="flex gap-2.5 items-start">
            <div
                className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5"
                style={{
                    background: "linear-gradient(135deg, rgba(229,9,20,0.2), rgba(229,9,20,0.05))",
                    border: "1px solid rgba(229,9,20,0.12)",
                }}
            >
                <Sparkles size={10} className="text-[#E50914]/70" />
            </div>
            <div
                className="rounded-xl rounded-tl-sm px-3.5 py-2.5 max-w-[85%]"
                style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.05)",
                }}
            >
                <p className="text-[13px] text-white/90 leading-relaxed">{message.text}</p>
            </div>
        </div>
    );
}
