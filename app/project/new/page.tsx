"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { api } from "@/lib/api";
import {
    ArrowLeft, Film, Tv, Clapperboard, Box, Layers,
    RectangleHorizontal, RectangleVertical, Monitor, Wand2, Loader2, Aperture, ChevronRight
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

    // --- FETCH MANIFEST ---
    useEffect(() => {
        async function fetchConfig() {
            try {
                const docRef = doc(db, "configs", "moodboard_manifest");
                const snap = await getDoc(docRef);

                if (snap.exists()) {
                    const data = snap.data() as Manifest;
                    setManifest(data);

                    const initialSelection: Record<string, string> = {};
                    data.axes.forEach((axis) => {
                        if (axis.options.length > 0) {
                            initialSelection[axis.code_prefix] = axis.options[0].id;
                        }
                    });
                    setMoodSelection(initialSelection);
                }
            } catch (e) {
                console.error("Config Error:", e);
                // toast.error("Failed to load creative assets.");
            } finally {
                setLoadingManifest(false);
            }
        }
        fetchConfig();
    }, []);

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
            // TRANSFORM: Convert selection map to Array<{title, option}>
            // The backend now expects List[MoodboardItem]
            const moodboardList: { title: string; option: string }[] = [];

            manifest?.axes.forEach(axis => {
                const selectedId = moodSelection[axis.code_prefix];
                const option = axis.options.find(o => o.id === selectedId);

                if (option) {
                    moodboardList.push({
                        title: axis.label, // e.g. "Lighting"
                        option: option.label // e.g. "Cinematic"
                    });
                }
            });

            const payload = {
                title: formData.title,
                genre: formData.genre,
                type: formData.type,
                aspect_ratio: formData.aspect_ratio,
                style: formData.style,
                moodboard: moodboardList // <--- Send the Array
            };

            // Ensure the endpoint matches your backend router (singular vs plural)
            // You likely used 'project/create' based on previous context.
            const res = await api.post("/api/v1/project/create", payload);

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
                relative flex-1 p-4 border transition-all duration-300 flex flex-col justify-between h-28 group
                ${active
                    ? 'border-red-600 bg-gradient-to-br from-red-950/20 to-transparent'
                    : 'border-[#333] bg-[#0E0E0E] hover:border-[#666]'}
            `}
        >
            <div className="flex justify-between items-start w-full">
                <Icon className={`w-5 h-5 ${active ? 'text-red-500' : 'text-[#555] group-hover:text-[#888]'}`} />
                {active && <div className="h-1.5 w-1.5 bg-red-500 rounded-full shadow-[0_0_8px_#EF4444]" />}
            </div>

            <div className="text-left">
                <div className={`text-[10px] font-mono tracking-widest uppercase mb-1 ${active ? 'text-red-400' : 'text-[#555]'}`}>{subLabel}</div>
                <div className={`text-sm font-bold tracking-wider uppercase ${active ? 'text-white' : 'text-[#888] group-hover:text-white'}`}>{label}</div>
            </div>
        </button>
    );

    return (
        <StudioLayout>
            <style jsx global>{`
                /* Custom Scrollbar for Dark Theme */
                .dark-scrollbar::-webkit-scrollbar { width: 6px; }
                .dark-scrollbar::-webkit-scrollbar-track { background: #050505; }
                .dark-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
                .dark-scrollbar::-webkit-scrollbar-thumb:hover { background: #555; }
            `}</style>

            <div className="h-screen bg-[#050505] text-[#EEE] font-sans flex flex-col lg:flex-row overflow-hidden">

                {/* --- LEFT: CONTROL TERMINAL --- */}
                <div className="w-full lg:w-5/12 flex flex-col border-r border-[#222] bg-[#080808] relative z-10">

                    {/* Header */}
                    <div className="p-8 pb-4 border-b border-[#222]">
                        <Link href="/dashboard" className="inline-flex items-center gap-2 text-[10px] font-bold tracking-[2px] text-[#555] hover:text-white mb-6 transition-colors group">
                            <ArrowLeft size={10} className="group-hover:-translate-x-1 transition-transform" /> BACK TO STUDIO
                        </Link>
                        <h1 className="text-4xl font-display font-bold uppercase tracking-tighter text-white leading-none mb-2">
                            New <span className="text-red-600">Production</span>
                        </h1>
                        <p className="text-xs font-mono text-[#444] tracking-widest">SESSION_ID: {new Date().getTime().toString().slice(-6)}</p>
                    </div>

                    {/* Scrollable Form */}
                    <div className="flex-1 overflow-y-auto p-8 space-y-10 dark-scrollbar pb-32">

                        {/* 01. TYPE */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 text-[10px] font-mono text-[#666]">
                                <span className="bg-[#222] text-white px-1.5 py-0.5 rounded-sm">01</span> FORMAT SELECTION
                            </div>
                            <div className="flex gap-4">
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
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 text-[10px] font-mono text-[#666]">
                                <span className="bg-[#222] text-white px-1.5 py-0.5 rounded-sm">02</span> ASPECT RATIO
                            </div>
                            <div className="flex gap-3">
                                {[
                                    { id: '16:9', label: '16:9', sub: 'Cinema', icon: RectangleHorizontal },
                                    { id: '21:9', label: '21:9', sub: 'Wide', icon: Monitor },
                                    { id: '9:16', label: '9:16', sub: 'Social', icon: RectangleVertical },
                                ].map((opt) => (
                                    <button
                                        key={opt.id}
                                        onClick={() => setFormData({ ...formData, aspect_ratio: opt.id as any })}
                                        className={`flex-1 py-3 border flex flex-col items-center justify-center gap-2 transition-all ${formData.aspect_ratio === opt.id
                                            ? 'border-white bg-[#1A1A1A] text-white'
                                            : 'border-[#333] bg-[#0A0A0A] text-[#555] hover:border-[#555]'
                                            }`}
                                    >
                                        <opt.icon size={16} />
                                        <span className="text-[10px] font-bold tracking-wider">{opt.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 03. METADATA */}
                        <div className="space-y-8">
                            <div className="relative group">
                                <label className="text-[10px] font-mono text-[#666] absolute -top-3 left-0 bg-[#080808] px-1 group-focus-within:text-red-500 transition-colors">
                                    03 // PROJECT TITLE
                                </label>
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    className="w-full bg-transparent border-b border-[#333] py-3 text-xl font-bold uppercase tracking-wide text-white placeholder-[#222] focus:border-red-600 focus:outline-none transition-colors"
                                    placeholder="UNTITLED PROJECT"
                                    autoComplete="off"
                                />
                            </div>

                            <div className="relative group">
                                <label className="text-[10px] font-mono text-[#666] absolute -top-3 left-0 bg-[#080808] px-1 group-focus-within:text-red-500 transition-colors">
                                    04 // LOGLINE / GENRE
                                </label>
                                <textarea
                                    value={formData.genre}
                                    onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
                                    className="w-full bg-transparent border-b border-[#333] py-3 text-sm font-mono text-[#AAA] placeholder-[#222] focus:border-red-600 focus:outline-none transition-colors resize-none h-20"
                                    placeholder="A cyberpunk detective hunts a rogue AI in Neo-Tokyo..."
                                />
                            </div>
                        </div>

                        {/* 05. STYLE */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 text-[10px] font-mono text-[#666]">
                                <span className="bg-[#222] text-white px-1.5 py-0.5 rounded-sm">05</span> RENDER ENGINE
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { id: 'realistic', label: 'REALISM', icon: Clapperboard },
                                    { id: 'anime', label: 'ANIME', icon: Layers },
                                    { id: '3d_render', label: '3D CGI', icon: Box }
                                ].map((s) => (
                                    <button
                                        key={s.id}
                                        onClick={() => setFormData({ ...formData, style: s.id as any })}
                                        className={`py-3 border flex items-center justify-center gap-2 transition-all ${formData.style === s.id
                                            ? 'border-red-600 text-red-500 bg-red-950/10'
                                            : 'border-[#333] text-[#555] hover:text-[#888]'
                                            }`}
                                    >
                                        <s.icon size={14} />
                                        <span className="text-[10px] font-bold tracking-widest">{s.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* --- RIGHT: VISUAL MATRIX --- */}
                <div className="w-full lg:w-7/12 bg-[#050505] flex flex-col relative">

                    {/* Header */}
                    <div className="h-16 border-b border-[#222] flex items-center justify-between px-8 bg-[#050505]/90 backdrop-blur-sm z-20 sticky top-0">
                        <div className="flex items-center gap-3">
                            <Aperture className="text-red-600 animate-spin-slow" size={18} />
                            <span className="text-xs font-bold uppercase tracking-[0.2em] text-white">Visual Matrix</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="text-[9px] font-mono text-[#444]">
                                VECTOR CODE: <span className="text-red-500">{moodSelection["A"] || "00"}-{moodSelection["B"] || "00"}-{moodSelection["C"] || "00"}</span>
                            </div>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-8 space-y-12 dark-scrollbar">
                        {loadingManifest ? (
                            <div className="h-full flex flex-col items-center justify-center opacity-50">
                                <Loader2 className="animate-spin text-red-600 mb-4" size={32} />
                                <span className="text-[10px] font-mono tracking-widest text-[#666]">DECRYPTING ASSET DATABASE...</span>
                            </div>
                        ) : (
                            manifest?.axes.map((axis) => (
                                <div key={axis.id} className="space-y-4">
                                    <div className="flex items-end gap-4 border-b border-[#222] pb-2">
                                        <span className="text-xl font-display font-bold uppercase text-white tracking-tight">{axis.label}</span>
                                        <span className="text-[9px] font-mono text-red-600 mb-1">{axis.code_prefix} // {axis.description}</span>
                                    </div>

                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                        {axis.options.map((option) => {
                                            const isSelected = moodSelection[axis.code_prefix] === option.id;
                                            return (
                                                <button
                                                    key={option.id}
                                                    onClick={() => handleMoodSelect(axis.code_prefix, option)}
                                                    className={`
                                                        relative aspect-video group overflow-hidden transition-all duration-500
                                                        ${isSelected ? 'ring-2 ring-red-600 z-10 scale-[1.02]' : 'opacity-60 hover:opacity-100 grayscale hover:grayscale-0'}
                                                    `}
                                                >
                                                    <img
                                                        src={option.image_url}
                                                        alt={option.label}
                                                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                                    />

                                                    {/* Overlay */}
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-80" />

                                                    {/* Label */}
                                                    <div className="absolute bottom-0 left-0 w-full p-3 flex justify-between items-end">
                                                        <div className="text-left">
                                                            <div className={`text-[8px] font-mono ${isSelected ? 'text-red-500' : 'text-[#666]'}`}>{option.id}</div>
                                                            <div className="text-[10px] font-bold uppercase text-white tracking-widest">{option.label}</div>
                                                        </div>
                                                        {isSelected && <div className="h-1.5 w-1.5 bg-red-600 rounded-full shadow-[0_0_10px_#EF4444]" />}
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
                            className="w-full md:w-auto px-12 py-6 text-sm tracking-[0.2em] font-bold bg-red-600 hover:bg-red-700 text-white"
                        >
                            INITIALIZE SYSTEM <ChevronRight size={14} className="ml-2" />
                        </MotionButton>
                    </div>
                </div>

            </div>
        </StudioLayout>
    );
}