"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { doc, onSnapshot, getDoc, collection, query, where, orderBy, limit, getDocs, deleteDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Plus, Film, Trash2, ArrowRight, Share2, Globe, Users as UsersIcon, Lock, Eye, Rocket, ChevronLeft, ChevronRight, Maximize, Crosshair, FolderOpen, Zap, Copy } from "lucide-react";
import ShareProjectModal from "@/components/ShareProjectModal";
import { DashboardProject, TemplateProject, invalidateDashboardCache, fetchUserProjectsBasic, enrichProjectPreview, fetchTemplateProjects, cloneProject } from "@/lib/api";
import { toast } from "react-hot-toast";
import { API_BASE_URL } from "@/lib/config";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import { TourOverlay } from "@/components/tour/TourOverlay";
import { useTour } from "@/hooks/useTour";
import { DASHBOARD_TOUR_STEPS } from "@/lib/tourConfigs";
import { useWorkspace } from "@/app/context/WorkspaceContext";
// QuickStartTemplates removed — templates are now in the Project Templates section
import { useCredits } from "@/hooks/useCredits";
import { useAnnouncements } from "@/components/dashboard/DashboardAnnouncements";

const DEFAULT_SHOWREEL = "https://firebasestorage.googleapis.com/v0/b/motionx-studio.firebasestorage.app/o/MotionX%20Showreel%20(1).mp4?alt=media";

export default function Dashboard() {
    const [myProjects, setMyProjects] = useState<DashboardProject[]>([]);
    const [activeIdx, setActiveIdx] = useState(0);
    const [bootState, setBootState] = useState<'booting' | 'ready'>('booting');
    const [projectToDelete, setProjectToDelete] = useState<DashboardProject | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [shareProject, setShareProject] = useState<DashboardProject | null>(null);
    const [userProfile, setUserProfile] = useState<{ goal?: string } | null>(null);
    const [showAllProjects, setShowAllProjects] = useState(false);
    const [projectTemplates, setProjectTemplates] = useState<TemplateProject[]>([]);
    const [cloningId, setCloningId] = useState<string | null>(null);
    const [templateFilter, setTemplateFilter] = useState('all');
    const [monitorMode, setMonitorMode] = useState<'project' | 'announcements'>('announcements');
    const [annIdx, setAnnIdx] = useState(0);

    const { activeWorkspaceSlug, availableWorkspaces } = useWorkspace();
    const activeWs = availableWorkspaces.find(w => w.slug === activeWorkspaceSlug);
    const isOrgAccount = !!activeWorkspaceSlug;
    const isOrgAdmin = activeWs?.role === "admin";

    const { all: allAnn } = useAnnouncements();
    const { step: tourStep, nextStep: tourNext, completeTour } = useTour("dashboard_tour");
    const { credits } = useCredits();
    const router = useRouter();
    const videoRefs = useRef<{ [k: string]: HTMLVideoElement | null }>({});
    const filmStripRef = useRef<HTMLDivElement>(null);
    const BACKEND_URL = API_BASE_URL;

    // Data loading
    useEffect(() => {
        const user = auth.currentUser;
        if (!user) return;
        setMyProjects([]); setActiveIdx(0); setBootState('booting');
        getDoc(doc(db, "users", user.uid)).then(snap => {
            const p = snap.data()?.profile; if (p) setUserProfile(p);
        }).catch(() => { });
        invalidateDashboardCache(user.uid);
        const load = async () => {
            let basics = await fetchUserProjectsBasic(user.uid);
            if (basics.length === 0 && !isOrgAccount) {
                try {
                    const token = await user.getIdToken();
                    await fetch(`${BACKEND_URL}/api/v1/user/init`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
                    invalidateDashboardCache(user.uid); basics = await fetchUserProjectsBasic(user.uid);
                } catch { }
            }
            setMyProjects(basics); setBootState('ready');
            for (const p of basics) enrichProjectPreview(p).then(e => setMyProjects(prev => prev.map(i => i.id === e.id ? e : i)));
            // Fetch cloneable project templates
            fetchTemplateProjects().then(res => { console.log('[Dashboard] Templates loaded:', res.templates.length); setProjectTemplates(res.templates); }).catch(e => console.error('[Dashboard] Template fetch failed:', e));
        };
        load();
    }, [activeWorkspaceSlug]);

    const nav = useCallback((p: DashboardProject) => router.push(`/project/${p.id}`), [router]);
    const handleDelete = async () => {
        if (!projectToDelete) return; setIsDeleting(true);
        try { await deleteDoc(doc(db, "projects", projectToDelete.id)); if (auth.currentUser) invalidateDashboardCache(auth.currentUser.uid); setMyProjects(p => p.filter(x => x.id !== projectToDelete.id)); }
        catch { } finally { setIsDeleting(false); setProjectToDelete(null); }
    };

    const [pTypes, setPTypes] = useState<Record<string, string>>({});
    useEffect(() => {
        const u: (() => void)[] = [];
        myProjects.forEach(p => { const un = onSnapshot(doc(db, "projects", p.id), s => { const t = s.data()?.type; if (t) setPTypes(pr => ({ ...pr, [p.id]: t })); }); u.push(un); });
        return () => u.forEach(x => x());
    }, [myProjects]);

    // Auto-slide announcements every 6 seconds
    useEffect(() => {
        if (monitorMode !== 'announcements' || allAnn.length <= 1) return;
        const timer = setInterval(() => {
            setAnnIdx(p => (p + 1) % allAnn.length);
        }, 15000);
        return () => clearInterval(timer);
    }, [monitorMode, allAnn.length]);

    useEffect(() => {
        const h = (e: KeyboardEvent) => {
            if (bootState !== 'ready' || myProjects.length === 0) return;
            if (e.key === 'ArrowLeft') setActiveIdx(p => Math.max(0, p - 1));
            if (e.key === 'ArrowRight') setActiveIdx(p => Math.min(myProjects.length - 1, p + 1));
        };
        window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
    }, [bootState, myProjects.length]);

    const greeting = (() => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; })();
    const name = auth.currentUser?.displayName?.split(" ")[0] || "Director";
    const activeProject = myProjects[activeIdx];

    if (bootState === 'booting') return (
        <div className="h-screen w-screen bg-[#030303] flex flex-col items-center justify-center">
            <div className="relative"><div className="w-16 h-16 rounded-full border-2 border-[#E50914]/20 border-t-[#E50914] animate-spin" /><Film size={20} className="text-[#E50914] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" /></div>
            <span className="text-[10px] font-mono text-white/15 uppercase tracking-[4px] mt-6">Loading Studio</span>
        </div>
    );

    return (
        <main className="fixed inset-0 bg-[#030303] text-white font-sans flex flex-col pt-[64px] overflow-hidden selection:bg-[#E50914] selection:text-white">
            <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">

                {/* ═══ LEFT: MONITOR + PROJECTS + TEMPLATES ═══ */}
                <div className="flex-1 lg:flex-[3] flex flex-col min-w-0 p-3 sm:p-4 lg:p-5 gap-3 overflow-y-auto no-scrollbar">

                    {/* Monitor — cinematic preview (compact) */}
                    <div id="tour-monitor" className="relative bg-black border border-white/[0.06] rounded-xl group overflow-hidden h-[45vh] min-h-[260px] shrink-0 transition-colors hover:border-white/[0.1]">
                        {/* Viewfinder */}
                        <div className="absolute inset-0 pointer-events-none z-20 p-4">
                            <div className="absolute top-4 left-4 w-6 h-6 border-l border-t border-white/[0.08]" />
                            <div className="absolute top-4 right-4 w-6 h-6 border-r border-t border-white/[0.08]" />
                            <div className="absolute bottom-4 left-4 w-6 h-6 border-l border-b border-white/[0.08]" />
                            <div className="absolute bottom-4 right-4 w-6 h-6 border-r border-b border-white/[0.08]" />
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"><Crosshair size={32} strokeWidth={0.5} className="text-white/[0.06]" /></div>
                        </div>

                        {/* Mode tabs — only show if we have announcements */}
                        {allAnn.length > 0 && (
                            <div className="absolute top-3 left-3 z-30 flex gap-1 bg-black/50 backdrop-blur-xl rounded-lg border border-white/[0.06] p-0.5">
                                <button onClick={() => setMonitorMode('project')}
                                    className={`px-3 py-1.5 text-[8px] font-bold uppercase tracking-[1px] rounded-md transition-all cursor-pointer border-none ${monitorMode === 'project' ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white/60'}`}>
                                    Project
                                </button>
                                <button onClick={() => { setMonitorMode('announcements'); setAnnIdx(0); }}
                                    className={`px-3 py-1.5 text-[8px] font-bold uppercase tracking-[1px] rounded-md transition-all cursor-pointer border-none flex items-center gap-1.5 ${monitorMode === 'announcements' ? 'bg-[#E50914]/20 text-[#E50914]' : 'text-white/30 hover:text-white/60'}`}>
                                    What&apos;s New
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#E50914] animate-pulse" />
                                </button>
                            </div>
                        )}

                        {/* Media */}
                        <div className="absolute inset-0">
                            {monitorMode === 'announcements' && allAnn.length > 0 ? (() => {
                                const a = allAnn[annIdx] || allAnn[0];
                                if (!a) return null;
                                const isVid = a.media_url?.match(/\.(mp4|webm|mov)(\?|$)/i);
                                return a.media_url ? (
                                    isVid ? (
                                        <video key={a.id} src={a.media_url} autoPlay loop muted playsInline preload="none" className="w-full h-full object-cover opacity-80" />
                                    ) : (
                                        <div key={a.id} className="w-full h-full bg-cover bg-center opacity-70" style={{ backgroundImage: `url(${a.media_url})` }} />
                                    )
                                ) : (
                                    <div className="w-full h-full bg-gradient-to-br from-[#0a0a0a] via-[#111] to-[#0a0a0a]" />
                                );
                            })() : (
                                activeProject?.previewVideo ? (
                                    <video key={activeProject.id} src={activeProject.previewVideo} autoPlay loop muted playsInline preload="none" className="w-full h-full object-cover opacity-80" />
                                ) : activeProject?.previewImage ? (
                                    <div className="w-full h-full bg-cover bg-center opacity-70" style={{ backgroundImage: `url(${activeProject.previewImage})` }} />
                                ) : (
                                    <video src={DEFAULT_SHOWREEL} autoPlay loop muted playsInline preload="none" className="w-full h-full object-cover opacity-25 grayscale" />
                                )
                            )}
                        </div>

                        {/* Bottom overlay */}
                        <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 z-30 bg-gradient-to-t from-black/90 via-black/40 to-transparent">
                            {monitorMode === 'announcements' && allAnn.length > 0 ? (() => {
                                const a = allAnn[annIdx] || allAnn[0];
                                if (!a) return null;
                                const TYPES: Record<string, { color: string; label: string }> = {
                                    feature: { color: '#E50914', label: 'New Feature' },
                                    update: { color: '#3B82F6', label: 'Update' },
                                    fix: { color: '#22C55E', label: 'Fix' },
                                };
                                const c = TYPES[a.type] || TYPES.update;
                                return (
                                    <div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-[7px] font-bold px-2 py-0.5 rounded-md uppercase tracking-widest" style={{ background: `${c.color}20`, color: c.color }}>
                                                {c.label}
                                            </span>
                                        </div>
                                        <h1 className="text-[24px] sm:text-[32px] lg:text-[40px] font-['Anton'] uppercase leading-[0.9] tracking-[1px] text-white">
                                            {a.title}
                                        </h1>
                                        {a.body && <p className="text-[11px] text-white/50 mt-2 max-w-md leading-relaxed line-clamp-2">{a.body}</p>}
                                        {allAnn.length > 1 && (
                                            <div className="flex items-center gap-2 mt-3">
                                                {allAnn.map((_: any, i: number) => (
                                                    <button key={i} onClick={() => setAnnIdx(i)}
                                                        className={`rounded-full transition-all cursor-pointer border-none ${i === annIdx ? 'w-5 h-1.5 bg-[#E50914]' : 'w-1.5 h-1.5 bg-white/15 hover:bg-white/30'}`} />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })() : (
                                <div className="flex items-end justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="bg-[#E50914] text-white text-[7px] font-bold px-2 py-0.5 rounded-md uppercase tracking-widest">
                                                {activeProject ? ((pTypes[activeProject.id] || activeProject.type) === 'movie' ? 'Feature Film' : 'Series') : 'Welcome'}
                                            </span>
                                            {activeProject && (activeProject as any).is_sample && (
                                                <span className="bg-white/10 text-white/60 text-[7px] font-bold px-2 py-0.5 rounded-md uppercase tracking-widest animate-pulse">✨ Sample</span>
                                            )}
                                        </div>
                                        <h1 className="text-[24px] sm:text-[32px] lg:text-[40px] font-['Anton'] uppercase leading-[0.9] tracking-[1px] text-white truncate">
                                            {activeProject ? activeProject.title : 'MotionX Studio'}
                                        </h1>
                                    </div>
                                    {activeProject ? (
                                        <div className="flex items-center gap-2 shrink-0">
                                            <button onClick={() => nav(activeProject)}
                                                className="bg-white text-black px-4 sm:px-6 py-2 sm:py-2.5 font-bold text-[9px] sm:text-[10px] uppercase tracking-[2px] hover:bg-[#E50914] hover:text-white transition-all flex items-center gap-2 cursor-pointer rounded-lg border-none">
                                                Open <Maximize size={12} />
                                            </button>
                                            {(!isOrgAccount || isOrgAdmin) && (
                                                <button onClick={() => setProjectToDelete(activeProject)}
                                                    className="w-9 h-9 rounded-lg bg-white/5 border border-white/[0.06] flex items-center justify-center text-white/30 hover:text-white hover:bg-red-500/60 transition-all cursor-pointer">
                                                    <Trash2 size={13} />
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        <Link href="/project/new">
                                            <button className="bg-[#E50914] text-white px-6 py-2.5 font-bold text-[10px] uppercase tracking-[2px] hover:bg-[#ff1a25] transition-colors flex items-center gap-2 cursor-pointer rounded-lg border-none">
                                                Create Project <ArrowRight size={12} />
                                            </button>
                                        </Link>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Top-right: greeting + stats */}
                        <div className="absolute top-3 right-3 z-30 flex items-center gap-1.5">
                            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/40 backdrop-blur-xl border border-white/[0.05] text-[9px] font-mono text-white/35">
                                <div className="w-1 h-1 bg-[#00FF41] rounded-full animate-pulse" />
                                {greeting}, {name}
                            </div>
                            <div className="px-2 py-1.5 rounded-lg bg-black/40 backdrop-blur-xl border border-white/[0.05] text-[9px] font-mono text-white/35">
                                ⚡{credits ?? '—'}
                            </div>
                        </div>
                    </div>


                    {/* Film strip header */}
                    <div className="flex items-center justify-between px-1 shrink-0">
                        <span className="text-[10px] font-bold tracking-[2px] uppercase text-white/50">Your Projects <span className="text-white/20 font-mono">({myProjects.length})</span></span>
                        {myProjects.length > 0 && (
                            <button onClick={() => setShowAllProjects(true)}
                                className="text-[9px] font-bold text-[#E50914] uppercase tracking-[1px] hover:text-white transition-colors cursor-pointer bg-transparent border-none">
                                View All →
                            </button>
                        )}
                    </div>

                    {/* Film strip */}
                    <div id="tour-project-grid" className="h-[120px] sm:h-[140px] lg:h-[160px] relative group/strip shrink-0">
                        <button onClick={() => filmStripRef.current?.scrollBy({ left: -280, behavior: 'smooth' })}
                            className="absolute left-0 top-0 bottom-0 w-10 bg-gradient-to-r from-[#030303] to-transparent z-20 flex items-center justify-center text-white/0 group-hover/strip:text-white/40 transition-all hover:text-[#E50914] cursor-pointer border-none">
                            <ChevronLeft size={20} />
                        </button>
                        <div ref={filmStripRef} className="h-full flex gap-2 overflow-x-auto no-scrollbar scroll-smooth items-center px-1"
                            onWheel={e => { if (filmStripRef.current) filmStripRef.current.scrollLeft += e.deltaY; }}>
                            <Link id="tour-new-series-target" href="/project/new"
                                className="shrink-0 aspect-[16/9] h-full border-2 border-dashed border-[#E50914]/30 bg-[#E50914]/[0.04] rounded-lg flex flex-col items-center justify-center text-[#E50914]/70 hover:text-[#E50914] hover:border-[#E50914]/50 hover:bg-[#E50914]/[0.08] transition-all group no-underline">
                                <Plus size={20} className="group-hover:rotate-90 transition-transform duration-300 mb-1" />
                                <span className="text-[8px] font-bold uppercase tracking-[2px]">New Project</span>
                            </Link>
                            {myProjects.map((p, i) => (
                                <div key={p.id}
                                    className={`shrink-0 aspect-[16/9] h-full rounded-lg overflow-hidden relative cursor-pointer group/card transition-all duration-300
                                        ${activeIdx === i ? 'border-2 border-[#E50914] shadow-[0_0_15px_rgba(229,9,20,0.15)] scale-[1.02] z-10 opacity-100' : 'border border-white/[0.04] opacity-50 hover:opacity-90 hover:border-white/[0.1]'}`}
                                    onClick={() => { if (activeIdx === i) { nav(p); } else { setActiveIdx(i); setMonitorMode('project'); } }}>
                                    {p.previewImage ? <img src={p.previewImage} alt="" className="w-full h-full object-cover" loading="lazy" /> : <div className="w-full h-full bg-[#080808] flex items-center justify-center"><Film size={14} className="text-white/[0.04]" /></div>}
                                    <div className="absolute top-1 left-1 z-10">
                                        {(p as any).is_sample && <span className="bg-[#E50914] text-white text-[5px] font-bold uppercase tracking-widest px-1 py-0.5 rounded">Sample</span>}
                                    </div>
                                    {(!isOrgAccount || isOrgAdmin) && (
                                        <button onClick={(e) => { e.stopPropagation(); setProjectToDelete(p); }}
                                            className="absolute top-1 right-1 z-10 w-5 h-5 rounded bg-black/50 flex items-center justify-center text-white/30 hover:bg-red-500/80 transition-all cursor-pointer opacity-0 group-hover/card:opacity-100 border-none">
                                            <Trash2 size={8} />
                                        </button>
                                    )}
                                    <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-gradient-to-t from-black/70 to-transparent">
                                        <span className="text-[7px] font-bold text-white uppercase tracking-wider truncate block">{p.title}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <button onClick={() => filmStripRef.current?.scrollBy({ left: 280, behavior: 'smooth' })}
                            className="absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-[#030303] to-transparent z-20 flex items-center justify-center text-white/0 group-hover/strip:text-white/40 transition-all hover:text-[#E50914] cursor-pointer border-none">
                            <ChevronRight size={20} />
                        </button>
                    </div>


                    {/* ═══ PROJECT TEMPLATES — cloneable ═══ */}
                    {projectTemplates.length > 0 && (() => {
                        // Smart genre categorization
                        const CATEGORIES: { key: string; label: string; color: string; keywords: string[] }[] = [
                            { key: 'drama', label: 'Drama', color: '#3B82F6', keywords: ['drama'] },
                            { key: 'comedy', label: 'Comedy', color: '#F59E0B', keywords: ['comedy', 'dark comedy', 'feel good'] },
                            { key: 'action', label: 'Action & Thriller', color: '#EF4444', keywords: ['action', 'thriller', 'suspense', 'military', 'crime'] },
                            { key: 'scifi', label: 'Sci-Fi & Fantasy', color: '#8B5CF6', keywords: ['sci fi', 'sci-fi', 'fantasy', 'mythology', 'supernatural'] },
                            { key: 'horror', label: 'Horror', color: '#64748B', keywords: ['horror', 'noir', 'neo-noir'] },
                            { key: 'romance', label: 'Romance', color: '#EC4899', keywords: ['romance', 'romantic'] },
                            { key: 'commercial', label: 'Commercial', color: '#D4A843', keywords: ['ad', 'advertisement', 'commercial', 'ugc'] },
                            { key: 'mystery', label: 'Mystery', color: '#06B6D4', keywords: ['mystery', 'murder mystery', 'philosophical'] },
                        ];
                        const categorize = (t: TemplateProject) => {
                            const g = (t.genre || '').toLowerCase();
                            const tp = t.type?.toLowerCase() || '';
                            const matched: string[] = [];
                            for (const cat of CATEGORIES) {
                                if (cat.keywords.some(kw => g.includes(kw) || (cat.key === 'commercial' && (tp === 'ad' || tp === 'ugc')))) {
                                    matched.push(cat.key);
                                }
                            }
                            return matched.length > 0 ? matched : ['drama']; // default
                        };
                        const filtered = templateFilter === 'all'
                            ? projectTemplates
                            : projectTemplates.filter(t => categorize(t).includes(templateFilter));
                        // Only show categories that have templates
                        const activeCats = CATEGORIES.filter(cat =>
                            projectTemplates.some(t => categorize(t).includes(cat.key))
                        );
                        return (
                            <div id="tour-templates" className="shrink-0 mt-2">
                                <div className="flex items-center justify-between mb-3 px-1">
                                    <div className="flex items-center gap-2">
                                        <Copy size={12} className="text-[#E50914]" />
                                        <span className="text-[10px] font-bold tracking-[2px] uppercase text-white/40">Project Templates</span>
                                        <span className="text-[8px] font-mono text-white/15 bg-white/[0.03] px-1.5 py-0.5 rounded-full">{filtered.length}</span>
                                    </div>
                                </div>
                                {/* Category filter chips */}
                                <div className="flex flex-wrap gap-1.5 mb-3 px-1">
                                    <button onClick={() => setTemplateFilter('all')}
                                        className={`px-2.5 py-1 rounded-full text-[8px] font-bold uppercase tracking-[1px] transition-all cursor-pointer border ${templateFilter === 'all' ? 'border-[#E50914]/30 bg-[#E50914]/10 text-[#E50914]' : 'border-white/[0.06] bg-transparent text-white/25 hover:text-white/50 hover:border-white/15'}`}>
                                        All
                                    </button>
                                    {activeCats.map(cat => {
                                        const count = projectTemplates.filter(t => categorize(t).includes(cat.key)).length;
                                        return (
                                            <button key={cat.key} onClick={() => setTemplateFilter(templateFilter === cat.key ? 'all' : cat.key)}
                                                className={`px-2.5 py-1 rounded-full text-[8px] font-bold uppercase tracking-[1px] transition-all cursor-pointer border ${templateFilter === cat.key ? '' : 'border-white/[0.06] bg-transparent text-white/25 hover:text-white/50 hover:border-white/15'}`}
                                                style={templateFilter === cat.key ? { borderColor: `${cat.color}50`, backgroundColor: `${cat.color}18`, color: cat.color } : {}}>
                                                {cat.label} <span className="opacity-50 ml-0.5">{count}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                                    {filtered.map(t => (
                                        <button
                                            key={t.id}
                                            disabled={cloningId === t.id}
                                            onClick={async () => {
                                                setCloningId(t.id);
                                                try {
                                                    const res = await cloneProject(t.id);
                                                    toast.success(`Cloned: ${res.title}`);
                                                    if (auth.currentUser) {
                                                        invalidateDashboardCache(auth.currentUser.uid);
                                                        const updated = await fetchUserProjectsBasic(auth.currentUser.uid);
                                                        setMyProjects(updated);
                                                    }
                                                    router.push(`/project/${res.id}`);
                                                } catch (e: any) {
                                                    toast.error(e?.response?.data?.detail || 'Clone failed');
                                                } finally { setCloningId(null); }
                                            }}
                                            className="group relative rounded-xl border border-white/[0.04] bg-white/[0.015] overflow-hidden text-left transition-all hover:border-white/[0.1] hover:bg-white/[0.03] cursor-pointer disabled:opacity-50"
                                        >
                                            {/* Preview */}
                                            <div className="aspect-video relative bg-[#080808] overflow-hidden">
                                                {(t.preview_image || t.moodboard_image_url) ? (
                                                    <img src={t.preview_image || t.moodboard_image_url || ''} alt="" className="w-full h-full object-cover opacity-70 group-hover:opacity-100 group-hover:scale-[1.03] transition-all duration-500" loading="lazy" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center"><Film size={16} className="text-white/[0.04]" /></div>
                                                )}
                                                <div className="absolute top-1.5 left-1.5">
                                                    <span className="text-[6px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-black/50 backdrop-blur-sm text-white/60 border border-white/[0.06]">
                                                        {t.type === 'movie' ? 'Film' : t.type === 'ad' ? 'Ad' : 'Series'}
                                                    </span>
                                                </div>
                                                {cloningId === t.id && (
                                                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center"><Loader2 size={18} className="animate-spin text-[#E50914]" /></div>
                                                )}
                                            </div>
                                            {/* Info */}
                                            <div className="p-2.5">
                                                <h3 className="text-[10px] font-bold text-white/70 group-hover:text-white transition-colors truncate">{t.title}</h3>
                                                <div className="flex items-center gap-1.5 mt-1">
                                                    <span className="text-[7px] text-white/20 font-mono uppercase">{t.genre}</span>
                                                    {t.scene_count > 0 && <span className="text-[7px] text-white/10">· {t.scene_count} scenes</span>}
                                                </div>
                                                <div className="flex items-center gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Copy size={8} className="text-[#E50914]" />
                                                    <span className="text-[7px] font-bold text-[#E50914] uppercase tracking-wider">Clone & Start</span>
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        );
                    })()}
                </div>

                {/* ═══ RIGHT: ACTIONS + TEMPLATES ═══ */}
                <div className="hidden lg:flex w-[340px] border-l border-white/[0.04] flex-col shrink-0 h-full overflow-hidden">
                    <div className="flex-1 overflow-y-auto no-scrollbar p-5 flex flex-col gap-5">

                        {/* Quick actions */}
                        <div id="tour-hero-actions">
                            <span className="text-[9px] font-mono text-white/40 uppercase tracking-[3px] mb-3 block font-bold">Quick Actions</span>
                            <div className="grid grid-cols-1 gap-2">
                                {/* New Project — highlighted */}
                                <Link href="/project/new" className="no-underline group">
                                    <div className="flex items-center gap-3 px-3 py-3 rounded-xl border border-[#E50914]/30 bg-[#E50914]/[0.08] hover:bg-[#E50914]/[0.15] hover:border-[#E50914]/50 transition-all cursor-pointer">
                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform bg-[#E50914] border border-[#E50914]">
                                            <Plus size={14} className="text-white" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <span className="text-[11px] font-bold text-white group-hover:text-white transition-colors block">New Project</span>
                                            <span className="text-[8px] text-white/40 uppercase tracking-wider">Film · Series · Ad</span>
                                        </div>
                                        <ArrowRight size={10} className="text-[#E50914]/50 group-hover:text-[#E50914] transition-all shrink-0" />
                                    </div>
                                </Link>
                                {[
                                    { href: "/playground", icon: Rocket, label: "Playground", sub: "Generate AI images & videos" },
                                    { href: "/explore", icon: Eye, label: "Explore Gallery", sub: "Community creations" },
                                ].map(a => (
                                    <Link key={a.href} href={a.href} className="no-underline group">
                                        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-white/[0.04] bg-white/[0.015] hover:border-white/[0.1] hover:bg-white/[0.03] transition-all cursor-pointer">
                                            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform bg-white/[0.04] border border-white/[0.06]">
                                                <a.icon size={14} className="text-white/40 group-hover:text-white/70" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <span className="text-[11px] font-bold text-white/80 group-hover:text-white transition-colors block">{a.label}</span>
                                                <span className="text-[8px] text-white/30 uppercase tracking-wider">{a.sub}</span>
                                            </div>
                                            <ArrowRight size={10} className="text-white/0 group-hover:text-white/25 transition-all shrink-0" />
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>


                        {/* Stats */}
                        <div className="h-px bg-white/[0.04]" />
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04] flex-1">
                                <FolderOpen size={11} className="text-white/30" />
                                <span className="text-[12px] font-bold text-white/70 font-mono">{myProjects.length}</span>
                                <span className="text-[7px] text-white/30 uppercase tracking-wider">Projects</span>
                            </div>
                            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04] flex-1">
                                <Zap size={11} className="text-[#E50914]/50" />
                                <span className="text-[12px] font-bold text-white/70 font-mono">{credits ?? '—'}</span>
                                <span className="text-[7px] text-white/30 uppercase tracking-wider">Credits</span>
                            </div>
                        </div>

                        {myProjects.length > 0 && (
                            <button onClick={() => setShowAllProjects(true)}
                                className="w-full py-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] text-[9px] font-bold text-white/50 uppercase tracking-[2px] hover:text-white hover:border-white/[0.15] transition-all cursor-pointer">
                                View All Projects ({myProjects.length})
                            </button>
                        )}
                    </div>
                </div>

                {/* Mobile quick actions (below film strip) */}
                <div className="lg:hidden shrink-0 px-3 pb-3 flex gap-2">
                    {[
                        { href: "/project/new", icon: Plus, label: "New", color: "#E50914" },
                        { href: "/playground", icon: Rocket, label: "Play", color: "#D4A843" },
                        { href: "/explore", icon: Eye, label: "Explore", color: "#3B82F6" },
                    ].map(a => (
                        <Link key={a.href} href={a.href} className="no-underline flex-1">
                            <div className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.1] transition-all">
                                <a.icon size={12} style={{ color: a.color }} />
                                <span className="text-[8px] font-bold text-white/40 uppercase tracking-wider">{a.label}</span>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>

            {/* Modals */}
            {projectToDelete && <DeleteConfirmModal title={`DELETE: ${projectToDelete.title}`} message="This action is irreversible." isDeleting={isDeleting} onConfirm={handleDelete} onCancel={() => setProjectToDelete(null)} />}
            {showAllProjects && (
                <div className="fixed inset-0 z-[60] bg-black/92 backdrop-blur-md flex flex-col" onClick={() => setShowAllProjects(false)}>
                    <div className="max-w-[1400px] w-full mx-auto p-4 sm:p-8 pt-[72px] flex-1 overflow-y-auto no-scrollbar" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-2xl font-['Anton'] uppercase tracking-wide">All Projects ({myProjects.length})</h2>
                            <button onClick={() => setShowAllProjects(false)} className="text-white/20 hover:text-white cursor-pointer text-sm">✕</button>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                            <Link href="/project/new" className="aspect-video border border-dashed border-white/[0.05] flex flex-col items-center justify-center text-white/15 hover:text-[#E50914] hover:border-[#E50914]/25 transition-all rounded-xl no-underline"><Plus size={28} /><span className="text-[10px] mt-2 uppercase tracking-[2px] font-semibold">New</span></Link>
                            {myProjects.map(p => (
                                <div key={p.id} className="aspect-video bg-black border border-white/[0.04] rounded-xl overflow-hidden relative cursor-pointer group hover:border-white/[0.12] transition-all"
                                    onClick={() => { setShowAllProjects(false); nav(p); }}>
                                    {p.previewImage ? <img src={p.previewImage} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" /> : <div className="w-full h-full bg-[#060606] flex items-center justify-center"><Film size={24} className="opacity-[0.03]" /></div>}
                                    <div className="absolute bottom-0 p-3 w-full bg-gradient-to-t from-black via-black/60 to-transparent"><span className="text-white text-[10px] font-bold uppercase tracking-widest block truncate">{p.title}</span></div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <TourOverlay step={tourStep} steps={DASHBOARD_TOUR_STEPS} onNext={tourNext} onComplete={completeTour} />
            {shareProject && <ShareProjectModal projectId={shareProject.id} projectTitle={shareProject.title} currentTeamIds={shareProject.team_ids || []} currentIsGlobal={shareProject.is_global || false} onClose={() => setShareProject(null)} onSuccess={() => { if (auth.currentUser) { invalidateDashboardCache(auth.currentUser.uid); fetchUserProjectsBasic(auth.currentUser.uid).then(setMyProjects); } }} />}
            <style jsx global>{`@keyframes fadeIn{from{opacity:0}to{opacity:1}}@keyframes slideUp{from{opacity:0;transform:translateY(20px) scale(.96)}to{opacity:1;transform:translateY(0) scale(1)}}`}</style>
        </main>
    );
}