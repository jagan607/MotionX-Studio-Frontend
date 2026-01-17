import React from 'react';
import { Users, Mic, Settings, Maximize2 } from 'lucide-react';

interface Character {
    id: string;
    name: string;
    face_sample_url?: string;
    image_url?: string; // Support both naming conventions
    voice_config?: {
        voice_id?: string;
    };
}

interface CastingTabProps {
    castMembers: Character[];
    loading: boolean;
    onEditAsset: (id: string, type: 'character') => void;
    // NEW: Handler for full-screen zoom
    onZoom: (data: { url: string, type: 'image' | 'video' }) => void;
    styles: any;
}

export const CastingTab: React.FC<CastingTabProps> = ({
    castMembers,
    loading,
    onEditAsset,
    onZoom,
    styles
}) => {

    // Helper function for rendering status lights
    const renderStatus = (hasVisual: boolean, hasVoice: boolean) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: 'auto', marginBottom: '15px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '10px', fontFamily: 'monospace', letterSpacing: '1px' }}>
                <div style={{
                    width: '6px', height: '6px', borderRadius: '50%',
                    backgroundColor: hasVisual ? '#00FF00' : '#333',
                    boxShadow: hasVisual ? '0 0 8px #00FF00' : 'none'
                }} />
                <span style={{ color: hasVisual ? '#CCC' : '#555' }}>
                    {hasVisual ? "VISUAL MODEL READY" : "MISSING VISUALS"}
                </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '10px', fontFamily: 'monospace', letterSpacing: '1px' }}>
                <Mic size={10} color={hasVoice ? '#0088FF' : '#333'} />
                <span style={{ color: hasVoice ? '#CCC' : '#555' }}>
                    {hasVoice ? "VOICE SYNCED" : "MISSING VOICE"}
                </span>
            </div>
        </div>
    );

    return (
        <div style={styles.grid}>
            <style>{`
                .asset-card-container:hover .zoom-trigger { opacity: 1 !important; }
            `}</style>

            {castMembers.map((char) => {
                const imageUrl = char.face_sample_url || char.image_url;
                const hasVisual = !!imageUrl;
                const hasVoice = !!char.voice_config?.voice_id;

                return (
                    <div
                        key={char.id}
                        className="asset-card-container"
                        style={{
                            ...styles.assetCard,
                            height: '380px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'flex-start',
                            alignItems: 'stretch',
                            padding: '0',
                            overflow: 'hidden',
                            position: 'relative'
                        }}
                    >
                        {/* 1. IMAGE AREA (Top Half) */}
                        <div style={{
                            height: '220px',
                            width: '100%',
                            backgroundColor: '#0a0a0a',
                            backgroundImage: hasVisual ? `url(${imageUrl})` : 'none',
                            backgroundSize: 'cover',
                            backgroundPosition: 'top center',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative',
                            borderBottom: '1px solid #222'
                        }}>
                            {!hasVisual && <Users size={48} color="#222" />}

                            {/* EXPAND ICON (Visible on Hover) */}
                            {hasVisual && (
                                <div
                                    className="zoom-trigger"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onZoom({ url: imageUrl, type: 'image' });
                                    }}
                                    style={{
                                        position: 'absolute', top: '12px', right: '12px',
                                        backgroundColor: 'rgba(0,0,0,0.7)', padding: '8px',
                                        borderRadius: '4px', cursor: 'pointer', opacity: 0,
                                        transition: 'opacity 0.2s', zIndex: 10
                                    }}
                                >
                                    <Maximize2 size={14} color="white" />
                                </div>
                            )}

                            {/* Hover Overlay for Configuration */}
                            <div className="group-hover-overlay" style={{
                                position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                opacity: 0, transition: '0.2s', cursor: 'pointer'
                            }} onClick={() => onEditAsset(char.id, 'character')}>
                                <Settings size={24} color="white" />
                            </div>
                        </div>

                        {/* 2. INFO AREA (Bottom Half) */}
                        <div style={{
                            padding: '20px',
                            display: 'flex',
                            flexDirection: 'column',
                            flex: 1
                        }}>
                            <div style={{
                                fontWeight: 'bold',
                                fontSize: '24px',
                                fontFamily: 'Anton, sans-serif',
                                letterSpacing: '1px',
                                marginBottom: '5px',
                                color: '#FFF'
                            }}>
                                {char.name.toUpperCase()}
                            </div>

                            {/* 3. STATUS INDICATORS */}
                            {renderStatus(hasVisual, hasVoice)}

                            {/* 4. ACTION BUTTON */}
                            <button
                                style={{
                                    ...styles.genBtn,
                                    width: '100%',
                                    marginTop: 'auto',
                                    backgroundColor: '#1a1a1a',
                                    border: '1px solid #333',
                                    color: '#FFF',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px',
                                    padding: '12px',
                                    fontSize: '11px',
                                    letterSpacing: '1px'
                                }}
                                onClick={() => onEditAsset(char.id, 'character')}
                            >
                                <Settings size={12} />
                                CONFIGURE
                            </button>
                        </div>
                    </div>
                );
            })}

            {/* State Messages */}
            {castMembers.length === 0 && !loading && (
                <div style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', color: '#666', border: '1px dashed #333' }}>
                    NO CASTING DATA FOUND IN SCRIPT MANIFEST.
                </div>
            )}
            {loading && (
                <div style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', color: '#666' }}>
                    LOADING CASTING DATA...
                </div>
            )}
        </div>
    );
};