"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, Film, Maximize2, Download, Wand2 } from "lucide-react";

interface ShotImageProps {
    src: string;
    videoUrl?: string;
    videoStatus?: 'animating' | 'ready' | 'error';
    shotId: string;
    isSystemLoading: boolean;
    onClickZoom: () => void;
    onDownload: () => void;
    onStartInpaint: (url: string) => void;
    onAnimate: () => void;
}

// Ensure "export const" is used here so the named import { ShotImage } works
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

    // Status Checks
    const isAnimating = videoStatus === 'animating';
    const isVideoReady = Boolean(videoUrl);

    useEffect(() => { setImageFullyDecoded(false); }, [src]);
    useEffect(() => { if (imgRef.current?.complete) setImageFullyDecoded(true); }, [src]);

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%', backgroundColor: '#000', overflow: 'hidden' }}>

            {/* --- 1. LOADER OVERLAY --- 
                Shows if:
                - System is generating the initial image
                - Image isn't loaded yet
                - Video is currently animating
            */}
            {(isSystemLoading || !imageFullyDecoded || isAnimating) && (
                <div style={{
                    position: 'absolute', inset: 0, zIndex: 10, backgroundColor: 'rgba(5,5,5,0.9)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
                }}>
                    <Loader2 className="spin-loader" size={32} color="#FF0000" />

                    {isAnimating && (
                        <div style={{ marginTop: '15px', textAlign: 'center' }}>
                            <p style={{ color: '#FF0000', fontSize: '10px', fontWeight: 'bold', letterSpacing: '2px', animation: 'pulse 1.5s infinite' }}>
                                ANIMATING...
                            </p>
                            <p style={{ color: '#666', fontSize: '9px', marginTop: '5px', fontFamily: 'monospace' }}>
                                SEEDANCE 1.5 PRO
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* --- 2. MEDIA CONTENT --- */}
            {isVideoReady ? (
                // VIDEO PLAYER
                <video
                    src={videoUrl}
                    controls
                    autoPlay
                    loop
                    muted
                    playsInline
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 5 }}
                />
            ) : (
                // STATIC IMAGE
                src && (
                    <img
                        ref={imgRef}
                        src={src}
                        alt={`Shot ${shotId}`}
                        style={{
                            position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 5,
                            opacity: imageFullyDecoded ? 1 : 0, transition: 'opacity 0.3s ease-in'
                        }}
                        onLoad={() => setImageFullyDecoded(true)}
                    />
                )
            )}

            {/* --- 3. CONTROLS OVERLAY --- */}
            {/* Only show controls if not currently animating/loading */}
            {!isAnimating && imageFullyDecoded && (
                <div style={{ position: 'absolute', top: '10px', right: '10px', display: 'flex', gap: '8px', zIndex: 20 }}>

                    {/* ANIMATE BUTTON (Hidden if video already exists) */}
                    {!isVideoReady && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onAnimate(); }}
                            style={{
                                padding: '6px 12px', backgroundColor: '#FF0000', color: 'white', border: 'none',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                                fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
                            }}
                            title="Generate Video with Seedance"
                        >
                            <Film size={12} fill="white" /> ANIMATE
                        </button>
                    )}

                    <button onClick={onClickZoom} style={{ padding: '6px', backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid #333', color: 'white', cursor: 'pointer' }}><Maximize2 size={14} /></button>
                    <button onClick={onDownload} style={{ padding: '6px', backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid #333', color: 'white', cursor: 'pointer' }}><Download size={14} /></button>
                    <button onClick={() => onStartInpaint(src)} style={{ padding: '6px', backgroundColor: 'rgba(255,0,0,0.8)', border: '1px solid #333', color: 'white', cursor: 'pointer' }}><Wand2 size={14} /></button>
                </div>
            )}

            <style>{`
                @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
                .spin-loader { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
};