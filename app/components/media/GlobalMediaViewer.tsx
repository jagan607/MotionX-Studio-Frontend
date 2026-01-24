"use client";

import { useEffect, useState } from "react";
import { useMediaViewer } from "@/app/context/MediaViewerContext";
import { X, ChevronLeft, ChevronRight, Image as ImageIcon, Film } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

export default function GlobalMediaViewer() {
    const { isOpen, items, currentIndex, closeViewer, nextItem, prevItem } = useMediaViewer();
    const [viewMode, setViewMode] = useState<"img" | "vid">("img");

    // Get current item
    const currentItem = items[currentIndex];

    // Reset view mode when changing items (optional logic: reset to img if vid doesn't exist)
    useEffect(() => {
        if (!currentItem) return;
        // If we are in VID mode but new item has no video, switch to IMG
        if (viewMode === "vid" && !currentItem.videoUrl) {
            setViewMode("img");
        }
    }, [currentIndex, currentItem, viewMode]);

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

    const hasVideo = Boolean(currentItem.videoUrl);
    const hasImage = Boolean(currentItem.imageUrl);

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/95 backdrop-blur-sm"
                onClick={(e) => {
                    // Close if clicking the backdrop directly (not children)
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

                    {/* IMG / VID TOGGLE (Only if both exist or we want to force check) */}
                    <div className="flex bg-[#111] border border-[#333] rounded-full p-1 gap-1">
                        <button
                            onClick={() => setViewMode("img")}
                            disabled={!hasImage}
                            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-bold font-mono transition-all
                                ${viewMode === "img" ? "bg-[#333] text-white" : "text-gray-500 hover:text-white"}
                                ${!hasImage ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}
                            `}
                        >
                            <ImageIcon size={12} /> IMG
                        </button>
                        <button
                            onClick={() => setViewMode("vid")}
                            disabled={!hasVideo}
                            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-bold font-mono transition-all
                                ${viewMode === "vid" ? "bg-[#FF0000] text-white" : "text-gray-500 hover:text-white"}
                                ${!hasVideo ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}
                            `}
                        >
                            <Film size={12} /> VID
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
                        className="absolute left-6 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-[#FF0000] border border-white/10 hover:border-[#FF0000] rounded-full text-white transition-all duration-200 z-[2001] backdrop-blur-md group"
                    >
                        <ChevronLeft size={32} strokeWidth={2} className="group-hover:scale-110 transition-transform" />
                    </button>
                )}

                {currentIndex < items.length - 1 && (
                    <button
                        onClick={(e) => { e.stopPropagation(); nextItem(); }}
                        className="absolute right-6 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-[#FF0000] border border-white/10 hover:border-[#FF0000] rounded-full text-white transition-all duration-200 z-[2001] backdrop-blur-md group"
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
                            className="max-w-full max-h-full object-contain shadow-2xl"
                        />
                    ) : (
                        <div className="text-gray-500 font-mono text-sm">MEDIA NOT AVAILABLE</div>
                    )}
                </div>

            </motion.div>
        </AnimatePresence>
    );
}