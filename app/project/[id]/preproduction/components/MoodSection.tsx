"use client";

import React, { useState, useEffect } from "react";
import { Project } from "@/lib/types";
import { CreativeBlock } from "./CreativeBlock";
import { api } from "@/lib/api";
import { toast } from "react-hot-toast";
import { collection, onSnapshot, DocumentData, QuerySnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Palette, Loader2, CheckCircle2 } from "lucide-react";

interface MoodSectionProps {
    project: Project;
    onUpdateProject: (p: Project) => void;
    activeEpisodeId?: string | null;
}

interface MoodOption {
    id: string;
    name: string;
    image_url: string | null;
    color_palette: string;
    lighting: string;
    texture: string;
    atmosphere: string;
    status: string;
}

export function MoodSection({ project, onUpdateProject, activeEpisodeId }: MoodSectionProps) {
    const [moods, setMoods] = useState<MoodOption[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isApplying, setIsApplying] = useState<string | null>(null);

    // Fetch mood options from Firestore
    useEffect(() => {
        if (!project.id) return;
        const colRef = collection(db, "projects", project.id, "moodboard_options");
        const unsub = onSnapshot(colRef, (snapshot: QuerySnapshot<DocumentData>) => {
            const options: MoodOption[] = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    name: data.name || "",
                    image_url: data.image_url || null,
                    color_palette: data.color_palette || "",
                    lighting: data.lighting || "",
                    texture: data.texture || "",
                    atmosphere: data.atmosphere || "",
                    status: data.status || "generating",
                };
            });
            setMoods(options);
        });
        return () => unsub();
    }, [project.id]);

    const handleGenerate = async () => {
        setIsGenerating(true);
        try {
            const res = await api.post("/api/v1/shot/generate_moodboard", {
                project_id: project.id,
                episode_id: activeEpisodeId || "main",
            });
            if (res.data.status === "success") {
                toast.success("Generating cinematic styles...");
            } else {
                toast.error("Failed to start generation.");
            }
        } catch (e: any) {
            console.error(e);
            toast.error(e.response?.data?.detail || "Generation failed");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSelect = async (mood: MoodOption) => {
        setIsApplying(mood.id);
        try {
            const res = await api.post("/api/v1/shot/select_moodboard", {
                project_id: project.id,
                mood_option_id: mood.id,
            });
            if (res.data.status === "success") {
                // The API applies it to project.style_ref_url or selected_mood_id
                toast.success(`Style "${mood.name}" applied to project.`);
                // Update local context so the header/UI reflects it immediately
                onUpdateProject({
                    ...project,
                    style_ref_url: mood.image_url || project.style_ref_url,
                    moodboard_image_url: mood.image_url || (project as any).moodboard_image_url,
                } as any);
            } else {
                toast.error("Failed to apply style.");
            }
        } catch (e: any) {
            console.error(e);
            toast.error(e.response?.data?.detail || "Selection failed");
        } finally {
            setIsApplying(null);
        }
    };

    const appliedUrl = project.style_ref_url || project.moodboard?.image_url;

    return (
        <div className="w-full h-full p-8 flex flex-col gap-8">
            <style jsx>{`
                @keyframes fadeUp {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>

            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-['Anton'] uppercase tracking-wide text-white mb-1">Visual Direction</h2>
                    <p className="text-[10px] text-white/40 uppercase tracking-[2px] font-mono">
                        Automated Style Generation
                    </p>
                </div>
                {moods.length > 0 && (
                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating}
                        className="flex items-center gap-2 px-4 py-2 bg-[#E50914] hover:bg-[#ff1a25] text-white text-[10px] font-bold uppercase tracking-wider rounded-sm transition-all disabled:opacity-50"
                    >
                        {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Palette size={14} />}
                        {isGenerating ? "Generating..." : "Regenerate Styles"}
                    </button>
                )}
            </div>

            <div className="flex flex-wrap gap-6" style={{ animation: 'fadeUp 0.6s ease both' }}>
                {moods.length === 0 ? (
                    <div className="w-full py-20 flex flex-col items-center justify-center border border-dashed border-white/10 rounded-2xl">
                        <Palette size={32} className="text-[#E50914]/40 mb-4" />
                        <span className="text-white/60 text-xs font-mono uppercase tracking-widest mb-6">No Styles Generated</span>
                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating}
                            className="flex items-center gap-2 px-6 py-3 bg-[#E50914] hover:bg-[#ff1a25] text-white text-[11px] font-bold uppercase tracking-[2px] rounded-sm transition-all disabled:opacity-50"
                        >
                            {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Palette size={16} />}
                            {isGenerating ? "Generating Options..." : "Generate AI Styles"}
                        </button>
                    </div>
                ) : (
                    moods.map((mood) => {
                        const isSelected = appliedUrl === mood.image_url;
                        const isReady = mood.status === "ready" || !!mood.image_url;

                        return (
                            <CreativeBlock
                                key={mood.id}
                                type="MOODBOARD"
                                title={mood.name || "Cinematic Style"}
                                subtitle={mood.atmosphere || "Generating vibe..."}
                                imageUrl={mood.image_url || undefined}
                                isGenerating={!isReady}
                                className={`w-[280px] transition-all ${isSelected ? 'ring-2 ring-[#E50914] ring-offset-2 ring-offset-black' : ''}`}
                            >
                                <div className="mt-2 flex flex-col gap-2">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex justify-between items-center text-[9px] text-white/40 uppercase tracking-wider border-b border-white/5 pb-1">
                                            <span>Lighting</span>
                                            <span className="text-white/80 truncate max-w-[120px] text-right">{mood.lighting}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-[9px] text-white/40 uppercase tracking-wider border-b border-white/5 pb-1">
                                            <span>Colors</span>
                                            <span className="text-white/80 truncate max-w-[120px] text-right">{mood.color_palette}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-[9px] text-white/40 uppercase tracking-wider">
                                            <span>Texture</span>
                                            <span className="text-white/80 truncate max-w-[120px] text-right">{mood.texture}</span>
                                        </div>
                                    </div>

                                    {isReady && !isSelected && (
                                        <button
                                            onClick={() => handleSelect(mood)}
                                            disabled={isApplying === mood.id}
                                            className="w-full mt-2 py-2 bg-white/5 hover:bg-white/10 text-[10px] font-bold uppercase tracking-wider text-white hover:text-white transition-colors rounded border border-white/10 flex items-center justify-center gap-2"
                                        >
                                            {isApplying === mood.id ? <Loader2 size={12} className="animate-spin" /> : null}
                                            {isApplying === mood.id ? "Applying..." : "Select Style"}
                                        </button>
                                    )}

                                    {isSelected && (
                                        <div className="w-full mt-2 py-2 bg-[#E50914]/20 text-[#E50914] text-[10px] font-bold uppercase tracking-wider rounded border border-[#E50914]/30 flex items-center justify-center gap-2">
                                            <CheckCircle2 size={12} /> Active Style
                                        </div>
                                    )}
                                </div>
                            </CreativeBlock>
                        );
                    })
                )}
            </div>
        </div>
    );
}
