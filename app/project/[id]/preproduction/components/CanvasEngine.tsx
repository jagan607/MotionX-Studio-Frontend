"use client";

import React, { useState, useRef, useCallback, useEffect, ReactNode } from "react";

interface CanvasTransform {
    x: number;
    y: number;
    scale: number;
}

export interface CanvasJumpTo {
    (worldX: number, worldY: number, scale?: number): void;
}

interface CanvasEngineProps {
    children: ReactNode;
    onTransformChange?: (transform: CanvasTransform) => void;
    initialTransform?: Partial<CanvasTransform>;
    /** Optional accent color from moodboard palette */
    accentColor?: string;
    /** Optional moodboard image to use as canvas background */
    backgroundImageUrl?: string | null;
    /** Called once with a jumpTo function that can center the canvas on world coords */
    onReady?: (jumpTo: CanvasJumpTo) => void;
}

const MIN_SCALE = 0.15;
const MAX_SCALE = 3;
const ZOOM_SENSITIVITY = 0.002;

export function CanvasEngine({ children, onTransformChange, initialTransform, accentColor = "rgba(229, 9, 20, 0.08)", backgroundImageUrl, onReady }: CanvasEngineProps) {
    const [transform, setTransform] = useState<CanvasTransform>({
        x: initialTransform?.x ?? 0,
        y: initialTransform?.y ?? 0,
        scale: initialTransform?.scale ?? 1,
    });

    // Expose jumpTo function to parent
    const readyFired = useRef(false);
    const jumpTo = useCallback((worldX: number, worldY: number, scale?: number) => {
        const container = containerRef.current;
        if (!container) return;
        const s = scale ?? 0.7;
        const cx = container.clientWidth / 2;
        const cy = container.clientHeight / 2;
        setTransform({ x: cx - worldX * s, y: cy - worldY * s, scale: s });
    }, []);

    useEffect(() => {
        if (onReady && !readyFired.current) {
            readyFired.current = true;
            onReady(jumpTo);
        }
    }, [onReady, jumpTo]);

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

    // --- KEYBOARD SHORTCUTS ---
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            // Don't trigger in input/textarea
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) return;

            const PAN_STEP = 80;
            switch (e.key) {
                case '=':
                case '+': {
                    e.preventDefault();
                    setTransform(prev => {
                        const newScale = Math.min(MAX_SCALE, prev.scale + 0.15);
                        // Zoom towards viewport center
                        const rect = containerRef.current?.getBoundingClientRect();
                        const cx = (rect?.width || 1200) / 2;
                        const cy = (rect?.height || 800) / 2;
                        const ratio = newScale / prev.scale;
                        return { scale: newScale, x: cx - ratio * (cx - prev.x), y: cy - ratio * (cy - prev.y) };
                    });
                    break;
                }
                case '-': {
                    e.preventDefault();
                    setTransform(prev => {
                        const newScale = Math.max(MIN_SCALE, prev.scale - 0.15);
                        const rect = containerRef.current?.getBoundingClientRect();
                        const cx = (rect?.width || 1200) / 2;
                        const cy = (rect?.height || 800) / 2;
                        const ratio = newScale / prev.scale;
                        return { scale: newScale, x: cx - ratio * (cx - prev.x), y: cy - ratio * (cy - prev.y) };
                    });
                    break;
                }
                case '0':
                    e.preventDefault();
                    setTransform({ x: 40, y: 20, scale: 0.55 });
                    break;
                case 'ArrowLeft':
                    setTransform(prev => ({ ...prev, x: prev.x + PAN_STEP }));
                    break;
                case 'ArrowRight':
                    setTransform(prev => ({ ...prev, x: prev.x - PAN_STEP }));
                    break;
                case 'ArrowUp':
                    setTransform(prev => ({ ...prev, y: prev.y + PAN_STEP }));
                    break;
                case 'ArrowDown':
                    setTransform(prev => ({ ...prev, y: prev.y - PAN_STEP }));
                    break;
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, []);

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

            {/* ── Dot grid (subtle, modern) ── */}
            <div
                className="absolute inset-0 pointer-events-none z-0 opacity-[0.06]"
                style={{
                    backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.4) 1px, transparent 1px)`,
                    backgroundSize: `${30 * transform.scale}px ${30 * transform.scale}px`,
                    backgroundPosition: `${transform.x % (30 * transform.scale)}px ${transform.y % (30 * transform.scale)}px`,
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
                @keyframes nodeEntrance {
                    0% { opacity: 0; transform: translateY(12px) scale(0.92); }
                    100% { opacity: 1; transform: translateY(0) scale(1); }
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
