"use client";

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2 } from "lucide-react";

interface SortableShotCardProps {
    shot: any; // Using any to handle flexible Firestore data structure
    index: number;
    styles: any;
    onDelete: (id: string) => void;
    // New Props for internal UI management
    castMembers: any[];
    onUpdateShot: (id: string, field: string, value: any) => void;
    children: React.ReactNode;
}

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

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 1000 : 1,
        opacity: isDragging ? 0.6 : 1,
        transformOrigin: "0 0",
        scale: isDragging ? "1.02" : "1",
    };

    // Helper: Normalize strings for comparison (Case-Insensitive, Trimmed)
    const normalize = (str: string) => str ? str.toLowerCase().trim() : "";

    const handleCharToggle = (charName: string) => {
        const current = Array.isArray(shot.characters) ? shot.characters : [];
        const normChar = normalize(charName);

        // Check if character already exists in the list (Case-Insensitive)
        const exists = current.some((c: string) => normalize(c) === normChar);

        let updated;
        if (exists) {
            // Remove: Filter out the name (normalizing both sides to be safe)
            updated = current.filter((c: string) => normalize(c) !== normChar);
        } else {
            // Add: Push the official DB name
            updated = [...current, charName];
        }

        onUpdateShot(shot.id, "characters", updated);
    };

    return (
        <div ref={setNodeRef} style={{ ...styles.shotCard, ...style }}>

            {/* 1. HEADER ROW (Drag Handle + Title + Delete) */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div {...attributes} {...listeners} style={{ cursor: 'grab', color: '#666', padding: '4px' }}>
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
                    style={{ background: 'none', border: 'none', color: '#444', cursor: 'pointer', transition: 'color 0.2s' }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#FF0000')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = '#444')}
                >
                    <Trash2 size={16} />
                </button>
            </div>

            {/* 2. IMAGE CONTAINER (Passed as Children) */}
            <div style={{ position: 'relative', marginBottom: '15px' }}>
                {children}
            </div>

            {/* 3. SHOT TYPE SELECTOR */}
            <label style={styles.label}>SHOT TYPE</label>
            <select
                style={styles.select}
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

            {/* 4. CASTING TOGGLES (Fixed Case-Sensitivity) */}
            <label style={styles.label}>CASTING</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', marginBottom: '15px' }}>
                {castMembers.map((char: any) => {
                    // Check if this char is in the shot.characters array (Case-Insensitive)
                    const isActive = Array.isArray(shot.characters) &&
                        shot.characters.some((c: string) => normalize(c) === normalize(char.name));

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

            {/* 5. VISUAL ACTION INPUT */}
            <label style={styles.label}>VISUAL ACTION</label>
            <textarea
                style={styles.textArea}
                value={shot.visual_action || ""}
                onChange={(e) => onUpdateShot(shot.id, "visual_action", e.target.value)}
                placeholder="Describe the framing and action..."
            />
        </div>
    );
};