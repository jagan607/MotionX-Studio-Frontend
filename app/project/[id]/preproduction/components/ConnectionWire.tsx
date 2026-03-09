"use client";

import React from "react";

interface WireProps {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    color?: string;
}

function ConnectionWire({ x1, y1, x2, y2, color = "rgba(212, 168, 67, 0.5)" }: WireProps) {
    const dx = x2 - x1;
    const dy = y2 - y1;

    // String-like Bézier: slight droop to simulate gravity/slack
    const tension = Math.min(Math.abs(dx) * 0.45, 200);
    const sag = Math.min(Math.abs(dy) * 0.08 + 15, 40); // slight downward sag

    const cp1x = x1 + tension;
    const cp1y = y1 + sag;
    const cp2x = x2 - tension;
    const cp2y = y2 + sag;

    const d = `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;

    return (
        <g>
            {/* Shadow/depth underneath */}
            <path
                d={d}
                fill="none"
                stroke="rgba(0,0,0,0.4)"
                strokeWidth={4}
                style={{ filter: "blur(4px)" }}
            />
            {/* Glow aura */}
            <path
                d={d}
                fill="none"
                stroke={color}
                strokeWidth={5}
                style={{ filter: "blur(8px)" }}
                opacity={0.35}
            />
            {/* Core string */}
            <path
                d={d}
                fill="none"
                stroke={color}
                strokeWidth={2.5}
                strokeLinecap="round"
            />
            {/* Pin dot at start */}
            <circle cx={x1} cy={y1} r={4} fill={color} opacity={0.6} />
            {/* Pin dot at end */}
            <circle cx={x2} cy={y2} r={4} fill={color} opacity={0.6} />
        </g>
    );
}

export interface WireData {
    x1: number; y1: number;
    x2: number; y2: number;
    color?: string;
}

interface WireLayerProps {
    wires: WireData[];
}

export function WireLayer({ wires }: WireLayerProps) {
    if (wires.length === 0) return null;
    return (
        <svg
            className="absolute pointer-events-none"
            style={{ top: 0, left: 0, width: "10000px", height: "10000px", overflow: "visible" }}
        >
            {wires.map((w, i) => (
                <ConnectionWire key={i} {...w} />
            ))}
        </svg>
    );
}
