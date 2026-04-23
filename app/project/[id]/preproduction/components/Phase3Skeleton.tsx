"use client";

import React, { useState, useEffect, useMemo } from "react";
import { BrainCircuit, Sparkles, Layers, User, MapPin, Film, Camera, Palette, Zap, Eye } from "lucide-react";
import { Project } from "@/lib/types";

/* ═══════════════════════════════════════════════════════════
   PHASE 3 SKELETON — Cinematic Processing Experience
   ═══════════════════════════════════════════════════════════ */

const EXTRACTION_STEPS = [
    { icon: Layers,   label: "Processing your script",      sub: "Breaking down scenes, arcs, and structure" },
    { icon: Palette,  label: "Crafting visual directions",   sub: "Generating cinematic mood options for you" },
    { icon: User,     label: "Identifying characters",       sub: "Analyzing dialogue and character dynamics" },
    { icon: MapPin,   label: "Mapping locations",            sub: "Building environments from scene descriptions" },
    { icon: Sparkles, label: "Almost ready",                 sub: "Finalizing your visual world" },
];

const CINEMA_FACTS = [
    { icon: Film,   text: "The average Marvel film has 2,500+ VFX shots — MotionX handles yours in minutes" },
    { icon: Camera, text: "AI is choosing camera angles, lens types, and framing for each scene" },
    { icon: Eye,    text: "Your characters are being designed with consistent features across all shots" },
    { icon: Palette,text: "Color grading and visual mood are being baked into every asset" },
    { icon: Zap,    text: "What used to take a pre-production team weeks, you're doing in seconds" },
    { icon: Sparkles,text: "Each location is generated with lighting that matches your story's mood" },
    { icon: Film,   text: "Professional films spend $50K+ on pre-production — yours costs zero credits" },
    { icon: Camera, text: "AI cinematography draws from 100+ years of filmmaking techniques" },
];

interface Phase3SkeletonProps {
    project: Project;
}

export function Phase3Skeleton({ project }: Phase3SkeletonProps) {
    const [activeStep, setActiveStep] = useState(0);
    const [progress, setProgress] = useState(0);
    const [factIndex, setFactIndex] = useState(0);
    const [factFading, setFactFading] = useState(false);

    const styleName = project?.moodboard_style?.name
        || project?.moodboard?.name
        || null;

    // Simulate progress — skeleton shows during moodboard generation (~10-20s)
    useEffect(() => {
        const timer = setInterval(() => {
            setProgress(prev => {
                if (prev >= 88) return 88; // Cap — real completion triggers redirect
                return prev + Math.random() * 3.5 + 1.5;
            });
        }, 600);
        return () => clearInterval(timer);
    }, []);

    // Step cycling based on progress
    useEffect(() => {
        const stepIdx = Math.min(Math.floor(progress / 20), EXTRACTION_STEPS.length - 1);
        setActiveStep(stepIdx);
    }, [progress]);

    // Fun fact rotation
    useEffect(() => {
        const timer = setInterval(() => {
            setFactFading(true);
            setTimeout(() => {
                setFactIndex(prev => (prev + 1) % CINEMA_FACTS.length);
                setFactFading(false);
            }, 300);
        }, 5000);
        return () => clearInterval(timer);
    }, []);

    const currentFact = CINEMA_FACTS[factIndex];

    // Generate floating particle positions (stable across renders)
    const particles = useMemo(() =>
        Array.from({ length: 30 }, (_, i) => ({
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            size: Math.random() * 3 + 1,
            delay: Math.random() * 8,
            duration: Math.random() * 6 + 6,
            opacity: Math.random() * 0.3 + 0.05,
        })), []);

    return (
        <div className="absolute inset-0 flex items-center justify-center overflow-hidden">

            {/* ── Background layers ── */}
            <div className="absolute inset-0 bg-[#050505]" />

            {/* Wireframe grid — drifting */}
            <div className="absolute inset-0 opacity-[0.025]"
                style={{
                    backgroundImage: `
                        linear-gradient(rgba(229,9,20,0.08) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(229,9,20,0.08) 1px, transparent 1px)
                    `,
                    backgroundSize: "100px 100px",
                    animation: "skeletonGridDrift 25s linear infinite",
                }} />

            {/* Rotating ambient glow */}
            <div className="absolute inset-0 pointer-events-none"
                style={{ animation: "skeletonOrbitGlow 15s linear infinite" }}>
                <div className="absolute top-[30%] left-[40%] w-[600px] h-[400px] rounded-full blur-[180px]"
                    style={{ background: "radial-gradient(circle, rgba(229,9,20,0.08) 0%, transparent 70%)" }} />
            </div>
            <div className="absolute inset-0 pointer-events-none"
                style={{ animation: "skeletonOrbitGlow 20s linear infinite reverse" }}>
                <div className="absolute bottom-[25%] right-[30%] w-[500px] h-[350px] rounded-full blur-[150px]"
                    style={{ background: "radial-gradient(circle, rgba(212,168,67,0.04) 0%, transparent 70%)" }} />
            </div>

            {/* Floating particles */}
            {particles.map((p, i) => (
                <div key={i} className="absolute rounded-full pointer-events-none"
                    style={{
                        left: p.left,
                        top: p.top,
                        width: p.size,
                        height: p.size,
                        background: i % 3 === 0 ? "#E50914" : i % 3 === 1 ? "#D4A843" : "white",
                        opacity: p.opacity,
                        animation: `skeletonFloat ${p.duration}s ease-in-out ${p.delay}s infinite`,
                    }} />
            ))}

            {/* Film grain */}
            <div className="absolute inset-0 opacity-[0.015] pointer-events-none"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
                    backgroundSize: "200px 200px",
                    animation: "skeletonGrain 0.5s steps(5) infinite",
                }} />

            {/* ── Central content ── */}
            <div className="relative z-10 flex flex-col items-center max-w-lg px-8 w-full">

                {/* Animated icon cluster */}
                <div className="relative w-24 h-24 mb-8 flex items-center justify-center">
                    {/* Outer ring */}
                    <svg className="absolute inset-0 w-full h-full" style={{ animation: "spin 8s linear infinite" }}>
                        <circle cx="48" cy="48" r="44" fill="none" stroke="rgba(229,9,20,0.08)" strokeWidth="1" />
                        <circle cx="48" cy="48" r="44" fill="none" stroke="#E50914" strokeWidth="1.5"
                            strokeDasharray="276.46" strokeDashoffset={276.46 - (progress / 100) * 276.46}
                            strokeLinecap="round" className="transition-all duration-1000" />
                    </svg>
                    {/* Middle ring */}
                    <svg className="absolute inset-2 w-[calc(100%-16px)] h-[calc(100%-16px)]" style={{ animation: "spin 6s linear infinite reverse" }}>
                        <circle cx="40" cy="40" r="36" fill="none" stroke="rgba(229,9,20,0.05)" strokeWidth="0.5" strokeDasharray="4 8" />
                    </svg>
                    {/* Center icon */}
                    <div className="relative">
                        <BrainCircuit size={26} className="text-[#E50914]"
                            style={{ animation: "skeletonBreathe 3s ease-in-out infinite" }} />
                    </div>
                </div>

                {/* Progress percentage */}
                <div className="mb-2">
                    <span className="text-[32px] font-['Anton'] text-white/90 tabular-nums tracking-wider">
                        {Math.floor(progress)}%
                    </span>
                </div>

                {/* Current step label */}
                <div className="text-center mb-8">
                    <h2 className="text-white font-semibold text-[15px] tracking-wide mb-1 transition-all duration-500">
                        {EXTRACTION_STEPS[activeStep].label}
                    </h2>
                    <p className="text-[10px] text-white/25 font-mono tracking-wider">
                        {EXTRACTION_STEPS[activeStep].sub}
                    </p>
                </div>

                {/* ── Step pips ── */}
                <div className="flex items-center gap-2 mb-10">
                    {EXTRACTION_STEPS.map((step, i) => {
                        const isDone = i < activeStep;
                        const isActive = i === activeStep;
                        return (
                            <div key={i} className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full transition-all duration-700 ${
                                    isDone ? "bg-emerald-400 scale-100" :
                                    isActive ? "bg-[#E50914] scale-125" :
                                    "bg-white/10 scale-100"
                                }`}
                                    style={{
                                        boxShadow: isActive ? "0 0 12px rgba(229,9,20,0.5)" :
                                                   isDone ? "0 0 8px rgba(52,211,153,0.3)" : "none",
                                    }}
                                />
                                {i < EXTRACTION_STEPS.length - 1 && (
                                    <div className={`w-8 h-[1px] transition-all duration-700 ${
                                        isDone ? "bg-emerald-400/30" : "bg-white/[0.06]"
                                    }`} />
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* ── Ghost preview cards ── */}
                <div className="w-full flex gap-3 mb-10">
                    {[
                        { label: "Character", icon: User, delay: 0 },
                        { label: "Scene", icon: Film, delay: 0.3 },
                        { label: "Location", icon: MapPin, delay: 0.6 },
                    ].map((card, i) => (
                        <div key={card.label}
                            className="flex-1 rounded-xl border border-white/[0.06] bg-white/[0.015] overflow-hidden"
                            style={{ animation: `skeletonCardPop 0.6s ease ${card.delay}s both` }}>
                            {/* Image placeholder with shimmer */}
                            <div className="h-20 relative overflow-hidden bg-white/[0.02]">
                                <div className="absolute inset-0"
                                    style={{
                                        background: "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.03) 50%, transparent 70%)",
                                        backgroundSize: "200% 100%",
                                        animation: `skeletonShimmer 2.5s ease-in-out ${i * 0.4}s infinite`,
                                    }} />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <card.icon size={16} className="text-white/[0.06]" />
                                </div>
                            </div>
                            <div className="p-2.5 space-y-1.5">
                                <div className="h-2 w-16 rounded-full bg-white/[0.06]"
                                    style={{ animation: `skeletonShimmer 2s ease-in-out ${i * 0.3}s infinite` }} />
                                <div className="h-1.5 w-10 rounded-full bg-white/[0.03]" />
                            </div>
                        </div>
                    ))}
                </div>

                {/* ── Cinema fun fact ── */}
                <div className={`w-full rounded-xl border border-white/[0.05] bg-white/[0.015] px-5 py-4 transition-all duration-300 ${factFading ? "opacity-0 translate-y-1" : "opacity-100 translate-y-0"}`}>
                    <div className="flex items-start gap-3">
                        <div className="w-7 h-7 rounded-lg bg-[#E50914]/[0.06] border border-[#E50914]/10 flex items-center justify-center shrink-0 mt-0.5">
                            <currentFact.icon size={13} className="text-[#E50914]/60" />
                        </div>
                        <div>
                            <p className="text-[8px] text-[#E50914]/40 tracking-[2px] uppercase font-mono mb-1">Did you know?</p>
                            <p className="text-[11px] text-white/35 leading-relaxed">{currentFact.text}</p>
                        </div>
                    </div>
                </div>

                {/* ── Style tag ── */}
                {styleName && (
                    <div className="mt-4 flex items-center gap-2 px-4 py-2 rounded-full border border-[#D4A843]/15 bg-[#D4A843]/[0.03]"
                        style={{ animation: "skeletonPulseGlow 4s ease-in-out infinite" }}>
                        <Sparkles size={10} className="text-[#D4A843]/60" />
                        <span className="text-[9px] text-[#D4A843]/50 font-mono tracking-wider">Style: {styleName}</span>
                    </div>
                )}
            </div>

            {/* ── Keyframe animations ── */}
            <style jsx>{`
                @keyframes skeletonGridDrift {
                    from { transform: translate(0, 0); }
                    to   { transform: translate(100px, 100px); }
                }
                @keyframes skeletonOrbitGlow {
                    from { transform: rotate(0deg); }
                    to   { transform: rotate(360deg); }
                }
                @keyframes skeletonBreathe {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50%      { opacity: 0.5; transform: scale(0.95); }
                }
                @keyframes skeletonGrain {
                    0%,100% { transform: translate(0,0); }
                    10%  { transform: translate(-2%,-2%); }
                    20%  { transform: translate(1%,3%); }
                    30%  { transform: translate(-3%,1%); }
                    40%  { transform: translate(3%,-1%); }
                    50%  { transform: translate(-1%,2%); }
                }
                @keyframes skeletonFloat {
                    0%, 100% { transform: translateY(0px) scale(1); opacity: var(--float-opacity, 0.1); }
                    50%      { transform: translateY(-30px) scale(1.5); opacity: 0; }
                }
                @keyframes skeletonShimmer {
                    0%   { background-position: 200% center; }
                    100% { background-position: -200% center; }
                }
                @keyframes skeletonCardPop {
                    from { opacity: 0; transform: translateY(12px) scale(0.95); }
                    to   { opacity: 1; transform: translateY(0) scale(1); }
                }
                @keyframes skeletonPulseGlow {
                    0%, 100% { box-shadow: 0 0 15px rgba(212,168,67,0.04); }
                    50%      { box-shadow: 0 0 30px rgba(212,168,67,0.08); }
                }
            `}</style>
        </div>
    );
}
