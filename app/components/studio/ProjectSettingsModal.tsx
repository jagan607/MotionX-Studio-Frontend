"use client";

import React, { useState, useEffect } from "react";
import { X, Save, Loader2, Sliders, Palette } from "lucide-react";
import { toast } from "react-hot-toast";
import { api } from "@/lib/api";
import { Project } from "@/lib/types";

// Define the shape of a moodboard item locally or import from types
interface MoodboardItem {
    title: string;
    option: string;
}

interface ProjectSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    project: Project | null;
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
        style: "",
        aspect_ratio: "16:9",
        moodboard: [] as MoodboardItem[]
    });

    // Initialize form
    useEffect(() => {
        if (isOpen && project) {
            // Check if project has new array format or old object format (migration check)
            let initialMoodboard: MoodboardItem[] = [];

            if (Array.isArray((project as any).moodboard)) {
                // Case A: It's already the new list format
                initialMoodboard = (project as any).moodboard;
            } else if ((project as any).moodboard) {
                // Case B: Migration from old Object format
                const old = (project as any).moodboard;
                if (old.lighting) initialMoodboard.push({ title: "Lighting", option: old.lighting });
                if (old.color) initialMoodboard.push({ title: "Color", option: old.color });
                if (old.texture) initialMoodboard.push({ title: "Texture", option: old.texture });
            } else {
                // Case C: Brand new/Empty - Set Defaults
                initialMoodboard = [
                    { title: "Lighting", option: "" },
                    { title: "Palette", option: "" },
                    { title: "Texture", option: "" }
                ];
            }

            setFormData({
                genre: project.genre || "",
                style: (project as any).style || "",
                aspect_ratio: (project as any).aspect_ratio || "16:9",
                moodboard: initialMoodboard
            });
        }
    }, [isOpen, project]);

    // FIXED: Guard clause handles null project. 
    // TypeScript now knows 'project' is not null below this line.
    if (!isOpen || !project) return null;

    const handleMetaChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    // Update a specific item in the moodboard array
    const updateMoodboardItem = (index: number, value: string) => {
        const newBoard = [...formData.moodboard];
        newBoard[index].option = value;
        setFormData(prev => ({ ...prev, moodboard: newBoard }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const payload = {
                genre: formData.genre,
                style: formData.style,
                aspect_ratio: formData.aspect_ratio,
                moodboard: formData.moodboard
            };

            // Use PATCH
            await api.patch(`/api/v1/project/${project.id}`, payload);

            toast.success("Configuration saved");
            onUpdate({ ...project, ...payload } as Project);
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

                {/* HEADER */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[#222] bg-[#080808]">
                    <div className="flex items-center gap-2">
                        <Sliders size={16} className="text-red-600" />
                        <h2 className="text-sm font-bold text-white uppercase tracking-widest">Project Configuration</h2>
                    </div>
                    <button onClick={onClose} className="text-[#666] hover:text-white transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* BODY */}
                <div className="flex-1 overflow-y-auto p-8 space-y-8">

                    {/* CORE PARAMS */}
                    <div className="space-y-4">
                        <h3 className="text-xs font-mono text-[#444] uppercase tracking-widest border-b border-[#222] pb-2">Core Parameters</h3>
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-[#666] uppercase tracking-wider">Genre</label>
                                <input
                                    value={formData.genre}
                                    onChange={(e) => handleMetaChange("genre", e.target.value)}
                                    className="w-full bg-[#0A0A0A] border border-[#333] text-white text-xs p-3 focus:outline-none focus:border-red-600 transition-colors placeholder-[#333]"
                                    placeholder="e.g. Sci-Fi"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-[#666] uppercase tracking-wider">Visual Style</label>
                                <input
                                    value={formData.style}
                                    onChange={(e) => handleMetaChange("style", e.target.value)}
                                    className="w-full bg-[#0A0A0A] border border-[#333] text-white text-xs p-3 focus:outline-none focus:border-red-600 transition-colors placeholder-[#333]"
                                    placeholder="e.g. Noir"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-[#666] uppercase tracking-wider">Aspect Ratio</label>
                                <select
                                    value={formData.aspect_ratio}
                                    onChange={(e) => handleMetaChange("aspect_ratio", e.target.value)}
                                    className="w-full bg-[#0A0A0A] border border-[#333] text-white text-xs p-3 focus:outline-none focus:border-red-600 transition-colors cursor-pointer"
                                >
                                    <option value="16:9">16:9 (Cinematic)</option>
                                    <option value="9:16">9:16 (Mobile)</option>
                                    <option value="4:3">4:3 (Classic)</option>
                                    <option value="2.35:1">2.35:1 (Anamorphic)</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* MOODBOARD (Dynamic List) */}
                    <div className="space-y-4">
                        <h3 className="text-xs font-mono text-[#444] uppercase tracking-widest border-b border-[#222] pb-2">Visual Moodboard</h3>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {formData.moodboard.map((item, index) => (
                                <div key={index} className="p-4 bg-[#0A0A0A] border border-[#222] hover:border-[#444] transition-colors group relative">
                                    <div className="flex items-center gap-2 mb-3 text-[#555] group-hover:text-[#888]">
                                        <Palette size={12} />
                                        <span className="text-[9px] font-bold uppercase tracking-widest">{item.title}</span>
                                    </div>
                                    <input
                                        value={item.option}
                                        onChange={(e) => updateMoodboardItem(index, e.target.value)}
                                        className="w-full bg-transparent border-b border-[#333] text-white text-xs py-1 focus:outline-none focus:border-red-600 placeholder-[#333]"
                                        placeholder={`Enter ${item.title}...`}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* FOOTER */}
                <div className="p-6 border-t border-[#222] bg-[#080808] flex justify-end gap-3">
                    <button onClick={onClose} disabled={isSaving} className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-[#666] hover:text-white transition-colors">
                        Cancel
                    </button>
                    <button onClick={handleSave} disabled={isSaving} className="px-8 py-3 bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-2 disabled:opacity-50">
                        {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                        Save Configuration
                    </button>
                </div>
            </div>
        </div>
    );
};