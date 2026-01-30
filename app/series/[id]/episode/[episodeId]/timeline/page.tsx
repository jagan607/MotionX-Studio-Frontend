"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, Layers } from "lucide-react";
import { TimelineBoard } from "./TimelineBoard";
import { useEpisodeData } from "../hooks/useEpisodeData";
import { useShotManager } from "../hooks/useShotManager";

export default function TimelinePage() {
    const { id: seriesId, episodeId } = useParams() as { id: string; episodeId: string };
    const router = useRouter();
    const searchParams = useSearchParams();

    // 1. Fetch Episode Scenes
    const { scenes, loading: episodeLoading } = useEpisodeData(seriesId, episodeId);

    // 2. Determine Active Scene (Default to first or from URL)
    const [activeSceneId, setActiveSceneId] = useState<string | null>(null);

    useEffect(() => {
        if (!episodeLoading && scenes.length > 0) {
            const paramId = searchParams.get('sceneId');
            if (paramId && scenes.find(s => s.id === paramId)) {
                setActiveSceneId(paramId);
            } else {
                setActiveSceneId(scenes[0].id);
            }
        }
    }, [episodeLoading, scenes, searchParams]);

    // 3. Fetch Shots for Active Scene
    const shotMgr = useShotManager(seriesId, episodeId, activeSceneId);

    if (episodeLoading || !activeSceneId) {
        return (
            <div className="h-screen w-screen bg-[#050505] flex items-center justify-center text-[#444] gap-2 font-mono uppercase tracking-widest">
                <Loader2 className="animate-spin" size={16} /> Loading Studio...
            </div>
        );
    }

    return (
        <main className="h-screen w-screen bg-[#050505] flex flex-col overflow-hidden text-[#EDEDED] font-sans selection:bg-[#FF0000] selection:text-white">

            {/* HEADER */}
            <header className="h-14 border-b border-[#222] bg-[#080808] flex items-center justify-between px-6 z-20 shrink-0">
                <div className="flex items-center gap-6">
                    <button
                        onClick={() => router.back()}
                        className="text-[#666] hover:text-white flex items-center gap-2 text-xs font-bold font-mono tracking-wider transition-colors"
                    >
                        <ArrowLeft size={16} /> EXIT
                    </button>
                    <div className="h-4 w-[1px] bg-[#333]" />
                    <div>
                        <h1 className="font-anton text-xl uppercase tracking-wide leading-none">
                            Timeline Editor
                        </h1>
                        <p className="text-[10px] text-[#555] font-mono mt-1">
                            {scenes.find(s => s.id === activeSceneId)?.scene_number} • {scenes.find(s => s.id === activeSceneId)?.header || "SCENE"}
                        </p>
                    </div>
                </div>

                {/* SCENE SELECTOR */}
                <div className="flex items-center gap-3">
                    <Layers size={14} className="text-[#444]" />
                    <select
                        value={activeSceneId}
                        onChange={(e) => setActiveSceneId(e.target.value)}
                        className="bg-[#111] border border-[#333] text-xs font-bold text-[#CCC] px-3 py-1.5 rounded outline-none focus:border-[#666]"
                    >
                        {scenes.map(s => (
                            <option key={s.id} value={s.id}>
                                SCENE {s.scene_number}: {s.header || "UNTITLED"}
                            </option>
                        ))}
                    </select>
                </div>
            </header>

            {/* EDITOR BOARD */}
            <div className="flex-1 overflow-hidden relative">
                {/* We pass a key to force re-mount when switching scenes */}
                <TimelineBoard
                    key={activeSceneId}
                    seriesId={seriesId}
                    episodeId={episodeId}
                    shots={shotMgr.shots}
                />
            </div>
        </main>
    );
}