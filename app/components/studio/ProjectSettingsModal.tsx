"use client";

import React, { useState, useEffect } from "react";
import { X, Save, Loader2, Sliders, Palette, Lightbulb, Grid } from "lucide-react";
import { toast } from "react-hot-toast";
import { api } from "@/lib/api"; // Assumes standard axios instance
import { Project } from "@/lib/types";

interface ProjectSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    project: Project;
    // Callback to update local state in parent after successful save
    onUpdate: (updatedProject: Project) => void;
}

export const ProjectSettingsModal: React.FC<ProjectSettingsModalProps> = ({
    isOpen,
    onClose,
    project,
    onUpdate
}) => {
    const [isSaving, setIsSaving] = useState(false);

    // --- FORM STATE ---
    const [formData, setFormData] = useState({
        genre: "",
        style: "", // This might map to 'style_preset' or similar in your DB
        aspect_ratio: "16:9",
        moodboard: {
            lighting: "",
            color: "",
            texture: ""
        }
    });

    // Initialize form when modal opens
    useEffect(() => {
        if (isOpen && project) {
            setFormData({
                genre: project.genre || "",
                style: (project as any).style || "",
                aspect_ratio: (project as any).aspect_ratio || "16:9",
                moodboard: {
                    lighting: (project as any).moodboard?.lighting || "",
                    color: (project as any).moodboard?.color || "",
                    texture: (project as any).moodboard?.texture || ""
                }
            });
        }
    }, [isOpen, project]);

    if (!isOpen) return null;

    const handleChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleMoodboardChange = (field: string, value: string) => {
        setFormData(prev => ({
            ...prev,
            moodboard: {
                ...prev.moodboard,
                [field]: value
            }
        }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            // Optimistic update payload
            const payload = {
                genre: formData.genre,
                style: formData.style,
                aspect_ratio: formData.aspect_ratio,
                moodboard: formData.moodboard
            };

            // Call API to update project
            // Endpoint structure assumed based on typical patterns
            await api.patch(`/api/v1/project/${project.id}`, payload);

            toast.success("Project settings saved");

            // Update parent state
            onUpdate({
                ...project,
                ...payload
            } as Project);

            onClose();
        } catch (error) {
            console.error("Failed to update project", error);
            toast.error("Failed to save changes");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">

            <div className="w-full max-w-2xl bg-[#050505] border border-[#222] shadow-2xl flex flex-col max-h-[90vh]">

                {/* --- HEADER --- */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[#222] bg-[#080808]">
                    <div className="flex items-center gap-2">
                        <Sliders size={16} className="text-red-600" />
                        <h2 className="text-sm font-bold text-white uppercase tracking-widest">Project Configuration</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-[#666] hover:text-white transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* --- BODY --- */}
                <div className="flex-1 overflow-y-auto p-8 space-y-8">

                    {/* SECTION 1: CORE METADATA */}
                    <div className="space-y-4">
                        <h3 className="text-xs font-mono text-[#444] uppercase tracking-widest border-b border-[#222] pb-2">Core Parameters</h3>

                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-[#666] uppercase tracking-wider">Genre</label>
                                <input
                                    value={formData.genre}
                                    onChange={(e) => handleChange("genre", e.target.value)}
                                    className="w-full bg-[#0A0A0A] border border-[#333] text-white text-xs p-3 focus:outline-none focus:border-red-600 transition-colors placeholder-[#333]"
                                    placeholder="e.g. Cyberpunk Noir"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-[#666] uppercase tracking-wider">Visual Style</label>
                                <input
                                    value={formData.style}
                                    onChange={(e) => handleChange("style", e.target.value)}
                                    className="w-full bg-[#0A0A0A] border border-[#333] text-white text-xs p-3 focus:outline-none focus:border-red-600 transition-colors placeholder-[#333]"
                                    placeholder="e.g. Photorealistic, Anime"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-[#666] uppercase tracking-wider">Aspect Ratio</label>
                                <select
                                    value={formData.aspect_ratio}
                                    onChange={(e) => handleChange("aspect_ratio", e.target.value)}
                                    className="w-full bg-[#0A0A0A] border border-[#333] text-white text-xs p-3 focus:outline-none focus:border-red-600 transition-colors appearance-none cursor-pointer"
                                >
                                    <option value="16:9">16:9 (Cinematic Widescreen)</option>
                                    <option value="9:16">9:16 (Vertical / Mobile)</option>
                                    <option value="4:3">4:3 (Classic TV)</option>
                                    <option value="2.35:1">2.35:1 (Anamorphic)</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* SECTION 2: MOODBOARD */}
                    <div className="space-y-4">
                        <h3 className="text-xs font-mono text-[#444] uppercase tracking-widest border-b border-[#222] pb-2">Visual Moodboard</h3>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Lighting */}
                            <div className="p-4 bg-[#0A0A0A] border border-[#222] hover:border-[#444] transition-colors group">
                                <div className="flex items-center gap-2 mb-3 text-[#555] group-hover:text-[#888]">
                                    <Lightbulb size={12} />
                                    <span className="text-[9px] font-bold uppercase tracking-widest">Lighting</span>
                                </div>
                                <input
                                    value={formData.moodboard.lighting}
                                    onChange={(e) => handleMoodboardChange("lighting", e.target.value)}
                                    className="w-full bg-transparent border-b border-[#333] text-white text-xs py-1 focus:outline-none focus:border-red-600 placeholder-[#333]"
                                    placeholder="e.g. Neon, Chiaroscuro"
                                />
                            </div>

                            {/* Color */}
                            <div className="p-4 bg-[#0A0A0A] border border-[#222] hover:border-[#444] transition-colors group">
                                <div className="flex items-center gap-2 mb-3 text-[#555] group-hover:text-[#888]">
                                    <Palette size={12} />
                                    <span className="text-[9px] font-bold uppercase tracking-widest">Palette</span>
                                </div>
                                <input
                                    value={formData.moodboard.color}
                                    onChange={(e) => handleMoodboardChange("color", e.target.value)}
                                    className="w-full bg-transparent border-b border-[#333] text-white text-xs py-1 focus:outline-none focus:border-red-600 placeholder-[#333]"
                                    placeholder="e.g. Teal & Orange"
                                />
                            </div>

                            {/* Texture */}
                            <div className="p-4 bg-[#0A0A0A] border border-[#222] hover:border-[#444] transition-colors group">
                                <div className="flex items-center gap-2 mb-3 text-[#555] group-hover:text-[#888]">
                                    <Grid size={12} />
                                    <span className="text-[9px] font-bold uppercase tracking-widest">Texture</span>
                                </div>
                                <input
                                    value={formData.moodboard.texture}
                                    onChange={(e) => handleMoodboardChange("texture", e.target.value)}
                                    className="w-full bg-transparent border-b border-[#333] text-white text-xs py-1 focus:outline-none focus:border-red-600 placeholder-[#333]"
                                    placeholder="e.g. Film Grain, Clean"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* --- FOOTER --- */}
                <div className="p-6 border-t border-[#222] bg-[#080808] flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={isSaving}
                        className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-[#666] hover:text-white transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-8 py-3 bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                        Save Configuration
                    </button>
                </div>

            </div>
        </div>
    );
};