"use client";

import { useState, useEffect, useMemo } from "react";
import { Zap, Clock, ArrowRight, X } from "lucide-react";
import { useCredits } from "@/hooks/useCredits";
import CreditModal from "@/app/components/modals/CreditModal";
import Link from "next/link";

/**
 * Persistent low-credit & expiry warning banner.
 * Shows when credits < 5 or when free credits expire within 3 days.
 * Renders inline (not fixed) — mount it where you want it to appear.
 */
export default function LowCreditBanner() {
    const { credits, plan, creditsExpireAt, freeCreditsExpired } = useCredits();
    const [showTopUp, setShowTopUp] = useState(false);
    const [dismissed, setDismissed] = useState(false);

    // Reset dismiss when credits change significantly
    useEffect(() => {
        setDismissed(false);
    }, [credits !== null && credits < 2]);

    const daysLeft = useMemo(() => {
        if (!creditsExpireAt) return null;
        const now = new Date();
        const diff = creditsExpireAt.getTime() - now.getTime();
        return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    }, [creditsExpireAt]);

    // Determine what to show
    const isLowCredits = credits !== null && credits > 0 && credits < 5;
    const isExpiringCredits = plan === "free" && daysLeft !== null && daysLeft <= 3 && daysLeft > 0 && !freeCreditsExpired;
    const isExpired = freeCreditsExpired || (daysLeft !== null && daysLeft === 0 && plan === "free");
    const isZeroCredits = credits !== null && credits === 0;

    // Don't show if not relevant
    if (dismissed) return null;
    if (!isLowCredits && !isExpiringCredits && !isExpired && !isZeroCredits) return null;
    // Don't show for paid users with decent credits
    if (plan !== "free" && credits !== null && credits >= 5) return null;

    // Priority: expired > zero > expiring > low
    let message = "";
    let urgency: "critical" | "warning" | "info" = "info";
    let icon = <Zap size={14} />;

    if (isExpired || (isZeroCredits && plan === "free")) {
        message = "Your free trial credits have expired. Buy credits to continue creating.";
        urgency = "critical";
        icon = <Clock size={14} />;
    } else if (isZeroCredits) {
        message = "You're out of credits. Top up to keep creating.";
        urgency = "critical";
        icon = <Zap size={14} />;
    } else if (isExpiringCredits) {
        message = `Your free credits expire in ${daysLeft} day${daysLeft === 1 ? "" : "s"}. Use them before they're gone!`;
        urgency = "warning";
        icon = <Clock size={14} />;
    } else if (isLowCredits) {
        message = `${credits} credit${credits === 1 ? "" : "s"} remaining. Top up to keep creating.`;
        urgency = "warning";
        icon = <Zap size={14} />;
    }

    const colors = {
        critical: {
            bg: "rgba(229, 9, 20, 0.08)",
            border: "rgba(229, 9, 20, 0.25)",
            text: "#ff6b6b",
            icon: "#E50914",
            glow: "0 0 20px rgba(229, 9, 20, 0.1)",
        },
        warning: {
            bg: "rgba(245, 166, 35, 0.06)",
            border: "rgba(245, 166, 35, 0.2)",
            text: "#F5A623",
            icon: "#F5A623",
            glow: "0 0 15px rgba(245, 166, 35, 0.08)",
        },
        info: {
            bg: "rgba(59, 130, 246, 0.06)",
            border: "rgba(59, 130, 246, 0.2)",
            text: "#60a5fa",
            icon: "#3B82F6",
            glow: "none",
        },
    };

    const c = colors[urgency];

    return (
        <>
            <CreditModal isOpen={showTopUp} onClose={() => setShowTopUp(false)} />
            <div
                className="flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-500"
                style={{
                    background: c.bg,
                    border: `1px solid ${c.border}`,
                    boxShadow: c.glow,
                    animation: urgency === "critical" ? "creditPulse 3s ease-in-out infinite" : undefined,
                }}
            >
                <div
                    className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
                    style={{ background: `${c.icon}15`, color: c.icon }}
                >
                    {icon}
                </div>
                <p className="flex-1 text-[11px] font-medium" style={{ color: c.text }}>
                    {message}
                </p>
                <div className="flex items-center gap-2 shrink-0">
                    <button
                        onClick={() => setShowTopUp(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider rounded-md transition-all cursor-pointer"
                        style={{
                            background: c.icon,
                            color: "#fff",
                            border: "none",
                        }}
                    >
                        Buy Credits
                    </button>
                    <Link
                        href="/pricing"
                        className="flex items-center gap-1 px-2 py-1.5 text-[9px] font-semibold uppercase tracking-wider rounded-md transition-all no-underline"
                        style={{ color: c.text, border: `1px solid ${c.border}` }}
                    >
                        Plans <ArrowRight size={9} />
                    </Link>
                    {!isExpired && !isZeroCredits && (
                        <button
                            onClick={() => setDismissed(true)}
                            className="p-1 rounded transition-colors cursor-pointer"
                            style={{ color: c.text, background: "none", border: "none", opacity: 0.5 }}
                        >
                            <X size={12} />
                        </button>
                    )}
                </div>
            </div>

            <style jsx>{`
                @keyframes creditPulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.85; }
                }
            `}</style>
        </>
    );
}
