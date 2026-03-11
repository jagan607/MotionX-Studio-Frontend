"use client";

import React from "react";

interface WireProps {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    color?: string;
}

let wireIdCounter = 0;

function ConnectionWire({ x1, y1, x2, y2, color = "rgba(212, 168, 67, 0.5)" }: WireProps) {
    const dx = x2 - x1;
    const dy = y2 - y1;

    // String-like Bézier: slight droop to simulate gravity/slack
    const tension = Math.min(Math.abs(dx) * 0.45, 200);
    const sag = Math.min(Math.abs(dy) * 0.08 + 15, 40);

    const cp1x = x1 + tension;
    const cp1y = y1 + sag;
    const cp2x = x2 - tension;
    const cp2y = y2 + sag;

    const d = `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;

    // Unique IDs for gradients
    const gradId = `wire-grad-${wireIdCounter}`;
    const glowId = `wire-glow-${wireIdCounter}`;
    wireIdCounter++;

    return (
        <g>
            {/* Gradient definition */}
            <defs>
                <linearGradient id={gradId} x1={x1} y1={y1} x2={x2} y2={y2} gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor={color} stopOpacity={0.15} />
                    <stop offset="40%" stopColor={color} stopOpacity={0.7} />
                    <stop offset="60%" stopColor={color} stopOpacity={0.7} />
                    <stop offset="100%" stopColor={color} stopOpacity={0.15} />
                </linearGradient>
                <filter id={glowId}>
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>

            {/* Shadow/depth underneath */}
            <path
                d={d}
                fill="none"
                stroke="rgba(0,0,0,0.3)"
                strokeWidth={4}
                style={{ filter: "blur(4px)" }}
            />

            {/* Glow aura */}
            <path
                d={d}
                fill="none"
                stroke={color}
                strokeWidth={6}
                style={{ filter: "blur(10px)" }}
                opacity={0.25}
            />

            {/* Core wire with gradient */}
            <path
                d={d}
                fill="none"
                stroke={`url(#${gradId})`}
                strokeWidth={2}
                strokeLinecap="round"
            />

            {/* Animated flowing dash overlay */}
            <path
                d={d}
                fill="none"
                stroke={color}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeDasharray="6 14"
                opacity={0.6}
                style={{
                    animation: "wireDashFlow 2s linear infinite",
                }}
            />

            {/* Pulsing pin dot at start */}
            <circle cx={x1} cy={y1} r={3.5} fill={color} opacity={0.5}>
                <animate attributeName="r" values="3;4.5;3" dur="2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.4;0.8;0.4" dur="2s" repeatCount="indefinite" />
            </circle>

            {/* Pulsing pin dot at end */}
            <circle cx={x2} cy={y2} r={3.5} fill={color} opacity={0.5}>
                <animate attributeName="r" values="3;4.5;3" dur="2s" begin="0.5s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.4;0.8;0.4" dur="2s" begin="0.5s" repeatCount="indefinite" />
            </circle>
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
            <style>{`
                @keyframes wireDashFlow {
                    0% { stroke-dashoffset: 20; }
                    100% { stroke-dashoffset: 0; }
                }
            `}</style>
            {wires.map((w, i) => (
                <ConnectionWire key={i} {...w} />
            ))}
        </svg>
    );
}
