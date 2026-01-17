"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, Film, Maximize2, Download, Wand2, Image as ImageIcon } from "lucide-react";

interface ShotImageProps {
    src: string;
    videoUrl?: string;
    videoStatus?: 'animating' | 'ready' | 'error';
    shotId: string;
    isSystemLoading: boolean;
    onClickZoom: () => void;
    onDownload: () => void;
    onStartInpaint: () => void;
    onAnimate: () => void;
}

export const ShotImage = ({
    src,
    videoUrl,
    videoStatus,
    onClickZoom,
    onDownload,
    shotId,
    isSystemLoading,
    onStartInpaint,
    onAnimate
}: ShotImageProps) => {
    const [imageFullyDecoded, setImageFullyDecoded] = useState(false);
    const imgRef = useRef<HTMLImageElement>(null);

    // --- STATE CHECKS ---
    const isAnimating = videoStatus === 'animating';
    const hasVideo = Boolean(videoUrl);
    const hasImage = Boolean(src);

    // --- LOADING LOGIC ---
    // Update: isSystemLoading now covers the 'GENERATING...' phase from useShotManager
    const isLoading = isSystemLoading || isAnimating || (!hasVideo && hasImage && !imageFullyDecoded);

    // --- EMPTY STATE ---
    const isEmpty = !hasVideo && !hasImage && !isSystemLoading && !isAnimating;

    // Reset decode state when source changes to prevent flickering old images
    useEffect(() => {
        setImageFullyDecoded(false);
    }, [src]);

    useEffect(() => {
        if (imgRef.current?.complete) setImageFullyDecoded(true);
    }, [src]);

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%', backgroundColor: '#000', overflow: 'hidden' }}>

            {/* --- 1. LOADER OVERLAY --- */}
            {isLoading && (
                <div style={{
                    position: 'absolute', inset: 0, zIndex: 10, backgroundColor: 'rgba(5,5,5,0.9)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
                }}>
                    {/* UPDATED: Using force-spin for continuous rotation */}
                    <Loader2 className="force-spin" size={32} color="#FF0000" />

                    {isAnimating && (
                        <div style={{ marginTop: '15px', textAlign: 'center' }}>
                            <p style={{ color: '#FF0000', fontSize: '10px', fontWeight: 'bold', letterSpacing: '2px', animation: 'pulse 1.5s infinite' }}>
                                ANIMATING...
                            </p>
                            <p style={{ color: '#666', fontSize: '9px', marginTop: '5px', fontFamily: 'monospace' }}>
                                VEO ENGINE V1
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* --- 2. EMPTY STATE (Placeholder) --- */}
            {isEmpty && (
                <div style={{
                    position: 'absolute', inset: 0, zIndex: 5,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: '#050505', color: '#222', border: '1px solid #111'
                }}>
                    <ImageIcon size={32} strokeWidth={1} style={{ opacity: 0.5 }} />
                    <p style={{ marginTop: '10px', fontSize: '9px', fontFamily: 'monospace', letterSpacing: '1px', color: '#333' }}>
                        NO SIGNAL
                    </p>
                </div>
            )}

            {/* --- 3. MEDIA CONTENT --- */}
            {hasVideo ? (
                <video
                    src={videoUrl}
                    controls={false} // Overlay controls used instead
                    autoPlay
                    loop
                    muted
                    playsInline
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 5 }}
                />
            ) : (
                hasImage && (
                    <img
                        ref={imgRef}
                        src={src}
                        alt={`Shot ${shotId}`}
                        style={{
                            position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 5,
                            opacity: imageFullyDecoded ? 1 : 0, transition: 'opacity 0.4s ease-in'
                        }}
                        onLoad={() => setImageFullyDecoded(true)}
                    />
                )
            )}

            {/* --- 4. CONTROLS OVERLAY --- */}
            {!isLoading && !isEmpty && (
                <div style={{ position: 'absolute', top: '10px', right: '10px', display: 'flex', gap: '8px', zIndex: 20 }}>

                    {/* ANIMATE BUTTON (Only for images) */}
                    {!hasVideo && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onAnimate(); }}
                            style={{
                                padding: '6px 12px', backgroundColor: '#FF0000', color: 'white', border: 'none',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                                fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
                            }}
                            title="Generate Video"
                        >
                            <Film size={12} fill="white" /> ANIMATE
                        </button>
                    )}

                    <button onClick={onClickZoom} style={{ padding: '6px', backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid #333', color: 'white', cursor: 'pointer' }}>
                        <Maximize2 size={14} />
                    </button>
                    <button onClick={onDownload} style={{ padding: '6px', backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid #333', color: 'white', cursor: 'pointer' }}>
                        <Download size={14} />
                    </button>

                    {/* INPAINT BUTTON (Images only) */}
                    {!hasVideo && (
                        <button
                            onClick={onStartInpaint}
                            style={{ padding: '6px', backgroundColor: 'rgba(255,0,0,0.8)', border: '1px solid #333', color: 'white', cursor: 'pointer' }}
                            title="Edit Image"
                        >
                            <Wand2 size={14} />
                        </button>
                    )}
                </div>
            )}

            <style>{`
                @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
            `}</style>
        </div>
    );
};