"use client";

import React, { useEffect, useRef, useState, memo } from "react";
import { Film } from "lucide-react";

interface ScriptProcessingLoaderProps {
    logs: string[];
}

const STATUS_PHASES = [
    "Parsing screenplay structure",
    "Extracting dialogue and action",
    "Analyzing characters",
    "Mapping scene locations",
    "Building scene graph",
    "Indexing visual cues",
    "Sequencing narrative arcs",
    "Compiling shot references",
];

interface Particle {
    x: number; y: number;
    size: number; opacity: number; speed: number;
    angle: number; distance: number; baseDistance: number;
    hue: number; phaseOffset: number;
}

const PARTICLE_COUNT = 30;

const ScriptProcessingLoader: React.FC<ScriptProcessingLoaderProps> = memo(({ logs }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animRef = useRef<number>(0);
    const particlesRef = useRef<Particle[]>([]);
    const timeRef = useRef(0);


    const [phaseIndex, setPhaseIndex] = useState(0);
    const [displayedText, setDisplayedText] = useState("");
    const logsContainerRef = useRef<HTMLDivElement>(null);
    const [isTyping, setIsTyping] = useState(true);

    useEffect(() => {
        if (logsContainerRef.current) {
            logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
        }
    }, [logs]);

    // Typewriter
    useEffect(() => {
        const phrase = STATUS_PHASES[phaseIndex % STATUS_PHASES.length];
        let idx = 0;
        setDisplayedText("");
        setIsTyping(true);
        const iv = setInterval(() => {
            idx++;
            setDisplayedText(phrase.slice(0, idx));
            if (idx >= phrase.length) { clearInterval(iv); setIsTyping(false); }
        }, 40);
        return () => clearInterval(iv);
    }, [phaseIndex]);

    useEffect(() => {
        if (!isTyping) {
            const t = setTimeout(() => setPhaseIndex(p => p + 1), 3200);
            return () => clearTimeout(t);
        }
    }, [isTyping]);

    // Canvas
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const dpr = window.devicePixelRatio || 1;

        const resize = () => {
            const p = canvas.parentElement;
            if (!p) return;
            const r = p.getBoundingClientRect();
            canvas.width = r.width * dpr;
            canvas.height = r.height * dpr;
            canvas.style.width = r.width + "px";
            canvas.style.height = r.height + "px";
        };
        resize();
        const obs = new ResizeObserver(resize);
        if (canvas.parentElement) obs.observe(canvas.parentElement);

        const w = () => canvas.width / dpr;
        const h = () => canvas.height / dpr;

        particlesRef.current = Array.from({ length: PARTICLE_COUNT }, (_, i) => {
            const angle = (i / PARTICLE_COUNT) * Math.PI * 2 + Math.random() * 0.5;
            const layer = Math.random();
            const baseDistance = 20 + layer * Math.min(w(), h()) * 0.4;
            return {
                x: 0, y: 0,
                size: 0.3 + layer * 1.2,
                opacity: 0.06 + Math.random() * 0.3,
                speed: 0.2 + (1 - layer) * 0.4,
                angle, distance: baseDistance, baseDistance,
                hue: Math.random() > 0.7 ? 20 + Math.random() * 15 : 0,
                phaseOffset: Math.random() * Math.PI * 2,
            };
        });

        const animate = () => {
            if (!ctx || !canvas) return;
            timeRef.current += 0.016;
            const t = timeRef.current;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.fillStyle = "rgba(3, 3, 3, 0.14)";
            ctx.fillRect(0, 0, w(), h());

            const cx = w() / 2, cy = h() / 2;

            // Glow
            const breathe = 0.5 + 0.5 * Math.sin(t * 0.5);
            const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 50 + breathe * 25);
            glow.addColorStop(0, `rgba(229, 9, 20, ${0.1 * breathe})`);
            glow.addColorStop(0.5, `rgba(255, 80, 40, ${0.025 * breathe})`);
            glow.addColorStop(1, "rgba(0, 0, 0, 0)");
            ctx.fillStyle = glow;
            ctx.fillRect(0, 0, w(), h());

            particlesRef.current.forEach((p) => {
                p.angle += 0.0015 * p.speed;
                const td = p.baseDistance * (0.7 + 0.3 * (0.5 + 0.5 * Math.sin(t * 0.25 + p.phaseOffset)));
                p.distance += (td - p.distance) * 0.01;
                const tx = cx + Math.cos(p.angle) * p.distance;
                const ty = cy + Math.sin(p.angle) * p.distance * 0.5;
                p.x += (tx - p.x) * 0.04;
                p.y += (ty - p.y) * 0.04;
                const pulse = 0.5 + 0.5 * Math.sin(t * 0.9 + p.phaseOffset);
                const alpha = p.opacity * pulse;

                if (p.size > 0.6) {
                    ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 2.5, 0, Math.PI * 2);
                    ctx.fillStyle = `hsla(${p.hue}, 90%, 50%, ${alpha * 0.04})`;
                    ctx.fill();
                }
                ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fillStyle = `hsla(${p.hue}, 85%, 55%, ${alpha})`;
                ctx.fill();
            });

            // Scanline
            const scanY = (t * 25) % h();
            const sg = ctx.createLinearGradient(0, scanY - 15, 0, scanY + 15);
            sg.addColorStop(0, "rgba(229, 9, 20, 0)");
            sg.addColorStop(0.5, "rgba(229, 9, 20, 0.025)");
            sg.addColorStop(1, "rgba(229, 9, 20, 0)");
            ctx.fillStyle = sg;
            ctx.fillRect(0, scanY - 15, w(), 30);

            animRef.current = requestAnimationFrame(animate);
        };
        animate();

        return () => { cancelAnimationFrame(animRef.current); obs.disconnect(); };
    }, []);

    return (
        <div className="w-full h-32 rounded-lg overflow-hidden border border-white/[0.06] bg-[#030303] relative">
            {/* Canvas */}
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-0" />

            {/* Top glow line */}
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-red-600/30 to-transparent z-20" />

            {/* Content */}
            <div className="relative z-10 flex flex-col h-full">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.04] bg-black/40 backdrop-blur-sm shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Film size={12} className="text-motion-red" />
                            <div className="absolute inset-0 animate-ping">
                                <Film size={12} className="text-motion-red opacity-30" />
                            </div>
                        </div>
                        <span className="text-[9px] font-bold text-white/80 uppercase tracking-[0.2em]">Processing</span>
                    </div>
                    <div className="flex items-center gap-1">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="w-1 h-1 rounded-full border border-white/10 bg-white/[0.03]"
                                style={{ animation: `pulse 2s ease-in-out ${i * 0.3}s infinite` }} />
                        ))}
                    </div>
                </div>

                {/* Body — split: status left, logs right */}
                <div className="flex-1 flex min-h-0">
                    {/* Status area */}
                    <div className="w-[220px] shrink-0 flex flex-col items-center justify-center px-4 border-r border-white/[0.03]">
                        <div className="relative mb-2">
                            <div className="w-7 h-7 rounded-full border border-red-500/20 flex items-center justify-center">
                                <div className="w-3 h-3 rounded-full bg-red-600/30 animate-pulse" />
                            </div>
                            <div className="absolute inset-0 rounded-full border border-red-500/10 animate-ping" style={{ animationDuration: "3s" }} />
                        </div>
                        <p className="text-[11px] font-semibold text-white/90 tracking-wide text-center min-h-[16px] leading-tight">
                            {displayedText}
                            <span className={`inline-block w-[1.5px] h-[12px] bg-red-500 ml-0.5 align-middle ${isTyping ? 'animate-pulse' : 'opacity-0'}`} />
                        </p>
                        <p className="text-[8px] font-mono text-neutral-700 uppercase tracking-[0.2em] mt-1">MotionX Engine v2.0</p>
                    </div>

                    {/* Log feed */}
                    <div ref={logsContainerRef} className="flex-1 overflow-y-auto px-4 py-2 space-y-0.5 scrollbar-hide bg-black/30">
                        {logs.length === 0 ? (
                            <div className="h-full flex items-center justify-center">
                                <span className="text-[9px] font-mono text-neutral-700 tracking-widest">AWAITING DATA STREAM...</span>
                            </div>
                        ) : (
                            <>
                                {logs.map((log, i) => (
                                    <div key={i} className="flex items-start gap-1.5 text-[10px] font-mono animate-in fade-in slide-in-from-bottom-1 duration-200">
                                        <span className={`shrink-0 mt-px ${i === logs.length - 1 ? 'text-green-500' : 'text-neutral-700'}`}>
                                            {i === logs.length - 1 ? '▸' : '·'}
                                        </span>
                                        <span className={`leading-relaxed ${i === logs.length - 1 ? 'text-green-400/90 font-semibold' : 'text-neutral-500'}`}>
                                            {log}
                                        </span>
                                    </div>
                                ))}

                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
});

ScriptProcessingLoader.displayName = "ScriptProcessingLoader";
export default ScriptProcessingLoader;
