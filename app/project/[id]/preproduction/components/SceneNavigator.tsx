"use client";

import React, { useState } from "react";
import { Film, ChevronRight, ChevronLeft, User, MapPin } from "lucide-react";

interface SceneInfo {
    id: string;
    sceneNumber: number;
    title: string;
    characterCount: number;
    locationCount: number;
    position: { x: number; y: number };
}

interface SceneNavigatorProps {
    scenes: SceneInfo[];
    onJumpToScene: (position: { x: number; y: number }) => void;
    activeSceneId?: string;
}

export function SceneNavigator({ scenes, onJumpToScene, activeSceneId }: SceneNavigatorProps) {
    const [collapsed, setCollapsed] = useState(false);

    if (scenes.length === 0) return null;

    return (
        <div
            className={`absolute right-5 top-1/2 -translate-y-1/2 z-[20] flex transition-all duration-300 ease-out ${collapsed ? 'translate-x-[calc(100%-32px)]' : ''
                }`}
        >
            {/* Toggle button */}
            <button
                onClick={() => setCollapsed(!collapsed)}
                className="self-center w-6 h-14 rounded-l-lg bg-[#0C0C0C]/90 backdrop-blur-xl border border-r-0 border-white/[0.06] flex items-center justify-center text-white/30 hover:text-white/60 transition-colors shrink-0"
            >
                {collapsed ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
            </button>

            {/* Scene list */}
            <div className="bg-[#0C0C0C]/90 backdrop-blur-xl border border-white/[0.06] rounded-2xl shadow-2xl overflow-hidden"
                style={{ width: 200 }}
            >
                {/* Header */}
                <div className="px-3 py-2.5 border-b border-white/[0.04]">
                    <div className="flex items-center gap-2">
                        <Film size={10} className="text-white/30" />
                        <span className="text-[8px] font-bold tracking-[3px] uppercase text-white/30">Scenes</span>
                        <span className="ml-auto text-[8px] font-mono text-white/15">{scenes.length}</span>
                    </div>
                </div>

                {/* Scene list */}
                <div className="max-h-[320px] overflow-y-auto scrollbar-thin" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
                    {scenes.map((scene, idx) => {
                        const isActive = scene.id === activeSceneId;
                        return (
                            <button
                                key={scene.id}
                                onClick={() => onJumpToScene(scene.position)}
                                className={`w-full text-left px-3 py-2 transition-all duration-200 cursor-pointer group
                                    ${isActive
                                        ? 'bg-white/[0.06] border-l-2 border-[#E50914]'
                                        : 'border-l-2 border-transparent hover:bg-white/[0.03] hover:border-white/10'
                                    }`}
                                style={{
                                    animation: `nodeEntrance 0.3s ease ${idx * 40}ms both`,
                                }}
                            >
                                <div className="flex items-center gap-2">
                                    <span className={`text-[18px] font-['Anton'] leading-none tracking-tight ${isActive ? 'text-white/20' : 'text-white/[0.06]'}`}>
                                        {String(scene.sceneNumber).padStart(2, "0")}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <span className={`text-[10px] font-bold tracking-wide uppercase block truncate ${isActive ? 'text-white/80' : 'text-white/40 group-hover:text-white/60'}`}>
                                            {scene.title}
                                        </span>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            {scene.characterCount > 0 && (
                                                <span className="flex items-center gap-0.5 text-[8px] text-[#D4A843]/40">
                                                    <User size={7} /> {scene.characterCount}
                                                </span>
                                            )}
                                            {scene.locationCount > 0 && (
                                                <span className="flex items-center gap-0.5 text-[8px] text-[#4A90E2]/40">
                                                    <MapPin size={7} /> {scene.locationCount}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
