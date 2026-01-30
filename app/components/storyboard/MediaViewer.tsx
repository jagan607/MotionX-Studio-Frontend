"use client";

import { useEffect, useState, useCallback } from "react";
import { X, ChevronLeft, ChevronRight, Image as ImageIcon, Film, Mic2 } from "lucide-react";
import { useMediaViewer } from "@/app/context/MediaViewerContext";

export const MediaViewer = () => {
    const { isOpen, closeViewer, items, currentIndex, nextItem, prevItem } = useMediaViewer();
    const [activeMode, setActiveMode] = useState<'image' | 'video' | 'lipsync'>('image');

    const currentItem = items[currentIndex];

    // Reset mode when item changes based on what media is available
    useEffect(() => {
        if (!currentItem) return;

        if (currentItem.lipsyncUrl) {
            setActiveMode('lipsync');
        } else if (currentItem.videoUrl) {
            setActiveMode('video');
        } else {
            setActiveMode('image');
        }
    }, [currentIndex, currentItem]);

    // Handle keyboard navigation
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight') nextItem();
            if (e.key === 'ArrowLeft') prevItem();
            if (e.key === 'Escape') closeViewer();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, nextItem, prevItem, closeViewer]);

    if (!isOpen || !currentItem) return null;

    // Determine what to display based on active mode
    let displayUrl = currentItem.imageUrl;
    let isVideo = false;

    if (activeMode === 'lipsync' && currentItem.lipsyncUrl) {
        displayUrl = currentItem.lipsyncUrl;
        isVideo = true;
    } else if (activeMode === 'video' && currentItem.videoUrl) {
        displayUrl = currentItem.videoUrl;
        isVideo = true;
    }

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            backgroundColor: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(10px)',
            display: 'flex', flexDirection: 'column'
        }}>

            {/* Header */}
            <div style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', color: 'white', alignItems: 'flex-start' }}>
                <div>
                    <h3 style={{ fontFamily: 'Anton, sans-serif', fontSize: '20px', letterSpacing: '1px', textTransform: 'uppercase' }}>
                        {currentItem.title || "MEDIA PREVIEW"}
                    </h3>
                    {currentItem.description && (
                        <p style={{ fontSize: '12px', color: '#888', marginTop: '4px', maxWidth: '600px' }}>
                            {currentItem.description.length > 100 ? currentItem.description.substring(0, 100) + '...' : currentItem.description}
                        </p>
                    )}
                    <p style={{ fontSize: '10px', color: '#555', marginTop: '4px' }}>
                        {currentIndex + 1} / {items.length}
                    </p>
                </div>
                <X onClick={closeViewer} className="cursor-pointer hover:text-red-500 transition-colors" size={32} />
            </div>

            {/* Main Content Stage */}
            <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>

                {/* Prev Button */}
                <button
                    onClick={(e) => { e.stopPropagation(); prevItem(); }}
                    disabled={currentIndex === 0}
                    style={{
                        position: 'absolute', left: 20, color: 'white', background: 'none', border: 'none',
                        opacity: currentIndex === 0 ? 0.2 : 1, cursor: currentIndex === 0 ? 'default' : 'pointer', zIndex: 10
                    }}
                >
                    <ChevronLeft size={48} />
                </button>

                {/* Media Container */}
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 80px' }}>
                    {isVideo ? (
                        <video
                            key={displayUrl} // Force re-render when switching sources
                            src={displayUrl}
                            controls
                            autoPlay
                            loop
                            style={{ maxHeight: '100%', maxWidth: '100%', boxShadow: '0 0 50px rgba(0,0,0,0.5)', outline: 'none' }}
                        />
                    ) : (
                        <img
                            src={displayUrl}
                            alt="Shot"
                            style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain', boxShadow: '0 0 50px rgba(0,0,0,0.5)' }}
                        />
                    )}
                </div>

                {/* Next Button */}
                <button
                    onClick={(e) => { e.stopPropagation(); nextItem(); }}
                    disabled={currentIndex === items.length - 1}
                    style={{
                        position: 'absolute', right: 20, color: 'white', background: 'none', border: 'none',
                        opacity: currentIndex === items.length - 1 ? 0.2 : 1, cursor: currentIndex === items.length - 1 ? 'default' : 'pointer', zIndex: 10
                    }}
                >
                    <ChevronRight size={48} />
                </button>
            </div>

            {/* Mode Toggle Bar (Bottom Center) */}
            <div style={{ height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px' }}>

                {/* Image Toggle */}
                {currentItem.imageUrl && (
                    <button
                        onClick={() => setActiveMode('image')}
                        style={{
                            padding: '10px 24px', borderRadius: '30px',
                            border: activeMode === 'image' ? '1px solid #FFF' : '1px solid #333',
                            backgroundColor: activeMode === 'image' ? '#FFF' : 'transparent',
                            color: activeMode === 'image' ? '#000' : '#888',
                            fontSize: '11px', fontWeight: 'bold', display: 'flex', gap: '8px', alignItems: 'center', cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        <ImageIcon size={16} /> STATIC FRAME
                    </button>
                )}

                {/* Video Toggle */}
                {currentItem.videoUrl && (
                    <button
                        onClick={() => setActiveMode('video')}
                        style={{
                            padding: '10px 24px', borderRadius: '30px',
                            border: activeMode === 'video' ? '1px solid #FF0000' : '1px solid #333',
                            backgroundColor: activeMode === 'video' ? '#FF0000' : 'transparent',
                            color: activeMode === 'video' ? '#FFF' : '#888',
                            fontSize: '11px', fontWeight: 'bold', display: 'flex', gap: '8px', alignItems: 'center', cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        <Film size={16} /> MOTION VIDEO
                    </button>
                )}

                {/* Lip Sync Toggle */}
                {currentItem.lipsyncUrl && (
                    <button
                        onClick={() => setActiveMode('lipsync')}
                        style={{
                            padding: '10px 24px', borderRadius: '30px',
                            border: activeMode === 'lipsync' ? '1px solid #00FF41' : '1px solid #333',
                            backgroundColor: activeMode === 'lipsync' ? '#00FF41' : 'transparent',
                            color: activeMode === 'lipsync' ? '#000' : '#888',
                            fontSize: '11px', fontWeight: 'bold', display: 'flex', gap: '8px', alignItems: 'center', cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        <Mic2 size={16} /> LIP SYNC
                    </button>
                )}
            </div>
        </div>
    );
};