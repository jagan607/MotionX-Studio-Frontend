"use client";

import { useEffect, useState } from "react";
import { useMediaViewer } from "@/app/context/MediaViewerContext";
import { X, ChevronLeft, ChevronRight, Image as ImageIcon, Film, Mic2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

export default function GlobalMediaViewer() {
    const { isOpen, items, currentIndex, closeViewer, nextItem, prevItem } = useMediaViewer();

    // UPDATED: Added 'sync' to the state type
    const [viewMode, setViewMode] = useState<"img" | "vid" | "sync">("img");

    // Get current item
    const currentItem = items[currentIndex];

    // UPDATED: Check for all media types
    // Note: We use optional chaining ?. in case items array is empty momentarily
    const hasVideo = Boolean(currentItem?.videoUrl);
    const hasImage = Boolean(currentItem?.imageUrl);
    const hasLipsync = Boolean(currentItem?.lipsyncUrl);

    // UPDATED: Smart Mode Switching
    useEffect(() => {
        if (!currentItem) return;

        // If current mode is invalid for the new item, switch to an available mode
        if (viewMode === "vid" && !hasVideo) {
            setViewMode(hasLipsync ? "sync" : "img");
        }
        else if (viewMode === "sync" && !hasLipsync) {
            setViewMode(hasVideo ? "vid" : "img");
        }
        else if (viewMode === "img" && !hasImage) {
            setViewMode(hasLipsync ? "sync" : "vid");
        }

        // Optional: If we just opened an item that has a lip-sync but no standard video, 
        // and no image, prioritize showing the media that actually exists.
        if (!hasImage && !hasVideo && hasLipsync && viewMode !== "sync") {
            setViewMode("sync");
        }

    }, [currentIndex, currentItem, viewMode, hasVideo, hasImage, hasLipsync]);

    // Keyboard Navigation
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") closeViewer();
            if (e.key === "ArrowRight") nextItem();
            if (e.key === "ArrowLeft") prevItem();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, nextItem, prevItem, closeViewer]);

    if (!isOpen || !currentItem) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/95 backdrop-blur-sm"
                onClick={(e) => {
                    if (e.target === e.currentTarget) closeViewer();
                }}
            >
                {/* --- HEADER CONTROLS --- */}
                <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-start z-[2001]">

                    {/* TITLE & META */}
                    <div className="text-white">
                        <h2 className="text-sm font-bold font-mono tracking-widest">{currentItem.title || "MEDIA VIEWER"}</h2>
                        <p className="text-[10px] text-gray-500 font-mono mt-1">
                            {currentIndex + 1} / {items.length}
                        </p>
                    </div>

                    {/* UPDATED: IMG / VID / SYNC TOGGLE */}
                    <div className="flex bg-[#111] border border-[#333] rounded-full p-1 gap-1">

                        {/* IMAGE BUTTON */}
                        <button
                            onClick={() => setViewMode("img")}
                            disabled={!hasImage}
                            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-bold font-mono transition-all
                                ${viewMode === "img" ? "bg-[#333] text-white" : "text-gray-500 hover:text-white"}
                                ${!hasImage ? "opacity-30 cursor-not-allowed hidden" : "cursor-pointer"} 
                            `}
                        >
                            <ImageIcon size={12} /> IMG
                        </button>

                        {/* VIDEO BUTTON */}
                        <button
                            onClick={() => setViewMode("vid")}
                            disabled={!hasVideo}
                            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-bold font-mono transition-all
                                ${viewMode === "vid" ? "bg-[#E50914] text-white" : "text-gray-500 hover:text-white"}
                                ${!hasVideo ? "opacity-30 cursor-not-allowed hidden" : "cursor-pointer"}
                            `}
                        >
                            <Film size={12} /> VID
                        </button>

                        {/* SYNC BUTTON (NEW) */}
                        <button
                            onClick={() => setViewMode("sync")}
                            disabled={!hasLipsync}
                            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-bold font-mono transition-all
                                ${viewMode === "sync" ? "bg-[#00FF41] text-black" : "text-gray-500 hover:text-white"}
                                ${!hasLipsync ? "opacity-30 cursor-not-allowed hidden" : "cursor-pointer"}
                            `}
                        >
                            <Mic2 size={12} /> SYNC
                        </button>
                    </div>

                    {/* CLOSE BUTTON */}
                    <button
                        onClick={closeViewer}
                        className="p-2 hover:bg-[#222] rounded-full text-white transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* --- NAVIGATION ARROWS --- */}
                {currentIndex > 0 && (
                    <button
                        onClick={(e) => { e.stopPropagation(); prevItem(); }}
                        className="absolute left-6 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-[#E50914] border border-white/10 hover:border-[#E50914] rounded-full text-white transition-all duration-200 z-[2001] backdrop-blur-md group"
                    >
                        <ChevronLeft size={32} strokeWidth={2} className="group-hover:scale-110 transition-transform" />
                    </button>
                )}

                {currentIndex < items.length - 1 && (
                    <button
                        onClick={(e) => { e.stopPropagation(); nextItem(); }}
                        className="absolute right-6 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-[#E50914] border border-white/10 hover:border-[#E50914] rounded-full text-white transition-all duration-200 z-[2001] backdrop-blur-md group"
                    >
                        <ChevronRight size={32} strokeWidth={2} className="group-hover:scale-110 transition-transform" />
                    </button>
                )}

                {/* --- MEDIA CONTENT --- */}
                <div className="relative w-full h-full p-12 flex items-center justify-center">

                    {viewMode === "img" && currentItem.imageUrl ? (
                        <img
                            src={currentItem.imageUrl}
                            alt="Full Screen"
                            className="max-w-full max-h-full object-contain shadow-2xl"
                        />
                    ) : viewMode === "vid" && currentItem.videoUrl ? (
                        <video
                            src={currentItem.videoUrl}
                            controls
                            autoPlay
                            loop
                            className="max-w-full max-h-full object-contain shadow-2xl"
                        />
                    ) : viewMode === "sync" && currentItem.lipsyncUrl ? (
                        // NEW: Lip Sync Player
                        <video
                            src={currentItem.lipsyncUrl}
                            controls
                            autoPlay
                            loop
                            className="max-w-full max-h-full object-contain shadow-2xl border border-green-500/30"
                        />
                    ) : (
                        <div className="text-gray-500 font-mono text-sm">MEDIA NOT AVAILABLE</div>
                    )}
                </div>

            </motion.div>
        </AnimatePresence>
    );
}