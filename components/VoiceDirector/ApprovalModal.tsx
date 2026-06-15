/**
 * ApprovalModal.tsx
 *
 * Inline approval overlay for the AI Director panel.
 * Renders when the backend agent requests user approval for a
 * credit-consuming tool execution (e.g., image generation).
 *
 * Features:
 *   - Displays action description + credit cost
 *   - 30-second countdown timer (auto-declines on timeout)
 *   - Approve / Decline buttons
 *   - Glassmorphism styling matching the Director panel aesthetic
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, X } from "lucide-react";
import { TokenIcon } from "../ui/TokenIcon";

export interface PendingApproval {
    description: string;
    credit_cost: number;
}

interface ApprovalModalProps {
    pending: PendingApproval | null;
    onApprove: () => void;
    onDecline: () => void;
}

const TIMEOUT_SECONDS = 30;

export default function ApprovalModal({ pending, onApprove, onDecline }: ApprovalModalProps) {
    const [secondsLeft, setSecondsLeft] = useState(TIMEOUT_SECONDS);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    // Reset timer when a new approval request arrives
    useEffect(() => {
        if (!pending) {
            setSecondsLeft(TIMEOUT_SECONDS);
            if (intervalRef.current) clearInterval(intervalRef.current);
            return;
        }

        setSecondsLeft(TIMEOUT_SECONDS);
        intervalRef.current = setInterval(() => {
            setSecondsLeft((prev) => {
                if (prev <= 1) {
                    // Auto-decline on timeout
                    clearInterval(intervalRef.current!);
                    onDecline();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [pending, onDecline]);

    const handleApprove = useCallback(() => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        onApprove();
    }, [onApprove]);

    const handleDecline = useCallback(() => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        onDecline();
    }, [onDecline]);

    // Progress percentage for the countdown ring
    const progress = (secondsLeft / TIMEOUT_SECONDS) * 100;

    return (
        <AnimatePresence>
            {pending && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="absolute inset-0 z-50 flex items-center justify-center"
                    style={{
                        background: "rgba(0, 0, 0, 0.6)",
                        backdropFilter: "blur(8px)",
                    }}
                >
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.97 }}
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                        className="mx-4 w-full max-w-[320px] rounded-2xl overflow-hidden"
                        style={{
                            background: "linear-gradient(145deg, rgba(30,30,30,0.95), rgba(20,20,20,0.98))",
                            border: "1px solid rgba(255,255,255,0.08)",
                            boxShadow: "0 24px 80px rgba(0,0,0,0.5), 0 0 40px rgba(212,10,18,0.08)",
                        }}
                    >
                        {/* Header */}
                        <div
                            className="flex items-center gap-2.5 px-5 py-3.5"
                            style={{
                                background: "linear-gradient(135deg, rgba(212,10,18,0.1), rgba(212,10,18,0.03))",
                                borderBottom: "1px solid rgba(255,255,255,0.05)",
                            }}
                        >
                            <div
                                className="w-7 h-7 rounded-lg flex items-center justify-center"
                                style={{
                                    background: "linear-gradient(135deg, rgba(212,10,18,0.25), rgba(212,10,18,0.1))",
                                    border: "1px solid rgba(212,10,18,0.2)",
                                }}
                            >
                                <ShieldCheck size={13} className="text-[#D40A12]" />
                            </div>
                            <span className="text-[12px] font-semibold text-white/80 tracking-tight">
                                Approval Required
                            </span>

                            {/* Countdown */}
                            <div className="ml-auto flex items-center gap-1.5">
                                <div className="relative w-5 h-5">
                                    <svg className="w-5 h-5 -rotate-90" viewBox="0 0 20 20">
                                        <circle
                                            cx="10" cy="10" r="8"
                                            fill="none"
                                            stroke="rgba(255,255,255,0.06)"
                                            strokeWidth="2"
                                        />
                                        <circle
                                            cx="10" cy="10" r="8"
                                            fill="none"
                                            stroke={secondsLeft <= 10 ? "#ef4444" : "#D40A12"}
                                            strokeWidth="2"
                                            strokeDasharray={`${progress * 0.5027} 50.27`}
                                            strokeLinecap="round"
                                            className="transition-all duration-1000 ease-linear"
                                        />
                                    </svg>
                                </div>
                                <span
                                    className={`text-[10px] font-mono font-medium tabular-nums ${
                                        secondsLeft <= 10 ? "text-red-400" : "text-white/30"
                                    }`}
                                >
                                    {secondsLeft}s
                                </span>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="px-5 py-4 space-y-4">
                            {/* Description */}
                            <p className="text-[12px] text-white/60 leading-relaxed">
                                {pending.description}
                            </p>

                            {/* Cost badge */}
                            <div
                                className="flex items-center gap-2 px-3 py-2 rounded-lg"
                                style={{
                                    background: "rgba(255,255,255,0.03)",
                                    border: "1px solid rgba(255,255,255,0.06)",
                                }}
                            >
                                <span className="text-[10px] text-white/30 uppercase tracking-wider font-medium">
                                    Cost
                                </span>
                                <div className="ml-auto flex items-center gap-1.5">
                                    <span className="text-[14px] font-semibold text-white/90 tabular-nums">
                                        {pending.credit_cost}
                                    </span>
                                    <TokenIcon
                                        size={13}
                                        className="text-white/50"
                                        style={{ strokeWidth: 2.5 }}
                                    />
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2.5">
                                <button
                                    onClick={handleDecline}
                                    className="flex-1 py-2.5 rounded-lg text-[11px] font-semibold text-white/40 transition-all cursor-pointer hover:text-white/60 hover:bg-white/[0.06]"
                                    style={{
                                        background: "rgba(255,255,255,0.03)",
                                        border: "1px solid rgba(255,255,255,0.06)",
                                    }}
                                >
                                    Decline
                                </button>
                                <button
                                    onClick={handleApprove}
                                    className="flex-1 py-2.5 rounded-lg text-[11px] font-semibold text-white transition-all cursor-pointer hover:brightness-110"
                                    style={{
                                        background: "linear-gradient(135deg, #D40A12, #B00810)",
                                        border: "1px solid rgba(212,10,18,0.3)",
                                        boxShadow: "0 2px 12px rgba(212,10,18,0.25)",
                                    }}
                                >
                                    Approve
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
