"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "@/lib/firebase";
import Link from "next/link";
import {
    Loader2, Clapperboard, Camera, Film,
    ArrowLeft, ChevronRight, Lock, Sparkles,
    Users, MapPin, Palette, FileText,
    Play, Scissors, Workflow, Upload,
    Clock, Layers, MonitorPlay, Zap
} from "lucide-react";

interface ProjectData {
    title: string;
    type: string;
    genre?: string;
    aspect_ratio?: string;
    style?: string;
    script_status?: string;
    created_at?: any;
    thumbnail_url?: string;
}

export default function ProjectHub() {
    const router = useRouter();
    const params = useParams();
    const projectId = params.id as string;
    const [project, setProject] = useState<ProjectData | null>(null);
    const [loading, setLoading] = useState(true);
    const [counts, setCounts] = useState({ characters: 0, locations: 0, scenes: 0, shots: 0, generatedShots: 0, animatedShots: 0 });

    useEffect(() => {
        if (!projectId) return;
        let cancelled = false;

        // Wait for Firebase Auth to be fully ready before touching Firestore.
        // During client-side navigation, auth.currentUser may exist but the
        // Firestore SDK's internal auth-token pipeline can still be mid-sync,
        // causing getDoc() to hang indefinitely on the channel connection.
        const unsubAuth = onAuthStateChanged(auth, async (user) => {
            if (!user || cancelled) return;
            unsubAuth(); // Only need the first emission

            try {
                // Timeout safety net — if Firestore still hangs, don't spin forever
                const snap = await Promise.race([
                    getDoc(doc(db, "projects", projectId)),
                    new Promise<never>((_, reject) =>
                        setTimeout(() => reject(new Error("Firestore getDoc timeout")), 8000)
                    ),
                ]);
                if (cancelled) return;
                if (!snap.exists()) { router.push("/dashboard"); return; }
                const projData = snap.data() as ProjectData;
                setProject(projData);
                setLoading(false); // Show UI immediately — counts load in background

                // Background: fetch counts for progress indicators (non-blocking)
                (async () => {
                    try {
                        const [charSnap, locSnap] = await Promise.all([
                            getDocs(collection(db, "projects", projectId, "characters")),
                            getDocs(collection(db, "projects", projectId, "locations")),
                        ]);

                        let sceneCount = 0;
                        let shotCount = 0;
                        let generatedCount = 0;
                        let animatedCount = 0;
                        const epId = projData.script_status === 'empty' ? null : (snap.data()?.default_episode_id || 'main');
                        if (epId) {
                            const scenesSnap = await getDocs(collection(db, "projects", projectId, "episodes", epId, "scenes"));
                            sceneCount = scenesSnap.size;
                            const shotSnaps = await Promise.all(
                                scenesSnap.docs.map(s => getDocs(collection(db, "projects", projectId, "episodes", epId, "scenes", s.id, "shots")))
                            );
                            for (const shotsSnap of shotSnaps) {
                                shotCount += shotsSnap.size;
                                shotsSnap.forEach(s => {
                                    const d = s.data();
                                    if (d.image_url) generatedCount++;
                                    if (d.video_url) animatedCount++;
                                });
                            }
                        }

                        if (!cancelled) {
                            setCounts({
                                characters: charSnap.size,
                                locations: locSnap.size,
                                scenes: sceneCount,
                                shots: shotCount,
                                generatedShots: generatedCount,
                                animatedShots: animatedCount,
                            });
                        }
                    } catch (e) {
                        console.debug("[ProjectHub] Counts fetch (non-critical):", e);
                    }
                })();
            } catch (e) {
                console.error("[ProjectHub] Load failed:", e);
                if (!cancelled) {
                    // On timeout or error, redirect to dashboard
                    router.push("/dashboard");
                }
            }
        });

        return () => { cancelled = true; unsubAuth(); };
    }, [projectId, router]);

    const scriptStatus = project?.script_status || "empty";
    const hasScript = scriptStatus !== "empty" && scriptStatus !== "pending";
    const isProductionReady = scriptStatus === "production_ready" || scriptStatus === "ready" || scriptStatus === "assets_pending";

    // Compute phase progress (must be before early return — Rules of Hooks)
    const preProgress = useMemo(() => {
        let score = 0;
        if (hasScript) score += 40;
        if (counts.characters > 0) score += 30;
        if (counts.locations > 0) score += 30;
        return Math.min(score, 100);
    }, [hasScript, counts]);

    const prodProgress = useMemo(() => {
        if (counts.shots === 0) return 0;
        // Weight: having scenes (20%), having shots (20%), generated images (30%), animated (30%)
        let score = 0;
        if (counts.scenes > 0) score += 20;
        if (counts.shots > 0) score += 20;
        if (counts.shots > 0) {
            score += Math.round((counts.generatedShots / counts.shots) * 30);
            score += Math.round((counts.animatedShots / counts.shots) * 30);
        }
        return Math.min(score, 100);
    }, [counts]);

    const postProgress = useMemo(() => {
        // Post-production starts once we have animated shots
        if (counts.animatedShots === 0) return 0;
        return 10; // Base progress when there are animated shots to edit
    }, [counts]);

    if (loading || !project) {
        return (
            <div className="fixed inset-0 bg-[#030303] flex flex-col items-center justify-center gap-4">
                <div className="relative">
                    <div className="w-12 h-12 rounded-full border-2 border-[#E50914]/20 border-t-[#E50914] animate-spin" />
                    <div className="absolute inset-0 w-12 h-12 rounded-full border-2 border-transparent border-b-[#D4A843]/30 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
                </div>
                <span className="text-[10px] font-mono tracking-[4px] text-white/20 uppercase">Loading Project...</span>
            </div>
        );
    }

    const workspaces = [
        {
            id: "preproduction",
            title: "Pre-Production",
            subtitle: "Develop your vision",
            pipeline: ["Script", "Characters", "Locations", "Moodboard"],
            icon: Clapperboard,
            href: `/project/${projectId}/preproduction`,
            accent: "#D4A843",
            accentDark: "rgba(212, 168, 67, 0.08)",
            accentMid: "rgba(212, 168, 67, 0.25)",
            available: true,
            progress: preProgress,
            quickStats: [
                { value: counts.characters, label: "Characters" },
                { value: counts.locations, label: "Locations" },
            ],
        },
        {
            id: "production",
            title: "Production",
            subtitle: "Bring it to life",
            pipeline: ["Storyboard", "Shots", "Generate", "Animate"],
            icon: Camera,
            href: project.type === 'micro_drama' ? `/project/${projectId}/studio` : `/project/${projectId}/storyboard`,
            accent: "#E50914",
            accentDark: "rgba(229, 9, 20, 0.08)",
            accentMid: "rgba(229, 9, 20, 0.25)",
            available: true,
            progress: prodProgress,
            quickStats: counts.shots > 0 ? [
                { value: counts.scenes, label: "Scenes" },
                { value: counts.shots, label: "Shots" },
            ] : [],
        },
        {
            id: "postproduction",
            title: "Post-Production",
            subtitle: "Edit & Export",
            pipeline: ["Timeline", "Sound", "AI Edit", "Export"],
            icon: Scissors,
            href: `/project/${projectId}/postprod`,
            accent: "#A855F7",
            accentDark: "rgba(168, 85, 247, 0.08)",
            accentMid: "rgba(168, 85, 247, 0.25)",
            available: true,
            progress: postProgress,
            quickStats: counts.animatedShots > 0 ? [
                { value: counts.animatedShots, label: "Clips" },
            ] : [],
        },

    ];

    const formatLabel = project.type === 'micro_drama' ? 'Series' : project.type === 'ad' ? 'Commercial' : 'Feature Film';

    return (
        <div className="fixed inset-0 bg-[#030303] text-white overflow-y-auto overflow-x-hidden">
            <style jsx global>{`
                @keyframes hubFadeUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes hubFadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
                @keyframes ringPulse { 0%,100% { filter: drop-shadow(0 0 4px var(--ring-color)); } 50% { filter: drop-shadow(0 0 12px var(--ring-color)); } }
                @keyframes float1 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-20px,-30px) scale(1.05); } }
                @keyframes float2 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(30px,20px) scale(0.95); } }
                @keyframes borderGlow {
                    0%,100% { border-color: rgba(255,255,255,0.04); }
                    50% { border-color: rgba(255,255,255,0.08); }
                }
                .hub-card { transition: all 0.5s cubic-bezier(0.23, 1, 0.32, 1); }
                .hub-card:hover { transform: translateY(-6px) scale(1.02); }
                .hub-card:hover .card-glow { opacity: 1; }
                .hub-card:hover .card-icon { transform: scale(1.1); }
                .hub-card:hover .card-arrow { transform: translateX(4px); opacity: 1; }
                .hub-card:hover .card-border-top { opacity: 1; }
                .hub-card:hover .pipeline-dot { transform: scale(1.3); }
            `}</style>

            {/* ── Ambient Background Orbs ── */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-30%] left-[-15%] w-[70%] h-[70%] bg-[#D4A843]/[0.025] rounded-full blur-[150px]"
                    style={{ animation: 'float1 20s ease-in-out infinite' }} />
                <div className="absolute bottom-[-25%] right-[-10%] w-[55%] h-[55%] bg-[#E50914]/[0.02] rounded-full blur-[130px]"
                    style={{ animation: 'float2 18s ease-in-out infinite' }} />
                <div className="absolute top-[40%] right-[20%] w-[30%] h-[30%] bg-[#A855F7]/[0.015] rounded-full blur-[100px]"
                    style={{ animation: 'float1 25s ease-in-out infinite reverse' }} />
                {/* Noise overlay */}
                <div className="absolute inset-0 opacity-[0.02]"
                    style={{
                        backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")',
                        backgroundSize: '128px 128px',
                    }}
                />
            </div>

            {/* ── Top Navigation ── */}
            <div className="relative z-10 h-14 flex items-center justify-between px-8 border-b border-white/[0.04] backdrop-blur-sm"
                style={{ animation: 'hubFadeIn 0.4s ease both' }}>
                <Link href="/dashboard" className="flex items-center gap-2 text-white/30 hover:text-white/80 transition-all duration-300 no-underline group">
                    <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform duration-300" />
                    <span className="text-[10px] font-bold tracking-[3px] uppercase">Dashboard</span>
                </Link>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.05]">
                        <MonitorPlay size={11} className="text-white/25" />
                        <span className="text-[9px] font-mono text-white/30 uppercase tracking-[2px]">{formatLabel}</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.05]">
                        <Layers size={11} className="text-white/25" />
                        <span className="text-[9px] font-mono text-white/30 uppercase tracking-[2px]">{project.aspect_ratio || '16:9'}</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.05]">
                        <Sparkles size={11} className="text-white/25" />
                        <span className="text-[9px] font-mono text-white/30 uppercase tracking-[2px]">{project.style || 'realistic'}</span>
                    </div>
                </div>
            </div>

            {/* ── Hero Section ── */}
            <div className="relative z-10 flex flex-col items-center pt-16 pb-14 px-4"
                style={{ animation: 'hubFadeUp 0.6s ease 0.1s both' }}>

                {/* Project badge */}
                <div className="flex items-center gap-3 mb-6">
                    <div className="h-[1px] w-16 bg-gradient-to-r from-transparent to-[#E50914]/30" />
                    <div className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#E50914]/15 bg-[#E50914]/[0.04]">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#E50914]/60 animate-pulse" />
                        <span className="text-[9px] font-mono text-[#E50914]/60 uppercase tracking-[4px]">Project</span>
                    </div>
                    <div className="h-[1px] w-16 bg-gradient-to-l from-transparent to-[#E50914]/30" />
                </div>

                {/* Title */}
                <h1 className="text-6xl md:text-8xl font-['Anton'] uppercase tracking-tight text-white leading-[0.85] mb-4 text-center">
                    {project.title}
                </h1>

                {/* Genre / Meta line */}
                {project.genre && (
                    <div className="flex items-center gap-3 mt-2">
                        <span className="text-[13px] text-white/25 font-light">{project.genre}</span>
                    </div>
                )}

                {/* Quick status bar */}
                <div className="flex items-center gap-5 mt-8 px-6 py-3 rounded-2xl bg-white/[0.02] border border-white/[0.04] backdrop-blur-sm">
                    <StatusPill icon={FileText} label="Script" status={hasScript ? "done" : "empty"} />
                    <div className="w-[1px] h-4 bg-white/[0.06]" />
                    <StatusPill icon={Users} label={`${counts.characters} Characters`} status={counts.characters > 0 ? "done" : "empty"} />
                    <div className="w-[1px] h-4 bg-white/[0.06]" />
                    <StatusPill icon={MapPin} label={`${counts.locations} Locations`} status={counts.locations > 0 ? "done" : "empty"} />
                </div>
            </div>

            {/* ── Workspace Cards Grid ── */}
            <div className="relative z-10 flex flex-wrap justify-center items-stretch gap-5 w-full max-w-[1280px] mx-auto px-6 pb-16"
                style={{ animation: 'hubFadeUp 0.7s ease 0.2s both' }}>
                {workspaces.map((ws, idx) => (
                    <WorkspaceCard key={ws.id} workspace={ws} index={idx} />
                ))}
            </div>

            {/* ── Bottom Branding ── */}
            <div className="relative z-10 flex items-center justify-center gap-4 pb-10"
                style={{ animation: 'hubFadeIn 0.5s ease 0.6s both' }}>
                <div className="h-[1px] w-12 bg-gradient-to-r from-transparent to-white/[0.05]" />
                <span className="text-[8px] font-mono text-white/10 uppercase tracking-[5px]">MotionX Studio</span>
                <div className="h-[1px] w-12 bg-gradient-to-l from-transparent to-white/[0.05]" />
            </div>
        </div>
    );
}


/* ═══════════════════════════════════════════════════ */
/* STATUS PILL                                         */
/* ═══════════════════════════════════════════════════ */

function StatusPill({ icon: Icon, label, status }: {
    icon: React.ComponentType<any>;
    label: string;
    status: "done" | "progress" | "empty";
}) {
    const colors = {
        done: { dot: "bg-emerald-500", text: "text-emerald-400/60" },
        progress: { dot: "bg-amber-500 animate-pulse", text: "text-amber-400/60" },
        empty: { dot: "bg-white/15", text: "text-white/20" },
    };
    const c = colors[status];
    return (
        <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
            <Icon size={11} className={c.text} />
            <span className={`text-[10px] font-mono ${c.text} tracking-wider`}>{label}</span>
        </div>
    );
}


/* ═══════════════════════════════════════════════════ */
/* WORKSPACE CARD                                      */
/* ═══════════════════════════════════════════════════ */

interface WorkspaceProps {
    workspace: {
        id: string;
        title: string;
        subtitle: string;
        pipeline: string[];
        icon: React.ComponentType<any>;
        href: string;
        accent: string;
        accentDark: string;
        accentMid: string;
        available: boolean;
        progress: number;
        quickStats: { value: number; label: string }[];
    };
    index: number;
}

function WorkspaceCard({ workspace: ws, index }: WorkspaceProps) {
    const router = useRouter();
    const [isHovered, setIsHovered] = useState(false);

    const ringRadius = 20;
    const ringCircumference = 2 * Math.PI * ringRadius;
    const ringOffset = ringCircumference - (ws.progress / 100) * ringCircumference;

    return (
        <button
            onClick={() => ws.available && router.push(ws.href)}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            disabled={!ws.available}
            className={`
                hub-card group relative w-[280px] min-h-[320px] rounded-2xl text-left flex flex-col overflow-hidden
                ${ws.available ? 'cursor-pointer' : 'cursor-not-allowed opacity-40'}
            `}
            style={{
                animationDelay: `${0.3 + index * 0.08}s`,
                animation: 'hubFadeUp 0.6s ease both',
                // @ts-ignore
                '--ring-color': ws.accentMid,
            } as React.CSSProperties}
        >
            {/* ── Glass background ── */}
            <div className="absolute inset-0 rounded-2xl border transition-all duration-500"
                style={{
                    borderColor: isHovered ? `${ws.accent}35` : 'rgba(255,255,255,0.05)',
                    background: isHovered
                        ? `linear-gradient(160deg, ${ws.accentDark} 0%, rgba(8,8,8,0.95) 40%, rgba(5,5,5,0.98) 100%)`
                        : 'linear-gradient(160deg, rgba(255,255,255,0.025) 0%, rgba(5,5,5,0.95) 100%)',
                    backdropFilter: 'blur(20px)',
                }}
            />

            {/* ── Top accent glow line ── */}
            <div className="card-border-top absolute top-0 inset-x-0 h-[2px] opacity-0 transition-opacity duration-500"
                style={{
                    background: `linear-gradient(90deg, transparent, ${ws.accent}, transparent)`,
                }}
            />

            {/* ── Hover glow effect ── */}
            <div className="card-glow absolute -top-20 inset-x-0 h-40 opacity-0 transition-opacity duration-700 pointer-events-none"
                style={{
                    background: `radial-gradient(ellipse at center top, ${ws.accent}12 0%, transparent 70%)`,
                }}
            />

            <div className="relative z-10 p-7 flex flex-col flex-grow">
                {/* ── Header row: Icon + Progress Ring ── */}
                <div className="flex items-start justify-between mb-6">
                    {/* Icon */}
                    <div className="card-icon w-12 h-12 rounded-xl border flex items-center justify-center transition-all duration-500"
                        style={{
                            borderColor: isHovered ? `${ws.accent}30` : 'rgba(255,255,255,0.06)',
                            background: isHovered ? `${ws.accent}08` : 'rgba(255,255,255,0.02)',
                            boxShadow: isHovered ? `0 0 20px ${ws.accent}08` : 'none',
                        }}
                    >
                        {ws.available ? (
                            <ws.icon size={22} style={{ color: isHovered ? ws.accent : 'rgba(255,255,255,0.3)' }}
                                className="transition-colors duration-500" />
                        ) : (
                            <Lock size={18} className="text-white/15" />
                        )}
                    </div>

                    {/* Progress Ring */}
                    {ws.progress > 0 && (
                        <div className="relative w-[52px] h-[52px] flex items-center justify-center"
                            style={{ animation: 'ringPulse 3s ease-in-out infinite' } as React.CSSProperties}>
                            <svg width="52" height="52" viewBox="0 0 52 52" className="absolute -rotate-90">
                                <circle cx="26" cy="26" r={ringRadius}
                                    fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="2.5" />
                                <circle cx="26" cy="26" r={ringRadius}
                                    fill="none" stroke={ws.accent} strokeWidth="2.5"
                                    strokeLinecap="round"
                                    strokeDasharray={ringCircumference}
                                    strokeDashoffset={ringOffset}
                                    className="transition-all duration-1000"
                                    style={{ filter: `drop-shadow(0 0 4px ${ws.accent}50)` }}
                                />
                            </svg>
                            <span className="text-[11px] font-mono tabular-nums"
                                style={{ color: ws.accent }}>{ws.progress}%</span>
                        </div>
                    )}
                </div>

                {/* ── Title ── */}
                <h2 className="text-[22px] font-['Anton'] uppercase tracking-tight text-white mb-1 transition-colors duration-300">
                    {ws.title}
                </h2>
                <p className="text-[11px] mb-6 transition-colors duration-300"
                    style={{ color: isHovered ? `${ws.accent}B0` : 'rgba(255,255,255,0.3)' }}>
                    {ws.subtitle}
                </p>

                {/* ── Pipeline Steps ── */}
                <div className="flex items-center gap-1.5 mb-5 flex-wrap">
                    {ws.pipeline.map((step, i) => (
                        <React.Fragment key={step}>
                            <span className="text-[9px] font-mono uppercase tracking-wider text-white/20 transition-colors duration-300"
                                style={{ color: isHovered ? `${ws.accent}50` : undefined }}>
                                {step}
                            </span>
                            {i < ws.pipeline.length - 1 && (
                                <span className="pipeline-dot w-[3px] h-[3px] rounded-full bg-white/10 transition-all duration-300"
                                    style={{ background: isHovered ? `${ws.accent}40` : undefined }} />
                            )}
                        </React.Fragment>
                    ))}
                </div>

                {/* ── Spacer ── */}
                <div className="flex-grow" />

                {/* ── Quick Stats ── */}
                {ws.quickStats.length > 0 && (
                    <div className="flex items-center gap-4 mb-4">
                        {ws.quickStats.map(stat => (
                            <div key={stat.label} className="flex items-center gap-1.5">
                                <span className="text-[18px] font-bold tabular-nums"
                                    style={{ color: stat.value > 0 ? ws.accent : 'rgba(255,255,255,0.15)' }}>
                                    {stat.value}
                                </span>
                                <span className="text-[9px] font-mono text-white/20 uppercase tracking-wider leading-tight">
                                    {stat.label}
                                </span>
                            </div>
                        ))}
                    </div>
                )}

                {/* ── Bottom action bar ── */}
                <div className="flex items-center justify-between pt-4 border-t transition-colors duration-500"
                    style={{ borderColor: isHovered ? `${ws.accent}15` : 'rgba(255,255,255,0.04)' }}>
                    <span className="text-[10px] font-mono text-white/15 uppercase tracking-[2px] transition-colors duration-300"
                        style={{ color: isHovered ? `${ws.accent}50` : undefined }}>
                        Open Workspace
                    </span>
                    <div className="card-arrow flex items-center gap-1 opacity-30 transition-all duration-300">
                        <ChevronRight size={14} style={{ color: isHovered ? ws.accent : 'rgba(255,255,255,0.3)' }}
                            className="transition-colors duration-300" />
                    </div>
                </div>
            </div>
        </button>
    );
}