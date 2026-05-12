/**
 * DirectorToggle.tsx
 *
 * Small floating button (bottom-right) to open/close the AI Director panel.
 * Shows a subtle pulsing glow when the director is connected and active.
 */

"use client";

import { Sparkles, Lock, MessageCircle } from "lucide-react";
import type { VoiceSessionState } from "./useVoiceDirector";

interface DirectorToggleProps {
    isOpen: boolean;
    onClick: () => void;
    voiceState: VoiceSessionState;
    isLocked: boolean;
    hasUnread: boolean;
}

export default function DirectorToggle({
    isOpen,
    onClick,
    voiceState,
    isLocked,
    hasUnread,
}: DirectorToggleProps) {
    if (isOpen) return null;

    const isActive = voiceState !== "idle" && voiceState !== "error";
    const isRecording = voiceState === "recording";
    const isResponding = voiceState === "responding";

    return (
        <button
            onClick={onClick}
            className="fixed bottom-6 right-6 z-[200] w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 cursor-pointer select-none group"
            style={{
                background: isRecording
                    ? "linear-gradient(135deg, #E50914, #FF2D2D)"
                    : isResponding
                        ? "linear-gradient(135deg, rgba(229,9,20,0.6), rgba(139,0,0,0.8))"
                        : isActive
                            ? "linear-gradient(135deg, rgba(229,9,20,0.2), rgba(10,10,10,0.95))"
                            : "linear-gradient(135deg, rgba(20,20,20,0.95), rgba(10,10,10,0.98))",
                border: isRecording
                    ? "1px solid rgba(229,9,20,0.5)"
                    : "1px solid rgba(255,255,255,0.08)",
                boxShadow: isRecording
                    ? "0 0 30px rgba(229,9,20,0.4), 0 4px 20px rgba(0,0,0,0.4)"
                    : isActive
                        ? "0 0 15px rgba(229,9,20,0.1), 0 4px 16px rgba(0,0,0,0.3)"
                        : "0 4px 20px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04)",
            }}
            title="AI Director"
        >
            {/* Breathing glow */}
            {!isActive && !isLocked && (
                <span
                    className="absolute inset-0 rounded-2xl"
                    style={{
                        background: "radial-gradient(circle, rgba(229,9,20,0.1), transparent 70%)",
                        animation: "pulse 3s ease-in-out infinite",
                    }}
                />
            )}

            {/* Notification dot */}
            {hasUnread && !isOpen && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#E50914] border-2 border-[#0a0a0a] z-20" />
            )}

            {/* Icon */}
            {isLocked ? (
                <Lock size={18} className="text-white/30 relative z-10" />
            ) : (
                <Sparkles
                    size={18}
                    className={`relative z-10 transition-all ${
                        isActive
                            ? "text-[#E50914]"
                            : "text-white/40 group-hover:text-white/60"
                    }`}
                />
            )}
        </button>
    );
}
