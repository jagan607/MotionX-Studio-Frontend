"use client";

import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X, Rocket, ArrowRight, Lock } from "@/lib/lucide";
import { useFreeTierLimit } from "@/app/context/FreeTierLimitContext";
import { useEffect } from "react";

// ── Limit-Type → User-Friendly Message Map ──────────────────────────
const LIMIT_TYPE_MESSAGES: Record<string, { headline: string; icon: string }> = {
    projects_created: {
        headline: "You've reached your free project limit",
        icon: "📁",
    },
    asset_images_generated: {
        headline: "You've reached your free asset image limit",
        icon: "🎨",
    },
    production_shots_generated: {
        headline: "You've reached your free production shot limit",
        icon: "🎬",
    },
    videos_generated: {
        headline: "You've reached your free video generation limit",
        icon: "🎥",
    },
    playground_images_generated: {
        headline: "You've reached your free Playground limit",
        icon: "🎨",
    },
    moodboards_free: {
        headline: "Unlock all moodboard options",
        icon: "🎭",
    },
    ai_director: {
        headline: "AI Director is a Pro feature",
        icon: "🎬",
    },
};

const DEFAULT_MESSAGE = {
    headline: "You've reached your free plan limit for this feature",
    icon: "🚀",
};

export default function UpgradeModal() {
    const { isOpen, limitType, detail, currentUsage, usageLimit, closeUpgradeModal } =
        useFreeTierLimit();
    const router = useRouter();

    // Lock body scroll when modal is open
    useEffect(() => {
        if (isOpen) document.body.style.overflow = "hidden";
        else document.body.style.overflow = "unset";
        return () => {
            document.body.style.overflow = "unset";
        };
    }, [isOpen]);

    // Close on Escape key
    useEffect(() => {
        if (!isOpen) return;
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") closeUpgradeModal();
        };
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [isOpen, closeUpgradeModal]);

    const msg = limitType
        ? LIMIT_TYPE_MESSAGES[limitType] || DEFAULT_MESSAGE
        : DEFAULT_MESSAGE;

    const handleUpgrade = () => {
        closeUpgradeModal();
        router.push("/pricing");
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="fixed inset-0 z-[200] flex items-center justify-center p-4"
                    onClick={closeUpgradeModal}
                >
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

                    {/* Modal Card */}
                    <motion.div
                        initial={{ scale: 0.92, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.92, opacity: 0, y: 20 }}
                        transition={{ type: "spring", damping: 25, stiffness: 350 }}
                        onClick={(e) => e.stopPropagation()}
                        className="relative w-full max-w-md overflow-hidden"
                        style={{
                            background: "linear-gradient(180deg, #141414 0%, #0A0A0A 100%)",
                            border: "1px solid rgba(255,255,255,0.08)",
                            borderRadius: "16px",
                            boxShadow:
                                "0 0 80px rgba(212, 10, 18, 0.08), 0 25px 50px rgba(0,0,0,0.6)",
                        }}
                    >
                        {/* Top Glow Accent */}
                        <div
                            className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 rounded-b-full"
                            style={{
                                background:
                                    "linear-gradient(90deg, transparent, #D40A12, transparent)",
                                opacity: 0.6,
                            }}
                        />

                        {/* Close Button */}
                        <button
                            onClick={closeUpgradeModal}
                            className="absolute top-4 right-4 p-1.5 rounded-full text-[#555] hover:text-white hover:bg-white/5 transition-all z-10"
                            aria-label="Close"
                        >
                            <X size={18} />
                        </button>

                        {/* Content */}
                        <div className="px-8 pt-10 pb-8 flex flex-col items-center text-center">
                            {/* Icon */}
                            <div
                                className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl mb-6"
                                style={{
                                    background:
                                        "linear-gradient(135deg, rgba(212,10,18,0.15), rgba(212,10,18,0.05))",
                                    border: "1px solid rgba(212,10,18,0.2)",
                                }}
                            >
                                <Lock size={24} className="text-[#D40A12]" />
                            </div>

                            {/* Headline */}
                            <h2 className="text-xl font-bold text-white mb-2 tracking-tight">
                                {msg.headline}
                            </h2>

                            {/* Sub-message */}
                            <p className="text-[13px] text-[#888] leading-relaxed max-w-[320px] mb-5">
                                {detail ||
                                    "Upgrade to Pro to unlock unlimited access and continue creating."}
                            </p>

                            {/* Usage Indicator */}
                            {usageLimit > 0 && (
                                <div
                                    className="w-full max-w-[280px] mb-6 rounded-xl px-5 py-3.5"
                                    style={{
                                        background: "rgba(255,255,255,0.03)",
                                        border: "1px solid rgba(255,255,255,0.06)",
                                    }}
                                >
                                    <div className="flex items-center justify-between mb-2.5">
                                        <span className="text-[10px] font-semibold text-[#666] uppercase tracking-[1.5px]">
                                            Usage
                                        </span>
                                        <span className="text-[11px] font-mono font-bold text-[#D40A12]">
                                            {currentUsage} / {usageLimit}
                                        </span>
                                    </div>
                                    <div className="w-full h-1.5 bg-[#1A1A1A] rounded-full overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{
                                                width: `${Math.min(
                                                    (currentUsage / usageLimit) * 100,
                                                    100
                                                )}%`,
                                            }}
                                            transition={{
                                                duration: 0.8,
                                                ease: "easeOut",
                                                delay: 0.2,
                                            }}
                                            className="h-full rounded-full"
                                            style={{
                                                background:
                                                    "linear-gradient(90deg, #D40A12, #FF4444)",
                                            }}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* CTA Buttons */}
                            <div className="flex flex-col gap-3 w-full max-w-[280px]">
                                <button
                                    onClick={handleUpgrade}
                                    className="w-full flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl text-white text-[12px] font-bold tracking-[1.5px] uppercase transition-all hover:brightness-110 active:scale-[0.98]"
                                    style={{
                                        background:
                                            "linear-gradient(135deg, #D40A12, #B00810)",
                                        boxShadow:
                                            "0 4px 20px rgba(212,10,18,0.3), inset 0 1px 0 rgba(255,255,255,0.1)",
                                    }}
                                >
                                    <Rocket size={15} />
                                    Upgrade to Pro
                                    <ArrowRight size={14} className="opacity-60" />
                                </button>

                                <button
                                    onClick={closeUpgradeModal}
                                    className="w-full px-6 py-3 rounded-xl text-[#666] text-[11px] font-semibold tracking-[1px] uppercase transition-all hover:text-[#999] hover:bg-white/[0.03]"
                                >
                                    Maybe Later
                                </button>
                            </div>
                        </div>

                        {/* Bottom Ambient Glow */}
                        <div
                            className="absolute bottom-0 left-1/2 -translate-x-1/2 w-64 h-32 rounded-full pointer-events-none"
                            style={{
                                background:
                                    "radial-gradient(ellipse, rgba(212,10,18,0.06) 0%, transparent 70%)",
                            }}
                        />
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
