"use client";

/**
 * /explore — Cinematic AI showcase gallery.
 *
 * Immersive, Midjourney-inspired explore page with:
 * - Ambient hero with featured spotlight video
 * - Masonry grid with staggered parallax cards
 * - Glassmorphism lightbox with prompt details
 * - Floating "Create Your Own" CTA
 */

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { fetchCommunityFeed } from "@/lib/api";
import {
    Film,
    Image as ImageIcon,
    Play,
    Sparkles,
    Loader2,
    ArrowRight,
    Zap,
    Eye,
    X,
    Volume2,
    VolumeX,
    Pause,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════ */

interface CommunityShot {
    id: string;
    image_url: string;
    video_url?: string;
    prompt: string;
    shot_type?: string;
    project_title?: string;
    creator?: string;
}

type FilterKey = "ALL" | "VIDEO" | "IMAGE";

/* ═══════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════ */

export default function ExplorePage() {
    const router = useRouter();
    const [shots, setShots] = useState<CommunityShot[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<FilterKey>("ALL");
    const [selectedShot, setSelectedShot] = useState<CommunityShot | null>(null);
    const [heroShot, setHeroShot] = useState<CommunityShot | null>(null);
    const [heroMuted, setHeroMuted] = useState(true);
    const [heroPaused, setHeroPaused] = useState(false);
    const videoRefs = useRef<Record<string, HTMLVideoElement>>({});
    const heroVideoRef = useRef<HTMLVideoElement>(null);
    const [scrolled, setScrolled] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Load community feed
    useEffect(() => {
        const load = async () => {
            try {
                const data = await fetchCommunityFeed();
                const all = Array.isArray(data) ? data : data?.shots || [];
                setShots(all);
                // Pick a random video for the hero spotlight
                const videos = all.filter((s: CommunityShot) => s.video_url);
                if (videos.length > 0) {
                    setHeroShot(videos[Math.floor(Math.random() * videos.length)]);
                } else if (all.length > 0) {
                    setHeroShot(all[0]);
                }
            } catch (e) {
                console.error("[Explore] Failed to load feed:", e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    // Track scroll for floating CTA
    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        const onScroll = () => setScrolled(el.scrollTop > 100);
        el.addEventListener("scroll", onScroll, { passive: true });
        return () => el.removeEventListener("scroll", onScroll);
    }, []);

    // Filter logic
    const filtered = shots.filter(s => {
        if (filter === "VIDEO") return !!s.video_url;
        if (filter === "IMAGE") return !s.video_url;
        return true;
    });

    // Video hover handlers
    const handleMouseEnter = useCallback((shot: CommunityShot, idx: number) => {
        const vid = videoRefs.current[shot.id + idx];
        if (vid && shot.video_url) {
            if (!vid.src) vid.src = shot.video_url;
            vid.play().catch(() => {});
        }
    }, []);

    const handleMouseLeave = useCallback((shot: CommunityShot, idx: number) => {
        const vid = videoRefs.current[shot.id + idx];
        if (vid) {
            vid.pause();
            vid.currentTime = 0;
        }
    }, []);

    // Hero controls
    const toggleHeroMute = () => {
        setHeroMuted(!heroMuted);
        if (heroVideoRef.current) heroVideoRef.current.muted = !heroMuted;
    };

    const toggleHeroPause = () => {
        if (heroVideoRef.current) {
            if (heroPaused) heroVideoRef.current.play();
            else heroVideoRef.current.pause();
            setHeroPaused(!heroPaused);
        }
    };

    return (
        <div className="fixed inset-0 bg-[#030303] text-[#EDEDED] font-sans flex flex-col pt-[64px] overflow-hidden selection:bg-[#E50914] selection:text-white">

            {/* ═══ SCROLLABLE CONTENT ═══ */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar">

                {/* ── HERO SPOTLIGHT ── */}
                {heroShot && (
                    <div className="relative w-full h-[50vh] sm:h-[60vh] overflow-hidden">
                        {/* Background media */}
                        {heroShot.video_url ? (
                            <video
                                ref={heroVideoRef}
                                src={heroShot.video_url}
                                autoPlay
                                loop
                                muted={heroMuted}
                                playsInline
                                className="absolute inset-0 w-full h-full object-cover"
                            />
                        ) : (
                            <img
                                src={heroShot.image_url}
                                alt=""
                                className="absolute inset-0 w-full h-full object-cover"
                            />
                        )}

                        {/* Cinematic overlays */}
                        <div className="absolute inset-0 bg-gradient-to-t from-[#030303] via-[#030303]/40 to-transparent" />
                        <div className="absolute inset-0 bg-gradient-to-r from-[#030303]/70 via-transparent to-[#030303]/70" />
                        {/* Film grain */}
                        <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
                            style={{
                                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
                                backgroundSize: "200px 200px",
                            }}
                        />

                        {/* Hero content */}
                        <div className="absolute inset-0 flex flex-col justify-end p-8 sm:p-12 lg:p-16">
                            <div className="max-w-3xl">
                                {/* Badge */}
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="w-1.5 h-1.5 bg-[#E50914] rounded-full animate-pulse shadow-[0_0_8px_rgba(229,9,20,0.6)]" />
                                    <span className="text-[9px] font-mono text-white/40 uppercase tracking-[3px]">
                                        Spotlight — Made with MotionX
                                    </span>
                                </div>

                                {/* Title */}
                                <h1 className="font-['Anton'] text-[36px] sm:text-[52px] lg:text-[64px] uppercase leading-[0.9] tracking-[1px] text-white mb-4"
                                    style={{
                                        background: "linear-gradient(135deg, #FFFFFF 0%, #FFFFFF 60%, #E50914 100%)",
                                        WebkitBackgroundClip: "text",
                                        WebkitTextFillColor: "transparent",
                                    }}
                                >
                                    Explore What's<br />Possible
                                </h1>

                                <p className="text-[11px] sm:text-[13px] text-white/40 max-w-lg leading-relaxed mb-6 font-light">
                                    Discover AI-generated films, clips, and visual experiments from the MotionX community.
                                    Every frame you see was created with just a text prompt.
                                </p>

                                {/* Hero actions */}
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => router.push("/playground")}
                                        className="flex items-center gap-2 px-6 py-3 rounded-lg text-[10px] font-bold uppercase tracking-[2px] border-none cursor-pointer transition-all hover:scale-[1.03] active:scale-[0.98]"
                                        style={{
                                            background: "linear-gradient(135deg, #E50914, #B30710)",
                                            boxShadow: "0 4px 24px rgba(229,9,20,0.35), inset 0 1px 0 rgba(255,255,255,0.1)",
                                        }}
                                    >
                                        <Zap size={13} />
                                        Start Creating
                                    </button>

                                    {heroShot.prompt && (
                                        <button
                                            onClick={() => setSelectedShot(heroShot)}
                                            className="flex items-center gap-2 px-5 py-3 rounded-lg text-[10px] font-bold uppercase tracking-[2px] border border-white/10 bg-white/[0.04] backdrop-blur-sm text-white/70 hover:text-white hover:border-white/20 hover:bg-white/[0.08] cursor-pointer transition-all"
                                        >
                                            <Eye size={12} />
                                            See Prompt
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Hero media controls */}
                            {heroShot.video_url && (
                                <div className="absolute bottom-6 right-6 sm:bottom-8 sm:right-8 flex items-center gap-2">
                                    <button
                                        onClick={toggleHeroPause}
                                        className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/50 hover:text-white hover:border-white/25 transition-all cursor-pointer"
                                    >
                                        {heroPaused ? <Play size={12} fill="currentColor" /> : <Pause size={12} />}
                                    </button>
                                    <button
                                        onClick={toggleHeroMute}
                                        className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/50 hover:text-white hover:border-white/25 transition-all cursor-pointer"
                                    >
                                        {heroMuted ? <VolumeX size={12} /> : <Volume2 size={12} />}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ── FILTER BAR ── */}
                <div className="sticky top-0 z-30 bg-[#030303]/80 backdrop-blur-xl border-b border-white/[0.04]">
                    <div className="max-w-[1600px] mx-auto px-6 sm:px-10 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <span className="text-[9px] font-mono text-white/20 uppercase tracking-[2px]">
                                {loading ? "Loading…" : `${filtered.length} creation${filtered.length !== 1 ? "s" : ""}`}
                            </span>
                            <div className="w-px h-4 bg-white/[0.06]" />
                            <div className="flex gap-1">
                                {([
                                    { key: "ALL" as FilterKey, label: "All" },
                                    { key: "VIDEO" as FilterKey, label: "Video", icon: <Film size={9} /> },
                                    { key: "IMAGE" as FilterKey, label: "Image", icon: <ImageIcon size={9} /> },
                                ]).map(f => (
                                    <button
                                        key={f.key}
                                        onClick={() => setFilter(f.key)}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-[1px] cursor-pointer border transition-all duration-300 ${
                                            filter === f.key
                                                ? "bg-white/[0.08] border-white/[0.15] text-white shadow-[0_0_12px_rgba(255,255,255,0.04)]"
                                                : "bg-transparent border-transparent text-white/25 hover:text-white/50"
                                        }`}
                                    >
                                        {f.icon}
                                        {f.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Prompt hint */}
                        <p className="hidden sm:block text-[9px] text-white/15 font-mono tracking-wider">
                            Click any creation to see its prompt
                        </p>
                    </div>
                </div>

                {/* ── MASONRY GALLERY ── */}
                <div className="max-w-[1600px] mx-auto px-4 sm:px-8 py-8">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-32">
                            <div className="relative">
                                <div className="w-16 h-16 rounded-full border-2 border-[#E50914]/20 border-t-[#E50914] animate-spin" />
                                <Sparkles size={16} className="text-[#E50914] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                            </div>
                            <span className="text-[10px] font-mono text-white/20 uppercase tracking-[3px] mt-6">
                                Loading community feed
                            </span>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-32">
                            <div className="w-20 h-20 rounded-2xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-center mb-5">
                                <Film size={28} className="text-white/[0.08]" />
                            </div>
                            <p className="text-[14px] text-white/15 font-semibold tracking-wide">No creations found</p>
                            <p className="text-[10px] text-white/10 mt-1">
                                {filter !== "ALL" ? "Try a different filter" : "The community feed is empty"}
                            </p>
                        </div>
                    ) : (
                        <div className="columns-2 sm:columns-3 lg:columns-4 xl:columns-5 gap-3">
                            {filtered.map((shot, i) => (
                                <div
                                    key={shot.id + i}
                                    className="break-inside-avoid mb-3 explore-card-enter"
                                    style={{ animationDelay: `${Math.min(i * 40, 600)}ms` }}
                                >
                                    <div
                                        className="group relative rounded-xl overflow-hidden cursor-pointer bg-[#0a0a0a] border border-white/[0.03] hover:border-white/[0.12] transition-all duration-500"
                                        onClick={() => setSelectedShot(shot)}
                                        onMouseEnter={() => handleMouseEnter(shot, i)}
                                        onMouseLeave={() => handleMouseLeave(shot, i)}
                                        style={{ boxShadow: "0 2px 20px rgba(0,0,0,0.3)" }}
                                    >
                                        {/* Image */}
                                        <img
                                            src={shot.image_url}
                                            alt={shot.prompt || "AI generation"}
                                            className="w-full object-cover opacity-75 group-hover:opacity-100 group-hover:scale-[1.04] transition-all duration-700 ease-out"
                                            loading="lazy"
                                        />

                                        {/* Video overlay (play on hover) */}
                                        {shot.video_url && (
                                            <video
                                                ref={el => { if (el) videoRefs.current[shot.id + i] = el; }}
                                                loop
                                                muted
                                                playsInline
                                                preload="none"
                                                className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                                            />
                                        )}

                                        {/* Top badges */}
                                        <div className="absolute top-0 left-0 right-0 p-2.5 flex items-start justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                            <div className="flex gap-1.5">
                                                {shot.video_url && (
                                                    <div className="bg-[#E50914]/80 backdrop-blur-sm px-2 py-0.5 rounded-full flex items-center gap-1">
                                                        <Play size={7} fill="white" className="text-white" />
                                                        <span className="text-[7px] font-bold uppercase tracking-[0.5px] text-white">Video</span>
                                                    </div>
                                                )}
                                                {shot.shot_type && (
                                                    <div className="bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded-full">
                                                        <span className="text-[7px] font-bold uppercase tracking-[0.5px] text-white/60">{shot.shot_type}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Bottom hover overlay — prompt teaser */}
                                        <div className="absolute bottom-0 left-0 right-0 translate-y-full group-hover:translate-y-0 transition-transform duration-400 ease-out">
                                            <div className="bg-gradient-to-t from-black via-black/90 to-transparent px-3 pb-3 pt-8">
                                                <p className="text-[9px] text-white/60 line-clamp-2 leading-relaxed font-mono">
                                                    &ldquo;{shot.prompt}&rdquo;
                                                </p>
                                            </div>
                                        </div>

                                        {/* Ambient glow on hover */}
                                        <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
                                            style={{ boxShadow: "inset 0 0 40px rgba(229,9,20,0.06), 0 0 30px rgba(229,9,20,0.05)" }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ── FLOATING CTA (appears on scroll) ── */}
            <div
                className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-500 ${
                    scrolled ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
                }`}
            >
                <button
                    onClick={() => router.push("/playground")}
                    className="flex items-center gap-2 px-6 py-3 rounded-full text-[10px] font-bold uppercase tracking-[2px] border-none cursor-pointer transition-all hover:scale-105 active:scale-[0.98]"
                    style={{
                        background: "linear-gradient(135deg, #E50914, #B30710)",
                        boxShadow: "0 8px 32px rgba(229,9,20,0.4), 0 0 60px rgba(229,9,20,0.15)",
                        backdropFilter: "blur(10px)",
                    }}
                >
                    <Sparkles size={12} />
                    Create Your Own
                    <ArrowRight size={12} />
                </button>
            </div>

            {/* ── LIGHTBOX MODAL ── */}
            {selectedShot && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8 explore-lightbox-enter"
                    onClick={() => setSelectedShot(null)}
                    style={{ backgroundColor: "rgba(0,0,0,0.92)", backdropFilter: "blur(20px)" }}
                >
                    <div
                        className="relative max-w-5xl w-full max-h-[90vh] flex flex-col sm:flex-row rounded-2xl overflow-hidden border border-white/[0.06] bg-[#0a0a0a]/95 shadow-[0_40px_120px_rgba(0,0,0,0.8)]"
                        onClick={e => e.stopPropagation()}
                        style={{ animation: "lightboxSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)" }}
                    >
                        {/* Close */}
                        <button
                            onClick={() => setSelectedShot(null)}
                            className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all cursor-pointer border border-white/[0.06]"
                        >
                            <X size={14} />
                        </button>

                        {/* Media — left/top */}
                        <div className="relative flex-1 min-h-0 bg-black flex items-center justify-center sm:min-w-[55%]">
                            {selectedShot.video_url ? (
                                <video
                                    src={selectedShot.video_url}
                                    autoPlay
                                    loop
                                    playsInline
                                    controls
                                    className="w-full h-full object-contain max-h-[50vh] sm:max-h-[85vh]"
                                />
                            ) : (
                                <img
                                    src={selectedShot.image_url}
                                    alt={selectedShot.prompt}
                                    className="w-full h-full object-contain max-h-[50vh] sm:max-h-[85vh]"
                                />
                            )}
                        </div>

                        {/* Info panel — right/bottom */}
                        <div className="sm:w-[320px] lg:w-[360px] flex flex-col border-t sm:border-t-0 sm:border-l border-white/[0.06] bg-[#0a0a0a]">
                            {/* Header */}
                            <div className="p-5 pb-4 border-b border-white/[0.04]">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-6 h-6 rounded-md bg-[#E50914]/15 border border-[#E50914]/20 flex items-center justify-center">
                                        {selectedShot.video_url ? <Film size={11} className="text-[#E50914]" /> : <ImageIcon size={11} className="text-[#E50914]" />}
                                    </div>
                                    <span className="text-[9px] font-mono text-white/30 uppercase tracking-[2px]">
                                        {selectedShot.video_url ? "AI Video" : "AI Image"}
                                    </span>
                                </div>
                                <h3 className="text-[11px] font-mono text-white/20 uppercase tracking-[2px] mb-1">Prompt</h3>
                            </div>

                            {/* Prompt */}
                            <div className="flex-1 p-5 overflow-y-auto no-scrollbar">
                                <p className="text-[13px] text-white/55 leading-[1.7] font-light">
                                    &ldquo;{selectedShot.prompt}&rdquo;
                                </p>

                                {/* Tags */}
                                <div className="flex flex-wrap gap-1.5 mt-5">
                                    {selectedShot.shot_type && (
                                        <span className="text-[8px] font-bold uppercase tracking-[1px] text-white/20 bg-white/[0.03] border border-white/[0.06] px-2.5 py-1 rounded-full">
                                            {selectedShot.shot_type}
                                        </span>
                                    )}
                                    <span className="text-[8px] font-bold uppercase tracking-[1px] text-white/20 bg-white/[0.03] border border-white/[0.06] px-2.5 py-1 rounded-full flex items-center gap-1">
                                        {selectedShot.video_url ? <Film size={7} /> : <ImageIcon size={7} />}
                                        {selectedShot.video_url ? "Video" : "Image"}
                                    </span>
                                    <span className="text-[8px] font-bold uppercase tracking-[1px] text-[#E50914]/40 bg-[#E50914]/[0.05] border border-[#E50914]/10 px-2.5 py-1 rounded-full">
                                        MotionX
                                    </span>
                                </div>
                            </div>

                            {/* Action footer */}
                            <div className="p-5 pt-0">
                                <button
                                    onClick={() => {
                                        const encoded = encodeURIComponent(selectedShot.prompt || "");
                                        router.push(`/playground?idea=${encoded}`);
                                    }}
                                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-bold uppercase tracking-[2px] border-none cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98]"
                                    style={{
                                        background: "linear-gradient(135deg, #E50914, #B30710)",
                                        boxShadow: "0 4px 20px rgba(229,9,20,0.3)",
                                    }}
                                >
                                    <Sparkles size={12} />
                                    Try This Prompt
                                    <ArrowRight size={12} />
                                </button>

                                <p className="text-center text-[8px] text-white/10 mt-3 tracking-wider">
                                    Opens Playground with this prompt pre-filled
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ ANIMATIONS ═══ */}
            <style jsx global>{`
                @keyframes exploreCardEnter {
                    from {
                        opacity: 0;
                        transform: translateY(20px) scale(0.97);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                }
                .explore-card-enter {
                    animation: exploreCardEnter 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
                }

                @keyframes lightboxSlideUp {
                    from {
                        opacity: 0;
                        transform: translateY(30px) scale(0.95);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                }

                @keyframes explore-lightbox-bg {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                .explore-lightbox-enter {
                    animation: explore-lightbox-bg 0.3s ease-out;
                }
            `}</style>
        </div>
    );
}
