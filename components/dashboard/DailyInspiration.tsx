"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { fetchCommunityFeed } from "@/lib/api";
import { Sparkles, ArrowRight, Play, RefreshCw } from "lucide-react";

interface CommunityShot {
    id: string;
    image_url: string;
    video_url?: string;
    prompt: string;
    shot_type?: string;
    creator?: string;
    project_title?: string;
}

export default function DailyInspiration() {
    const router = useRouter();
    const [shot, setShot] = useState<CommunityShot | null>(null);
    const [loading, setLoading] = useState(true);

    const pickRandom = (shots: CommunityShot[]) => {
        const today = new Date().toDateString();
        const seed = today.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
        return shots[seed % shots.length] || shots[0];
    };

    const load = async (forceRandom = false) => {
        try {
            const data = await fetchCommunityFeed();
            const all: CommunityShot[] = Array.isArray(data) ? data : data?.shots || [];
            if (all.length > 0) {
                setShot(forceRandom ? all[Math.floor(Math.random() * all.length)] : pickRandom(all));
            }
        } catch (e) {
            console.error("[DailyInspiration] Failed:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    if (loading || !shot) return null;

    return (
        <div className="shrink-0">
            <div className="flex items-center justify-between mb-2 px-1">
                <div className="flex items-center gap-2">
                    <Sparkles size={11} className="text-[#E50914]" />
                    <span className="text-[10px] font-bold tracking-[2px] uppercase text-white/40">Daily Inspiration</span>
                </div>
                <button onClick={() => { setLoading(true); load(true); }}
                    className="flex items-center gap-1 text-[9px] font-bold text-white/20 hover:text-white/50 uppercase tracking-[1px] cursor-pointer bg-transparent border-none transition-colors">
                    <RefreshCw size={9} /> Refresh
                </button>
            </div>

            {/* Compact horizontal card */}
            <div className="group flex items-stretch rounded-xl overflow-hidden border border-white/[0.04] hover:border-white/[0.1] transition-all bg-[#0a0a0a] h-[100px] sm:h-[110px]">
                {/* Thumbnail — fixed width */}
                <div className="relative w-[160px] sm:w-[190px] shrink-0 overflow-hidden bg-black">
                    <img src={shot.image_url} alt="" className="w-full h-full object-cover opacity-70 group-hover:opacity-100 group-hover:scale-[1.05] transition-all duration-500" loading="lazy" />
                    {shot.video_url && (
                        <div className="absolute top-1.5 left-1.5 bg-[#E50914]/80 backdrop-blur-sm px-1.5 py-0.5 rounded-full flex items-center gap-1">
                            <Play size={6} fill="white" className="text-white" />
                            <span className="text-[6px] font-bold uppercase text-white">Video</span>
                        </div>
                    )}
                </div>

                {/* Info — flexible */}
                <div className="flex-1 p-3 sm:p-4 flex flex-col justify-between min-w-0">
                    <p className="text-[10px] sm:text-[11px] text-white/35 leading-relaxed line-clamp-2 font-light">
                        &ldquo;{shot.prompt}&rdquo;
                    </p>
                    <div className="flex items-center justify-between mt-auto">
                        <div className="flex gap-1.5">
                            {shot.shot_type && (
                                <span className="text-[6px] font-bold uppercase tracking-[1px] text-white/15 bg-white/[0.03] border border-white/[0.06] px-1.5 py-0.5 rounded-full">{shot.shot_type}</span>
                            )}
                            <span className="text-[6px] font-bold uppercase tracking-[1px] text-[#E50914]/30 bg-[#E50914]/[0.05] border border-[#E50914]/10 px-1.5 py-0.5 rounded-full">Community</span>
                            {shot.creator && (
                                <span className="text-[7px] text-white/25 font-medium ml-1">by <span className="text-white/40">{shot.creator}</span></span>
                            )}
                        </div>
                        <button
                            onClick={() => router.push(`/playground?idea=${encodeURIComponent(shot.prompt || "")}`)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[8px] font-bold uppercase tracking-[1px] border-none cursor-pointer transition-all hover:scale-[1.03] active:scale-[0.97] shrink-0"
                            style={{ background: "linear-gradient(135deg, #E50914, #B30710)" }}>
                            <Sparkles size={8} /> Try Prompt <ArrowRight size={8} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
