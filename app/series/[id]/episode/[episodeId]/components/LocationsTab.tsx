import React from 'react';
import { ImageIcon } from 'lucide-react';

interface LocationsTabProps {
    uniqueLocs: string[];
    locationImages: Record<string, string>;
    onEditAsset: (locName: string) => void;
    styles: any;
}

export const LocationsTab: React.FC<LocationsTabProps> = ({
    uniqueLocs,
    locationImages,
    onEditAsset,
    styles
}) => {
    return (
        <div style={styles.grid}>
            {uniqueLocs.map((loc, index) => {
                const imageUrl = locationImages[loc];
                return (
                    <div key={index} style={styles.assetCard}>
                        {imageUrl ? (
                            <img src={imageUrl} alt={loc} style={styles.assetImage} />
                        ) : (
                            <div style={styles.assetPlaceholder}>
                                <ImageIcon size={40} />
                            </div>
                        )}

                        <div style={styles.assetName}>{loc}</div>

                        <button
                            style={{
                                ...styles.genBtn,
                                backgroundColor: imageUrl ? '#222' : '#FF0000'
                            }}
                            onClick={() => onEditAsset(loc)}
                        >
                            {imageUrl ? "REGENERATE SET" : "BUILD SET"}
                        </button>
                    </div>
                );
            })}
        </div>
    );
};