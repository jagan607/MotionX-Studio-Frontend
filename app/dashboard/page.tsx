"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, where, orderBy, limit, collectionGroup, QueryDocumentSnapshot } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Tv, ChevronRight, Loader2, Play, Plus, Trash2, Globe, Lock, Image as ImageIcon, Film, Filter, RefreshCw } from "lucide-react";
import { API_BASE_URL } from "@/lib/config";
import { DashboardTour } from "@/components/DashboardTour";
import { useDashboardTour } from "@/hooks/useDashboardTour";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import { toastError } from "@/lib/toast";

export default function Dashboard() {
    // DATA
    const [mySeries, setMySeries] = useState<any[]>([]);
    const [globalShots, setGlobalShots] = useState<any[]>([]);

    // UI STATES
    const [authLoading, setAuthLoading] = useState(true);
    const [feedLoading, setFeedLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState<'all' | 'video' | 'image'>('all');

    // PAGINATION
    const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    const router = useRouter();
    const { tourStep, nextStep, completeTour } = useDashboardTour();
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                try {
                    // 1. FETCH USER PROJECTS
                    await fetchUserProjects(user.uid);

                    // 2. FETCH GLOBAL SHOWCASE
                    await fetchGlobalShowcase(true);
                } catch (e) {
                    console.error("Init failed:", e);
                } finally {
                    setAuthLoading(false);
                }
            } else {
                router.replace("/login");
            }
        });
        return () => unsubscribe();
    }, [router]);

    // --- FETCH USER PROJECTS ---
    const fetchUserProjects = async (uid: string) => {
        let seriesData: any[] = [];
        try {
            const mySeriesRef = collection(db, "series");
            try {
                const myQ = query(mySeriesRef, where("owner_id", "==", uid), orderBy("created_at", "desc"));
                const mySnapshot = await getDocs(myQ);
                seriesData = mySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            } catch {
                const myQ = query(collection(db, "series"), where("owner_id", "==", uid));
                const snap = await getDocs(myQ);
                seriesData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            }
        } catch (e) { console.error(e); }

        const seriesWithThumbs = await Promise.all(seriesData.map(async (series) => {
            if (series.cover_image) return series;
            try {
                const locRef = collection(db, "series", series.id, "locations");
                const locSnap = await getDocs(query(locRef, limit(1)));
                const validLoc = locSnap.docs.find(d => d.data().image_url);
                if (validLoc) return { ...series, thumbnail: validLoc.data().image_url };
            } catch (e) { }
            return series;
        }));
        setMySeries(seriesWithThumbs);
    };

    // --- FETCH GLOBAL SHOWCASE (AGGRESSIVE) ---
    const fetchGlobalShowcase = async (isInitial = false) => {
        if (!isInitial && !hasMore) return;
        if (isInitial) setFeedLoading(true);
        else setLoadingMore(true);

        try {
            let rawShots: any[] = [];
            const BATCH_LIMIT = 100; // Aggressive fetch limit to find enough videos

            // STRATEGY A: Collection Group Query (Fastest)
            try {
                const shotsQ = query(collectionGroup(db, 'shots'), limit(BATCH_LIMIT));
                const shotsSnap = await getDocs(shotsQ);
                rawShots = shotsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                console.log(`Strategy A found ${rawShots.length} raw items`);
            } catch (err) {
                console.warn("Strategy A failed (Index/Perms), trying Strategy B...", err);
            }

            // STRATEGY B: Manual Deep Crawl (Fallback)
            // If Strategy A failed or returned too few items (< 10), we dig manually
            if (rawShots.length < 10 && isInitial) {
                console.log("Activating Deep Crawl Strategy...");
                // Fetch MORE series to check (20 recent projects)
                const seriesQ = query(collection(db, "series"), orderBy("created_at", "desc"), limit(20));
                const seriesSnap = await getDocs(seriesQ);

                // Parallel fetch for speed
                const promises = seriesSnap.docs.map(async (sDoc) => {
                    const epSnap = await getDocs(query(collection(db, "series", sDoc.id, "episodes"), limit(1)));
                    if (epSnap.empty) return [];

                    const epId = epSnap.docs[0].id;
                    // Get ALL scenes in the episode (removed limit)
                    const sceneSnap = await getDocs(collection(db, "series", sDoc.id, "episodes", epId, "scenes"));

                    const scenePromises = sceneSnap.docs.map(async (scDoc) => {
                        const shotSnap = await getDocs(collection(db, "series", sDoc.id, "episodes", epId, "scenes", scDoc.id, "shots"));
                        return shotSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                    });

                    const results = await Promise.all(scenePromises);
                    return results.flat();
                });

                const nestedResults = await Promise.all(promises);
                rawShots = nestedResults.flat();
                console.log(`Strategy B found ${rawShots.length} deep items`);
            }

            // FILTER & SHUFFLE
            const validShots = rawShots
                .filter((s: any) => s.status === 'rendered' && (s.image_url || s.video_url))
                .sort(() => 0.5 - Math.random()); // Shuffle

            // UPDATE STATE
            if (isInitial) {
                setGlobalShots(validShots);
                // If we used Strategy B (Manual), pagination is hard, so disable 'Load More'
                if (rawShots.length < BATCH_LIMIT) setHasMore(false);
            } else {
                setGlobalShots(prev => {
                    // Dedup logic
                    const existingIds = new Set(prev.map(s => s.id));
                    const uniqueNew = validShots.filter(s => !existingIds.has(s.id));
                    return [...prev, ...uniqueNew];
                });
            }

        } catch (error) {
            console.error("Global Feed Error:", error);
        } finally {
            setFeedLoading(false);
            setLoadingMore(false);
        }
    };

    // --- FILTER LOGIC ---
    const getFilteredList = () => {
        return globalShots.filter(shot => {
            const hasVideo = shot.video_url && shot.video_url.length > 5;

            if (activeFilter === 'video') return hasVideo;
            if (activeFilter === 'image') return !hasVideo && shot.image_url;
            return true;
        });
    };

    const filteredList = getFilteredList();

    // --- VIDEO EVENTS ---
    const handleVideoHover = (e: React.MouseEvent<HTMLVideoElement>) => {
        const vid = e.currentTarget;
        vid.currentTime = 0;
        vid.play().catch(() => { });
    };
    const handleVideoLeave = (e: React.MouseEvent<HTMLVideoElement>) => {
        e.currentTarget.pause();
    };

    // --- UTILS ---
    const confirmDeleteRequest = (e: React.MouseEvent, seriesId: string) => {
        e.preventDefault();
        e.stopPropagation();
        setDeleteId(seriesId);
    };

    const performDelete = async () => {
        if (!deleteId) return;
        setIsDeleting(true);
        try {
            const idToken = await auth.currentUser?.getIdToken();
            const res = await fetch(`${API_BASE_URL}/api/v1/script/series/${deleteId}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${idToken}` }
            });
            if (res.ok) {
                setMySeries(prev => prev.filter(s => s.id !== deleteId));
                setDeleteId(null);
            } else {
                toastError("DELETE FAILED");
            }
        } catch (err) {
            toastError("CONNECTION ERROR");
        } finally {
            setIsDeleting(false);
        }
    };

    if (authLoading) return <div className="min-h-screen bg-[#030303] flex items-center justify-center gap-2 font-mono text-xs text-[#FF0000]"><Loader2 className="animate-spin" /> INITIALIZING TERMINAL...</div>;

    return (
        <main className="min-h-screen bg-[#050505] text-[#EDEDED] font-sans pb-20 selection:bg-[#FF0000] selection:text-white overflow-x-hidden">

            {/* HERO SECTION */}
            <div className="relative h-[70vh] w-full bg-[#000] flex items-end pb-20 px-8 md:px-16 border-b border-[#111] overflow-hidden group">
                <div className="absolute inset-0 z-0">
                    <video autoPlay loop muted playsInline className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity duration-700">
                        <source src="https://firebasestorage.googleapis.com/v0/b/motionx-studio.firebasestorage.app/o/MotionX%20Showreel%20(1).mp4?alt=media" type="video/mp4" />
                    </video>
                    <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent" />
                    <div className="absolute inset-0 bg-gradient-to-r from-[#050505] via-[#050505]/40 to-transparent" />
                </div>
                <div className="relative z-20 max-w-4xl animate-in fade-in slide-in-from-bottom-10 duration-1000">
                    <div className="flex items-center gap-3 mb-4">
                        <span className="bg-[#FF0000] text-white text-[9px] font-bold px-2 py-1 uppercase tracking-widest rounded-sm">Featured Showcase</span>
                    </div>
                    <h1 className="text-6xl md:text-8xl font-anton uppercase leading-none mb-6 tracking-tight drop-shadow-2xl">
                        MOTION X <br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-[#888]">SHOWREEL</span>
                    </h1>
                    <div className="flex gap-4">
                        <Link href="/series/new"><button className="bg-[#EDEDED] text-black px-8 py-3 font-bold text-xs tracking-[2px] uppercase hover:bg-white hover:scale-105 transition-all flex items-center gap-2 rounded-sm shadow-lg shadow-white/10"><Plus size={16} /> New Project</button></Link>
                    </div>
                </div>
            </div>

            <div className="px-8 md:px-16 -mt-16 relative z-30">

                {/* --- MY PROJECTS --- */}
                <div className="mb-20">
                    <h2 className="text-xl font-anton uppercase tracking-wide mb-6 flex items-center gap-3 text-white drop-shadow-md">
                        Continue Producing <span className="text-[#666] text-sm font-mono">// {mySeries.length} ACTIVE</span>
                    </h2>

                    <div className="flex gap-5 overflow-x-auto pb-8 scrollbar-hide snap-x">
                        <Link href="/series/new" className="flex-shrink-0">
                            <div className="w-[300px] h-[170px] border border-[#222] bg-[#0A0A0A] flex flex-col items-center justify-center text-[#444] hover:border-[#FF0000] hover:text-[#FF0000] transition-all cursor-pointer group rounded-sm snap-start shadow-lg">
                                <Plus size={32} className="mb-3 group-hover:scale-110 transition-transform" />
                                <p className="text-[10px] font-bold tracking-[2px] uppercase">Initialize New</p>
                            </div>
                        </Link>

                        {mySeries.map((series) => (
                            <Link key={series.id} href={`/series/${series.id}`} className="flex-shrink-0 snap-start">
                                <div className="w-[300px] h-[170px] bg-[#111] border border-[#222] relative group overflow-hidden cursor-pointer hover:border-[#666] transition-all rounded-sm shadow-lg">
                                    {series.thumbnail || series.cover_image ? (
                                        <img src={series.thumbnail || series.cover_image} className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity duration-500" alt="Cover" />
                                    ) : (
                                        <div className="absolute inset-0 bg-gradient-to-br from-[#1A1A1A] to-[#050505] opacity-100 group-hover:scale-105 transition-transform duration-700" />
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent opacity-90" />
                                    <div className="absolute top-3 right-3 z-10 flex gap-2">
                                        {series.status === "private" && <Lock size={10} className="text-[#888]" />}
                                        <span className="bg-white/10 backdrop-blur-md border border-white/10 text-white text-[8px] font-bold px-1.5 py-0.5 uppercase tracking-wide">{series.style || "RAW"}</span>
                                    </div>
                                    <div className="absolute bottom-0 left-0 right-0 p-5 z-20">
                                        <h3 className="font-anton text-xl uppercase leading-none mb-1 text-white truncate">{series.title}</h3>
                                        <div className="flex justify-between items-end border-t border-white/10 pt-3 mt-2">
                                            <p className="text-[9px] text-[#888] font-mono uppercase truncate max-w-[150px]">{series.genre || "SCI-FI"}</p>
                                            <div className="flex items-center gap-3">
                                                <button onClick={(e) => confirmDeleteRequest(e, series.id)} className="text-[#444] hover:text-[#FF0000] transition-colors"><Trash2 size={14} /></button>
                                                <ChevronRight size={14} className="text-white group-hover:translate-x-1 transition-transform" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>

                {/* --- GLOBAL SHOWCASE --- */}
                <div>
                    <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 border-b border-[#222] pb-4">
                        <div>
                            <h2 className="text-3xl font-anton uppercase tracking-wide flex items-center gap-3 text-white">
                                Global Showcase <Globe size={24} className="text-[#FF0000] animate-pulse" />
                            </h2>
                            <p className="text-[#666] text-xs font-mono mt-2 uppercase tracking-widest">
                                /// STREAMING LIVE COMMUNITY RENDERS
                            </p>
                        </div>

                        {/* TABS */}
                        <div className="flex gap-2 mt-4 md:mt-0">
                            {[{ id: 'all', label: 'ALL' }, { id: 'video', label: 'MOTION' }, { id: 'image', label: 'STATIC' }].map(tab => (
                                <button key={tab.id} onClick={() => setActiveFilter(tab.id as any)} className={`px-4 py-2 text-[10px] font-bold tracking-[2px] uppercase border transition-all ${activeFilter === tab.id ? 'bg-[#EDEDED] text-black border-[#EDEDED]' : 'bg-transparent text-[#666] border-[#333] hover:border-[#666] hover:text-[#CCC]'}`}>{tab.label}</button>
                            ))}
                        </div>
                    </div>

                    {/* COLLAGE */}
                    {feedLoading ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => <div key={i} className={`bg-[#0A0A0A] border border-[#1A1A1A] animate-pulse rounded-sm ${i % 2 === 0 ? 'h-64' : 'h-40'}`} />)}
                        </div>
                    ) : filteredList.length > 0 ? (
                        /* KEY=ACTIVEFILTER forces re-mount on tab change to fix layout issues */
                        <div key={activeFilter} className="columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
                            {filteredList.map((shot) => (
                                <div key={shot.id} className="relative group break-inside-avoid bg-[#0A0A0A] border border-[#222] hover:border-[#FF0000]/50 transition-colors duration-300 rounded-sm overflow-hidden">
                                    {/* MEDIA */}
                                    {shot.video_url && shot.video_url.length > 5 ? (
                                        <div className="relative">
                                            <video
                                                src={shot.video_url}
                                                loop muted playsInline
                                                onMouseEnter={handleVideoHover}
                                                onMouseLeave={handleVideoLeave}
                                                className="w-full h-auto object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                                            />
                                            <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-md px-1.5 py-0.5 rounded-sm border border-white/10"><Film size={10} className="text-white" /></div>
                                        </div>
                                    ) : (
                                        <div className="relative">
                                            <img src={shot.image_url} className="w-full h-auto object-cover opacity-80 group-hover:opacity-100 transition-opacity" alt="Showcase" loading="lazy" />
                                            <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-md px-1.5 py-0.5 rounded-sm border border-white/10"><ImageIcon size={10} className="text-white" /></div>
                                        </div>
                                    )}

                                    {/* OVERLAY */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4 pointer-events-none">
                                        <div className="transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                                            <div className="flex items-center gap-2 mb-1">
                                                <div className="w-4 h-4 rounded-full bg-gradient-to-tr from-[#FF0000] to-black border border-white/20" />
                                                <span className="text-[8px] text-[#CCC] font-bold uppercase tracking-wider">{shot.shot_type || "CINEMATIC"}</span>
                                            </div>
                                            <p className="text-[10px] text-white font-mono leading-tight line-clamp-3">"{shot.prompt || "Untitled Render"}"</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="h-64 w-full border border-dashed border-[#222] flex flex-col items-center justify-center text-[#444] rounded-sm bg-[#050505]">
                            <Filter size={24} className="mb-4 opacity-50" />
                            <p className="text-xs uppercase tracking-widest">No signals found on this frequency</p>
                        </div>
                    )}
                </div>

            </div>

            <DashboardTour step={tourStep} onNext={nextStep} onComplete={completeTour} />
            {deleteId && <DeleteConfirmModal title="DELETE SERIES?" message="Irreversible action." isDeleting={isDeleting} onConfirm={performDelete} onCancel={() => setDeleteId(null)} />}
        </main>
    );
}