"use client";

import React from "react";

interface TokenIconProps {
    /** Icon size in pixels. Defaults to 12. */
    size?: number;
    /** Additional CSS class names */
    className?: string;
    /** Inline style overrides */
    style?: React.CSSProperties;
}

/**
 * TokenIcon — THE single source of truth for the credit/coin graphic.
 *
 * Every CTA, badge, or label that displays a credit cost MUST use this
 * component instead of importing icons directly from lucide-react.
 *
 * To update the token graphic across the entire product, modify the
 * SVG paths below — no other file needs to change.
 */
export const TokenIcon: React.FC<TokenIconProps> = ({
    size = 12,
    className = "",
    style,
}) => (
    <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        style={style}
    >
        {/* Coins — matches lucide-react Coins glyph */}
        <circle cx="8" cy="8" r="6" />
        <path d="M18.09 10.37A6 6 0 1 1 10.34 18" />
        <path d="M7 6h1v4" />
        <path d="m16.71 13.88.7.71-2.82 2.82" />
    </svg>
);

export default TokenIcon;
