"use client";

import React from "react";
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, MapPin, Users, Sparkles, Trash2 } from "lucide-react";
import { WorkstationScene } from "./ScriptWorkstation";

interface SortableSceneCardProps {
    scene: WorkstationScene;
    index: number;
    isActive: boolean;
    onEdit: () => void;
    onDelete: (id: string) => void; // New Prop
}

export const SortableSceneCard: React.FC<SortableSceneCardProps> = ({
    scene, index, isActive, onEdit, onDelete
}) => {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: scene.id });
    const style = { transform: CSS.Transform.toString(transform), transition };

    // Smart Parsing
    const rawHeader = scene.header || scene.slugline || "UNKNOWN SCENE";
    const isInt = rawHeader.includes("INT.");
    const isExt = rawHeader.includes("EXT.");
    const cleanLocation = rawHeader.replace("INT.", "").replace("EXT.", "").replace("EXT", "").replace("INT", "").split("-")[0].trim();

    // Cast Logic
    const rawCast = scene.cast_ids || scene.characters || [];
    const castList = Array.isArray(rawCast) ? rawCast : [];

    return (
        <div
            ref={setNodeRef}
            style={style}
            onClick={onEdit}
            className={`group relative flex w-full border transition-all duration-200 cursor-pointer ${isActive ? 'bg-[#111] border-[#444] border-l-2 border-l-red-600 shadow-lg z-10' : 'bg-[#0A0A0A] border-[#222] hover:border-[#444] hover:bg-[#0E0E0E]'}`}
        >
            <div {...attributes} {...listeners} className="w-8 flex items-center justify-center border-r border-[#222] cursor-grab active:cursor-grabbing hover:bg-[#151515] transition-colors" onClick={(e) => e.stopPropagation()}>
                <GripVertical size={14} className="text-[#333] group-hover:text-[#666]" />
            </div>

            <div className="flex-1 p-3 overflow-hidden flex flex-col justify-center relative">

                {/* DELETE BUTTON (Hover Only) */}
                <button
                    onClick={(e) => { e.stopPropagation(); onDelete(scene.id); }}
                    className="absolute top-2 right-2 text-[#333] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1"
                    title="Delete Scene"
                >
                    <Trash2 size={12} />
                </button>

                {/* Header Row */}
                <div className="flex items-center gap-2 mb-2">
                    <span className={`text-sm font-mono font-bold ${isActive ? 'text-red-500' : 'text-[#444]'}`}>
                        {String(index + 1).padStart(2, '0')}
                    </span>
                    {isInt && <span className="px-1.5 py-0.5 bg-[#151515] border border-[#222] text-[9px] font-bold text-[#666] rounded-sm">INT</span>}
                    {isExt && <span className="px-1.5 py-0.5 bg-[#151515] border border-[#222] text-[9px] font-bold text-[#666] rounded-sm">EXT</span>}
                    {scene.time && <span className="ml-auto text-[9px] font-mono text-[#333] bg-[#080808] px-2 py-0.5 rounded-sm border border-[#1A1A1A]">{scene.time}</span>}
                </div>

                <div className="text-xs font-bold text-white uppercase tracking-wider truncate mb-2 pl-1 pr-6">
                    {cleanLocation || rawHeader}
                </div>

                <div className="flex items-start gap-3 pl-1 border-l-2 border-[#222] mb-3">
                    <p className="text-[10px] text-[#777] leading-relaxed font-mono line-clamp-2 flex-1">
                        {scene.summary || "No visual description available."}
                    </p>
                </div>

                {/* Tags */}
                <div className="flex items-center gap-2 pt-2 border-t border-[#151515] pl-1 flex-wrap">
                    <div className="flex items-center gap-1.5 px-1.5 py-0.5 bg-red-900/10 border border-red-900/30 rounded-sm">
                        <MapPin size={8} className="text-red-600" />
                        <span className="text-[8px] font-bold text-red-500 uppercase truncate max-w-[80px]">
                            {cleanLocation || "LOC"}
                        </span>
                    </div>
                    {castList.length > 0 ? (
                        castList.slice(0, 3).map((cast: string, i: number) => (
                            <div key={i} className="flex items-center gap-1.5 px-1.5 py-0.5 bg-green-900/10 border border-green-900/30 rounded-sm">
                                <Users size={8} className="text-green-600" />
                                <span className="text-[8px] font-bold text-green-500 uppercase truncate max-w-[80px]">
                                    {cast.replace(/_/g, " ")}
                                </span>
                            </div>
                        ))
                    ) : (
                        <span className="text-[8px] font-mono text-[#333] italic">No cast detected</span>
                    )}
                </div>
            </div>

            <div className={`w-10 flex items-center justify-center border-l border-[#222] transition-colors ${isActive ? 'bg-red-900/10' : 'bg-transparent'}`}>
                <Sparkles size={14} className={isActive ? 'text-red-500' : 'text-[#333] group-hover:text-[#666]'} />
            </div>
        </div>
    );
};