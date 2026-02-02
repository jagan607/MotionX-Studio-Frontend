"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { TimelineBoard } from "./TimelineBoard";
import { useEpisodeData } from "../hooks/useEpisodeData";
// import { useShotManager } from "../hooks/useShotManager";

export default function TimelinePage() {
    const params = useParams() as { id: string; episodeId: string };
    const router = useRouter();
    const searchParams = useSearchParams();

    // 1. Load Data
    const { scenes, loading } = useEpisodeData(params.id, params.episodeId);
    const [activeSceneId, setActiveSceneId] = useState<string | null>(null);

    // 2. Set Active Scene
    useEffect(() => {
        if (!loading && scenes.length > 0) {
            const paramId = searchParams.get('sceneId');
            if (paramId) setActiveSceneId(paramId);
            else setActiveSceneId(scenes[0].id);
        }
    }, [loading, scenes, searchParams]);

    // 3. Load Shots
    // const shotMgr = useShotManager(params.id, params.episodeId, activeSceneId);

    if (loading || !activeSceneId) {
        return <div className="h-screen w-screen bg-[#090909] text-white flex items-center justify-center"><Loader2 className="animate-spin mr-2" /> LOADING STUDIO...</div>;
    }

    return (
        <main className="h-screen w-screen bg-[#090909] text-[#EAEAEA] flex flex-col font-sans overflow-hidden">
            {/* Header */}
            <header className="h-14 border-b border-[#222] bg-[#0C0C0C] flex items-center justify-between px-4 z-50">
                <div className="flex items-center gap-4">
                    <button onClick={() => router.back()} className="text-[#666] hover:text-white flex items-center gap-2 text-xs font-bold tracking-wider">
                        <ArrowLeft size={16} /> EXIT
                    </button>
                    <div className="h-4 w-[1px] bg-[#333]" />
                    <h1 className="font-bold text-sm tracking-wide text-gray-300">TIMELINE EDITOR</h1>
                </div>

                {/* Scene Switcher */}
                <select
                    value={activeSceneId}
                    onChange={e => setActiveSceneId(e.target.value)}
                    className="bg-[#1A1A1A] border border-[#333] text-xs px-3 py-1.5 rounded outline-none focus:border-blue-500"
                >
                    {scenes.map(s => <option key={s.id} value={s.id}>SCENE {s.scene_number}</option>)}
                </select>
            </header>

            {/* The Editor */}
            <div className="flex-1 overflow-hidden">
                {/* <TimelineBoard
                    seriesId={params.id}
                    episodeId={params.episodeId}
                    sceneId={activeSceneId}
                    shots={shotMgr.shots}
                /> */}
            </div>
        </main>
    );
}