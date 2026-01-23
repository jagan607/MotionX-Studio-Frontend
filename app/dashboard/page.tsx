"use client";

import { useEffect, useState, useRef } from "react";
import { collection, getDocs, query, where, orderBy, limit, collectionGroup, doc, onSnapshot } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Plus, Film, Radio, Image as ImageIcon, Crosshair, Disc, Maximize, Aperture, Cpu, Signal } from "lucide-react";

const DEFAULT_SHOWREEL = "https://firebasestorage.googleapis.com/v0/b/motionx-studio.firebasestorage.app/o/MotionX%20Showreel%20(1).mp4?alt=media";

export default function Dashboard() {
    const [userCredits, setUserCredits] = useState<number | null>(null);
    const [mySeries, setMySeries] = useState<any[]>([]);
    const [globalShots, setGlobalShots] = useState<any[]>([]);
    const [activeProjectIndex, setActiveProjectIndex] = useState(0);
    const [bootState, setBootState] = useState<'booting' | 'ready'>('booting');
    const [filter, setFilter] = useState<'ALL' | 'MOTION' | 'STATIC'>('ALL');
    const [timeCode, setTimeCode] = useState("00:00:00:00");

    const router = useRouter();
    const videoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});

    // CRITICAL: Force the browser to never allow a scrollbar on the main window
    useEffect(() => {
        const style = document.createElement('style');
        style.innerHTML = `
            html, body { overflow: hidden !important; height: 100vh !important; margin: 0 !important; padding: 0 !important; }
            * { scrollbar-width: none !important; -ms-overflow-style: none !important; }
            *::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }
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

    const fetchUserProjects = async (uid: string) => {
        try {
            const snap = await getDocs(query(collection(db, "series"), where("owner_id", "==", uid), orderBy("created_at", "desc")))
                .catch(() => getDocs(query(collection(db, "series"), where("owner_id", "==", uid))));
            const seriesData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

            const enriched = await Promise.all(seriesData.map(async (s: any) => {
                let vid = null, img = s.cover_image || null;
                try {
                    const eps = await getDocs(query(collection(db, "series", s.id, "episodes"), limit(1)));
                    if (!eps.empty) {
                        const scs = await getDocs(query(collection(db, "series", s.id, "episodes", eps.docs[0].id, "scenes"), limit(1)));
                        if (!scs.empty) {
                            const shs = await getDocs(query(collection(db, "series", s.id, "episodes", eps.docs[0].id, "scenes", scs.docs[0].id, "shots"), where("status", "==", "rendered"), limit(3)));
                            vid = shs.docs.find(d => d.data().video_url)?.data().video_url || null;
                            if (!img) img = shs.docs.find(d => d.data().image_url)?.data().image_url || null;
                        }
                    }
                } catch (e) { }
                return { ...s, previewVideo: vid, previewImage: img };
            }));
            setMySeries(enriched);
        } catch (e) { }
    };

    const fetchGlobalFeed = async () => {
        try {
            const snap = await getDocs(query(collectionGroup(db, 'shots'), limit(40)));
            let valid = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter((s: any) => s.image_url || s.video_url);
            setGlobalShots(valid.sort(() => 0.5 - Math.random()));
        } catch (e) { }
    };

    const activeProject = mySeries[activeProjectIndex];
    const filteredGlobal = globalShots.filter(s => {
        if (filter === 'MOTION') return !!s.video_url;
        if (filter === 'STATIC') return !s.video_url;
        return true;
    });

    if (bootState === 'booting') return <div className="h-screen w-screen bg-black flex items-center justify-center text-[#FF0000] font-mono tracking-[8px]">INITIALIZING...</div>;

    return (
        <main className="h-screen w-screen bg-[#050505] text-[#EDEDED] font-sans flex flex-col pt-[64px] overflow-hidden">

            {/* HUD BAR (Fixed 40px) */}
            <div className="h-10 border-b border-[#222] bg-black/95 flex items-center justify-between px-6 shrink-0 z-20 font-mono text-[10px]">
                <div className="flex items-center gap-6">
                    <span className="flex items-center gap-2 text-[#FF0000] animate-pulse font-bold"><Disc size={8} fill="currentColor" /> REC</span>
                    <span>TC: <span className="text-white">{timeCode}</span></span>
                </div>
                <div className="flex items-center gap-6">
                    <span className="flex items-center gap-2 font-mono"><Signal size={12} className="text-green-500" /> ONLINE</span>
                    <span className="px-3 py-0.5 border border-[#333] bg-[#111]">CREDITS: <span className="text-[#FF0000] font-bold">{userCredits}</span></span>
                </div>
            </div>

            {/* MAIN WORKSPACE - Forced to fill exact remaining height */}
            <div className="flex-1 flex overflow-hidden p-6 gap-6 min-h-0">

                {/* LEFT PRODUCTION UNIT */}
                <div className="flex-[3] flex flex-col min-w-0 h-full overflow-hidden">

                    {/* MONITOR: Forced to shrink using flex-1 and min-h-0 */}
                    <div className="flex-1 relative bg-black border border-[#333] group overflow-hidden shadow-2xl min-h-0 mb-6 rounded-sm">
                        <div className="absolute inset-0 pointer-events-none z-20 p-4">
                            <div className="absolute top-4 left-4 w-12 h-12 border-l-2 border-t-2 border-white/20" />
                            <div className="absolute top-4 right-4 w-12 h-12 border-r-2 border-t-2 border-white/20" />
                            <div className="absolute bottom-4 left-4 w-12 h-12 border-l-2 border-b-2 border-white/20" />
                            <div className="absolute bottom-4 right-4 w-12 h-12 border-r-2 border-b-2 border-white/20" />
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-10"><Crosshair size={60} strokeWidth={1} /></div>
                        </div>

                        <div className="absolute inset-0">
                            {activeProject ? (
                                <>
                                    {activeProject.previewVideo ? (
                                        <video key={activeProject.id} autoPlay loop muted playsInline className="w-full h-full object-cover opacity-90" src={activeProject.previewVideo} />
                                    ) : activeProject.previewImage ? (
                                        <div className="w-full h-full bg-cover bg-center opacity-60" style={{ backgroundImage: `url(${activeProject.previewImage})` }} />
                                    ) : (
                                        <video autoPlay loop muted playsInline className="w-full h-full object-cover opacity-40" src={DEFAULT_SHOWREEL} />
                                    )}
                                    <div className="absolute bottom-0 left-0 p-8 w-full z-30 bg-gradient-to-t from-black via-transparent">
                                        <div className="flex items-end justify-between">
                                            <div>
                                                <span className="bg-[#FF0000] text-black text-[9px] font-bold px-2 py-0.5 font-mono rounded-sm mr-3 uppercase">PROJECT_FOCUS</span>
                                                <h1 className="text-5xl font-anton uppercase text-white leading-none">{activeProject.title}</h1>
                                            </div>
                                            <Link href={`/series/${activeProject.id}`}>
                                                <button className="bg-white text-black px-10 py-4 font-bold text-xs uppercase tracking-[3px] hover:scale-105 transition-transform flex items-center gap-3">ENTER PRODUCTION <Maximize size={14} /></button>
                                            </Link>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <video autoPlay loop muted playsInline className="w-full h-full object-cover opacity-20" src={DEFAULT_SHOWREEL} />
                            )}
                        </div>
                    </div>

                    {/* FILM STRIP: Fixed Height at bottom */}
                    <div className="h-[180px] flex gap-4 overflow-x-auto overflow-y-hidden shrink-0 no-scrollbar pb-1">
                        <Link href="/series/new" className="shrink-0 aspect-[16/9] h-full border border-dashed border-[#333] bg-[#0A0A0A] flex flex-col items-center justify-center text-[#444] hover:text-[#FF0000] hover:border-[#FF0000] transition-all group rounded-sm">
                            <Plus size={24} /><span className="text-[8px] font-mono mt-2 uppercase tracking-[3px]">NEW_SLATE</span>
                        </Link>
                        {mySeries.map((s, i) => (
                            <div
                                key={s.id}
                                onClick={() => setActiveProjectIndex(i)}
                                className={`shrink-0 aspect-[16/9] h-full bg-black border cursor-pointer relative overflow-hidden transition-all duration-300 ${activeProjectIndex === i ? 'border-[#FF0000] scale-[1.02] z-10 shadow-[0_0_20px_rgba(255,0,0,0.4)]' : 'border-[#222] opacity-40 hover:opacity-80'}`}
                            >
                                {s.previewImage ? <img src={s.previewImage} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center bg-[#111]"><Film size={20} className="opacity-20" /></div>}
                                <div className="absolute bottom-0 p-2 w-full bg-black/90 text-white text-[9px] font-bold truncate uppercase tracking-widest">{s.title}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* RIGHT FEED STREAM */}
                <div className="w-[340px] border-l border-[#222] pl-6 flex flex-col shrink-0 h-full overflow-hidden">
                    <div className="flex items-center justify-between mb-4 shrink-0 h-8 font-mono">
                        <span className="text-[10px] text-white uppercase tracking-[3px] flex items-center gap-2"><Radio size={12} className="text-[#FF0000] animate-pulse" /> FEED_STREAM</span>
                        <div className="flex gap-1">
                            {['ALL', 'MOTION', 'STATIC'].map(f => (
                                <button key={f} onClick={() => setFilter(f as any)} className={`text-[8px] font-bold px-2 py-1 border rounded-sm transition-all ${filter === f ? 'bg-[#FF0000] text-black border-[#FF0000]' : 'text-[#444] border-[#333]'}`}>{f[0]}</button>
                            ))}
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-4 pr-2 no-scrollbar">
                        {filteredGlobal.map((shot, i) => (
                            <div key={shot.id + i} className="bg-[#080808] border border-[#222] group hover:border-[#666] transition-all rounded-sm overflow-hidden shrink-0" onMouseEnter={() => videoRefs.current[shot.id + i]?.play().catch(() => { })} onMouseLeave={() => videoRefs.current[shot.id + i]?.pause()}>
                                <div className="aspect-video relative bg-black">
                                    <img src={shot.image_url} className={`w-full h-full object-cover transition-opacity duration-300 ${shot.video_url ? 'opacity-60 group-hover:opacity-0' : 'opacity-60 group-hover:opacity-100'}`} />
                                    {shot.video_url && <video ref={el => { if (el) videoRefs.current[shot.id + i] = el }} src={shot.video_url} loop muted playsInline className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-500" />}
                                    <div className="absolute top-2 left-2 z-10">{shot.video_url ? <Film size={10} className="text-white" /> : <ImageIcon size={10} className="text-white" />}</div>
                                </div>
                                <div className="p-3 bg-black border-t border-[#111] font-mono">
                                    <span className="text-[8px] text-[#444] uppercase tracking-[2px]">{shot.shot_type || "RAW_DATA"}</span>
                                    <p className="text-[10px] text-[#888] line-clamp-2 italic leading-relaxed">"{shot.prompt}"</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </main>
    );
}