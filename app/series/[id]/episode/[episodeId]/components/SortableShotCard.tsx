"use client";

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, MapPin, Eye, Clapperboard } from "lucide-react";

// --- 1. TYPE SAFETY: Explicit Interfaces ---
interface CastMember {
    id: string;
    name: string;
}

interface Shot {
    id: string;
    shot_type: string;
    characters: string[];
    visual_action: string;
    video_prompt?: string;
    location?: string;
}

interface SortableShotCardProps {
    shot: Shot;
    index: number;
    styles: any; // Ideally this should be typed too, but 'any' is acceptable for legacy style objects
    onDelete: (id: string) => void;
    castMembers: CastMember[];
    onUpdateShot: (id: string, field: keyof Shot, value: any) => void;
    children: React.ReactNode;
}

// --- 2. OPTIMIZATION: Helper moved outside component to prevent re-creation ---
const normalize = (str: string) => str ? str.toLowerCase().trim() : "";

export const SortableShotCard = ({
    shot,
    index,
    styles,
    onDelete,
    castMembers,
    onUpdateShot,
    children
}: SortableShotCardProps) => {

    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: shot.id });

    const dragStyle = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 1000 : 1,
        opacity: isDragging ? 0.6 : 1,
        transformOrigin: "0 0",
        scale: isDragging ? "1.02" : "1",
    };

    const handleCharToggle = (charName: string) => {
        const current = Array.isArray(shot.characters) ? shot.characters : [];
        const normChar = normalize(charName);
        const exists = current.some((c) => normalize(c) === normChar);

        const updated = exists
            ? current.filter((c) => normalize(c) !== normChar)
            : [...current, charName];

        onUpdateShot(shot.id, "characters", updated);
    };

    return (
        <div ref={setNodeRef} style={{ ...styles.shotCard, ...dragStyle }}>

            {/* 1. HEADER ROW */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div {...attributes} {...listeners} style={{ cursor: 'grab', color: '#666', padding: '4px' }} aria-label="Drag handle">
                        <GripVertical size={18} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ color: '#FF0000', fontWeight: 'bold', fontSize: '12px', letterSpacing: '1px' }}>
                            SHOT {String(index + 1).padStart(2, '0')}
                        </span>
                        <span style={{ fontSize: '8px', color: '#444', fontFamily: 'monospace' }}>{shot.id.toUpperCase()}</span>
                    </div>
                </div>

                <button
                    onClick={() => onDelete(shot.id)}
                    style={{ background: 'none', border: 'none', color: '#444', cursor: 'pointer' }}
                    aria-label="Delete shot"
                >
                    <Trash2 size={16} />
                </button>
            </div>

            {/* 2. IMAGE PREVIEW */}
            <div style={{ position: 'relative', marginBottom: '15px' }}>
                {children}
            </div>

            {/* 3. ZONE 1: CONTEXT (Shot Type + Location) */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                <div style={{ flex: 1 }}>
                    <label style={styles.label}>SHOT TYPE</label>
                    <select
                        style={{ ...styles.select, width: '100%' }}
                        value={shot.shot_type || "Wide Shot"}
                        onChange={(e) => onUpdateShot(shot.id, "shot_type", e.target.value)}
                    >
                        <option>Extreme Wide Shot (Establishing)</option>
                        <option>Wide Shot</option>
                        <option>Full Shot</option>
                        <option>Medium Shot</option>
                        <option>Close Up</option>
                        <option>Extreme Close Up</option>
                        <option>Over the Shoulder</option>
                        <option>Two Shot</option>
                        <option>Low Angle</option>
                        <option>High Angle</option>
                    </select>
                </div>

                <div style={{ flex: 1 }}>
                    <label style={styles.label}>
                        <MapPin size={10} style={{ marginRight: '4px', display: 'inline' }} />
                        LOCATION
                    </label>
                    <input
                        type="text"
                        style={{ ...styles.select, width: '100%', cursor: 'text' }}
                        value={shot.location || ""}
                        onChange={(e) => onUpdateShot(shot.id, "location", e.target.value)}
                        placeholder="INT. ROOM"
                    />
                </div>
            </div>

            {/* 4. ZONE 2: CASTING */}
            <label style={styles.label}>CASTING</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', marginBottom: '15px', gap: '6px' }}>
                {castMembers.map((char) => {
                    const isActive = Array.isArray(shot.characters) &&
                        shot.characters.some((c) => normalize(c) === normalize(char.name));

                    return (
                        <button
                            key={char.id}
                            onClick={() => handleCharToggle(char.name)}
                            style={styles.charToggle(isActive)}
                        >
                            {char.name}
                        </button>
                    );
                })}
            </div>

            {/* 5. ZONE 3: PROMPTS */}
            <label style={styles.label}>
                <Eye size={10} style={{ marginRight: '4px', display: 'inline', color: '#666' }} />
                IMAGE PROMPT (STATIC)
            </label>
            <textarea
                style={styles.textArea}
                value={shot.visual_action || ""}
                onChange={(e) => onUpdateShot(shot.id, "visual_action", e.target.value)}
                placeholder="Visual description..."
            />

            <label style={{ ...styles.label, marginTop: '10px' }}>
                <Clapperboard size={10} style={{ marginRight: '4px', display: 'inline', color: '#00ccff' }} />
                VIDEO PROMPT (MOTION)
            </label>
            {/* 3. STYLING: Consolidating video specific styles is recommended in BoardStyles.ts, kept here for immediate visibility */}
            <textarea
                style={{
                    ...styles.textArea,
                    backgroundColor: '#1a1a1a',
                    border: '1px solid #333',
                    color: '#ccc',
                    minHeight: '60px'
                }}
                value={shot.video_prompt || ""}
                onChange={(e) => onUpdateShot(shot.id, "video_prompt", e.target.value)}
                placeholder="Motion description..."
            />
        </div>
    );
};