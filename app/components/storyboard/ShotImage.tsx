"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, Maximize2, Download, Wand2, Image as ImageIcon, PlayCircle, Sparkles } from "lucide-react";

interface ShotImageProps {
    src: string;
    videoUrl?: string;
    videoStatus?: 'animating' | 'ready' | 'error' | 'queued' | 'processing' | 'completed' | 'failed' | null;
    shotId: string;
    isSystemLoading: boolean;
    onClickZoom: () => void;
    onDownload: () => void;
    onStartInpaint: () => void;
    onAnimate: () => void; // Kept in props to avoid breaking parent usage, though unused in UI now
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
    const [viewMode, setViewMode] = useState<'image' | 'video'>('image');
    const imgRef = useRef<HTMLImageElement>(null);

    const isAnimating = videoStatus === 'animating' || videoStatus === 'processing' || videoStatus === 'queued';
    const hasVideo = Boolean(videoUrl);
    const hasImage = Boolean(src);
    const isLoading = isSystemLoading || isAnimating || (!hasVideo && hasImage && !imageFullyDecoded && viewMode === 'image');
    const isEmpty = !hasVideo && !hasImage && !isSystemLoading && !isAnimating;

    // Auto-switch to video when it becomes available
    useEffect(() => {
        if (hasVideo) {
            setViewMode('video');
        } else {
            setViewMode('image');
        }
    }, [hasVideo]);

    useEffect(() => {
        setImageFullyDecoded(false);
    }, [src]);

    useEffect(() => {
        if (imgRef.current?.complete) setImageFullyDecoded(true);
    }, [src]);

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%', backgroundColor: '#000', overflow: 'hidden' }}>

            {/* --- 1. LOADER --- */}
            {isLoading && (
                <div style={{
                    position: 'absolute', inset: 0, zIndex: 10, backgroundColor: 'rgba(5,5,5,0.9)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
                }}>
                    <Loader2 className="force-spin" size={32} color="#FF0000" />
                    {isAnimating && (
                        <div style={{ marginTop: '15px', textAlign: 'center' }}>
                            <p style={{ color: '#FF0000', fontSize: '10px', fontWeight: 'bold', letterSpacing: '2px', animation: 'pulse 1.5s infinite' }}>
                                ANIMATING...
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* --- 2. EMPTY STATE --- */}
            {isEmpty && (
                <div style={{
                    position: 'absolute', inset: 0, zIndex: 5,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: '#080808', color: '#333', border: '1px solid #111'
                }}>
                    <div style={{
                        padding: '15px',
                        borderRadius: '50%',
                        backgroundColor: 'rgba(255, 255, 255, 0.03)',
                        marginBottom: '10px'
                    }}>
                        <Sparkles size={24} style={{ opacity: 0.3 }} />
                    </div>
                    <p style={{ fontSize: '10px', fontFamily: 'monospace', letterSpacing: '1px', color: '#444', fontWeight: 'bold' }}>
                        READY TO GENERATE
                    </p>
                </div>
            )}

            {/* --- 3. SOURCE / RESULT TOGGLE (BOTTOM CENTER) --- */}
            {hasVideo && !isLoading && (
                <div style={{
                    position: 'absolute', bottom: '10px', left: '50%', transform: 'translateX(-50%)',
                    zIndex: 30, display: 'flex', backgroundColor: 'rgba(0,0,0,0.8)',
                    borderRadius: '20px', padding: '2px', border: '1px solid #333',
                    backdropFilter: 'blur(4px)'
                }}>
                    <button
                        onClick={(e) => { e.stopPropagation(); setViewMode('image'); }}
                        style={{
                            padding: '4px 10px', borderRadius: '15px', border: 'none',
                            backgroundColor: viewMode === 'image' ? '#333' : 'transparent',
                            color: viewMode === 'image' ? 'white' : '#888',
                            fontSize: '9px', fontWeight: 'bold', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '4px',
                            transition: 'all 0.2s'
                        }}
                    >
                        <ImageIcon size={10} /> IMG
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); setViewMode('video'); }}
                        style={{
                            padding: '4px 10px', borderRadius: '15px', border: 'none',
                            backgroundColor: viewMode === 'video' ? '#FF0000' : 'transparent',
                            color: viewMode === 'video' ? 'white' : '#888',
                            fontSize: '9px', fontWeight: 'bold', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '4px',
                            transition: 'all 0.2s'
                        }}
                    >
                        <PlayCircle size={10} /> VID
                    </button>
                </div>
            )}

            {/* --- 4. MEDIA CONTENT --- */}
            {(hasVideo && viewMode === 'video') ? (
                <video
                    src={videoUrl}
                    controls={false}
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

            {/* --- 5. TOP RIGHT CONTROLS --- */}
            {!isLoading && !isEmpty && (
                <div style={{ position: 'absolute', top: '10px', right: '10px', display: 'flex', gap: '8px', zIndex: 20 }}>

                    {/* SHOW ONLY IN IMAGE MODE: INPAINT ONLY (Animate removed) */}
                    {viewMode === 'image' && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onStartInpaint(); }}
                            style={{ padding: '6px', backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid #333', color: 'white', cursor: 'pointer' }}
                            title="Edit/Inpaint Image"
                        >
                            <Wand2 size={14} />
                        </button>
                    )}

                    {/* COMMON TOOLS */}
                    <button onClick={onClickZoom} style={{ padding: '6px', backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid #333', color: 'white', cursor: 'pointer' }}>
                        <Maximize2 size={14} />
                    </button>

                    <button onClick={(e) => { e.stopPropagation(); onDownload(); }} style={{ padding: '6px', backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid #333', color: 'white', cursor: 'pointer' }}>
                        <Download size={14} />
                    </button>
                </div>
            )}

            <style>{`
                @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
            `}</style>
        </div>
    );
};