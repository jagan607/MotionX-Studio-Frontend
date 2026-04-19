"use client";

import React from "react";
import { Film, User, MapPin, Palette, Package, Maximize2 } from "lucide-react";

interface CanvasToolbarProps {
    id?: string;
    onAddScene?: () => void;
    onAddCharacter?: () => void;
    onAddLocation?: () => void;
    onAddProduct?: () => void;
    onOpenMoodboard?: () => void;
    onFitToView?: () => void;
    productLabel?: string;
}

export function CanvasToolbar({
    id, onAddScene, onAddCharacter, onAddLocation, onAddProduct, onOpenMoodboard, onFitToView,
    productLabel = "Prop"
}: CanvasToolbarProps) {
    const tools = [
        { icon: Film, label: "Scene", onClick: onAddScene, color: "#FFFFFF" },
        { icon: User, label: "Character", onClick: onAddCharacter, color: "#D4A843" },
        { icon: MapPin, label: "Location", onClick: onAddLocation, color: "#4A90E2" },
        { icon: Package, label: productLabel, onClick: onAddProduct, color: "#10B981" },
        { icon: Palette, label: "Mood", onClick: onOpenMoodboard, color: "#E50914" },
        "---",
        { icon: Maximize2, label: "Fit", onClick: onFitToView, color: "#888" },
    ];

    return (
        <div id={id} className="absolute left-5 top-1/2 -translate-y-1/2 z-[20] flex flex-col gap-1.5 bg-[#0C0C0C]/90 backdrop-blur-xl border border-white/[0.06] rounded-2xl p-2 shadow-2xl">
            {tools.map((tool, i) => {
                if (tool === "---") {
                    return <div key={i} className="h-px bg-white/[0.06] mx-1.5 my-1" />;
                }
                const t = tool as { icon: any; label: string; onClick?: () => void; color: string };
                return (
                    <button
                        key={i}
                        onClick={t.onClick}
                        title={t.label}
                        className="group relative w-9 h-9 rounded-xl flex items-center justify-center text-white/30 hover:text-white hover:bg-white/[0.08] transition-all duration-200"
                    >
                        <t.icon size={16} className="transition-colors" style={{ color: undefined }} />
                        {/* Tooltip */}
                        <div className="absolute left-full ml-3 px-2.5 py-1 bg-[#1A1A1A] border border-white/10 rounded text-[9px] font-bold tracking-widest uppercase text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-xl">
                            {t.label}
                        </div>
                        {/* Accent dot */}
                        <div
                            className="absolute top-1 right-1 w-1 h-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ backgroundColor: t.color }}
                        />
                    </button>
                );
            })}
        </div>
    );
}
