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
import { Loader2, Film, Play, Download, RotateCcw, AlertTriangle, RefreshCw, Trash2 } from "lucide-react";
import type { PlaygroundGeneration } from "@/lib/playgroundApi";
import { useMediaViewer } from "@/app/context/MediaViewerContext";
import { usePlayground } from "@/app/context/PlaygroundContext";
import { doc, deleteDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
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

    };

    // Drag image for reference drop — custom large ghost
    const handleDragStart = (e: React.DragEvent) => {
        if (!gen.image_url) return;
        e.dataTransfer.setData("text/plain", gen.image_url);
        e.dataTransfer.setData("application/x-playground-image", gen.image_url);
        e.dataTransfer.effectAllowed = "copy";

        // Build a styled drag preview (120×120 thumbnail + badge)
        const ghost = document.createElement("div");
        ghost.style.cssText = `
            width: 120px; height: 120px; border-radius: 14px; overflow: hidden;
            border: 2px solid rgba(229,9,20,0.5); box-shadow: 0 8px 32px rgba(0,0,0,0.6);
            position: fixed; top: -9999px; left: -9999px;
            display: flex; align-items: center; justify-content: center;
            background: #111;
        `;

        // Thumbnail
        const img = document.createElement("img");
        img.src = gen.image_url;
        img.style.cssText = "width:100%;height:100%;object-fit:cover;opacity:0.9;";
        ghost.appendChild(img);

        // Badge overlay
        const badge = document.createElement("div");
        badge.style.cssText = `
            position:absolute; bottom:6px; right:6px;
            width:28px; height:28px; border-radius:8px;
            background:rgba(229,9,20,0.85); backdrop-filter:blur(4px);
            display:flex; align-items:center; justify-content:center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        `;
        badge.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/><line x1="15" y1="6" x2="15" y2="12"/><line x1="12" y1="9" x2="18" y2="9"/></svg>`;
        ghost.appendChild(badge);

        document.body.appendChild(ghost);
        e.dataTransfer.setDragImage(ghost, 60, 60);

        // Clean up after the browser captures the ghost frame
        requestAnimationFrame(() => {
            setTimeout(() => ghost.remove(), 0);
        });
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

    // Download a specific media type
    const [downloadingType, setDownloadingType] = useState<'image' | 'video' | null>(null);

    const handleDownload = async (e: React.MouseEvent, mediaType: 'image' | 'video') => {
        e.stopPropagation();
        if (downloadingType) return;
        const url = mediaType === 'video' ? gen.video_url : gen.image_url;
        if (!url) return;
        setDownloadingType(mediaType);
        try {
            const res = await fetch(url);
            const blob = await res.blob();
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `playground_${gen.id}.${mediaType === 'video' ? 'mp4' : 'jpg'}`;
            a.click();
            URL.revokeObjectURL(a.href);
        } catch (err) {
            console.error("Download failed:", err);
        } finally {
            setDownloadingType(null);
        }
    };

    // Delete this generation from Firestore
    const [isDeleting, setIsDeleting] = useState(false);
    const handleDelete = async (e: React.MouseEvent) => {
        e.stopPropagation();
        const uid = auth.currentUser?.uid;
        if (isDeleting || !uid) return;
        setIsDeleting(true);
        try {
            await deleteDoc(doc(db, "playgrounds", uid, "generations", gen.id));

        } catch (err) {
            console.error("Delete failed:", err);
            toast.error("Failed to delete generation");
            setIsDeleting(false);
        }
    };

    return (
        <div className="relative rounded-xl overflow-hidden group border border-[#1a1a1a] hover:border-[#333] transition-all duration-200">

            {/* ═══ MEDIA AREA (full card) ═══ */}
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
                            className="w-full h-full object-cover"
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

                        {/* ═══ TOP-LEFT ACTION BUTTONS (hover) ═══ */}
                        <div className="absolute top-2 left-2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            {gen.prompt && (
                                <button
                                    onClick={handleReusePrompt}
                                    className="p-1.5 rounded-md bg-black/60 hover:bg-black/80 text-white/70 hover:text-white transition-all cursor-pointer backdrop-blur-sm"
                                    title="Reuse Prompt"
                                >
                                    <RefreshCw size={12} />
                                </button>
                            )}
                            {hasImage && (
                                <button
                                    onClick={(e) => handleDownload(e, 'image')}
                                    disabled={!!downloadingType}
                                    className="p-1.5 rounded-md bg-black/60 hover:bg-black/80 text-white/70 hover:text-white transition-all cursor-pointer backdrop-blur-sm disabled:opacity-50 disabled:cursor-wait"
                                    title={downloadingType === 'image' ? 'Downloading…' : 'Download Image'}
                                >
                                    {downloadingType === 'image' ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                                </button>
                            )}
                            {hasVideo && (
                                <button
                                    onClick={(e) => handleDownload(e, 'video')}
                                    disabled={!!downloadingType}
                                    className="p-1.5 rounded-md bg-black/60 hover:bg-black/80 text-white/70 hover:text-white transition-all cursor-pointer backdrop-blur-sm disabled:opacity-50 disabled:cursor-wait"
                                    title={downloadingType === 'video' ? 'Downloading…' : 'Download Video'}
                                >
                                    {downloadingType === 'video' ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                                </button>
                            )}
                            <button
                                onClick={handleDelete}
                                disabled={isDeleting}
                                className="p-1.5 rounded-md bg-black/60 hover:bg-red-500/40 text-white/70 hover:text-red-400 transition-all cursor-pointer backdrop-blur-sm disabled:opacity-50 disabled:cursor-wait"
                                title="Delete Generation"
                            >
                                {isDeleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                            </button>
                        </div>

                        {/* ═══ SLIDE-UP OVERLAY: Minimal info + Animate ═══ */}
                        <div className="absolute bottom-0 left-0 right-0 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out">
                            <div className="flex items-center gap-2 px-3 py-2.5 bg-black/85 backdrop-blur-sm">
                                <p className="text-[10px] text-white/60 truncate flex-1 leading-snug">
                                    {gen.prompt || "—"}
                                </p>
                                {!hasVideo && !isAnimating && !isFailed && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setAnimateTarget(gen); }}
                                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#E50914]/15 text-[#E50914] text-[8px] font-bold uppercase tracking-[1.5px] hover:bg-[#E50914]/25 transition-all cursor-pointer shrink-0 border border-[#E50914]/30"
                                    >
                                        <Film size={11} />
                                        Animate
                                    </button>
                                )}
                            </div>
                        </div>
                    </>
                )}

                {/* === STATE: FAILED / ERROR === */}
                {isFailed && !hasImage && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#080808]">
                        <button
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="absolute top-2 right-2 p-1.5 rounded-md bg-white/10 hover:bg-red-500/30 text-white/50 hover:text-red-400 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-wait z-10"
                            title="Delete Generation"
                        >
                            {isDeleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                        </button>
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

                {/* === STATE: ANIMATING (no image — direct video gen) === */}
                {!isGenerating && !isFailed && !hasImage && isAnimating && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#080808]">
                        <div className="absolute inset-0 skeleton-shimmer opacity-20" />
                        <div className="relative z-10 flex flex-col items-center">
                            <div className="w-12 h-12 rounded-xl bg-[#E50914]/10 border border-[#E50914]/20 flex items-center justify-center mb-3">
                                <Loader2 className="animate-spin text-[#E50914]" size={20} />
                            </div>
                            <span className="text-[9px] font-mono text-[#666] uppercase tracking-[3px]">Generating Video…</span>
                            {gen.provider && (
                                <span className="text-[7px] font-mono text-[#444] uppercase tracking-[2px] mt-1">
                                    via {gen.provider}
                                </span>
                            )}
                            {gen.prompt && (
                                <p className="text-[8px] text-[#444] max-w-[180px] text-center leading-relaxed mt-2 truncate">
                                    {gen.prompt.slice(0, 80)}
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {/* === STATE: NO IMAGE YET === */}
                {!isGenerating && !isFailed && !hasImage && !isAnimating && (
                    <div className="absolute inset-0 skeleton-shimmer" />
                )}
            </div>
        </div>
    );
}
