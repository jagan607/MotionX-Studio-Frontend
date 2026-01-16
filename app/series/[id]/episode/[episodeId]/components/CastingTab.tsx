import React from 'react';
import { Users, Mic } from 'lucide-react';

interface Character {
    id: string;
    name: string;
    face_sample_url?: string;
    voice_config?: {
        voice_id?: string;
    };
}

interface CastingTabProps {
    castMembers: Character[];
    loading: boolean;
    onEditAsset: (id: string, type: 'character') => void;
    styles: any;
}

export const CastingTab: React.FC<CastingTabProps> = ({
    castMembers,
    loading,
    onEditAsset,
    styles
}) => {

    // Helper function for rendering status lights
    const renderStatus = (hasVisual: boolean, hasVoice: boolean) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: 'auto' }}>
            {/* Visual Status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontFamily: 'monospace' }}>
                <div style={{
                    width: '8px', height: '8px', borderRadius: '50%',
                    backgroundColor: hasVisual ? '#00FF00' : '#FF0000',
                    boxShadow: hasVisual ? '0 0 5px #00FF00' : 'none'
                }} />
                <span style={{ color: hasVisual ? '#FFF' : '#666' }}>
                    {hasVisual ? "VISUAL MODEL READY" : "NO VISUAL MODEL"}
                </span>
            </div>

            {/* Voice Status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontFamily: 'monospace' }}>
                <Mic size={10} color={hasVoice ? '#0088FF' : '#444'} />
                <span style={{ color: hasVoice ? '#FFF' : '#666' }}>
                    {hasVoice ? "VOICE SYNCED" : "NO VOICE DATA"}
                </span>
            </div>
        </div>
    );

    return (
        <div style={styles.grid}>
            {castMembers.map((char) => {
                const hasVisual = !!char.face_sample_url;
                const hasVoice = !!char.voice_config?.voice_id;

                return (
                    <div
                        key={char.id}
                        style={{ ...styles.assetCard, height: '320px', justifyContent: 'space-between', alignItems: 'stretch' }}
                    >
                        {/* 1. IMAGE AREA */}
                        <div style={{
                            height: '180px',
                            backgroundColor: '#111',
                            backgroundImage: hasVisual ? `url(${char.face_sample_url})` : 'none',
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            borderRadius: '8px',
                            marginBottom: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative',
                            border: hasVisual ? '1px solid #333' : '1px dashed #444'
                        }}>
                            {!hasVisual && <Users size={40} color="#333" />}

                            {/* Hover Overlay */}
                            <div className="group-hover-overlay" style={{
                                position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                opacity: 0, transition: '0.2s', cursor: 'pointer'
                            }} onClick={() => onEditAsset(char.id, 'character')}>
                                <span style={{ color: 'white', fontSize: '12px', fontWeight: 'bold' }}>EDIT</span>
                            </div>
                        </div>

                        {/* 2. NAME */}
                        <div style={{ fontWeight: 'bold', fontSize: '18px', fontFamily: 'Anton', letterSpacing: '1px', marginBottom: '5px' }}>
                            {char.name.toUpperCase()}
                        </div>

                        {/* 3. STATUS INDICATORS */}
                        {renderStatus(hasVisual, hasVoice)}

                        {/* 4. ACTION BUTTON */}
                        <button
                            style={{
                                ...styles.genBtn,
                                marginTop: '15px',
                                backgroundColor: (!hasVisual || !hasVoice) ? '#222' : '#111',
                                border: (!hasVisual || !hasVoice) ? '1px solid #333' : '1px solid #222',
                                color: (!hasVisual || !hasVoice) ? 'white' : '#444'
                            }}
                            onClick={() => onEditAsset(char.id, 'character')}
                        >
                            {!hasVisual ? "GENERATE VISUALS" : (!hasVoice ? "ADD VOICE" : "EDIT PROFILE")}
                        </button>
                    </div>
                );
            })}

            {/* Empty State */}
            {castMembers.length === 0 && !loading && (
                <div style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', color: '#666', border: '1px dashed #333' }}>
                    NO CASTING DATA FOUND IN SCRIPT MANIFEST.
                </div>
            )}

            {/* Loading State */}
            {loading && (
                <div style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', color: '#666' }}>
                    LOADING CASTING DATA...
                </div>
            )}
        </div>
    );
};