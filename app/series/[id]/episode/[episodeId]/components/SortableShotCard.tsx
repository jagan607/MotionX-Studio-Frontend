"use client";

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, Sparkles, Film, RefreshCw, ChevronDown, ImagePlus, X } from "lucide-react";
import { useState, useRef } from 'react';

// --- 1. TYPE SAFETY: Explicit Interfaces ---
interface CastMember {
    id: string;
    name: string;
}

interface Location {
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
    video_status?: string; // Tracks animation state (animating, processing, etc.)
}

interface SortableShotCardProps {
    shot: Shot;
    index: number;
    styles: any;
    onDelete: (id: string) => void;
    castMembers: CastMember[];
    locations: Location[];
    onUpdateShot: (id: string, field: keyof Shot, value: any) => void;
    // --- ACTION PROPS ---
    onRender: (referenceFile?: File | null) => void;
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
    locations,
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

    const [refFile, setRefFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setRefFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const clearFile = () => {
        setRefFile(null);
        setPreviewUrl(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    // Derived States
    const hasImage = Boolean(shot.image_url);
    const hasVideo = Boolean(shot.video_url);

    // --- ANIMATION LOCK LOGIC ---
    // Check if video is currently generating/processing
    const isAnimating = ['animating', 'processing', 'queued', 'pending'].includes(shot.video_status || '');
    // Master lock: disable inputs if Image is Rendering OR Video is Animating
    const isBusy = isRendering || isAnimating;

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
        fontFamily: 'inherit'
    };

    // Base Style for Inputs
    const commonInputStyle: React.CSSProperties = {
        width: '100%',
        backgroundColor: '#111',
        border: '1px solid #222',
        color: '#e0e0e0',
        fontSize: '11px',
        padding: '8px 10px',
        borderRadius: '4px',
        outline: 'none',
        fontFamily: 'inherit',
        lineHeight: '1.4'
    };

    // Specific Style for Dropdowns (Selects) to handle truncation & chevron overlap
    const selectStyle: React.CSSProperties = {
        ...commonInputStyle,
        appearance: 'none',
        cursor: 'pointer',
        paddingRight: '25px', // Extra padding on right so text doesn't hit the chevron
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
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

            {/* 3. METADATA ROW (Shot Type & Location Dropdowns) */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>

                {/* SHOT TYPE DROPDOWN */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <label style={labelStyle}>SHOT TYPE</label>
                    <div style={{ position: 'relative' }}>
                        <select
                            style={selectStyle}
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
                        <ChevronDown size={12} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', color: '#666', pointerEvents: 'none' }} />
                    </div>
                </div>

                {/* LOCATION DROPDOWN */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <label style={labelStyle}>LOCATION</label>
                    <div style={{ position: 'relative' }}>
                        <select
                            style={selectStyle}
                            value={shot.location || ""}
                            onChange={(e) => onUpdateShot(shot.id, "location", e.target.value)}
                        >
                            {/* Hidden disabled option acts as placeholder but won't show in the dropdown list */}
                            <option value="" disabled hidden>Select Location...</option>
                            {locations.map((loc) => (
                                <option key={loc.id} value={loc.id}>
                                    {loc.name.toUpperCase()}
                                </option>
                            ))}
                        </select>
                        <ChevronDown size={12} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', color: '#666', pointerEvents: 'none' }} />
                    </div>
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
                {/* --- UPDATE: Header with Upload Button --- */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ ...labelStyle, marginBottom: 0 }}>IMAGE PROMPT</label>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileSelect}
                            style={{ display: 'none' }}
                            accept="image/*"
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            style={{
                                background: 'none', border: 'none', color: refFile ? '#00FF41' : '#666',
                                cursor: 'pointer', fontSize: '9px', display: 'flex', alignItems: 'center', gap: '4px',
                                fontWeight: 'bold', textTransform: 'uppercase'
                            }}
                            title="Upload Reference Image for Composition"
                        >
                            <ImagePlus size={10} /> {refFile ? "REF LOADED" : "ADD COMPOSITION REF"}
                        </button>
                    </div>
                </div>

                <textarea
                    style={{ ...commonInputStyle, minHeight: '60px', resize: 'vertical' }}
                    value={shot.visual_action || ""}
                    onChange={(e) => onUpdateShot(shot.id, "visual_action", e.target.value)}
                    placeholder="Visual description..."
                />

                {/* --- REFERENCE IMAGE PREVIEW (IF UPLOADED) --- */}
                {previewUrl && (
                    <div style={{
                        marginTop: '8px',
                        padding: '8px',
                        backgroundColor: '#111',
                        border: '1px dashed #333',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderRadius: '4px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <img src={previewUrl} alt="Ref" style={{ width: '30px', height: '30px', objectFit: 'cover', borderRadius: '2px' }} />
                            <div>
                                <div style={{ fontSize: '9px', color: '#fff', fontWeight: 'bold', textTransform: 'uppercase' }}>Composition Ref</div>
                                <div style={{ fontSize: '9px', color: '#666' }}>Using camera angle & framing</div>
                            </div>
                        </div>
                        <button onClick={clearFile} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#666' }}>
                            <X size={12} />
                        </button>
                    </div>
                )}
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
                    onClick={() => onRender(refFile)}
                    disabled={isBusy} // Locked if Image Rendering OR Video Animating
                    style={{
                        flex: 1,
                        padding: '12px',
                        backgroundColor: '#1a1a1a',
                        border: '1px solid #333',
                        color: isBusy ? '#666' : '#FFF',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        cursor: isBusy ? 'not-allowed' : 'pointer',
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
                    disabled={!hasImage || isBusy} // Locked if No Image OR Image Rendering OR Video Animating
                    title={!hasImage ? "Generate an image first to enable animation" : "Generate Video"}
                    style={{
                        flex: 1,
                        padding: '12px',
                        backgroundColor: (!hasImage) ? '#111' : '#FF0000',
                        border: (!hasImage) ? '1px solid #222' : 'none',
                        color: (!hasImage) ? '#444' : 'white',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        cursor: (!hasImage || isBusy) ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        transition: 'all 0.2s',
                        borderRadius: '4px'
                    }}
                >
                    {/* FIXED: No Loader2 here. Only Static Icons. */}
                    {hasVideo ? <RefreshCw size={14} /> : <Film size={14} fill={hasImage ? "white" : "gray"} />}
                    {hasVideo ? "REGENERATE VID" : "ANIMATE"}
                </button>
            </div>
        </div>
    );
};