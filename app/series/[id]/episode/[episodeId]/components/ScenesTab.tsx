import React from 'react';
import { Film, MapPin, User, Clock } from 'lucide-react';

interface ScenesTabProps {
    scenes: any[];
    onOpenStoryboard: (id: string) => void;
    styles: any;
}

export const ScenesTab: React.FC<ScenesTabProps> = ({ scenes, onOpenStoryboard, styles }) => {

    const resolveLocationName = (scene: any) => {
        if (scene.location_id && scene.location_id !== 'unknown') {
            return scene.location_id.replace(/_/g, ' ').toUpperCase();
        }
        return scene.header || scene.location || "UNKNOWN LOCATION";
    };

    return (
        <div style={styles.grid}>
            {scenes.map((scene, index) => (
                <div key={scene.id} style={styles.card}>

                    {/* 1. SCENE HEADER */}
                    <div style={styles.sceneCardHeader}>
                        <div style={styles.sceneNumber}>SCENE {scene.scene_number}</div>
                    </div>

                    {/* 2. SUMMARY (Dominant Content) */}
                    <p style={styles.sceneSummary}>
                        {scene.summary || scene.visual_action || "No summary available."}
                    </p>

                    {/* 3. COMPACT METADATA ROW (Location + Time) */}
                    <div style={styles.compactRow}>
                        <MapPin size={12} color="#666" />
                        <span style={styles.locationText}>{resolveLocationName(scene)}</span>

                        {/* Time Badge pushed to the right */}
                        <div style={styles.timeBadge}>
                            {scene.time || 'DAY'}
                        </div>
                    </div>

                    {/* 4. CHARACTERS (Compact List) */}
                    <div style={styles.charTagRow}>
                        {scene.characters && scene.characters.length > 0 ? (
                            scene.characters.map((charName: string, idx: number) => (
                                <span key={idx} style={styles.charTag}>
                                    <User size={10} color="#555" />
                                    {charName.split('(')[0].trim()}
                                </span>
                            ))
                        ) : (
                            <span style={{ ...styles.charTag, opacity: 0.5, border: '1px dashed #222' }}>
                                No Cast
                            </span>
                        )}
                    </div>

                    {/* 5. CTA BUTTON */}
                    <button
                        id={index === 0 ? "tour-storyboard-target" : undefined}
                        style={styles.openBtn}
                        onClick={() => onOpenStoryboard(scene.id)}
                        onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#FF0000')}
                        onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#2a2a2a')}
                    >
                        <Film size={12} /> OPEN STORYBOARD
                    </button>
                </div>
            ))}
        </div>
    );
};