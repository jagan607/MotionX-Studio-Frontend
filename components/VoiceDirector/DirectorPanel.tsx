/**
 * DirectorPanel.tsx
 *
 * Slide-out side panel for the AI Director — supports both voice and text chat.
 * Replaces the floating mic orb with a Cursor/Copilot-style conversation panel.
 */

"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import {
    Mic,
    MicOff,
    X,
    Minimize2,
    Send,
    Loader2,
    Square,
    Sparkles,
    ChevronRight,
} from "lucide-react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion } from 'framer-motion';
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
    onUpgradeClick,
    onSendText,
    messages,
    isAgentBusy,
    onStopAgent,
}: DirectorPanelProps) {
    const pathname = usePathname();
    const [inputText, setInputText] = useState("");
    const [isSending, setIsSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const isConnected = voiceState !== "idle" && voiceState !== "error";
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

    // Clear isSending when new messages arrive (reliable signal response was received)
    useEffect(() => {
        if (messages.length > 0) {
            const lastMsg = messages[messages.length - 1];
            if (lastMsg.role === "assistant") {
                setIsSending(false);
            }
        }
    }, [messages.length]);

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
        currentFinalTextRef.current = "";
        setIsSending(true);
        onSendText(text);
        // Reset textarea height
        if (inputRef.current) inputRef.current.style.height = 'auto';
    }, [inputText, onSendText]);

    // Auto-resize textarea when inputText changes externally (e.g., voice dictation)
    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.style.height = 'auto';
            inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 100) + 'px';
        }
    }, [inputText]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
            }
        },
        [handleSend]
    );

    // ── Local Speech Recognition (Click-to-Toggle) ────────────────
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef<any>(null);
    const currentFinalTextRef = useRef("");

    // Initialize SpeechRecognition on mount
    useEffect(() => {
        if (typeof window !== "undefined") {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            if (SpeechRecognition) {
                const recognition = new SpeechRecognition();
                recognition.continuous = true;
                recognition.interimResults = true;
                recognition.lang = "en-US";

                recognition.onstart = () => {
                    setIsListening(true);
                };

                recognition.onresult = (event: any) => {
                    let finalT = '';
                    let interimT = '';
                    for (let i = event.resultIndex; i < event.results.length; ++i) {
                        if (event.results[i].isFinal) {
                            finalT += event.results[i][0].transcript;
                        } else {
                            interimT += event.results[i][0].transcript;
                        }
                    }
                    if (finalT) {
                        currentFinalTextRef.current += finalT;
                    }
                    setInputText(currentFinalTextRef.current + interimT);
                };

                recognition.onerror = (event: any) => {
                    console.error("Speech recognition error", event.error);
                    setIsListening(false);
                };

                recognition.onend = () => {
                    setIsListening(false);
                };

                recognitionRef.current = recognition;
            }
        }
        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
        };
    }, []);

    const handleMicToggle = useCallback((e: React.PointerEvent | React.MouseEvent) => {
        e.preventDefault();
        if (isLocked) {
            onUpgradeClick();
            return;
        }
        // Mic requires an active session
        if (!isConnected) return;

        if (isListening) {
            recognitionRef.current?.stop();
        } else {
            if (!recognitionRef.current) {
                alert("Speech recognition is not supported in this browser. Please use Chrome or Safari.");
                return;
            }
            // Add a space before starting if there's already text
            const startingText = inputText ? inputText + " " : "";
            currentFinalTextRef.current = startingText;
            setInputText(startingText);
            try {
                recognitionRef.current.start();
            } catch (err) {
                console.error("Failed to start recognition", err);
            }
        }
    }, [isLocked, isListening, isConnected, inputText, onUpgradeClick]);

    // ── Keyboard shortcut: Cmd/Ctrl + Shift + M ──────────────────
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyboard = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'm') {
                e.preventDefault();
                if (!isConnected) return; // Mic requires active session
                if (isListening) {
                    recognitionRef.current?.stop();
                } else if (recognitionRef.current) {
                    const start = inputText ? inputText + " " : "";
                    currentFinalTextRef.current = start;
                    try { recognitionRef.current.start(); } catch {}
                }
            }
        };
        window.addEventListener('keydown', handleKeyboard);
        return () => window.removeEventListener('keydown', handleKeyboard);
    }, [isOpen, isListening, inputText]);

    // ── Status indicator ─────────────────────────────────────────
    const statusDot = isListening
        ? "bg-red-500 animate-pulse"
        : isResponding
            ? "bg-[#D40A12] animate-pulse"
            : isConnected
                ? "bg-emerald-500"
                : "bg-white/20";

    const statusText = isListening
        ? "Listening..."
        : isThinking
            ? "Thinking..."
            : isResponding
                ? "Responding..."
                : isConnected
                    ? "Ready"
                    : "Offline";

    if (!isOpen) return null;

    return (
        <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 35 }}
            className="w-[380px] shrink-0 h-full flex flex-col border-l border-white/[0.06] bg-[#111111]/70 backdrop-blur-2xl"
        >
            {/* ── Header ─────────────────────────────────────────── */}
            <div
                className="flex items-center justify-between px-5 py-4 shrink-0"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
            >
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{
                            background: "linear-gradient(135deg, rgba(212,10,18,0.2), rgba(212,10,18,0.08))",
                            border: "1px solid rgba(212,10,18,0.2)",
                        }}
                    >
                        <Sparkles size={14} className="text-[#D40A12]" />
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
                    <div className="flex flex-col items-center justify-center h-full text-center px-6">
                        <div
                            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                            style={{
                                background: "linear-gradient(135deg, rgba(212,10,18,0.2), rgba(212,10,18,0.08))",
                                border: "1px solid rgba(212,10,18,0.18)",
                            }}
                        >
                            <Sparkles size={22} className="text-[#D40A12]" />
                        </div>
                        <p className="text-[13px] text-white/70 leading-relaxed">
                            Your AI Director is ready to help.
                            <br />
                            Type a message or click the mic to dictate.
                        </p>
                        {!isConnected && (
                            <button
                                onClick={() => isLocked ? onUpgradeClick?.() : onConnect?.()}
                                className="mt-5 px-5 py-2.5 rounded-lg text-[12px] font-semibold transition-all cursor-pointer hover:brightness-110"
                                style={{
                                    background: "#D40A12",
                                    color: "#fff",
                                    boxShadow: "0 2px 12px rgba(212,10,18,0.3)",
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
                    <motion.div 
                        initial={{ opacity: 0, y: 10, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.3, type: "spring", stiffness: 200, damping: 20 }}
                        className="flex gap-2.5 items-start my-2"
                    >
                        <div
                            className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-1"
                            style={{
                                background: "linear-gradient(135deg, rgba(212,10,18,0.2), rgba(212,10,18,0.05))",
                                border: "1px solid rgba(212,10,18,0.12)",
                            }}
                        >
                            <Sparkles size={10} className="text-[#D40A12]/70" />
                        </div>
                        <div
                            className="rounded-xl rounded-tl-sm px-4 py-3 max-w-[90%] relative overflow-hidden backdrop-blur-md"
                            style={{
                                background: "linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))",
                                border: "1px solid rgba(255,255,255,0.1)",
                                borderLeft: "2px solid #D40A12",
                                boxShadow: "0 4px 24px rgba(0,0,0,0.2)"
                            }}
                        >
                            <div className="text-[13px] text-white/90 leading-relaxed flex items-end">
                                <div className="prose prose-invert prose-sm max-w-none prose-p:my-1 prose-p:leading-relaxed prose-strong:text-white prose-ul:my-1 prose-li:my-0.5">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {assistantText}
                                    </ReactMarkdown>
                                </div>
                                <span className="inline-block w-1.5 h-3.5 bg-[#D40A12]/50 ml-1 animate-pulse rounded-sm mb-1" />
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Thinking indicator — shows for both voice processing and text chat */}
                {isThinking && !assistantText && (
                    <div className="flex gap-2.5 items-center">
                        <div
                            className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                            style={{
                                background: "linear-gradient(135deg, rgba(212,10,18,0.2), rgba(212,10,18,0.05))",
                                border: "1px solid rgba(212,10,18,0.12)",
                            }}
                        >
                            <Loader2 size={10} className="text-[#D40A12]/70 animate-spin" />
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
                {/* Listening indicator */}
                {isListening && (
                    <div
                        className="flex items-center gap-2 mb-2.5 px-3 py-2 rounded-lg"
                        style={{
                            background: "linear-gradient(135deg, rgba(212,10,18,0.08), rgba(212,10,18,0.03))",
                            border: "1px solid rgba(212,10,18,0.15)",
                        }}
                    >
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                        <span className="text-[10px] text-red-400/80 font-medium flex-1">Listening — speak now</span>
                        <div className="flex items-center gap-[2px] mr-1">
                            {[0, 1, 2, 3, 4].map((i) => (
                                <span
                                    key={i}
                                    className="w-[2px] bg-red-400/50 rounded-full"
                                    style={{
                                        animation: `waveform ${0.3 + i * 0.1}s ease-in-out infinite alternate`,
                                    }}
                                />
                            ))}
                        </div>
                        <button
                            onClick={() => recognitionRef.current?.stop()}
                            className="w-6 h-6 rounded-md flex items-center justify-center transition-colors cursor-pointer shrink-0"
                            style={{
                                background: "rgba(212,10,18,0.15)",
                                border: "1px solid rgba(212,10,18,0.25)",
                            }}
                            title="Stop listening"
                        >
                            <Square size={8} className="text-red-400 fill-red-400" />
                        </button>
                    </div>
                )}

                {/* ── Context-Aware Suggestion Chips ── */}
                {(!isAgentBusy && isConnected) && (
                    <div className="flex flex-wrap gap-1.5 mb-3 px-1">
                        {pathname?.includes('/moodboard') ? (
                            <>
                                <button onClick={() => { setIsSending(true); onSendText('Make the lighting moody and cinematic'); }} className="px-2 py-1 text-[9px] bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.05] rounded-full text-white/60 transition-colors cursor-pointer">Make it cinematic</button>
                                <button onClick={() => { setIsSending(true); onSendText('Apply a cyberpunk aesthetic'); }} className="px-2 py-1 text-[9px] bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.05] rounded-full text-white/60 transition-colors cursor-pointer">Cyberpunk aesthetic</button>
                            </>
                        ) : pathname?.includes('/script') ? (
                            <>
                                <button onClick={() => { setIsSending(true); onSendText('Rewrite this scene to be more suspenseful'); }} className="px-2 py-1 text-[9px] bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.05] rounded-full text-white/60 transition-colors cursor-pointer">Make it suspenseful</button>
                                <button onClick={() => { setIsSending(true); onSendText('Add more dialogue here'); }} className="px-2 py-1 text-[9px] bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.05] rounded-full text-white/60 transition-colors cursor-pointer">Add dialogue</button>
                            </>
                        ) : pathname?.includes('/playground') ? (
                            <>
                                <button onClick={() => { setIsSending(true); onSendText('Generate a sci-fi establishing shot'); }} className="px-2 py-1 text-[9px] bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.05] rounded-full text-white/60 transition-colors cursor-pointer">Sci-fi shot</button>
                                <button onClick={() => { setIsSending(true); onSendText('Create a slow zoom on a character'); }} className="px-2 py-1 text-[9px] bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.05] rounded-full text-white/60 transition-colors cursor-pointer">Slow zoom</button>
                            </>
                        ) : (
                            <>
                                <button onClick={() => { setIsSending(true); onSendText('Help me start a new project'); }} className="px-2 py-1 text-[9px] bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.05] rounded-full text-white/60 transition-colors cursor-pointer">Start new project</button>
                                <button onClick={() => { setIsSending(true); onSendText('What can you do?'); }} className="px-2 py-1 text-[9px] bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.05] rounded-full text-white/60 transition-colors cursor-pointer">What can you do?</button>
                            </>
                        )}
                    </div>
                )}

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
                            className="flex-1 flex items-end rounded-xl px-3.5 py-2 transition-all"
                            style={{
                                background: "rgba(255,255,255,0.04)",
                                border: "1px solid rgba(255,255,255,0.08)",
                                minHeight: "42px",
                            }}
                        >
                            <textarea
                                ref={inputRef}
                                value={inputText}
                                onChange={(e) => {
                                    setInputText(e.target.value);
                                    currentFinalTextRef.current = e.target.value;
                                    // Auto-resize height
                                    e.target.style.height = 'auto';
                                    e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
                                }}
                                onKeyDown={handleKeyDown}
                                placeholder={
                                    isListening
                                        ? "Speak now — your words appear here..."
                                        : "Type a message..."
                                }
                                rows={1}
                                className={`flex-1 bg-transparent text-[13px] text-white/90 placeholder:text-white/25 outline-none resize-none leading-[1.5] overflow-y-auto scrollbar-none ${
                                    isListening ? "placeholder:text-red-400/40 placeholder:animate-pulse" : ""
                                }`}
                                style={{ maxHeight: '100px' }}
                            />
                            {inputText.trim() && (
                                <button
                                    onClick={() => {
                                        if (isListening) recognitionRef.current?.stop();
                                        handleSend();
                                    }}
                                    className="ml-2 w-7 h-7 rounded-lg flex items-center justify-center text-[#D40A12] hover:bg-[#D40A12]/10 transition-all cursor-pointer shrink-0 mb-0.5"
                                >
                                    <Send size={13} />
                                </button>
                            )}
                        </div>
                    )}

                    {/* Mic Button */}
                    <button
                        onClick={handleMicToggle}
                        disabled={!isConnected && !isListening}
                        className={`
                            w-[42px] h-[42px] rounded-xl flex items-center justify-center shrink-0 transition-all select-none
                            ${isListening ? "scale-110" : ""}
                            ${!isConnected ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}
                        `}
                        style={{
                            background: isListening
                                ? "linear-gradient(135deg, #D40A12, #FF2D2D)"
                                : isConnected
                                    ? "linear-gradient(135deg, rgba(212,10,18,0.25), rgba(212,10,18,0.1))"
                                    : "rgba(255,255,255,0.04)",
                            border: isListening
                                ? "1px solid rgba(212,10,18,0.5)"
                                : isConnected
                                    ? "1px solid rgba(212,10,18,0.15)"
                                    : "1px solid rgba(255,255,255,0.06)",
                            boxShadow: isListening
                                ? "0 0 20px rgba(212,10,18,0.3)"
                                : "none",
                        }}
                        title={
                            isLocked
                                ? "Upgrade to Pro"
                                : !isConnected
                                    ? "Start session first"
                                    : isListening
                                        ? "Click to stop listening"
                                        : "Click to dictate (⌘⇧M)"
                        }
                    >
                        {voiceState === "connecting" ? (
                            <Loader2 size={16} className="text-white/50 animate-spin" />
                        ) : isListening ? (
                            <MicOff size={16} className="text-white" />
                        ) : (
                            <Mic size={16} className={isConnected ? "text-[#D40A12]/70" : "text-white/20"} />
                        )}
                    </button>
                </div>

                {/* Hint */}
                {!inputText && !isListening && (
                    <p className="text-[8px] text-white/10 mt-1.5 px-1 font-mono tracking-wider">
                        Click mic or ⌘⇧M to dictate · Type to chat
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
        </motion.div>
    );
}

// ── Message Bubble Component ─────────────────────────────────────

function MessageBubble({ message }: { message: ChatMessage }) {
    if (message.role === "action") {
        // Special rendering for thinking/planning messages
        if (message.text.startsWith("🧠")) {
            return (
                <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
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
                </motion.div>
            );
        }

        return (
            <motion.div 
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                className="font-mono text-[10px] leading-relaxed tracking-tight py-1 px-2 border-l-2 border-[#D40A12]/40 ml-[34px] bg-black/20 rounded-r-md" 
                style={{ color: message.actionStatus === "success" ? "#4ade80" : message.actionStatus === "error" ? "#f87171" : "#a3a3a3" }}
            >
                <span className="opacity-40 mr-2">{">"}</span>
                {message.text}
                {message.actionStatus === "pending" && <span className="ml-2 animate-pulse bg-current w-1.5 h-2.5 inline-block align-middle" />}
                {message.actionStatus === "success" && <span className="ml-2 opacity-50 font-bold">[OK]</span>}
                {message.actionStatus === "error" && <span className="ml-2 opacity-50 font-bold">[ERR]</span>}
            </motion.div>
        );
    }

    if (message.role === "user") {
        return (
            <motion.div 
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.3, type: "spring", stiffness: 200, damping: 20 }}
                className="flex justify-end my-2"
            >
                <div
                    className="rounded-xl rounded-br-sm px-4 py-3 max-w-[85%] relative overflow-hidden"
                    style={{
                        background: "linear-gradient(135deg, rgba(212,10,18,0.15), rgba(212,10,18,0.05))",
                        border: "1px solid rgba(212,10,18,0.2)",
                        borderRight: "2px solid #D40A12",
                        boxShadow: "0 4px 24px rgba(212,10,18,0.1)"
                    }}
                >
                    <div className="text-[13px] text-white/90 leading-relaxed font-medium">
                        <div className="prose prose-invert prose-sm max-w-none prose-p:my-0.5 prose-p:leading-relaxed prose-strong:text-white prose-ul:my-1 prose-li:my-0">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {message.text}
                            </ReactMarkdown>
                        </div>
                    </div>
                </div>
            </motion.div>
        );
    }

    // Assistant
    return (
        <motion.div 
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.3, type: "spring", stiffness: 200, damping: 20 }}
            className="flex gap-2.5 items-start my-2"
        >
            <div
                className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-1"
                style={{
                    background: "linear-gradient(135deg, rgba(212,10,18,0.2), rgba(212,10,18,0.05))",
                    border: "1px solid rgba(212,10,18,0.12)",
                }}
            >
                <Sparkles size={10} className="text-[#D40A12]/70" />
            </div>
            <div
                className="rounded-xl rounded-tl-sm px-4 py-3 max-w-[90%] relative overflow-hidden backdrop-blur-md"
                style={{
                    background: "linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderLeft: "2px solid #D40A12",
                    boxShadow: "0 4px 24px rgba(0,0,0,0.2)"
                }}
            >
                <div className="text-[13px] text-white/90 leading-relaxed">
                    <div className="prose prose-invert prose-sm max-w-none prose-p:my-1 prose-p:leading-relaxed prose-strong:text-white prose-ul:my-1 prose-li:my-0.5 prose-a:text-[#D40A12]">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {message.text}
                        </ReactMarkdown>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
