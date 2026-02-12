"use client";

import React from "react";
import { Film, Clock, MapPin, Users } from "lucide-react";
import { EntityStatusChip } from "./EntityStatusChip";
import { Asset } from "@/lib/types";

export interface SceneData {
    id: string;
    number: number;
    slugline: string;
    synopsis: string;
    time: string;
    characters: string[];
    location: string;
    status?: 'draft' | 'approved';
}

interface SceneCardProps {
    scene: SceneData;
    projectAssets: {
        characters: Asset[];
        locations: Asset[];
    };
    onOpenStoryboard: (scene: SceneData) => void;
}

export const SceneCard: React.FC<SceneCardProps> = ({
    scene,
    projectAssets,
    onOpenStoryboard
}) => {

    // Helper to find the full asset object
    const resolveAsset = (storedValue: string, type: 'character' | 'location') => {
        if (!storedValue) return null;

        const list = type === 'character' ? projectAssets.characters : projectAssets.locations;
        if (!list) return null;

        const normalize = (s: string) => s.toLowerCase().replace(/_/g, ' ').trim();
        const searchVal = normalize(storedValue);

        return list.find(a =>
            normalize(a.id || "") === searchVal ||
            normalize(a.name || "") === searchVal
        );
    };

    // [FIX 1] Handle undefined/null scene numbers safely
    const displaySceneNumber = scene.number !== undefined
        ? String(scene.number).padStart(2, '0')
        : "00";

    return (
        <div
            className="group relative bg-[#090909] border border-[#222] rounded-xl flex flex-col justify-between 
            hover:border-neutral-500 hover:shadow-[0_0_15px_rgba(255,255,255,0.05)] 
            transition-all duration-300 cursor-default h-full"
        >
            {/* CARD CONTENT (Padded) */}
            <div className="p-4 flex-1 flex flex-col">
                {/* HEADER */}
                <div className="mb-3">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-mono text-red-500 font-bold tracking-widest bg-red-500/10 px-1.5 py-0.5 rounded">
                            SCENE {displaySceneNumber}
                        </span>
                        <div className="flex items-center gap-1.5 text-[9px] text-neutral-400 font-mono bg-[#111] px-1.5 py-0.5 rounded border border-[#222]">
                            <Clock size={10} />
                            {scene.time || "N/A"}
                        </div>
                    </div>
                    <h3 className="text-sm font-display font-bold text-white leading-tight uppercase line-clamp-2 min-h-[1.25rem]">
                        {scene.slugline || "UNTITLED SCENE"}
                    </h3>
                </div>

                {/* SYNOPSIS BODY */}
                <div className="flex-1 mb-5">
                    <p className="text-[11px] text-neutral-400 line-clamp-3 leading-relaxed">
                        {scene.synopsis || "No synopsis available for this scene."}
                    </p>
                </div>

                {/* ASSETS SECTION */}
                <div className="space-y-3 mt-auto">
                    {/* LOCATION ROW */}
                    {scene.location && (() => {
                        const asset = resolveAsset(scene.location, 'location');
                        return (
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1.5 w-14 shrink-0 text-[9px] text-neutral-600 font-bold uppercase tracking-wider">
                                    <MapPin size={10} /> LOC
                                </div>
                                {/* [FIX 2] Added 'flex justify-start' to prevent chip from stretching full width */}
                                <div className="flex-1 min-w-0 flex justify-start">
                                    <EntityStatusChip
                                        name={asset ? asset.name : scene.location}
                                        type="location"
                                        status={asset ? 'linked' : 'missing'}
                                        imageUrl={asset?.image_url}
                                    />
                                </div>
                            </div>
                        );
                    })()}

                    {/* CAST ROW */}
                    {scene.characters && scene.characters.length > 0 && (
                        <div className="flex items-start gap-3">
                            <div className="flex items-center gap-1.5 w-14 shrink-0 text-[9px] text-neutral-600 font-bold uppercase tracking-wider mt-1.5">
                                <Users size={10} /> CAST
                            </div>
                            <div className="flex-1 flex flex-wrap gap-1.5">
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
                onClick={() => onOpenStoryboard(scene)}
                className="w-full border-t border-[#222] bg-[#111] hover:bg-white text-neutral-400 hover:text-black 
                py-3 px-4 rounded-b-xl text-[10px] font-bold tracking-[0.15em] uppercase 
                flex items-center justify-center gap-2 transition-all duration-200 group-hover:border-[#333]"
            >
                <Film size={12} className="group-hover:scale-110 transition-transform" />
                Open Storyboard
            </button>
        </div>
    );
};