"use client";

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, Sparkles, Film, RefreshCw, ChevronDown } from "lucide-react";

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
    image_url?: string;
    video_url?: string;
}

interface SortableShotCardProps {
    shot: Shot;
    index: number;
    styles: any;
    onDelete: (id: string) => void;
    castMembers: CastMember[];
    onUpdateShot: (id: string, field: keyof Shot, value: any) => void;
    // --- ACTION PROPS ---
    onRender: () => void;
    onAnimate: () => void;
    isRendering: boolean;
    children: React.ReactNode;
}

// --- 2. OPTIMIZATION: Helper moved outside ---
const normalize = (str: string) => str ? str.toLowerCase().trim() : "";

export const SortableShotCard = ({
    shot,
    index,
    styles,
    onDelete,
    castMembers,
    onUpdateShot,
    onRender,
    onAnimate,
    isRendering,
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

    // Derived States
    const hasImage = Boolean(shot.image_url);
    const hasVideo = Boolean(shot.video_url);

    // --- 3. UNIFIED STYLES ---

    // Style for ALL Titles (Shot Type, Location, Casting, Prompts)
    const labelStyle: React.CSSProperties = {
        fontSize: '9px',
        color: '#666',
        marginBottom: '6px',
        display: 'block',
        fontWeight: 'bold',
        letterSpacing: '1px',
        textTransform: 'uppercase',
        fontFamily: 'inherit' // Ensure it matches app font
    };

    // Style for ALL Inputs (Select, Text Input, Textarea)
    const commonInputStyle: React.CSSProperties = {
        width: '100%',
        backgroundColor: '#111',
        border: '1px solid #222',
        color: '#e0e0e0', // Consistent bright grey text
        fontSize: '11px', // Unified font size for content
        padding: '8px 10px',
        borderRadius: '4px',
        outline: 'none',
        fontFamily: 'inherit', // Prevents browser defaults (like monospace in textareas)
        lineHeight: '1.4'
    };

    return (
        <div ref={setNodeRef} style={{ ...styles.shotCard, ...dragStyle, display: 'flex', flexDirection: 'column' }}>

            {/* 1. HEADER ROW */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div {...attributes} {...listeners} style={{ cursor: 'grab', color: '#666', padding: '4px' }} aria-label="Drag handle">
                        <GripVertical size={18} />
                    </div>
                    <span style={{ color: '#FF0000', fontWeight: 'bold', fontSize: '12px', letterSpacing: '1px' }}>
                        SHOT {String(index + 1).padStart(2, '0')}
                    </span>
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
            <div style={{ position: 'relative', marginBottom: '12px' }}>
                {children}
            </div>

            {/* 3. METADATA ROW (Shot Type & Location) */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <div style={{ flex: 1 }}>
                    <label style={labelStyle}>SHOT TYPE</label>
                    <div style={{ position: 'relative' }}>
                        <select
                            style={{ ...commonInputStyle, appearance: 'none', cursor: 'pointer' }}
                            value={shot.shot_type || "Wide Shot"}
                            onChange={(e) => onUpdateShot(shot.id, "shot_type", e.target.value)}
                        >
                            <option>Extreme Wide Shot</option>
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
                        <ChevronDown size={12} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#666', pointerEvents: 'none' }} />
                    </div>
                </div>

                <div style={{ flex: 1 }}>
                    <label style={labelStyle}>LOCATION</label>
                    <input
                        type="text"
                        style={commonInputStyle}
                        value={shot.location || ""}
                        onChange={(e) => onUpdateShot(shot.id, "location", e.target.value)}
                        placeholder="INT. ROOM"
                    />
                </div>
            </div>

            {/* 4. CASTING */}
            <div style={{ marginBottom: '12px' }}>
                <label style={labelStyle}>CASTING</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {castMembers.map((char) => {
                        const isActive = Array.isArray(shot.characters) &&
                            shot.characters.some((c) => normalize(c) === normalize(char.name));

                        return (
                            <button
                                key={char.id}
                                onClick={() => handleCharToggle(char.name)}
                                style={{
                                    ...styles.charToggle(isActive),
                                    fontSize: '10px', // Match input size
                                    padding: '4px 10px',
                                    borderRadius: '4px'
                                }}
                            >
                                {char.name}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* 5. PROMPTS */}
            <div style={{ marginBottom: '12px' }}>
                <label style={labelStyle}>IMAGE PROMPT</label>
                <textarea
                    style={{ ...commonInputStyle, minHeight: '60px', resize: 'vertical' }}
                    value={shot.visual_action || ""}
                    onChange={(e) => onUpdateShot(shot.id, "visual_action", e.target.value)}
                    placeholder="Visual description..."
                />
            </div>

            <div style={{ marginBottom: '15px' }}>
                <label style={labelStyle}>VIDEO PROMPT</label>
                <textarea
                    style={{ ...commonInputStyle, minHeight: '60px', resize: 'vertical' }}
                    value={shot.video_prompt || ""}
                    onChange={(e) => onUpdateShot(shot.id, "video_prompt", e.target.value)}
                    placeholder="Motion description..."
                />
            </div>

            {/* 6. ACTION FOOTER */}
            <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid #1a1a1a' }}>

                {/* BUTTON 1: REGENERATE IMAGE */}
                <button
                    onClick={onRender}
                    disabled={isRendering}
                    style={{
                        flex: 1,
                        padding: '12px',
                        backgroundColor: '#1a1a1a',
                        border: '1px solid #333',
                        color: isRendering ? '#666' : '#FFF',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        cursor: isRendering ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        transition: 'all 0.2s',
                        borderRadius: '4px'
                    }}
                >
                    <Sparkles size={14} />
                    {hasImage ? "REGENERATE IMG" : "GENERATE IMG"}
                </button>

                {/* BUTTON 2: ANIMATE / VIDEO */}
                <button
                    onClick={onAnimate}
                    disabled={!hasImage || isRendering}
                    title={!hasImage ? "Generate an image first to enable animation" : "Generate Video"}
                    style={{
                        flex: 1,
                        padding: '12px',
                        backgroundColor: (!hasImage) ? '#111' : '#FF0000',
                        border: (!hasImage) ? '1px solid #222' : 'none',
                        color: (!hasImage) ? '#444' : 'white',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        cursor: (!hasImage || isRendering) ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        transition: 'all 0.2s',
                        borderRadius: '4px'
                    }}
                >
                    {hasVideo ? <RefreshCw size={14} /> : <Film size={14} fill={hasImage ? "white" : "gray"} />}
                    {hasVideo ? "REGENERATE VID" : "ANIMATE"}
                </button>
            </div>
        </div>
    );
};