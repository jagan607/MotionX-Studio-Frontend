"use client";

import React from "react";
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, MapPin, Users, Sparkles, Trash2, Clock } from "lucide-react";
import { WorkstationScene } from "./ScriptWorkstation";

interface SortableSceneCardProps {
    scene: WorkstationScene;
    index: number;
    isActive: boolean;
    onEdit: () => void;
    onDelete: (id: string) => void;
}

export const SortableSceneCard: React.FC<SortableSceneCardProps> = ({
    scene, index, isActive, onEdit, onDelete
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

    return (
        <div
            ref={setNodeRef}
            style={style}
            onClick={onEdit}
            className={`group relative flex w-full border transition-all duration-200 cursor-pointer rounded-sm overflow-hidden
                ${isActive
                    ? 'bg-[#111] border-[#444] border-l-2 border-l-red-600 shadow-xl z-10'
                    : 'bg-[#0A0A0A] border-[#222] hover:border-[#444] hover:bg-[#0E0E0E]'}`}
        >
            {/* 1. DRAG HANDLE */}
            <div
                {...attributes}
                {...listeners}
                className="w-8 flex items-center justify-center border-r border-[#1A1A1A] cursor-grab active:cursor-grabbing hover:bg-[#151515] transition-colors shrink-0"
                onClick={(e) => e.stopPropagation()}
            >
                <GripVertical size={14} className="text-[#333] group-hover:text-[#666]" />
            </div>

            {/* 2. MAIN CONTENT */}
            <div className="flex-1 p-4 flex flex-col relative min-w-0">

                {/* DELETE BUTTON (Enhanced) */}
                <button
                    onClick={(e) => { e.stopPropagation(); onDelete(scene.id); }}
                    className="absolute top-2 right-2 p-2 rounded text-[#444] hover:text-red-500 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all z-20"
                    title="Delete Scene"
                >
                    <Trash2 size={16} />
                </button>

                {/* A. MONOSPACE SLUGLINE HEADER */}
                <div className="flex items-baseline gap-3 mb-3 border-b border-[#1A1A1A] pb-2 mr-8">
                    <span className={`font-mono text-xs font-bold ${isActive ? 'text-red-500' : 'text-[#555]'}`}>
                        {String(index + 1).padStart(2, '0')}
                    </span>

                    <span className="font-mono text-xs text-[#888] font-medium truncate uppercase tracking-tight">
                        {formattedHeader}
                    </span>

                    {scene.time && (
                        <div className="ml-auto flex items-center gap-1.5 opacity-50">
                            <Clock size={10} className="text-[#555]" />
                            <span className="font-mono text-[10px] text-[#555] uppercase">{scene.time}</span>
                        </div>
                    )}
                </div>

                {/* B. SCRIPT CONTENT (Full Text) */}
                <div className="mb-4 pl-1">
                    <p className="text-sm text-[#CCC] leading-relaxed font-serif whitespace-pre-wrap">
                        {scene.summary || <span className="text-[#444] italic">No visual description available.</span>}
                    </p>
                </div>

                {/* C. METADATA TAGS (Dimmed) */}
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Location Tag - Dimmed Monochrome */}
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-[#151515] border border-[#222] rounded text-[#666]">
                        <MapPin size={10} />
                        <span className="text-[9px] font-bold uppercase tracking-wider max-w-[120px] truncate">
                            {cleanLocation || "LOC"}
                        </span>
                    </div>

                    {/* Cast Tags - Dimmed Blue */}
                    {castList.length > 0 ? (
                        castList.map((cast: string, i: number) => (
                            <div key={i} className="flex items-center gap-1.5 px-2 py-1 bg-blue-950/20 border border-blue-900/20 rounded text-blue-400/60">
                                <Users size={10} />
                                <span className="text-[9px] font-bold uppercase tracking-wider max-w-[100px] truncate">
                                    {cast.replace(/_/g, " ")}
                                </span>
                            </div>
                        ))
                    ) : (
                        <span className="text-[9px] font-mono text-[#333] italic pl-1">No cast assigned</span>
                    )}
                </div>
            </div>

            {/* 3. ACTIVE INDICATOR STRIP */}
            <div className={`w-1 transition-colors ${isActive ? 'bg-red-600' : 'bg-transparent'}`} />
        </div>
    );
};