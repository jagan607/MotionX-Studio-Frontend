"use client";

import React, { useState, useEffect } from "react";
import { BrainCircuit, Sparkles, Layers, Box, User, MapPin } from "lucide-react";
import { Project } from "@/lib/types";

/* ═══════════════════════════════════════════════════════════
   PHASE 3 SKELETON — Deep Asset Extraction Loading State
   ═══════════════════════════════════════════════════════════ */

const EXTRACTION_STEPS = [
    { icon: Layers,  label: "Committing scene structure" },
    { icon: User,    label: "Extracting characters" },
    { icon: MapPin,  label: "Extracting locations" },
    { icon: Box,     label: "Extracting props & products" },
    { icon: Sparkles, label: "Applying visual aesthetic" },
];

interface Phase3SkeletonProps {
    project: Project;
}

export function Phase3Skeleton({ project }: Phase3SkeletonProps) {
    const [activeStep, setActiveStep] = useState(0);
    const styleName = (project as any)?.moodboard_style?.name
        || (project as any)?.moodboard?.name
        || null;

    // Cycle through extraction steps
    useEffect(() => {
        const interval = setInterval(() => {
            setActiveStep(prev => (prev + 1) % EXTRACTION_STEPS.length);
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="absolute inset-0 flex items-center justify-center overflow-hidden">

            {/* ── Background layers ── */}
            <div className="absolute inset-0 bg-[#050505]" />

            {/* Wireframe grid */}
            <div className="absolute inset-0 opacity-[0.03]"
                style={{
                    backgroundImage: `
                        linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)
                    `,
                    backgroundSize: "80px 80px",
                    animation: "skeletonGridDrift 20s linear infinite",
                }} />

            {/* Ambient glow blobs */}
            <div className="absolute top-[20%] left-[30%] w-[500px] h-[400px] rounded-full blur-[150px] pointer-events-none"
                style={{
                    background: "radial-gradient(circle, rgba(229,9,20,0.06) 0%, transparent 70%)",
                    animation: "skeletonBreathe 8s ease-in-out infinite",
                }} />
            <div className="absolute bottom-[20%] right-[25%] w-[400px] h-[300px] rounded-full blur-[120px] pointer-events-none"
                style={{
                    background: "radial-gradient(circle, rgba(229,9,20,0.04) 0%, transparent 70%)",
                    animation: "skeletonBreathe 10s ease-in-out infinite 2s",
                }} />

            {/* Film grain */}
            <div className="absolute inset-0 opacity-[0.02] pointer-events-none"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
                    backgroundSize: "200px 200px",
                    animation: "skeletonGrain 0.5s steps(5) infinite",
                }} />

            {/* ── Central content ── */}
            <div className="relative z-10 flex flex-col items-center max-w-md px-8">

                {/* Pulsing brain icon */}
                <div className="relative w-20 h-20 mb-10 flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full border border-white/[0.04]" />
                    <div className="absolute inset-0 rounded-full border border-[#E50914]/30 border-t-transparent"
                        style={{ animation: "spin 2s linear infinite" }} />
                    <div className="absolute inset-2 rounded-full border border-[#E50914]/15 border-b-transparent"
                        style={{ animation: "spin 3s linear infinite reverse" }} />
                    <BrainCircuit size={22} className="text-[#E50914]"
                        style={{ animation: "skeletonBreathe 3s ease-in-out infinite" }} />
                </div>

                {/* Main heading */}
                <h2 className="text-white font-anton uppercase tracking-[3px] text-xl mb-2 text-center">
                    Deep Asset Extraction
                </h2>
                <p className="text-[10px] text-neutral-600 tracking-[1.5px] uppercase font-mono text-center mb-10">
                    Building your production workspace
                </p>

                {/* ── Step tracker ── */}
                <div className="w-full space-y-0 mb-8">
                    {EXTRACTION_STEPS.map((step, i) => {
                        const isActive = i === activeStep;
                        const isDone = i < activeStep;

                        return (
                            <div key={step.label}
                                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-700 ${
                                    isActive ? "bg-white/[0.03]" : ""
                                }`}>
                                {/* Step indicator */}
                                <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border transition-all duration-700 ${
                                    isDone
                                        ? "border-emerald-500/40 bg-emerald-500/10"
                                        : isActive
                                            ? "border-[#E50914]/40 bg-[#E50914]/10"
                                            : "border-white/[0.06] bg-transparent"
                                }`}>
                                    {isDone ? (
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                    ) : isActive ? (
                                        <step.icon size={10} className="text-[#E50914]"
                                            style={{ animation: "skeletonBreathe 2s ease-in-out infinite" }} />
                                    ) : (
                                        <div className="w-1 h-1 rounded-full bg-white/10" />
                                    )}
                                </div>

                                {/* Step label */}
                                <span className={`text-[10px] tracking-[1.5px] uppercase font-mono transition-all duration-700 ${
                                    isDone
                                        ? "text-emerald-400/50"
                                        : isActive
                                            ? "text-white/80"
                                            : "text-neutral-700"
                                }`}>
                                    {step.label}
                                </span>

                                {/* Active scan indicator */}
                                {isActive && (
                                    <div className="ml-auto w-16 h-[2px] bg-white/[0.04] rounded-full overflow-hidden">
                                        <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-[#E50914] to-transparent"
                                            style={{ animation: "skeletonScan 1.5s ease-in-out infinite" }} />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* ── Style glimpse card ── */}
                {styleName && (
                    <div className="w-full rounded-xl border border-[#E50914]/15 bg-[#E50914]/[0.03] backdrop-blur-sm px-5 py-4 overflow-hidden relative mb-8"
                        style={{ animation: "skeletonPulseGlow 4s ease-in-out infinite" }}>
                        {/* Inner scan line */}
                        <div className="absolute inset-0 overflow-hidden pointer-events-none">
                            <div className="absolute top-0 bottom-0 left-0 w-1/4 bg-gradient-to-r from-transparent via-[#E50914]/8 to-transparent"
                                style={{ animation: "skeletonScan 3s ease-in-out infinite" }} />
                        </div>
                        <div className="relative flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-[#E50914]/10 border border-[#E50914]/20 flex items-center justify-center shrink-0">
                                <Sparkles size={14} className="text-[#E50914]" />
                            </div>
                            <div>
                                <p className="text-[8px] text-[#E50914]/50 tracking-[2px] uppercase font-mono mb-0.5">
                                    Applying Aesthetic
                                </p>
                                <p className="text-[13px] text-white/80 font-medium tracking-wide">
                                    {styleName}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Skeleton wireframe preview ── */}
                <div className="w-full flex gap-3 mb-8 opacity-30">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="flex-1 rounded-lg border border-white/[0.06] bg-white/[0.02] overflow-hidden"
                            style={{ animationDelay: `${i * 0.3}s`, animation: "skeletonFadeIn 0.6s ease both" }}>
                            <div className="h-16 bg-white/[0.03]"
                                style={{ animation: "skeletonShimmer 2s ease-in-out infinite", animationDelay: `${i * 0.4}s` }} />
                            <div className="p-2 space-y-1.5">
                                <div className="h-1.5 w-3/4 rounded bg-white/[0.06]" />
                                <div className="h-1 w-1/2 rounded bg-white/[0.04]" />
                            </div>
                        </div>
                    ))}
                </div>

                {/* Bottom progress bar */}
                <div className="w-full h-[2px] bg-white/[0.04] rounded-full overflow-hidden">
                    <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-[#E50914] to-transparent"
                        style={{ animation: "skeletonScan 2s ease-in-out infinite" }} />
                </div>
            </div>

            {/* ── Keyframe animations ── */}
            <style jsx>{`
                @keyframes skeletonGridDrift {
                    from { transform: translate(0, 0); }
                    to   { transform: translate(80px, 80px); }
                }
                @keyframes skeletonBreathe {
                    0%, 100% { opacity: 1; }
                    50%      { opacity: 0.5; }
                }
                @keyframes skeletonGrain {
                    0%,100% { transform: translate(0,0); }
                    10%  { transform: translate(-2%,-2%); }
                    20%  { transform: translate(1%,3%); }
                    30%  { transform: translate(-3%,1%); }
                    40%  { transform: translate(3%,-1%); }
                    50%  { transform: translate(-1%,2%); }
                    60%  { transform: translate(2%,-3%); }
                    70%  { transform: translate(-2%,1%); }
                    80%  { transform: translate(1%,-2%); }
                    90%  { transform: translate(-1%,3%); }
                }
                @keyframes skeletonScan {
                    0%   { transform: translateX(-100%); }
                    100% { transform: translateX(400%); }
                }
                @keyframes skeletonPulseGlow {
                    0%, 100% { box-shadow: 0 0 15px rgba(229,9,20,0.06); }
                    50%      { box-shadow: 0 0 30px rgba(229,9,20,0.12); }
                }
                @keyframes skeletonShimmer {
                    0%, 100% { opacity: 0.3; }
                    50%      { opacity: 0.8; }
                }
                @keyframes skeletonFadeIn {
                    from { opacity: 0; transform: translateY(8px); }
                    to   { opacity: 0.3; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}
