import React from "react";
import { Film, Clock } from "lucide-react"; // Removed FileText
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
    onOpenStoryboard: (sceneId: string) => void;
    // Removed onEditScript prop
}

export const SceneCard: React.FC<SceneCardProps> = ({
    scene,
    projectAssets,
    onOpenStoryboard
}) => {

    // --- HELPER: CHECK ASSET STATUS (Defensive Version) ---
    const getAssetStatus = (name: string, type: 'character' | 'location') => {
        if (!name) return { status: 'missing' as const, imageUrl: undefined };

        const list = type === 'character' ? projectAssets.characters : projectAssets.locations;
        if (!list) return { status: 'missing' as const, imageUrl: undefined };

        // Safe check preventing the .toLowerCase() crash
        const match = list.find(a =>
            a.name && a.name.toLowerCase() === name.toLowerCase()
        );

        return {
            status: match ? ('linked' as const) : ('missing' as const),
            imageUrl: match?.image_url
        };
    };

    const locationStatus = getAssetStatus(scene.location, 'location');

    return (
        <div className="group relative bg-[#090909] border border-[#222] rounded-xl p-4 flex flex-col justify-between hover:border-neutral-600 transition-all duration-300">

            {/* 1. HEADER */}
            <div className="mb-4">
                <div className="flex justify-between items-start mb-1">
                    <span className="text-[10px] font-mono text-motion-red font-bold tracking-widest">
                        SCENE {scene.number}
                    </span>
                    <div className="flex items-center gap-1 text-[9px] text-neutral-500 font-mono">
                        <Clock size={10} />
                        {scene.time || "N/A"}
                    </div>
                </div>
                <h3 className="text-sm font-display font-bold text-white leading-tight uppercase truncate">
                    {scene.slugline || "UNTITLED SCENE"}
                </h3>
            </div>

            {/* 2. BODY */}
            <div className="flex-1 mb-6">
                <p className="text-[11px] text-neutral-400 line-clamp-3 leading-relaxed">
                    {scene.synopsis || "No synopsis available."}
                </p>
            </div>

            {/* 3. ASSETS */}
            <div className="space-y-2 mb-6">
                {scene.location && (
                    <div className="flex items-center gap-2">
                        <span className="text-[9px] text-neutral-600 uppercase tracking-wider w-12 shrink-0">LOC</span>
                        <EntityStatusChip
                            name={scene.location}
                            type="location"
                            status={locationStatus.status}
                            imageUrl={locationStatus.imageUrl}
                        />
                    </div>
                )}

                {scene.characters && scene.characters.length > 0 && (
                    <div className="flex items-start gap-2">
                        <span className="text-[9px] text-neutral-600 uppercase tracking-wider w-12 shrink-0 mt-1">CAST</span>
                        <div className="flex flex-wrap gap-1.5">
                            {scene.characters.map((charName, idx) => {
                                if (!charName) return null;
                                const status = getAssetStatus(charName, 'character');
                                return (
                                    <EntityStatusChip
                                        key={idx}
                                        name={charName}
                                        type="character"
                                        status={status.status}
                                        imageUrl={status.imageUrl}
                                    />
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* 4. FOOTER */}
            <div className="flex items-center gap-2 pt-4 border-t border-[#222] group-hover:border-[#333] transition-colors">
                <button
                    onClick={() => onOpenStoryboard(scene.id)}
                    className="w-full flex items-center justify-center gap-2 bg-white text-black py-2 rounded text-[10px] font-bold tracking-widest hover:bg-motion-red hover:text-white transition-colors"
                >
                    <Film size={12} /> OPEN STORYBOARD
                </button>
            </div>
        </div>
    );
};