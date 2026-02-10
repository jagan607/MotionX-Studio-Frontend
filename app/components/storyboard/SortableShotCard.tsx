"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    GripVertical, Trash2, Sparkles, Film, RefreshCw,
    ImagePlus, Mic2, Link2, Plus, CheckCircle2,
    Wand2, Loader2, Palette, XCircle, ShoppingBag // Added ShoppingBag icon, Upload
} from "lucide-react";
import imageCompression from 'browser-image-compression';

interface CastMember { id: string; name: string; }
interface Location { id: string; name: string; }
interface Product { id: string; name: string; } // [NEW] Simple Product Interface

interface Shot {
    id: string;
    shot_type: string;
    characters: string[];
    products?: string[]; // [NEW] Added products array
    visual_action: string;
    video_prompt?: string;
    location?: string;
    image_url?: string;
    video_url?: string;
    lipsync_url?: string;
    video_status?: string;
    status?: string;
    morph_to_next?: boolean;
}

interface SortableShotCardProps {
    shot: Shot;
    index: number;
    styles: any;
    onDelete: (id: string) => void;
    castMembers: CastMember[];
    locations: Location[];
    products?: Product[]; // [NEW] Added products prop
    onUpdateShot: (id: string, field: keyof Shot, value: any) => void;
    onRender: (referenceFile?: File | null, provider?: 'gemini' | 'seedream') => void;
    onAnimate: (provider: 'kling' | 'seedance', endFrameUrl?: string | null) => void;
    onFinalize: () => void;
    isRendering: boolean;
    onExpand: () => void;
    onLipSync: () => void;
    nextShotImage?: string;
    isMorphedByPrev?: boolean;
    onUploadImage: (file: File) => void;
    children: React.ReactNode;
}

const normalize = (str: string) => str ? str.toLowerCase().trim() : "";

export const SortableShotCard = ({
    shot,
    index,
    styles,
    onDelete,
    castMembers,
    locations,
    products = [], // Default to empty array
    onUpdateShot,
    onRender,
    onAnimate,
    onFinalize,
    isRendering,
    onExpand,
    onLipSync,
    nextShotImage,
    isMorphedByPrev = false,
    onUploadImage,
    children,
}: SortableShotCardProps) => {

    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: shot.id });

    // --- PROVIDER STATES ---
    const [videoProvider, setVideoProvider] = useState<'kling' | 'seedance'>('kling');
    const [imageProvider, setImageProvider] = useState<'gemini' | 'seedream'>('gemini');

    // Use DB state, fallback to false
    const isLinked = shot.morph_to_next === true;

    // Loading States
    const isGenerating = isRendering || shot.status === 'generating';
    const isAnimating = ['animating', 'processing', 'queued', 'pending'].includes(shot.video_status || '');
    const isBusy = isGenerating || isAnimating;
    const overlayText = isAnimating ? "ANIMATING..." : "GENERATING...";
    const isFinalized = shot.status === 'finalized';

    // Validation
    const hasImage = Boolean(shot.image_url);
    const hasVideo = Boolean(shot.video_url);
    const canLink = hasImage && Boolean(nextShotImage) && videoProvider === 'kling' && !isMorphedByPrev;

    // --- CAST TOGGLE LOGIC ---
    const handleCharToggle = (charId: string) => {
        if (isMorphedByPrev) return;
        const current = Array.isArray(shot.characters) ? shot.characters : [];
        const isPresent = current.includes(charId);
        let updated;
        if (isPresent) {
            updated = current.filter((c) => c !== charId);
        } else {
            updated = [...current, charId];
        }
        onUpdateShot(shot.id, "characters", updated);
    };

    // --- [NEW] PRODUCT TOGGLE LOGIC ---
    const handleProductToggle = (prodId: string) => {
        if (isMorphedByPrev) return;
        const current = Array.isArray(shot.products) ? shot.products : [];
        const isPresent = current.includes(prodId);
        let updated;
        if (isPresent) {
            updated = current.filter((p) => p !== prodId);
        } else {
            updated = [...current, prodId];
        }
        onUpdateShot(shot.id, "products", updated);
    };

    // --- REF IMAGE LOGIC ---
    const [refFile, setRefFile] = useState<File | null>(null);
    const [refPreviewUrl, setRefPreviewUrl] = useState<string | null>(null);
    const [isHoveringRef, setIsHoveringRef] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const mainImageInputRef = useRef<HTMLInputElement>(null);
    const [isCompressing, setIsCompressing] = useState(false);

    useEffect(() => {
        if (!refFile) {
            setRefPreviewUrl(null);
            return;
        }
        const objectUrl = URL.createObjectURL(refFile);
        setRefPreviewUrl(objectUrl);
        return () => URL.revokeObjectURL(objectUrl);
    }, [refFile]);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            setIsCompressing(true);
            try {
                const compressed = await imageCompression(e.target.files[0], { maxSizeMB: 1, maxWidthOrHeight: 1500, useWebWorker: true });
                setRefFile(compressed);
            } finally {
                setIsCompressing(false);
            }
        }
    };

    const handleMainImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            // Optional: Compress before upload if needed, but for now direct upload
            // or use existing compression if preferred.
            // Let's compress it gently to save bandwidth/storage, consistent with REF logic
            try {
                const compressed = await imageCompression(e.target.files[0], { maxSizeMB: 2, maxWidthOrHeight: 2048, useWebWorker: true });
                onUploadImage(compressed);
            } catch (err) {
                console.error("Compression failed", err);
                onUploadImage(e.target.files[0]);
            }
        }
    };

    const clearRefImage = (e: React.MouseEvent) => {
        e.stopPropagation();
        setRefFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    // Local Buffers
    const [localVisualAction, setLocalVisualAction] = useState(shot.visual_action || "");
    const [localVideoPrompt, setLocalVideoPrompt] = useState(shot.video_prompt || "");

    useEffect(() => { setLocalVisualAction(shot.visual_action || ""); }, [shot.visual_action]);
    useEffect(() => { setLocalVideoPrompt(shot.video_prompt || ""); }, [shot.video_prompt]);

    // --- STYLES ---
    let borderColor = '1px solid #222';
    if (isFinalized) borderColor = `1px solid rgba(255, 255, 255, 0.5)`;
    if (isMorphedByPrev) borderColor = `1px solid #FF0000`;

    const dragStyle = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 1000 : 1,
        opacity: isDragging ? 0.6 : 1,
        transformOrigin: "0 0",
        scale: isDragging ? "1.02" : "1",
        border: borderColor,
        backgroundColor: isFinalized ? "rgba(255, 255, 255, 0.05)" : "#0A0A0A",
        boxShadow: (isLinked || isMorphedByPrev) ? '0 0 0 1px #FF0000' : 'none'
    };

    const labelStyle: React.CSSProperties = { fontSize: '9px', color: isMorphedByPrev ? '#555' : '#666', marginBottom: '6px', display: 'block', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' };
    const inputStyle: React.CSSProperties = {
        width: '100%',
        backgroundColor: isMorphedByPrev ? '#111' : '#111',
        border: isMorphedByPrev ? '1px solid #330000' : '1px solid #222',
        color: isMorphedByPrev ? '#444' : '#e0e0e0',
        fontSize: '11px', padding: '8px 10px', borderRadius: '4px', outline: 'none',
        cursor: isMorphedByPrev ? 'not-allowed' : 'text'
    };

    const toggleStyle = (active: boolean) => ({
        flex: 1, padding: '6px', fontSize: '9px', fontWeight: 'bold',
        border: active ? '1px solid #FF0000' : '1px solid #333',
        backgroundColor: active ? 'rgba(255, 0, 0, 0.1)' : 'transparent',
        color: active ? '#FFF' : '#666',
        cursor: isBusy || isMorphedByPrev ? 'not-allowed' : 'pointer',
        borderRadius: '3px',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
        transition: 'all 0.2s'
    });

    return (
        <div ref={setNodeRef} style={{ ...styles?.shotCard, ...dragStyle, position: 'relative', display: 'flex', flexDirection: 'column' }}>

            {/* --- LOCKED OVERLAY LABEL --- */}
            {isMorphedByPrev && (
                <div style={{
                    position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
                    backgroundColor: '#FF0000', color: 'black', fontSize: '9px', fontWeight: 'bold',
                    padding: '2px 8px', borderRadius: '4px', zIndex: 60, display: 'flex', alignItems: 'center', gap: '4px',
                    boxShadow: '0 0 10px rgba(255,0,0,0.5)'
                }}>
                    <Link2 size={10} /> LINKED SEQUENCE
                </div>
            )}

            {/* --- GUTTER LINK BUTTON --- */}
            {canLink && (
                <>
                    {isLinked && (
                        <div style={{
                            position: 'absolute', top: '50%', right: '-30px', width: '40px', height: '2px',
                            backgroundColor: '#FF0000', zIndex: 40, transform: 'translateY(-50%)', boxShadow: '0 0 8px #FF0000'
                        }} />
                    )}
                    <div
                        onClick={() => onUpdateShot(shot.id, "morph_to_next", !isLinked)}
                        title={isLinked ? "Unlink from Next Shot" : "Morph into Next Shot"}
                        style={{
                            position: 'absolute', top: '50%', right: '-14px', transform: 'translateY(-50%)', zIndex: 50,
                            width: '28px', height: '28px', borderRadius: '50%',
                            backgroundColor: isLinked ? '#FF0000' : '#111',
                            border: isLinked ? '2px solid #000' : '1px solid #333',
                            color: isLinked ? 'white' : '#666',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                            boxShadow: isLinked ? '0 0 15px rgba(255,0,0,0.6)' : '0 2px 5px rgba(0,0,0,0.5)',
                            transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)'
                        }}
                    >
                        {isLinked ? <Link2 size={14} /> : <Plus size={14} />}
                    </div>
                </>
            )}

            {/* HEADER */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div {...attributes} {...listeners} style={{ cursor: 'grab', color: '#666', padding: '4px' }}><GripVertical size={18} /></div>
                    <span style={{ color: (isFinalized || isLinked || isMorphedByPrev) ? '#FF0000' : '#FF0000', fontWeight: 'bold', fontSize: '12px', letterSpacing: '1px' }}>
                        SHOT {String(index + 1).padStart(2, '0')} {isFinalized && "⭐"}
                    </span>
                </div>
                <button onClick={() => onDelete(shot.id)} style={{ background: 'none', border: 'none', color: '#444', cursor: 'pointer' }}><Trash2 size={16} /></button>
            </div>

            {/* PREVIEW */}
            <div onClick={(e) => { e.stopPropagation(); if (hasImage || hasVideo) onExpand(); }} style={{ position: 'relative', marginBottom: '12px', cursor: (hasImage || hasVideo) ? 'pointer' : 'default' }}>
                {isBusy && (
                    <div style={{ position: 'absolute', inset: 0, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '8px' }}>
                        <Loader2 className="animate-spin text-red-600" size={24} />
                        <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#fff', letterSpacing: '1px' }}>{overlayText}</span>
                    </div>
                )}
                {children}
            </div>

            {/* METADATA */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <div style={{ flex: 1 }}>
                    <label style={labelStyle}>SHOT TYPE</label>
                    <select disabled={isMorphedByPrev} style={inputStyle} defaultValue={shot.shot_type || "Wide Shot"} onChange={(e) => onUpdateShot(shot.id, "shot_type", e.target.value)}>
                        <option value="">{shot.shot_type}</option>
                        <option value="Wide Shot">Wide Shot</option>
                        <option value="Medium Shot">Medium Shot</option>
                        <option value="Close Up">Close Up</option>
                        <option value="Extreme Close Up">Extreme Close Up</option>
                        <option value="Medium Close Up">Medium Close Up</option>
                    </select>
                </div>
                <div style={{ flex: 1 }}>
                    <label style={labelStyle}>LOCATION</label>
                    <select disabled={isMorphedByPrev} style={inputStyle} value={shot.location || ""} onChange={(e) => onUpdateShot(shot.id, "location", e.target.value)}>
                        <option disabled value="">Select...</option>
                        <option value={shot.location}>{shot.location}</option>
                        {locations.filter(l => l.name !== shot.location).map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
                    </select>
                </div>
            </div>

            {/* [NEW] PRODUCTS SECTION */}
            {products && products.length > 0 && (
                <div style={{ marginBottom: '12px' }}>
                    <label style={labelStyle}>PRODUCTS</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {products.map((prod) => {
                            const isActive = Array.isArray(shot.products) && shot.products.includes(prod.id);

                            return (
                                <button
                                    disabled={isMorphedByPrev}
                                    key={prod.id}
                                    onClick={() => handleProductToggle(prod.id)}
                                    style={{
                                        fontSize: '10px', padding: '4px 10px', borderRadius: '4px', opacity: isMorphedByPrev ? 0.5 : 1,
                                        border: '1px solid #333',
                                        backgroundColor: isActive ? '#FF0000' : 'transparent',
                                        color: isActive ? 'white' : '#666',
                                        cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', gap: '4px'
                                    }}
                                >
                                    {prod.name}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* CASTING */}
            <div style={{ marginBottom: '12px' }}>
                <label style={labelStyle}>CASTING</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {castMembers.map((char) => {
                        const isActive = Array.isArray(shot.characters) && (
                            shot.characters.includes(char.id) ||
                            shot.characters.some(c => normalize(c) === normalize(char.name))
                        );
                        const baseStyle = styles?.charToggle ? styles.charToggle(isActive) : {};
                        return (
                            <button
                                disabled={isMorphedByPrev}
                                key={char.id}
                                onClick={() => handleCharToggle(char.id)}
                                style={{
                                    ...baseStyle,
                                    fontSize: '10px', padding: '4px 10px', borderRadius: '4px', opacity: isMorphedByPrev ? 0.5 : 1,
                                    border: '1px solid #333',
                                    backgroundColor: isActive ? '#FF0000' : 'transparent',
                                    color: isActive ? 'white' : '#666',
                                    cursor: 'pointer'
                                }}
                            >
                                {char.name}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* PROMPTS & REF IMAGE */}
            <div style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', position: 'relative' }}>
                    <label style={labelStyle}>IMAGE PROMPT</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', position: 'relative' }}>
                        <input disabled={isMorphedByPrev} type="file" ref={fileInputRef} onChange={handleFileSelect} style={{ display: 'none' }} accept="image/*" />
                        <input disabled={isMorphedByPrev || isBusy} type="file" ref={mainImageInputRef} onChange={handleMainImageSelect} style={{ display: 'none' }} accept="image/*" />
                        {/* REF BUTTON CONTAINER */}
                        <div
                            onMouseEnter={() => setIsHoveringRef(true)}
                            onMouseLeave={() => setIsHoveringRef(false)}
                            style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                            <button
                                disabled={isMorphedByPrev || isCompressing}
                                onClick={() => fileInputRef.current?.click()}
                                style={{
                                    background: 'none',
                                    border: refPreviewUrl ? '1px solid #00FF41' : 'none',
                                    color: (refFile && !isMorphedByPrev) ? '#00FF41' : '#666',
                                    cursor: (isMorphedByPrev || isCompressing) ? 'not-allowed' : 'pointer',
                                    fontSize: '9px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    fontWeight: 'bold',
                                    padding: refPreviewUrl ? '2px 6px' : '0',
                                    borderRadius: '4px',
                                    backgroundColor: refPreviewUrl ? 'rgba(0, 255, 65, 0.1)' : 'transparent'
                                }}
                            >
                                {isCompressing ? (
                                    <>
                                        <Loader2 size={10} className="animate-spin" /> PROCESSING
                                    </>
                                ) : refPreviewUrl ? (
                                    <>
                                        <div style={{
                                            width: '12px', height: '12px',
                                            backgroundImage: `url(${refPreviewUrl})`,
                                            backgroundSize: 'cover',
                                            borderRadius: '2px'
                                        }} />
                                        REF ACTIVE
                                    </>
                                ) : (
                                    <>
                                        <ImagePlus size={10} /> ADD REF
                                    </>
                                )}
                            </button>

                            {/* PERMANENT CROSS BUTTON (If Ref exists) */}
                            {refPreviewUrl && !isCompressing && !isMorphedByPrev && (
                                <button
                                    onClick={clearRefImage}
                                    style={{
                                        background: 'none', border: 'none',
                                        color: '#666', cursor: 'pointer',
                                        padding: '2px', display: 'flex', alignItems: 'center'
                                    }}
                                    title="Remove Reference"
                                >
                                    <XCircle size={12} className="hover:text-red-500 transition-colors" />
                                </button>
                            )}

                            {/* HOVER EXPANSION (Clean Preview Only) */}
                            {refPreviewUrl && isHoveringRef && !isCompressing && (
                                <div style={{
                                    position: 'absolute',
                                    bottom: '100%',
                                    right: 0,
                                    marginBottom: '8px',
                                    width: '160px',
                                    height: 'auto',
                                    backgroundColor: '#000',
                                    border: '1px solid #00FF41',
                                    borderRadius: '6px',
                                    overflow: 'hidden',
                                    zIndex: 9999,
                                    boxShadow: '0 4px 20px rgba(0,0,0,0.8)',
                                    pointerEvents: 'none'
                                }}>
                                    <img
                                        src={refPreviewUrl}
                                        alt="Ref Preview"
                                        style={{ width: '100%', height: 'auto', display: 'block' }}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <textarea disabled={isMorphedByPrev} style={inputStyle} minLength={60} value={isMorphedByPrev ? "Content determined by morph transition." : localVisualAction} onChange={(e) => { setLocalVisualAction(e.target.value); onUpdateShot(shot.id, "visual_action", e.target.value); }} placeholder="Visual description..." />
            </div>

            <div style={{ marginBottom: '15px' }}>
                <label style={labelStyle}>VIDEO PROMPT</label>
                <textarea disabled={isMorphedByPrev} style={inputStyle} minLength={60} value={isMorphedByPrev ? "Movement controlled by previous shot transition." : localVideoPrompt} onChange={(e) => { setLocalVideoPrompt(e.target.value); onUpdateShot(shot.id, "video_prompt", e.target.value); }} placeholder="Motion description..." />
            </div>

            {/* ACTION FOOTER */}
            <div style={{ marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid #1a1a1a', opacity: isMorphedByPrev ? 0.3 : 1, pointerEvents: isMorphedByPrev ? 'none' : 'auto' }}>

                {/* 1. IMAGE PROVIDER SELECTION */}
                <div style={{ display: 'flex', gap: '5px', marginBottom: '8px' }}>
                    <button
                        onClick={() => setImageProvider('seedream')}
                        style={toggleStyle(imageProvider === 'seedream')}
                    >
                        <Palette size={10} /> SEEDREAM (HQ)
                    </button>
                    <button
                        onClick={() => setImageProvider('gemini')}
                        style={toggleStyle(imageProvider === 'gemini')}
                    >
                        <Sparkles size={10} /> GEMINI
                    </button>
                </div>

                {/* 2. RE-GEN / FINALIZE */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                    <button
                        onClick={() => onRender(refFile, imageProvider)}
                        disabled={isBusy}
                        style={{ padding: '10px', backgroundColor: '#1a1a1a', border: '1px solid #333', color: isBusy ? '#666' : '#FFF', fontSize: '10px', fontWeight: 'bold', cursor: isBusy ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', borderRadius: '4px' }}
                    >
                        <Sparkles size={14} /> {hasImage ? "RE-GEN" : "GENERATE"}
                    </button>
                    <button onClick={onFinalize} disabled={!hasImage || isBusy} style={{ padding: '10px', backgroundColor: isFinalized ? 'rgba(245, 11, 11, 0.1)' : '#1a1a1a', border: isFinalized ? '1px solid #FF0000' : '1px solid #333', color: isFinalized ? '#FFF' : (hasImage ? '#FFF' : '#444'), fontSize: '10px', fontWeight: 'bold', cursor: (!hasImage || isBusy) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', borderRadius: '4px' }}>
                        {isFinalized ? <CheckCircle2 size={14} /> : <Wand2 size={14} />}
                        {isFinalized ? "DONE" : "FINALIZE"}
                    </button>
                </div>

                {/* MANUAL UPLOAD */}
                <div style={{ marginBottom: '8px' }}>
                    <button
                        onClick={() => mainImageInputRef.current?.click()}
                        disabled={isBusy}
                        style={{
                            width: '100%',
                            padding: '8px',
                            backgroundColor: '#111',
                            border: '1px dashed #333',
                            color: '#888',
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
                        <Upload size={12} /> UPLOAD IMAGE DIRECTLY
                    </button>
                </div>

                {/* 3. VIDEO PROVIDER TOGGLE */}
                {hasImage && !isBusy && (
                    <div style={{ display: 'flex', gap: '5px', marginBottom: '8px' }}>
                        <button onClick={() => setVideoProvider('kling')} style={toggleStyle(videoProvider === 'kling')}>KLING (HQ)</button>
                        <button onClick={() => { if (!isLinked) setVideoProvider('seedance'); }} disabled={isLinked} style={{ ...toggleStyle(videoProvider === 'seedance'), opacity: isLinked ? 0.3 : 1 }}>SEEDANCE</button>
                    </div>
                )}

                {/* 4. ANIMATE BUTTON */}
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        onClick={() => onAnimate(videoProvider, isLinked ? nextShotImage : null)}
                        disabled={!hasImage || isBusy}
                        style={{
                            flex: 1, padding: '10px',
                            backgroundColor: isLinked ? '#FF0000' : (hasImage ? '#1a1a1a' : '#111'),
                            border: isLinked ? '1px solid #FF0000' : (hasImage ? '1px solid #333' : '1px solid #222'),
                            color: isLinked ? '#FFF' : (hasImage ? '#FFF' : '#444'),
                            fontSize: '10px', fontWeight: 'bold', cursor: (!hasImage || isBusy) ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', borderRadius: '4px', transition: 'all 0.2s'
                        }}
                    >
                        {isLinked ? (
                            <>
                                <Link2 size={14} /> MORPH TO NEXT SHOT
                            </>
                        ) : (
                            <>
                                {hasVideo ? <RefreshCw size={14} /> : <Film size={14} fill={hasImage ? "white" : "gray"} />}
                                {hasVideo ? "RE-ANIMATE" : "ANIMATE"}
                            </>
                        )}
                    </button>

                    {hasVideo && (
                        <button onClick={onLipSync} disabled={isBusy} style={{ width: '42px', padding: '0', backgroundColor: '#1a1a1a', border: '1px solid #333', color: '#FFF', cursor: isBusy ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px' }}>
                            <Mic2 size={16} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};