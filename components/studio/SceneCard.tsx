"use client";

import React from "react";
import { Film, Clock, Pencil } from "lucide-react";
import { EntityStatusChip } from "./EntityStatusChip";
import { Asset } from "@/lib/types";
import { useRouter } from "next/navigation";

export interface SceneData {
    id: string;
    scene_number: number;
    slugline: string;
    synopsis: string;
    time: string;
    characters: string[];
    products?: string[]; // [NEW] Added products array
    location: string;
    status?: 'draft' | 'approved';
}

interface SceneCardProps {
    scene: SceneData;
    projectAssets: {
        characters: Asset[];
        locations: Asset[];
        products?: Asset[]; // [NEW] Added products asset list
    };
    projectType?: 'movie' | 'ad' | 'music_video'; // [NEW] To toggle display
    onOpenStoryboard: (scene: SceneData) => void;
    episodeId?: string; // [NEW]
    projectId?: string; // [NEW]
}

export const SceneCard: React.FC<SceneCardProps> = ({
    scene,
    projectAssets,
    projectType = 'movie', // Default to movie
    onOpenStoryboard,
    episodeId,
    projectId
}) => {
    const router = useRouter(); // [NEW]

    console.log("scene.products", scene.products);

    // Helper to find the full asset object
    const resolveAsset = (storedValue: string, type: 'character' | 'location' | 'product') => {
        if (!storedValue) return null;

        let list: Asset[] = [];
        if (type === 'character') list = projectAssets.characters;
        else if (type === 'location') list = projectAssets.locations;
        else if (type === 'product') list = projectAssets.products || [];

        if (!list) return null;

        const normalize = (s: string) => s.toLowerCase().replace(/_/g, ' ').trim();
        const searchVal = normalize(storedValue);

        return list.find(a =>
            normalize(a.id || "") === searchVal ||
            normalize(a.name || "") === searchVal
        );
    };

    // [Display Logic] Handle 0 or undefined scene numbers
    const displaySceneNumber = scene.scene_number !== undefined
        ? String(scene.scene_number).padStart(2, '0')
        : "--";

    return (
        <div
            className="group relative bg-[#090909] border border-[#222] rounded-xl flex flex-col justify-between 
            hover:border-neutral-500 hover:shadow-[0_0_15px_rgba(255,255,255,0.05)] 
            transition-all duration-300 cursor-default h-full"
        >
            {/* CARD CONTENT (Padded) */}
            <div className="p-4 flex-1 flex flex-col">

                {/* HEADER */}
                <div className="flex justify-between items-center mb-4 border-b border-[#1a1a1a] pb-3">
                    <span className="text-[11px] font-mono text-red-500 font-bold tracking-widest bg-red-500/10 px-2 py-1 rounded">
                        SCENE {displaySceneNumber}
                    </span>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 text-[9px] text-neutral-400 font-mono bg-[#111] px-2 py-1 rounded border border-[#222]">
                            <Clock size={10} />
                            {scene.time || "N/A"}
                        </div>

                        {/* [NEW] EDIT BUTTON - Integrated in Header */}
                        {(episodeId && projectId) && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation(); // Prevent opening storyboard
                                    router.push(`/project/${projectId}/episode/${episodeId}/editor?scene_id=${scene.id}`);
                                }}
                                className="p-1.5 rounded bg-[#111] border border-[#222] text-[#666] hover:text-white hover:border-[#444] hover:bg-[#222] transition-colors"
                                title="Edit Scene in Script"
                            >
                                <Pencil size={12} />
                            </button>
                        )}
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

                    {/* [NEW] PRODUCTS ROW (Only for Ads) */}
                    {projectType === 'ad' && scene.products && scene.products.length > 0 && (
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
                onClick={() => onOpenStoryboard(scene)}
                className="w-full border-t border-[#222] bg-[#111] text-neutral-400 
                hover:bg-neutral-800 hover:text-white 
                py-3 px-4 rounded-b-xl text-[10px] font-bold tracking-[0.15em] uppercase 
                flex items-center justify-center gap-2 transition-all duration-200 group-hover:border-[#333]"
            >
                <Film size={12} className="group-hover:scale-110 transition-transform" />
                Open Storyboard
            </button>
        </div>
    );
};