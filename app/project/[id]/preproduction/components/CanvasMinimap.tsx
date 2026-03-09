"use client";

import React from "react";
import { CanvasTransform } from "./CanvasEngine";
import { NodePosition, NodeType } from "./CanvasNode";

interface MinimapNode {
    id: string;
    type: NodeType;
    position: NodePosition;
}

interface CanvasMinimapProps {
    nodes: MinimapNode[];
    transform: CanvasTransform;
    containerWidth: number;
    containerHeight: number;
    onJumpTo?: (x: number, y: number) => void;
}

const TYPE_COLORS: Record<NodeType, string> = {
    scene: "#FFFFFF",
    character: "#D4A843",
    location: "#4A90E2",
    moodboard: "#E50914",
    product: "#10B981",
};

export function CanvasMinimap({ nodes, transform, containerWidth, containerHeight, onJumpTo }: CanvasMinimapProps) {
    if (nodes.length === 0) return null;

    const MINIMAP_W = 160;
    const MINIMAP_H = 100;

    // Calculate bounds of all nodes
    const xs = nodes.map(n => n.position.x);
    const ys = nodes.map(n => n.position.y);
    const minX = Math.min(...xs) - 100;
    const maxX = Math.max(...xs) + 400;
    const minY = Math.min(...ys) - 100;
    const maxY = Math.max(...ys) + 400;

    const worldW = maxX - minX || 1;
    const worldH = maxY - minY || 1;

    const scaleX = MINIMAP_W / worldW;
    const scaleY = MINIMAP_H / worldH;
    const s = Math.min(scaleX, scaleY);

    // Viewport rectangle in minimap coords
    const vpX = (-transform.x / transform.scale - minX) * s;
    const vpY = (-transform.y / transform.scale - minY) * s;
    const vpW = (containerWidth / transform.scale) * s;
    const vpH = (containerHeight / transform.scale) * s;

    const handleClick = (e: React.MouseEvent) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const worldX = mx / s + minX;
        const worldY = my / s + minY;
        onJumpTo?.(worldX, worldY);
    };

    return (
        <div
            className="absolute bottom-6 right-6 z-[20] rounded-xl overflow-hidden border border-white/[0.08] bg-[#0A0A0A]/90 backdrop-blur-md shadow-2xl cursor-crosshair"
            style={{ width: MINIMAP_W, height: MINIMAP_H }}
            onClick={handleClick}
        >
            {/* Node dots */}
            {nodes.map(n => (
                <div
                    key={n.id}
                    className="absolute rounded-sm"
                    style={{
                        left: (n.position.x - minX) * s,
                        top: (n.position.y - minY) * s,
                        width: Math.max(4, (n.type === "location" ? 12 : 6)),
                        height: Math.max(3, (n.type === "scene" ? 4 : 6)),
                        backgroundColor: TYPE_COLORS[n.type],
                        opacity: 0.6,
                    }}
                />
            ))}

            {/* Viewport rect */}
            <div
                className="absolute border border-white/40 rounded-sm"
                style={{
                    left: Math.max(0, vpX),
                    top: Math.max(0, vpY),
                    width: Math.min(vpW, MINIMAP_W),
                    height: Math.min(vpH, MINIMAP_H),
                }}
            />

            {/* Label */}
            <span className="absolute bottom-1 right-2 text-[7px] font-mono text-white/20 tracking-widest uppercase">MAP</span>
        </div>
    );
}
