"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase"; // Ensure this points to your firebase config
import { Loader2, Film, Tv, Play } from "lucide-react";

// --- TYPES (Matches your DB Schema) ---
type MoodOption = {
    id: string;
    label: string;
    sub_label: string;
    image_url: string;
};

type MoodAxis = {
    id: string;
    code_prefix: string; // "A", "B", "C"
    label: string;
    description: string;
    options: MoodOption[];
};

type Manifest = {
    version: number;
    axes: MoodAxis[];
};

// --- COMPONENT ---
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
        style: "realistic" as "realistic" | "anime" | "3d_render",
    });

    // 3. Mood Selection State { A: "A1", B: "B2", C: "C1" }
    const [moodSelection, setMoodSelection] = useState<Record<string, string>>({});
    const [moodLabels, setMoodLabels] = useState<Record<string, string>>({}); // { A: "Naturalist", ... }

    // --- FETCH MANIFEST ON LOAD ---
    useEffect(() => {
        async function fetchConfig() {
            try {
                const docRef = doc(db, "configs", "moodboard_manifest");
                const snap = await getDoc(docRef);
                if (snap.exists()) {
                    const data = snap.data() as Manifest;
                    setManifest(data);

                    // Pre-select the first option of each axis to avoid null states
                    const initialSelection: Record<string, string> = {};
                    const initialLabels: Record<string, string> = {};
                    data.axes.forEach((axis) => {
                        if (axis.options.length > 0) {
                            initialSelection[axis.code_prefix] = axis.options[0].id;
                            initialLabels[axis.code_prefix] = axis.options[0].label;
                        }
                    });
                    setMoodSelection(initialSelection);
                    setMoodLabels(initialLabels);
                }
            } catch (e) {
                console.error("Failed to load moodboard config", e);
            } finally {
                setLoadingManifest(false);
            }
        }
        fetchConfig();
    }, []);

    // --- HANDLERS ---
    const handleMoodSelect = (prefix: string, option: MoodOption) => {
        setMoodSelection((prev) => ({ ...prev, [prefix]: option.id }));
        setMoodLabels((prev) => ({ ...prev, [prefix]: option.label }));
    };

    const handleSubmit = async () => {
        if (!formData.title || !formData.genre) return;
        setCreating(true);

        try {
            // 1. Construct the Payload (Matches Pydantic Model)
            const payload = {
                title: formData.title,
                genre: formData.genre,
                type: formData.type,
                style: formData.style,
                moodboard: {
                    code: `${moodSelection["A"]}-${moodSelection["B"]}-${moodSelection["C"]}`,
                    lighting: moodLabels["A"],
                    color: moodLabels["B"],
                    texture: moodLabels["C"]
                }
            };


        } catch (e) {
            console.error("Creation failed", e);
            setCreating(false);
        }
    };

    if (loadingManifest) return <div className="h-screen w-full bg-black flex items-center justify-center text-white"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="min-h-screen bg-black text-white p-8 overflow-y-auto">
            <div className="max-w-5xl mx-auto space-y-12 pb-20">

                {/* HEADER */}
                <div>
                    <h1 className="text-4xl font-bold tracking-tighter uppercase font-oswald">New Production</h1>
                    <p className="text-neutral-400 mt-2">Initialize parameters for your new project.</p>
                </div>

                {/* SECTION 1: IDENTITY */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    <div className="space-y-6">

                        {/* 01 TYPE */}
                        <div className="space-y-2">
                            <label className="text-xs font-mono text-red-500 tracking-widest">01 // PROJECT TYPE</label>
                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    onClick={() => setFormData({ ...formData, type: 'movie' })}
                                    className={`p-6 border flex flex-col items-center gap-3 transition-all ${formData.type === 'movie' ? 'border-red-600 bg-red-900/10' : 'border-neutral-800 hover:border-neutral-600'}`}
                                >
                                    <Film className={formData.type === 'movie' ? 'text-red-500' : 'text-neutral-500'} />
                                    <span className="text-sm font-bold uppercase">Movie</span>
                                </button>
                                <button
                                    onClick={() => setFormData({ ...formData, type: 'micro_drama' })}
                                    className={`p-6 border flex flex-col items-center gap-3 transition-all ${formData.type === 'micro_drama' ? 'border-red-600 bg-red-900/10' : 'border-neutral-800 hover:border-neutral-600'}`}
                                >
                                    <Tv className={formData.type === 'micro_drama' ? 'text-red-500' : 'text-neutral-500'} />
                                    <span className="text-sm font-bold uppercase">Micro Drama</span>
                                </button>
                            </div>
                        </div>

                        {/* 02 TITLE */}
                        <div className="space-y-2">
                            <label className="text-xs font-mono text-red-500 tracking-widest">02 // TITLE</label>
                            <input
                                type="text"
                                placeholder="EX: BLADE RUNNER 2049"
                                className="w-full bg-transparent border-b border-neutral-700 py-4 text-2xl font-bold focus:outline-none focus:border-red-600 placeholder:text-neutral-800"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            />
                        </div>

                        {/* 03 GENRE */}
                        <div className="space-y-2">
                            <label className="text-xs font-mono text-red-500 tracking-widest">03 // GENRE & LOGLINE</label>
                            <input
                                type="text"
                                placeholder="EX: CYBERPUNK NOIR THRILLER"
                                className="w-full bg-transparent border-b border-neutral-700 py-4 text-2xl font-bold focus:outline-none focus:border-red-600 placeholder:text-neutral-800"
                                value={formData.genre}
                                onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
                            />
                        </div>
                    </div>

                    {/* STYLE SELECTOR (STATIC FOR NOW) */}
                    <div className="space-y-2">
                        <label className="text-xs font-mono text-red-500 tracking-widest">04 // BASE MODEL STYLE</label>
                        <div className="grid grid-cols-1 gap-3">
                            {['realistic', 'anime', '3d_render'].map((style) => (
                                <button
                                    key={style}
                                    onClick={() => setFormData({ ...formData, style: style as any })}
                                    className={`w-full text-left px-6 py-4 border transition-all uppercase font-bold text-sm ${formData.style === style ? 'border-red-600 bg-red-900/10 text-white' : 'border-neutral-800 text-neutral-500'}`}
                                >
                                    {style.replace('_', ' ')}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <hr className="border-neutral-900" />

                {/* SECTION 2: MOODBOARD (DYNAMIC) */}
                <div className="space-y-12">
                    <div className="flex items-end justify-between">
                        <h2 className="text-2xl font-bold uppercase tracking-tight">Visual Direction</h2>
                        <div className="font-mono text-xs text-red-500 bg-red-900/20 px-3 py-1 rounded">
                            CODE: {moodSelection["A"]}-{moodSelection["B"]}-{moodSelection["C"]}
                        </div>
                    </div>

                    {/* DYNAMIC RENDERER */}
                    {manifest?.axes.map((axis) => (
                        <div key={axis.id} className="space-y-4">
                            <div className="flex items-baseline gap-4">
                                <span className="text-red-500 font-mono font-bold text-lg">{axis.code_prefix} // {axis.label}</span>
                                <span className="text-neutral-600 text-sm">{axis.description}</span>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                {axis.options.map((option) => {
                                    const isSelected = moodSelection[axis.code_prefix] === option.id;
                                    return (
                                        <button
                                            key={option.id}
                                            onClick={() => handleMoodSelect(axis.code_prefix, option)}
                                            className={`group relative aspect-video border overflow-hidden transition-all ${isSelected ? 'border-red-500 ring-1 ring-red-500' : 'border-neutral-800 hover:border-neutral-600'}`}
                                        >
                                            {/* IMAGE */}
                                            <img src={option.image_url} alt={option.label} className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />

                                            {/* GRADIENT OVERLAY */}
                                            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-90" />

                                            {/* LABEL */}
                                            <div className="absolute bottom-0 left-0 w-full p-3 text-left">
                                                <div className={`text-xs font-mono mb-1 ${isSelected ? 'text-red-400' : 'text-neutral-500'}`}>{option.id}</div>
                                                <div className="font-bold text-sm uppercase leading-none">{option.label}</div>
                                                <div className="text-[10px] text-neutral-400 mt-1">{option.sub_label}</div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                {/* FOOTER ACTION */}
                <div className="pt-8 border-t border-neutral-900 flex justify-end">
                    <button
                        onClick={handleSubmit}
                        disabled={creating || !formData.title}
                        className="bg-red-600 hover:bg-red-700 text-white px-12 py-4 font-bold uppercase tracking-widest text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {creating ? <Loader2 className="animate-spin w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
                        {creating ? "Initializing..." : "Initialize Project"}
                    </button>
                </div>

            </div>
        </div>
    );
}