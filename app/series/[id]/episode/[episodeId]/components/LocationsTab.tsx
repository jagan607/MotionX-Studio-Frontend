import React from 'react';
import { ImageIcon, Maximize2, Settings } from 'lucide-react';
import { LocationProfile } from '@/lib/types';

interface LocationsTabProps {
    locations: LocationProfile[];
    uniqueLocs?: string[];
    locationImages: Record<string, string>;
    onEditAsset: (locId: string) => void;
    onZoom: (data: { url: string, type: 'image' | 'video' }) => void;
    styles: any;
}

export const LocationsTab: React.FC<LocationsTabProps> = ({
    locations,
    locationImages,
    onEditAsset,
    onZoom,
    styles
}) => {
    const displayList = locations && locations.length > 0 ? locations : [];

    if (displayList.length === 0) {
        return (
            <div style={{ color: '#666', padding: '40px', textAlign: 'center', border: '1px dashed #333' }}>
                NO LOCATIONS DETECTED.
            </div>
        );
    }

    return (
        <div style={styles.grid}>
            <style>{`
                .loc-card-container:hover .zoom-trigger { opacity: 1 !important; }
            `}</style>

            {displayList.map((loc) => {
                const imageUrl = locationImages[loc.id] || loc.image_url;

                return (
                    <div
                        key={loc.id}
                        className="loc-card-container"
                        style={{
                            ...styles.assetCard,
                            height: '380px', // Match the height used in CastingTab for consistency
                            padding: 0,
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column',
                            position: 'relative',
                            backgroundColor: '#050505'
                        }}
                    >
                        {/* 1. IMAGE AREA */}
                        <div style={{
                            height: '220px', // Increased to match CastingTab layout
                            width: '100%',
                            backgroundColor: '#0a0a0a',
                            position: 'relative',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderBottom: '1px solid #222'
                        }}>
                            {imageUrl ? (
                                <>
                                    <img
                                        src={imageUrl}
                                        alt={loc.name}
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    />
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
                                </>
                            ) : (
                                <ImageIcon size={48} color="#222" />
                            )}
                        </div>

                        {/* 2. INFO AREA */}
                        <div style={{
                            padding: '20px',
                            display: 'flex',
                            flexDirection: 'column',
                            flex: 1 // Takes up remaining space above the button
                        }}>
                            <div style={{
                                fontWeight: 'bold',
                                fontSize: '24px', // Match CastingTab font size
                                fontFamily: 'Anton, sans-serif',
                                letterSpacing: '1px',
                                color: '#FFF',
                                textTransform: 'uppercase',
                                marginBottom: '10px'
                            }}>
                                {loc.name}
                            </div>
                        </div>

                        {/* 3. ACTION BUTTON (Matches 'Configure' style) */}
                        <button
                            style={{
                                ...styles.genBtn, // Inherit base button styles if applicable
                                width: '100%',
                                marginTop: 'auto', // Pushes button to bottom like the cast card
                                backgroundColor: '#1a1a1a', // Dark background to match
                                border: '1px solid #333', // Subtle border
                                color: '#FFF',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                padding: '12px',
                                fontSize: '11px',
                                letterSpacing: '1px',
                                borderRadius: '0', // Maintain the sharp edges of the card layout
                                cursor: 'pointer'
                            }}
                            onClick={() => onEditAsset(loc.id)}
                        >
                            {/* Optional: Add a Settings or Build icon to match the Cast card's visual weight */}
                            <Settings size={12} />
                            {"CONFIGURE"}
                        </button>
                    </div>
                );
            })}
        </div>
    );
};