"use client";

import React from "react";
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, MapPin, Users, Sparkles, Trash2, Clock, Palette } from "lucide-react";
import { WorkstationScene } from "./ScriptWorkstation";

interface SortableSceneCardProps {
    scene: WorkstationScene;
    index: number;
    isActive: boolean;
    onEdit: () => void;
    onDelete: (id: string) => void;
    domId?: string; // [NEW] For auto-scroll targeting
}

export const SortableSceneCard: React.FC<SortableSceneCardProps> = ({
    scene, index, isActive, onEdit, onDelete, domId
}) => {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: scene.id });
    const style = { transform: CSS.Transform.toString(transform), transition };

    // Smart Parsing for Slugline
    const rawHeader = scene.header || scene.slugline || "UNKNOWN SCENE";
    // Ensure header looks like a script slugline (Uppercase)
    const formattedHeader = rawHeader.toUpperCase();

    // Extract location for the tag (optional usage)
    const cleanLocation = formattedHeader
        .replace("INT.", "")
        .replace("EXT.", "")
        .replace("INT ", "")
        .replace("EXT ", "")
        .split("-")[0]
        .trim();

    // Cast Logic
    const rawCast = scene.cast_ids || scene.characters || [];
    const castList = Array.isArray(rawCast) ? rawCast : [];

    // Mood Logic
    const mood = scene.mood;
    const hasMood = mood && (mood.atmosphere || mood.color_palette);

    return (
        <div
            id={domId} // [NEW] Custom ID
            ref={setNodeRef}
            style={style}
            onClick={onEdit}
            className={`group relative flex w-full transition-all duration-200 cursor-pointer rounded-lg overflow-hidden
                ${isActive
                    ? 'bg-[#1A0A0A] border border-red-500/30 border-l-[3px] border-l-red-500 shadow-[0_0_20px_rgba(229,9,20,0.08)] z-10'
                    : 'bg-[#0C0C0C] border border-[#1E1E1E] hover:border-[#333] hover:bg-[#111]'}`}
        >
            {/* 1. DRAG HANDLE */}
            <div
                {...attributes}
                {...listeners}
                className="w-8 flex items-center justify-center cursor-grab active:cursor-grabbing hover:bg-white/[0.03] transition-colors shrink-0"
                onClick={(e) => e.stopPropagation()}
            >
                <GripVertical size={14} className="text-[#2A2A2A] group-hover:text-[#555]" />
            </div>

            {/* 2. MAIN CONTENT */}
            <div className="flex-1 p-4 flex flex-col relative min-w-0">

                {/* DELETE BUTTON */}
                <button
                    onClick={(e) => { e.stopPropagation(); onDelete(scene.id); }}
                    className="absolute top-2.5 right-2.5 p-1.5 rounded-md text-[#333] hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all z-20"
                    title="Delete Scene"
                >
                    <Trash2 size={14} />
                </button>

                {/* A. SCENE HEADER */}
                <div className="flex items-baseline gap-3 mb-2.5 mr-8">
                    <span className={`text-[11px] font-semibold tabular-nums ${isActive ? 'text-red-400' : 'text-[#444]'}`}>
                        {String(index + 1).padStart(2, '0')}
                    </span>

                    <span className="text-[11px] text-white/90 font-semibold truncate uppercase tracking-wide">
                        {formattedHeader}
                    </span>

                    {scene.time && (
                        <div className="ml-auto flex items-center gap-1.5 shrink-0">
                            <Clock size={9} className="text-[#555]" />
                            <span className="text-[9px] text-[#666] uppercase font-medium">{scene.time}</span>
                        </div>
                    )}
                </div>

                {/* B. SCRIPT CONTENT (3-line clamp) */}
                <div className="mb-3">
                    <p className="text-[13px] text-[#ccc] leading-relaxed whitespace-pre-wrap" style={{
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                    }}>
                        {scene.summary || <span className="text-[#444] italic">No visual description available.</span>}
                    </p>
                </div>

                {/* C. METADATA TAGS (Dimmed outlines) */}
                <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Location Tag */}
                    <div className="flex items-center gap-1 px-2 py-0.5 border border-red-500/20 rounded-md text-red-400/70 bg-red-500/[0.04]">
                        <MapPin size={9} />
                        <span className="text-[8px] font-medium uppercase tracking-wider max-w-[120px] truncate">
                            {cleanLocation || "LOC"}
                        </span>
                    </div>

                    {/* Cast Tags */}
                    {castList.length > 0 ? (
                        castList.map((cast: string, i: number) => (
                            <div key={i} className="flex items-center gap-1 px-2 py-0.5 border border-amber-500/20 rounded-md text-amber-400/70 bg-amber-500/[0.04]">
                                <Users size={9} />
                                <span className="text-[8px] font-medium uppercase tracking-wider max-w-[100px] truncate">
                                    {cast.replace(/_/g, " ")}
                                </span>
                            </div>
                        ))
                    ) : (
                        <span className="text-[8px] text-[#2A2A2A] italic pl-1">No cast</span>
                    )}

                    {/* Mood Chip */}
                    {hasMood && (
                        <div className="flex items-center gap-1 px-2 py-0.5 border border-violet-500/20 rounded-md text-violet-400/70 bg-violet-500/[0.04]">
                            <Palette size={9} />
                            <span className="text-[8px] font-medium uppercase tracking-wider max-w-[120px] truncate">
                                {mood.atmosphere || mood.color_palette || "Mood"}
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};