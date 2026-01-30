"use client";

import { useEffect, useState, useRef } from "react";
import { collection, getDocs, query, where, orderBy, limit, collectionGroup, doc, onSnapshot } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
<<<<<<< HEAD
import { Loader2, Plus, Film, Radio, Image as ImageIcon, Crosshair, Disc, Maximize, Signal, Play, ChevronLeft, ChevronRight } from "lucide-react";
=======
import {
    Loader2, Plus, Film, Radio, Image as ImageIcon, Crosshair,
    Disc, Maximize, Signal, ChevronLeft, ChevronRight
} from "lucide-react";
import { Project } from "@/lib/types";
>>>>>>> 7a93b14 (dashboard changes)

const DEFAULT_SHOWREEL = "https://firebasestorage.googleapis.com/v0/b/motionx-studio.firebasestorage.app/o/MotionX%20Showreel%20(1).mp4?alt=media";

interface DashboardProject extends Project {
    previewVideo?: string | null;
    previewImage?: string | null;
}

interface DashboardProject extends Project {
    previewVideo?: string | null;
    previewImage?: string | null;
}

export default function Dashboard() {
    const [userCredits, setUserCredits] = useState<number | null>(null);
    const [myProjects, setMyProjects] = useState<DashboardProject[]>([]);
    const [myProjects, setMyProjects] = useState<DashboardProject[]>([]);
    const [globalShots, setGlobalShots] = useState<any[]>([]);
    const [activeProjectIndex, setActiveProjectIndex] = useState(0);
    const [bootState, setBootState] = useState<'booting' | 'ready'>('booting');
    const [filter, setFilter] = useState<'ALL' | 'MOTION' | 'STATIC'>('ALL');
    const [timeCode, setTimeCode] = useState("00:00:00:00");

    const router = useRouter();
    const videoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});
    const filmStripRef = useRef<HTMLDivElement>(null);

<<<<<<< HEAD
    // --- SCROLLBAR HIDING STYLES ---
    // We inject this to ensure NO scrollbars appear anywhere in this specific dashboard
=======
    // REF FOR CAROUSEL SCROLLING
    const filmStripRef = useRef<HTMLDivElement>(null);

    // 1. FORCE NO SCROLLBARS
>>>>>>> 7a93b14 (dashboard changes)
    useEffect(() => {
        const style = document.createElement('style');
        style.innerHTML = `
            .no-scrollbar::-webkit-scrollbar { display: none; }
            .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        `;
        document.head.appendChild(style);
        return () => { document.head.removeChild(style); };
    }, []);

    // 2. TIMECODE CLOCK
    // 2. TIMECODE CLOCK
    useEffect(() => {
        const interval = setInterval(() => {
            const ms = Math.floor(Math.random() * 24).toString().padStart(2, '0');
            setTimeCode(new Date().toLocaleTimeString('en-US', { hour12: false }) + ":" + ms);
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    // 3. DATA LOADING
    // 3. DATA LOADING
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                onSnapshot(doc(db, "users", user.uid), (d) => setUserCredits(d.data()?.credits || 0));
                await fetchUserProjects(user.uid);
                await fetchGlobalFeed();
                setBootState('ready');
            } else {
                router.replace("/login");
            }
        });
        return () => unsubscribe();
    }, [router]);

    // --- SCROLL HANDLERS ---

    // 1. Button Click Scroll
    const scrollFilmStrip = (direction: 'left' | 'right') => {
        if (filmStripRef.current) {
            const scrollAmount = 300; // Pixel amount to scroll
            filmStripRef.current.scrollBy({
                left: direction === 'left' ? -scrollAmount : scrollAmount,
                behavior: 'smooth'
            });
        }
    };

    // 2. Mouse Wheel Horizontal Scroll
    const handleFilmStripWheel = (e: React.WheelEvent) => {
        if (filmStripRef.current) {
            filmStripRef.current.scrollLeft += e.deltaY;
        }
    };

    const fetchUserProjects = async (uid: string) => {
        try {
            const q = query(collection(db, "projects"), where("owner_id", "==", uid), orderBy("created_at", "desc"));
            const snap = await getDocs(q).catch(() =>
                getDocs(query(collection(db, "projects"), where("owner_id", "==", uid)))
            );

            const projectData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as DashboardProject));
            const q = query(collection(db, "projects"), where("owner_id", "==", uid), orderBy("created_at", "desc"));
            const snap = await getDocs(q).catch(() =>
                getDocs(query(collection(db, "projects"), where("owner_id", "==", uid)))
            );

            const projectData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as DashboardProject));

            const enriched = await Promise.all(projectData.map(async (p) => {
                let vid = null, img = p.moodboard?.cover_image || null;

                const enriched = await Promise.all(projectData.map(async (p) => {
                    let vid = null, img = p.moodboard?.cover_image || null;

                    try {
                        let scenesRef;
                        if (p.type === 'movie') {
                            scenesRef = collection(db, "projects", p.id, "scenes");
                        } else {
                            const eps = await getDocs(query(collection(db, "projects", p.id, "episodes"), limit(1)));
                            if (!eps.empty) {
                                scenesRef = collection(db, "projects", p.id, "episodes", eps.docs[0].id, "scenes");
                            }
                        }

                        if (scenesRef) {
                            const scs = await getDocs(query(scenesRef, limit(1)));
                            let scenesRef;
                            if (p.type === 'movie') {
                                scenesRef = collection(db, "projects", p.id, "scenes");
                            } else {
                                const eps = await getDocs(query(collection(db, "projects", p.id, "episodes"), limit(1)));
                                if (!eps.empty) {
                                    scenesRef = collection(db, "projects", p.id, "episodes", eps.docs[0].id, "scenes");
                                }
                            }

                            if (scenesRef) {
                                const scs = await getDocs(query(scenesRef, limit(1)));
                                if (!scs.empty) {
                                    const shotsRef = collection(scs.docs[0].ref, "shots");
                                    const shs = await getDocs(query(shotsRef, where("status", "==", "rendered"), limit(3)));
                                    const shotsRef = collection(scs.docs[0].ref, "shots");
                                    const shs = await getDocs(query(shotsRef, where("status", "==", "rendered"), limit(3)));
                                    vid = shs.docs.find(d => d.data().video_url)?.data().video_url || null;
                                    if (!img) img = shs.docs.find(d => d.data().image_url)?.data().image_url || null;
                                }
                            }
                        } catch (e) { }
                        return { ...p, previewVideo: vid, previewImage: img };
                        return { ...p, previewVideo: vid, previewImage: img };
                    }));

                setMyProjects(enriched);

                setMyProjects(enriched);
            } catch (e) { }
        };

        const fetchGlobalFeed = async () => {
            try {
                const snap = await getDocs(query(collectionGroup(db, 'shots'), limit(40)));
                let valid = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter((s: any) => s.image_url || s.video_url);
                setGlobalShots(valid.sort(() => 0.5 - Math.random()));
            } catch (e) { }
        };

        // SCROLL HANDLERS
        const scrollFilmStrip = (direction: 'left' | 'right') => {
            if (filmStripRef.current) {
                const amount = 300; // Adjust scroll amount per click
                filmStripRef.current.scrollBy({
                    left: direction === 'left' ? -amount : amount,
                    behavior: 'smooth'
                });
            }
        };

        const activeProject = myProjects[activeProjectIndex];
        // SCROLL HANDLERS
        const scrollFilmStrip = (direction: 'left' | 'right') => {
            if (filmStripRef.current) {
                const amount = 300; // Adjust scroll amount per click
                filmStripRef.current.scrollBy({
                    left: direction === 'left' ? -amount : amount,
                    behavior: 'smooth'
                });
            }
        };

        const activeProject = myProjects[activeProjectIndex];
        const filteredGlobal = globalShots.filter(s => {
            if (filter === 'MOTION') return !!s.video_url;
            if (filter === 'STATIC') return !s.video_url;
            return true;
        });

<<<<<<< HEAD
        if (bootState === 'booting') return (
            <div className="h-screen w-screen bg-[#050505] flex flex-col items-center justify-center text-[#FF0000] font-mono tracking-[4px]">
                <Loader2 className="animate-spin mb-4" size={40} />
                <span>SYSTEM_INITIALIZING...</span>
            </div>
        );
=======
    if (bootState === 'booting') return <div className="h-screen w-screen bg-black flex items-center justify-center text-[#FF0000] font-mono tracking-[8px]">INITIALIZING TERMINAL...</div>;
>>>>>>> 7a93b14 (dashboard changes)

        return (
            <main className="h-screen w-screen bg-[#050505] text-[#EDEDED] font-sans flex flex-col pt-[64px] overflow-hidden selection:bg-[#FF0000] selection:text-white">

                {/* HUD BAR */}
                {/* HUD BAR */}
                <div className="h-10 border-b border-[#222] bg-black/95 flex items-center justify-between px-6 shrink-0 z-20 font-mono text-[10px]">
                    <div className="flex items-center gap-6">
                        <span className="flex items-center gap-2 text-[#FF0000] animate-pulse font-bold"><Disc size={8} fill="currentColor" /> REC</span>
                        <span className="text-[#666]">TC: <span className="text-white tabular-nums">{timeCode}</span></span>
                    </div>
                    <div className="flex items-center gap-6">
                        <span className="flex items-center gap-2 font-mono"><Signal size={12} className="text-green-500" /> ONLINE</span>
                        <span className="px-3 py-0.5 border border-[#333] bg-[#111] rounded-sm">CREDITS: <span className="text-[#FF0000] font-bold">{userCredits ?? '...'}</span></span>
                    </div>
                </div>

                {/* MAIN WORKSPACE */}
                {/* MAIN WORKSPACE */}
                <div className="flex-1 flex overflow-hidden p-6 gap-6 min-h-0">

                    {/* LEFT PRODUCTION UNIT */}
                    <div className="flex-[3] flex flex-col min-w-0 h-full overflow-hidden">

                        {/* MONITOR */}
<<<<<<< HEAD
        <div className="flex-1 relative bg-black border border-[#333] group overflow-hidden shadow-2xl min-h-0 mb-6 rounded-sm transition-colors hover:border-[#444]">
=======
                    <div className="flex-1 relative bg-black border border-[#333] group overflow-hidden shadow-2xl min-h-0 mb-6 rounded-sm">
                {/* Monitor Overlays */}
>>>>>>> 7a93b14 (dashboard changes)
                <div className="absolute inset-0 pointer-events-none z-20 p-4">
                    <div className="absolute top-4 left-4 w-8 h-8 border-l border-t border-white/60" />
                    <div className="absolute top-4 right-4 w-8 h-8 border-r border-t border-white/30" />
                    <div className="absolute bottom-4 left-4 w-8 h-8 border-l border-b border-white/90" />
                    <div className="absolute bottom-4 right-4 w-8 h-8 border-r border-b border-white/90" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"><Crosshair size={40} strokeWidth={0.5} /></div>
                </div>

<<<<<<< HEAD
        <div className="absolute inset-0 bg-[#0a0a0a]">
            {activeProject || mySeries.length === 0 ? (
=======
                        {/* Monitor Content */}
                        <div className="absolute inset-0">
                            {activeProject ? (
>>>>>>> 7a93b14 (dashboard changes)
                <>
                    {activeProject?.previewVideo ? (
                        <video key={activeProject.id} autoPlay loop muted playsInline className="w-full h-full object-cover opacity-90" src={activeProject.previewVideo} />
                    ) : activeProject?.previewImage ? (
                        <div className="w-full h-full bg-cover bg-center opacity-80" style={{ backgroundImage: `url(${activeProject.previewImage})` }} />
                    ) : (
                        <video autoPlay loop muted playsInline className="w-full h-full object-cover opacity-30 grayscale" src={DEFAULT_SHOWREEL} />
                    )}

<<<<<<< HEAD
        <div className="absolute bottom-0 left-0 p-8 w-full z-30 bg-gradient-to-t from-black/90 via-black/40 to-transparent">
            <div className="flex items-end justify-between">
                <div>
                    <span className="bg-[#FF0000] text-black text-[9px] font-bold px-2 py-0.5 font-mono rounded-sm mr-3 uppercase inline-block mb-2">
                        {activeProject ? "PROJECT_FOCUS" : "DEMO_MODE"}
                    </span>
                    <h1 className="text-5xl font-anton uppercase text-white leading-none drop-shadow-md">
                        {activeProject ? activeProject.title : "WELCOME STUDIO"}
                    </h1>
                </div>

                {activeProject && (
                    <Link href={`/series/${activeProject.id}`}>
                        <button className="bg-white text-black px-8 py-3 font-bold text-xs uppercase tracking-[2px] hover:bg-[#FF0000] hover:text-white transition-colors duration-300 flex items-center gap-3 cursor-pointer">
                            ENTER PRODUCTION <Maximize size={14} />
                        </button>
                    </Link>
                )}
=======
                                    <div className="absolute bottom-0 left-0 p-8 w-full z-30 bg-gradient-to-t from-black via-transparent">
                    <div className="flex items-end justify-between">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="bg-[#FF0000] text-black text-[9px] font-bold px-2 py-0.5 font-mono rounded-sm uppercase">
                                    {activeProject.type === 'micro_drama' ? 'SERIES' : 'CINEMA'}
                                </span>
                                <span className="text-[9px] font-mono text-white/50 uppercase tracking-widest">
                                    {activeProject.genre || "GENERIC"}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="bg-[#FF0000] text-black text-[9px] font-bold px-2 py-0.5 font-mono rounded-sm uppercase">
                                    {activeProject.type === 'micro_drama' ? 'SERIES' : 'CINEMA'}
                                </span>
                                <span className="text-[9px] font-mono text-white/50 uppercase tracking-widest">
                                    {activeProject.genre || "GENERIC"}
                                </span>
                            </div>
                            <h1 className="text-5xl font-anton uppercase text-white leading-none">{activeProject.title}</h1>
                        </div>

                        <Link href={`/project/${activeProject.id}/studio`}>
                            <button className="bg-white text-black px-10 py-4 font-bold text-xs uppercase tracking-[3px] hover:scale-105 transition-transform flex items-center gap-3">
                                ENTER STUDIO <Maximize size={14} />
                            </button>

                            <Link href={`/project/${activeProject.id}/studio`}>
                                <button className="bg-white text-black px-10 py-4 font-bold text-xs uppercase tracking-[3px] hover:scale-105 transition-transform flex items-center gap-3">
                                    ENTER STUDIO <Maximize size={14} />
                                </button>
                            </Link>
>>>>>>> 7a93b14 (dashboard changes)
                    </div>
                </div>
            </>
                            ) : (
<<<<<<< HEAD
    <div className="w-full h-full flex items-center justify-center">
        <Loader2 className="animate-spin text-[#333]" />
=======
                                <div className="w-full h-full flex flex-col items-center justify-center">
            <video autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover opacity-20" src={DEFAULT_SHOWREEL} />
            <div className="z-30 text-center">
                <h2 className="text-2xl font-display uppercase tracking-widest text-white mb-2">NO ACTIVE PROJECTS</h2>
                <p className="text-xs font-mono text-neutral-500">INITIALIZE NEW SLATE BELOW</p>
            </div>
>>>>>>> 7a93b14 (dashboard changes)
        </div>
                            )}
    </div>
                    </div >

<<<<<<< HEAD
        {/* FILM STRIP CONTAINER WITH BUTTONS */ }
        < div className = "h-[160px] relative group/strip shrink-0" >

            {/* LEFT SCROLL BUTTON */ }
            < button
    onClick = {() => scrollFilmStrip('left')
}
className = "absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-black via-black/80 to-transparent z-20 flex items-center justify-center text-white opacity-0 group-hover/strip:opacity-100 transition-opacity duration-300 hover:text-[#FF0000] cursor-pointer"
=======
                    {/* FILM STRIP CONTAINER WITH CONTROLS */}
                    <div className="h-[180px] shrink-0 relative group/strip">

                        {/* LEFT BUTTON */}
                        <button
                            onClick={() => scrollFilmStrip('left')}
                            className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-black via-black/80 to-transparent z-20 flex items-center justify-center text-white/50 hover:text-white transition-colors opacity-0 group-hover/strip:opacity-100"
>>>>>>> 7a93b14 (dashboard changes)
    >
    <ChevronLeft size={32} />
                        </button >

<<<<<<< HEAD
    {/* SCROLLABLE AREA - Added 'no-scrollbar' class */ }
    < div
ref = { filmStripRef }
onWheel = { handleFilmStripWheel }
className = "h-full flex gap-4 overflow-x-auto overflow-y-hidden no-scrollbar pb-1 items-center select-none px-1"
    >
    <Link href="/series/new" className="shrink-0 aspect-[16/9] h-full border border-dashed border-[#333] bg-[#0A0A0A] flex flex-col items-center justify-center text-[#444] hover:text-[#FF0000] hover:border-[#FF0000] hover:bg-[#0f0f0f] transition-all group rounded-sm">
        <Plus size={24} className="group-hover:scale-110 transition-transform" />
        <span className="text-[9px] font-mono mt-3 uppercase tracking-[2px]">NEW_SLATE</span>
    </Link>

{
    mySeries.map((s, i) => (
        <div
            key={s.id}
            onClick={() => setActiveProjectIndex(i)}
            className={`shrink-0 aspect-[16/9] h-full bg-black border cursor-pointer relative overflow-hidden transition-all duration-300 ${activeProjectIndex === i ? 'border-[#FF0000] scale-[1.0] z-10 shadow-[0_0_15px_rgba(255,0,0,0.2)] opacity-100' : 'border-[#222] opacity-60 hover:opacity-100 hover:border-[#444]'}`}
        >
            {s.previewImage ? <img src={s.previewImage} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center bg-[#111]"><Film size={20} className="opacity-20" /></div>}
            <div className="absolute bottom-0 p-2 w-full bg-gradient-to-t from-black to-transparent">
                <span className="text-white text-[9px] font-bold uppercase tracking-widest truncate block">{s.title}</span>
=======
                        {/* SCROLLABLE STRIP */}
                <div
                    ref={filmStripRef}
                    className="h-full flex gap-4 overflow-x-auto overflow-y-hidden no-scrollbar pb-1 px-1 scroll-smooth"
                >
                    {/* NEW SLATE - UPDATED LINK */}
                    <Link href="/project/new" className="shrink-0 aspect-[16/9] h-full border border-dashed border-[#333] bg-[#0A0A0A] flex flex-col items-center justify-center text-[#444] hover:text-[#FF0000] hover:border-[#FF0000] transition-all group rounded-sm">
                        <Plus size={24} /><span className="text-[8px] font-mono mt-2 uppercase tracking-[3px]">NEW_SLATE</span>
                    </Link>

                    {/* USER PROJECTS */}
                    {myProjects.map((p, i) => (
                        <div
                            key={p.id}
                            onClick={() => setActiveProjectIndex(i)}
                            className={`shrink-0 aspect-[16/9] h-full bg-black border cursor-pointer relative overflow-hidden transition-all duration-300 ${activeProjectIndex === i ? 'border-[#FF0000] scale-[1.02] z-10 shadow-[0_0_20px_rgba(255,0,0,0.4)]' : 'border-[#222] opacity-40 hover:opacity-80'}`}
                        >
                            {p.previewImage ? (
                                <img src={p.previewImage} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-[#111]"><Film size={20} className="opacity-20" /></div>
                            )}
                            <div className="absolute bottom-0 p-2 w-full bg-black/90 text-white flex justify-between items-center">
                                <span className="text-[9px] font-bold truncate uppercase tracking-widest max-w-[70%]">{p.title}</span>
                                <span className="text-[8px] font-mono text-[#666] uppercase">{p.type === 'movie' ? 'MOV' : 'SER'}</span>
>>>>>>> 7a93b14 (dashboard changes)
                            </div>
                        </div>
                    ))}
                </div>

<<<<<<< HEAD
        {/* RIGHT SCROLL BUTTON */ }
        < button
                            onClick = {() => scrollFilmStrip('right')}
className = "absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-black via-black/80 to-transparent z-20 flex items-center justify-center text-white opacity-0 group-hover/strip:opacity-100 transition-opacity duration-300 hover:text-[#FF0000] cursor-pointer"
=======
                        {/* RIGHT BUTTON */}
                        <button
                            onClick={() => scrollFilmStrip('right')}
                            className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-black via-black/80 to-transparent z-20 flex items-center justify-center text-white/50 hover:text-white transition-colors opacity-0 group-hover/strip:opacity-100"
>>>>>>> 7a93b14 (dashboard changes)
    >
    <ChevronRight size={32} />
                        </button >
                    </div >
                </div >

<<<<<<< HEAD
    {/* RIGHT FEED STREAM - Added 'no-scrollbar' class */ }
    < div className = "w-[320px] border-l border-[#222] pl-6 flex flex-col shrink-0 h-full overflow-hidden" >
=======
                {/* RIGHT FEED STREAM (Unchanged) */}
                <div className="w-[340px] border-l border-[#222] pl-6 flex flex-col shrink-0 h-full overflow-hidden">
>>>>>>> 7a93b14 (dashboard changes)
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
                </div >
            </div >
        </main >
    );
}