"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { doc, onSnapshot, deleteDoc, collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Plus, Film, Radio, Image as ImageIcon, Crosshair, Maximize, Play, ChevronLeft, ChevronRight, Trash2, ArrowRight, Megaphone, Sparkles, Zap, Wrench, X, Share2, Globe, Users as UsersIcon, Lock } from "lucide-react";
import ShareProjectModal from "@/components/ShareProjectModal";
import { collection as fsCollection, query as fsQuery, where as fsWhere, limit as fsLimit, onSnapshot as fsOnSnapshot } from "firebase/firestore";
import { DashboardProject, fetchUserDashboardProjects, fetchGlobalFeed, invalidateDashboardCache, fetchUserProjectsBasic, enrichProjectPreview } from "@/lib/api";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import { TourOverlay } from "@/components/tour/TourOverlay";
import { useTour } from "@/hooks/useTour";
import { DASHBOARD_TOUR_STEPS } from "@/lib/tourConfigs";

const DEFAULT_SHOWREEL = "https://firebasestorage.googleapis.com/v0/b/motionx-studio.firebasestorage.app/o/MotionX%20Showreel%20(1).mp4?alt=media";

export default function Dashboard() {
    const [userCredits, setUserCredits] = useState<number | null>(null);
    const [myProjects, setMyProjects] = useState<DashboardProject[]>([]);
    const [globalShots, setGlobalShots] = useState<any[]>([]);
    const [activeProjectIndex, setActiveProjectIndex] = useState(0);
    const [bootState, setBootState] = useState<'booting' | 'ready'>('booting');
    const [filter, setFilter] = useState<'ALL' | 'MOTION' | 'STATIC'>('ALL');
    const [projectToDelete, setProjectToDelete] = useState<DashboardProject | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showAllProjects, setShowAllProjects] = useState(false);
    const [shareProject, setShareProject] = useState<DashboardProject | null>(null);
    const [isOrgAdmin, setIsOrgAdmin] = useState(false);
    const [announcements, setAnnouncements] = useState<any[]>([]);
    const [dismissedIds, setDismissedIds] = useState<string[]>([]);
    const [activeAnnouncementIdx, setActiveAnnouncementIdx] = useState(0);
    const [announcementFading, setAnnouncementFading] = useState(false);
    const [showWhatsNew, setShowWhatsNew] = useState(false);
    const [modalSlideIdx, setModalSlideIdx] = useState(0);
    const [modalFading, setModalFading] = useState(false);
    const [modalVideoReady, setModalVideoReady] = useState(false);
    const whatsNewShownRef = useRef(false);
    const { step: tourStep, nextStep: tourNext, completeTour } = useTour("dashboard_tour");

    const router = useRouter();
    const videoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});
    const filmStripRef = useRef<HTMLDivElement>(null);

    // FIX #3: Store unsubscribe functions for proper cleanup
    const creditsUnsubRef = useRef<(() => void) | null>(null);
    const projectTypeUnsubRef = useRef<(() => void) | null>(null);
    const orgUnsubRef = useRef<(() => void) | null>(null);
    const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

    // Derive isOrgAdmin from Firestore org data
    useEffect(() => {
        const user = auth.currentUser;
        if (!user?.tenantId || !user?.email) return;
        const orgQ = fsQuery(fsCollection(db, "organizations"), fsWhere("tenant_id", "==", user.tenantId), fsLimit(1));
        orgUnsubRef.current = fsOnSnapshot(orgQ, (snap) => {
            if (!snap.empty) {
                const orgData = snap.docs[0].data();
                const role = orgData?.role_bindings?.[user.email!] || (orgData?.admins?.includes(user.email!) ? "admin" : "member");
                setIsOrgAdmin(role === "admin");
            }
        });
        return () => orgUnsubRef.current?.();
    }, []);

    // Load dismissed announcement IDs from localStorage
    useEffect(() => {
        try {
            const stored = localStorage.getItem('dismissed_announcements');
            if (stored) setDismissedIds(JSON.parse(stored));
        } catch { }
    }, []);

    // Real-time announcements listener
    useEffect(() => {
        const q = query(
            collection(db, 'announcements'),
            orderBy('created_at', 'desc'),
            limit(10)
        );
        const unsub = onSnapshot(q, (snap) => {
            const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            const active = all.filter((a: any) => a.active);
            setAnnouncements(active);

            // Defer What's New modal by 1.5s so main content loads first
            if (!whatsNewShownRef.current && active.length > 0) {
                whatsNewShownRef.current = true;
                setTimeout(() => setShowWhatsNew(true), 1500);
            }
        }, (err) => {
            console.error('Announcements listener error', err);
        });
        return () => unsub();
    }, []);

    const dismissAnnouncement = (id: string) => {
        const updated = [...dismissedIds, id];
        setDismissedIds(updated);
        localStorage.setItem('dismissed_announcements', JSON.stringify(updated));
    };

    const closeWhatsNew = () => {
        setShowWhatsNew(false);
        // Mark all current announcements as seen for the modal
        const seenIds = announcements.map(a => a.id);
        localStorage.setItem('whats_new_seen', JSON.stringify(seenIds));
    };

    const visibleAnnouncements = announcements.filter(a => !dismissedIds.includes(a.id));

    const ANNOUNCEMENT_TYPES: Record<string, { icon: any; color: string; label: string }> = {
        feature: { icon: Sparkles, color: '#E50914', label: 'Feature' },
        update: { icon: Zap, color: '#3B82F6', label: 'Update' },
        fix: { icon: Wrench, color: '#22C55E', label: 'Fix' },
    };

    // Auto-rotate announcements every 5s with fade transition
    useEffect(() => {
        if (visibleAnnouncements.length <= 1) return;
        const timer = setInterval(() => {
            setAnnouncementFading(true);
            setTimeout(() => {
                setActiveAnnouncementIdx(prev => (prev + 1) % visibleAnnouncements.length);
                setAnnouncementFading(false);
            }, 300);
        }, 5000);
        return () => clearInterval(timer);
    }, [visibleAnnouncements.length]);

    // Keep index in bounds when announcements change
    useEffect(() => {
        if (activeAnnouncementIdx >= visibleAnnouncements.length) {
            setActiveAnnouncementIdx(0);
        }
    }, [visibleAnnouncements.length, activeAnnouncementIdx]);

    // Auto-rotate modal slides every 5s
    useEffect(() => {
        if (!showWhatsNew || visibleAnnouncements.length <= 1) return;
        const timer = setInterval(() => {
            setModalFading(true);
            setTimeout(() => {
                setModalSlideIdx(prev => (prev + 1) % visibleAnnouncements.length);
                setModalFading(false);
            }, 250);
        }, 5000);
        return () => clearInterval(timer);
    }, [showWhatsNew, visibleAnnouncements.length]);

    // Reset modal slide and video ready state when opening
    useEffect(() => {
        if (showWhatsNew) {
            setModalSlideIdx(0);
            setModalVideoReady(false);
        }
    }, [showWhatsNew]);

    // Reset video ready state when slide changes
    useEffect(() => {
        setModalVideoReady(false);
    }, [modalSlideIdx]);

    const modalGoTo = (idx: number) => {
        if (idx === modalSlideIdx) return;
        setModalFading(true);
        setTimeout(() => {
            setModalSlideIdx(idx);
            setModalFading(false);
        }, 250);
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                // FIX #3: Clean up previous credits listener before creating new one
                creditsUnsubRef.current?.();
                creditsUnsubRef.current = onSnapshot(
                    doc(db, "users", user.uid),
                    (d) => setUserCredits(d.data()?.credits || 0)
                );

                // 1. FAST LOAD: Metadata
                const feedPromise = fetchGlobalFeed();
                const basicsPromise = fetchUserProjectsBasic(user.uid);

                const [basics, feed] = await Promise.all([basicsPromise, feedPromise]);

                setMyProjects(basics);
                setGlobalShots(feed);
                setBootState('ready');

                // 2. SLOW LOAD: Hydrate media one by one
                for (const p of basics) {
                    enrichProjectPreview(p).then(enriched => {
                        setMyProjects(prev => prev.map(item =>
                            item.id === enriched.id ? enriched : item
                        ));
                    });
                }
            } else {
                router.replace("/login");
            }
        });
        return () => {
            unsubscribe();
            // FIX #3: Cleanup listeners on unmount
            creditsUnsubRef.current?.();
            projectTypeUnsubRef.current?.();
        };
    }, [router]);

    // Navigate to a project's studio page
    const navigateToProject = useCallback((project: DashboardProject, type?: string) => {
        const url = type === 'adaptation' ? `/project/${project.id}/adaptation` : `/project/${project.id}/studio`;
        router.push(url);
    }, [router]);

    // --- SCROLL HANDLERS ---
    const scrollFilmStrip = (direction: 'left' | 'right') => {
        if (filmStripRef.current) {
            const scrollAmount = 300;
            filmStripRef.current.scrollBy({
                left: direction === 'left' ? -scrollAmount : scrollAmount,
                behavior: 'smooth'
            });
        }
    };

    const handleFilmStripWheel = (e: React.WheelEvent) => {
        if (filmStripRef.current) {
            filmStripRef.current.scrollLeft += e.deltaY;
        }
    };

    // FIX #10: Keyboard navigation for film strip & project switching
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (bootState !== 'ready' || myProjects.length === 0) return;
            if (e.key === 'ArrowLeft') {
                setActiveProjectIndex(prev => Math.max(0, prev - 1));
            } else if (e.key === 'ArrowRight') {
                setActiveProjectIndex(prev => Math.min(myProjects.length - 1, prev + 1));
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [bootState, myProjects.length]);

    const activeProject = myProjects[activeProjectIndex];
    const [projectType, setProjectType] = useState("");

    useEffect(() => {
        if (activeProject) {
            // FIX #3: Clean up previous projectType listener
            projectTypeUnsubRef.current?.();
            // FIX #2: Removed console.log
            const projectRef = doc(db, "projects", activeProject.id);
            projectTypeUnsubRef.current = onSnapshot(projectRef, (doc) => {
                setProjectType(doc.data()?.type);
            });
        }
    }, [activeProject]);

    const filteredGlobal = globalShots.filter(s => {
        if (filter === 'MOTION') return !!s.video_url;
        if (filter === 'STATIC') return !s.video_url;
        return true;
    });

    // FIX #4: Safe delete handler with correct index logic
    const handleDeleteProject = async () => {
        if (!projectToDelete) return;
        setIsDeleting(true);
        try {
            await deleteDoc(doc(db, "projects", projectToDelete.id));
            if (auth.currentUser) invalidateDashboardCache(auth.currentUser.uid);

            const newProjects = myProjects.filter(p => p.id !== projectToDelete.id);
            setMyProjects(newProjects);

            // Use the new array length, not the stale one
            if (activeProjectIndex >= newProjects.length) {
                setActiveProjectIndex(Math.max(0, newProjects.length - 1));
            }
        } catch (e) {
            console.error("DELETE FAILED", e);
        } finally {
            setIsDeleting(false);
            setProjectToDelete(null);
        }
    };

    if (bootState === 'booting') return (
        <div className="h-screen w-screen bg-[#050505] flex flex-col items-center justify-center text-[#E50914] font-sans tracking-[4px]">
            <Loader2 className="animate-spin mb-4" size={40} />
            <span className="text-xs font-semibold">Loading Studio...</span>
        </div>
    );

    return (
        <main className="fixed inset-0 bg-[#050505] text-[#EDEDED] font-sans flex flex-col pt-[64px] overflow-hidden selection:bg-[#E50914] selection:text-white">

            {/* MAIN WORKSPACE */}
            <div className="flex-1 flex flex-col lg:flex-row p-3 sm:p-4 lg:p-6 gap-4 lg:gap-6 min-h-0 overflow-hidden">

                {/* LEFT PRODUCTION UNIT */}
                <div className="flex-1 lg:flex-[3] flex flex-col min-w-0 h-full overflow-hidden gap-4 lg:gap-6">

                    {/* MONITOR */}
                    <div className="flex-[2] relative bg-black border border-[#222] group overflow-hidden shadow-2xl min-h-0 rounded-lg transition-colors hover:border-[#333]">
                        {/* FIX #9: Consistent viewfinder bracket opacity */}
                        <div className="absolute inset-0 pointer-events-none z-20 p-4">
                            <div className="absolute top-4 left-4 w-8 h-8 border-l border-t border-white/30" />
                            <div className="absolute top-4 right-4 w-8 h-8 border-r border-t border-white/30" />
                            <div className="absolute bottom-4 left-4 w-8 h-8 border-l border-b border-white/30" />
                            <div className="absolute bottom-4 right-4 w-8 h-8 border-r border-b border-white/30" />
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"><Crosshair size={40} strokeWidth={0.5} /></div>
                        </div>


                        <div className="absolute inset-0 bg-[#0a0a0a]">
                            {activeProject || myProjects.length === 0 ? (
                                <>
                                    {activeProject?.previewVideo ? (
                                        <video key={activeProject.id} autoPlay loop muted playsInline preload="none" className="w-full h-full object-cover opacity-90" src={activeProject.previewVideo} />
                                    ) : activeProject?.previewImage ? (
                                        <div className="w-full h-full bg-cover bg-center opacity-80" style={{ backgroundImage: `url(${activeProject.previewImage})` }} />
                                    ) : (
                                        <video autoPlay loop muted playsInline preload="none" className="w-full h-full object-cover opacity-30 grayscale" src={DEFAULT_SHOWREEL} />
                                    )}

                                    <div className="absolute bottom-0 left-0 p-4 sm:p-6 lg:p-8 w-full z-30 bg-gradient-to-t from-black/90 via-black/40 to-transparent">
                                        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-3 sm:gap-0">
                                            <div>
                                                <span className="bg-[#E50914] text-white text-[9px] font-bold px-3 py-0.5 rounded-md mr-3 uppercase inline-block mb-2 tracking-wide">
                                                    {activeProject ? (activeProject.type === 'movie' ? "FEATURE FILM" : "SERIES") : "WELCOME"}
                                                </span>
                                                <h1 className="text-2xl sm:text-3xl lg:text-5xl font-anton uppercase text-white leading-none drop-shadow-md">
                                                    {activeProject ? activeProject.title : "WELCOME STUDIO"}
                                                </h1>
                                            </div>

                                            {activeProject ? (
                                                <Link href={projectType === 'adaptation' ? `/project/${activeProject.id}/adaptation` : `/project/${activeProject.id}/studio`}>
                                                    <button className="bg-white text-black px-4 sm:px-8 py-2 sm:py-3 font-bold text-[10px] sm:text-xs uppercase tracking-[2px] hover:bg-[#E50914] hover:text-white transition-colors duration-300 flex items-center gap-2 sm:gap-3 cursor-pointer rounded-md">
                                                        ENTER PRODUCTION <Maximize size={14} />
                                                    </button>
                                                </Link>
                                            ) : (
                                                /* FIX #6: Better empty state for zero projects */
                                                <Link href="/project/new">
                                                    <button className="bg-[#E50914] text-white px-4 sm:px-8 py-2 sm:py-3 font-bold text-[10px] sm:text-xs uppercase tracking-[2px] hover:bg-[#ff1a25] transition-colors duration-300 flex items-center gap-2 sm:gap-3 cursor-pointer rounded-md">
                                                        CREATE FIRST PROJECT <ArrowRight size={14} />
                                                    </button>
                                                </Link>
                                            )}
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <Loader2 className="animate-spin text-[#333]" />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ANNOUNCEMENTS SLIDER — between monitor and film strip */}
                    {visibleAnnouncements.length > 0 && (() => {
                        const a = visibleAnnouncements[activeAnnouncementIdx] || visibleAnnouncements[0];
                        if (!a) return null;
                        const config = ANNOUNCEMENT_TYPES[a.type] || ANNOUNCEMENT_TYPES.update;
                        const Icon = config.icon;
                        const isVideo = a.media_url?.match(/\.(mp4|webm|mov)(\?|$)/i);
                        return (
                            <div className="shrink-0 relative overflow-hidden">
                                <div
                                    key={a.id}
                                    className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-[#1a1a1a] bg-[#0a0a0a] hover:border-[#333] group/ann"
                                    style={{
                                        borderLeftWidth: 3,
                                        borderLeftColor: config.color,
                                        transition: 'opacity 0.3s ease, transform 0.3s ease',
                                        opacity: announcementFading ? 0 : 1,
                                        transform: announcementFading ? 'translateY(8px)' : 'translateY(0)',
                                    }}
                                >
                                    {a.media_url && (
                                        <div className="w-10 h-10 rounded overflow-hidden shrink-0 border border-[#222]">
                                            {isVideo ? (
                                                <video src={a.media_url} autoPlay loop muted playsInline preload="none" className="w-full h-full object-cover" />
                                            ) : (
                                                <img src={a.media_url} alt="" className="w-full h-full object-cover" />
                                            )}
                                        </div>
                                    )}
                                    {!a.media_url && (
                                        <div className="w-8 h-8 rounded flex items-center justify-center shrink-0" style={{ background: `${config.color}12` }}>
                                            <Icon size={14} style={{ color: config.color }} />
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <span className="text-[11px] font-semibold text-white block truncate">{a.title}</span>
                                        <span className="text-[9px] text-[#666] block truncate">{a.body}</span>
                                    </div>
                                    {/* Dot indicators */}
                                    {visibleAnnouncements.length > 1 && (
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            {visibleAnnouncements.map((_, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => setActiveAnnouncementIdx(idx)}
                                                    className={`w-1.5 h-1.5 rounded-full transition-all cursor-pointer ${idx === activeAnnouncementIdx ? 'bg-white scale-110' : 'bg-[#444] hover:bg-[#666]'}`}
                                                />
                                            ))}
                                        </div>
                                    )}
                                    <span className="text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded shrink-0 hidden md:block" style={{ background: `${config.color}15`, color: config.color }}>
                                        {config.label}
                                    </span>
                                </div>
                            </div>
                        );
                    })()}

                    {/* Film strip header */}
                    {myProjects.length >= 6 && (
                        <div className="flex items-center justify-between mb-2 shrink-0">
                            <span className="text-[9px] text-[#555] uppercase tracking-[2px] font-semibold">Projects ({myProjects.length})</span>
                            <button
                                onClick={() => setShowAllProjects(true)}
                                className="text-[9px] text-[#666] hover:text-[#E50914] uppercase tracking-[2px] font-semibold transition-colors cursor-pointer"
                            >
                                View All
                            </button>
                        </div>
                    )}

                    {/* Film strip */}
                    <div className="h-[160px] md:h-[200px] lg:h-[220px] relative group/strip shrink-0">

                        {/* LEFT SCROLL BUTTON */}
                        <button
                            onClick={() => scrollFilmStrip('left')}
                            className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-black via-black/80 to-transparent z-20 flex items-center justify-center text-white opacity-0 group-hover/strip:opacity-100 transition-opacity duration-300 hover:text-[#E50914] cursor-pointer"
                        >
                            <ChevronLeft size={32} />
                        </button>

                        {/* SCROLLABLE AREA (FIX #11: no-scrollbar now in globals.css) */}
                        <div
                            ref={filmStripRef}
                            onWheel={handleFilmStripWheel}
                            className="h-full flex gap-4 overflow-x-auto overflow-y-hidden no-scrollbar pb-1 items-center select-none px-1 scroll-smooth"
                        >
                            <Link id="tour-new-series-target" href="/project/new" className="shrink-0 aspect-[16/9] h-full border border-dashed border-[#333] bg-[#0A0A0A] flex flex-col items-center justify-center text-[#444] hover:text-[#E50914] hover:border-[#E50914] hover:bg-[#0f0f0f] transition-all group rounded-md">
                                <Plus size={24} className="group-hover:scale-110 transition-transform" />
                                <span className="text-[9px] font-semibold mt-3 uppercase tracking-[2px]">New Project</span>
                            </Link>

                            {myProjects.map((p, i) => (
                                <div
                                    key={p.id}
                                    className={`shrink-0 aspect-[16/9] h-full bg-black border cursor-pointer relative overflow-hidden transition-all duration-300 group/card rounded-md ${activeProjectIndex === i ? 'border-[#E50914] scale-[1.0] z-10 shadow-[0_0_15px_rgba(229,9,20,0.15)] opacity-100' : 'border-[#222] opacity-60 hover:opacity-100 hover:border-[#333]'}`}
                                >
                                    {/* CLICKABLE AREA: single-click selects, double-click opens */}
                                    <div
                                        className="absolute inset-0 z-0"
                                        onClick={() => setActiveProjectIndex(i)}
                                        onDoubleClick={() => navigateToProject(p, p.type)}
                                    />

                                    {/* ACTION BUTTONS */}
                                    <div className="absolute top-2 right-2 z-20 flex gap-1 opacity-0 group-hover/card:opacity-100 transition-all duration-200">
                                        {isOrgAdmin && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setShareProject(p); }}
                                                className="bg-black/80 p-2 rounded-md text-white hover:bg-blue-600 transition-all"
                                                title="Share project"
                                            >
                                                <Share2 size={14} />
                                            </button>
                                        )}
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setProjectToDelete(p); }}
                                            className="bg-black/80 p-2 rounded-md text-white hover:bg-red-600 transition-all"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>

                                    {/* VISIBILITY BADGE */}
                                    <div className="absolute top-2 left-2 z-20">
                                        {p.is_global ? (
                                            <span className="flex items-center gap-1 bg-blue-500/80 text-white text-[7px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded backdrop-blur-sm">
                                                <Globe size={8} /> Global
                                            </span>
                                        ) : p.team_ids && p.team_ids.length > 0 ? (
                                            <span className="flex items-center gap-1 bg-purple-500/80 text-white text-[7px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded backdrop-blur-sm">
                                                <UsersIcon size={8} /> Team
                                            </span>
                                        ) : p.tenant_id ? (
                                            <span className="flex items-center gap-1 bg-[#555]/80 text-white text-[7px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded backdrop-blur-sm">
                                                <Lock size={8} /> Private
                                            </span>
                                        ) : null}
                                    </div>

                                    {/* FIX #12: Skeleton shimmer while previews load */}
                                    {p.previewImage ? (
                                        <img src={p.previewImage} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full skeleton-shimmer flex items-center justify-center">
                                            <Film size={20} className="opacity-20" />
                                        </div>
                                    )}
                                    <div className="absolute bottom-0 p-2 w-full bg-gradient-to-t from-black to-transparent flex justify-between items-center pointer-events-none">
                                        <span className="text-white text-[9px] font-bold uppercase tracking-widest truncate block max-w-[70%]">{p.title}</span>
                                        <span className="text-[8px] font-mono text-[#666] uppercase bg-black/50 px-1 rounded">
                                            {p.type === 'movie' ? 'MOV' : 'SER'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* RIGHT SCROLL BUTTON */}
                        <button
                            onClick={() => scrollFilmStrip('right')}
                            className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-black via-black/80 to-transparent z-20 flex items-center justify-center text-white opacity-0 group-hover/strip:opacity-100 transition-opacity duration-300 hover:text-[#E50914] cursor-pointer"
                        >
                            <ChevronRight size={32} />
                        </button>


                    </div>
                </div>

                {/* RIGHT FEED STREAM — hidden on mobile/tablet */}
                <div className="hidden lg:flex w-[320px] border-l border-[#222] pl-6 flex-col shrink-0 h-full overflow-hidden">
                    <div className="flex items-center justify-between mb-4 shrink-0 h-8">
                        <span className="text-[10px] text-[#888] uppercase tracking-[2px] flex items-center gap-2 font-semibold"><Radio size={12} className={globalShots.length > 0 ? "text-[#E50914] animate-pulse" : "text-[#333]"} /> Community Feed</span>
                        {/* FIX #8: Readable filter labels instead of single letters */}
                        <div className="flex gap-1">
                            {[
                                { key: 'ALL', label: 'All' },
                                { key: 'MOTION', label: 'Video' },
                                { key: 'STATIC', label: 'Image' },
                            ].map(f => (
                                <button key={f.key} onClick={() => setFilter(f.key as any)} className={`text-[8px] font-bold px-2.5 py-1 border rounded-md transition-all ${filter === f.key ? 'bg-[#E50914] text-white border-[#E50914]' : 'text-[#444] border-[#333] hover:border-[#555]'}`}>{f.label}</button>
                            ))}
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-4 pr-2 no-scrollbar pb-10">
                        {/* FIX #7: Empty state for filtered community feed */}
                        {filteredGlobal.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-center py-20">
                                <Film size={28} className="text-[#222] mb-3" />
                                <p className="text-[11px] text-[#444] uppercase tracking-widest font-semibold">No shots found</p>
                                <p className="text-[10px] text-[#333] mt-1">
                                    {filter !== 'ALL' ? 'Try switching the filter' : 'Community feed is loading'}
                                </p>
                            </div>
                        ) : (
                            filteredGlobal.map((shot, i) => (
                                <div key={shot.id + i} className="bg-[#0A0A0A] border border-[#222] group hover:border-[#333] transition-all rounded-md overflow-hidden shrink-0 relative"
                                    onMouseEnter={() => {
                                        const vid = videoRefs.current[shot.id + i];
                                        if (vid) {
                                            if (!vid.src) vid.src = shot.video_url;
                                            vid.play().catch(() => { });
                                        }
                                    }}
                                    onMouseLeave={() => {
                                        const vid = videoRefs.current[shot.id + i];
                                        if (vid) { vid.pause(); vid.currentTime = 0; }
                                    }}>

                                    <div className="aspect-video relative bg-black">
                                        <img src={shot.image_url} className="w-full h-full object-cover opacity-80" loading="lazy" />

                                        <div className="absolute top-2 right-2 bg-black/50 p-1 rounded-sm backdrop-blur-sm">
                                            {shot.video_url ? <Film size={10} className="text-white" /> : <ImageIcon size={10} className="text-white" />}
                                        </div>

                                        {shot.video_url && (
                                            <video
                                                ref={el => { if (el) videoRefs.current[shot.id + i] = el }}
                                                loop
                                                muted
                                                playsInline
                                                preload="none"
                                                className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                                            />
                                        )}
                                    </div>

                                    <div className="p-3 border-t border-[#1a1a1a] font-mono relative bg-[#0A0A0A]">
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="text-[8px] text-[#555] uppercase tracking-[1px]">{shot.shot_type || "RAW"}</span>
                                            {shot.video_url && <Play size={8} className="text-[#E50914] opacity-0 group-hover:opacity-100 transition-opacity" fill="currentColor" />}
                                        </div>
                                        <p className="text-[10px] text-[#999] line-clamp-2 leading-relaxed opacity-70 group-hover:opacity-100 transition-opacity">"{shot.prompt}"</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
            {/* DELETE MODAL (FIX #4: Uses corrected handler) */}
            {projectToDelete && (
                <DeleteConfirmModal
                    title={`DELETE PROJECT: ${projectToDelete.title}`}
                    message="Are you sure you want to purge this project data? This action is irreversible."
                    isDeleting={isDeleting}
                    onConfirm={handleDeleteProject}
                    onCancel={() => setProjectToDelete(null)}
                />
            )}
            {/* ALL PROJECTS GRID OVERLAY */}
            {showAllProjects && (
                <div className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-sm flex flex-col" onClick={() => setShowAllProjects(false)}>
                    <div className="max-w-[1200px] w-full mx-auto p-4 sm:p-8 pt-[72px] flex-1 overflow-y-auto no-scrollbar" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-2xl font-anton uppercase tracking-wide">All Projects ({myProjects.length})</h2>
                            <button onClick={() => setShowAllProjects(false)} className="text-[#666] hover:text-white text-sm cursor-pointer transition-colors">✕ Close</button>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            <Link href="/project/new" className="aspect-video border border-dashed border-[#333] bg-[#0A0A0A] flex flex-col items-center justify-center text-[#444] hover:text-[#E50914] hover:border-[#E50914] hover:bg-[#0f0f0f] transition-all rounded-lg">
                                <Plus size={28} />
                                <span className="text-[10px] font-semibold mt-2 uppercase tracking-[2px]">New Project</span>
                            </Link>
                            {myProjects.map((p) => (
                                <div
                                    key={p.id}
                                    className="aspect-video bg-black border border-[#222] rounded-lg overflow-hidden relative cursor-pointer group hover:border-[#444] transition-all"
                                    onDoubleClick={() => { setShowAllProjects(false); navigateToProject(p, p.type); }}
                                    onClick={() => { setShowAllProjects(false); setActiveProjectIndex(myProjects.indexOf(p)); }}
                                >
                                    {/* VISIBILITY BADGE */}
                                    <div className="absolute top-2 left-2 z-10">
                                        {p.is_global ? (
                                            <span className="flex items-center gap-1 bg-blue-500/80 text-white text-[7px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded backdrop-blur-sm">
                                                <Globe size={8} /> Global
                                            </span>
                                        ) : p.team_ids && p.team_ids.length > 0 ? (
                                            <span className="flex items-center gap-1 bg-purple-500/80 text-white text-[7px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded backdrop-blur-sm">
                                                <UsersIcon size={8} /> Team
                                            </span>
                                        ) : p.tenant_id ? (
                                            <span className="flex items-center gap-1 bg-[#555]/80 text-white text-[7px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded backdrop-blur-sm">
                                                <Lock size={8} /> Private
                                            </span>
                                        ) : null}
                                    </div>
                                    {p.previewImage ? (
                                        <img src={p.previewImage} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                                    ) : (
                                        <div className="w-full h-full skeleton-shimmer flex items-center justify-center">
                                            <Film size={24} className="opacity-20" />
                                        </div>
                                    )}
                                    <div className="absolute bottom-0 p-3 w-full bg-gradient-to-t from-black via-black/60 to-transparent">
                                        <span className="text-white text-[10px] font-bold uppercase tracking-widest block truncate">{p.title}</span>
                                        <span className="text-[8px] font-mono text-[#666] uppercase">{p.type === 'movie' ? 'Feature Film' : 'Series'}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
            {/* WHAT'S NEW MODAL */}
            {showWhatsNew && visibleAnnouncements.length > 0 && (() => {
                const a = visibleAnnouncements[modalSlideIdx] || visibleAnnouncements[0];
                if (!a) return null;
                const config = ANNOUNCEMENT_TYPES[a.type] || ANNOUNCEMENT_TYPES.update;
                const Icon = config.icon;
                const isVid = a.media_url?.match(/\.(mp4|webm|mov)(\?|$)/i);
                const total = visibleAnnouncements.length;
                return (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center" onClick={closeWhatsNew}>
                        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" style={{ animation: 'fadeIn 0.3s ease' }} />
                        <div
                            className="relative z-10 w-full max-w-lg mx-4 bg-[#0d0d0d] border border-[#222] rounded-xl overflow-hidden shadow-2xl"
                            onClick={e => e.stopPropagation()}
                            style={{ animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}
                        >
                            {/* Red top accent */}
                            <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#E50914] via-[#ff4444] to-[#E50914]" />

                            <div className="p-7">
                                {/* Header */}
                                <div className="flex items-center gap-2.5 mb-1">
                                    <Megaphone size={18} className="text-[#E50914]" />
                                    <span className="text-[10px] font-mono text-[#E50914] uppercase tracking-[4px] font-bold">What's New</span>
                                </div>
                                <h2 className="font-anton text-3xl text-white uppercase tracking-wide mb-5">Latest Updates</h2>

                                {/* Slide content with transition */}
                                <div
                                    className="overflow-hidden"
                                    style={{
                                        transition: 'opacity 0.35s ease, transform 0.35s ease',
                                        opacity: modalFading ? 0 : 1,
                                        transform: modalFading ? 'translateX(-30px)' : 'translateX(0)',
                                    }}
                                >
                                    {/* Media card */}
                                    {a.media_url && (
                                        <div className="w-full aspect-video rounded-lg overflow-hidden border border-[#222] mb-4 bg-black relative">
                                            {isVid ? (
                                                <>
                                                    {!modalVideoReady && (
                                                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0a0a] z-10">
                                                            <Loader2 className="animate-spin text-[#E50914] mb-2" size={28} />
                                                            <span className="text-[9px] font-mono text-[#444] uppercase tracking-widest">Loading Preview...</span>
                                                        </div>
                                                    )}
                                                    <video
                                                        key={a.id}
                                                        src={a.media_url}
                                                        autoPlay
                                                        loop
                                                        muted
                                                        playsInline
                                                        preload="metadata"
                                                        onCanPlay={() => setModalVideoReady(true)}
                                                        className={`w-full h-full object-cover transition-opacity duration-300 ${modalVideoReady ? 'opacity-100' : 'opacity-0'}`}
                                                    />
                                                </>
                                            ) : (
                                                <img key={a.id} src={a.media_url} alt="" className="w-full h-full object-cover" />
                                            )}
                                        </div>
                                    )}

                                    {/* Type badge + Title + Body */}
                                    <div className="flex items-center gap-2 mb-2">
                                        <Icon size={16} style={{ color: config.color }} />
                                        <span className="text-[9px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded" style={{ background: `${config.color}20`, color: config.color, border: `1px solid ${config.color}30` }}>
                                            {config.label}
                                        </span>
                                    </div>
                                    <h3 className="font-anton text-2xl text-white uppercase tracking-wide leading-tight">{a.title}</h3>
                                    <p className="text-[12px] text-[#888] mt-2 leading-relaxed">{a.body}</p>
                                </div>

                                {/* Bottom: dots + Got It */}
                                <div className="flex items-center justify-between mt-6 pt-5 border-t border-[#1a1a1a]">
                                    {total > 1 ? (
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => modalGoTo((modalSlideIdx - 1 + total) % total)}
                                                className="w-7 h-7 rounded-full border border-[#333] flex items-center justify-center text-[#555] hover:text-white hover:border-[#555] transition-colors cursor-pointer"
                                            >
                                                <ChevronLeft size={14} />
                                            </button>
                                            <div className="flex items-center gap-1.5">
                                                {visibleAnnouncements.map((_, idx) => (
                                                    <button
                                                        key={idx}
                                                        onClick={() => modalGoTo(idx)}
                                                        className={`rounded-full transition-all duration-300 cursor-pointer ${idx === modalSlideIdx
                                                            ? 'w-5 h-1.5 bg-[#E50914]'
                                                            : 'w-1.5 h-1.5 bg-[#333] hover:bg-[#555]'
                                                            }`}
                                                    />
                                                ))}
                                            </div>
                                            <button
                                                onClick={() => modalGoTo((modalSlideIdx + 1) % total)}
                                                className="w-7 h-7 rounded-full border border-[#333] flex items-center justify-center text-[#555] hover:text-white hover:border-[#555] transition-colors cursor-pointer"
                                            >
                                                <ChevronRight size={14} />
                                            </button>
                                        </div>
                                    ) : <div />}
                                    <button
                                        onClick={closeWhatsNew}
                                        className="bg-[#E50914] hover:bg-[#ff1a25] text-white px-8 py-2.5 text-[10px] font-bold uppercase tracking-[3px] transition-colors rounded-md cursor-pointer"
                                    >
                                        Got It
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}
            <TourOverlay step={tourStep} steps={DASHBOARD_TOUR_STEPS} onNext={tourNext} onComplete={completeTour} />
            {/* SHARE PROJECT MODAL */}
            {shareProject && (
                <ShareProjectModal
                    projectId={shareProject.id}
                    projectTitle={shareProject.title}
                    currentTeamIds={shareProject.team_ids || []}
                    currentIsGlobal={shareProject.is_global || false}
                    backendUrl={BACKEND_URL}
                    onClose={() => setShareProject(null)}
                    onSuccess={() => {
                        if (auth.currentUser) {
                            invalidateDashboardCache(auth.currentUser.uid);
                            fetchUserProjectsBasic(auth.currentUser.uid).then(setMyProjects);
                        }
                    }}
                />
            )}
        </main>
    );
}