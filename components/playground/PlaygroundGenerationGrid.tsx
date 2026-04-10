"use client";

/**
 * PlaygroundGenerationGrid — Masonry-style grid for the generation feed.
 *
 * Receives generations from PlaygroundContext (real-time via Firestore onSnapshot)
 * and renders them as PlaygroundGenerationCard components.
 * Handles loading, empty, and populated states.
 */

import { Loader2, Zap } from "lucide-react";
import PlaygroundGenerationCard from "@/components/playground/PlaygroundGenerationCard";
import type { PlaygroundGeneration } from "@/lib/playgroundApi";

interface PlaygroundGenerationGridProps {
    generations: PlaygroundGeneration[];
    loading: boolean;
}

export default function PlaygroundGenerationGrid({
    generations,
    loading,
}: PlaygroundGenerationGridProps) {

    // === LOADING STATE ===
    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="flex flex-col items-center">
                    <Loader2 className="animate-spin text-[#333] mb-3" size={28} />
                    <span className="text-[9px] font-mono text-[#444] uppercase tracking-[3px]">
                        Loading generations…
                    </span>
                </div>
            </div>
        );
    }

    // === EMPTY STATE ===
    if (generations.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
                <div className="w-20 h-20 rounded-2xl bg-[#0a0a0a] border border-[#1a1a1a] flex items-center justify-center mb-5">
                    <Zap size={32} className="text-[#222]" />
                </div>
                <h3 className="text-lg font-bold text-white/80 mb-2">Create your first generation</h3>
                <p className="text-[12px] text-[#555] max-w-[360px] leading-relaxed">
                    Type a prompt below, tag your assets with{" "}
                    <span className="text-[#E50914] font-mono font-bold">@</span>, and hit{" "}
                    <span className="text-white/80 font-semibold">Generate</span> to bring your ideas to life.
                </p>
                <div className="flex items-center gap-3 mt-6">
                    {["@Character", "@Location", "@Product"].map((tag) => (
                        <span
                            key={tag}
                            className="text-[9px] font-mono text-[#E50914]/60 bg-[#E50914]/5 border border-[#E50914]/10 px-2.5 py-1 rounded-md"
                        >
                            {tag}
                        </span>
                    ))}
                </div>
            </div>
        );
    }

    // === POPULATED GRID ===
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 auto-rows-max">
            {generations.map((gen) => (
                <PlaygroundGenerationCard key={gen.id} generation={gen} />
            ))}
        </div>
    );
}
