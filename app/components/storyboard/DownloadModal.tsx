"use client";
import { X, Image as ImageIcon, Film, Layers } from "lucide-react";

interface DownloadModalProps {
    shot: any;
    onClose: () => void;
    onDownload: (type: 'image' | 'video' | 'both') => void;
}

export const DownloadModal = ({ shot, onClose, onDownload }: DownloadModalProps) => {
    // Shared Button Style
    const btnStyle: React.CSSProperties = {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        width: '100%', padding: '15px 20px', marginBottom: '10px',
        backgroundColor: '#111', border: '1px solid #333', color: '#EEE',
        cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px',
        textAlign: 'left', transition: 'all 0.2s'
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.9)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000
        }}>
            <div style={{
                width: '400px', backgroundColor: '#050505', border: '1px solid #333',
                padding: '30px', position: 'relative', boxShadow: '0 0 50px rgba(0,0,0,0.8)'
            }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                    <h2 style={{ fontFamily: 'Anton, sans-serif', fontSize: '24px', color: 'white', margin: 0 }}>
                        DOWNLOAD ASSETS
                    </h2>
                    <X size={20} color="#666" style={{ cursor: 'pointer' }} onClick={onClose} />
                </div>

                <p style={{ fontSize: '12px', color: '#888', marginBottom: '25px', lineHeight: '1.5' }}>
                    This shot contains both a rendered frame and a motion video. Select format:
                </p>

                {/* Options */}
                <button
                    style={btnStyle}
                    onClick={() => onDownload('image')}
                    onMouseOver={(e) => e.currentTarget.style.borderColor = '#FFF'}
                    onMouseOut={(e) => e.currentTarget.style.borderColor = '#333'}
                >
                    <span style={{ display: 'flex', gap: '10px' }}><ImageIcon size={16} /> HIGH-RES IMAGE</span>
                    <span style={{ color: '#555', fontSize: '10px' }}>JPG</span>
                </button>

                <button
                    style={btnStyle}
                    onClick={() => onDownload('video')}
                    onMouseOver={(e) => e.currentTarget.style.borderColor = '#FFF'}
                    onMouseOut={(e) => e.currentTarget.style.borderColor = '#333'}
                >
                    <span style={{ display: 'flex', gap: '10px' }}><Film size={16} /> MOTION VIDEO</span>
                    <span style={{ color: '#555', fontSize: '10px' }}>MP4</span>
                </button>

                <button
                    style={{ ...btnStyle, backgroundColor: '#FF0000', color: 'white', border: 'none' }}
                    onClick={() => onDownload('both')}
                >
                    <span style={{ display: 'flex', gap: '10px' }}><Layers size={16} /> DOWNLOAD PACK</span>
                    <span style={{ color: 'white', fontSize: '10px', opacity: 0.8 }}>BOTH</span>
                </button>

            </div>
        </div>
    );
};