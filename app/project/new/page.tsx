"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { api } from "@/lib/api";
import { ArrowLeft, Film, Tv, Clapperboard, MonitorPlay, Box, Layers } from "lucide-react";
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
        style: "realistic" as "realistic" | "anime" | "3d_render",
    });

    // 3. Mood Selection State
    const [moodSelection, setMoodSelection] = useState<Record<string, string>>({});
    const [moodLabels, setMoodLabels] = useState<Record<string, string>>({});

    // --- FETCH MANIFEST ---
    useEffect(() => {
        async function fetchConfig() {
            try {
                const docRef = doc(db, "configs", "moodboard_manifest");
                const snap = await getDoc(docRef);

                if (snap.exists()) {
                    const data = snap.data() as Manifest;
                    setManifest(data);

                    // Auto-select first options
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
        setMoodLabels((prev) => ({ ...prev, [prefix]: option.label }));
    };

    const handleSubmit = async () => {
        if (!formData.title || !formData.genre) {
            toast.error("Please fill in Title and Genre");
            return;
        }

        setCreating(true);

        try {
            const idToken = await auth.currentUser?.getIdToken();
            if (!idToken) throw new Error("Auth Token Missing");

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

            const res = await api.post("/project/create", payload);
            router.push(`/project/${res.data.id}/studio`);

        } catch (e) {
            console.error("Creation failed", e);
            toast.error("Failed to initialize project.");
            setCreating(false);
        }
    };

    // --- HELPER: SELECTION CARD (UPDATED TO MATCH SERIES/NEW) ---
    const SelectionCard = ({ active, onClick, icon: Icon, label }: any) => (
        <button
            onClick={onClick}
            className={`
        flex-1 py-8 px-4 border transition-all duration-200 flex flex-col items-center justify-center gap-4
        ${active
                    ? 'border-white text-white bg-white/5' // High Contrast Active State
                    : 'border-neutral-800 text-neutral-500 hover:border-neutral-600 hover:text-neutral-400 bg-transparent'}
      `}
        >
            <Icon className={`w-6 h-6 ${active ? 'text-white' : 'text-current'}`} strokeWidth={1.5} />
            <span className="text-[11px] font-bold tracking-[0.2em] uppercase">{label}</span>
        </button>
    );

    return (
        <StudioLayout>
            {/* NAV */}
            <Link href="/dashboard" className="inline-flex items-center gap-2 text-[10px] font-bold tracking-[2px] text-motion-text-muted hover:text-motion-text mb-10 transition-colors">
                <ArrowLeft size={14} /> BACK TO DASHBOARD
            </Link>

            {/* HEADER */}
            <div className="mb-12">
                <h1 className="text-5xl font-display uppercase mb-2 text-white leading-none">New Production</h1>
                <p className="text-motion-text-muted text-sm font-medium">Initialize parameters for your new project.</p>
            </div>

            {/* 01: PROJECT TYPE */}
            <div className="mb-12">
                <MotionLabel number="01" label="PROJECT TYPE" />
                <div className="flex gap-6">
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

            {/* 02: TITLE */}
            <div className="mb-2">
                <MotionLabel number="02" label="TITLE" />
                <MotionInput
                    placeholder="EX: BLADE RUNNER 2049"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
            </div>

            {/* 03: GENRE */}
            <div className="mb-12">
                <MotionLabel number="03" label="GENRE & LOGLINE" />
                <MotionInput
                    placeholder="EX: CYBERPUNK NOIR THRILLER"
                    value={formData.genre}
                    onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
                />
            </div>

            {/* 04: BASE MODEL STYLE */}
            <div className="mb-16">
                <MotionLabel number="04" label="BASE MODEL STYLE" />
                <div className="grid grid-cols-3 gap-6">
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

            <hr className="border-neutral-900 mb-16" />

            {/* 05: VISUAL DIRECTION (MOODBOARD) */}
            <div className="space-y-12 mb-16">
                <div className="flex items-end justify-between border-l-2 border-motion-red pl-4">
                    <h2 className="text-2xl font-bold uppercase tracking-tight text-white">Visual Direction</h2>
                    <div className="font-mono text-[10px] text-white/50">
                        CODE: <span className="text-motion-red">{moodSelection["A"]}-{moodSelection["B"]}-{moodSelection["C"]}</span>
                    </div>
                </div>

                {loadingManifest ? (
                    <div className="text-motion-text-muted text-sm animate-pulse">Loading visual assets...</div>
                ) : (
                    manifest?.axes.map((axis) => (
                        <div key={axis.id} className="space-y-4">
                            <div className="flex items-baseline gap-3">
                                <span className="text-motion-red font-mono font-bold text-sm tracking-widest">{axis.code_prefix} //</span>
                                <span className="font-bold uppercase tracking-wide text-sm text-white">{axis.label}</span>
                                <span className="text-neutral-600 text-xs uppercase tracking-widest hidden md:inline-block">- {axis.description}</span>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                {axis.options.map((option) => {
                                    const isSelected = moodSelection[axis.code_prefix] === option.id;
                                    return (
                                        <button
                                            key={option.id}
                                            onClick={() => handleMoodSelect(axis.code_prefix, option)}
                                            className={`
                                            group relative aspect-video overflow-hidden transition-all duration-300 border
                                            ${isSelected
                                                    ? 'border-white ring-1 ring-white shadow-[0_0_20px_rgba(255,255,255,0.1)]' // Active: Clean White
                                                    : 'border-neutral-800 hover:border-neutral-600 opacity-60 hover:opacity-100'}
                                        `}
                                        >
                                            <img
                                                src={option.image_url}
                                                alt={option.label}
                                                className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent opacity-90" />

                                            <div className="absolute bottom-0 left-0 w-full p-4 text-left">
                                                <div className={`text-[10px] font-mono mb-1 ${isSelected ? 'text-motion-red' : 'text-neutral-500'}`}>{option.id}</div>
                                                <div className={`font-bold text-xs uppercase leading-none tracking-wider ${isSelected ? 'text-white' : 'text-neutral-400'}`}>{option.label}</div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* SUBMIT */}
            <MotionButton onClick={handleSubmit} loading={creating}>
                INITIALIZE PROJECT
            </MotionButton>
            <div className="h-20" /> {/* Spacer */}
        </StudioLayout>
    );
}