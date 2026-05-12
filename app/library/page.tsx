"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { doc, onSnapshot, deleteDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Plus, Film, Trash2, Search, LayoutGrid, List, ArrowRight } from "@/lib/lucide";
import { DashboardProject, invalidateDashboardCache, fetchUserProjectsBasic, enrichProjectPreview } from "@/lib/api";
import { toast } from "react-hot-toast";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import { useWorkspace } from "@/app/context/WorkspaceContext";

export default function LibraryPage() {
    const [projects, setProjects] = useState<DashboardProject[]>([]);
    const [loading, setLoading] = useState(true);
    const [projectToDelete, setProjectToDelete] = useState<DashboardProject | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [search, setSearch] = useState("");
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

    const { activeWorkspaceSlug, availableWorkspaces } = useWorkspace();
    const activeWs = availableWorkspaces.find(w => w.slug === activeWorkspaceSlug);
    const isOrgAccount = !!activeWorkspaceSlug;
    const isOrgAdmin = activeWs?.role === "admin";
    const router = useRouter();

    useEffect(() => {
        const user = auth.currentUser;
        if (!user) return;
        setLoading(true);

        const load = async () => {
            invalidateDashboardCache(user.uid);
            const basics = await fetchUserProjectsBasic(user.uid);
            setProjects(basics);
            setLoading(false);
            for (const p of basics) {
                enrichProjectPreview(p).then(e =>
                    setProjects(prev => prev.map(i => i.id === e.id ? e : i))
                );
            }
        };
        load();
    }, [activeWorkspaceSlug]);

    // Live project type listener
    const [pTypes, setPTypes] = useState<Record<string, string>>({});
    useEffect(() => {
        const unsubs: (() => void)[] = [];
        projects.forEach(p => {
            const un = onSnapshot(doc(db, "projects", p.id), s => {
                const t = s.data()?.type;
                if (t) setPTypes(pr => ({ ...pr, [p.id]: t }));
            });
            unsubs.push(un);
        });
        return () => unsubs.forEach(x => x());
    }, [projects]);

    const nav = useCallback((p: DashboardProject) => router.push(`/project/${p.id}`), [router]);

    const handleDelete = async () => {
        if (!projectToDelete) return;
        setIsDeleting(true);
        try {
            await deleteDoc(doc(db, "projects", projectToDelete.id));
            if (auth.currentUser) invalidateDashboardCache(auth.currentUser.uid);
            setProjects(p => p.filter(x => x.id !== projectToDelete.id));
            toast.success("Project deleted");
        } catch {
            toast.error("Failed to delete project");
        } finally {
            setIsDeleting(false);
            setProjectToDelete(null);
        }
    };

    const getPhase = (p: DashboardProject) => {
        if (p.previewVideo) return { label: "Post-Prod", color: "#22C55E", progress: 90 };
        if (p.previewImage) return { label: "Production", color: "#3B82F6", progress: 60 };
        if ((p as any).script_status === "processed") return { label: "Pre-Prod", color: "#F59E0B", progress: 35 };
        return { label: "Script", color: "#8B5CF6", progress: 15 };
    };

    const filtered = projects.filter(p =>
        p.title.toLowerCase().includes(search.toLowerCase())
    );

    if (loading) {
        return (
            <div className="h-full w-full bg-[#111111] flex flex-col items-center justify-center">
                <div className="relative">
                    <div className="w-16 h-16 rounded-full border-2 border-[#D40A12]/20 border-t-[#D40A12] animate-spin" />
                    <Film size={20} className="text-[#D40A12] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <span className="text-[10px] font-mono text-white/15 uppercase tracking-[4px] mt-6">Loading Projects</span>
            </div>
        );
    }

    return (
        <main className="w-full h-full bg-[#111111] text-white font-sans flex flex-col overflow-hidden">
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] via-transparent to-transparent pointer-events-none" />

                <div className="flex-1 flex flex-col p-6 lg:p-8 overflow-y-auto no-scrollbar relative z-10">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h1 className="text-[28px] font-['Anton'] uppercase tracking-[1px]">
                                My Projects <span className="text-white/25 text-[20px] ml-1">{projects.length}</span>
                            </h1>
                            <p className="text-[11px] text-white/30 mt-1 tracking-wide">All your creative projects in one place</p>
                        </div>
                        <div className="flex items-center gap-3">
                            {/* Search */}
                            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/40 focus-within:border-white/[0.12] transition-all w-[220px]">
                                <Search size={14} />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="Search projects..."
                                    className="bg-transparent text-[12px] text-white/80 placeholder:text-white/25 outline-none flex-1"
                                />
                            </div>
                            {/* View toggle */}
                            <div className="flex items-center gap-1 bg-white/[0.04] border border-white/[0.06] rounded-lg p-1">
                                <button
                                    onClick={() => setViewMode("grid")}
                                    className={`p-1.5 rounded-md transition-all cursor-pointer border-none ${viewMode === "grid" ? "bg-white/10 text-white" : "text-white/30 hover:text-white/60 bg-transparent"}`}
                                >
                                    <LayoutGrid size={14} />
                                </button>
                                <button
                                    onClick={() => setViewMode("list")}
                                    className={`p-1.5 rounded-md transition-all cursor-pointer border-none ${viewMode === "list" ? "bg-white/10 text-white" : "text-white/30 hover:text-white/60 bg-transparent"}`}
                                >
                                    <List size={14} />
                                </button>
                            </div>
                            {/* New Project */}
                            <Link href="/project/new" className="no-underline">
                                <button className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#D40A12] text-white text-[10px] font-bold uppercase tracking-[1.5px] hover:brightness-110 transition-all cursor-pointer border-none shadow-[0_2px_10px_rgba(212,10,18,0.25)]">
                                    <Plus size={14} /> New Project
                                </button>
                            </Link>
                        </div>
                    </div>

                    {/* Projects Grid */}
                    {filtered.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center">
                            {search ? (
                                <>
                                    <Search size={32} className="text-white/10 mb-4" />
                                    <p className="text-[13px] text-white/40">No projects matching &quot;{search}&quot;</p>
                                </>
                            ) : (
                                <>
                                    <Film size={40} className="text-white/10 mb-4" />
                                    <p className="text-[14px] text-white/50 font-medium mb-2">No projects yet</p>
                                    <p className="text-[12px] text-white/30 mb-6">Start creating your first film or series</p>
                                    <Link href="/project/new">
                                        <button className="flex items-center gap-2 px-6 py-3 rounded-lg bg-[#D40A12] text-white text-[11px] font-bold uppercase tracking-[1.5px] hover:brightness-110 transition-all cursor-pointer border-none shadow-[0_2px_12px_rgba(212,10,18,0.3)]">
                                            Create Project <ArrowRight size={14} />
                                        </button>
                                    </Link>
                                </>
                            )}
                        </div>
                    ) : viewMode === "grid" ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                            {filtered.map(p => {
                                const phase = getPhase(p);
                                return (
                                    <div
                                        key={p.id}
                                        className="aspect-video bg-[#161616] border border-white/[0.06] rounded-xl overflow-hidden relative cursor-pointer group hover:border-white/[0.12] hover:-translate-y-1 transition-all duration-300"
                                        onClick={() => nav(p)}
                                    >
                                        <LibraryImage src={p.previewImage} alt="" className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity duration-500 group-hover:scale-105" />

                                        {/* Phase badge */}
                                        <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1.5">
                                            {(p as any).is_sample && (
                                                <span className="bg-[#D40A12] text-white text-[6px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded shadow-lg">Sample</span>
                                            )}
                                            <span className="text-[7px] font-bold uppercase tracking-widest px-2 py-1 rounded backdrop-blur-md shadow-lg"
                                                style={{ background: `${phase.color}25`, color: phase.color, border: `1px solid ${phase.color}30` }}
                                            >{phase.label}</span>
                                        </div>

                                        {/* Delete */}
                                        {(!isOrgAccount || isOrgAdmin) && (
                                            <button
                                                onClick={e => { e.stopPropagation(); setProjectToDelete(p); }}
                                                className="absolute top-2.5 right-2.5 z-10 w-7 h-7 rounded-md bg-black/50 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/30 hover:text-white hover:bg-red-500/80 hover:border-red-400 transition-all cursor-pointer opacity-0 group-hover:opacity-100"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        )}

                                        {/* Overlay */}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent pointer-events-none" />

                                        {/* Bottom info */}
                                        <div className="absolute bottom-0 left-0 right-0 z-10">
                                            <div className="h-[3px] bg-white/[0.04]">
                                                <div className="h-full rounded-full transition-all duration-700"
                                                    style={{ width: `${phase.progress}%`, background: phase.color, boxShadow: `0 0 8px ${phase.color}` }}
                                                />
                                            </div>
                                            <div className="p-3">
                                                <span className="text-[10px] font-bold text-white uppercase tracking-[1px] truncate block">{p.title}</span>
                                                <span className="text-[8px] text-white/30 uppercase tracking-wider mt-0.5 block">
                                                    {(pTypes[p.id] || p.type) === "movie" ? "Film" : "Series"}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        /* List view */
                        <div className="flex flex-col gap-2">
                            {filtered.map(p => {
                                const phase = getPhase(p);
                                return (
                                    <div
                                        key={p.id}
                                        className="flex items-center gap-4 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.04] transition-all cursor-pointer group"
                                        onClick={() => nav(p)}
                                    >
                                        <div className="w-20 h-12 rounded-lg overflow-hidden bg-[#161616] shrink-0">
                                            <LibraryImage src={p.previewImage} alt="" className="w-full h-full object-cover" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <span className="text-[12px] font-semibold text-white/90 block truncate">{p.title}</span>
                                            <span className="text-[9px] text-white/30 uppercase tracking-wider">
                                                {(pTypes[p.id] || p.type) === "movie" ? "Film" : "Series"}
                                            </span>
                                        </div>
                                        <span className="text-[8px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-md"
                                            style={{ background: `${phase.color}15`, color: phase.color, border: `1px solid ${phase.color}25` }}
                                        >{phase.label}</span>
                                        <div className="w-24 h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                                            <div className="h-full rounded-full" style={{ width: `${phase.progress}%`, background: phase.color }} />
                                        </div>
                                        {(!isOrgAccount || isOrgAdmin) && (
                                            <button
                                                onClick={e => { e.stopPropagation(); setProjectToDelete(p); }}
                                                className="w-8 h-8 rounded-md flex items-center justify-center text-white/20 hover:text-red-400 hover:bg-red-400/10 transition-all cursor-pointer opacity-0 group-hover:opacity-100 border-none bg-transparent"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Delete Modal */}
            {projectToDelete && (
                <DeleteConfirmModal
                    title={`DELETE: ${projectToDelete.title}`}
                    message="This action is irreversible."
                    isDeleting={isDeleting}
                    onConfirm={handleDelete}
                    onCancel={() => setProjectToDelete(null)}
                />
            )}
        </main>
    );
}

/** Progressive image with skeleton placeholder */
function LibraryImage({ src, alt, className }: { src?: string; alt: string; className?: string }) {
    const [loaded, setLoaded] = useState(false);
    const imgRef = useRef<HTMLImageElement>(null);

    useEffect(() => {
        if (imgRef.current?.complete && imgRef.current?.naturalWidth > 0) setLoaded(true);
    }, []);

    if (!src) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-[#161616]">
                <Film size={20} className="text-white/[0.06]" />
            </div>
        );
    }

    return (
        <div className="relative w-full h-full">
            {!loaded && <div className="absolute inset-0 bg-[#161616] animate-pulse" />}
            <img
                ref={imgRef}
                src={src}
                alt={alt}
                loading="lazy"
                decoding="async"
                onLoad={() => setLoaded(true)}
                className={`${className || ''} transition-opacity duration-400 ${loaded ? 'opacity-100' : 'opacity-0'}`}
            />
        </div>
    );
}
