"use client";

import React from "react";
import { Loader2 } from "@/lib/lucide";
import { TokenIcon } from "./TokenIcon";
import { formatCredits } from "@/app/hooks/usePricing";

// ─── Types ──────────────────────────────────────────────────────

interface CreditCTAProps {
    /** Button label text (e.g., "RETRY FRONT", "OVERHAUL DESIGN") */
    label: string;

    /** Credit cost. If 0, null, or undefined → renders as a standard CTA without token UI. */
    cost?: number | null;

    /** Click handler */
    onClick?: () => void;

    /** Disabled state */
    disabled?: boolean;

    /** Loading state — shows spinner and loading label */
    loading?: boolean;

    /** Label to show while loading (defaults to "PROCESSING...") */
    loadingLabel?: string;

    /** Optional leading icon (React node, e.g., <Sparkles size={12} />) */
    icon?: React.ReactNode;

    /**
     * Visual variant:
     * - "default"  → dark glass CTA (border-white/20, text-white)
     * - "primary"  → red accent CTA (bg-[#E50914]/15, border-[#E50914]/40)
     * - "ghost"    → minimal transparent CTA
     */
    variant?: "default" | "primary" | "ghost";

    /** Size preset */
    size?: "sm" | "md";

    /** Additional className overrides */
    className?: string;

    /** Full-width mode */
    fullWidth?: boolean;

    /** Tooltip / title attribute */
    title?: string;
}

// ─── Variant Styles ─────────────────────────────────────────────

const VARIANT_CLASSES: Record<string, string> = {
    default: [
        "bg-white/[0.04] text-white border border-white/[0.12]",
        "hover:bg-white/[0.08] hover:border-white/[0.25]",
    ].join(" "),
    primary: [
        "bg-[#E50914]/15 text-white border border-[#E50914]/40",
        "hover:bg-[#E50914]/25 hover:border-[#E50914]/60",
    ].join(" "),
    ghost: [
        "bg-transparent text-neutral-400 border border-transparent",
        "hover:text-white hover:bg-white/[0.05]",
    ].join(" "),
};

const SIZE_CLASSES: Record<string, string> = {
    sm: "px-3 py-1.5 text-[10px] gap-1.5 rounded-md",
    md: "px-4 py-2 text-[11px] gap-2 rounded-lg",
};

// ─── Component ──────────────────────────────────────────────────

/**
 * CreditCTA — Standardized button for any action that deducts credits.
 *
 * Layout:  [icon]  LABEL  |  ◎ 0.5       (when cost > 0)
 *          [icon]  LABEL                  (when cost = 0/null)
 *
 * The vertical separator and token icon only render when a non-zero
 * cost is provided, giving a graceful fallback for free actions.
 */
export const CreditCTA: React.FC<CreditCTAProps> = ({
    label,
    cost,
    onClick,
    disabled = false,
    loading = false,
    loadingLabel = "PROCESSING...",
    icon,
    variant = "default",
    size = "sm",
    className = "",
    fullWidth = false,
    title,
}) => {
    const isDisabled = disabled || loading;
    const hasCost = cost !== null && cost !== undefined && cost > 0;

    return (
        <button
            onClick={onClick}
            disabled={isDisabled}
            title={title}
            className={[
                // Base
                "inline-flex items-center justify-center font-bold uppercase tracking-wider",
                "transition-all select-none cursor-pointer",
                // Variant
                VARIANT_CLASSES[variant] || VARIANT_CLASSES.default,
                // Size
                SIZE_CLASSES[size] || SIZE_CLASSES.sm,
                // Width
                fullWidth ? "w-full" : "",
                // Disabled
                isDisabled ? "!opacity-40 !cursor-not-allowed" : "",
                // Overrides
                className,
            ].filter(Boolean).join(" ")}
        >
            {/* Leading icon or spinner */}
            {loading ? (
                <Loader2 size={size === "sm" ? 11 : 13} className="animate-spin shrink-0" />
            ) : icon ? (
                <span className="shrink-0 flex items-center">{icon}</span>
            ) : null}

            {/* Label */}
            <span className="truncate">
                {loading ? loadingLabel : label}
            </span>

            {/* Cost badge — only when cost > 0 and not loading */}
            {hasCost && !loading && (
                <>
                    {/* Separator */}
                    <span className="w-px h-3.5 bg-white/[0.15] shrink-0 mx-0.5" />

                    {/* Token + cost */}
                    <span className="inline-flex items-center gap-1 opacity-60 shrink-0">
                        <TokenIcon size={size === "sm" ? 10 : 11} />
                        <span className="font-mono text-[0.85em] tabular-nums">
                            {formatCredits(cost!)}
                        </span>
                    </span>
                </>
            )}
        </button>
    );
};

export default CreditCTA;
