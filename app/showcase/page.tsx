"use client";

import { useEffect, useState, useRef } from "react";
import { ArrowLeft, Play, Pause, Film, Camera, MapPin, Sun, MessageSquare, Move, ChevronDown, ChevronUp, Volume2, VolumeX, X, Sparkles, ArrowRight } from "lucide-react";
import Link from "next/link";
import { auth } from "@/lib/firebase";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Shot {
    id: string;
    order: number;
    image_url?: string;
    video_url?: string;
    shot_type?: string;
    visual_action?: string;
    dialogue?: string;
    character_name?: string;
    camera_movement?: string;
}

interface Scene {
    id: string;
    scene_number: number;
    location?: string;
    time_of_day?: string;
    description?: string;
    shots: Shot[];
}

interface ProjectInfo {
    id: string;
    title: string;
    type: string;
    genre: string;
    style: string;
}

export default function ShowcasePage() {
    const [project, setProject] = useState<ProjectInfo | null>(null);
    const [scenes, setScenes] = useState<Scene[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedScenes, setExpandedScenes] = useState<Set<string>>(new Set());
    const [activeShot, setActiveShot] = useState<Shot | null>(null);
    const [playing, setPlaying] = useState(false);
    const [muted, setMuted] = useState(true);
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        const fetchProject = async () => {
            try {
                const user = auth.currentUser;
                if (!user) return;

                const token = await user.getIdToken();
                const res = await fetch(`${API_BASE}/api/v1/project/showcase/project`, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();

                setProject(data.project);
                setScenes(data.scenes || []);

                // Auto-expand first scene and select first shot
                if (data.scenes?.length > 0) {
                    setExpandedScenes(new Set([data.scenes[0].id]));
                    if (data.scenes[0].shots?.length > 0) {
                        setActiveShot(data.scenes[0].shots[0]);
                    }
                }
            } catch (err) {
                console.error("[ShowcasePage] Failed:", err);
            } finally {
                setLoading(false);
            }
        };

        const unsub = auth.onAuthStateChanged((user) => {
            if (user) fetchProject();
        });
        return () => unsub();
    }, []);

    const toggleScene = (id: string) => {
        setExpandedScenes(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const togglePlay = () => {
        if (!videoRef.current) return;
        if (playing) {
            videoRef.current.pause();
        } else {
            videoRef.current.play().catch(() => {});
        }
        setPlaying(!playing);
    };

    const totalShots = scenes.reduce((sum, s) => sum + s.shots.length, 0);
    const totalVideos = scenes.reduce((sum, s) => sum + s.shots.filter(sh => sh.video_url).length, 0);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#050505] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-2 border-[#E50914] border-t-transparent rounded-full animate-spin" />
                    <span className="text-[10px] text-[#555] uppercase tracking-[3px]">Loading Showcase</span>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#050505] text-white">
            {/* ═══ HEADER ═══ */}
            <div className="sticky top-0 z-50 bg-[#030303]/90 backdrop-blur-xl border-b border-white/[0.06]">
                <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard" className="text-[#555] hover:text-white transition-colors">
                            <ArrowLeft size={18} />
                        </Link>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-lg font-bold text-white uppercase tracking-wide font-anton">
                                    {project?.title || "Sample Project"}
                                </h1>
                                <span className="bg-[#E50914]/20 text-[#E50914] text-[7px] font-bold uppercase tracking-widest px-2 py-0.5 rounded">
                                    Sample
                                </span>
                            </div>
                            <p className="text-[9px] text-[#555] uppercase tracking-[2px] mt-0.5">
                                {scenes.length} Scenes · {totalShots} Shots · {totalVideos} Videos
                            </p>
                        </div>
                    </div>
                    <Link
                        href="/project/new"
                        className="flex items-center gap-2 px-4 py-2 bg-[#E50914] text-white text-[10px] font-bold uppercase tracking-[2px] rounded-md hover:bg-[#ff1a25] transition-colors no-underline"
                    >
                        <Sparkles size={12} /> Create Your Own
                    </Link>
                </div>
            </div>

            {/* ═══ MAIN LAYOUT ═══ */}
            <div className="max-w-[1600px] mx-auto flex h-[calc(100vh-65px)]">

                {/* ─── LEFT: Scene List ─── */}
                <div className="w-[340px] border-r border-white/[0.06] overflow-y-auto shrink-0">
                    <div className="p-4">
                        <span className="text-[8px] text-[#555] uppercase tracking-[3px] font-semibold">Storyboard</span>
                    </div>

                    {scenes.map((scene) => (
                        <div key={scene.id} className="border-b border-white/[0.04]">
                            {/* Scene Header */}
                            <button
                                onClick={() => toggleScene(scene.id)}
                                className="w-full flex items-center justify-between px-4 py-3 text-left cursor-pointer bg-transparent border-none hover:bg-white/[0.02] transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="w-6 h-6 rounded bg-[#E50914]/10 flex items-center justify-center text-[9px] font-bold text-[#E50914] shrink-0">
                                        {scene.scene_number}
                                    </span>
                                    <div>
                                        <div className="flex items-center gap-2 text-[10px] text-white font-semibold">
                                            {scene.location && (
                                                <span className="flex items-center gap-1">
                                                    <MapPin size={8} className="text-[#555]" />
                                                    {scene.location}
                                                </span>
                                            )}
                                            {scene.time_of_day && (
                                                <span className="flex items-center gap-1 text-[#666]">
                                                    <Sun size={8} />
                                                    {scene.time_of_day}
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-[8px] text-[#444]">{scene.shots.length} shots</span>
                                    </div>
                                </div>
                                {expandedScenes.has(scene.id) ? (
                                    <ChevronUp size={14} className="text-[#444]" />
                                ) : (
                                    <ChevronDown size={14} className="text-[#444]" />
                                )}
                            </button>

                            {/* Shots Grid */}
                            {expandedScenes.has(scene.id) && (
                                <div className="px-4 pb-4 grid grid-cols-3 gap-2">
                                    {scene.shots.map((shot) => (
                                        <div
                                            key={shot.id}
                                            onClick={() => { setActiveShot(shot); setPlaying(false); }}
                                            className={`aspect-video rounded-md overflow-hidden cursor-pointer border-2 transition-all relative group ${
                                                activeShot?.id === shot.id
                                                    ? 'border-[#E50914] shadow-[0_0_12px_rgba(229,9,20,0.3)]'
                                                    : 'border-transparent hover:border-[#333]'
                                            }`}
                                        >
                                            {shot.image_url && (
                                                <img
                                                    src={shot.image_url}
                                                    alt=""
                                                    className="w-full h-full object-cover"
                                                    loading="lazy"
                                                />
                                            )}
                                            {shot.video_url && (
                                                <div className="absolute top-1 right-1 bg-black/70 p-0.5 rounded-sm">
                                                    <Play size={6} className="text-white" fill="white" />
                                                </div>
                                            )}
                                            <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5">
                                                <span className="text-[6px] text-[#888] font-mono uppercase">{shot.shot_type}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}

                    {/* Bottom CTA */}
                    <div className="p-4 border-t border-white/[0.06]">
                        <Link
                            href="/project/new"
                            className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-[#333] rounded-lg text-[9px] font-bold text-[#555] uppercase tracking-[2px] hover:text-[#E50914] hover:border-[#E50914] transition-colors no-underline"
                        >
                            <Film size={12} /> Create Your Own Project
                        </Link>
                    </div>
                </div>

                {/* ─── RIGHT: Shot Viewer ─── */}
                <div className="flex-1 flex flex-col bg-[#080808]">
                    {activeShot ? (
                        <>
                            {/* Media Viewer */}
                            <div className="flex-1 flex items-center justify-center p-6 relative">
                                {activeShot.video_url ? (
                                    <div className="relative max-w-full max-h-full">
                                        <video
                                            ref={videoRef}
                                            key={activeShot.id}
                                            src={activeShot.video_url}
                                            poster={activeShot.image_url}
                                            loop
                                            muted={muted}
                                            playsInline
                                            className="max-w-full max-h-[calc(100vh-200px)] rounded-lg object-contain"
                                            onPlay={() => setPlaying(true)}
                                            onPause={() => setPlaying(false)}
                                        />
                                        {/* Video controls */}
                                        <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                                            <button
                                                onClick={togglePlay}
                                                className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/80 transition-colors cursor-pointer border-none"
                                            >
                                                {playing ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
                                            </button>
                                            <button
                                                onClick={() => setMuted(!muted)}
                                                className="w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/80 transition-colors cursor-pointer border-none"
                                            >
                                                {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                                            </button>
                                        </div>
                                    </div>
                                ) : activeShot.image_url ? (
                                    <img
                                        src={activeShot.image_url}
                                        alt=""
                                        className="max-w-full max-h-[calc(100vh-200px)] rounded-lg object-contain"
                                    />
                                ) : (
                                    <div className="text-[#333] text-sm">No media</div>
                                )}
                            </div>

                            {/* Shot Details Bar */}
                            <div className="shrink-0 border-t border-white/[0.06] bg-[#0A0A0A] px-6 py-4">
                                <div className="flex items-start gap-6">
                                    {/* Shot Type */}
                                    <div className="flex items-center gap-2">
                                        <Camera size={12} className="text-[#E50914]" />
                                        <div>
                                            <span className="text-[7px] text-[#555] uppercase tracking-widest block">Shot Type</span>
                                            <span className="text-[11px] text-white font-semibold">{activeShot.shot_type || "—"}</span>
                                        </div>
                                    </div>

                                    {/* Camera Movement */}
                                    {activeShot.camera_movement && (
                                        <div className="flex items-center gap-2">
                                            <Move size={12} className="text-[#3B82F6]" />
                                            <div>
                                                <span className="text-[7px] text-[#555] uppercase tracking-widest block">Movement</span>
                                                <span className="text-[11px] text-white font-semibold">{activeShot.camera_movement}</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Dialogue */}
                                    {activeShot.dialogue && (
                                        <div className="flex items-start gap-2 flex-1">
                                            <MessageSquare size={12} className="text-[#8B5CF6] mt-0.5" />
                                            <div>
                                                <span className="text-[7px] text-[#555] uppercase tracking-widest block">
                                                    {activeShot.character_name ? `${activeShot.character_name}` : "Dialogue"}
                                                </span>
                                                <span className="text-[11px] text-white/80 italic">&ldquo;{activeShot.dialogue}&rdquo;</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Visual Action */}
                                    {activeShot.visual_action && (
                                        <div className="flex-1">
                                            <span className="text-[7px] text-[#555] uppercase tracking-widest block">Action</span>
                                            <span className="text-[11px] text-white/70">{activeShot.visual_action}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="text-center">
                                <Film size={32} className="mx-auto text-[#222] mb-3" />
                                <p className="text-[11px] text-[#444]">Select a shot to preview</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
