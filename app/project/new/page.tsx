"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { api, invalidateDashboardCache } from "@/lib/api";
import {
    ArrowLeft, Film, Tv, Clapperboard, Layers,
    RectangleHorizontal, RectangleVertical, Monitor, Loader2, Aperture, ChevronRight
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
        type: "movie" as "movie" | "micro_drama",
        aspect_ratio: "16:9" as "16:9" | "21:9" | "9:16",
        style: "realistic" as "realistic" | "anime",
    });

    // 3. Mood Selection State
    const [moodSelection, setMoodSelection] = useState<Record<string, string>>({});

    // --- FETCH MANIFEST (Dynamic based on Style) ---
    useEffect(() => {
        let isMounted = true;

        async function fetchConfig() {
            setLoadingManifest(true);
            setMoodSelection({}); // Reset previous selection

            try {
                // DYNAMIC SWITCH: Choose collection based on style
                const configId = formData.style === 'anime'
                    ? "moodboard_manifest_anime"
                    : "moodboard_manifest";

                const docRef = doc(db, "configs", configId);
                const snap = await getDoc(docRef);

                if (isMounted && snap.exists()) {
                    const data = snap.data() as Manifest;
                    setManifest(data);

                    // Pre-select first option for each axis
                    const initialSelection: Record<string, string> = {};
                    data.axes.forEach((axis) => {
                        if (axis.options.length > 0) {
                            initialSelection[axis.code_prefix] = axis.options[0].id;
                        }
                    });
                    setMoodSelection(initialSelection);
                } else if (isMounted) {
                    // Fallback or empty state if doc doesn't exist
                    setManifest(null);
                    // toast.error(`Configuration missing for ${formData.style}`);
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
    }, [formData.style]);

    // --- HANDLERS ---
    const handleMoodSelect = (prefix: string, option: MoodOption) => {
        setMoodSelection((prev) => ({ ...prev, [prefix]: option.id }));
    };

    const handleSubmit = async () => {
        if (!formData.title || !formData.genre) {
            toast.error("Please fill in Title and Genre");
            return;
        }

        setCreating(true);

        try {
            const moodboardList: { title: string; option: string }[] = [];

            manifest?.axes.forEach(axis => {
                const selectedId = moodSelection[axis.code_prefix];
                const option = axis.options.find(o => o.id === selectedId);

                if (option) {
                    moodboardList.push({
                        title: axis.label,
                        option: option.label
                    });
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
            router.push(`/project/${res.data.id}`);

        } catch (e: any) {
            console.error("Creation failed", e);
            toast.error(e.response?.data?.detail || "Failed to initialize project.");
            setCreating(false);
        }
    };

    // --- COMPONENT: SELECTOR ---
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

    return (
        <StudioLayout>
            <style jsx global>{`
                .dark-scrollbar::-webkit-scrollbar { width: 4px; }
                .dark-scrollbar::-webkit-scrollbar-track { background: #050505; }
                .dark-scrollbar::-webkit-scrollbar-thumb { background: #222; border-radius: 2px; }
                .dark-scrollbar::-webkit-scrollbar-thumb:hover { background: #444; }
            `}</style>

            <div className="h-screen bg-[#050505] text-[#EEE] font-sans flex flex-col lg:flex-row overflow-hidden">

                {/* --- LEFT: CONTROL TERMINAL --- */}
                <div className="w-full lg:w-5/12 flex flex-col border-r border-[#222] bg-[#080808] relative z-10">

                    {/* Header */}
                    <div className="p-8 pb-4 border-b border-[#222]">
                        <Link href="/dashboard" className="inline-flex items-center gap-2 text-[10px] font-bold tracking-[2px] text-[#555] hover:text-white mb-6 transition-colors group">
                            <ArrowLeft size={10} className="group-hover:-translate-x-1 transition-transform" /> BACK TO STUDIO
                        </Link>
                        <h1 className="text-3xl font-display font-bold uppercase tracking-tighter text-white leading-none mb-2">
                            New <span className="text-red-600">Production</span>
                        </h1>
                        <p className="text-[10px] font-mono text-[#444] tracking-widest">SESSION_ID: {new Date().getTime().toString().slice(-6)}</p>
                    </div>

                    {/* Scrollable Form */}
                    <div className="flex-1 overflow-y-auto p-8 space-y-8 dark-scrollbar pb-32">

                        {/* 01. TYPE */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-3 text-[10px] font-mono text-[#666]">
                                <span className="bg-[#222] text-white px-1.5 py-0.5 rounded-sm">01</span> FORMAT SELECTION
                            </div>
                            <div className="flex gap-3">
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
                            </div>
                        </div>

                        {/* 02. ASPECT */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-3 text-[10px] font-mono text-[#666]">
                                <span className="bg-[#222] text-white px-1.5 py-0.5 rounded-sm">02</span> ASPECT RATIO
                            </div>
                            <div className="flex gap-2">
                                {[
                                    { id: '16:9', label: '16:9', sub: 'Cinema', icon: RectangleHorizontal },
                                    { id: '21:9', label: '21:9', sub: 'Wide', icon: Monitor },
                                    { id: '9:16', label: '9:16', sub: 'Social', icon: RectangleVertical },
                                ].map((opt) => (
                                    <button
                                        key={opt.id}
                                        onClick={() => setFormData({ ...formData, aspect_ratio: opt.id as any })}
                                        className={`flex-1 py-3 border rounded-sm flex flex-col items-center justify-center gap-1 transition-all ${formData.aspect_ratio === opt.id
                                            ? 'border-white bg-[#222] text-white'
                                            : 'border-[#222] bg-[#0E0E0E] text-[#555] hover:border-[#444]'
                                            }`}
                                    >
                                        <opt.icon size={14} />
                                        <span className="text-[10px] font-bold tracking-wider">{opt.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 03. METADATA (VISUAL IMPROVEMENTS) */}
                        <div className="space-y-6 pt-2">
                            <div className="relative group bg-[#111] p-4 border border-[#222] rounded-sm focus-within:border-l-2 focus-within:border-l-red-600 transition-all">
                                <label className="text-[9px] font-mono text-[#555] uppercase tracking-widest block mb-2 group-focus-within:text-red-500">
                                    03 // Project Title
                                </label>
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    className="w-full bg-transparent text-lg font-bold uppercase tracking-wide text-white placeholder-[#333] focus:outline-none"
                                    placeholder="ENTER TITLE..."
                                    autoComplete="off"
                                />
                            </div>

                            <div className="relative group bg-[#111] p-4 border border-[#222] rounded-sm focus-within:border-l-2 focus-within:border-l-red-600 transition-all">
                                <label className="text-[9px] font-mono text-[#555] uppercase tracking-widest block mb-2 group-focus-within:text-red-500">
                                    04 // Logline & Genre
                                </label>
                                <textarea
                                    value={formData.genre}
                                    onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
                                    className="w-full bg-transparent text-sm font-medium text-[#CCC] placeholder-[#333] focus:outline-none resize-none h-20 leading-relaxed"
                                    placeholder="Describe the story setting, genre, and tone..."
                                />
                            </div>
                        </div>

                        {/* 05. STYLE */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-3 text-[10px] font-mono text-[#666]">
                                <span className="bg-[#222] text-white px-1.5 py-0.5 rounded-sm">05</span> RENDER ENGINE
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { id: 'realistic', label: 'REALISM', icon: Clapperboard },
                                    { id: 'anime', label: 'ANIME', icon: Layers }
                                ].map((s) => (
                                    <button
                                        key={s.id}
                                        onClick={() => setFormData({ ...formData, style: s.id as any })}
                                        className={`py-4 border rounded-sm flex items-center justify-center gap-3 transition-all ${formData.style === s.id
                                            ? 'border-red-600 text-red-500 bg-[#1A0505]'
                                            : 'border-[#222] text-[#555] hover:text-[#888] bg-[#0E0E0E]'
                                            }`}
                                    >
                                        <s.icon size={16} />
                                        <span className="text-xs font-bold tracking-widest">{s.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* --- RIGHT: VISUAL MATRIX (Dynamic) --- */}
                <div className="w-full lg:w-7/12 bg-[#050505] flex flex-col relative">

                    {/* Header */}
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

                    {/* Content */}
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
                                        <span className="text-[9px] font-mono text-[#444] mb-0.5">// {axis.description}</span>
                                    </div>

                                    {/* SMALLER GRID (3 cols on MD, 4 on XL) */}
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
                                                    {/* Full Color Image Always (Removed grayscale) */}
                                                    <img
                                                        src={option.image_url}
                                                        alt={option.label}
                                                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                                    />

                                                    {/* Gradient Overlay */}
                                                    <div className={`absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent transition-opacity ${isSelected ? 'opacity-80' : 'opacity-60 group-hover:opacity-80'}`} />

                                                    {/* Label */}
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

                    {/* Bottom Action Bar */}
                    <div className="p-6 border-t border-[#222] bg-[#050505] z-30 flex justify-end">
                        <MotionButton
                            onClick={handleSubmit}
                            loading={creating}
                            className="w-full md:w-auto px-10 py-4 text-xs tracking-[0.2em] font-bold bg-red-600 hover:bg-red-700 text-white rounded-sm"
                        >
                            INITIALIZE SYSTEM <ChevronRight size={12} className="ml-2" />
                        </MotionButton>
                    </div>
                </div>

            </div>
        </StudioLayout>
    );
}