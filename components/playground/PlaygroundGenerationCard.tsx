"use client";

/**
 * PlaygroundGenerationCard — Individual generation card component.
 *
 * Handles three visual states:
 *   1. Generating: animated skeleton shimmer + spinner
 *   2. Rendered: image display with hover-preview of video
 *   3. Error/Failed: error state with optional retry
 *
 * Also handles the video animation overlay state.
 */

import { useState, useRef } from "react";
import { Loader2, Film, Play, Download, RotateCcw, AlertTriangle, RefreshCw } from "lucide-react";
import type { PlaygroundGeneration } from "@/lib/playgroundApi";
import { useMediaViewer } from "@/app/context/MediaViewerContext";
import { usePlayground } from "@/app/context/PlaygroundContext";
import toast from "react-hot-toast";

interface PlaygroundGenerationCardProps {
    generation: PlaygroundGeneration;
}

export default function PlaygroundGenerationCard({ generation: gen }: PlaygroundGenerationCardProps) {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const [videoHovered, setVideoHovered] = useState(false);
    const { openViewer } = useMediaViewer();
    const { setPendingPrompt, setAnimateTarget } = usePlayground();

    const isGenerating = gen.status === "generating";
    const isFailed = gen.status === "failed" || gen.status === "error";
    const isAnimating = gen.video_status === "animating";
    const hasVideo = !!gen.video_url;
    const hasImage = !!gen.image_url;

    // Reuse this generation's prompt in the prompt bar
    const handleReusePrompt = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!gen.prompt) return;
        setPendingPrompt(gen.prompt);
        toast.success("Prompt loaded into input");
    };

    // Drag image for reference drop
    const handleDragStart = (e: React.DragEvent) => {
        if (!gen.image_url) return;
        e.dataTransfer.setData("text/plain", gen.image_url);
        e.dataTransfer.setData("application/x-playground-image", gen.image_url);
        e.dataTransfer.effectAllowed = "copy";
    };

    // Open fullscreen media viewer on click
    const handleMediaClick = () => {
        if (!hasImage && !hasVideo) return;

        openViewer([{
            id: gen.id,
            type: hasVideo ? "mixed" : "image",
            imageUrl: gen.image_url,
            videoUrl: gen.video_url,
            title: gen.prompt?.slice(0, 60) || "Generation",
            description: `${gen.shot_type || "Shot"} • ${gen.provider || "AI"} • ${gen.aspect_ratio || "16:9"}`,
        }], 0);
    };

    // Download the generated image
    const handleDownload = async (e: React.MouseEvent) => {
        e.stopPropagation();
        const url = gen.video_url || gen.image_url;
        if (!url) return;
        try {
            const res = await fetch(url);
            const blob = await res.blob();
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `playground_${gen.id}.${gen.video_url ? "mp4" : "jpg"}`;
            a.click();
            URL.revokeObjectURL(a.href);
        } catch (err) {
            console.error("Download failed:", err);
        }
    };

    return (
        <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl overflow-hidden group hover:border-[#333] transition-all duration-200">

            {/* ═══ MEDIA AREA ═══ */}
            <div
                className="aspect-video bg-black relative cursor-pointer overflow-hidden"
                onClick={handleMediaClick}
                onMouseEnter={() => {
                    if (hasVideo && videoRef.current) {
                        setVideoHovered(true);
                        if (!videoRef.current.src) videoRef.current.src = gen.video_url!;
                        videoRef.current.play().catch(() => {});
                    }
                }}
                onMouseLeave={() => {
                    if (videoRef.current) {
                        setVideoHovered(false);
                        videoRef.current.pause();
                        videoRef.current.currentTime = 0;
                    }
                }}
            >
                {/* === STATE: GENERATING === */}
                {isGenerating && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#080808]">
                        {/* Animated shimmer background */}
                        <div className="absolute inset-0 skeleton-shimmer opacity-30" />
                        <div className="relative z-10 flex flex-col items-center">
                            <div className="w-12 h-12 rounded-xl bg-[#E50914]/10 border border-[#E50914]/20 flex items-center justify-center mb-3">
                                <Loader2 className="animate-spin text-[#E50914]" size={20} />
                            </div>
                            <span className="text-[9px] font-mono text-[#666] uppercase tracking-[3px]">Generating…</span>
                            {gen.provider && (
                                <span className="text-[7px] font-mono text-[#444] uppercase tracking-[2px] mt-1">
                                    via {gen.provider}
                                </span>
                            )}
                        </div>
                    </div>
                )}

                {/* === STATE: RENDERED IMAGE === */}
                {!isGenerating && hasImage && (
                    <>
                        <img
                            src={gen.image_url}
                            alt={gen.prompt || "Generated image"}
                            className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity duration-300"
                            loading="lazy"
                            draggable
                            onDragStart={handleDragStart}
                        />

                        {/* Video hover-preview overlay */}
                        {hasVideo && (
                            <>
                                <video
                                    ref={videoRef}
                                    loop
                                    muted
                                    playsInline
                                    preload="none"
                                    className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
                                        videoHovered ? "opacity-100" : "opacity-0"
                                    }`}
                                />
                                {/* Video badge */}
                                <div className="absolute top-2 right-2 bg-black/70 p-1.5 rounded-md backdrop-blur-sm flex items-center gap-1">
                                    <Film size={9} className="text-[#E50914]" />
                                    <span className="text-[7px] font-mono text-white/70 uppercase">Video</span>
                                </div>
                            </>
                        )}

                        {/* Play icon for video on hover */}
                        {hasVideo && !videoHovered && (
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="w-10 h-10 rounded-full bg-black/60 border border-white/20 flex items-center justify-center backdrop-blur-sm">
                                    <Play size={16} className="text-white ml-0.5" fill="white" />
                                </div>
                            </div>
                        )}

                        {/* Animating overlay */}
                        {isAnimating && (
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-[2px]">
                                <div className="flex items-center gap-2 bg-black/80 px-4 py-2 rounded-lg border border-[#E50914]/30">
                                    <Loader2 className="animate-spin text-[#E50914]" size={14} />
                                    <span className="text-[9px] font-mono text-white uppercase tracking-[2px]">Animating…</span>
                                </div>
                            </div>
                        )}

                        <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-end gap-1.5">
                            {/* Reuse prompt */}
                            {gen.prompt && (
                                <button
                                    onClick={handleReusePrompt}
                                    className="p-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-all cursor-pointer"
                                    title="Reuse Prompt"
                                >
                                    <RefreshCw size={12} />
                                </button>
                            )}
                            <button
                                onClick={handleDownload}
                                className="p-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-all cursor-pointer"
                                title="Download"
                            >
                                <Download size={12} />
                            </button>
                        </div>
                    </>
                )}

                {/* === STATE: FAILED / ERROR === */}
                {isFailed && !hasImage && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#080808]">
                        <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-3">
                            <AlertTriangle size={20} className="text-red-400" />
                        </div>
                        <span className="text-[9px] font-mono text-red-400 uppercase tracking-[2px] mb-1">
                            {gen.error_code || "Generation Failed"}
                        </span>
                        {gen.error_message && (
                            <span className="text-[8px] text-[#555] max-w-[160px] text-center leading-relaxed">
                                {gen.error_message}
                            </span>
                        )}
                    </div>
                )}

                {/* === STATE: NO IMAGE YET (not generating, not failed — edge case) === */}
                {!isGenerating && !isFailed && !hasImage && (
                    <div className="absolute inset-0 skeleton-shimmer" />
                )}
            </div>

            {/* ═══ PRIMARY ANIMATE CTA (image-only state) ═══ */}
            {hasImage && !hasVideo && !isAnimating && !isFailed && (
                <button
                    onClick={() => setAnimateTarget(gen)}
                    aria-label={`Animate generation ${gen.id}`}
                    className="w-full flex items-center justify-center gap-2 py-2 bg-white/[0.04] text-[#999] text-[9px] font-bold uppercase tracking-[2px] border-t border-white/[0.06] hover:bg-[#E50914]/15 hover:text-[#E50914] active:bg-[#E50914]/10 transition-all duration-200 cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#E50914]/30"
                >
                    <Film size={13} />
                    Animate
                </button>
            )}

            {/* ═══ METADATA FOOTER ═══ */}
            <div className="p-3 border-t border-[#111]">
                <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                        <span className="text-[8px] font-mono text-[#555] uppercase tracking-[1px]">
                            {gen.shot_type || "—"}
                        </span>
                        {gen.aspect_ratio && (
                            <span className="text-[7px] font-mono text-[#333] bg-white/[0.03] px-1.5 py-0.5 rounded">
                                {gen.aspect_ratio}
                            </span>
                        )}
                    </div>
                    <span className={`text-[7px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ${
                        gen.status === "completed"
                            ? "bg-green-500/10 text-green-400 border border-green-500/20"
                            : gen.status === "generating"
                            ? "bg-[#E50914]/10 text-[#E50914] border border-[#E50914]/20 animate-pulse"
                            : isFailed
                            ? "bg-red-500/10 text-red-400 border border-red-500/20"
                            : "bg-white/5 text-[#555] border border-white/10"
                    }`}>
                        {gen.status}
                    </span>
                </div>
                <p className="text-[10px] text-[#777] line-clamp-2 leading-relaxed">
                    {gen.prompt || "—"}
                </p>
                {gen.provider && (
                    <div className="flex items-center gap-1.5 mt-1.5">
                        <span className="text-[7px] font-mono text-[#333] uppercase tracking-[1px]">
                            {gen.provider} • {gen.model_tier || "auto"}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}
