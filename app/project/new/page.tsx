"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { api } from "@/lib/api";
import {
    ArrowLeft, Film, Tv, Clapperboard, Box, Layers,
    RectangleHorizontal, RectangleVertical, Monitor, Wand2
} from "lucide-react";
import { toast } from "react-hot-toast";

// --- DESIGN SYSTEM IMPORTS ---
import { StudioLayout } from "@/components/ui/StudioLayout";
import { MotionInput } from "@/components/ui/MotionInput";
import { MotionLabel } from "@/components/ui/MotionLabel";
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
        aspect_ratio: "16:9" as "16:9" | "21:9" | "9:16",
        style: "realistic" as "realistic" | "anime" | "3d_render",
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
                toast.error("Failed to load creative assets.");
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
            const moodLabels: Record<string, string> = {};
            manifest?.axes.forEach(axis => {
                const selectedId = moodSelection[axis.code_prefix];
                const option = axis.options.find(o => o.id === selectedId);
                if (option) moodLabels[axis.code_prefix] = option.label;
            });

            const payload = {
                title: formData.title,
                genre: formData.genre,
                type: formData.type,
                aspect_ratio: formData.aspect_ratio,
                style: formData.style,
                moodboard: {
                    code: Object.values(moodSelection).join('-'),
                    lighting: moodLabels["A"],
                    color: moodLabels["B"],
                    texture: moodLabels["C"]
                }
            };

            const res = await api.post("api/v1/project/create", payload);
            router.push(`/project/${res.data.id}`);

        } catch (e: any) {
            console.error("Creation failed", e);
            toast.error(e.response?.data?.detail || "Failed to initialize project.");
            setCreating(false);
        }
    };

    // --- HELPER: SELECTION CARD ---
    const SelectionCard = ({ active, onClick, icon: Icon, label, subLabel }: any) => (
        <button
            onClick={onClick}
            className={`
        flex-1 py-3 px-2 border transition-all duration-200 flex flex-col items-center justify-center gap-1.5
        ${active
                    ? 'border-white text-white bg-white/5 shadow-[0_0_15px_rgba(255,255,255,0.05)]'
                    : 'border-neutral-800 text-neutral-500 hover:border-neutral-600 hover:text-neutral-400 bg-transparent'}
      `}
        >
            <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-current'}`} strokeWidth={1.5} />
            <div className="text-center">
                <div className="text-[10px] font-bold tracking-[0.1em] uppercase">{label}</div>
                {subLabel && <div className="text-[8px] font-mono opacity-50">{subLabel}</div>}
            </div>
        </button>
    );

    return (
        <StudioLayout>
            <div className="flex flex-col lg:flex-row gap-6 h-full">

                {/* --- LEFT COLUMN: CONFIGURATION --- */}
                {/* overflow-y-auto ensures this column scrolls if height is small, but h-full keeps it contained */}
                <div className="w-full lg:w-5/12 flex flex-col gap-5 overflow-y-auto pr-2 scrollbar-hide lg:scrollbar-thin scrollbar-thumb-neutral-800 pb-8">

                    {/* Header Group */}
                    <div>
                        <Link href="/dashboard" className="inline-flex items-center gap-2 text-[9px] font-bold tracking-[2px] text-motion-text-muted hover:text-motion-text mb-3 transition-colors">
                            <ArrowLeft size={10} /> BACK TO DASHBOARD
                        </Link>
                        <h1 className="text-3xl font-display uppercase mb-1 text-white leading-none">New Production</h1>
                        <p className="text-motion-text-muted text-xs font-medium">Initialize parameters for your new project.</p>
                    </div>

                    {/* 01: Project Type */}
                    <div>
                        <MotionLabel number="01" label="PROJECT TYPE" className="mb-2" />
                        <div className="flex gap-3">
                            <SelectionCard
                                active={formData.type === 'movie'}
                                onClick={() => setFormData({ ...formData, type: 'movie' })}
                                icon={Film}
                                label="Movie"
                            />
                            <SelectionCard
                                active={formData.type === 'micro_drama'}
                                onClick={() => setFormData({ ...formData, type: 'micro_drama' })}
                                icon={Tv}
                                label="Micro Drama"
                            />
                        </div>
                    </div>

                    {/* 02: Aspect Ratio (Moved Vertically) */}
                    <div>
                        <MotionLabel number="02" label="ASPECT RATIO" className="mb-2" />
                        <div className="flex gap-3">
                            <SelectionCard
                                active={formData.aspect_ratio === '16:9'}
                                onClick={() => setFormData({ ...formData, aspect_ratio: '16:9' })}
                                icon={RectangleHorizontal}
                                label="16:9"
                                subLabel="CINEMA"
                            />
                            <SelectionCard
                                active={formData.aspect_ratio === '21:9'}
                                onClick={() => setFormData({ ...formData, aspect_ratio: '21:9' })}
                                icon={Monitor}
                                label="21:9"
                                subLabel="WIDE"
                            />
                            <SelectionCard
                                active={formData.aspect_ratio === '9:16'}
                                onClick={() => setFormData({ ...formData, aspect_ratio: '9:16' })}
                                icon={RectangleVertical}
                                label="9:16"
                                subLabel="VERTICAL"
                            />
                        </div>
                    </div>

                    {/* 03 & 04: Text Inputs */}
                    <div className="space-y-4">
                        <div>
                            <MotionLabel number="03" label="TITLE" className="mb-1" />
                            <MotionInput
                                placeholder="EX: BLADE RUNNER 2049"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                className="mb-0 py-3 text-lg"
                            />
                        </div>
                        <div>
                            <MotionLabel number="04" label="GENRE & LOGLINE" className="mb-1" />
                            <MotionInput
                                placeholder="EX: CYBERPUNK NOIR THRILLER"
                                value={formData.genre}
                                onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
                                className="mb-0 py-3 text-lg"
                            />
                        </div>
                    </div>

                    {/* 05: Base Model */}
                    <div>
                        <MotionLabel number="05" label="BASE MODEL STYLE" className="mb-2" />
                        <div className="grid grid-cols-3 gap-3">
                            {[
                                { id: 'realistic', label: 'Realistic', icon: Clapperboard },
                                { id: 'anime', label: 'Anime', icon: Layers },
                                { id: '3d_render', label: '3D Render', icon: Box }
                            ].map((s) => (
                                <SelectionCard
                                    key={s.id}
                                    active={formData.style === s.id}
                                    onClick={() => setFormData({ ...formData, style: s.id as any })}
                                    icon={s.icon}
                                    label={s.label}
                                />
                            ))}
                        </div>
                    </div>
                </div>

                {/* --- RIGHT COLUMN: VISUALS --- */}
                {/* h-full + flex-col ensures this column fills height, and contents adjust */}
                <div className="w-full lg:w-7/12 flex flex-col bg-neutral-900/30 border border-neutral-800 rounded-lg overflow-hidden h-full shadow-2xl">

                    {/* Visual Header */}
                    <div className="px-5 py-3 border-b border-neutral-800 bg-black/40 flex justify-between items-center backdrop-blur-sm shrink-0">
                        <div className="flex items-center gap-2">
                            <Wand2 size={14} className="text-motion-red" />
                            <span className="text-sm font-bold uppercase tracking-wider text-white">Visual Direction</span>
                        </div>
                        <div className="font-mono text-[10px] text-white/40 bg-white/5 px-2 py-0.5 rounded border border-white/5">
                            CODE: <span className="text-motion-red">{moodSelection["A"]}-{moodSelection["B"]}-{moodSelection["C"]}</span>
                        </div>
                    </div>

                    {/* Scrollable Content */}
                    <div className="flex-1 overflow-y-auto p-5 space-y-6 scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-transparent">
                        {loadingManifest ? (
                            <div className="flex items-center justify-center h-full text-xs font-mono text-neutral-600 animate-pulse">LOADING ASSETS...</div>
                        ) : (
                            manifest?.axes.map((axis) => (
                                <div key={axis.id} className="space-y-2">
                                    <div className="flex items-baseline justify-between">
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-motion-red font-mono font-bold text-xs">{axis.code_prefix} //</span>
                                            <span className="font-bold uppercase tracking-wide text-xs text-white">{axis.label}</span>
                                        </div>
                                        <span className="text-[9px] text-neutral-500 uppercase tracking-widest">{axis.description}</span>
                                    </div>

                                    <div className="grid grid-cols-3 gap-2">
                                        {axis.options.map((option) => {
                                            const isSelected = moodSelection[axis.code_prefix] === option.id;
                                            return (
                                                <button
                                                    key={option.id}
                                                    onClick={() => handleMoodSelect(axis.code_prefix, option)}
                                                    className={`
                                                        group relative aspect-[16/9] overflow-hidden transition-all duration-200 border rounded-sm
                                                        ${isSelected
                                                            ? 'border-white ring-1 ring-white z-10'
                                                            : 'border-neutral-800 hover:border-neutral-600 opacity-60 hover:opacity-100'}
                                                    `}
                                                >
                                                    <img
                                                        src={option.image_url}
                                                        alt={option.label}
                                                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                                    />
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-90" />

                                                    <div className="absolute bottom-0 left-0 w-full p-1.5 text-left">
                                                        <div className={`text-[8px] font-mono leading-none mb-0.5 ${isSelected ? 'text-motion-red' : 'text-neutral-500'}`}>{option.id}</div>
                                                        <div className={`font-bold text-[9px] uppercase leading-none tracking-wider ${isSelected ? 'text-white' : 'text-neutral-400'}`}>{option.label}</div>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Footer Action (Sticky) */}
                    <div className="p-4 border-t border-neutral-800 bg-neutral-900/95 backdrop-blur-sm shrink-0 z-20">
                        <MotionButton onClick={handleSubmit} loading={creating} className="w-full py-4 text-sm tracking-[0.2em]">
                            INITIALIZE PROJECT
                        </MotionButton>
                    </div>
                </div>

            </div>
        </StudioLayout>
    );
}