"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { api, invalidateDashboardCache } from "@/lib/api";
import {
    ArrowLeft, Film, Tv, ChevronRight, ChevronLeft, Loader2,
    Megaphone, BrainCircuit, UploadCloud, FileVideo, AlertTriangle,
    Mic, User as UserIcon, Camera, BookOpen, Backpack, Sparkles, Clapperboard
} from "lucide-react";
import { toast } from "react-hot-toast";

type ProjectType = "movie" | "micro_drama" | "adaptation" | "ad" | "ugc";

const FORMAT_OPTIONS = [
    { id: "movie" as ProjectType, label: "Feature Film", desc: "Full-length cinematic narrative", icon: Film, img: "/img/formats/film.png" },
    { id: "micro_drama" as ProjectType, label: "Micro Series", desc: "Short-form episodic content", icon: Tv, img: "/img/formats/series.png" },
    { id: "ad" as ProjectType, label: "Commercial", desc: "Brand & product advertising", icon: Megaphone, img: "/img/formats/commercial.png" },
    { id: "ugc" as ProjectType, label: "UGC / Reel", desc: "Social media short-form content", icon: FileVideo, img: "/img/formats/ugc.png" },
];

const ASPECT_OPTIONS = [
    { id: "16:9" as const, label: "16:9", desc: "Cinema" },
    { id: "21:9" as const, label: "21:9", desc: "Wide" },
    { id: "9:16" as const, label: "9:16", desc: "Vertical" },
    { id: "4:5" as const, label: "4:5", desc: "Portrait" },
];

export default function NewProjectPage() {
    const router = useRouter();
    const [creating, setCreating] = useState(false);
    type UGCSetup = "podcast" | "talking_head" | "voiceover_broll" | "tutorial" | "vlog";
    const [formData, setFormData] = useState({
        title: "",
        genre: "",
        type: "movie" as ProjectType,
        aspect_ratio: "16:9" as "16:9" | "21:9" | "9:16" | "4:5",
        style: "realistic" as "realistic" | "anime",
        ugc_setup: "talking_head" as UGCSetup,
    });

    const UGC_SETUP_OPTIONS: { id: UGCSetup; label: string; desc: string; Icon: React.ComponentType<any> }[] = [
        { id: "podcast", label: "Podcast", desc: "Studio setup", Icon: Mic },
        { id: "talking_head", label: "Talking Head", desc: "Person to camera", Icon: UserIcon },
        { id: "voiceover_broll", label: "Faceless", desc: "Voiceover B-roll", Icon: Camera },
        { id: "tutorial", label: "Tutorial", desc: "Step-by-step", Icon: BookOpen },
        { id: "vlog", label: "Vlog", desc: "On-location", Icon: Backpack },
    ];
    const [adaptationFile, setAdaptationFile] = useState<File | null>(null);
    const [isSizeError, setIsSizeError] = useState(false);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => setCurrentUser(user));
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (formData.type === 'ad' || formData.type === 'ugc') setFormData(prev => ({ ...prev, aspect_ratio: '9:16' }));
        else if (formData.type === 'movie') setFormData(prev => ({ ...prev, aspect_ratio: '16:9' }));
    }, [formData.type]);

    const handleSubmit = async () => {
        if (!formData.title) return toast.error("Please enter a project title");
        setCreating(true);
        try {
            if (formData.type === 'adaptation') {
                if (!adaptationFile) { setCreating(false); return toast.error("Please upload a source video"); }
                const uploadData = new FormData();
                uploadData.append("title", formData.title);
                uploadData.append("file", adaptationFile);
                const res = await api.post("/api/v1/adaptation/create_adaptation", uploadData, {
                    headers: { "Content-Type": "multipart/form-data" }, timeout: 120000
                });
                router.push(`/project/${res.data.project_id}/adaptation`);
                return;
            }
            if (!formData.genre) { setCreating(false); return toast.error("Please describe the genre and tone"); }
            const payload: any = {
                title: formData.title, genre: formData.genre,
                type: formData.type, aspect_ratio: formData.aspect_ratio, style: formData.style,
            };
            if (formData.type === 'ugc') payload.ugc_setup = formData.ugc_setup;
            const res = await api.post("/api/v1/project/create", payload);
            if (auth.currentUser) invalidateDashboardCache(auth.currentUser.uid);
            router.push(`/project/${res.data.id}/script`);
        } catch (e: any) {
            console.error("Creation failed", e);
            toast.error(e.response?.data?.detail || "Failed to create project.");
            setCreating(false);
        }
    };

    const isAdaptation = formData.type === 'adaptation';
    const selectedFormat = FORMAT_OPTIONS.find(f => f.id === formData.type);
    const selectedFormatIdx = FORMAT_OPTIONS.findIndex(f => f.id === formData.type);

    const cycleFormat = (dir: 1 | -1) => {
        const idx = (selectedFormatIdx + dir + FORMAT_OPTIONS.length) % FORMAT_OPTIONS.length;
        setFormData({ ...formData, type: FORMAT_OPTIONS[idx].id });
    };

    const handleFileDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0] || null;
        if (!file) return;
        if (!file.type.startsWith('video/')) return toast.error("Please upload a video file");
        if (file.size > 350 * 1024 * 1024) { setIsSizeError(true); setAdaptationFile(null); toast.error("File exceeds 350MB"); }
        else { setIsSizeError(false); setAdaptationFile(file); }
    };

    return (
        <div className="h-screen bg-[#030303] text-white overflow-hidden flex">
            <style jsx global>{`
                @keyframes fadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes imgCrossfade { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slideLabel { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes scanDrift { 0% { top: 15%; } 100% { top: 85%; } }
                @keyframes glowPulse { 0%,100% { opacity: 0.3; } 50% { opacity: 0.8; } }
                @keyframes floatOrb { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(10px,-15px) scale(1.1); } }
                .fade-up { animation: fadeUp 0.5s ease both; }
                .fade-up-1 { animation: fadeUp 0.5s ease 0.05s both; }
                .fade-up-2 { animation: fadeUp 0.5s ease 0.1s both; }
                .fade-up-3 { animation: fadeUp 0.5s ease 0.15s both; }
                .fade-up-4 { animation: fadeUp 0.5s ease 0.2s both; }
                .img-fade { animation: imgCrossfade 0.7s ease both; }
                .label-slide { animation: slideLabel 0.4s ease 0.1s both; }
            `}</style>

            {/* ═══════════════════ LEFT: COMPACT FORM  ═══════════════════ */}
            <div className="w-[480px] shrink-0 flex flex-col h-full border-r border-white/[0.04] bg-[#050505]">
                {/* Top bar */}
                <div className="shrink-0 h-12 flex items-center px-8 border-b border-white/[0.04]">
                    <Link href="/dashboard" className="flex items-center gap-2 text-[10px] font-semibold tracking-[3px] text-neutral-600 hover:text-white transition-colors uppercase group">
                        <ArrowLeft size={11} className="group-hover:-translate-x-0.5 transition-transform" /> Studio
                    </Link>
                </div>

                {/* Form body */}
                <div className="flex-1 flex flex-col justify-center px-8 py-6 gap-5">

                    {/* Hero */}
                    <div className="fade-up">
                        <h1 className="text-4xl font-display uppercase tracking-tight leading-[0.95] mb-1">
                            New <span className="text-[#E50914]">Production</span>
                        </h1>
                        <p className="text-[11px] text-neutral-600">
                            {isAdaptation ? "Upload a source video to begin face-swap adaptation." : "Set up your project, then upload your script."}
                        </p>
                    </div>

                    {/* ── TITLE ── */}
                    <div className="space-y-1.5 fade-up-1">
                        <label className="text-[9px] font-semibold tracking-[3px] uppercase text-neutral-500">
                            Title <span className="text-[#E50914]">*</span>
                        </label>
                        <input
                            type="text" autoFocus value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-4 py-3 text-[14px] font-bold uppercase tracking-wider text-white placeholder-neutral-700 focus:outline-none focus:border-[#E50914]/50 transition-all"
                            placeholder="UNTITLED PROJECT"
                            autoComplete="off"
                        />
                    </div>

                    {!isAdaptation ? (
                        <>
                            {/* ── ASPECT + ENGINE (side-by-side) ── */}
                            <div className="grid grid-cols-2 gap-4 fade-up-2">
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-semibold tracking-[3px] uppercase text-neutral-500">Aspect Ratio</label>
                                    <div className="grid grid-cols-2 gap-1.5">
                                        {ASPECT_OPTIONS.map(opt => {
                                            const active = formData.aspect_ratio === opt.id;
                                            return (
                                                <button key={opt.id} onClick={() => setFormData({ ...formData, aspect_ratio: opt.id })}
                                                    className={`py-2 rounded-lg border transition-all duration-200 cursor-pointer text-center
                                                        ${active
                                                            ? 'border-[#E50914]/50 bg-[#E50914]/[0.08]'
                                                            : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]'}`}
                                                >
                                                    <div className={`text-[12px] font-bold font-mono ${active ? 'text-white' : 'text-neutral-500'}`}>{opt.label}</div>
                                                    <div className={`text-[8px] uppercase tracking-wider ${active ? 'text-[#E50914]/60' : 'text-neutral-700'}`}>{opt.desc}</div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-semibold tracking-[3px] uppercase text-neutral-500">Engine</label>
                                    <div className="space-y-1.5">
                                        {[
                                            { id: 'realistic' as const, label: 'Realistic', desc: 'Photorealistic' },
                                            { id: 'anime' as const, label: 'Animation', desc: 'Anime style' }
                                        ].map(s => {
                                            const active = formData.style === s.id;
                                            return (
                                                <button key={s.id} onClick={() => setFormData({ ...formData, style: s.id })}
                                                    className={`w-full py-2.5 px-3 rounded-lg border transition-all duration-200 text-left cursor-pointer
                                                        ${active
                                                            ? 'border-[#E50914]/50 bg-[#E50914]/[0.08]'
                                                            : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]'}`}
                                                >
                                                    <div className={`text-[11px] font-bold uppercase tracking-wider ${active ? 'text-white' : 'text-neutral-500'}`}>{s.label}</div>
                                                    <div className={`text-[8px] ${active ? 'text-neutral-400' : 'text-neutral-700'}`}>{s.desc}</div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* ── UGC SETUP (only for UGC type) ── */}
                            {formData.type === 'ugc' && (
                                <div className="space-y-1.5 fade-up-2">
                                    <label className="text-[9px] font-semibold tracking-[3px] uppercase text-neutral-500">Content Format</label>
                                    <div className="grid grid-cols-5 gap-1.5">
                                        {UGC_SETUP_OPTIONS.map(opt => {
                                            const active = formData.ugc_setup === opt.id;
                                            return (
                                                <button key={opt.id} onClick={() => setFormData({ ...formData, ugc_setup: opt.id })} className={`py-2.5 px-1 rounded-lg border transition-all duration-200 cursor-pointer text-center ${active ? 'border-[#E50914]/50 bg-[#E50914]/[0.08]' : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]'}`}>
                                                    <opt.Icon size={16} className={`mx-auto mb-1 ${active ? 'text-[#E50914]' : 'text-neutral-600'}`} />
                                                    <div className={`text-[9px] font-bold ${active ? 'text-white' : 'text-neutral-500'}`}>{opt.label}</div>
                                                    <div className={`text-[7px] uppercase tracking-wider ${active ? 'text-[#E50914]/60' : 'text-neutral-700'}`}>{opt.desc}</div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* ── LOGLINE ── */}
                            <div className="space-y-1.5 fade-up-3">
                                <label className="text-[9px] font-semibold tracking-[3px] uppercase text-neutral-500">
                                    Genre & Logline <span className="text-[#E50914]">*</span>
                                </label>
                                <textarea
                                    value={formData.genre}
                                    onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
                                    className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-4 py-3 text-[12px] text-neutral-300 placeholder-neutral-700 focus:outline-none focus:border-[#E50914]/50 transition-all resize-none h-20 leading-relaxed"
                                    placeholder={formData.type === 'ugc'
                                        ? "Crypto education reel, energetic and informative..."
                                        : formData.type === 'ad'
                                            ? "High-energy sports drink commercial, neon lights..."
                                            : "A sci-fi thriller in 2089. Dark, cyberpunk tone..."}
                                />
                            </div>
                        </>
                    ) : (
                        /* ── ADAPTATION UPLOAD ── */
                        <div className="space-y-3 fade-up-2">
                            <div className="flex items-center justify-between">
                                <label className="text-[9px] font-semibold tracking-[3px] uppercase text-neutral-500">Source Video</label>
                                {isSizeError && <span className="text-[#E50914] text-[9px] font-bold flex items-center gap-1 animate-pulse"><AlertTriangle size={9} /> TOO LARGE</span>}
                            </div>
                            <div
                                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                onDragLeave={() => setIsDragging(false)}
                                onDrop={handleFileDrop}
                                className={`border border-dashed rounded-xl p-10 flex flex-col items-center justify-center text-center relative transition-all duration-300
                                    ${isDragging ? 'border-[#E50914] bg-[#E50914]/[0.06] scale-[1.01]'
                                        : isSizeError ? 'border-[#E50914] bg-[#E50914]/[0.04]'
                                            : adaptationFile ? 'border-[#E50914]/50 bg-[#E50914]/[0.03]'
                                                : 'border-white/[0.1] bg-white/[0.02] hover:border-white/[0.2] hover:bg-white/[0.03]'}`}
                            >
                                <input type="file" accept="video/mp4,video/mov" className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0] || null;
                                        if (file && file.size > 350 * 1024 * 1024) { setIsSizeError(true); setAdaptationFile(null); toast.error("File exceeds 350MB"); }
                                        else { setIsSizeError(false); setAdaptationFile(file); }
                                    }}
                                />
                                {adaptationFile ? (
                                    <>
                                        <div className="w-14 h-14 rounded-xl bg-[#E50914]/10 border border-[#E50914]/20 flex items-center justify-center mb-3">
                                            <FileVideo size={24} className="text-[#E50914]" />
                                        </div>
                                        <span className="text-white font-bold text-[13px] mb-0.5">{adaptationFile.name}</span>
                                        <span className="text-[10px] text-neutral-500">{(adaptationFile.size / 1024 / 1024).toFixed(1)} MB</span>
                                        <span className="text-[9px] text-[#E50914]/70 mt-2 uppercase tracking-[3px] font-bold">Ready to Process</span>
                                    </>
                                ) : (
                                    <>
                                        <div className="w-14 h-14 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center mb-3">
                                            <UploadCloud size={24} className="text-neutral-600" />
                                        </div>
                                        <span className="text-[13px] font-semibold text-neutral-400">Drop source video here</span>
                                        <span className="text-[10px] text-neutral-600 mt-1">or click to browse</span>
                                        <div className="flex items-center gap-3 mt-3">
                                            <span className="text-[8px] text-neutral-700 bg-white/[0.03] px-2 py-0.5 rounded-full border border-white/[0.06]">MP4</span>
                                            <span className="text-[8px] text-neutral-700 bg-white/[0.03] px-2 py-0.5 rounded-full border border-white/[0.06]">MOV</span>
                                            <span className="text-[8px] text-neutral-700 bg-white/[0.03] px-2 py-0.5 rounded-full border border-white/[0.06]">Max 350MB</span>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── CTA ── */}
                    <button
                        onClick={handleSubmit}
                        disabled={creating || (isAdaptation && (isSizeError || !adaptationFile))}
                        className={`w-full py-3.5 rounded-lg text-[11px] font-bold uppercase tracking-[3px] transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer fade-up-4
                            ${creating || (isAdaptation && (isSizeError || !adaptationFile))
                                ? 'bg-white/[0.04] text-neutral-600 border border-white/[0.06] cursor-not-allowed'
                                : 'bg-[#E50914] hover:bg-[#ff1a25] text-white shadow-[0_4px_24px_rgba(229,9,20,0.25)] hover:shadow-[0_4px_32px_rgba(229,9,20,0.4)]'
                            }`}
                    >
                        {creating ? <><Loader2 size={14} className="animate-spin" /> Creating...</>
                            : isAdaptation ? <><BrainCircuit size={13} /> Start Adaptation</>
                                : <>Create Project <ChevronRight size={13} /></>}
                    </button>
                </div>

                {/* Adaptation internal badge */}
                {currentUser?.email?.endsWith('@motionx.in') && (
                    <div className="shrink-0 px-8 py-3 border-t border-white/[0.04]">
                        <button onClick={() => setFormData({ ...formData, type: isAdaptation ? 'movie' : 'adaptation' })}
                            className={`w-full py-2 rounded-lg border text-[9px] font-bold uppercase tracking-[2px] transition-all cursor-pointer
                                ${isAdaptation ? 'border-[#E50914]/40 text-[#E50914] bg-[#E50914]/[0.05]' : 'border-white/[0.06] text-neutral-600 hover:text-neutral-400 hover:border-white/[0.1]'}`}
                        >
                            <BrainCircuit size={11} className="inline mr-1.5 -mt-0.5" />
                            {isAdaptation ? 'Switch to Standard' : 'Adaptation Mode'}
                        </button>
                    </div>
                )}
            </div>

            {/* ═════════════════ RIGHT: IMMERSIVE PANEL ═════════════════ */}
            <div className="flex-1 flex flex-col relative overflow-hidden">

                {isAdaptation ? (
                    /* ── Adaptation: Atmospheric right panel ── */
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        {/* Ambient background */}
                        <div className="absolute inset-0 bg-[#030303]">
                            <div className="absolute top-1/4 left-1/3 w-80 h-80 bg-[#E50914]/[0.04] rounded-full blur-[120px]" style={{ animation: 'floatOrb 8s ease-in-out infinite' }} />
                            <div className="absolute bottom-1/3 right-1/4 w-96 h-96 bg-[#E50914]/[0.03] rounded-full blur-[140px]" style={{ animation: 'floatOrb 10s ease-in-out infinite reverse' }} />
                        </div>

                        {/* Viewfinder brackets */}
                        <div className="absolute inset-0 z-10 pointer-events-none">
                            <div className="absolute top-8 left-8 w-10 h-10 border-t-[1.5px] border-l-[1.5px] border-white/[0.06]" />
                            <div className="absolute top-8 right-8 w-10 h-10 border-t-[1.5px] border-r-[1.5px] border-white/[0.06]" />
                            <div className="absolute bottom-8 left-8 w-10 h-10 border-b-[1.5px] border-l-[1.5px] border-white/[0.06]" />
                            <div className="absolute bottom-8 right-8 w-10 h-10 border-b-[1.5px] border-r-[1.5px] border-white/[0.06]" />
                            <div className="absolute left-10 right-10 h-[1px] bg-gradient-to-r from-transparent via-[#E50914]/15 to-transparent"
                                style={{ animation: 'scanDrift 6s ease-in-out infinite alternate' }} />
                        </div>

                        {/* Center content */}
                        <div className="relative z-20 text-center px-12 max-w-lg fade-up">
                            <div className="w-20 h-20 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-8">
                                <BrainCircuit size={36} className="text-[#E50914]/40" />
                            </div>
                            <h2 className="text-4xl font-display uppercase tracking-tight text-white leading-none mb-3">
                                Face <span className="text-[#E50914]">Adaptation</span>
                            </h2>
                            <p className="text-[13px] text-neutral-500 leading-relaxed mb-8">
                                Upload any video and our AI will detect faces, map characters, and let you swap them with your cast — frame by frame.
                            </p>
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { step: "01", label: "Upload", desc: "Source video" },
                                    { step: "02", label: "Cast", desc: "Map characters" },
                                    { step: "03", label: "Render", desc: "Generate output" },
                                ].map(s => (
                                    <div key={s.step} className="py-4 px-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                                        <div className="text-[8px] font-mono text-[#E50914]/40 mb-1 tracking-wider">STEP {s.step}</div>
                                        <div className="text-[12px] font-bold text-white uppercase tracking-wider">{s.label}</div>
                                        <div className="text-[9px] text-neutral-600 mt-0.5">{s.desc}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Bottom HUD */}
                        <div className="absolute bottom-8 left-0 right-0 z-20 flex justify-center">
                            <div className="flex items-center gap-6 text-[8px] font-mono text-neutral-700 uppercase tracking-[3px]">
                                <span>MotionX Adaptation Engine</span>
                                <span className="w-1 h-1 bg-[#E50914]/30 rounded-full" />
                                <span>AI Face Detection</span>
                                <span className="w-1 h-1 bg-[#E50914]/30 rounded-full" />
                                <span>Frame-Level Render</span>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* ── Standard: Format selector ── */
                    <>
                        {/* ── Full-bleed hero image ── */}
                        {selectedFormat && (
                            <div key={selectedFormat.id} className="absolute inset-0 img-fade">
                                <Image src={selectedFormat.img} alt={selectedFormat.label} fill className="object-cover" priority />
                                {/* Cinematic overlays */}
                                <div className="absolute inset-0 bg-black/40" />
                                <div className="absolute inset-0 bg-gradient-to-t from-[#030303] via-transparent to-[#030303]/60" />
                                <div className="absolute inset-0 bg-gradient-to-r from-[#030303] via-transparent to-transparent" />
                            </div>
                        )}

                        {/* ── Viewfinder frame ── */}
                        <div className="absolute inset-0 z-10 pointer-events-none">
                            {/* Corner brackets */}
                            <div className="absolute top-8 left-8 w-10 h-10 border-t-[1.5px] border-l-[1.5px] border-white/[0.08]" />
                            <div className="absolute top-8 right-8 w-10 h-10 border-t-[1.5px] border-r-[1.5px] border-white/[0.08]" />
                            <div className="absolute bottom-28 left-8 w-10 h-10 border-b-[1.5px] border-l-[1.5px] border-white/[0.08]" />
                            <div className="absolute bottom-28 right-8 w-10 h-10 border-b-[1.5px] border-r-[1.5px] border-white/[0.08]" />

                            {/* Animated scan line */}
                            <div className="absolute left-10 right-10 h-[1px] bg-gradient-to-r from-transparent via-[#E50914]/20 to-transparent"
                                style={{ animation: 'scanDrift 5s ease-in-out infinite alternate' }} />

                            {/* Top right HUD */}
                            <div className="absolute top-10 right-14 text-right">
                                <div className="text-[8px] font-mono text-white/15 uppercase tracking-[3px]">MotionX Studio</div>
                                <div className="text-[8px] font-mono text-[#E50914]/30 mt-0.5 tracking-wider">{formData.aspect_ratio} • {formData.style}</div>
                            </div>
                        </div>

                        {/* ── Center: Format label + navigation ── */}
                        <div className="relative z-20 flex-1 flex flex-col items-center justify-center px-12">
                            {selectedFormat && (
                                <div key={selectedFormat.id} className="label-slide text-center">
                                    <selectedFormat.icon size={28} className="text-white/30 mx-auto mb-4" />
                                    <h2 className="text-5xl font-display uppercase tracking-tight text-white leading-none mb-2">
                                        {selectedFormat.label}
                                    </h2>
                                    <p className="text-[12px] text-white/40 tracking-wide">{selectedFormat.desc}</p>
                                </div>
                            )}

                            {/* Navigation arrows */}
                            <div className="flex gap-4 mt-8">
                                <button onClick={() => cycleFormat(-1)}
                                    className="w-10 h-10 rounded-full border border-white/[0.1] bg-white/[0.03] backdrop-blur-sm flex items-center justify-center hover:border-white/[0.25] hover:bg-white/[0.06] transition-all cursor-pointer group">
                                    <ChevronLeft size={16} className="text-white/40 group-hover:text-white transition-colors" />
                                </button>
                                <button onClick={() => cycleFormat(1)}
                                    className="w-10 h-10 rounded-full border border-white/[0.1] bg-white/[0.03] backdrop-blur-sm flex items-center justify-center hover:border-white/[0.25] hover:bg-white/[0.06] transition-all cursor-pointer group">
                                    <ChevronRight size={16} className="text-white/40 group-hover:text-white transition-colors" />
                                </button>
                            </div>
                        </div>

                        {/* ── Bottom: Filmstrip thumbnails ── */}
                        <div className="relative z-20 shrink-0 border-t border-white/[0.04] bg-[#030303]/80 backdrop-blur-md">
                            <div className="flex h-24">
                                {FORMAT_OPTIONS.map((opt, idx) => {
                                    const active = formData.type === opt.id;
                                    return (
                                        <button key={opt.id} onClick={() => setFormData({ ...formData, type: opt.id })}
                                            className={`flex-1 relative overflow-hidden transition-all duration-300 cursor-pointer group
                                                ${active ? 'opacity-100' : 'opacity-40 hover:opacity-70'}
                                                ${idx > 0 ? 'border-l border-white/[0.04]' : ''}`}
                                        >
                                            <Image src={opt.img} alt={opt.label} fill className={`object-cover transition-all duration-500 ${active ? 'scale-100' : 'scale-110 group-hover:scale-105'}`} />
                                            <div className="absolute inset-0 bg-black/50" />
                                            {/* Active indicator */}
                                            {active && <div className="absolute bottom-0 inset-x-0 h-[2px] bg-[#E50914]" />}
                                            {/* Label */}
                                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                                <opt.icon size={14} className={`mb-1 ${active ? 'text-[#E50914]' : 'text-white/40'}`} />
                                                <span className={`text-[10px] font-bold uppercase tracking-wider ${active ? 'text-white' : 'text-white/50'}`}>{opt.label}</span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}