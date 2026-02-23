"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
    X, Loader2, FileText, Download, RefreshCw, Check,
    Lightbulb, Eye, Palette, Users, MapPin, Camera, Music,
    Sparkles
} from "lucide-react";
import { toast } from "react-hot-toast";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { generateTreatment, updateTreatment, exportTreatmentPdf } from "@/lib/api";

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

const SECTION_META: { key: keyof TreatmentSections; label: string; icon: React.ReactNode }[] = [
    { key: "concept", label: "Concept & Narrative", icon: <Lightbulb size={14} /> },
    { key: "visual_approach", label: "Visual Approach", icon: <Eye size={14} /> },
    { key: "tone_mood", label: "Tone & Mood", icon: <Palette size={14} /> },
    { key: "cast", label: "Cast & Characters", icon: <Users size={14} /> },
    { key: "locations", label: "Locations & Settings", icon: <MapPin size={14} /> },
    { key: "shot_philosophy", label: "Shot Philosophy", icon: <Camera size={14} /> },
    { key: "music_sound", label: "Music & Sound", icon: <Music size={14} /> },
];

const EMPTY_SECTIONS: TreatmentSections = {
    concept: "", visual_approach: "", tone_mood: "", cast: "",
    locations: "", shot_philosophy: "", music_sound: "",
};

interface TreatmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    projectId: string;
    episodeId: string;
    projectTitle?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export const TreatmentModal: React.FC<TreatmentModalProps> = ({
    isOpen, onClose, projectId, episodeId, projectTitle
}) => {
    const [sections, setSections] = useState<TreatmentSections>({ ...EMPTY_SECTIONS });
    const [hasExisting, setHasExisting] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());
    const [activeSection, setActiveSection] = useState<keyof TreatmentSections>("concept");
    const [loaded, setLoaded] = useState(false);
    const debounceTimers = useRef<Record<string, NodeJS.Timeout>>({});

    // ── FIRESTORE LISTENER ──
    useEffect(() => {
        if (!isOpen || !projectId || !episodeId) return;
        setLoaded(false);

        const docRef = doc(db, "projects", projectId, "episodes", episodeId, "treatment", "main");
        const unsub = onSnapshot(docRef, (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                if (data.sections) {
                    setSections(prev => ({ ...prev, ...data.sections }));
                    setHasExisting(true);
                }
            } else {
                setHasExisting(false);
            }
            setLoaded(true);
        });

        return () => unsub();
    }, [isOpen, projectId, episodeId]);

    // ── GENERATE ──
    const handleGenerate = async () => {
        setIsGenerating(true);
        const toastId = toast.loading("Generating director's treatment...");
        try {
            const res = await generateTreatment(projectId, episodeId);
            if (res.treatment?.sections) {
                setSections(prev => ({ ...prev, ...res.treatment.sections }));
                setHasExisting(true);
            }
            toast.dismiss(toastId);
            toast.success("Treatment generated!");
        } catch (e: any) {
            toast.dismiss(toastId);
            toast.error(e.response?.data?.detail || "Failed to generate treatment");
        } finally {
            setIsGenerating(false);
        }
    };

    // ── DEBOUNCED SAVE ──
    const handleSectionChange = useCallback((key: keyof TreatmentSections, value: string) => {
        setSections(prev => ({ ...prev, [key]: value }));

        if (debounceTimers.current[key]) {
            clearTimeout(debounceTimers.current[key]);
        }

        debounceTimers.current[key] = setTimeout(async () => {
            setSavingKeys(prev => new Set(prev).add(key));
            try {
                await updateTreatment(projectId, episodeId, { [key]: value });
            } catch (e) {
                console.error("Auto-save failed:", e);
            } finally {
                setSavingKeys(prev => {
                    const next = new Set(prev);
                    next.delete(key);
                    return next;
                });
            }
        }, 800);
    }, [projectId, episodeId]);

    // ── EXPORT PDF ──
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
            toast.error(e.response?.data?.detail || "PDF export failed");
        } finally {
            setIsExporting(false);
        }
    };

    // ── CLEANUP ──
    useEffect(() => {
        return () => {
            Object.values(debounceTimers.current).forEach(clearTimeout);
        };
    }, []);

    if (!isOpen) return null;

    const currentMeta = SECTION_META.find(s => s.key === activeSection)!;
    const hasContent = Object.values(sections).some(v => v.trim().length > 0);

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-[95vw] max-w-[1200px] h-[90vh] bg-[#0A0A0A] border border-white/[0.06] rounded-xl flex flex-col overflow-hidden shadow-2xl">

                {/* ── TOP BAR ── */}
                <div className="h-14 border-b border-white/[0.06] bg-[#080808] flex items-center justify-between px-6 shrink-0">
                    <div className="flex items-center gap-3">
                        <FileText size={16} className="text-[#E50914]" />
                        <h2 className="text-[12px] font-bold text-white uppercase tracking-widest">
                            Director&apos;s Treatment
                        </h2>
                        {projectTitle && (
                            <>
                                <div className="w-px h-4 bg-white/[0.08]" />
                                <span className="text-[10px] font-mono text-neutral-600 uppercase tracking-wider truncate max-w-[200px]">
                                    {projectTitle}
                                </span>
                            </>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Generate / Regenerate */}
                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating}
                            className="flex items-center gap-2 px-4 py-2 bg-white/[0.04] border border-white/[0.08] hover:border-[#E50914]/40 hover:bg-[#E50914]/10 text-neutral-400 hover:text-white text-[10px] font-bold tracking-widest uppercase rounded-md transition-all cursor-pointer disabled:opacity-40"
                        >
                            {isGenerating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                            {hasContent ? "Regenerate" : "Generate"}
                        </button>

                        {/* Export PDF */}
                        {hasContent && (
                            <button
                                onClick={handleExportPdf}
                                disabled={isExporting}
                                className="flex items-center gap-2 px-4 py-2 bg-white/[0.04] border border-white/[0.08] hover:border-white/20 text-neutral-400 hover:text-white text-[10px] font-bold tracking-widest uppercase rounded-md transition-all cursor-pointer disabled:opacity-40"
                            >
                                {isExporting ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                                Export PDF
                            </button>
                        )}

                        {/* Close */}
                        <button
                            onClick={onClose}
                            className="w-8 h-8 flex items-center justify-center text-neutral-600 hover:text-white hover:bg-white/[0.06] rounded-md transition-colors cursor-pointer"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {/* ── BODY ── */}
                <div className="flex-1 flex overflow-hidden">

                    {/* SECTION NAV (LEFT) */}
                    <div className="w-56 border-r border-white/[0.06] bg-[#060606] py-2 shrink-0 overflow-y-auto">
                        {SECTION_META.map(({ key, label, icon }) => (
                            <button
                                key={key}
                                onClick={() => setActiveSection(key)}
                                className={`w-full flex items-center gap-3 px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider transition-all cursor-pointer
                                    ${activeSection === key
                                        ? "bg-white/[0.04] text-white border-l-2 border-l-[#E50914]"
                                        : "text-neutral-600 hover:text-neutral-300 hover:bg-white/[0.02] border-l-2 border-l-transparent"
                                    }`}
                            >
                                <span className={activeSection === key ? "text-[#E50914]" : "text-neutral-700"}>{icon}</span>
                                <span className="truncate">{label}</span>
                                {sections[key]?.trim() && (
                                    <Check size={10} className="ml-auto text-emerald-500/60 shrink-0" />
                                )}
                                {savingKeys.has(key) && (
                                    <Loader2 size={10} className="ml-auto text-[#E50914] animate-spin shrink-0" />
                                )}
                            </button>
                        ))}
                    </div>

                    {/* CONTENT (RIGHT) */}
                    <div className="flex-1 flex flex-col overflow-hidden">

                        {!loaded ? (
                            <div className="flex-1 flex items-center justify-center">
                                <Loader2 size={24} className="text-[#E50914] animate-spin" />
                            </div>
                        ) : !hasExisting && !hasContent ? (
                            /* EMPTY STATE */
                            <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
                                <div className="w-16 h-16 rounded-full bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-5">
                                    <FileText size={24} className="text-neutral-700" />
                                </div>
                                <h3 className="text-[13px] font-bold text-white uppercase tracking-widest mb-2">
                                    No Treatment Yet
                                </h3>
                                <p className="text-[11px] text-neutral-600 max-w-sm leading-relaxed mb-6">
                                    Generate a director&apos;s treatment from your script, cast, locations, and moodboard.
                                    It covers concept, visuals, tone, cast, locations, shot philosophy, and sound design.
                                </p>
                                <button
                                    onClick={handleGenerate}
                                    disabled={isGenerating}
                                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#B91C1C] to-[#E50914] hover:from-[#DC2626] hover:to-[#EF4444] text-white text-[10px] font-bold tracking-widest uppercase rounded-lg transition-all shadow-[0_0_20px_rgba(229,9,20,0.15)] hover:shadow-[0_0_30px_rgba(229,9,20,0.3)] cursor-pointer disabled:opacity-50"
                                >
                                    {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                                    {isGenerating ? "Generating..." : "Generate Treatment"}
                                </button>
                            </div>
                        ) : (
                            /* SECTION EDITOR */
                            <div className="flex-1 flex flex-col overflow-hidden">
                                {/* Section Header */}
                                <div className="px-8 pt-6 pb-4 border-b border-white/[0.04] shrink-0">
                                    <div className="flex items-center gap-3 mb-1">
                                        <span className="text-[#E50914]">{currentMeta.icon}</span>
                                        <h3 className="text-[14px] font-bold text-white uppercase tracking-wider">
                                            {currentMeta.label}
                                        </h3>
                                        {savingKeys.has(activeSection) && (
                                            <span className="text-[9px] font-mono text-[#E50914] uppercase tracking-widest animate-pulse">Saving...</span>
                                        )}
                                        {!savingKeys.has(activeSection) && sections[activeSection]?.trim() && (
                                            <span className="text-[9px] font-mono text-emerald-600 uppercase tracking-widest flex items-center gap-1">
                                                <Check size={9} /> Saved
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Textarea */}
                                <div className="flex-1 overflow-y-auto px-8 py-4">
                                    <textarea
                                        value={sections[activeSection]}
                                        onChange={(e) => handleSectionChange(activeSection, e.target.value)}
                                        placeholder={`Write your ${currentMeta.label.toLowerCase()} notes here...`}
                                        className="w-full h-full min-h-[300px] bg-transparent text-[13px] text-neutral-300 leading-relaxed resize-none focus:outline-none placeholder-neutral-700 font-light"
                                        disabled={isGenerating}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
