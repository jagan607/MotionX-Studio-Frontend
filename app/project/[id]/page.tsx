"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";
import {
    Loader2, Clapperboard, Camera, Film,
    ArrowLeft, ChevronRight, Lock, Sparkles,
    Users, MapPin, Palette, FileText,
    Play, Scissors
} from "lucide-react";

interface ProjectData {
    title: string;
    type: string;
    genre?: string;
    aspect_ratio?: string;
    style?: string;
    script_status?: string;
    created_at?: any;
}

export default function ProjectHub() {
    const router = useRouter();
    const params = useParams();
    const projectId = params.id as string;
    const [project, setProject] = useState<ProjectData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!projectId) return;
        (async () => {
            try {
                const snap = await getDoc(doc(db, "projects", projectId));
                if (!snap.exists()) { router.push("/dashboard"); return; }
                setProject(snap.data() as ProjectData);
            } catch (e) {
                console.error("Hub Error", e);
                router.push("/dashboard");
            } finally {
                setLoading(false);
            }
        })();
    }, [projectId, router]);

    if (loading || !project) {
        return (
            <div className="fixed inset-0 bg-[#030303] flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-[#E50914]" />
                <span className="text-[10px] font-mono tracking-[4px] text-white/20 uppercase">Loading Project...</span>
            </div>
        );
    }

    const scriptStatus = project.script_status || "empty";
    const hasScript = scriptStatus !== "empty" && scriptStatus !== "pending";
    const isProductionReady = scriptStatus === "production_ready" || scriptStatus === "ready" || scriptStatus === "assets_pending";

    const workspaces = [
        {
            id: "preproduction",
            title: "Pre-Production",
            subtitle: "Develop your vision",
            description: "Script • Characters • Locations • Mood",
            icon: Clapperboard,
            href: `/project/${projectId}/preproduction`,
            accent: "#D4A843",
            accentGlow: "rgba(212, 168, 67, 0.15)",
            available: true,
            stats: [
                { icon: FileText, label: "Script" },
                { icon: Users, label: "Cast" },
                { icon: MapPin, label: "Locations" },
                { icon: Palette, label: "Mood" },
            ],
        },
        {
            id: "production",
            title: "Production",
            subtitle: "Bring it to life",
            description: "Storyboard • Shots • Animation",
            icon: Camera,
            href: project.type === 'micro_drama' ? `/project/${projectId}/studio` : `/project/${projectId}/storyboard`,
            accent: "#E50914",
            accentGlow: "rgba(229, 9, 20, 0.15)",
            available: true,
            stats: [
                { icon: Play, label: "Storyboard" },
                { icon: Sparkles, label: "Generate" },
                { icon: Film, label: "Animate" },
            ],
        },
        {
            id: "postproduction",
            title: "Post-Production",
            subtitle: "Edit & Export",
            description: "Timeline • Sound • Export",
            icon: Scissors,
            href: `/project/${projectId}/postprod`,
            accent: "#A855F7",
            accentGlow: "rgba(168, 85, 247, 0.15)",
            available: true,
            stats: [
                { icon: Film, label: "Timeline" },
                { icon: Sparkles, label: "AI Edit" },
                { icon: Play, label: "Export" },
            ],
        },
    ];

    const formatLabel = project.type === 'micro_drama' ? 'Series' : project.type === 'ad' ? 'Commercial' : 'Feature Film';

    return (
        <div className="fixed inset-0 bg-[#030303] text-white overflow-hidden">
            <style jsx global>{`
                @keyframes hubFadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes hubPulse { 0%,100% { opacity: 0.3; } 50% { opacity: 0.6; } }
                @keyframes hubFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
                @keyframes hubGlowPulse { 0%,100% { box-shadow: 0 0 40px var(--glow-color); } 50% { box-shadow: 0 0 80px var(--glow-color); } }
                @keyframes filmGrain { 0% { transform: translateX(0); } 100% { transform: translateX(-10%); } }
                @keyframes scanLine { 0% { top: -5%; } 100% { top: 105%; } }
            `}</style>

            {/* ── Ambient Background ── */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-[#E50914]/[0.03] rounded-full blur-[120px]" style={{ animation: 'hubFloat 12s ease-in-out infinite' }} />
                <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-[#D4A843]/[0.02] rounded-full blur-[100px]" style={{ animation: 'hubFloat 15s ease-in-out infinite reverse' }} />
                {/* Film grain overlay */}
                <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")', backgroundSize: '128px 128px' }} />
            </div>

            {/* ── Top Bar ── */}
            <div className="relative z-10 h-14 flex items-center justify-between px-8 border-b border-white/[0.04]" style={{ animation: 'hubFadeUp 0.5s ease both' }}>
                <Link href="/dashboard" className="flex items-center gap-2 text-white/30 hover:text-white transition-colors no-underline group">
                    <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
                    <span className="text-[10px] font-bold tracking-[3px] uppercase">Dashboard</span>
                </Link>
                <div className="flex items-center gap-3">
                    <span className="text-[8px] font-mono text-white/15 uppercase tracking-[3px]">{formatLabel}</span>
                    <span className="w-1 h-1 bg-white/10 rounded-full" />
                    <span className="text-[8px] font-mono text-white/15 uppercase tracking-[3px]">{project.aspect_ratio || '16:9'}</span>
                    <span className="w-1 h-1 bg-white/10 rounded-full" />
                    <span className="text-[8px] font-mono text-white/15 uppercase tracking-[3px]">{project.style || 'realistic'}</span>
                </div>
            </div>

            {/* ── Main Content ── */}
            <div className="relative z-10 flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] py-12 px-4" style={{ animation: 'hubFadeUp 0.6s ease 0.1s both' }}>

                {/* Project Title */}
                <div className="text-center mb-12">
                    <div className="flex items-center justify-center gap-3 mb-4">
                        <div className="h-[1px] w-12 bg-gradient-to-r from-transparent to-[#E50914]/30" />
                        <span className="text-[9px] font-mono text-[#E50914]/40 uppercase tracking-[5px]">Project</span>
                        <div className="h-[1px] w-12 bg-gradient-to-l from-transparent to-[#E50914]/30" />
                    </div>
                    <h1 className="text-5xl md:text-7xl font-['Anton'] uppercase tracking-tight text-white leading-[0.9] mb-3">
                        {project.title}
                    </h1>
                    {project.genre && (
                        <p className="text-[12px] text-white/20 max-w-md mx-auto leading-relaxed line-clamp-2">{project.genre}</p>
                    )}
                </div>

                {/* Workspace Cards */}
                <div className="flex flex-wrap justify-center items-stretch gap-6 md:gap-8 w-full max-w-6xl mx-auto">
                    {workspaces.map((ws, idx) => (
                        <WorkspaceCard key={ws.id} workspace={ws} index={idx} />
                    ))}
                </div>

                {/* Bottom HUD */}
                <div className="mt-12 flex items-center gap-6" style={{ animation: 'hubFadeUp 0.5s ease 0.5s both' }}>
                    <span className="text-[8px] font-mono text-white/10 uppercase tracking-[4px]">MotionX Studio</span>
                    <span className="w-1 h-1 bg-[#E50914]/20 rounded-full" />
                    <span className="text-[8px] font-mono text-white/10 uppercase tracking-[4px]">Choose Your Workspace</span>
                </div>
            </div>
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
        description: string;
        icon: React.ComponentType<any>;
        href: string;
        accent: string;
        accentGlow: string;
        available: boolean;
        stats: { icon: React.ComponentType<any>; label: string }[];
    };
    index: number;
}

function WorkspaceCard({ workspace: ws, index }: WorkspaceProps) {
    const router = useRouter();
    const [isHovered, setIsHovered] = useState(false);

    return (
        <button
            onClick={() => ws.available && router.push(ws.href)}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            disabled={!ws.available}
            className={`
                group relative w-[300px] min-h-[340px] rounded-2xl border transition-all duration-500 text-left flex flex-col
                ${ws.available
                    ? 'cursor-pointer hover:scale-[1.03] hover:-translate-y-1'
                    : 'cursor-not-allowed opacity-40'
                }
            `}
            style={{
                borderColor: isHovered && ws.available ? `${ws.accent}40` : 'rgba(255,255,255,0.06)',
                background: isHovered && ws.available
                    ? `linear-gradient(180deg, ${ws.accentGlow} 0%, rgba(5,5,5,0.95) 60%)`
                    : 'rgba(255,255,255,0.02)',
                // @ts-ignore
                '--glow-color': ws.accentGlow,
                animationDelay: `${index * 0.1}s`,
            }}
        >
            {/* Top accent line */}
            <div className="absolute top-0 inset-x-4 h-[1px] transition-all duration-500"
                style={{
                    background: isHovered && ws.available
                        ? `linear-gradient(90deg, transparent, ${ws.accent}, transparent)`
                        : 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)'
                }}
            />

            <div className="p-7 flex flex-col flex-grow">
                {/* Icon */}
                <div className="w-14 h-14 rounded-xl border flex items-center justify-center mb-5 transition-all duration-500"
                    style={{
                        borderColor: isHovered && ws.available ? `${ws.accent}40` : 'rgba(255,255,255,0.06)',
                        background: isHovered && ws.available ? `${ws.accent}10` : 'rgba(255,255,255,0.02)',
                    }}
                >
                    {ws.available ? (
                        <ws.icon size={24} style={{ color: isHovered ? ws.accent : 'rgba(255,255,255,0.25)' }} className="transition-colors duration-500" />
                    ) : (
                        <Lock size={20} className="text-white/15" />
                    )}
                </div>

                {/* Title */}
                <h2 className="text-2xl font-['Anton'] uppercase tracking-tight text-white mb-1 transition-colors">
                    {ws.title}
                </h2>
                <p className="text-[11px] text-white/30 mb-5 transition-colors" style={{ color: isHovered && ws.available ? `${ws.accent}90` : undefined }}>
                    {ws.subtitle}
                </p>

                {/* Description - Ensure it also doesn't wrap oddly with padding */}
                <p className="text-[10px] text-white/15 uppercase tracking-[2px] font-bold mb-5 flex-grow pr-4">
                    {ws.description}
                </p>

                {/* Spacer to push stats to bottom if uneven lengths */}
                <div className="mt-auto">
                    {/* Stats Row */}
                    {ws.stats.length > 0 ? (
                        <div className="flex flex-wrap items-center justify-start gap-x-3 gap-y-2 pt-4 border-t transition-colors pr-12"
                            style={{ borderColor: isHovered && ws.available ? `${ws.accent}15` : 'rgba(255,255,255,0.04)' }}
                        >
                            {ws.stats.map((stat) => (
                                <div key={stat.label} className="flex items-center gap-1.5">
                                    <stat.icon size={10} className="text-white/15" />
                                    <span className="text-[8px] font-mono text-white/20 uppercase tracking-wider">{stat.label}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="h-[29px]" /> // Maintain height alignment for coming soon
                    )}
                </div>

                {/* CTA Arrow */}
                {ws.available && (
                    <div className="absolute bottom-6 right-6 w-7 h-7 rounded-full border border-white/[0.06] flex items-center justify-center transition-all duration-300 group-hover:border-white/20 group-hover:bg-white/[0.04]">
                        <ChevronRight size={14} className="text-white/20 group-hover:text-white/60 transition-colors" />
                    </div>
                )}
            </div>
        </button>
    );
}