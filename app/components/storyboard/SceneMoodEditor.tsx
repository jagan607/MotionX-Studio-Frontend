"use client";

import React, { useState, useEffect } from "react";
import { Palette, Sun, Layers, CloudFog, X, RotateCcw, Loader2 } from "lucide-react";
import { SceneMood } from "@/lib/types";

interface SceneMoodEditorProps {
    mood: SceneMood;
    moodSource: "scene" | "project" | "none";
    onSave: (mood: SceneMood) => Promise<void>;
    onReset: () => Promise<void>;
    onClose: () => void;
}

export const SceneMoodEditor: React.FC<SceneMoodEditorProps> = ({
    mood,
    moodSource,
    onSave,
    onReset,
    onClose,
}) => {
    const [colorPalette, setColorPalette] = useState(mood.color_palette || "");
    const [lighting, setLighting] = useState(mood.lighting || "");
    const [texture, setTexture] = useState(mood.texture || "");
    const [atmosphere, setAtmosphere] = useState(mood.atmosphere || "");
    const [isSaving, setIsSaving] = useState(false);
    const [isResetting, setIsResetting] = useState(false);

    useEffect(() => {
        setColorPalette(mood.color_palette || "");
        setLighting(mood.lighting || "");
        setTexture(mood.texture || "");
        setAtmosphere(mood.atmosphere || "");
    }, [mood]);

    const isDirty =
        colorPalette !== (mood.color_palette || "") ||
        lighting !== (mood.lighting || "") ||
        texture !== (mood.texture || "") ||
        atmosphere !== (mood.atmosphere || "");

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onSave({
                color_palette: colorPalette,
                lighting,
                texture,
                atmosphere,
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleReset = async () => {
        setIsResetting(true);
        try {
            await onReset();
        } finally {
            setIsResetting(false);
        }
    };

    const fields = [
        { key: "color_palette", label: "Color Palette", icon: Palette, value: colorPalette, setter: setColorPalette, placeholder: "e.g. Warm amber and deep gold..." },
        { key: "lighting", label: "Lighting", icon: Sun, value: lighting, setter: setLighting, placeholder: "e.g. Chiaroscuro, single source golden..." },
        { key: "texture", label: "Texture", icon: Layers, value: texture, setter: setTexture, placeholder: "e.g. Clean digital with lens flare..." },
        { key: "atmosphere", label: "Atmosphere", icon: CloudFog, value: atmosphere, setter: setAtmosphere, placeholder: "e.g. Reverent, intimate, sacred..." },
    ];

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

            {/* Modal */}
            <div className="relative w-full max-w-lg bg-[#0A0A0A] border border-[#222] rounded-lg shadow-2xl shadow-black/80 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[#1A1A1A]">
                    <div className="flex items-center gap-3">
                        <Palette size={16} className="text-amber-500/70" />
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">Scene Mood</h3>
                        {moodSource === "scene" ? (
                            <span className="text-[8px] font-bold text-amber-400/70 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded uppercase tracking-wider">
                                Custom
                            </span>
                        ) : moodSource === "project" ? (
                            <span className="text-[8px] font-bold text-blue-400/70 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded uppercase tracking-wider">
                                Project Default
                            </span>
                        ) : (
                            <span className="text-[8px] font-bold text-[#555] bg-white/5 border border-white/10 px-2 py-0.5 rounded uppercase tracking-wider">
                                Not Set
                            </span>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded text-[#555] hover:text-white hover:bg-white/10 transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Fields */}
                <div className="px-6 py-5 space-y-4">
                    {fields.map(({ key, label, icon: Icon, value, setter, placeholder }) => (
                        <div key={key} className="space-y-1.5">
                            <label className="text-[9px] font-mono text-[#555] uppercase tracking-wider flex items-center gap-1.5">
                                <Icon size={10} className="text-[#444]" /> {label}
                            </label>
                            <input
                                type="text"
                                value={value}
                                onChange={(e) => setter(e.target.value)}
                                placeholder={placeholder}
                                className="w-full bg-[#111] border border-[#222] text-[12px] text-[#CCC] px-3 py-2.5 rounded-md focus:outline-none focus:border-[#444] focus:bg-[#161616] transition-colors placeholder:text-[#333]"
                            />
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-[#1A1A1A] bg-[#080808]">
                    {moodSource === "scene" ? (
                        <button
                            onClick={handleReset}
                            disabled={isResetting}
                            className="flex items-center gap-2 px-4 py-2 text-[10px] font-bold text-[#888] uppercase tracking-wider border border-[#222] rounded hover:text-white hover:border-[#444] transition-colors disabled:opacity-50"
                        >
                            {isResetting ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                            Reset to Project Mood
                        </button>
                    ) : (
                        <div />
                    )}

                    <button
                        onClick={handleSave}
                        disabled={!isDirty || isSaving}
                        className="flex items-center gap-2 px-6 py-2 text-[10px] font-bold text-white uppercase tracking-wider bg-[#E50914] rounded hover:bg-[#ff1a25] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {isSaving ? <Loader2 size={12} className="animate-spin" /> : null}
                        {isSaving ? "Saving..." : "Save Mood"}
                    </button>
                </div>
            </div>
        </div>
    );
};
