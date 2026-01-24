"use client";

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    GripVertical, Trash2, Sparkles, Film, RefreshCw,
    ChevronDown, ImagePlus, X, Wand2, CheckCircle2, Loader2
} from "lucide-react";
import { useState, useRef, useEffect } from 'react';
// import { useMediaViewer } from "@/app/context/MediaViewerContext"; // Removed local usage

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
    status?: string; // Tracks if shot is 'finalized' or 'generating'
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
    onFinalize: () => void;
    isRendering: boolean;
    onExpand: () => void; // <--- NEW PROP
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
    onFinalize,
    isRendering,
    onExpand,
    children
}: SortableShotCardProps) => {

    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: shot.id });

    // --- LOGIC: UNIFIED LOADING STATES ---
    // 1. Image Generation: Busy if API call is active OR Firestore says it's generating
    const isGenerating = isRendering || shot.status === 'generating';

    // 2. Video Animation: Busy if video status indicates processing
    const isAnimating = ['animating', 'processing', 'queued', 'pending'].includes(shot.video_status || '');

    // 3. Master Busy State & Overlay Text
    const isBusy = isGenerating || isAnimating;
    const overlayText = isAnimating ? "ANIMATING..." : "GENERATING...";

    // Check if shot is finalized to apply special styling
    const isFinalized = shot.status === 'finalized';
    const FINALIZED_BG = "rgba(255, 255, 255, 0.03)";
    const FINALIZED_BORDER = "rgba(255, 255, 255, 0.2)";

    const dragStyle = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 1000 : 1,
        opacity: isDragging ? 0.6 : 1,
        transformOrigin: "0 0",
        scale: isDragging ? "1.02" : "1",
        // Visual indicator for finalized shots (Golden Border)
        border: isFinalized ? `1px solid ${FINALIZED_BORDER}` : `0.2px solid ${FINALIZED_BORDER}`,
        // 2. Subtle background tint
        backgroundColor: isFinalized ? FINALIZED_BG : undefined,
        // 3. Cinematic Glow
        boxShadow: isFinalized ? '0 0 15px rgba(220, 15, 15, 0.05)' : undefined
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

    // --- REFERENCE IMAGE STATE ---
    const [refFile, setRefFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- LOCAL STATE BUFFERS (Fixes Cursor Jumping Issue) ---
    const [localVisualAction, setLocalVisualAction] = useState(shot.visual_action || "");
    const [localVideoPrompt, setLocalVideoPrompt] = useState(shot.video_prompt || "");

    useEffect(() => {
        setLocalVisualAction(shot.visual_action || "");
    }, [shot.visual_action]);

    useEffect(() => {
        setLocalVideoPrompt(shot.video_prompt || "");
    }, [shot.video_prompt]);


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

    // --- MEDIA EXPAND HANDLER (Gracefully integrated) ---
    const handleExpandMedia = (e: React.MouseEvent | React.PointerEvent) => {
        // Prevent default actions but allow bubbling if needed, 
        // though typically we want to capture this click for the viewer.
        // We stop propagation to prevent weird interaction with parent elements if any.
        e.stopPropagation();

        if (!hasImage && !hasVideo) return;

        // Delegate to parent who knows about the full list
        onExpand();
    };

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
                    <span style={{ color: isFinalized ? '#FF0000' : '#FF0000', fontWeight: 'bold', fontSize: '12px', letterSpacing: '1px' }}>
                        SHOT {String(index + 1).padStart(2, '0')} {isFinalized && "⭐"}
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

            {/* 2. IMAGE PREVIEW AREA */}
            <div
                onClick={handleExpandMedia}
                style={{
                    position: 'relative',
                    marginBottom: '12px',
                    cursor: (hasImage || hasVideo) ? 'pointer' : 'default',
                }}
            >
                {/* --- UNIFIED LOADER OVERLAY --- */}
                {/* Shows whenever generating image OR animating video */}
                {isBusy && (
                    <div style={{
                        position: 'absolute', inset: 0, zIndex: 10,
                        backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(2px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexDirection: 'column', gap: '8px'
                    }}>
                        <Loader2 className="animate-spin text-red-600" size={24} />
                        <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#fff', letterSpacing: '1px' }}>
                            {overlayText}
                        </span>
                    </div>
                )}

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
                            <option>{shot.shot_type}</option>
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
                            <option>POV</option>
                            <option>Insert Shot</option>
                            <option>Extreme Close Up</option>
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
                            <option value="" disabled>Select Location...</option>
                            <option value={shot.location}>{shot.location}</option>
                            {locations.filter(l => l.name !== shot.location).map(loc => (
                                <option key={loc.id} value={loc.name}>{loc.name}</option>
                            ))}
                        </select>
                        <ChevronDown
                            size={12}
                            style={{
                                position: 'absolute',
                                right: '8px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                color: '#666',
                                pointerEvents: 'none'
                            }}
                        />
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
                                    fontSize: '10px',
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
                {/* --- Header with Reference Upload Button --- */}
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
                            <ImagePlus size={10} /> {refFile ? "REF LOADED" : "ADD REF"}
                        </button>
                    </div>
                </div>

                <textarea
                    style={{ ...commonInputStyle, minHeight: '60px', resize: 'vertical' }}
                    value={localVisualAction}
                    onChange={(e) => {
                        setLocalVisualAction(e.target.value);
                        onUpdateShot(shot.id, "visual_action", e.target.value);
                    }}
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
                    value={localVideoPrompt}
                    onChange={(e) => {
                        setLocalVideoPrompt(e.target.value);
                        onUpdateShot(shot.id, "video_prompt", e.target.value);
                    }}
                    placeholder="Motion description..."
                />
            </div>

            {/* 6. ACTION FOOTER */}
            <div style={{ marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid #1a1a1a' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>

                    {/* BUTTON 1: GENERATE (With Ref File) */}
                    <button
                        onClick={() => onRender(refFile)}
                        disabled={isBusy}
                        style={{
                            padding: '10px',
                            backgroundColor: '#1a1a1a',
                            border: '1px solid #333',
                            color: isBusy ? '#666' : '#FFF',
                            fontSize: '10px',
                            fontWeight: 'bold',
                            cursor: isBusy ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            borderRadius: '4px',
                            transition: 'all 0.2s'
                        }}
                    >
                        <Sparkles size={14} /> {hasImage ? "RE-GEN" : "GENERATE"}
                    </button>

                    {/* BUTTON 2: FINALIZE (New Polishing Feature) */}
                    <button
                        onClick={onFinalize}
                        disabled={!hasImage || isBusy}
                        title={isFinalized ? "Already Finalized" : "Polish Texture & Lighting"}
                        style={{
                            padding: '10px',
                            backgroundColor: isFinalized ? 'rgba(245, 11, 11, 0.1)' : '#1a1a1a',
                            border: isFinalized ? '1px solid #FF0000' : '1px solid #333',
                            color: isFinalized ? '#FFF' : (hasImage ? '#FFF' : '#444'),
                            fontSize: '10px', fontWeight: 'bold',
                            cursor: (!hasImage || isBusy) ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', borderRadius: '4px',
                            transition: 'all 0.2s'
                        }}
                    >
                        {isFinalized ? <CheckCircle2 size={14} /> : <Wand2 size={14} />}
                        {isFinalized ? "DONE" : "FINALIZE"}
                    </button>
                </div>

                {/* BUTTON 3: ANIMATE (Full Width Below) */}
                <button
                    onClick={onAnimate}
                    disabled={!hasImage || isBusy}
                    style={{
                        width: '100%',
                        marginTop: '8px',
                        padding: '10px',
                        backgroundColor: (!hasImage) ? '#111' : '#FF0000',
                        border: (!hasImage) ? '1px solid #222' : 'none',
                        color: (!hasImage) ? '#444' : 'white',
                        fontSize: '10px',
                        fontWeight: 'bold',
                        cursor: (!hasImage || isBusy) ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        borderRadius: '4px',
                        transition: 'all 0.2s'
                    }}
                >
                    {hasVideo ? <RefreshCw size={14} /> : <Film size={14} fill={hasImage ? "white" : "gray"} />}
                    {hasVideo ? "REGENERATE VID" : "ANIMATE"}
                </button>
            </div>
        </div>
    );
};