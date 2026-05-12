/**
 * VoiceMicButton.tsx
 *
 * Floating mic orb with push-to-talk interaction.
 * States:
 *   idle       → Subtle glowing orb (click to connect)
 *   connecting → Pulsing connection animation
 *   ready      → Active orb (hold to talk)
 *   recording  → Expanded pill with waveform
 *   processing → Thinking indicator
 *   responding → Director avatar speaking with transcript
 *   locked     → Lock icon for free users
 */

"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, MicOff, Loader2, Lock, X, Volume2 } from "lucide-react";
import type { VoiceSessionState } from "./useVoiceDirector";

interface VoiceMicButtonProps {
    state: VoiceSessionState;
    assistantText: string;
    userText: string;
    errorMessage: string | null;
    isLocked: boolean;
    onConnect: () => void;
    onDisconnect: () => void;
    onStartTalking: () => void;
    onStopTalking: () => void;
    onUpgradeClick: () => void;
}

export default function VoiceMicButton({
    state,
    assistantText,
    userText,
    errorMessage,
    isLocked,
    onConnect,
    onDisconnect,
    onStartTalking,
    onStopTalking,
    onUpgradeClick,
}: VoiceMicButtonProps) {
    const [showTranscript, setShowTranscript] = useState(false);
    const holdTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isHoldingRef = useRef(false);

    // Show transcript when Director starts responding
    useEffect(() => {
        if (state === "responding" && assistantText) {
            setShowTranscript(true);
        }
    }, [state, assistantText]);

    // Auto-hide transcript after Director finishes
    useEffect(() => {
        if (state === "ready" && showTranscript) {
            const timer = setTimeout(() => setShowTranscript(false), 3000);
            return () => clearTimeout(timer);
        }
    }, [state, showTranscript]);

    // ── Push-to-Talk handlers ────────────────────────────────────────

    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        e.preventDefault();

        if (isLocked) {
            onUpgradeClick();
            return;
        }

        if (state === "idle" || state === "error") {
            onConnect();
            return;
        }

        if (state !== "ready") return;

        isHoldingRef.current = true;
        // Small delay to avoid accidental triggers
        holdTimeoutRef.current = setTimeout(() => {
            if (isHoldingRef.current) {
                onStartTalking();
            }
        }, 150);
    }, [state, isLocked, onConnect, onStartTalking, onUpgradeClick]);

    const handlePointerUp = useCallback(() => {
        isHoldingRef.current = false;
        if (holdTimeoutRef.current) {
            clearTimeout(holdTimeoutRef.current);
            holdTimeoutRef.current = null;
        }
        if (state === "recording") {
            onStopTalking();
        }
    }, [state, onStopTalking]);

    // Keyboard: hold Space to talk
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === "Space" && state === "ready" && !e.repeat) {
                // Only activate if no input element is focused
                const active = document.activeElement;
                const isInput = active instanceof HTMLInputElement ||
                    active instanceof HTMLTextAreaElement ||
                    active instanceof HTMLSelectElement ||
                    (active as HTMLElement)?.isContentEditable;
                if (isInput) return;

                e.preventDefault();
                isHoldingRef.current = true;
                onStartTalking();
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.code === "Space" && state === "recording") {
                e.preventDefault();
                isHoldingRef.current = false;
                onStopTalking();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("keyup", handleKeyUp);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("keyup", handleKeyUp);
        };
    }, [state, onStartTalking, onStopTalking]);

    // ── Disconnect button ────────────────────────────────────────────

    const handleDisconnect = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        onDisconnect();
        setShowTranscript(false);
    }, [onDisconnect]);

    // ── Render ────────────────────────────────────────────────────────

    const isExpanded = state === "recording" || state === "processing" || state === "responding";
    const isActive = state !== "idle" && state !== "error";

    return (
        <div className="fixed bottom-6 right-6 z-[200] flex flex-col items-end gap-3">
            {/* ── Transcript Bubble ── */}
            {showTranscript && assistantText && (
                <div
                    className="max-w-[320px] rounded-2xl px-4 py-3 border border-white/[0.08] animate-in fade-in slide-in-from-bottom-2 duration-300"
                    style={{
                        background: "linear-gradient(135deg, rgba(20,20,20,0.95), rgba(10,10,10,0.98))",
                        backdropFilter: "blur(20px)",
                        boxShadow: "0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(212,10,18,0.05)",
                    }}
                >
                    <div className="flex items-center gap-2 mb-1.5">
                        <Volume2 size={10} className="text-[#D40A12]/60" />
                        <span className="text-[8px] font-bold text-white/25 uppercase tracking-[2px]">
                            Director
                        </span>
                    </div>
                    <p className="text-[11.5px] text-white/60 leading-relaxed">
                        {assistantText}
                    </p>
                </div>
            )}

            {/* ── User Transcript (while recording) ── */}
            {state === "recording" && userText && (
                <div className="max-w-[280px] rounded-xl px-3 py-2 bg-[#D40A12]/[0.08] border border-[#D40A12]/15">
                    <p className="text-[10px] text-white/40 italic">{userText}</p>
                </div>
            )}

            {/* ── Error Message ── */}
            {errorMessage && state === "error" && (
                <div className="max-w-[280px] rounded-xl px-3 py-2 bg-red-500/[0.08] border border-red-500/20">
                    <p className="text-[10px] text-red-400/70">{errorMessage}</p>
                </div>
            )}

            {/* ── Main Mic Button / Pill ── */}
            <div className="flex items-center gap-2">
                {/* Disconnect button (when connected) */}
                {isActive && (
                    <button
                        onClick={handleDisconnect}
                        className="w-8 h-8 rounded-full flex items-center justify-center bg-white/[0.04] border border-white/[0.06] text-white/20 hover:text-white/50 hover:bg-white/[0.08] transition-all cursor-pointer"
                        title="End voice session"
                    >
                        <X size={12} />
                    </button>
                )}

                {/* The Orb / Pill */}
                <button
                    onPointerDown={handlePointerDown}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={handlePointerUp}
                    className={`
                        relative flex items-center justify-center transition-all duration-300 ease-out cursor-pointer select-none
                        ${isExpanded
                            ? "h-14 px-6 rounded-full gap-3"
                            : "w-14 h-14 rounded-full"
                        }
                    `}
                    style={{
                        background: state === "recording"
                            ? "linear-gradient(135deg, #D40A12, #FF2D2D)"
                            : state === "responding"
                                ? "linear-gradient(135deg, #D40A12, #B30710)"
                                : isLocked
                                    ? "linear-gradient(135deg, rgba(40,40,40,0.9), rgba(20,20,20,0.95))"
                                    : state === "connecting" || state === "processing"
                                        ? "linear-gradient(135deg, rgba(212,10,18,0.3), rgba(10,10,10,0.9))"
                                        : isActive
                                            ? "linear-gradient(135deg, rgba(212,10,18,0.6), rgba(139,0,0,0.8))"
                                            : "linear-gradient(135deg, rgba(212,10,18,0.15), rgba(10,10,10,0.95))",
                        boxShadow: state === "recording"
                            ? "0 0 40px rgba(212,10,18,0.5), 0 0 80px rgba(212,10,18,0.2), 0 4px 20px rgba(0,0,0,0.4)"
                            : state === "responding"
                                ? "0 0 30px rgba(212,10,18,0.3), 0 4px 20px rgba(0,0,0,0.4)"
                                : isActive
                                    ? "0 0 20px rgba(212,10,18,0.15), 0 4px 16px rgba(0,0,0,0.3)"
                                    : "0 4px 20px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06)",
                        border: state === "recording"
                            ? "2px solid rgba(212,10,18,0.6)"
                            : "1px solid rgba(255,255,255,0.08)",
                    }}
                    title={
                        isLocked
                            ? "Upgrade to Pro for Voice Director"
                            : state === "idle"
                                ? "Click to activate Voice Director"
                                : state === "ready"
                                    ? "Hold to talk (or hold Space)"
                                    : state === "recording"
                                        ? "Release to send"
                                        : ""
                    }
                >
                    {/* Pulse ring animation */}
                    {(state === "connecting" || state === "processing") && (
                        <span className="absolute inset-0 rounded-full animate-ping opacity-20 bg-[#D40A12]" />
                    )}

                    {/* Breathing glow for idle state */}
                    {state === "idle" && !isLocked && (
                        <span
                            className="absolute inset-0 rounded-full"
                            style={{
                                background: "radial-gradient(circle, rgba(212,10,18,0.15), transparent 70%)",
                                animation: "pulse 3s ease-in-out infinite",
                            }}
                        />
                    )}

                    {/* Icon */}
                    {isLocked ? (
                        <Lock size={20} className="text-white/30 relative z-10" />
                    ) : state === "connecting" ? (
                        <Loader2 size={20} className="text-white/70 animate-spin relative z-10" />
                    ) : state === "processing" ? (
                        <Loader2 size={20} className="text-white animate-spin relative z-10" />
                    ) : state === "recording" ? (
                        <>
                            <Mic size={18} className="text-white relative z-10 animate-pulse" />
                            {/* Waveform visualization */}
                            <div className="flex items-center gap-[3px] h-5 relative z-10">
                                {[...Array(5)].map((_, i) => (
                                    <span
                                        key={i}
                                        className="w-[3px] bg-white/80 rounded-full"
                                        style={{
                                            height: `${8 + Math.random() * 14}px`,
                                            animation: `waveform ${0.3 + i * 0.1}s ease-in-out infinite alternate`,
                                            animationDelay: `${i * 0.07}s`,
                                        }}
                                    />
                                ))}
                            </div>
                            <span className="text-[10px] text-white/70 font-semibold relative z-10 whitespace-nowrap">
                                Listening...
                            </span>
                        </>
                    ) : state === "responding" ? (
                        <>
                            <Volume2 size={18} className="text-white relative z-10" />
                            {/* Speaking animation */}
                            <div className="flex items-center gap-[3px] h-5 relative z-10">
                                {[...Array(4)].map((_, i) => (
                                    <span
                                        key={i}
                                        className="w-[3px] bg-white/60 rounded-full"
                                        style={{
                                            height: `${6 + Math.random() * 12}px`,
                                            animation: `waveform ${0.4 + i * 0.12}s ease-in-out infinite alternate`,
                                            animationDelay: `${i * 0.08}s`,
                                        }}
                                    />
                                ))}
                            </div>
                            <span className="text-[10px] text-white/60 font-semibold relative z-10 whitespace-nowrap">
                                Director
                            </span>
                        </>
                    ) : state === "error" ? (
                        <MicOff size={20} className="text-red-400/70 relative z-10" />
                    ) : (
                        <Mic size={20} className={`relative z-10 ${isActive ? "text-white" : "text-white/50"}`} />
                    )}
                </button>
            </div>

            {/* ── Hint Text ── */}
            {state === "ready" && (
                <p className="text-[8px] text-white/15 font-mono uppercase tracking-[1.5px] text-right mr-1 animate-in fade-in duration-500">
                    Hold to talk · Space
                </p>
            )}

            {isLocked && (
                <p className="text-[8px] text-white/15 font-mono uppercase tracking-[1.5px] text-right mr-1">
                    Pro Feature
                </p>
            )}

            {/* ── Waveform Keyframes ── */}
            <style jsx>{`
                @keyframes waveform {
                    0% { height: 4px; }
                    100% { height: 18px; }
                }
            `}</style>
        </div>
    );
}
