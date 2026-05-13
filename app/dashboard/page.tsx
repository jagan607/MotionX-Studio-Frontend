"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { doc, onSnapshot, getDoc, collection, query, where, orderBy, limit, getDocs, deleteDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Plus, Film, Trash2, ArrowRight, Share2, Globe, Users as UsersIcon, Lock, Eye, Rocket, ChevronLeft, ChevronRight, Maximize, Crosshair, Copy, Command, Zap } from "@/lib/lucide";
import ShareProjectModal from "@/components/ShareProjectModal";
import { DashboardProject, TemplateProject, invalidateDashboardCache, fetchUserProjectsBasic, enrichProjectPreview, fetchTemplateProjects, cloneProject } from "@/lib/api";
import { toast } from "react-hot-toast";
import { API_BASE_URL } from "@/lib/config";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import { TourOverlay } from "@/components/tour/TourOverlay";
import { useTour } from "@/hooks/useTour";
import { DASHBOARD_TOUR_STEPS } from "@/lib/tourConfigs";
import { useWorkspace } from "@/app/context/WorkspaceContext";
import { useCredits } from "@/hooks/useCredits";
import { useAnnouncements } from "@/components/dashboard/DashboardAnnouncements";
import EmptyStateHero from "@/components/dashboard/EmptyStateHero";
import DailyInspiration from "@/components/dashboard/DailyInspiration";
import CommandPalette from "@/components/CommandPalette";
import WelcomeBackModal from "@/components/dashboard/WelcomeBackModal";
import QuickStartTemplates from "@/components/dashboard/QuickStartTemplates";



export default function Dashboard() {
    const [myProjects, setMyProjects] = useState<DashboardProject[]>([]);
    const [activeIdx, setActiveIdx] = useState(0);
    const [bootState, setBootState] = useState<'booting' | 'ready'>('booting');
    const [projectToDelete, setProjectToDelete] = useState<DashboardProject | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [shareProject, setShareProject] = useState<DashboardProject | null>(null);
    const [userProfile, setUserProfile] = useState<{ goal?: string } | null>(null);
    const [projectTemplates, setProjectTemplates] = useState<TemplateProject[]>([]);
    const [cloningId, setCloningId] = useState<string | null>(null);
    const [templateFilter, setTemplateFilter] = useState('all');
    // Monitor always shows announcements now — project preview removed (projects live in /library)
    const [annIdx, setAnnIdx] = useState(0);
    const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false);

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
        try {
            await deleteDoc(doc(db, "projects", projectToDelete.id));
            if (auth.currentUser) invalidateDashboardCache(auth.currentUser.uid);
            setMyProjects(p => {
                const updated = p.filter(x => x.id !== projectToDelete.id);
                // Reset activeIdx to prevent out-of-bounds
                setActiveIdx(prev => Math.min(prev, Math.max(0, updated.length - 1)));
                return updated;
            });
        }
        catch { } finally { setIsDeleting(false); setProjectToDelete(null); }
    };

    const [pTypes, setPTypes] = useState<Record<string, string>>({});
    useEffect(() => {
        const u: (() => void)[] = [];
        myProjects.forEach(p => { const un = onSnapshot(doc(db, "projects", p.id), s => { const t = s.data()?.type; if (t) setPTypes(pr => ({ ...pr, [p.id]: t })); }); u.push(un); });
        return () => u.forEach(x => x());
    }, [myProjects]);

    // Auto-slide announcements every 15 seconds
    useEffect(() => {
        if (allAnn.length <= 1) return;
        const timer = setInterval(() => {
            setAnnIdx(p => (p + 1) % allAnn.length);
        }, 15000);
        return () => clearInterval(timer);
    }, [allAnn.length]);

    useEffect(() => {
        const h = (e: KeyboardEvent) => {
            // ⌘K / Ctrl+K → toggle command palette
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setCmdPaletteOpen(p => !p); return; }
            if (bootState !== 'ready' || myProjects.length === 0) return;
            if (e.key === 'ArrowLeft') setActiveIdx(p => Math.max(0, p - 1));
            if (e.key === 'ArrowRight') setActiveIdx(p => Math.min(myProjects.length - 1, p + 1));
        };
        window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
    }, [bootState, myProjects.length]);

    const greeting = (() => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; })();
    const name = auth.currentUser?.displayName?.split(" ")[0] || "Director";
    const activeProject = myProjects[activeIdx];
    const isEmptyState = myProjects.length === 0;
    const userGoal = userProfile?.goal;

    // Progress phase helper for project cards
    const getPhase = (p: DashboardProject) => {
        if (p.previewVideo) return { label: 'Post-Prod', color: '#22C55E', progress: 90 };
        if (p.previewImage) return { label: 'Production', color: '#3B82F6', progress: 60 };
        if ((p as any).script_status === 'processed') return { label: 'Pre-Prod', color: '#F59E0B', progress: 35 };
        return { label: 'Script', color: '#8B5CF6', progress: 15 };
    };

    if (bootState === 'booting') return (
        <div className="h-full w-full bg-[#111111] flex flex-col items-center justify-center">
            <div className="relative"><div className="w-16 h-16 rounded-full border-2 border-[#D40A12]/20 border-t-[#D40A12] animate-spin" /><Film size={20} className="text-[#D40A12] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" /></div>
            <span className="text-[10px] font-mono text-white/15 uppercase tracking-[4px] mt-6">Loading Studio</span>
        </div>
    );

    return (
        <>
            <main className="w-full h-full bg-[#111111] text-white font-sans flex flex-col overflow-hidden selection:bg-[#D40A12] selection:text-white">

                {/* ═══ MAIN CONTENT AREA ═══ */}
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative bg-[#111111]">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] via-transparent to-transparent pointer-events-none" />

                    <div className="flex-1 flex flex-col min-w-0 p-4 sm:p-6 lg:p-8 gap-8 overflow-y-auto no-scrollbar relative z-10">

                        {/* ═══ MONITOR ═══ */}
                        <>
                            {/* Monitor — cinematic preview */}
                            <div id="tour-monitor" className="relative bg-black border border-white/[0.08] rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.8)] group overflow-hidden h-[38vh] min-h-[240px] shrink-0 transition-colors hover:border-white/[0.15]">
                                {/* Viewfinder */}
                                <div className="absolute inset-0 pointer-events-none z-20 p-6">
                                    <div className="absolute top-6 left-6 w-8 h-8 border-l border-t border-white/[0.1]" />
                                    <div className="absolute top-6 right-6 w-8 h-8 border-r border-t border-white/[0.1]" />
                                    <div className="absolute bottom-6 left-6 w-8 h-8 border-l border-b border-white/[0.1]" />
                                    <div className="absolute bottom-6 right-6 w-8 h-8 border-r border-b border-white/[0.1]" />
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"><Crosshair size={40} strokeWidth={0.5} className="text-white/[0.08]" /></div>
                                </div>

                                {/* What's New badge — only show if we have announcements */}
                                {allAnn.length > 0 && (
                                    <div className="absolute top-4 left-4 z-30">
                                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-black/60 backdrop-blur-xl border border-white/[0.08] text-[9px] font-bold uppercase tracking-[1.5px] text-[#D40A12]">
                                            What&apos;s New
                                            <span className="w-1.5 h-1.5 rounded-full bg-[#D40A12] animate-pulse shadow-[0_0_8px_#D40A12]" />
                                        </div>
                                    </div>
                                )}

                                {/* Top-right: greeting */}
                                <div className="absolute top-4 right-4 z-30">
                                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-black/60 backdrop-blur-xl border border-white/[0.08] text-[10px] font-mono text-white/50 shadow-lg">
                                        <div className="w-1.5 h-1.5 bg-[#00FF41] rounded-full animate-pulse shadow-[0_0_5px_#00FF41]" />
                                        {greeting}, <span className="text-white/90 font-sans tracking-wide ml-1">{name}</span>
                                    </div>
                                </div>

                                {/* Media */}
                                <div className="absolute inset-0">
                                    {allAnn.length > 0 ? (() => {
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
                                            <div className="w-full h-full bg-gradient-to-br from-[#1a1a1a] via-[#111] to-[#1a1a1a]" />
                                        );
                                    })() : (
                                        <div className="w-full h-full bg-gradient-to-br from-[#0a0000] via-[#0f0a0a] to-[#111111]" />
                                    )}
                                </div>

                                {/* Dramatic vignette overlay */}
                                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.5)_100%)] pointer-events-none" />

                                {/* Bottom overlay */}
                                <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-6 z-30 bg-gradient-to-t from-black/95 via-black/60 to-transparent">
                                    {allAnn.length > 0 ? (() => {
                                        const a = allAnn[annIdx] || allAnn[0];
                                        if (!a) return null;
                                        const TYPES: Record<string, { color: string; label: string }> = {
                                            feature: { color: '#D40A12', label: 'New Feature' },
                                            update: { color: '#3B82F6', label: 'Update' },
                                            fix: { color: '#22C55E', label: 'Fix' },
                                        };
                                        const c = TYPES[a.type] || TYPES.update;
                                        return (
                                            <div>
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="text-[8px] font-bold px-2.5 py-1 rounded-md uppercase tracking-[2px] border border-white/10 backdrop-blur-md" style={{ background: `${c.color}15`, color: c.color }}>
                                                        {c.label}
                                                    </span>
                                                </div>
                                                <h1 className="text-[24px] sm:text-[32px] lg:text-[40px] font-['Anton'] uppercase leading-[0.9] tracking-[1px] text-white drop-shadow-2xl">
                                                    {a.title}
                                                </h1>
                                                {a.body && <p className="text-[11px] sm:text-[12px] text-white/60 mt-2 max-w-xl leading-relaxed line-clamp-2 drop-shadow-lg">{a.body}</p>}
                                                {allAnn.length > 1 && (
                                                    <div className="flex items-center gap-2.5 mt-4">
                                                        {allAnn.map((_: any, i: number) => (
                                                            <button key={i} onClick={() => setAnnIdx(i)}
                                                                className={`rounded-full transition-all cursor-pointer border-none shadow-lg ${i === annIdx ? 'w-8 h-1.5 bg-[#D40A12]' : 'w-2 h-1.5 bg-white/20 hover:bg-white/40'}`} />
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })() : (
                                        <div className="flex items-end justify-between gap-4">
                                            <div>
                                                <h1 className="text-[28px] sm:text-[36px] font-['Anton'] uppercase leading-[0.9] tracking-[1px] text-white">
                                                    {greeting}, {name}
                                                </h1>
                                                <p className="text-[11px] text-white/40 mt-2">Welcome to your creative studio</p>
                                            </div>
                                            <Link href="/project/new">
                                                <button className="bg-[#D40A12] text-white px-6 py-3 font-bold text-[10px] uppercase tracking-[2px] hover:brightness-110 transition-all flex items-center gap-2 cursor-pointer rounded-xl border-none shadow-[0_2px_12px_rgba(212,10,18,0.3)]">
                                                    Create Project <ArrowRight size={14} />
                                                </button>
                                            </Link>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>

                        {/* ═══ RECENT PROJECTS ═══ */}
                        {myProjects.length > 0 && (
                            <div className="flex flex-col gap-4">
                                <div className="flex items-center justify-between px-1">
                                    <span className="text-[11px] font-bold tracking-[2px] uppercase text-white/40">Continue Working</span>
                                    <Link href="/library" className="text-[10px] font-bold text-white/30 uppercase tracking-[1.5px] hover:text-white/60 transition-all no-underline">
                                        View All →
                                    </Link>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {myProjects.slice(0, 3).map(p => {
                                        const phase = getPhase(p);
                                        return (
                                            <div
                                                key={p.id}
                                                className="aspect-video rounded-xl overflow-hidden relative cursor-pointer group border border-white/[0.06] hover:border-white/[0.15] hover:shadow-[0_8px_30px_rgba(0,0,0,0.5)] hover:-translate-y-1 transition-all duration-300"
                                                onClick={() => nav(p)}
                                            >
                                                {/* Thumbnail */}
                                                {p.previewImage ? (
                                                    <img src={p.previewImage} alt="" className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700" loading="lazy" />
                                                ) : (
                                                    <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-[#1a1a1a] via-[#161616] to-[#111111] flex items-center justify-center">
                                                        <Film size={28} className="text-white/[0.06]" />
                                                    </div>
                                                )}

                                                {/* Phase badge */}
                                                <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5">
                                                    {(p as any).is_sample && (
                                                        <span className="bg-[#D40A12] text-white text-[6px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded shadow-lg">Sample</span>
                                                    )}
                                                    <span className="text-[7px] font-bold uppercase tracking-widest px-2 py-1 rounded backdrop-blur-md shadow-lg"
                                                        style={{ background: `${phase.color}30`, color: phase.color, border: `1px solid ${phase.color}40` }}
                                                    >{phase.label}</span>
                                                </div>

                                                {/* Gradient overlay */}
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent pointer-events-none" />

                                                {/* Bottom info */}
                                                <div className="absolute bottom-0 left-0 right-0 z-10">
                                                    <div className="h-[3px] bg-white/[0.04]">
                                                        <div className="h-full rounded-full transition-all duration-700"
                                                            style={{ width: `${phase.progress}%`, background: phase.color, boxShadow: `0 0 8px ${phase.color}` }}
                                                        />
                                                    </div>
                                                    <div className="p-3 flex items-end justify-between">
                                                        <div>
                                                            <span className="text-[10px] font-bold text-white uppercase tracking-[1px] truncate block drop-shadow-md">{p.title}</span>
                                                            <span className="text-[8px] text-white/30 uppercase tracking-wider mt-0.5 block">
                                                                {(pTypes[p.id] || p.type) === 'movie' ? 'Film' : 'Series'}
                                                            </span>
                                                        </div>
                                                        <ArrowRight size={12} className="text-white/20 group-hover:text-white/60 group-hover:translate-x-0.5 transition-all shrink-0 mb-0.5" />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {projectToDelete && <DeleteConfirmModal title={`DELETE: ${projectToDelete.title}`} message="This action is irreversible." isDeleting={isDeleting} onConfirm={handleDelete} onCancel={() => setProjectToDelete(null)} />}

                <TourOverlay step={tourStep} steps={DASHBOARD_TOUR_STEPS} onNext={tourNext} onComplete={completeTour} />
                {shareProject && <ShareProjectModal projectId={shareProject.id} projectTitle={shareProject.title} currentTeamIds={shareProject.team_ids || []} currentIsGlobal={shareProject.is_global || false} onClose={() => setShareProject(null)} onSuccess={() => { if (auth.currentUser) { invalidateDashboardCache(auth.currentUser.uid); fetchUserProjectsBasic(auth.currentUser.uid).then(setMyProjects); } }} />}

                {/* ═══ COMMAND PALETTE (⌘K) ═══ */}
                <CommandPalette projects={myProjects} open={cmdPaletteOpen} onClose={() => setCmdPaletteOpen(false)} />

                {/* ═══ WELCOME BACK MODAL ═══ */}
                <WelcomeBackModal announcements={allAnn} />

            </main>


            {/* CMD+K Hint (desktop) */}
            <button onClick={() => setCmdPaletteOpen(true)} className="hidden sm:flex fixed bottom-6 left-6 z-40 items-center gap-2 px-4 py-2 rounded-lg bg-black/80 backdrop-blur-md border border-white/[0.08] text-[10px] font-mono text-white/30 hover:text-white/60 hover:border-white/[0.15] hover:bg-white/[0.05] transition-all cursor-pointer shadow-lg">
                <Command size={12} />K
            </button>
        </>
    );
}