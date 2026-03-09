"use client";

import React, { useState, useRef, useCallback, useEffect, ReactNode } from "react";

interface CanvasTransform {
    x: number;
    y: number;
    scale: number;
}

interface CanvasEngineProps {
    children: ReactNode;
    onTransformChange?: (transform: CanvasTransform) => void;
    initialTransform?: Partial<CanvasTransform>;
    /** Optional accent color from moodboard palette */
    accentColor?: string;
    /** Optional moodboard image to use as canvas background */
    backgroundImageUrl?: string | null;
}

const MIN_SCALE = 0.15;
const MAX_SCALE = 3;
const ZOOM_SENSITIVITY = 0.002;

export function CanvasEngine({ children, onTransformChange, initialTransform, accentColor = "rgba(229, 9, 20, 0.08)", backgroundImageUrl }: CanvasEngineProps) {
    const [transform, setTransform] = useState<CanvasTransform>({
        x: initialTransform?.x ?? 0,
        y: initialTransform?.y ?? 0,
        scale: initialTransform?.scale ?? 1,
    });

    const containerRef = useRef<HTMLDivElement>(null);
    const isPanning = useRef(false);
    const lastMouse = useRef({ x: 0, y: 0 });

    useEffect(() => {
        onTransformChange?.(transform);
    }, [transform, onTransformChange]);

    // --- PAN ---
    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        if (e.button === 1 || (e.button === 0 && e.target === e.currentTarget)) {
            isPanning.current = true;
            lastMouse.current = { x: e.clientX, y: e.clientY };
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            (e.currentTarget as HTMLElement).style.cursor = "grabbing";
            e.preventDefault();
        }
    }, []);

    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        if (!isPanning.current) return;
        const dx = e.clientX - lastMouse.current.x;
        const dy = e.clientY - lastMouse.current.y;
        lastMouse.current = { x: e.clientX, y: e.clientY };
        setTransform(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
    }, []);

    const handlePointerUp = useCallback((e: React.PointerEvent) => {
        if (isPanning.current) {
            isPanning.current = false;
            (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
            (e.currentTarget as HTMLElement).style.cursor = "";
        }
    }, []);

    // --- ZOOM ---
    const handleWheel = useCallback((e: WheelEvent) => {
        e.preventDefault();
        const container = containerRef.current;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        setTransform(prev => {
            const delta = -e.deltaY * ZOOM_SENSITIVITY;
            const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev.scale * (1 + delta)));
            const ratio = newScale / prev.scale;
            return { x: mouseX - ratio * (mouseX - prev.x), y: mouseY - ratio * (mouseY - prev.y), scale: newScale };
        });
    }, []);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        el.addEventListener("wheel", handleWheel, { passive: false });
        return () => el.removeEventListener("wheel", handleWheel);
    }, [handleWheel]);

    const zoomPercent = Math.round(transform.scale * 100);

    return (
        <div
            ref={containerRef}
            className="absolute inset-0 overflow-hidden select-none"
            style={{ cursor: "grab", background: "#080808" }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
        >
            {/* ── Moodboard background image ── */}
            {backgroundImageUrl && (
                <>
                    <div
                        className="absolute inset-0 z-0 pointer-events-none"
                        style={{
                            backgroundImage: `url(${backgroundImageUrl})`,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                            backgroundRepeat: "no-repeat",
                        }}
                    />
                    {/* Dark overlay so cards remain readable */}
                    <div className="absolute inset-0 z-0 bg-black/[0.88] pointer-events-none" />
                </>
            )}

            {/* ── Cork/felt texture background ── */}
            <div
                className="absolute inset-0 pointer-events-none z-0 opacity-[0.03]"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 128 128' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='5' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
                    backgroundSize: "200px 200px",
                }}
            />

            {/* ── Crosshatch grid (subtle, like a drafting table) ── */}
            <div
                className="absolute inset-0 pointer-events-none z-0 opacity-[0.04]"
                style={{
                    backgroundImage: `
                        linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)
                    `,
                    backgroundSize: `${40 * transform.scale}px ${40 * transform.scale}px`,
                    backgroundPosition: `${transform.x % (40 * transform.scale)}px ${transform.y % (40 * transform.scale)}px`,
                }}
            />

            {/* ── Film grain overlay ── */}
            <div
                className="absolute inset-0 pointer-events-none z-[1] opacity-[0.04]"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`,
                    backgroundSize: "128px 128px",
                }}
            />

            {/* ── Warm cinematic vignette ── */}
            <div
                className="absolute inset-0 pointer-events-none z-[2]"
                style={{
                    background: `
                        radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.7) 100%),
                        radial-gradient(ellipse at 15% 50%, ${accentColor}, transparent 50%),
                        radial-gradient(ellipse at 85% 50%, rgba(74,144,226,0.04), transparent 50%)
                    `,
                }}
            />

            {/* ── Slow-moving light leak ── */}
            <div
                className="absolute inset-0 pointer-events-none z-[2] opacity-[0.03]"
                style={{
                    background: `linear-gradient(135deg, transparent 40%, ${accentColor} 55%, transparent 70%)`,
                    animation: "lightLeak 20s ease-in-out infinite alternate",
                }}
            />
            <style>{`
                @keyframes lightLeak {
                    0% { transform: translateX(-20%) translateY(-10%); }
                    100% { transform: translateX(20%) translateY(10%); }
                }
            `}</style>

            {/* ── Transform Layer (all nodes live here) ── */}
            <div
                className="absolute origin-top-left z-[3]"
                style={{
                    transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                    willChange: "transform",
                }}
            >
                {children}
            </div>

            {/* ── Zoom controls ── */}
            <div className="absolute bottom-6 left-6 z-[10] flex items-center gap-3">
                <button
                    onClick={() => setTransform(prev => ({ ...prev, scale: Math.max(MIN_SCALE, prev.scale - 0.15) }))}
                    className="w-7 h-7 rounded bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] text-white/50 hover:text-white text-xs flex items-center justify-center transition-all"
                >−</button>
                <span className="text-[10px] font-mono text-white/30 tracking-wider w-10 text-center">{zoomPercent}%</span>
                <button
                    onClick={() => setTransform(prev => ({ ...prev, scale: Math.min(MAX_SCALE, prev.scale + 0.15) }))}
                    className="w-7 h-7 rounded bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] text-white/50 hover:text-white text-xs flex items-center justify-center transition-all"
                >+</button>
                <button
                    onClick={() => setTransform({ x: 40, y: 20, scale: 0.55 })}
                    className="ml-1 px-2.5 h-7 rounded bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] text-[9px] font-mono text-white/30 hover:text-white tracking-wider uppercase transition-all"
                >Fit</button>
            </div>
        </div>
    );
}

export type { CanvasTransform };
