"use client";

import { useEffect, useState, useRef } from "react";
import { doc, onSnapshot, deleteDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Plus, Film, Radio, Image as ImageIcon, Crosshair, Disc, Maximize, Signal, Play, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { DashboardProject, fetchUserDashboardProjects, fetchGlobalFeed, invalidateDashboardCache, fetchUserProjectsBasic, enrichProjectPreview } from "@/lib/api";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";

const DEFAULT_SHOWREEL = "https://firebasestorage.googleapis.com/v0/b/motionx-studio.firebasestorage.app/o/MotionX%20Showreel%20(1).mp4?alt=media";

export default function Dashboard() {
    const [userCredits, setUserCredits] = useState<number | null>(null);
    const [myProjects, setMyProjects] = useState<DashboardProject[]>([]);
    const [globalShots, setGlobalShots] = useState<any[]>([]);
    const [activeProjectIndex, setActiveProjectIndex] = useState(0);
    const [bootState, setBootState] = useState<'booting' | 'ready'>('booting');
    const [filter, setFilter] = useState<'ALL' | 'MOTION' | 'STATIC'>('ALL');
    const [timeCode, setTimeCode] = useState("00:00:00:00");
    const [projectToDelete, setProjectToDelete] = useState<DashboardProject | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const router = useRouter();
    const videoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});
    const filmStripRef = useRef<HTMLDivElement>(null);

    // --- SCROLLBAR HIDING STYLES ---
    useEffect(() => {
        const style = document.createElement('style');
        style.innerHTML = `
            .no-scrollbar::-webkit-scrollbar { display: none; }
            .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        `;
        document.head.appendChild(style);
        return () => { document.head.removeChild(style); };
    }, []);

    useEffect(() => {
        const interval = setInterval(() => {
            const ms = Math.floor(Math.random() * 24).toString().padStart(2, '0');
            setTimeCode(new Date().toLocaleTimeString('en-US', { hour12: false }) + ":" + ms);
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                // Real-time Credits listener
                onSnapshot(doc(db, "users", user.uid), (d) => setUserCredits(d.data()?.credits || 0));

                // 1. FAST LOAD: Metadata
                const feedPromise = fetchGlobalFeed();
                const basicsPromise = fetchUserProjectsBasic(user.uid);

                const [basics, feed] = await Promise.all([basicsPromise, feedPromise]);

                setMyProjects(basics);
                setGlobalShots(feed);
                setBootState('ready');

                // 2. SLOW LOAD: Hydrate media one by one
                // We create a local working copy to avoid too many re-renders, or just update state per project
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
        return () => unsubscribe();
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

    const activeProject = myProjects[activeProjectIndex];
    const [projectType, setProjectType] = useState("");

    useEffect(() => {
        if (activeProject) {
            //retrieve project type from firebase project/projectId/type
            const projectType = doc(db, "projects", activeProject.id);
            console.log(projectType);
            onSnapshot(projectType, (doc) => {
                setProjectType(doc.data()?.type);
            });
        }
    }, [activeProject]);
    const filteredGlobal = globalShots.filter(s => {
        if (filter === 'MOTION') return !!s.video_url;
        if (filter === 'STATIC') return !s.video_url;
        return true;
    });

    if (bootState === 'booting') return (
        <div className="h-screen w-screen bg-[#050505] flex flex-col items-center justify-center text-[#FF0000] font-mono tracking-[4px]">
            <Loader2 className="animate-spin mb-4" size={40} />
            <span>SYSTEM_INITIALIZING...</span>
        </div>
    );

    return (
        <main className="fixed inset-0 bg-[#050505] text-[#EDEDED] font-sans flex flex-col pt-[64px] overflow-hidden selection:bg-[#FF0000] selection:text-white">

            {/* MAIN WORKSPACE */}
            <div className="flex-1 flex p-6 gap-6 min-h-0 overflow-hidden">

                {/* LEFT PRODUCTION UNIT */}
                <div className="flex-[3] flex flex-col min-w-0 h-full overflow-hidden gap-6">

                    {/* MONITOR */}
                    <div className="flex-[2] relative bg-black border border-[#333] group overflow-hidden shadow-2xl min-h-0 rounded-sm transition-colors hover:border-[#444]">
                        <div className="absolute inset-0 pointer-events-none z-20 p-4">
                            <div className="absolute top-4 left-4 w-8 h-8 border-l border-t border-white/60" />
                            <div className="absolute top-4 right-4 w-8 h-8 border-r border-t border-white/30" />
                            <div className="absolute bottom-4 left-4 w-8 h-8 border-l border-b border-white/90" />
                            <div className="absolute bottom-4 right-4 w-8 h-8 border-r border-b border-white/90" />
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"><Crosshair size={40} strokeWidth={0.5} /></div>
                        </div>

                        <div className="absolute inset-0 bg-[#0a0a0a]">
                            {activeProject || myProjects.length === 0 ? (
                                <>
                                    {activeProject?.previewVideo ? (
                                        <video key={activeProject.id} autoPlay loop muted playsInline className="w-full h-full object-cover opacity-90" src={activeProject.previewVideo} />
                                    ) : activeProject?.previewImage ? (
                                        <div className="w-full h-full bg-cover bg-center opacity-80" style={{ backgroundImage: `url(${activeProject.previewImage})` }} />
                                    ) : (
                                        <video autoPlay loop muted playsInline className="w-full h-full object-cover opacity-30 grayscale" src={DEFAULT_SHOWREEL} />
                                    )}

                                    <div className="absolute bottom-0 left-0 p-8 w-full z-30 bg-gradient-to-t from-black/90 via-black/40 to-transparent">
                                        <div className="flex items-end justify-between">
                                            <div>
                                                <span className="bg-[#FF0000] text-black text-[9px] font-bold px-2 py-0.5 font-mono rounded-sm mr-3 uppercase inline-block mb-2">
                                                    {activeProject ? (activeProject.type === 'movie' ? "FEATURE_FILM" : "SERIES") : "DEMO_MODE"}
                                                </span>
                                                <h1 className="text-5xl font-anton uppercase text-white leading-none drop-shadow-md">
                                                    {activeProject ? activeProject.title : "WELCOME STUDIO"}
                                                </h1>
                                            </div>

                                            {activeProject && (
                                                <Link href={projectType === 'adaptation' ? `/project/${activeProject.id}/adaptation` : `/project/${activeProject.id}/studio`}>
                                                    <button className="bg-white text-black px-8 py-3 font-bold text-xs uppercase tracking-[2px] hover:bg-[#FF0000] hover:text-white transition-colors duration-300 flex items-center gap-3 cursor-pointer">
                                                        ENTER PRODUCTION <Maximize size={14} />
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

                    {/* FILM STRIP CONTAINER */}
                    <div className="h-[200px] relative group/strip shrink-0">

                        {/* LEFT SCROLL BUTTON */}
                        <button
                            onClick={() => scrollFilmStrip('left')}
                            className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-black via-black/80 to-transparent z-20 flex items-center justify-center text-white opacity-0 group-hover/strip:opacity-100 transition-opacity duration-300 hover:text-[#FF0000] cursor-pointer"
                        >
                            <ChevronLeft size={32} />
                        </button>

                        {/* SCROLLABLE AREA */}
                        <div
                            ref={filmStripRef}
                            onWheel={handleFilmStripWheel}
                            className="h-full flex gap-4 overflow-x-auto overflow-y-hidden no-scrollbar pb-1 items-center select-none px-1 scroll-smooth"
                        >
                            <Link href="/project/new" className="shrink-0 aspect-[16/9] h-full border border-dashed border-[#333] bg-[#0A0A0A] flex flex-col items-center justify-center text-[#444] hover:text-[#FF0000] hover:border-[#FF0000] hover:bg-[#0f0f0f] transition-all group rounded-sm">
                                <Plus size={24} className="group-hover:scale-110 transition-transform" />
                                <span className="text-[9px] font-mono mt-3 uppercase tracking-[2px]">NEW_SLATE</span>
                            </Link>

                            {myProjects.map((p, i) => (
                                <div
                                    key={p.id}
                                    className={`shrink-0 aspect-[16/9] h-full bg-black border cursor-pointer relative overflow-hidden transition-all duration-300 group/card ${activeProjectIndex === i ? 'border-[#FF0000] scale-[1.0] z-10 shadow-[0_0_15px_rgba(255,0,0,0.2)] opacity-100' : 'border-[#222] opacity-60 hover:opacity-100 hover:border-[#444]'}`}
                                >
                                    {/* CLICKABLE AREA FOR SELECTION */}
                                    <div
                                        className="absolute inset-0 z-0"
                                        onClick={() => setActiveProjectIndex(i)}
                                    />

                                    {/* DELETE BUTTON (Stop Propagation to prevent selection) */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setProjectToDelete(p);
                                        }}
                                        className="absolute top-2 right-2 z-20 bg-black/80 p-2 rounded-sm text-white opacity-0 group-hover/card:opacity-100 hover:bg-red-600 transition-all duration-200"
                                    >
                                        <Trash2 size={14} />
                                    </button>

                                    {p.previewImage ? <img src={p.previewImage} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center bg-[#111]"><Film size={20} className="opacity-20" /></div>}
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
                            className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-black via-black/80 to-transparent z-20 flex items-center justify-center text-white opacity-0 group-hover/strip:opacity-100 transition-opacity duration-300 hover:text-[#FF0000] cursor-pointer"
                        >
                            <ChevronRight size={32} />
                        </button>
                    </div>
                </div>

                {/* RIGHT FEED STREAM */}
                <div className="w-[320px] border-l border-[#222] pl-6 flex flex-col shrink-0 h-full overflow-hidden">
                    <div className="flex items-center justify-between mb-4 shrink-0 h-8 font-mono">
                        <span className="text-[10px] text-[#888] uppercase tracking-[2px] flex items-center gap-2"><Radio size={12} className={globalShots.length > 0 ? "text-[#FF0000] animate-pulse" : "text-[#333]"} /> FEED_STREAM</span>
                        <div className="flex gap-1">
                            {['ALL', 'MOTION', 'STATIC'].map(f => (
                                <button key={f} onClick={() => setFilter(f as any)} className={`text-[8px] font-bold px-2 py-1 border rounded-sm transition-all ${filter === f ? 'bg-[#FF0000] text-black border-[#FF0000]' : 'text-[#444] border-[#333] hover:border-[#555]'}`}>{f[0]}</button>
                            ))}
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-4 pr-2 no-scrollbar pb-10">
                        {filteredGlobal.map((shot, i) => (
                            <div key={shot.id + i} className="bg-[#0A0A0A] border border-[#222] group hover:border-[#444] transition-all rounded-sm overflow-hidden shrink-0 relative"
                                onMouseEnter={() => videoRefs.current[shot.id + i]?.play().catch(() => { })}
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
                                            src={shot.video_url}
                                            loop
                                            muted
                                            playsInline
                                            className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                                        />
                                    )}
                                </div>

                                <div className="p-3 border-t border-[#1a1a1a] font-mono relative bg-[#0A0A0A]">
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="text-[8px] text-[#555] uppercase tracking-[1px]">{shot.shot_type || "RAW"}</span>
                                        {shot.video_url && <Play size={8} className="text-[#FF0000] opacity-0 group-hover:opacity-100 transition-opacity" fill="currentColor" />}
                                    </div>
                                    <p className="text-[10px] text-[#999] line-clamp-2 leading-relaxed opacity-70 group-hover:opacity-100 transition-opacity">"{shot.prompt}"</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            {/* DELETE MODAL */}
            {projectToDelete && (
                <DeleteConfirmModal
                    title={`DELETE PROJECT: ${projectToDelete.title}`}
                    message="Are you sure you want to purge this project data? This action is irreversible."
                    isDeleting={isDeleting}
                    onConfirm={async () => {
                        if (!projectToDelete) return;
                        setIsDeleting(true);
                        try {
                            await deleteDoc(doc(db, "projects", projectToDelete.id));
                            if (auth.currentUser) invalidateDashboardCache(auth.currentUser.uid); // Clear cache
                            setMyProjects(prev => prev.filter(p => p.id !== projectToDelete.id));
                            if (activeProjectIndex >= myProjects.length - 1) setActiveProjectIndex(Math.max(0, myProjects.length - 2));
                        } catch (e) {
                            console.error("DELETE FAILED", e);
                        } finally {
                            setIsDeleting(false);
                            setProjectToDelete(null);
                        }
                    }}
                    onCancel={() => setProjectToDelete(null)}
                />
            )}
        </main>
    );
}