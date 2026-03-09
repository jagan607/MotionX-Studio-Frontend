"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { api, invalidateDashboardCache, checkJobStatus, fetchEpisodes } from "@/lib/api";
import { doc, onSnapshot, updateDoc, collection, getDocs } from "firebase/firestore";
import {
    DndContext, closestCenter, PointerSensor, KeyboardSensor,
    useSensor, useSensors, DragEndEvent
} from "@dnd-kit/core";
import {
    SortableContext, verticalListSortingStrategy, arrayMove,
    sortableKeyboardCoordinates, useSortable
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
    ArrowLeft, Film, Tv, Loader2,
    Megaphone, BrainCircuit, Send,
    Upload, FileText, X, CheckCircle2,
    GripVertical, Pencil, Trash2, Plus,
    Sparkles, ChevronRight
} from "lucide-react";
import { toast } from "react-hot-toast";
import { v4 as uuidv4 } from "uuid";

type ProjectType = "movie" | "micro_drama" | "adaptation" | "ad";
type Phase = "prompt" | "processing" | "approve";

interface InlineScene {
    id: string;
    scene_number: number;
    header: string;
    summary: string;
    time?: string;
    cast_ids?: string[];
    characters?: string[];
    location_id?: string;
    mood?: any;
    [key: string]: any;
}

const FORMAT_BG: Record<string, string> = {
    film: "/img/formats/film.png",
    series: "/img/formats/series.png",
    ad: "/img/formats/commercial.png",
};

const PLACEHOLDERS = [
    "A cyberpunk thriller set in Neo-Tokyo 2089. Rain-soaked neon streets, a detective chasing an AI gone rogue...",
    "A coming-of-age drama about a young musician in 1970s Lagos, discovering Afrobeat and finding their voice...",
    "A luxury watch commercial — slow-motion macro shots, golden hour light, precision engineering...",
    "A micro drama series about rival food truck owners who secretly fall for each other...",
    "A sci-fi epic where humanity discovers an ancient alien library buried beneath the Sahara...",
    "A horror short — an AI home assistant starts making decisions its owners never asked for...",
];

/* ═══════════════════════════════════════════════════════════
   SORTABLE SCENE CARD (inline minimal)
   ═══════════════════════════════════════════════════════════ */
function SortableInlineCard({
    scene, index, isEditing, onEdit, onDelete, onSave, animDelay
}: {
    scene: InlineScene; index: number; isEditing: boolean;
    onEdit: () => void; onDelete: () => void;
    onSave: (header: string, summary: string) => void;
    animDelay: number;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: scene.id });
    const [editHeader, setEditHeader] = useState(scene.header);
    const [editSummary, setEditSummary] = useState(scene.summary);

    useEffect(() => { setEditHeader(scene.header); setEditSummary(scene.summary); }, [scene.header, scene.summary]);

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        animationDelay: `${animDelay}ms`,
    };

    const num = String(index + 1).padStart(2, "0");

    if (isEditing) {
        return (
            <div ref={setNodeRef} style={style}
                className="rounded-xl border border-[#E50914]/30 bg-black/60 backdrop-blur-sm p-4 animate-[fadeUp_0.3s_ease_both] shadow-[0_0_30px_rgba(229,9,20,0.06)]">
                <div className="flex items-center gap-3 mb-3">
                    <span className="text-[#E50914] font-mono text-[11px] font-bold">{num}</span>
                    <input value={editHeader} onChange={(e) => setEditHeader(e.target.value)}
                        className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-[11px] font-bold text-white uppercase tracking-wider focus:outline-none focus:border-[#E50914]/40 caret-[#E50914]"
                        placeholder="SCENE HEADER" />
                </div>
                <textarea value={editSummary} onChange={(e) => setEditSummary(e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-[11px] text-white/70 leading-relaxed resize-none focus:outline-none focus:border-[#E50914]/40 min-h-[80px] caret-[#E50914]"
                    placeholder="Scene description..." />
                <div className="flex items-center gap-2 mt-3 justify-end">
                    <button onClick={() => onSave(editHeader, editSummary)}
                        className="px-3 py-1 rounded-full bg-[#E50914] text-white text-[9px] font-bold tracking-wider uppercase hover:bg-[#ff1a25] transition-all cursor-pointer">
                        Save
                    </button>
                    <button onClick={onEdit}
                        className="px-3 py-1 rounded-full text-neutral-500 text-[9px] font-bold tracking-wider uppercase hover:text-white transition-all cursor-pointer">
                        Cancel
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div ref={setNodeRef} style={style}
            className="group rounded-xl border border-white/[0.04] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.08] transition-all duration-300 animate-[fadeUp_0.4s_ease_both] cursor-default">
            <div className="flex items-center gap-3 px-4 py-3">
                {/* Drag handle */}
                <button {...attributes} {...listeners}
                    className="text-neutral-700 hover:text-neutral-400 transition-colors cursor-grab active:cursor-grabbing touch-none">
                    <GripVertical size={14} />
                </button>

                {/* Scene number */}
                <span className="text-[#E50914] font-mono text-[11px] font-bold w-5 shrink-0">{num}</span>

                {/* Scene content */}
                <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-white font-bold uppercase tracking-wider truncate">{scene.header}</p>
                    <p className="text-[10px] text-neutral-500 truncate mt-0.5 leading-relaxed">{scene.summary}</p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button onClick={onEdit}
                        className="p-1.5 rounded-lg hover:bg-white/[0.06] text-neutral-600 hover:text-white transition-all cursor-pointer">
                        <Pencil size={11} />
                    </button>
                    <button onClick={onDelete}
                        className="p-1.5 rounded-lg hover:bg-red-900/20 text-neutral-600 hover:text-red-500 transition-all cursor-pointer">
                        <Trash2 size={11} />
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════ */
export default function NewProjectPage() {
    const router = useRouter();
    const [currentUser, setCurrentUser] = useState<User | null>(null);

    // ══════ PHASE STATE ══════
    const [phase, setPhase] = useState<Phase>("prompt");
    const [vision, setVision] = useState("");
    const [title, setTitle] = useState("");
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [placeholderIdx, setPlaceholderIdx] = useState(0);
    const [displayedPlaceholder, setDisplayedPlaceholder] = useState("");
    const [isTyping, setIsTyping] = useState(true);
    const [selectedFormat, setSelectedFormat] = useState<string>("film");
    const [aspectRatio, setAspectRatio] = useState<"16:9" | "21:9" | "9:16" | "4:5">("16:9");
    const [scriptFile, setScriptFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [runtime, setRuntime] = useState<number>(30);
    const [processingStatus, setProcessingStatus] = useState("");

    // ══════ APPROVE STATE ══════
    const [createdProjectId, setCreatedProjectId] = useState("");
    const [createdDraftId, setCreatedDraftId] = useState("");
    const [scenes, setScenes] = useState<InlineScene[]>([]);
    const [draftMeta, setDraftMeta] = useState<any>({});
    const [editingSceneId, setEditingSceneId] = useState<string | null>(null);
    const [isCommitting, setIsCommitting] = useState(false);
    const [isExtending, setIsExtending] = useState(false);
    const [isDraftLoading, setIsDraftLoading] = useState(true);
    const isCommittingRef = useRef(false);
    const scenesContainerRef = useRef<HTMLDivElement>(null);

    // DnD sensors
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    // ══════ AUTH ══════
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => setCurrentUser(u));
        return () => unsub();
    }, []);

    // ══════ TYPEWRITER ══════
    useEffect(() => {
        if (vision || phase !== "prompt") return;
        const target = PLACEHOLDERS[placeholderIdx];
        let charIdx = 0;
        let timeout: NodeJS.Timeout;
        if (isTyping) {
            const typeChar = () => {
                if (charIdx <= target.length) { setDisplayedPlaceholder(target.slice(0, charIdx)); charIdx++; timeout = setTimeout(typeChar, 25 + Math.random() * 15); }
                else { timeout = setTimeout(() => setIsTyping(false), 3000); }
            };
            typeChar();
        } else {
            let eraseIdx = target.length;
            const eraseChar = () => {
                if (eraseIdx >= 0) { setDisplayedPlaceholder(target.slice(0, eraseIdx)); eraseIdx--; timeout = setTimeout(eraseChar, 12); }
                else { setPlaceholderIdx((p) => (p + 1) % PLACEHOLDERS.length); setIsTyping(true); }
            };
            eraseChar();
        }
        return () => clearTimeout(timeout);
    }, [placeholderIdx, isTyping, vision, phase]);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + "px";
        }
    }, [vision]);

    // ══════ FIRESTORE DRAFT LISTENER ══════
    useEffect(() => {
        if (phase !== "approve" || !createdProjectId || !createdDraftId) return;
        const unsub = onSnapshot(doc(db, "projects", createdProjectId, "drafts", createdDraftId), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setDraftMeta({ target_episode_id: data.target_episode_id, title: data.title });
                if (!isCommittingRef.current) {
                    const stable = (data.scenes || []).map((s: any, i: number) => ({
                        ...s,
                        id: s.id || `scene_${i}`,
                        scene_number: i + 1,
                        header: s.slugline || s.header || s.scene_header || s.title || "UNKNOWN SCENE",
                        summary: s.synopsis || s.summary || s.action || s.description || "",
                        time: s.time || "",
                        cast_ids: s.cast_ids || s.characters || [],
                        location_id: s.location_id || "",
                        mood: s.mood || {},
                    }));
                    setScenes(stable);
                    setIsDraftLoading(false);
                }
            }
        });
        return () => unsub();
    }, [phase, createdProjectId, createdDraftId]);

    // ══════ FILE HANDLERS ══════
    const handleFileDrop = (e: React.DragEvent) => {
        e.preventDefault(); setIsDragging(false);
        const f = e.dataTransfer.files?.[0];
        if (!f) return;
        if (!f.name.endsWith(".pdf") && !f.type.includes("pdf")) return toast.error("Please upload a PDF script");
        setScriptFile(f);
    };
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f) return;
        if (!f.name.endsWith(".pdf") && !f.type.includes("pdf")) return toast.error("Please upload a PDF script");
        setScriptFile(f);
    };

    // ══════ CREATE PROJECT ══════
    const handleCreate = async () => {
        if (!vision.trim() && !scriptFile) return toast.error("Describe your vision or upload a script");
        setPhase("processing");
        try {
            const FORMAT_MAP: Record<string, ProjectType> = { film: "movie", series: "micro_drama", ad: "ad" };
            const type = FORMAT_MAP[selectedFormat] || "movie";
            const cleanFilename = (name: string) => name.replace('.pdf', '').replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim();
            const projectTitle = title.trim() || (vision ? vision.split(/[.\n]/)[0].slice(0, 60).trim() : (scriptFile ? cleanFilename(scriptFile.name) : "Untitled Project"));

            setProcessingStatus("Creating project...");
            const res = await api.post("/api/v1/project/create", {
                title: projectTitle, genre: vision || "Script uploaded",
                type, aspect_ratio: aspectRatio, style: "realistic",
            });
            const projectId = res.data.id;
            setCreatedProjectId(projectId);
            if (auth.currentUser) invalidateDashboardCache(auth.currentUser.uid);

            const formData = new FormData();
            formData.append("project_id", projectId);
            formData.append("script_title", projectTitle);
            formData.append("runtime_seconds", String(runtime));

            if (scriptFile) {
                setProcessingStatus("Uploading script...");
                formData.append("file", scriptFile);
            } else {
                setProcessingStatus("Generating script from your vision...");
                const content = `[TYPE: SYNOPSIS/TREATMENT]\n\n${vision}`;
                const blob = new Blob([content], { type: "text/plain" });
                formData.append("file", new File([blob], "synopsis.txt"));
            }

            const uploadRes = await api.post("/api/v1/script/upload-script", formData, {
                headers: { "Content-Type": "multipart/form-data" }
            });
            const jobId = uploadRes.data.job_id;
            setProcessingStatus("Processing script...");

            const pollInterval = setInterval(async () => {
                const job = await checkJobStatus(jobId);
                if (job.progress) setProcessingStatus(job.progress);
                if (job.status === "completed") {
                    clearInterval(pollInterval);
                    let draftId = "";
                    if (job.redirect_url) {
                        const parts = job.redirect_url.split("/");
                        const idx = parts.indexOf("draft");
                        if (idx !== -1 && parts[idx + 1]) draftId = parts[idx + 1].split("/")[0].split("?")[0];
                    }
                    if (!draftId) {
                        try {
                            const snap = await getDocs(collection(db, "projects", projectId, "drafts"));
                            if (!snap.empty) draftId = snap.docs[0].id;
                        } catch { }
                    }
                    if (draftId) { setCreatedDraftId(draftId); setPhase("approve"); }
                    else { toast.error("Could not find draft"); router.push(`/project/${projectId}`); }
                } else if (job.status === "failed") {
                    clearInterval(pollInterval); setPhase("prompt"); setProcessingStatus("");
                    toast.error(job.error || "Script processing failed");
                }
            }, 1000);
        } catch (e: any) {
            toast.error(e.response?.data?.detail || "Something went wrong.");
            setPhase("prompt"); setProcessingStatus("");
        }
    };

    // ══════ DRAFT HANDLERS ══════
    const handleDragEnd = (ev: DragEndEvent) => {
        const { active, over } = ev;
        if (over && active.id !== over.id) {
            const oldIdx = scenes.findIndex(s => s.id === active.id);
            const newIdx = scenes.findIndex(s => s.id === over.id);
            const reindexed = arrayMove(scenes, oldIdx, newIdx).map((s, i) => ({ ...s, scene_number: i + 1 }));
            setScenes(reindexed);
            updateDoc(doc(db, "projects", createdProjectId, "drafts", createdDraftId), { scenes: reindexed }).catch(() => toast.error("Sync failed"));
        }
    };

    const handleSaveScene = (sceneId: string, header: string, summary: string) => {
        const updated = scenes.map(s => s.id === sceneId ? { ...s, header, summary } : s);
        setScenes(updated);
        setEditingSceneId(null);
        updateDoc(doc(db, "projects", createdProjectId, "drafts", createdDraftId), { scenes: updated })
            .then(() => toast.success("Scene Updated"))
            .catch(() => toast.error("Save failed"));
    };

    const handleDeleteScene = (sceneId: string) => {
        const reindexed = scenes.filter(s => s.id !== sceneId).map((s, i) => ({ ...s, scene_number: i + 1 }));
        setScenes(reindexed);
        if (editingSceneId === sceneId) setEditingSceneId(null);
        updateDoc(doc(db, "projects", createdProjectId, "drafts", createdDraftId), { scenes: reindexed })
            .then(() => toast.success("Scene Removed"))
            .catch(() => toast.error("Delete failed"));
    };

    const handleAddScene = () => {
        const newScene: InlineScene = {
            id: `scene_${uuidv4().slice(0, 8)}`, scene_number: scenes.length + 1,
            header: "INT. UNTITLED SCENE - DAY", summary: "", cast_ids: [], time: "DAY", location_id: ""
        };
        const newScenes = [...scenes, newScene];
        setScenes(newScenes);
        setEditingSceneId(newScene.id);
        updateDoc(doc(db, "projects", createdProjectId, "drafts", createdDraftId), { scenes: newScenes }).catch(() => { });
        // Scroll to bottom
        setTimeout(() => scenesContainerRef.current?.scrollTo({ top: scenesContainerRef.current.scrollHeight, behavior: "smooth" }), 100);
    };

    const handleAutoExtend = async () => {
        if (scenes.length === 0) return;
        setIsExtending(true);
        try {
            const last = scenes[scenes.length - 1];
            const res = await api.post("/api/v1/script/extend-scene", {
                project_id: createdProjectId, episode_id: draftMeta.target_episode_id || "main",
                previous_scene: { location: last.header, time_of_day: last.time, visual_action: last.summary, characters: last.cast_ids || last.characters }
            });
            const g = res.data.scene;
            const newScene: InlineScene = {
                id: `scene_${uuidv4().slice(0, 8)}`, scene_number: scenes.length + 1,
                header: g.slugline || "EXT. NEW SCENE - DAY", summary: g.visual_action || g.synopsis || "",
                time: g.time_of_day || "DAY", cast_ids: g.characters || [], location_id: ""
            };
            const newScenes = [...scenes, newScene];
            setScenes(newScenes);
            await updateDoc(doc(db, "projects", createdProjectId, "drafts", createdDraftId), { scenes: newScenes });
            toast.success("Narrative Extended!");
            setTimeout(() => scenesContainerRef.current?.scrollTo({ top: scenesContainerRef.current.scrollHeight, behavior: "smooth" }), 100);
        } catch { toast.error("Failed to extend"); }
        finally { setIsExtending(false); }
    };

    const handleCommit = async () => {
        setIsCommitting(true);
        isCommittingRef.current = true;
        try {
            await api.post("api/v1/script/commit-draft", { project_id: createdProjectId, draft_id: createdDraftId });
            toast.success("Sequence Approved");
            router.push(`/project/${createdProjectId}/preproduction`);
        } catch (e: any) {
            toast.error("Failed to finalize: " + (e.response?.data?.detail || e.message));
            setIsCommitting(false);
            isCommittingRef.current = false;
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey && phase === "prompt") { e.preventDefault(); handleCreate(); }
    };

    // ══════ COMPUTED ══════
    const projectTitle = title.trim() || (vision ? vision.split(/[.\n]/)[0].slice(0, 60).trim() : (scriptFile ? scriptFile.name.replace(".pdf", "") : ""));
    const isApprovePhase = phase === "approve";

    // ══════ RENDER ══════
    return (
        <div className="h-screen bg-[#080808] text-white overflow-hidden flex flex-col relative">
            <style jsx global>{`
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes fadeUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes grain { 0%,100% { transform: translate(0,0); } 10% { transform: translate(-2%,-2%); } 20% { transform: translate(1%,3%); } 30% { transform: translate(-3%,1%); } 40% { transform: translate(3%,-1%); } 50% { transform: translate(-1%,2%); } 60% { transform: translate(2%,-3%); } 70% { transform: translate(-2%,1%); } 80% { transform: translate(1%,-2%); } 90% { transform: translate(-1%,3%); } }
                @keyframes breathe { 0%,100% { opacity: 1; } 50% { opacity: 0.6; } }
                @keyframes pulseGlow { 0%,100% { box-shadow: 0 0 20px rgba(229,9,20,0.08); } 50% { box-shadow: 0 0 40px rgba(229,9,20,0.15); } }
                .fade-in { animation: fadeIn 0.6s ease both; }
                .fade-in-1 { animation: fadeIn 0.6s ease 0.1s both; }
                .fade-in-2 { animation: fadeIn 0.6s ease 0.25s both; }
                .fade-in-3 { animation: fadeIn 0.6s ease 0.4s both; }
            `}</style>

            {/* ══════ BACKGROUND (always visible) ══════ */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute inset-0 bg-gradient-to-t from-[#080808] via-[#080808]/70 to-[#080808]/80" />
                {Object.entries(FORMAT_BG).map(([key, src]) => (
                    <div key={key} className="absolute inset-0 transition-opacity duration-[2000ms]"
                        style={{ opacity: key === selectedFormat ? 0.15 : 0 }}>
                        <Image src={src} alt="" fill className="object-cover" priority={key === "film"} />
                    </div>
                ))}
                <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center, transparent 30%, rgba(8,8,8,0.85) 100%)" }} />
                <div className="absolute inset-0 opacity-[0.03]"
                    style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
                        backgroundSize: "200px 200px", animation: "grain 0.5s steps(5) infinite",
                    }}
                />
                <div className="absolute top-[30%] left-[35%] w-[700px] h-[500px] rounded-full blur-[200px]"
                    style={{ background: "radial-gradient(circle, rgba(229,9,20,0.03) 0%, transparent 70%)", animation: "breathe 10s ease-in-out infinite" }} />
            </div>

            {/* ══════ TOP BAR ══════ */}
            <div className="relative z-10 shrink-0 h-14 flex items-center justify-between px-8">
                <Link href="/dashboard" className="text-[10px] text-neutral-600 hover:text-neutral-400 transition-colors tracking-[3px] uppercase flex items-center gap-1.5 group">
                    <ArrowLeft size={10} className="group-hover:-translate-x-0.5 transition-transform" /> Back
                </Link>
                <span className="text-[8px] text-neutral-700 tracking-[5px] uppercase font-mono select-none">MotionX</span>
            </div>

            {/* ══════ MAIN CONTENT ══════ */}
            <div className="relative z-10 flex-1 flex flex-col items-center overflow-y-auto">
                <div className={`w-full max-w-xl px-6 transition-all duration-700 ease-out
                    ${isApprovePhase ? 'pt-6 pb-8' : 'flex-1 flex flex-col justify-center py-8'}`}>

                    {/* Processing overlay */}
                    {phase === "processing" && (
                        <div className="fixed inset-0 z-50 bg-[#080808]/90 flex flex-col items-center justify-center gap-4">
                            <Loader2 size={28} className="animate-spin text-[#E50914]" />
                            <p className="text-[13px] text-neutral-400">{processingStatus}</p>
                        </div>
                    )}

                    {/* ── Hero Text ── */}
                    <div className="text-center mb-6 fade-in">
                        {/* Both titles rendered, crossfade between them */}
                        <div className="relative">
                            <p className={`text-white font-anton uppercase tracking-wide transition-all duration-700 ease-out
                                ${isApprovePhase ? 'text-[22px] opacity-0 max-h-0 overflow-hidden' : 'text-[28px] opacity-100 max-h-20'}`}>
                                What do you want to make?
                            </p>
                            <p className={`text-white font-anton uppercase tracking-wide transition-all duration-700 ease-out
                                ${isApprovePhase ? 'text-[22px] opacity-100 max-h-20' : 'text-[20px] opacity-0 max-h-0 overflow-hidden'}`}>
                                {projectTitle || 'Your Project'}
                            </p>
                        </div>
                        {/* Subtitle slides in during approve */}
                        <div className={`transition-all duration-600 ease-out ${isApprovePhase ? 'max-h-10 opacity-100 mt-2' : 'max-h-0 opacity-0'}`}>
                            <p className="text-[10px] text-neutral-600 tracking-[3px] uppercase font-mono">
                                Review & reorder your scenes
                            </p>
                        </div>
                    </div>

                    {/* ── Title Input (fades out) ── */}
                    <div className={`transition-all duration-500 ease-out ${isApprovePhase ? 'max-h-0 opacity-0 overflow-hidden mb-0' : 'max-h-20 opacity-100 mb-5'}`}>
                        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                            className="w-full bg-transparent text-[16px] text-white placeholder-neutral-600 focus:outline-none tracking-[1px] caret-[#E50914] border-b border-white/[0.06] pb-2 focus:border-white/[0.12] transition-colors"
                            placeholder="Project Name" autoComplete="off" tabIndex={isApprovePhase ? -1 : 0} />
                    </div>

                    {/* ── Prompt Box ── */}
                    <div className="relative fade-in-1">
                        <div className={`rounded-2xl border bg-black/40 backdrop-blur-sm transition-all duration-500 ease-out
                            ${isApprovePhase
                                ? 'border-white/[0.04] p-3 rounded-xl'
                                : 'border-white/[0.06] p-5 focus-within:border-[#E50914]/20 focus-within:bg-black/50 focus-within:shadow-[0_0_60px_rgba(229,9,20,0.04)]'}`}>

                            {/* Editable textarea */}
                            <div className={`transition-all duration-500 ease-out ${isApprovePhase ? 'max-h-0 opacity-0 overflow-hidden' : 'max-h-[250px] opacity-100'}`}>
                                <textarea ref={textareaRef} autoFocus={!isApprovePhase} value={vision}
                                    onChange={(e) => setVision(e.target.value)} onKeyDown={handleKeyDown}
                                    className="w-full bg-transparent text-[15px] text-white focus:outline-none resize-none leading-[1.7] caret-[#E50914] min-h-[80px]"
                                    placeholder={displayedPlaceholder || " "} rows={3}
                                    tabIndex={isApprovePhase ? -1 : 0} />
                            </div>

                            {/* Read-only summary */}
                            <div className={`transition-all duration-500 ease-out ${isApprovePhase ? 'max-h-10 opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
                                <p className="text-[10px] text-neutral-500 truncate flex items-center gap-1.5">
                                    {scriptFile ? (
                                        <><FileText size={10} className="text-[#E50914] shrink-0" />{scriptFile.name}</>
                                    ) : vision ? (
                                        vision.slice(0, 100) + (vision.length > 100 ? '...' : '')
                                    ) : (
                                        'Script processed'
                                    )}
                                </p>
                            </div>

                            {/* Script attachment */}
                            <div className={`transition-all duration-500 ease-out ${isApprovePhase ? 'max-h-0 opacity-0 overflow-hidden' : scriptFile ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
                                {scriptFile && (
                                    <div className="flex items-center gap-2 mt-3 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                                        <FileText size={14} className="text-[#E50914] shrink-0" />
                                        <span className="text-[11px] text-neutral-300 truncate flex-1">{scriptFile.name}</span>
                                        <span className="text-[9px] text-neutral-600">{(scriptFile.size / 1024 / 1024).toFixed(1)} MB</span>
                                        <button onClick={() => setScriptFile(null)} className="text-neutral-600 hover:text-white transition-colors cursor-pointer"><X size={12} /></button>
                                    </div>
                                )}
                            </div>

                            {/* Action bar */}
                            <div className={`transition-all duration-500 ease-out ${isApprovePhase ? 'max-h-0 opacity-0 overflow-hidden' : 'max-h-20 opacity-100'}`}>
                                <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.04]">
                                    <div className="flex items-center gap-3">
                                        <button onClick={() => fileInputRef.current?.click()}
                                            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                            onDragLeave={() => setIsDragging(false)} onDrop={handleFileDrop}
                                            className={`flex items-center gap-1.5 text-[9px] tracking-wider uppercase cursor-pointer transition-all ${isDragging ? 'text-[#E50914]' : 'text-neutral-600 hover:text-neutral-400'}`}>
                                            <Upload size={11} />{scriptFile ? 'Replace' : 'Upload script'}
                                        </button>
                                        <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={handleFileSelect} />
                                        <span className="text-[9px] text-neutral-800">⏎ to create</span>
                                    </div>
                                    <button onClick={handleCreate}
                                        disabled={phase !== 'prompt' || (!vision.trim() && !scriptFile)}
                                        className={`flex items-center gap-2 px-5 py-2 rounded-full text-[10px] font-semibold tracking-[1px] transition-all duration-300 cursor-pointer
                                            ${phase !== 'prompt' || (!vision.trim() && !scriptFile) ? 'text-neutral-700 cursor-not-allowed' : 'bg-[#E50914] text-white shadow-[0_0_20px_rgba(229,9,20,0.12)] hover:shadow-[0_0_30px_rgba(229,9,20,0.2)] hover:bg-[#ff1a25]'}`}>
                                        <Send size={11} /> Create
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── Format / Aspect / Runtime pills ── */}
                    <div className={`transition-all duration-500 ease-out ${isApprovePhase ? 'max-h-0 opacity-0 overflow-hidden' : 'max-h-40 opacity-100'}`}>
                        <div className="mt-6 flex items-center justify-center gap-2 fade-in-2">
                            {[
                                { icon: Film, text: 'Film', key: 'film', seed: 'A feature film about ' },
                                { icon: Tv, text: 'Series', key: 'series', seed: 'A micro drama series about ' },
                                { icon: Megaphone, text: 'Ad', key: 'ad', seed: 'A commercial for ' },
                            ].map((h) => (
                                <button key={h.text}
                                    onClick={() => { setSelectedFormat(h.key); if (!vision) setVision(h.seed); textareaRef.current?.focus(); }}
                                    className={`px-3.5 py-1.5 rounded-full border text-[9px] tracking-[2px] uppercase transition-all cursor-pointer flex items-center gap-1.5
                                        ${selectedFormat === h.key ? 'border-white/[0.15] text-white bg-white/[0.06]' : 'border-white/[0.06] text-neutral-500 hover:text-neutral-300 hover:border-white/[0.12] hover:bg-white/[0.03]'}`}>
                                    <h.icon size={10} />{h.text}
                                </button>
                            ))}
                        </div>
                        <div className="mt-3 flex items-center justify-center gap-1.5 fade-in-3">
                            {(['16:9', '9:16', '21:9', '4:5'] as const).map((r) => (
                                <button key={r} onClick={() => setAspectRatio(r)}
                                    className={`px-2.5 py-1 rounded-full text-[9px] font-mono tracking-wider transition-all cursor-pointer ${aspectRatio === r ? 'text-white bg-white/[0.08]' : 'text-neutral-600 hover:text-neutral-400'}`}>
                                    {r}
                                </button>
                            ))}
                        </div>
                        <div className="mt-2 flex items-center justify-center gap-1.5 fade-in-3">
                            {[{ label: '15s', value: 15 }, { label: '30s', value: 30 }, { label: '60s', value: 60 }, { label: '2m', value: 120 }, { label: '5m', value: 300 }, { label: '10m', value: 600 }].map((r) => (
                                <button key={r.value} onClick={() => setRuntime(r.value)}
                                    className={`px-2.5 py-1 rounded-full text-[9px] font-mono tracking-wider transition-all cursor-pointer ${runtime === r.value ? 'text-white bg-white/[0.08]' : 'text-neutral-600 hover:text-neutral-400'}`}>
                                    {r.label}
                                </button>
                            ))}
                            <span className="text-neutral-700 text-[9px] mx-1">or</span>
                            <div className="flex items-center gap-1">
                                <input type="number" min={1} value={runtime || ''}
                                    onChange={(e) => setRuntime(parseInt(e.target.value) || 0)}
                                    onBlur={() => { if (runtime < 1) setRuntime(30); }}
                                    className="w-12 bg-white/[0.04] rounded px-1.5 py-1 text-[9px] font-mono text-white text-center focus:outline-none focus:bg-white/[0.08] border border-white/[0.06] caret-[#E50914]" />
                                <span className="text-[9px] text-neutral-600 font-mono">sec</span>
                            </div>
                        </div>
                        {currentUser?.email?.endsWith('@motionx.in') && (
                            <div className="mt-5 text-center">
                                <button onClick={() => router.push('/project/new?mode=adaptation')}
                                    className="text-[8px] text-neutral-800 hover:text-neutral-500 tracking-[2px] uppercase transition-colors cursor-pointer">
                                    <BrainCircuit size={9} className="inline mr-1 -mt-0.5" /> Adaptation
                                </button>
                            </div>
                        )}
                    </div>

                    {/* ══════ SCENE SEQUENCE (slides up smoothly) ══════ */}
                    <div className={`transition-all duration-700 ease-out ${isApprovePhase ? 'opacity-100 mt-6' : 'max-h-0 opacity-0 overflow-hidden'}`}>

                        {/* Separator line */}
                        <div className="flex items-center gap-3 mb-5">
                            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
                        </div>

                        {/* Scene count + approve button */}
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <div className="w-1 h-1 rounded-full bg-[#E50914]" />
                                <span className="text-[10px] text-neutral-500 font-mono tracking-[3px] uppercase">
                                    {scenes.length} Scenes
                                </span>
                            </div>
                            <button onClick={handleCommit} disabled={isCommitting || scenes.length === 0}
                                className="flex items-center gap-2 px-5 py-2 rounded-full bg-[#E50914] text-white text-[10px] font-bold tracking-[1px] uppercase transition-all hover:bg-[#ff1a25] hover:shadow-[0_0_30px_rgba(229,9,20,0.2)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                                style={{ animation: isApprovePhase ? 'pulseGlow 3s ease-in-out infinite' : 'none' }}>
                                {isCommitting ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                                Approve & Continue
                                <ChevronRight size={12} />
                            </button>
                        </div>

                        {/* Scene list */}
                        <div ref={scenesContainerRef} className="space-y-2 max-h-[50vh] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent">
                            {isDraftLoading ? (
                                <div className="flex flex-col items-center justify-center py-12 gap-3">
                                    <Loader2 size={20} className="animate-spin text-[#E50914]" />
                                    <span className="text-[10px] text-neutral-600 font-mono tracking-[2px]">LOADING SCENES...</span>
                                </div>
                            ) : (
                                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                                    <SortableContext items={scenes.map(s => s.id)} strategy={verticalListSortingStrategy}>
                                        {scenes.map((scene, i) => (
                                            <SortableInlineCard key={scene.id} scene={scene} index={i}
                                                isEditing={editingSceneId === scene.id}
                                                onEdit={() => setEditingSceneId(editingSceneId === scene.id ? null : scene.id)}
                                                onDelete={() => handleDeleteScene(scene.id)}
                                                onSave={(h, s) => handleSaveScene(scene.id, h, s)}
                                                animDelay={i * 80} />
                                        ))}
                                    </SortableContext>
                                </DndContext>
                            )}
                        </div>

                        {/* Footer actions */}
                        {!isDraftLoading && scenes.length > 0 && (
                            <div className="flex items-center justify-center gap-3 mt-4 pb-6">
                                <button onClick={handleAddScene}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/[0.06] text-[9px] text-neutral-500 tracking-[2px] uppercase hover:text-white hover:border-white/[0.15] transition-all cursor-pointer">
                                    <Plus size={10} /> Add Scene
                                </button>
                                <button onClick={handleAutoExtend} disabled={isExtending}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/[0.06] text-[9px] text-neutral-500 tracking-[2px] uppercase hover:text-white hover:border-white/[0.15] transition-all disabled:opacity-30 cursor-pointer">
                                    {isExtending ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />} Auto-Extend
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}