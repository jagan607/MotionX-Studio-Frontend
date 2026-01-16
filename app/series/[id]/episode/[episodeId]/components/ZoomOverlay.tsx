import React from 'react';
import { X } from 'lucide-react';

interface ZoomOverlayProps {
    media: { url: string; type: 'image' | 'video' } | null;
    onClose: () => void;
    styles: any;
}

export const ZoomOverlay: React.FC<ZoomOverlayProps> = ({ media, onClose, styles }) => {
    if (!media) return null;

    return (
        <div style={styles.zoomOverlay} onClick={onClose}>
            {media.type === 'video' ? (
                <video
                    src={media.url}
                    controls
                    autoPlay
                    loop
                    style={{
                        maxWidth: '90%',
                        maxHeight: '90%',
                        outline: 'none',
                        boxShadow: '0 0 50px rgba(0,0,0,0.8)'
                    }}
                    onClick={(e) => e.stopPropagation()}
                />
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
                    cursor: 'pointer'
                }}
                onClick={onClose}
            />
        </div>
    );
};