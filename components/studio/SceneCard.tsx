"use client";

import React from "react";
import { Clapperboard, Clock, Timer, Pencil, GripVertical, Trash2 } from "lucide-react";
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { EntityStatusChip } from "./EntityStatusChip";
import { Asset, SceneDialogue } from "@/lib/types";

export interface SceneData {
    id: string;
    scene_number: number;
    slugline: string;
    synopsis: string;
    time: string;
    characters: string[];
    products?: string[];
    location: string;
    status?: 'draft' | 'approved';

    // DirectorConsole-compatible fields
    header: string;        // Full slugline text (e.g., "INT. OFFICE - DAY")
    summary: string;       // Scene description / visual action
    cast_ids: string[];    // Character IDs for cast management
    location_id: string;   // Location asset ID for linking
    dialogues?: SceneDialogue[];           // NEW – structured dialogues
    estimated_duration_seconds?: number;   // NEW – scene duration estimate
    [key: string]: any;    // Allow extra Firestore fields
}

interface SceneCardProps {
    scene: SceneData;
    projectAssets: {
        characters: Asset[];
        locations: Asset[];
        products?: Asset[];
    };
    projectType?: 'movie' | 'ad' | 'music_video';
    onOpenStoryboard: (scene: SceneData) => void;
    onEdit: (scene: SceneData) => void;
    onDelete: (sceneId: string) => void;
    episodeId?: string;
    projectId?: string;
    isEditing?: boolean;
    isFirstCard?: boolean;
}

export const SceneCard: React.FC<SceneCardProps> = ({
    scene,
    projectAssets,
    projectType = 'movie',
    onOpenStoryboard,
    onEdit,
    onDelete,
    episodeId,
    projectId,
    isEditing = false,
    isFirstCard = false
}) => {
    // --- DURATION HELPER ---
    const formatDuration = (seconds?: number) => {
        if (!seconds) return null;
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };
    const durationLabel = formatDuration(scene.estimated_duration_seconds);

    // --- DRAG & DROP ---
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: scene.id });
    const dragStyle = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 50 : 1,
    };

    // Helper to find the full asset object
    const resolveAsset = (storedValue: string, type: 'character' | 'location' | 'product') => {
        if (!storedValue) return null;

        let list: Asset[] = [];
        if (type === 'character') list = projectAssets.characters;
        else if (type === 'location') list = projectAssets.locations;
        else if (type === 'product') list = projectAssets.products || [];

        if (!list || list.length === 0) return null;

        // Aggressive normalize: strip prefixes, all non-alphanumeric, lowercase
        const normalize = (s: string) =>
            s.toLowerCase()
                .replace(/\b(int|ext|i\/e)\.?\s*/gi, '')  // strip INT./EXT./I/E. prefixes
                .replace(/[^a-z0-9]/g, '');                // strip ALL non-alphanumeric

        const searchVal = normalize(storedValue);
        if (!searchVal) return null;

        // 1. Exact match on normalized id or name
        let match = list.find(a =>
            normalize(a.id || '') === searchVal ||
            normalize(a.name || '') === searchVal
        );
        if (match) return match;

        // 2. Contains match (handles partial refs or extra words)
        match = list.find(a => {
            const nId = normalize(a.id || '');
            const nName = normalize(a.name || '');
            return (
                (nId && (searchVal.includes(nId) || nId.includes(searchVal))) ||
                (nName && (searchVal.includes(nName) || nName.includes(searchVal)))
            );
        });
        return match || null;
    };

    // [Display Logic] Handle 0 or undefined scene numbers
    const displaySceneNumber = scene.scene_number !== undefined
        ? String(scene.scene_number).padStart(2, '0')
        : "--";

    // Highlight style for editing state
    // Highlight style for editing state
    const editingStyle = isEditing ? {
        border: '2px solid rgba(239, 68, 68, 1)',
        boxShadow: '0 0 20px rgba(220, 38, 38, 0.4), 0 0 60px rgba(220, 38, 38, 0.1)',
        backgroundColor: 'rgba(239, 68, 68, 0.05)',
        transform: dragStyle.transform || undefined,
        transition: dragStyle.transition || 'all 0.3s ease',
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 50 : 2,
    } : dragStyle;

    return (
        <div
            id={isFirstCard ? "tour-studio-scene-card" : undefined}
            ref={setNodeRef}
            style={editingStyle}
            className={`group relative bg-[#0A0A0A] border rounded-xl flex flex-col justify-between 
            transition-all duration-300 cursor-default h-full
            ${isEditing
                    ? ''
                    : 'border-white/[0.06] hover:border-white/[0.12]'
                }`}
        >
            {/* CARD CONTENT (Padded) */}
            <div className="p-4 flex-1 flex flex-col">

                {/* HEADER */}
                <div className="flex justify-between items-center mb-4 border-b border-white/[0.04] pb-3">
                    <div className="flex items-center gap-2">
                        <div
                            {...attributes}
                            {...listeners}
                            className="cursor-grab active:cursor-grabbing text-[#444] hover:text-[#888] transition-colors p-0.5"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <GripVertical size={14} />
                        </div>
                        <span className="text-[11px] font-semibold tracking-widest text-[#ff6b6b] bg-[#E50914]/10 px-2.5 py-1 rounded-md flex items-center gap-1.5">
                            <Clapperboard size={11} /> SCENE {displaySceneNumber}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 text-[9px] text-neutral-500 bg-white/[0.03] px-2.5 py-1 rounded-md border border-white/[0.06]">
                            <Clock size={10} />
                            {scene.time || "N/A"}
                        </div>

                        {/* DURATION BADGE */}
                        {durationLabel && (
                            <div className="flex items-center gap-1.5 text-[9px] text-emerald-400 bg-emerald-500/[0.08] px-2.5 py-1 rounded-md border border-emerald-500/[0.15]">
                                <Timer size={10} />
                                {durationLabel}
                            </div>
                        )}

                        {/* EDIT BUTTON */}
                        <button
                            id={isFirstCard ? "tour-studio-edit-scene" : undefined}
                            onClick={(e) => {
                                e.stopPropagation();
                                onEdit(scene);
                            }}
                            className="p-1.5 rounded-md bg-white/[0.03] border border-white/[0.06] text-neutral-600 hover:text-white hover:border-white/[0.12] hover:bg-white/[0.06] transition-colors"
                            title="Edit Scene"
                        >
                            <Pencil size={12} />
                        </button>

                        {/* DELETE BUTTON */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete(scene.id);
                            }}
                            className="p-1.5 rounded-md bg-white/[0.03] border border-white/[0.06] text-neutral-600 hover:text-red-400 hover:border-red-800/50 hover:bg-red-900/15 transition-colors"
                            title="Delete Scene"
                        >
                            <Trash2 size={12} />
                        </button>
                    </div>
                </div>



                {/* SYNOPSIS BODY */}
                <div className="flex-1 mb-5">
                    <p className="text-[12px] text-neutral-300 leading-relaxed font-medium">
                        {scene.synopsis || "No synopsis available for this scene."}
                    </p>
                </div>

                {/* ASSETS SECTION */}
                <div className="space-y-3 mt-auto">

                    {/* LOCATION ROW */}
                    {scene.location && (() => {
                        const asset = resolveAsset(scene.location, 'location');
                        return (
                            <div className="flex flex-col gap-1.5">
                                <span className="text-[8px] text-neutral-600 font-bold uppercase tracking-wider">
                                    LOCATION
                                </span>
                                <div className="flex justify-start">
                                    <EntityStatusChip
                                        name={asset ? asset.name : scene.location}
                                        type="location"
                                        status={asset ? 'linked' : 'missing'}
                                        imageUrl={asset?.image_url}
                                        // @ts-ignore
                                        hideIcon={true}
                                    />
                                </div>
                            </div>
                        );
                    })()}

                    {/* CAST ROW */}
                    {scene.characters && scene.characters.length > 0 && (
                        <div className="flex flex-col gap-1.5">
                            <span className="text-[8px] text-neutral-600 font-bold uppercase tracking-wider">
                                CAST
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                                {scene.characters.map((charRef, idx) => {
                                    if (!charRef) return null;
                                    const asset = resolveAsset(charRef, 'character');
                                    return (
                                        <EntityStatusChip
                                            key={idx}
                                            name={asset ? asset.name : charRef}
                                            type="character"
                                            status={asset ? 'linked' : 'missing'}
                                            imageUrl={asset?.image_url}
                                            // @ts-ignore
                                            hideIcon={true}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* PRODUCTS / PROPS ROW (All project types) */}
                    {scene.products && scene.products.length > 0 && (
                        <div className="flex flex-col gap-1.5">
                            <span className="text-[8px] text-neutral-600 font-bold uppercase tracking-wider">
                                PRODUCTS
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                                {scene.products.map((prodRef, idx) => {
                                    if (!prodRef) return null;
                                    const asset = resolveAsset(prodRef, 'product');
                                    return (
                                        <EntityStatusChip
                                            key={idx}
                                            name={asset ? asset.name : prodRef}
                                            type="product" // Ensure EntityStatusChip handles 'product' type (color logic)
                                            status={asset ? 'linked' : 'missing'}
                                            imageUrl={asset?.image_url}
                                            // @ts-ignore
                                            hideIcon={true}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ACTION FOOTER */}
            <button
                id={isFirstCard ? "tour-studio-open-sb" : undefined}
                onClick={() => onOpenStoryboard(scene)}
                className="w-full border-t border-white/[0.04] bg-gradient-to-t from-[#0A0A0A] to-transparent text-neutral-500 
                hover:text-[#ff6b6b] hover:from-[#E50914]/5
                py-3 px-4 rounded-b-xl text-[10px] font-bold tracking-[0.15em] uppercase 
                flex items-center justify-center gap-2 transition-all duration-300"
            >
                <Clapperboard size={12} className="group-hover:scale-110 transition-transform" />
                Open Storyboard
            </button>
        </div>
    );
};