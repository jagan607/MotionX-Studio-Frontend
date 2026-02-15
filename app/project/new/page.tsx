"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { api, invalidateDashboardCache } from "@/lib/api";
import {
    ArrowLeft, Film, Tv, Clapperboard, Layers,
    RectangleHorizontal, RectangleVertical, Monitor, Loader2, Aperture, ChevronRight,
    Megaphone, // [NEW] Icon for Ad
    BrainCircuit, UploadCloud, FileVideo, AlertTriangle

} from "lucide-react";
import { toast } from "react-hot-toast";

// --- DESIGN SYSTEM IMPORTS ---
import { StudioLayout } from "@/components/ui/StudioLayout";
import { MotionButton } from "@/components/ui/MotionButton";

// --- TYPES ---
type MoodOption = {
    id: string;
    label: string;
    sub_label: string;
    image_url: string;
};

type MoodAxis = {
    id: string;
    code_prefix: string;
    label: string;
    description: string;
    options: MoodOption[];
};

type Manifest = {
    version: number;
    axes: MoodAxis[];
};

type ProjectType = "movie" | "micro_drama" | "adaptation" | "ad";

export default function NewProjectPage() {
    const router = useRouter();

    // 1. Loading State
    const [loadingManifest, setLoadingManifest] = useState(true);
    const [creating, setCreating] = useState(false);
    const [manifest, setManifest] = useState<Manifest | null>(null);

    // 2. Form State
    const [formData, setFormData] = useState({
        title: "",
        genre: "",
        type: "movie" as ProjectType,
        aspect_ratio: "16:9" as "16:9" | "21:9" | "9:16" | "4:5",
        style: "realistic" as "realistic" | "anime",
    });

    // [NEW] Adaptation File State & Error State
    const [adaptationFile, setAdaptationFile] = useState<File | null>(null);
    const [isSizeError, setIsSizeError] = useState(false);

    // 3. Mood Selection State
    const [moodSelection, setMoodSelection] = useState<Record<string, string>>({});

    // --- [NEW] AUTO-ASPECT RATIO LOGIC ---
    useEffect(() => {
        if (formData.type === 'ad') {
            setFormData(prev => ({ ...prev, aspect_ratio: '9:16' }));
        } else if (formData.type === 'movie') {
            setFormData(prev => ({ ...prev, aspect_ratio: '16:9' }));
        }
        // Micro-drama usually keeps 16:9 or 9:16 depending on platform, leaving as is or defaulting to 9:16 if you prefer vertical series.
    }, [formData.type]);

    // --- FETCH MANIFEST (Dynamic based on Style) ---
    useEffect(() => {
        let isMounted = true;

        async function fetchConfig() {
            if (formData.type === 'adaptation') {
                setLoadingManifest(false);
                return;
            }

            setLoadingManifest(true);
            setMoodSelection({});

            try {
                const configId = formData.style === 'anime' ? "moodboard_manifest_anime" : "moodboard_manifest";
                const docRef = doc(db, "configs", configId);
                const snap = await getDoc(docRef);

                if (isMounted && snap.exists()) {
                    const data = snap.data() as Manifest;
                    setManifest(data);
                    const initialSelection: Record<string, string> = {};
                    data.axes.forEach((axis) => {
                        if (axis.options.length > 0) initialSelection[axis.code_prefix] = axis.options[0].id;
                    });
                    setMoodSelection(initialSelection);
                } else if (isMounted) {
                    setManifest(null);
                }
            } catch (e) {
                console.error("Config Error:", e);
                toast.error("Failed to load creative assets.");
            } finally {
                if (isMounted) setLoadingManifest(false);
            }
        }

        fetchConfig();
        return () => { isMounted = false; };
    }, [formData.style, formData.type]);

    // --- HANDLERS ---
    const handleMoodSelect = (prefix: string, option: MoodOption) => {
        setMoodSelection((prev) => ({ ...prev, [prefix]: option.id }));
    };

    const handleSubmit = async () => {
        if (!formData.title) {
            return toast.error("Please enter a Project Title");
        }

        setCreating(true);

        try {
            if (formData.type === 'adaptation') {
                if (!adaptationFile) {
                    setCreating(false);
                    return toast.error("Please upload a source video");
                }

                const uploadData = new FormData();
                uploadData.append("title", formData.title);
                uploadData.append("file", adaptationFile);

                const res = await api.post("/api/v1/adaptation/create_adaptation", uploadData, {
                    headers: { "Content-Type": "multipart/form-data" },
                    timeout: 120000
                });

                router.push(`/project/${res.data.project_id}/adaptation`);
                return;
            }

            if (!formData.genre) {
                setCreating(false);
                return toast.error("Please fill in Genre/Logline");
            }

            const moodboardList: { title: string; option: string }[] = [];
            manifest?.axes.forEach(axis => {
                const selectedId = moodSelection[axis.code_prefix];
                const option = axis.options.find(o => o.id === selectedId);
                if (option) {
                    moodboardList.push({ title: axis.label, option: option.label });
                }
            });

            const payload = {
                title: formData.title,
                genre: formData.genre,
                type: formData.type,
                aspect_ratio: formData.aspect_ratio,
                style: formData.style,
                moodboard: moodboardList
            };

            const res = await api.post("/api/v1/project/create", payload);
            if (auth.currentUser) invalidateDashboardCache(auth.currentUser.uid); // Clear cache
            router.push(`/project/${res.data.id}/script`);

        } catch (e: any) {
            console.error("Creation failed", e);
            toast.error(e.response?.data?.detail || "Failed to initialize project.");
            setCreating(false);
        }
    };

    const FormatSelector = ({ active, onClick, icon: Icon, label, subLabel }: any) => (
        <button
            onClick={onClick}
            className={`
                relative flex-1 p-4 border transition-all duration-300 flex flex-col justify-between h-24 group rounded-sm
                ${active
                    ? 'border-red-600 bg-[#1A0505]'
                    : 'border-[#222] bg-[#0E0E0E] hover:border-[#444]'}
            `}
        >
            <div className="flex justify-between items-start w-full">
                <Icon className={`w-5 h-5 ${active ? 'text-red-500' : 'text-[#444] group-hover:text-[#666]'}`} />
                {active && <div className="h-1.5 w-1.5 bg-red-500 rounded-full shadow-[0_0_8px_#EF4444]" />}
            </div>

            <div className="text-left">
                <div className={`text-[9px] font-mono tracking-widest uppercase mb-1 ${active ? 'text-red-400' : 'text-[#555]'}`}>{subLabel}</div>
                <div className={`text-xs font-bold tracking-wider uppercase ${active ? 'text-white' : 'text-[#777] group-hover:text-white'}`}>{label}</div>
            </div>
        </button>
    );

    const isAdaptation = formData.type === 'adaptation';

    return (
        <StudioLayout>
            <style jsx global>{`
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-5px); }
                    75% { transform: translateX(5px); }
                }
                .animate-shake { animation: shake 0.2s ease-in-out 0s 2; }
                .dark-scrollbar::-webkit-scrollbar { width: 4px; }
                .dark-scrollbar::-webkit-scrollbar-track { background: #050505; }
                .dark-scrollbar::-webkit-scrollbar-thumb { background: #222; border-radius: 2px; }
                .dark-scrollbar::-webkit-scrollbar-thumb:hover { background: #444; }
            `}</style>

            <div className="h-screen bg-[#050505] text-[#EEE] font-sans flex flex-col lg:flex-row overflow-hidden">

                {/* --- LEFT: CONTROL TERMINAL --- */}
                <div className={`flex flex-col border-r border-[#222] bg-[#080808] relative z-10 transition-all duration-500 ${isAdaptation ? 'w-full lg:w-full max-w-4xl mx-auto border-r-0' : 'w-full lg:w-5/12'}`}>

                    <div className="p-8 pb-4 border-b border-[#222]">
                        <Link href="/dashboard" className="inline-flex items-center gap-2 text-[10px] font-bold tracking-[2px] text-[#555] hover:text-white mb-6 transition-colors group">
                            <ArrowLeft size={10} className="group-hover:-translate-x-1 transition-transform" /> BACK TO STUDIO
                        </Link>
                        <h1 className="text-3xl font-display font-bold uppercase tracking-tighter text-white leading-none mb-2">
                            New <span className="text-red-600">Production</span>
                        </h1>
                        <p className="text-[10px] font-mono text-[#444] tracking-widest">SESSION_ID: {new Date().getTime().toString().slice(-6)}</p>
                    </div>

                    <div className="flex-1 overflow-y-auto p-8 space-y-6 dark-scrollbar pb-32">

                        {/* --- 01. FORMAT SELECTION --- */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <span className="text-[10px] font-mono font-bold text-red-500 bg-red-950/40 border border-red-900/30 px-2 py-0.5 rounded">01</span>
                                <span className="text-[10px] font-mono tracking-[0.2em] text-[#555] uppercase">Format Selection</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <FormatSelector
                                    active={formData.type === 'movie'}
                                    onClick={() => setFormData({ ...formData, type: 'movie' })}
                                    icon={Film}
                                    label="Feature Film"
                                    subLabel="Linear"
                                />
                                <FormatSelector
                                    active={formData.type === 'micro_drama'}
                                    onClick={() => setFormData({ ...formData, type: 'micro_drama' })}
                                    icon={Tv}
                                    label="Micro Series"
                                    subLabel="Episodic"
                                />
                                <FormatSelector
                                    active={formData.type === 'ad'}
                                    onClick={() => setFormData({ ...formData, type: 'ad' })}
                                    icon={Megaphone}
                                    label="Commercial"
                                    subLabel="Short Form"
                                />
                                {/* <FormatSelector
                                    active={formData.type === 'adaptation'}
                                    onClick={() => setFormData({ ...formData, type: 'adaptation' })}
                                    icon={BrainCircuit}
                                    label="Adaptation"
                                    subLabel="AI Remix"
                                /> */}
                            </div>
                        </div>

                        {/* --- 02. PROJECT TITLE --- */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <span className="text-[10px] font-mono font-bold text-red-500 bg-red-950/40 border border-red-900/30 px-2 py-0.5 rounded">02</span>
                                <span className="text-[10px] font-mono tracking-[0.2em] text-[#555] uppercase">Project Title</span>
                            </div>
                            <div className="relative group">
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    className="w-full bg-[#0E0E0E] border border-[#222] rounded-sm px-4 py-4 text-base font-bold uppercase tracking-wider text-white placeholder-[#333] focus:outline-none focus:border-red-600 transition-colors"
                                    placeholder={isAdaptation ? "EX: THE MATRIX REMIX" : "ENTER PROJECT TITLE..."}
                                    autoComplete="off"
                                />
                            </div>
                        </div>

                        {!isAdaptation ? (
                            <>
                                {/* --- 03. ASPECT RATIO --- */}
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3">
                                        <span className="text-[10px] font-mono font-bold text-red-500 bg-red-950/40 border border-red-900/30 px-2 py-0.5 rounded">03</span>
                                        <span className="text-[10px] font-mono tracking-[0.2em] text-[#555] uppercase">Aspect Ratio</span>
                                    </div>
                                    <div className="grid grid-cols-4 gap-2">
                                        {[
                                            { id: '16:9', label: '16:9', sub: 'Cinema', icon: RectangleHorizontal },
                                            { id: '21:9', label: '21:9', sub: 'Wide', icon: Monitor },
                                            { id: '9:16', label: '9:16', sub: 'Vertical', icon: RectangleVertical },
                                            { id: '4:5', label: '4:5', sub: 'Portrait', icon: RectangleVertical },
                                        ].map((opt) => (
                                            <button
                                                key={opt.id}
                                                onClick={() => setFormData({ ...formData, aspect_ratio: opt.id as "16:9" | "21:9" | "9:16" | "4:5" })}
                                                className={`relative p-3 border transition-all duration-300 flex flex-col items-center justify-center gap-2 group rounded-sm h-20
                                                    ${formData.aspect_ratio === opt.id
                                                        ? 'border-red-600 bg-[#1A0505]'
                                                        : 'border-[#222] bg-[#0E0E0E] hover:border-[#444]'}
                                                `}
                                            >
                                                <opt.icon size={16} className={formData.aspect_ratio === opt.id ? 'text-red-500' : 'text-[#444] group-hover:text-[#666]'} />
                                                <div className="text-center">
                                                    <div className={`text-[9px] font-mono tracking-widest uppercase mb-0.5 ${formData.aspect_ratio === opt.id ? 'text-red-400' : 'text-[#555]'}`}>{opt.sub}</div>
                                                    <div className={`text-xs font-bold tracking-wider ${formData.aspect_ratio === opt.id ? 'text-white' : 'text-[#777] group-hover:text-white'}`}>{opt.label}</div>
                                                </div>
                                                {formData.aspect_ratio === opt.id && <div className="absolute top-2 right-2 h-1.5 w-1.5 bg-red-500 rounded-full shadow-[0_0_8px_#EF4444]" />}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* --- 04. LOGLINE & GENRE --- */}
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3">
                                        <span className="text-[10px] font-mono font-bold text-red-500 bg-red-950/40 border border-red-900/30 px-2 py-0.5 rounded">04</span>
                                        <span className="text-[10px] font-mono tracking-[0.2em] text-[#555] uppercase">Logline & Genre</span>
                                    </div>
                                    <textarea
                                        value={formData.genre}
                                        onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
                                        className="w-full bg-[#0E0E0E] border border-[#222] rounded-sm px-4 py-4 text-sm font-medium text-[#CCC] placeholder-[#333] focus:outline-none focus:border-red-600 resize-none h-24 leading-relaxed transition-colors"
                                        placeholder={formData.type === 'ad' ? "E.g. High energy sports drink commercial, neon lights..." : "Describe the story setting, genre, and tone..."}
                                    />
                                </div>

                                {/* --- 05. RENDER ENGINE --- */}
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3">
                                        <span className="text-[10px] font-mono font-bold text-red-500 bg-red-950/40 border border-red-900/30 px-2 py-0.5 rounded">05</span>
                                        <span className="text-[10px] font-mono tracking-[0.2em] text-[#555] uppercase">Render Engine</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            { id: 'realistic', label: 'REALISTIC' },
                                            { id: 'anime', label: 'ANIMATION' }
                                        ].map((s) => (
                                            <button
                                                key={s.id}
                                                onClick={() => setFormData({ ...formData, style: s.id as "realistic" | "anime" })}
                                                className={`py-4 border rounded-sm text-xs font-bold tracking-[0.2em] uppercase transition-all duration-300
                                                    ${formData.style === s.id
                                                        ? 'border-red-600 bg-[#1A0505] text-red-500'
                                                        : 'border-[#222] bg-[#0E0E0E] text-[#555] hover:border-[#444] hover:text-white'}
                                                `}
                                            >
                                                {s.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <span className="text-[10px] font-mono font-bold text-red-500 bg-red-950/40 border border-red-900/30 px-2 py-0.5 rounded">03</span>
                                        <span className="text-[10px] font-mono tracking-[0.2em] text-[#555] uppercase">Source Material</span>
                                    </div>
                                    {isSizeError && <span className="text-red-500 text-[10px] font-bold flex items-center gap-1 animate-pulse"><AlertTriangle size={10} /> TOO LARGE</span>}
                                </div>

                                <div className={`
                                        border border-dashed p-10 flex flex-col items-center justify-center text-center relative transition-all duration-300 rounded-sm
                                        ${isSizeError ? 'border-red-600 bg-red-950/20 animate-shake' : adaptationFile ? 'border-red-600 bg-[#1A0505]' : 'border-[#333] bg-[#0E0E0E] hover:border-[#666] hover:text-white'}
                                    `}>
                                    <input
                                        type="file"
                                        accept="video/mp4,video/mov"
                                        className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0] || null;
                                            if (file && file.size > 350 * 1024 * 1024) {
                                                setIsSizeError(true);
                                                setAdaptationFile(null);
                                                toast.error("File exceeds 350MB limit");
                                            } else {
                                                setIsSizeError(false);
                                                setAdaptationFile(file);
                                            }
                                        }}
                                    />

                                    {adaptationFile ? (
                                        <>
                                            <FileVideo size={48} className="text-red-500 mb-4" />
                                            <span className="text-white font-bold font-mono">{adaptationFile.name}</span>
                                            <span className="text-[10px] text-red-400 mt-2 uppercase tracking-widest">Ready for Analysis</span>
                                            <span className="text-[10px] text-[#666] mt-1">{(adaptationFile.size / (1024 * 1024)).toFixed(1)} MB</span>
                                        </>
                                    ) : (
                                        <>
                                            <UploadCloud size={48} className={`mb-4 ${isSizeError ? 'text-red-600' : 'text-[#333]'}`} />
                                            <h3 className={`text-sm font-bold uppercase tracking-wider mb-1 ${isSizeError ? 'text-red-500' : 'text-[#888]'}`}>
                                                {isSizeError ? "Video Too Heavy" : "Upload Source Video"}
                                            </h3>
                                            <p className="text-[10px] text-[#555] font-mono">MP4 / MOV • Max 350MB</p>
                                        </>
                                    )}
                                </div>

                                <div className="p-4 bg-[#0E0E0E] border border-[#222] rounded-sm text-[10px] text-[#666] font-mono leading-relaxed">
                                    <strong className="text-white block mb-1">HOW ADAPTATION WORKS:</strong>
                                    1. Upload an existing video clip.<br />
                                    2. Our engine detects cuts and clusters characters.<br />
                                    3. You assign new actors to detected clusters.<br />
                                    4. We render a frame-perfect adaptation.
                                </div>
                            </div>
                        )}

                    </div>

                    <div className="p-6 border-t border-[#222] bg-[#050505] z-30 flex justify-end">
                        <MotionButton
                            onClick={handleSubmit}
                            loading={creating}
                            disabled={isAdaptation && (isSizeError || !adaptationFile)}
                            className={`w-full md:w-auto px-10 py-4 text-xs tracking-[0.2em] font-bold rounded-sm ${isAdaptation && isSizeError ? 'bg-[#222] text-[#444] cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 text-white'}`}
                        >
                            {isAdaptation && isSizeError ? "REDUCE FILE SIZE TO CONTINUE" : isAdaptation ? "START ADAPTATION ENGINE" : "INITIALIZE SYSTEM"}
                            {isAdaptation ? <BrainCircuit size={16} className="ml-2" /> : <ChevronRight size={12} className="ml-2" />}
                        </MotionButton>
                    </div>
                </div >

                {/* --- RIGHT: VISUAL MATRIX --- */}
                {!isAdaptation && (
                    <div className="w-full lg:w-7/12 bg-[#050505] flex flex-col relative animate-in fade-in duration-500">
                        <div className="h-16 border-b border-[#222] flex items-center justify-between px-8 bg-[#050505]/95 backdrop-blur-sm z-20 sticky top-0">
                            <div className="flex items-center gap-3">
                                <Aperture className="text-red-600 animate-spin-slow" size={16} />
                                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white">Visual Matrix</span>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="text-[9px] font-mono text-[#444]">
                                    VECTOR: <span className="text-red-500">{moodSelection["A"] || "--"}-{moodSelection["B"] || "--"}-{moodSelection["C"] || "--"}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 space-y-10 dark-scrollbar">
                            {loadingManifest ? (
                                <div className="h-full flex flex-col items-center justify-center opacity-50">
                                    <Loader2 className="animate-spin text-red-600 mb-4" size={24} />
                                    <span className="text-[10px] font-mono tracking-widest text-[#666]">ACCESSING DATABASE...</span>
                                </div>
                            ) : (
                                manifest?.axes.map((axis) => (
                                    <div key={axis.id} className="space-y-3">
                                        <div className="flex items-end gap-3 border-b border-[#1A1A1A] pb-2">
                                            <span className="text-sm font-bold uppercase text-white tracking-widest">{axis.label}</span>
                                            <span className="text-[9px] font-mono text-[#444] mb-0.5">{'//'} {axis.description}</span>
                                        </div>

                                        <div className="grid grid-cols-3 xl:grid-cols-4 gap-3">
                                            {axis.options.map((option) => {
                                                const isSelected = moodSelection[axis.code_prefix] === option.id;
                                                return (
                                                    <button
                                                        key={option.id}
                                                        onClick={() => handleMoodSelect(axis.code_prefix, option)}
                                                        className={`
                                                            relative aspect-[16/10] group overflow-hidden transition-all duration-300 rounded-sm border
                                                            ${isSelected
                                                                ? 'border-red-600 z-10 opacity-100 ring-1 ring-red-600'
                                                                : 'border-transparent opacity-40 hover:opacity-100 hover:border-[#444]'}
                                                        `}
                                                    >
                                                        <img
                                                            src={option.image_url}
                                                            alt={option.label}
                                                            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                                        />
                                                        <div className={`absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent transition-opacity ${isSelected ? 'opacity-80' : 'opacity-60 group-hover:opacity-80'}`} />
                                                        <div className="absolute bottom-0 left-0 w-full p-2 flex justify-between items-end">
                                                            <div className="text-left w-full">
                                                                <div className={`text-[7px] font-mono mb-0.5 ${isSelected ? 'text-red-500' : 'text-[#888]'}`}>{option.id}</div>
                                                                <div className="text-[9px] font-bold uppercase text-white tracking-wider truncate">{option.label}</div>
                                                            </div>
                                                            {isSelected && <div className="h-1 w-1 bg-red-600 rounded-full shadow-[0_0_5px_#EF4444] mb-1 mr-1" />}
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div >
        </StudioLayout >
    );
}