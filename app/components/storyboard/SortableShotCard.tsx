"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    GripVertical, Trash2, Sparkles, Film,
    Link2, Plus, CheckCircle2,
    Wand2, Loader2, Palette, XCircle, Upload, Settings, Pin, Volume2, AlertTriangle, X,
    ImageIcon, Clapperboard, Aperture
} from "@/lib/lucide";
import imageCompression from 'browser-image-compression';
import type { VideoProvider } from '@/app/hooks/shot-manager/useShotVideoGen';
import { usePricing } from '@/app/hooks/usePricing';
import { TokenIcon } from '@/components/ui/TokenIcon';
import { getErrorUIConfig, executeErrorAction } from '@/lib/errorDictionary';
import { SHOT_TYPE_PRESETS, CAMERA_ANGLES } from '@/lib/shot-constants';
import type { CameraTransform } from '@/lib/types';
import { EMERGENCY_MODE } from '@/lib/emergencyConfig';
import dynamic from 'next/dynamic';

const InlineCameraGizmo = dynamic(() => import('./InlineCameraGizmo').then(m => ({ default: m.InlineCameraGizmo })), { ssr: false });

interface CastMember { id: string; name: string; }
interface Location { id: string; name: string; }
interface Product { id: string; name: string; }

interface Shot {
    id: string;
    shot_type: string;
    characters: string[];
    products?: string[];
    visual_action: string;
    video_prompt?: string;
    location?: string;
    image_url?: string;
    video_url?: string;
    lipsync_url?: string;
    video_status?: string;
    video_error?: string;
    error_message?: string;
    error_code?: string;
    status?: string;
    morph_to_next?: boolean;
    prompt: string;
    estimated_duration?: number;
    is_upscaled?: boolean;
    upscale_status?: string;
    upscale_error?: string;
    image_url_original?: string;
    camera_transform?: {
        x: number;
        y: number;
        z: number;
        rx: number;
        ry: number;
        fov: number;
    };
    camera_shot_type?: string;
    location_angle?: string;
    camera_direction?: string;
    continuity_note?: string;
    ambient_scene?: string;
}

interface SortableShotCardProps {
    shot: Shot;
    index: number;
    styles: any;
    onDelete: (id: string) => void;
    castMembers: CastMember[];
    locations: Location[];
    products?: Product[];
    onUpdateShot: (id: string, field: keyof Shot, value: any) => void;
    onRender: (referenceFile?: File | null, provider?: 'gemini' | 'seedream', continuityRefId?: string | null, cameraTransform?: any, cameraShotType?: string, modelTier?: 'flash' | 'pro') => void;
    onEdit: () => void;
    onUpscale: (modelTier: 'flash' | 'pro') => void;
    isRendering: boolean;
    onExpand: () => void;
    nextShotImage?: string;
    isMorphedByPrev?: boolean;
    onUploadImage: (file: File) => void;
    onLipSync?: () => void;
    tourId?: string;
    children: React.ReactNode;
    continuityRefId?: string | null;
    onSetContinuityRef?: (id: string | null) => void;
    onOpenGizmo?: () => void;
    onSaveCamera?: (transform: CameraTransform, shotType: string) => void;
    onRegenerateCamera?: (transform: CameraTransform, shotType: string, provider?: string) => void;
    onExpandGizmo?: () => void;
    onTopUp?: () => void;
    onRetryAnimate?: () => void;
    onFocusPrompt?: () => void;
    onImageConfig?: () => void;
}

const normalize = (str: string) => str ? str.toLowerCase().trim() : "";

export const SortableShotCard = ({
    shot,
    index,
    styles,
    onDelete,
    castMembers,
    locations,
    products = [],
    onUpdateShot,
    onRender,
    onEdit,
    onUpscale,
    isRendering,
    onExpand,
    nextShotImage,
    isMorphedByPrev = false,
    onUploadImage,
    onLipSync,
    tourId,
    children,
    continuityRefId,
    onSetContinuityRef,
    onOpenGizmo,
    onSaveCamera,
    onRegenerateCamera,
    onExpandGizmo,
    onTopUp,
    onRetryAnimate,
    onFocusPrompt,
    onImageConfig,
}: SortableShotCardProps) => {

    const isPinned = continuityRefId === shot.id;

    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: shot.id });

    // --- Provider States ---
    const [imageProvider, setImageProvider] = useState<'gemini' | 'seedream'>(EMERGENCY_MODE ? 'seedream' : 'gemini');
    const [modelTier, setModelTier] = useState<'flash' | 'pro'>('pro');

    // Linked State
    const isLinked = shot.morph_to_next === true;

    // Loading States
    const isGenerating = isRendering || shot.status === 'generating';
    const isAnimating = ['animating', 'processing', 'queued', 'pending'].includes(shot.video_status || '');
    const isVideoError = (shot.video_status === 'error' || shot.video_status === 'failed') && !isMorphedByPrev;
    const isImageError = (shot.status === 'failed' || shot.status === 'error') && !isMorphedByPrev;
    const hasError = (isVideoError || isImageError) && !!(shot.error_code || shot.video_error || shot.error_message);
    const isUpscaled = shot.is_upscaled === true;
    const isUpscaling = !isUpscaled && (shot.status === 'upscaling' || shot.upscale_status === 'processing');
    const isBusy = isGenerating || isAnimating || isUpscaling;

    // Error dismissal state — resets when a new error arrives
    const [errorDismissed, setErrorDismissed] = useState(false);
    const errorFingerprint = `${shot.error_code || ''}:${shot.video_error || ''}:${shot.video_status || ''}:${shot.status || ''}`;
    useEffect(() => { setErrorDismissed(false); }, [errorFingerprint]);

    // Collapsible metadata toggle
    const [showMore, setShowMore] = useState(false);

    // Inline camera mode
    const [cameraMode, setCameraMode] = useState(false);

    // Resolve error UI config from dictionary
    const errorConfig = hasError ? getErrorUIConfig(shot.error_code, shot.error_message || shot.video_error) : null;

    let overlayText = "Generating...";
    if (isAnimating) overlayText = "Animating...";
    if (isUpscaling) overlayText = "Upscaling...";

    // Validation
    const hasImage = Boolean(shot.image_url);
    const hasVideo = Boolean(shot.video_url);
    const canLink = hasImage && Boolean(nextShotImage) && !isMorphedByPrev;

    // --- Pricing ---
    const { getImageCost, getUpscaleCost } = usePricing();
    const imageCost = getImageCost(imageProvider, modelTier, 'shot');
    const upscaleCost = getUpscaleCost(modelTier);

    // --- Cast Toggle Logic ---
    const handleCharToggle = (charId: string) => {
        const current = Array.isArray(shot.characters) ? [...shot.characters] : [];
        const isActive = current.includes(charId) || current.some(c => normalize(c) === normalize(castMembers.find(cm => cm.id === charId)?.name || ''));
        let updated;
        if (isActive) {
            updated = current.filter(c => c !== charId && normalize(c) !== normalize(castMembers.find(cm => cm.id === charId)?.name || ''));
        } else {
            updated = [...current, charId];
        }
        onUpdateShot(shot.id, "characters", updated);
    };

    // --- Product Toggle Logic ---
    const handleProductToggle = (prodId: string) => {
        const current = Array.isArray(shot.products) ? [...shot.products] : [];
        let updated;
        if (current.includes(prodId)) {
            updated = current.filter(id => id !== prodId);
        } else {
            updated = [...current, prodId];
        }
        onUpdateShot(shot.id, "products", updated);
    };

    // --- Upload Image Logic ---
    const mainImageInputRef = useRef<HTMLInputElement>(null);

    const handleMainImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            try {
                const compressed = await imageCompression(e.target.files[0], { maxSizeMB: 2, maxWidthOrHeight: 2048, useWebWorker: true });
                onUploadImage(compressed);
            } catch (err) {
                console.error("Compression failed", err);
                onUploadImage(e.target.files[0]);
            }
        }
    };

    // Local Buffers
    const [localVisualAction, setLocalVisualAction] = useState(shot.visual_action || "");
    const [localVideoPrompt, setLocalVideoPrompt] = useState(shot.video_prompt || "");
    const imagePromptRef = useRef<HTMLTextAreaElement>(null);
    const videoPromptRef = useRef<HTMLTextAreaElement>(null);

    const autoResize = (el: HTMLTextAreaElement | null) => {
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${el.scrollHeight}px`;
    };

    useEffect(() => { setLocalVisualAction(shot.visual_action || ""); }, [shot.visual_action]);
    useEffect(() => { setLocalVideoPrompt(shot.video_prompt || ""); }, [shot.video_prompt]);
    useEffect(() => { autoResize(imagePromptRef.current); }, [localVisualAction]);
    useEffect(() => { autoResize(videoPromptRef.current); }, [localVideoPrompt]);

    // Shot Type combo-box state
    const [localShotType, setLocalShotType] = useState(shot.shot_type || "");
    const [isCustomShotType, setIsCustomShotType] = useState(() => !!shot.shot_type && !(SHOT_TYPE_PRESETS as readonly string[]).includes(shot.shot_type));
    const customInputRef = useRef<HTMLInputElement>(null);
    useEffect(() => {
        setLocalShotType(shot.shot_type || "");
        setIsCustomShotType(!!shot.shot_type && !(SHOT_TYPE_PRESETS as readonly string[]).includes(shot.shot_type));
    }, [shot.shot_type]);

    // Keep the shot type input scrolled to the start so text is visible from the left
    // Only reset when value syncs from the shot prop, not while the user is typing
    useEffect(() => {
        const el = customInputRef.current;
        if (el && document.activeElement !== el) {
            el.scrollLeft = 0;
        }
    }, [localShotType, isCustomShotType]);

    // --- Drag Style ---
    const dragStyle = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 1000 : 1,
    };

    // --- Pill button helper ---
    const pillBtn = (active: boolean) =>
        `flex-1 px-2 py-1.5 text-[10px] font-semibold rounded-md text-center transition-all cursor-pointer select-none
        ${active
            ? 'bg-[#D40A12]/15 text-white border border-[#D40A12]/60'
            : 'bg-white/[0.03] text-neutral-500 border border-white/[0.08] hover:border-white/20 hover:text-neutral-300'
        }
        ${isBusy || isMorphedByPrev ? '!cursor-not-allowed' : ''}`;

    // Tag button helper
    const tagBtn = (active: boolean) =>
        `px-2.5 py-1 text-[10px] rounded-md border transition-all cursor-pointer select-none
        ${active
            ? 'bg-[#D40A12] text-white border-[#D40A12]'
            : 'bg-transparent text-neutral-500 border-white/[0.1] hover:border-white/20 hover:text-neutral-300'
        }
        ${isMorphedByPrev ? 'opacity-40 !cursor-not-allowed' : ''}`;

    return (
        <div
            ref={setNodeRef}
            id={tourId}
            style={dragStyle}
            data-shot-id={shot.id}
            data-shot-index={index + 1}
            data-shot-type={shot.shot_type || "unset"}
            data-shot-status={isGenerating ? "generating" : isAnimating ? "animating" : isUpscaling ? "upscaling" : hasError ? "error" : hasVideo ? "video_ready" : hasImage ? "image_ready" : "empty"}
            data-shot-has-image={hasImage ? "true" : "false"}
            data-shot-has-video={hasVideo ? "true" : "false"}
            data-shot-location={shot.location || ""}
            data-shot-prompt={localVisualAction?.slice(0, 120) || ""}
            data-shot-characters={Array.isArray(shot.characters) ? shot.characters.join(",") : ""}
            data-shot-is-linked={isLinked ? "true" : "false"}
            data-shot-is-pinned={isPinned ? "true" : "false"}
            data-shot-is-upscaled={isUpscaled ? "true" : "false"}
            className={`relative flex flex-col rounded-xl p-4
                ${isDragging ? 'opacity-60 scale-[1.02]' : 'opacity-100'}
                ${isUpscaled ? 'bg-white/[0.04] border border-white/20' : 'bg-[#0A0A0A]/60 backdrop-blur-xl border border-white/[0.08]'}
                ${isMorphedByPrev ? 'border-[#D40A12]/60' : ''}
                ${(isLinked || isMorphedByPrev) ? 'shadow-[0_0_0_1px_#D40A12]' : ''}
                ${cameraMode ? 'col-span-2' : ''}
                transition-all duration-300 ease-out hover:border-white/[0.15]
            `}
        >

            {/* ── Linked Sequence Label ── */}
            {isMorphedByPrev && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-[#D40A12] text-white text-[9px] font-bold px-2 py-0.5 rounded-md z-[60] flex items-center gap-1 shadow-[0_0_10px_rgba(212,10,18,0.4)]">
                    <Link2 size={9} /> Linked
                </div>
            )}

            {/* ── Gutter Link Button ── */}
            {canLink && (
                <>
                    {isLinked && (
                        <div className="absolute top-1/2 -right-[30px] w-10 h-0.5 bg-[#D40A12] z-40 -translate-y-1/2 shadow-[0_0_8px_#D40A12]" />
                    )}
                    <div
                        onClick={() => onUpdateShot(shot.id, "morph_to_next", !isLinked)}
                        title={isLinked ? "Unlink" : "Morph into Next Shot"}
                        className={`absolute top-1/2 -right-3.5 -translate-y-1/2 z-50 w-7 h-7 rounded-full flex items-center justify-center cursor-pointer transition-all
                            ${isLinked
                                ? 'bg-[#D40A12] border-2 border-black text-white shadow-[0_0_15px_rgba(212,10,18,0.5)]'
                                : 'bg-[#1a1a1a] border border-white/[0.15] text-neutral-500 shadow-md hover:border-white/30'
                            }
                        `}
                    >
                        {isLinked ? <Link2 size={13} /> : <Plus size={13} />}
                    </div>
                </>
            )}

            {/* ── Header ── */}
            <div className="mb-3">
                {/* Top row: drag + label + delete */}
                <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-neutral-600 hover:text-neutral-400 transition-colors p-0.5">
                            <GripVertical size={16} />
                        </div>
                        <span className="text-[11px] font-bold tracking-wide text-[#D40A12] flex items-center gap-1.5">
                            Shot {String(index + 1).padStart(2, '0')}
                            {isUpscaled && <span className="ml-1 text-[9px] font-bold text-cyan-400 bg-cyan-400/10 px-1.5 py-0.5 rounded">4K</span>}
                            {hasError && errorDismissed && (
                                <span className="text-amber-400 text-xs" title={errorConfig?.title || 'Last generation failed'}>⚠️</span>
                            )}
                        </span>
                    </div>
                    <button onClick={() => onDelete(shot.id)} className="bg-transparent border-none text-neutral-600 hover:text-red-500 cursor-pointer transition-colors p-1 rounded-md hover:bg-white/[0.05]">
                        <Trash2 size={14} />
                    </button>
                </div>

                {/* Feature toolbar */}
                {(onSetContinuityRef || onOpenGizmo) && (
                    <div className="flex items-center gap-1.5 pt-2 border-t border-white/[0.06]">
                        {onSetContinuityRef && (
                            <button
                                onClick={() => onSetContinuityRef(isPinned ? null : shot.id)}
                                title={isPinned ? 'Remove as reference' : 'Pin as character reference for consistency'}
                                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-[0.5px] transition-all cursor-pointer border
                                    ${isPinned
                                        ? 'bg-[#D40A12]/15 text-[#D40A12] border-[#D40A12]/40 shadow-[0_0_8px_rgba(212,10,18,0.1)]'
                                        : 'bg-white/[0.03] text-neutral-500 border-white/[0.08] hover:border-white/[0.15] hover:text-neutral-300'
                                    }`}
                            >
                                <Pin size={11} className={isPinned ? 'fill-[#D40A12]' : ''} />
                                {isPinned ? 'Pinned' : 'Pin Ref'}
                            </button>
                        )}
                        {onOpenGizmo && (
                            <button
                                onClick={() => setCameraMode(!cameraMode)}
                                title={cameraMode ? 'Exit Camera Mode' : 'Open Camera Framing'}
                                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-[0.5px] transition-all cursor-pointer border
                                    ${cameraMode
                                        ? 'bg-[#D40A12]/15 text-[#D40A12] border-[#D40A12]/40'
                                        : 'bg-white/[0.03] text-neutral-500 border-white/[0.08] hover:border-white/[0.15] hover:text-neutral-300'
                                    }`}
                            >
                                <Aperture size={11} />
                                {cameraMode ? 'Exit Cam' : 'Camera'}
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* ── Preview / Camera Gizmo ── */}
            {cameraMode && hasImage ? (
                <div className="mb-3">
                    <InlineCameraGizmo
                        imageUrl={shot.image_url!}
                        initialTransform={shot.camera_transform}
                        isGenerating={isBusy}
                        onClose={() => setCameraMode(false)}
                        onSave={(transform, shotType) => {
                            onSaveCamera?.(transform, shotType);
                            setCameraMode(false);
                        }}
                        onRegenerate={(transform, shotType, provider) => {
                            onRegenerateCamera?.(transform, shotType, provider);
                        }}
                        onExpand={() => {
                            setCameraMode(false);
                            onExpandGizmo?.();
                        }}
                    />
                </div>
            ) : (
                <div
                    onClick={(e) => { e.stopPropagation(); if (hasImage || hasVideo) onExpand(); }}
                    className={`relative mb-3 rounded-lg overflow-hidden ${(hasImage || hasVideo) ? 'cursor-pointer' : ''}`}
                >
                    {isBusy && (
                        <div className="absolute inset-0 z-10 overflow-hidden rounded-lg">
                            {/* Flowing gradient blobs — theme reds */}
                            <div className="absolute inset-0 bg-black/40">
                                <div className="absolute w-[60%] h-[60%] rounded-full bg-[#D40A12]/30 blur-[40px]"
                                    style={{ animation: 'flowBlob1 4s ease-in-out infinite', top: '10%', left: '10%' }} />
                                <div className="absolute w-[50%] h-[50%] rounded-full bg-[#ff4d4d]/15 blur-[40px]"
                                    style={{ animation: 'flowBlob2 5s ease-in-out infinite', top: '40%', right: '5%' }} />
                                <div className="absolute w-[40%] h-[40%] rounded-full bg-[#D40A12]/20 blur-[35px]"
                                    style={{ animation: 'flowBlob3 6s ease-in-out infinite', bottom: '5%', left: '30%' }} />
                            </div>
                            {/* Frosted glass layer */}
                            <div className="absolute inset-0 backdrop-blur-xl bg-white/[0.03]" />
                            {/* Label only */}
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-[10px] font-semibold text-white/60 tracking-[3px] uppercase"
                                    style={{ animation: 'shimmerText 2s ease-in-out infinite' }}>
                                    {overlayText}
                                </span>
                            </div>
                            <style jsx>{`
                                @keyframes flowBlob1 {
                                    0%, 100% { transform: translate(0, 0) scale(1); }
                                    33% { transform: translate(30%, 20%) scale(1.2); }
                                    66% { transform: translate(-10%, 30%) scale(0.9); }
                                }
                                @keyframes flowBlob2 {
                                    0%, 100% { transform: translate(0, 0) scale(1); }
                                    33% { transform: translate(-30%, -20%) scale(1.1); }
                                    66% { transform: translate(10%, -10%) scale(1.3); }
                                }
                                @keyframes flowBlob3 {
                                    0%, 100% { transform: translate(0, 0) scale(1.1); }
                                    33% { transform: translate(20%, -30%) scale(0.8); }
                                    66% { transform: translate(-20%, 10%) scale(1.2); }
                                }
                                @keyframes shimmerText {
                                    0%, 100% { opacity: 0.6; }
                                    50% { opacity: 0.3; }
                                }
                            `}</style>
                        </div>
                    )}
                    {/* Pinned REF badge */}
                    {isPinned && (
                        <div className="absolute top-2 left-2 z-20 flex items-center gap-1 bg-[#D40A12] text-white text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md shadow-[0_0_8px_rgba(212,10,18,0.4)]">
                            <Pin size={8} className="fill-white" /> REF
                        </div>
                    )}
                    {children}
                </div>
            )}

            {/* ── Error Overlay (Video + Image) ── */}
            {hasError && !errorDismissed && errorConfig && (
                <div className="relative mb-2 rounded-lg border border-red-500/30 bg-gradient-to-b from-red-500/[0.08] to-red-900/[0.04] overflow-hidden">
                    {/* Dismiss Button */}
                    <button
                        onClick={(e) => { e.stopPropagation(); setErrorDismissed(true); }}
                        className="absolute top-1.5 right-1.5 z-10 w-5 h-5 rounded-full flex items-center justify-center bg-white/[0.06] hover:bg-white/[0.15] text-neutral-500 hover:text-white transition-all cursor-pointer"
                        title="Dismiss error"
                    >
                        <X size={10} />
                    </button>

                    <div className="flex items-start gap-2.5 px-3 py-2.5 pr-8">
                        {/* Icon */}
                        <span className="text-lg leading-none mt-0.5 shrink-0">{errorConfig.icon}</span>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                            <span className="text-[11px] font-bold text-red-300 block">{errorConfig.title}</span>
                            <span className="text-[10px] text-red-400/80 leading-snug block mt-0.5">{errorConfig.message}</span>
                            <span className="text-[9px] text-red-400/50 block mt-1">Credits refunded.</span>
                        </div>
                    </div>

                    {/* Action Button */}
                    {errorConfig.actionType !== 'wait' && (
                        <div className="px-3 pb-2.5">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    executeErrorAction(errorConfig.actionType, {
                                        onRetry: onRetryAnimate,
                                        onEdit: onFocusPrompt,
                                        onTopUp: onTopUp,
                                        onReupload: onFocusPrompt,
                                    });
                                }}
                                className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[10px] font-bold
                                    bg-red-500/15 text-red-300 border border-red-500/30
                                    hover:bg-red-500/25 hover:border-red-500/50 hover:text-red-200
                                    transition-all cursor-pointer"
                            >
                                {errorConfig.actionText}
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* ── Primary Actions — Generate + Animate ── */}
            <div className={`grid grid-cols-2 gap-2 mb-3 ${isMorphedByPrev ? 'opacity-30 pointer-events-none' : ''}`}>
                {onImageConfig && (
                    <button
                        onClick={onImageConfig}
                        disabled={isBusy}
                        data-agent={`generate-image-shot-${index + 1}`}
                        className="flex items-center justify-center gap-2 py-2 rounded-lg bg-[#D40A12]/10 hover:bg-[#D40A12]/20 border border-[#D40A12]/40 text-[10px] font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Sparkles size={13} className="text-[#D40A12]" />
                        Generate
                    </button>
                )}
                <button
                    id={tourId ? `${tourId}-settings` : undefined}
                    onClick={onEdit}
                    disabled={isBusy}
                    data-agent={`animate-shot-${index + 1}`}
                    className="flex items-center justify-center gap-2 py-2 rounded-lg bg-[#D40A12]/10 hover:bg-[#D40A12]/20 border border-[#D40A12]/40 text-[10px] font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Clapperboard size={13} className="text-[#D40A12]" />
                    Animate
                </button>
            </div>
            {/* ── Metadata ── */}
            <div className="flex gap-2 mb-3">
                <div className="flex-1">
                    <label className="text-[9px] font-semibold text-neutral-500 mb-1 block">Shot Type</label>
                    {isCustomShotType ? (
                        <div className="flex gap-1">
                            <input
                                ref={customInputRef}
                                autoFocus
                                disabled={isMorphedByPrev}
                                value={localShotType}
                                onChange={(e) => setLocalShotType(e.target.value)}
                                onBlur={() => { if (localShotType !== shot.shot_type) onUpdateShot(shot.id, "shot_type", localShotType); }}
                                onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                                placeholder="Type custom shot type..."
                                className="flex-1 bg-white/[0.03] border border-[#D40A12]/40 text-neutral-200 text-[11px] px-2.5 py-2 rounded-lg outline-none focus:border-[#D40A12]/60 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            />
                            <button
                                onClick={() => {
                                    setIsCustomShotType(false);
                                    setLocalShotType(shot.shot_type || "Wide Shot");
                                    onUpdateShot(shot.id, "shot_type", shot.shot_type || "Wide Shot");
                                }}
                                className="px-1.5 bg-white/[0.03] border border-white/[0.08] rounded-lg text-neutral-500 hover:text-white hover:border-white/20 transition-colors cursor-pointer"
                                title="Back to presets"
                            >
                                <XCircle size={12} />
                            </button>
                        </div>
                    ) : (
                        <select
                            disabled={isMorphedByPrev}
                            value={localShotType}
                            onChange={(e) => {
                                if (e.target.value === '__custom__') {
                                    setIsCustomShotType(true);
                                    setLocalShotType('');
                                } else {
                                    setLocalShotType(e.target.value);
                                    onUpdateShot(shot.id, "shot_type", e.target.value);
                                }
                            }}
                            className="w-full bg-white/[0.03] border border-white/[0.08] text-neutral-200 text-[11px] px-2.5 py-2 rounded-lg outline-none focus:border-[#D40A12]/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {SHOT_TYPE_PRESETS.map(st => <option key={st} value={st}>{st}</option>)}
                            <option value="__custom__">✏️ Custom...</option>
                        </select>
                    )}
                </div>
                {shot.estimated_duration ? (
                    <div className="w-12 shrink-0">
                        <label className="text-[9px] font-semibold text-neutral-500 mb-1 block">Dur.</label>
                        <div className="w-full bg-white/[0.03] border border-white/[0.08] text-amber-400 text-[11px] px-2.5 py-2 rounded-lg text-center font-mono font-bold">
                            {shot.estimated_duration}s
                        </div>
                    </div>
                ) : null}
                <div className="flex-1">
                    <label className="text-[9px] font-semibold text-neutral-500 mb-1 block">Location</label>
                    <select
                        disabled={isMorphedByPrev}
                        value={shot.location || ""}
                        onChange={(e) => onUpdateShot(shot.id, "location", e.target.value)}
                        className="w-full bg-white/[0.03] border border-white/[0.08] text-neutral-200 text-[11px] px-2.5 py-2 rounded-lg outline-none focus:border-[#D40A12]/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        <option value="">NONE</option>
                        {shot.location && !locations.find(l => l.name === shot.location) && (
                            <option value={shot.location}>{shot.location}</option>
                        )}
                        {locations.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
                    </select>
                </div>
            </div>

            {/* ── Camera Angle + Products (collapsible) ── */}
            <button
                onClick={() => setShowMore(!showMore)}
                className="w-full flex items-center gap-1.5 mb-2 text-[8px] font-bold uppercase tracking-[1.5px] text-neutral-600 hover:text-neutral-400 transition-colors cursor-pointer bg-transparent border-none py-1"
            >
                <span className={`transition-transform duration-200 ${showMore ? 'rotate-90' : ''}`}>▸</span>
                {showMore ? 'Less' : 'More Details'}
            </button>
            {showMore && (
                <>
                    <div className="flex gap-2 mb-3">
                        <div className="flex-1">
                            <label className="text-[9px] font-semibold text-neutral-500 mb-1 block">Camera Angle</label>
                            <select
                                disabled={isMorphedByPrev}
                                value={shot.location_angle || "front"}
                                onChange={(e) => onUpdateShot(shot.id, "location_angle", e.target.value)}
                                className="w-full bg-white/[0.03] border border-white/[0.08] text-neutral-200 text-[11px] px-2.5 py-2 rounded-lg outline-none focus:border-[#D40A12]/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                {CAMERA_ANGLES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
                            </select>
                        </div>
                    </div>

                    {products.length > 0 && (
                        <div className="mb-3">
                            <label className="text-[9px] font-semibold text-neutral-500 mb-1.5 block">Products</label>
                            <div className="flex flex-wrap gap-1.5">
                                {products.map((prod) => {
                                    const isActive = Array.isArray(shot.products) && shot.products.includes(prod.id);
                                    return (
                                        <button key={prod.id} disabled={isMorphedByPrev} onClick={() => handleProductToggle(prod.id)} className={tagBtn(isActive)}>
                                            {prod.name}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* ── Cast ── */}
            <div className="mb-3">
                <label className="text-[9px] font-semibold text-neutral-500 mb-1.5 block">Cast</label>
                <div className="flex flex-wrap gap-1.5">
                    {castMembers.map((char) => {
                        const isActive = Array.isArray(shot.characters) && (
                            shot.characters.includes(char.id) ||
                            shot.characters.some(c => normalize(c) === normalize(char.name))
                        );
                        return (
                            <button key={char.id} disabled={isMorphedByPrev} onClick={() => handleCharToggle(char.id)} className={tagBtn(isActive)}>
                                {char.name}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ── Image Prompt ── */}
            <div className="mb-3">
                <div className="flex justify-between items-center mb-1.5">
                    <label className="text-[9px] font-semibold text-neutral-500" id={tourId ? `${tourId}-prompt` : undefined}>Image Prompt</label>
                    <input disabled={isMorphedByPrev || isBusy} type="file" ref={mainImageInputRef} onChange={handleMainImageSelect} className="hidden" accept="image/*" />
                </div>
                <textarea
                    ref={imagePromptRef}
                    disabled={isMorphedByPrev}
                    value={isMorphedByPrev ? "Content determined by morph transition." : localVisualAction}
                    onChange={(e) => { setLocalVisualAction(e.target.value); onUpdateShot(shot.id, "visual_action", e.target.value); }}
                    placeholder="Visual description..."
                    className="w-full bg-white/[0.03] border border-white/[0.08] text-neutral-200 text-[11px] px-2.5 py-2 rounded-lg outline-none focus:border-[#D40A12]/40 resize-none transition-colors placeholder:text-neutral-600 disabled:opacity-40 disabled:cursor-not-allowed overflow-hidden"
                    rows={2}
                    style={{ minHeight: '3rem' }}
                />
            </div>

            {/* ── Video Prompt ── */}
            <div className="mb-3">
                <label className="text-[9px] font-semibold text-neutral-500 mb-1.5 block">Video Prompt</label>
                <textarea
                    ref={videoPromptRef}
                    disabled={isMorphedByPrev}
                    value={isMorphedByPrev ? "Movement controlled by previous shot transition." : localVideoPrompt}
                    onChange={(e) => { setLocalVideoPrompt(e.target.value); onUpdateShot(shot.id, "video_prompt", e.target.value); }}
                    placeholder="Motion description..."
                    className="w-full bg-white/[0.03] border border-white/[0.08] text-neutral-200 text-[11px] px-2.5 py-2 rounded-lg outline-none focus:border-[#D40A12]/40 resize-none transition-colors placeholder:text-neutral-600 disabled:opacity-40 disabled:cursor-not-allowed overflow-hidden"
                    rows={1}
                    style={{ minHeight: '2rem' }}
                />
            </div>

            {/* ── Secondary Actions ── */}
            <div className={`mt-auto pt-2 border-t border-white/[0.06] ${isMorphedByPrev ? 'opacity-30 pointer-events-none' : ''}`}>

                {/* Lip Sync — only when video exists */}
                {hasVideo && onLipSync && !EMERGENCY_MODE && (
                    <button
                        onClick={onLipSync}
                        disabled={isBusy}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 mb-1.5 rounded-lg text-[10px] font-bold bg-white/[0.04] text-white/80 border border-white/[0.08] hover:border-[#D40A12]/40 hover:bg-[#D40A12]/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        <Volume2 size={11} /> Lip Sync
                    </button>
                )}

                {/* Upload Image */}
                <button
                    onClick={() => mainImageInputRef.current?.click()}
                    disabled={isBusy}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[9px] font-semibold text-neutral-500 border border-dashed border-white/[0.08] bg-transparent hover:border-white/15 hover:text-neutral-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    <Upload size={10} /> Upload Image
                </button>
            </div>
        </div>
    );
};