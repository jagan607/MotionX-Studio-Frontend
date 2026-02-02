import React, { useState, useEffect } from 'react';
import { X, Mic2, Film } from 'lucide-react';

interface ZoomOverlayProps {
    media: {
        url: string;
        type: 'image' | 'video';
        lipsyncUrl?: string; // <--- NEW: Optional lip sync URL
    } | null;
    onClose: () => void;
    styles: any;
}

export const ZoomOverlay: React.FC<ZoomOverlayProps> = ({ media, onClose, styles }) => {
    const [currentUrl, setCurrentUrl] = useState<string | undefined>(undefined);
    const [mode, setMode] = useState<'original' | 'lipsync'>('original');

    // Reset state when opening new media
    useEffect(() => {
        if (media) {
            console.log("media", media);
            // Default to original URL when opening
            setCurrentUrl(media.url);
            setMode('original');
        }
    }, [media]);

    if (!media) return null;

    const handleSwitch = (newMode: 'original' | 'lipsync') => {
        setMode(newMode);
        // Switch between original video_url and lipsync_url
        setCurrentUrl(newMode === 'original' ? media.url : media.lipsyncUrl);
    };

    return (
        <div style={styles.zoomOverlay} onClick={onClose}>
            {media.type === 'video' ? (
                <div
                    style={{
                        position: 'relative',
                        width: '90%',
                        height: '90%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <video
                        key={currentUrl} // Key forces re-render when URL changes so it plays immediately
                        src={currentUrl}
                        controls
                        autoPlay
                        loop
                        style={{
                            maxWidth: '100%',
                            maxHeight: media.lipsyncUrl ? '85%' : '100%', // Make room for buttons if needed
                            outline: 'none',
                            boxShadow: '0 0 50px rgba(0,0,0,0.8)'
                        }}
                    />

                    {/* --- TOGGLE BUTTONS (Only show if Lip Sync exists) --- */}
                    {media.lipsyncUrl && (
                        <div style={{
                            marginTop: '20px',
                            display: 'flex',
                            gap: '10px',
                            backgroundColor: 'rgba(0,0,0,0.8)',
                            padding: '6px',
                            borderRadius: '30px',
                            border: '1px solid #333',
                            backdropFilter: 'blur(10px)'
                        }}>
                            <button
                                onClick={() => handleSwitch('original')}
                                style={{
                                    padding: '8px 20px',
                                    borderRadius: '20px',
                                    border: 'none',
                                    backgroundColor: mode === 'original' ? '#FF0000' : 'transparent',
                                    color: 'white',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    fontSize: '11px'
                                }}
                            >
                                <Film size={14} /> ORIGINAL
                            </button>
                            <button
                                onClick={() => handleSwitch('lipsync')}
                                style={{
                                    padding: '8px 20px',
                                    borderRadius: '20px',
                                    border: 'none',
                                    backgroundColor: mode === 'lipsync' ? '#00FF41' : 'transparent',
                                    color: mode === 'lipsync' ? 'black' : 'white',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    fontSize: '11px'
                                }}
                            >
                                <Mic2 size={14} /> LIP SYNC
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                <img
                    src={media.url}
                    style={styles.zoomImg}
                    onClick={(e) => e.stopPropagation()}
                    alt="Zoom Preview"
                />
            )}

            <X
                size={30}
                style={{
                    position: 'absolute',
                    top: 30,
                    right: 30,
                    color: 'white',
                    cursor: 'pointer',
                    zIndex: 100
                }}
                onClick={onClose}
            />
        </div>
    );
};