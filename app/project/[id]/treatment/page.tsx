"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
    ArrowLeft, Loader2, Download, RefreshCw, Sparkles, Edit3, Check, X,
    Lightbulb, Eye, Palette, Users, MapPin, Camera, Music, FileText
} from "lucide-react";
import { toast } from "react-hot-toast";
import { doc, onSnapshot, collection, getDocs, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { generateTreatment, updateTreatment, exportTreatmentPdf, fetchProject } from "@/lib/api";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface TreatmentSections {
    concept: string;
    visual_approach: string;
    tone_mood: string;
    cast: string;
    locations: string;
    shot_philosophy: string;
    music_sound: string;
}

interface NamedImage { name?: string; image_url?: string; }
type SectionImages = Record<string, (string | NamedImage)[]>;

const SECTION_META: { key: keyof TreatmentSections; label: string; subtitle: string; icon: React.ReactNode; accent: string }[] = [
    { key: "concept", label: "Concept", subtitle: "Narrative & Core Idea", icon: <Lightbulb size={18} />, accent: "#E50914" },
    { key: "visual_approach", label: "Visual Approach", subtitle: "Cinematography & Style", icon: <Eye size={18} />, accent: "#D97706" },
    { key: "tone_mood", label: "Tone & Mood", subtitle: "Atmosphere & Emotion", icon: <Palette size={18} />, accent: "#7C3AED" },
    { key: "cast", label: "Cast", subtitle: "Characters & Performances", icon: <Users size={18} />, accent: "#2563EB" },
    { key: "locations", label: "Locations", subtitle: "Settings & Environments", icon: <MapPin size={18} />, accent: "#059669" },
    { key: "shot_philosophy", label: "Shot Philosophy", subtitle: "Framing & Composition", icon: <Camera size={18} />, accent: "#DC2626" },
    { key: "music_sound", label: "Music & Sound", subtitle: "Score & Sound Design", icon: <Music size={18} />, accent: "#9333EA" },
];

const EMPTY_SECTIONS: TreatmentSections = {
    concept: "", visual_approach: "", tone_mood: "", cast: "",
    locations: "", shot_philosophy: "", music_sound: "",
};

// ─────────────────────────────────────────────────────────────────────────────
// IMAGE COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

// Hero banner image — used for first section if available
const HeroBanner = ({ url }: { url: string }) => (
    <div className="relative w-full h-72 rounded-xl overflow-hidden mb-8 group">
        <img src={url} alt="Reference" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#020202] via-transparent to-[#020202]/30" />
        <div className="absolute bottom-4 left-5">
            <span className="text-[8px] font-mono text-white/30 uppercase tracking-[4px]">Reference Frame</span>
        </div>
    </div>
);

// Named portrait grid — for cast & locations
const PortraitGrid = ({ items, accent }: { items: NamedImage[]; accent: string }) => (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4 mt-6">
        {items.map((item, i) => (
            <div key={i} className="group text-center">
                <div
                    className="aspect-square rounded-xl overflow-hidden border-2 transition-all duration-300 group-hover:scale-[1.03]"
                    style={{ borderColor: `${accent}20`, boxShadow: `0 0 0 0 ${accent}00` }}
                    onMouseOver={(e) => { e.currentTarget.style.borderColor = `${accent}60`; e.currentTarget.style.boxShadow = `0 0 30px ${accent}15`; }}
                    onMouseOut={(e) => { e.currentTarget.style.borderColor = `${accent}20`; e.currentTarget.style.boxShadow = `0 0 0 0 ${accent}00`; }}
                >
                    {item.image_url ? (
                        <img src={item.image_url} alt={item.name || ""} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full bg-white/[0.02] flex items-center justify-center">
                            <Users size={20} className="text-neutral-800" />
                        </div>
                    )}
                </div>
                {item.name && (
                    <span className="block text-[9px] font-bold text-neutral-500 uppercase tracking-[2px] mt-2 truncate px-1">
                        {item.name}
                    </span>
                )}
            </div>
        ))}
    </div>
);

// Wrapping image grid — for key frames
const FrameGrid = ({ urls, accent }: { urls: string[]; accent: string }) => (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-6">
        {urls.map((url, i) => (
            <div
                key={i}
                className="rounded-xl overflow-hidden border transition-all duration-300 group cursor-pointer aspect-video"
                style={{ borderColor: `${accent}15` }}
                onMouseOver={(e) => { e.currentTarget.style.borderColor = `${accent}50`; e.currentTarget.style.transform = 'scale(1.02)'; }}
                onMouseOut={(e) => { e.currentTarget.style.borderColor = `${accent}15`; e.currentTarget.style.transform = 'scale(1)'; }}
            >
                <img src={url} alt={`Frame ${i + 1}`} className="w-full h-full object-cover" />
            </div>
        ))}
    </div>
);

// Moodboard card with details
interface MoodData {
    name: string;
    image_url: string | null;
    color_palette: string;
    lighting: string;
    texture: string;
    atmosphere: string;
}

const MoodboardCard = ({ mood, accent }: { mood: MoodData; accent: string }) => (
    <div className="mt-6 rounded-xl overflow-hidden border" style={{ borderColor: `${accent}15` }}>
        {mood.image_url && (
            <div className="relative w-full h-56 overflow-hidden">
                <img src={mood.image_url} alt={mood.name} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#020202] via-transparent to-transparent" />
                <div className="absolute bottom-3 left-4">
                    <span className="text-[9px] font-bold text-white/60 uppercase tracking-[3px]">{mood.name}</span>
                </div>
            </div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/[0.03]">
            {[
                { label: "Color Palette", value: mood.color_palette },
                { label: "Lighting", value: mood.lighting },
                { label: "Texture", value: mood.texture },
                { label: "Atmosphere", value: mood.atmosphere },
            ].filter(d => d.value).map((d, i) => (
                <div key={i} className="bg-[#050505] px-4 py-3">
                    <span className="block text-[8px] font-mono uppercase tracking-[3px] mb-1.5" style={{ color: `${accent}50` }}>{d.label}</span>
                    <span className="block text-[11px] text-neutral-400 font-light leading-relaxed">{d.value}</span>
                </div>
            ))}
        </div>
    </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// SECTION IMAGES RENDERER
// ─────────────────────────────────────────────────────────────────────────────

const SectionMedia = ({ images, sectionKey, accent, isFirstWithImage }: {
    images: (string | NamedImage)[];
    sectionKey: string;
    accent: string;
    isFirstWithImage: boolean;
}) => {
    if (!images || images.length === 0) return null;

    // Check if entries are named objects (cast/locations)
    const isNamed = typeof images[0] === "object" && (images[0] as NamedImage).name;

    if (isNamed) {
        return <PortraitGrid items={images as NamedImage[]} accent={accent} />;
    }

    // Plain URL array
    const urls = images.map(img => typeof img === "string" ? img : (img as NamedImage).image_url || "").filter(Boolean);

    if (urls.length === 0) return null;

    // If it's the first section with images and has a single image, show as hero
    if (isFirstWithImage && urls.length === 1) {
        return <HeroBanner url={urls[0]} />;
    }

    return <FrameGrid urls={urls} accent={accent} />;
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function TreatmentPage() {
    const params = useParams();
    const router = useRouter();
    const projectId = params.id as string;
    const studioUrl = `/project/${projectId}/studio`;

    // State
    const [sections, setSections] = useState<TreatmentSections>({ ...EMPTY_SECTIONS });
    const [sectionImages, setSectionImages] = useState<SectionImages>({});
    const [heroFrames, setHeroFrames] = useState<string[]>([]);
    const [projectTitle, setProjectTitle] = useState("");
    const [genre, setGenre] = useState("");
    const [episodeId, setEpisodeId] = useState("main");
    const [hasExisting, setHasExisting] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [editingSection, setEditingSection] = useState<keyof TreatmentSections | null>(null);
    const [editBuffer, setEditBuffer] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [revealedSections, setRevealedSections] = useState<Set<string>>(new Set());
    const contentRef = useRef<HTMLDivElement>(null);

    // Project assets
    const [castMembers, setCastMembers] = useState<NamedImage[]>([]);
    const [locationAssets, setLocationAssets] = useState<NamedImage[]>([]);
    const [appliedMood, setAppliedMood] = useState<MoodData | null>(null);

    // Fetch project + assets
    useEffect(() => {
        if (!projectId) return;

        // Project metadata
        fetchProject(projectId).then(p => {
            setProjectTitle(p.title || "");
            setEpisodeId(p.default_episode_id || "main");

            // Fetch moodboard if applied
            const moodId = (p as any).selected_mood_id;
            if (moodId) {
                const moodRef = doc(db, "projects", projectId, "moodboard_options", moodId);
                onSnapshot(moodRef, (snap) => {
                    if (snap.exists()) {
                        const d = snap.data();
                        setAppliedMood({
                            name: d.name || "",
                            image_url: d.image_url || null,
                            color_palette: d.color_palette || "",
                            lighting: d.lighting || "",
                            texture: d.texture || "",
                            atmosphere: d.atmosphere || "",
                        });
                    }
                });
            }
        }).catch(() => { });

        // Fetch characters
        getDocs(collection(db, "projects", projectId, "characters")).then(snap => {
            setCastMembers(snap.docs.map(d => ({
                name: d.data().name || d.data().character_name || "",
                image_url: d.data().image_url || undefined,
            })).filter(c => c.name));
        }).catch(() => { });

        // Fetch locations
        getDocs(collection(db, "projects", projectId, "locations")).then(snap => {
            setLocationAssets(snap.docs.map(d => ({
                name: d.data().name || d.data().location_name || "",
                image_url: d.data().image_url || undefined,
            })).filter(l => l.name));
        }).catch(() => { });
    }, [projectId]);

    // Firestore listener — read ALL image fields
    useEffect(() => {
        if (!projectId || !episodeId) return;
        setLoaded(false);

        const docRef = doc(db, "projects", projectId, "episodes", episodeId, "treatment", "main");
        const unsub = onSnapshot(docRef, (snap) => {
            if (snap.exists()) {
                const data = snap.data();

                // Sections text
                if (data.sections) {
                    setSections(prev => ({ ...prev, ...data.sections }));
                    setHasExisting(true);
                }

                // Genre
                if (data.genre) setGenre(data.genre);

                // Section images (from API response)
                if (data.section_images) {
                    setSectionImages(data.section_images);
                }

                // Reference images (key_frames) — fallback for shot_philosophy / general use
                if (data.reference_images) {
                    const keyFrames = data.reference_images.key_frames || [];
                    const moodUrl = data.reference_images.moodboard_url;

                    setHeroFrames(keyFrames);

                    // Merge into sectionImages if section_images is empty
                    setSectionImages(prev => {
                        const merged = { ...prev };
                        // Use key_frames for shot_philosophy if not already set
                        if (!merged.shot_philosophy?.length && keyFrames.length > 0) {
                            merged.shot_philosophy = keyFrames.slice(0, 6);
                        }
                        // Use moodboard for concept if not already set
                        if (!merged.concept?.length && moodUrl) {
                            merged.concept = [moodUrl];
                        }
                        // Use first 2 key_frames for tone_mood if not already set
                        if (!merged.tone_mood?.length && keyFrames.length >= 2) {
                            merged.tone_mood = keyFrames.slice(0, 2);
                        }
                        return merged;
                    });
                }
            } else {
                setHasExisting(false);
            }
            setLoaded(true);
        });

        return () => unsub();
    }, [projectId, episodeId]);

    // Intersection observer for scroll-reveal
    useEffect(() => {
        if (!loaded || !hasExisting) return;
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        setRevealedSections(prev => new Set(prev).add(entry.target.id));
                    }
                });
            },
            { threshold: 0.1, rootMargin: "0px 0px -30px 0px" }
        );
        const els = document.querySelectorAll("[data-treatment-section]");
        els.forEach(el => observer.observe(el));
        return () => observer.disconnect();
    }, [loaded, hasExisting, sections]);

    // Generate
    const handleGenerate = async () => {
        setIsGenerating(true);
        setRevealedSections(new Set());
        const toastId = toast.loading("Generating director's treatment...");
        try {
            const res = await generateTreatment(projectId, episodeId);
            if (res.treatment?.sections) {
                setSections(prev => ({ ...prev, ...res.treatment.sections }));
                setHasExisting(true);
            }
            if (res.treatment?.section_images) {
                setSectionImages(prev => ({ ...prev, ...res.treatment.section_images }));
            }
            toast.dismiss(toastId);
            toast.success("Treatment generated!");
            contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
        } catch (e: any) {
            toast.dismiss(toastId);
            toast.error(e.response?.data?.detail || "Generation failed");
        } finally {
            setIsGenerating(false);
        }
    };

    // Export PDF — backend API
    const handleExportPdf = async () => {
        setIsExporting(true);
        const toastId = toast.loading("Generating PDF...");
        try {
            const blob = await exportTreatmentPdf(projectId, episodeId);
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `${(projectTitle || "Project").replace(/\s+/g, "_")}_Treatment.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            toast.dismiss(toastId);
            toast.success("PDF exported!");
        } catch (e: any) {
            toast.dismiss(toastId);
            toast.error("PDF export failed");
        } finally {
            setIsExporting(false);
        }
    };

    // Inline editing
    const startEditing = (key: keyof TreatmentSections) => { setEditingSection(key); setEditBuffer(sections[key]); };
    const cancelEditing = () => { setEditingSection(null); setEditBuffer(""); };
    const saveEditing = async () => {
        if (!editingSection) return;
        setIsSaving(true);
        try {
            await updateTreatment(projectId, episodeId, { [editingSection]: editBuffer });
            setSections(prev => ({ ...prev, [editingSection]: editBuffer }));
            toast.success("Saved");
            setEditingSection(null);
        } catch { toast.error("Save failed"); }
        finally { setIsSaving(false); }
    };

    const hasContent = Object.values(sections).some(v => v.trim().length > 0);
    let firstImageSectionFound = false;

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────────────

    return (
        <main className="fixed inset-0 bg-[#020202] text-white overflow-hidden">
            <style jsx global>{`
                @keyframes treatmentFadeUp {
                    from { opacity: 0; transform: translateY(40px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes treatmentReveal {
                    from { opacity: 0; transform: translateY(50px) scale(0.97); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                @keyframes heroParallax {
                    from { transform: scale(1.05); }
                    to { transform: scale(1); }
                }
                @keyframes pulseOrb {
                    0%, 100% { opacity: 0.03; transform: scale(1); }
                    50% { opacity: 0.08; transform: scale(1.15); }
                }
                @keyframes typewriter {
                    from { width: 0; }
                    to { width: 100%; }
                }
                @keyframes driftBlob {
                    0%, 100% { transform: translate(0, 0) rotate(0deg); }
                    25% { transform: translate(30px, -20px) rotate(90deg); }
                    50% { transform: translate(-20px, 30px) rotate(180deg); }
                    75% { transform: translate(20px, 20px) rotate(270deg); }
                }
                .section-revealed {
                    animation: treatmentReveal 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
                .section-hidden {
                    opacity: 0;
                    transform: translateY(50px);
                }
                .scrollbar-hide::-webkit-scrollbar { display: none; }
                .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>

            {/* ═══════ AMBIENT BACKGROUND ═══════ */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-0 left-1/4 w-[800px] h-[800px] rounded-full bg-[#E50914]/[0.015] blur-[200px]" style={{ animation: "pulseOrb 8s ease-in-out infinite" }} />
                <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] rounded-full bg-[#7C3AED]/[0.01] blur-[150px]" style={{ animation: "pulseOrb 10s ease-in-out infinite 3s" }} />
            </div>

            {/* ═══════ TOP BAR ═══════ */}
            <div className="absolute top-0 left-0 right-0 z-50 h-16 flex items-center justify-between px-8 bg-gradient-to-b from-[#020202] via-[#020202]/90 to-transparent">
                <div className="flex items-center gap-4">
                    <Link href={studioUrl} className="flex items-center gap-2 text-white/30 hover:text-white transition-colors no-underline group">
                        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                        <span className="text-[10px] font-bold tracking-[2px] uppercase">Studio</span>
                    </Link>
                    {projectTitle && (
                        <>
                            <div className="w-px h-4 bg-white/[0.06]" />
                            <span className="text-[10px] text-white/20 font-mono uppercase tracking-wider truncate max-w-[200px]">{projectTitle}</span>
                        </>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    {hasContent && (
                        <button onClick={handleGenerate} disabled={isGenerating}
                            className="flex items-center gap-2 px-4 py-1.5 text-[10px] font-bold text-white/30 uppercase tracking-[1px] border border-white/[0.06] rounded-lg hover:text-white hover:border-white/15 hover:bg-white/[0.03] transition-all cursor-pointer disabled:opacity-30">
                            <RefreshCw size={12} className={isGenerating ? "animate-spin" : ""} />
                            Regenerate
                        </button>
                    )}
                    {hasContent && (
                        <button onClick={handleExportPdf} disabled={isExporting}
                            className="flex items-center gap-2 px-4 py-1.5 text-[10px] font-bold text-white/30 uppercase tracking-[1px] border border-white/[0.06] rounded-lg hover:text-white hover:border-white/15 hover:bg-white/[0.03] transition-all cursor-pointer disabled:opacity-30">
                            {isExporting ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                            Export PDF
                        </button>
                    )}
                </div>
            </div>

            {/* ═══════ CONTENT ═══════ */}
            <div ref={contentRef} className="absolute inset-0 overflow-y-auto scrollbar-hide">

                {!loaded ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="flex flex-col items-center gap-4">
                            <Loader2 size={24} className="text-[#E50914] animate-spin" />
                            <span className="text-[9px] font-mono text-neutral-700 uppercase tracking-[4px]">Loading treatment...</span>
                        </div>
                    </div>
                ) : !hasExisting && !hasContent ? (
                    /* ════════ EMPTY STATE ════════ */
                    <div className="flex items-center justify-center h-full">
                        <div className="relative z-10 flex flex-col items-center text-center max-w-lg px-8" style={{ animation: "treatmentFadeUp 1s ease-out" }}>
                            <div className="relative w-24 h-24 mb-10">
                                <div className="absolute inset-0 rounded-full bg-[#E50914]/[0.05] animate-ping" style={{ animationDuration: "3s" }} />
                                <div className="absolute inset-3 rounded-full bg-[#E50914]/[0.03] animate-ping" style={{ animationDuration: "4s", animationDelay: "1s" }} />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <FileText size={32} className="text-neutral-800" />
                                </div>
                            </div>

                            <span className="text-[9px] font-mono text-[#E50914]/40 uppercase tracking-[8px] mb-6">Director&apos;s Treatment</span>

                            <h1 className="text-[32px] font-extralight text-white/80 leading-snug mb-2" style={{ fontFamily: "'Inter', sans-serif" }}>
                                Your story, visualized as a
                                <br />
                                <span className="font-medium bg-gradient-to-r from-[#E50914] to-[#D97706] bg-clip-text text-transparent">cinematic blueprint</span>
                            </h1>

                            <p className="text-[12px] text-neutral-600 leading-relaxed mb-12 max-w-sm">
                                Generate a comprehensive treatment with visuals, cast notes, location design, and shot philosophy — all from your project data.
                            </p>

                            <button onClick={handleGenerate} disabled={isGenerating}
                                className="flex items-center gap-3 px-10 py-4 bg-gradient-to-r from-[#B91C1C] to-[#E50914] hover:from-[#DC2626] hover:to-[#EF4444] text-white text-[11px] font-bold tracking-[3px] uppercase rounded-xl transition-all shadow-[0_0_60px_rgba(229,9,20,0.12)] hover:shadow-[0_0_80px_rgba(229,9,20,0.25)] cursor-pointer disabled:opacity-50">
                                {isGenerating ? <><Loader2 size={16} className="animate-spin" /> Generating...</> : <><Sparkles size={16} /> Generate Treatment</>}
                            </button>
                        </div>
                    </div>
                ) : isGenerating ? (
                    /* ════════ GENERATING STATE ════════ */
                    <div className="flex items-center justify-center h-full">
                        <div className="absolute inset-0 overflow-hidden pointer-events-none">
                            <div className="absolute top-1/4 left-1/3 w-[300px] h-[300px] rounded-full bg-[#E50914]/[0.04] blur-[100px]" style={{ animation: "driftBlob 12s ease-in-out infinite" }} />
                            <div className="absolute bottom-1/3 right-1/4 w-[250px] h-[250px] rounded-full bg-[#7C3AED]/[0.03] blur-[80px]" style={{ animation: "driftBlob 15s ease-in-out infinite reverse" }} />
                        </div>

                        <div className="relative z-10 flex flex-col items-center" style={{ animation: "treatmentFadeUp 0.5s ease-out" }}>
                            <div className="relative w-20 h-20 mb-10">
                                <div className="absolute inset-0 rounded-full border border-[#E50914]/20 animate-ping" style={{ animationDuration: "2s" }} />
                                <div className="absolute inset-3 rounded-full border border-[#E50914]/15 animate-ping" style={{ animationDuration: "2.5s", animationDelay: "0.5s" }} />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Sparkles size={22} className="text-[#E50914] animate-pulse" />
                                </div>
                            </div>
                            <span className="text-[10px] font-mono text-[#E50914]/50 uppercase tracking-[6px] mb-3">Crafting Treatment</span>
                            <p className="text-[11px] text-neutral-700 font-light">Analyzing script, cast, and visual references...</p>
                        </div>
                    </div>
                ) : (
                    /* ════════ TREATMENT CONTENT ════════ */
                    <>
                        {/* HERO — full bleed with key frame */}
                        {heroFrames.length > 0 && (
                            <div className="relative w-full h-[50vh] overflow-hidden" style={{ animation: "heroParallax 1.2s ease-out" }}>
                                <img src={heroFrames[0]} alt="Key frame" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-gradient-to-b from-[#020202] via-transparent to-[#020202]" />
                                <div className="absolute inset-0 bg-gradient-to-r from-[#020202]/80 via-transparent to-[#020202]/80" />

                                {/* Title overlay */}
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-8">
                                    <span className="text-[9px] font-mono text-white/25 uppercase tracking-[8px] mb-4" style={{ animation: "treatmentFadeUp 0.8s ease-out 0.2s both" }}>
                                        Director&apos;s Treatment
                                    </span>
                                    <h1 className="text-[42px] font-extralight text-white/90 leading-tight mb-3" style={{ fontFamily: "'Inter', sans-serif", animation: "treatmentFadeUp 0.8s ease-out 0.4s both" }}>
                                        {projectTitle || "Untitled Project"}
                                    </h1>
                                    {genre && (
                                        <span className="text-[10px] font-mono text-white/20 uppercase tracking-[4px]" style={{ animation: "treatmentFadeUp 0.8s ease-out 0.6s both" }}>
                                            {genre}
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Title block (no hero image fallback) */}
                        {heroFrames.length === 0 && (
                            <div className="text-center pt-28 pb-16 px-8" style={{ animation: "treatmentFadeUp 0.8s ease-out" }}>
                                <span className="text-[9px] font-mono text-[#E50914]/40 uppercase tracking-[8px] block mb-5">
                                    Director&apos;s Treatment
                                </span>
                                <h1 className="text-[38px] font-extralight text-white/80 leading-tight mb-3" style={{ fontFamily: "'Inter', sans-serif" }}>
                                    {projectTitle || "Untitled Project"}
                                </h1>
                                {genre && (
                                    <span className="text-[10px] font-mono text-neutral-700 uppercase tracking-[4px]">{genre}</span>
                                )}
                                <div className="w-20 h-px bg-gradient-to-r from-transparent via-[#E50914]/30 to-transparent mx-auto mt-8" />
                            </div>
                        )}

                        {/* SECTIONS */}
                        <div className="max-w-3xl mx-auto px-8 pb-24">
                            {SECTION_META.map(({ key, label, subtitle, icon, accent }, idx) => {
                                const text = sections[key];
                                const images = sectionImages[key];
                                const isRevealed = revealedSections.has(`section-${key}`);
                                const isEditing = editingSection === key;

                                if (!text?.trim() && (!images || images.length === 0)) return null;

                                const isFirstImage = !firstImageSectionFound && images?.length > 0;
                                if (isFirstImage) firstImageSectionFound = true;

                                return (
                                    <div
                                        key={key}
                                        id={`section-${key}`}
                                        data-treatment-section
                                        className={`mb-24 ${isRevealed ? "section-revealed" : "section-hidden"}`}
                                        style={{ animationDelay: `${idx * 0.05}s` }}
                                    >
                                        {/* Section header */}
                                        <div className="flex items-start gap-4 mb-5">
                                            <div
                                                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                                                style={{ backgroundColor: `${accent}08`, border: `1px solid ${accent}15`, color: `${accent}80` }}
                                            >
                                                {icon}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h2 className="text-[15px] font-bold text-white/90 uppercase tracking-[3px] mb-0.5">
                                                    {label}
                                                </h2>
                                                <span className="text-[9px] font-mono uppercase tracking-[3px]" style={{ color: `${accent}40` }}>
                                                    {subtitle}
                                                </span>
                                            </div>

                                            {/* Edit */}
                                            {!isEditing ? (
                                                <button onClick={() => startEditing(key)}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-bold text-neutral-700 uppercase tracking-wider border border-transparent hover:border-white/[0.06] hover:text-neutral-400 rounded-lg transition-all cursor-pointer opacity-0 group-hover:opacity-100"
                                                    style={{ opacity: 1 }}>
                                                    <Edit3 size={10} /> Edit
                                                </button>
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <button onClick={cancelEditing}
                                                        className="flex items-center gap-1 px-3 py-1.5 text-[9px] font-bold text-neutral-600 uppercase tracking-wider border border-white/[0.06] hover:text-white rounded-lg transition-all cursor-pointer">
                                                        <X size={10} /> Cancel
                                                    </button>
                                                    <button onClick={saveEditing} disabled={isSaving}
                                                        className="flex items-center gap-1 px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider border rounded-lg transition-all cursor-pointer disabled:opacity-50"
                                                        style={{ color: accent, borderColor: `${accent}40` }}>
                                                        {isSaving ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
                                                        Save
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Divider */}
                                        <div className="w-full h-px mb-6" style={{ background: `linear-gradient(to right, ${accent}08, ${accent}15, ${accent}08)` }} />

                                        {/* Content */}
                                        {isEditing ? (
                                            <textarea
                                                value={editBuffer}
                                                onChange={(e) => setEditBuffer(e.target.value)}
                                                className="w-full min-h-[200px] bg-white/[0.015] border border-white/[0.06] rounded-xl p-6 text-[13px] text-neutral-300 leading-[2] font-light resize-y focus:outline-none transition-colors"
                                                style={{ borderColor: `${accent}20` }}
                                                autoFocus
                                            />
                                        ) : (
                                            <div className="text-[14px] text-neutral-400 leading-[2.1] font-light whitespace-pre-wrap">
                                                {text}
                                            </div>
                                        )}

                                        {/* Images */}
                                        <SectionMedia images={images} sectionKey={key} accent={accent} isFirstWithImage={isFirstImage} />

                                        {/* PROJECT ASSETS: Cast */}
                                        {key === "cast" && castMembers.length > 0 && (
                                            <PortraitGrid items={castMembers} accent={accent} />
                                        )}

                                        {/* PROJECT ASSETS: Locations */}
                                        {key === "locations" && locationAssets.length > 0 && (
                                            <PortraitGrid items={locationAssets} accent={accent} />
                                        )}

                                        {/* PROJECT ASSETS: Moodboard */}
                                        {key === "tone_mood" && appliedMood && (
                                            <MoodboardCard mood={appliedMood} accent={accent} />
                                        )}
                                    </div>
                                );
                            })}

                            {/* Footer */}
                            <div className="text-center py-20">
                                <div className="w-12 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent mx-auto mb-6" />
                                <span className="text-[8px] font-mono text-neutral-800 uppercase tracking-[8px]">End of Treatment</span>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </main>
    );
}
