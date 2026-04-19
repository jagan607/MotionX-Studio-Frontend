"use client";

import { useEffect, useState, useRef } from "react";
import { Film, Play, ArrowRight, Sparkles, X, ChevronLeft, ChevronRight, Volume2, VolumeX } from "lucide-react";
import Link from "next/link";
import { auth } from "@/lib/firebase";

interface ShowcaseShot {
    id: string;
    image_url?: string;
    video_url?: string;
    visual_action?: string;
    shot_type?: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * Cinematic showcase section with clickable lightbox and
 * "Explore Sample Project" CTA for the interactive showcase page.
 */
export default function ShowcaseSection() {
    const [shots, setShots] = useState<ShowcaseShot[]>([]);
    const [loading, setLoading] = useState(true);
    const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
    const [muted, setMuted] = useState(true);
    const videoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});
    const lightboxVideoRef = useRef<HTMLVideoElement | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchShowcase = async () => {
            try {
                const user = auth.currentUser;
                if (!user) return;

                const token = await user.getIdToken();
                const res = await fetch(`${API_BASE}/api/v1/project/showcase/featured`, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();

                if (data.shots && data.shots.length > 0) {
                    setShots(data.shots);
                }
            } catch (err) {
                console.error("[ShowcaseSection] Failed to load:", err);
            } finally {
                setLoading(false);
            }
        };

        const unsub = auth.onAuthStateChanged((user) => {
            if (user) fetchShowcase();
        });
        return () => unsub();
    }, []);

    // Lightbox navigation
    const openLightbox = (idx: number) => setLightboxIdx(idx);
    const closeLightbox = () => { setLightboxIdx(null); setMuted(true); };
    const prevShot = () => setLightboxIdx(i => i !== null ? (i - 1 + shots.length) % shots.length : null);
    const nextShot = () => setLightboxIdx(i => i !== null ? (i + 1) % shots.length : null);

    // Keyboard nav for lightbox
    useEffect(() => {
        if (lightboxIdx === null) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") closeLightbox();
            if (e.key === "ArrowLeft") prevShot();
            if (e.key === "ArrowRight") nextShot();
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [lightboxIdx]);

    if (loading || shots.length === 0) return null;

    const currentShot = lightboxIdx !== null ? shots[lightboxIdx] : null;

    return (
        <>
            <div className="shrink-0 mb-4">
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                        <div className="w-6 h-6 rounded-md bg-[#E50914]/10 flex items-center justify-center">
                            <Sparkles size={12} className="text-[#E50914]" />
                        </div>
                        <div>
                            <h3 className="text-[11px] font-bold text-white uppercase tracking-[2px]">Made with MotionX</h3>
                            <p className="text-[8px] text-[#555] uppercase tracking-widest mt-0.5">Click to preview · Sample project added to your dashboard</p>
                        </div>
                    </div>
                    <Link
                        href="/project/new"
                        className="flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-bold text-black bg-[#E50914] hover:bg-[#ff1a25] uppercase tracking-wider transition-colors no-underline rounded-md"
                    >
                        Create Your Own <ArrowRight size={10} />
                    </Link>
                </div>

                {/* Showcase Carousel */}
                <div
                    ref={scrollRef}
                    className="flex gap-3 overflow-x-auto no-scrollbar pb-2 scroll-smooth"
                    onWheel={(e) => {
                        if (scrollRef.current) {
                            scrollRef.current.scrollLeft += e.deltaY;
                        }
                    }}
                >
                    {shots.map((shot, idx) => (
                        <div
                            key={shot.id}
                            className="shrink-0 w-[220px] aspect-video bg-black border border-[#222] rounded-lg overflow-hidden relative group cursor-pointer hover:border-[#E50914]/50 hover:shadow-[0_0_15px_rgba(229,9,20,0.15)] transition-all"
                            onClick={() => openLightbox(idx)}
                            onMouseEnter={() => {
                                const vid = videoRefs.current[shot.id];
                                if (vid && shot.video_url) {
                                    if (!vid.src) vid.src = shot.video_url;
                                    vid.play().catch(() => {});
                                }
                            }}
                            onMouseLeave={() => {
                                const vid = videoRefs.current[shot.id];
                                if (vid) { vid.pause(); vid.currentTime = 0; }
                            }}
                        >
                            {shot.image_url && (
                                <img
                                    src={shot.image_url}
                                    alt=""
                                    className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                                    loading="lazy"
                                />
                            )}

                            {shot.video_url && (
                                <video
                                    ref={el => { if (el) videoRefs.current[shot.id] = el; }}
                                    loop muted playsInline preload="none"
                                    className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                                />
                            )}

                            {/* Play icon */}
                            {shot.video_url && (
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <div className="w-8 h-8 rounded-full bg-[#E50914]/90 flex items-center justify-center backdrop-blur-sm">
                                        <Play size={12} className="text-white ml-0.5" fill="white" />
                                    </div>
                                </div>
                            )}

                            {/* Bottom info */}
                            <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent pointer-events-none">
                                <span className="text-[8px] text-[#888] font-mono uppercase tracking-wider">
                                    {shot.shot_type || "CINEMATIC"}
                                </span>
                            </div>

                            {/* AI badge */}
                            <div className="absolute top-2 left-2">
                                <span className="bg-[#E50914]/80 text-white text-[6px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded backdrop-blur-sm">
                                    AI Generated
                                </span>
                            </div>
                        </div>
                    ))}

                    {/* CTA Card */}
                    <Link
                        href="/project/new"
                        className="shrink-0 w-[220px] aspect-video border border-dashed border-[#333] bg-[#0A0A0A] rounded-lg flex flex-col items-center justify-center text-[#444] hover:text-[#E50914] hover:border-[#E50914] hover:bg-[#0f0f0f] transition-all no-underline group"
                    >
                        <Film size={20} className="mb-2 group-hover:scale-110 transition-transform" />
                        <span className="text-[8px] font-bold uppercase tracking-[2px]">Create Your Film</span>
                        <span className="text-[7px] text-[#333] mt-1">30 Free Credits</span>
                    </Link>
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════
                LIGHTBOX — Fullscreen media viewer
                ═══════════════════════════════════════════════════════════ */}
            {currentShot && lightboxIdx !== null && (
                <div
                    className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-xl flex items-center justify-center"
                    onClick={closeLightbox}
                >
                    {/* Close */}
                    <button
                        onClick={closeLightbox}
                        className="absolute top-6 right-6 z-10 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors cursor-pointer border-none"
                    >
                        <X size={18} />
                    </button>

                    {/* Nav arrows */}
                    <button
                        onClick={(e) => { e.stopPropagation(); prevShot(); }}
                        className="absolute left-4 md:left-8 z-10 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors cursor-pointer border-none"
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); nextShot(); }}
                        className="absolute right-4 md:right-8 z-10 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors cursor-pointer border-none"
                    >
                        <ChevronRight size={20} />
                    </button>

                    {/* Media */}
                    <div
                        className="max-w-[85vw] max-h-[80vh] relative"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {currentShot.video_url ? (
                            <video
                                ref={lightboxVideoRef}
                                src={currentShot.video_url}
                                poster={currentShot.image_url}
                                autoPlay loop muted={muted} playsInline
                                className="max-w-full max-h-[80vh] rounded-lg object-contain"
                            />
                        ) : (
                            <img
                                src={currentShot.image_url}
                                alt=""
                                className="max-w-full max-h-[80vh] rounded-lg object-contain"
                            />
                        )}

                        {/* Bottom info bar */}
                        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 to-transparent rounded-b-lg flex items-end justify-between">
                            <div>
                                <span className="text-[9px] text-[#E50914] font-bold uppercase tracking-[2px]">
                                    {currentShot.shot_type || "CINEMATIC"}
                                </span>
                                {currentShot.visual_action && (
                                    <p className="text-[11px] text-white/70 mt-1 max-w-md">{currentShot.visual_action}</p>
                                )}
                            </div>
                            <div className="flex items-center gap-3">
                                {currentShot.video_url && (
                                    <button
                                        onClick={() => setMuted(!muted)}
                                        className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors cursor-pointer border-none"
                                    >
                                        {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                                    </button>
                                )}
                                <span className="text-[10px] text-white/40 font-mono">
                                    {lightboxIdx + 1} / {shots.length}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
