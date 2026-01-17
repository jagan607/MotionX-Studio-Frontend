import React from 'react';
import { ImageIcon } from 'lucide-react';
import { LocationProfile } from '@/lib/types';

interface LocationsTabProps {
    // 1. Accept the rich object array
    locations: LocationProfile[];

    // 2. Keep these for compatibility if needed, but 'locations' is the primary source now
    uniqueLocs?: string[];
    locationImages: Record<string, string>;
    onEditAsset: (locId: string) => void;
    styles: any;
}

export const LocationsTab: React.FC<LocationsTabProps> = ({
    locations,
    locationImages,
    onEditAsset,
    styles
}) => {
    // Ensure we have a list to map over
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
            {displayList.map((loc) => {
                // Check local state map first, then the DB object
                const imageUrl = locationImages[loc.id] || loc.image_url;

                // Safely handle visual_traits whether it's an array or missing
                const traitCount = Array.isArray(loc.visual_traits) ? loc.visual_traits.length : 0;

                return (
                    <div key={loc.id} style={styles.assetCard}>
                        {imageUrl ? (
                            <img src={imageUrl} alt={loc.name} style={styles.assetImage} />
                        ) : (
                            <div style={styles.assetPlaceholder}>
                                <ImageIcon size={40} />
                            </div>
                        )}

                        <div style={styles.assetInfo}>
                            <div style={styles.assetName}>{loc.name}</div>
                            <div style={{ fontSize: '10px', color: '#666', marginTop: '5px' }}>
                                {traitCount} VISUAL TRAITS
                            </div>
                        </div>

                        <button
                            style={{
                                ...styles.genBtn,
                                backgroundColor: imageUrl ? '#222' : '#FF0000',
                                color: imageUrl ? '#FFF' : '#FFF'
                            }}
                            onClick={() => onEditAsset(loc.id)}
                        >
                            {imageUrl ? "REGENERATE SET" : "BUILD SET"}
                        </button>
                    </div>
                );
            })}
        </div>
    );
};