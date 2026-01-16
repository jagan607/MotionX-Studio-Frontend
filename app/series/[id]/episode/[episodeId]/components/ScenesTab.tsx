import React from 'react';
import { MapPin, Film } from 'lucide-react';

interface ScenesTabProps {
    scenes: any[];
    onOpenStoryboard: (sceneId: string) => void;
    styles: any;
}

export const ScenesTab: React.FC<ScenesTabProps> = ({ scenes, onOpenStoryboard, styles }) => {
    return (
        <div style={styles.grid}>
            {scenes.map((scene, index) => (
                <div key={scene.id} style={styles.card}>
                    <div style={styles.sceneHeader}>
                        <span style={styles.sceneTitle}>SCENE {scene.scene_number}</span>
                        <span style={styles.metaTag}>{scene.time_of_day}</span>
                    </div>
                    <div style={styles.locRow}>
                        <MapPin size={16} color="#666" /> {scene.location}
                    </div>
                    <p style={styles.actionText}>{scene.visual_action}</p>

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