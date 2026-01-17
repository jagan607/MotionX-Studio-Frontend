import React from 'react';
import { MapPin, Film } from 'lucide-react';

interface ScenesTabProps {
    scenes: any[];
    onOpenStoryboard: (sceneId: string) => void;
    styles: any;
}

export const ScenesTab: React.FC<ScenesTabProps> = ({ scenes, onOpenStoryboard, styles }) => {

    // Helper to format the location ID back to readable text if needed
    // e.g. "int_apartment" -> "INT. APARTMENT"
    const resolveLocationName = (scene: any) => {
        // If the backend sanitized it to 'location_id', use the formatted version of that
        if (scene.location_id && scene.location_id !== 'unknown') {
            return scene.location_id.replace(/_/g, ' ').toUpperCase();
        }

        // Fallback to the full header extracted from the script
        // or the raw 'location' key if the AI used that instead
        return scene.header || scene.location || "UNKNOWN LOCATION";
    };

    return (
        <div style={styles.grid}>
            {scenes.map((scene, index) => (
                <div key={scene.id} style={styles.card}>
                    <div style={styles.sceneHeader}>
                        <span style={styles.sceneTitle}>SCENE {scene.scene_number}</span>
                        {/* FIXED: 'time_of_day' -> 'time' */}
                        <span style={styles.metaTag}>{scene.time || 'N/A'}</span>
                    </div>

                    <div style={styles.locRow}>
                        <MapPin size={16} color="#666" />
                        {/* FIXED: 'location' -> 'location_id' / 'header' logic */}
                        <span style={{ marginLeft: '6px' }}>
                            {resolveLocationName(scene)}
                        </span>
                    </div>

                    {/* FIXED: 'visual_action' -> 'summary' (with fallback) */}
                    <p style={styles.actionText}>
                        {scene.summary || scene.visual_action || "No summary available."}
                    </p>

                    <button
                        // ID used for Tour Guide
                        id={index === 0 ? "tour-storyboard-target" : undefined}
                        onClick={() => onOpenStoryboard(scene.id)}
                        style={{
                            width: '100%', padding: '15px', backgroundColor: '#222', color: 'white',
                            border: 'none', fontWeight: 'bold', cursor: 'pointer', display: 'flex',
                            alignItems: 'center', justifyContent: 'center', gap: '10px',
                            fontSize: '12px', letterSpacing: '1px'
                        }}
                    >
                        <Film size={16} /> OPEN STORYBOARD
                    </button>
                </div>
            ))}
        </div>
    );
};