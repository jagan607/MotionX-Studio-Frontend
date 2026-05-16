"use client";

import './image-config.css';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    X, Image as ImageIcon, Sparkles, Loader2,
    ImagePlus, XCircle, RectangleHorizontal, RectangleVertical, Square
} from "@/lib/lucide";
import { ImageHistoryStrip } from './ImageHistoryStrip';
import { usePricing, formatCredits } from '@/app/hooks/usePricing';
import { TokenIcon } from '@/components/ui/TokenIcon';
import { setPrimaryImage } from '@/lib/api';
import { toastSuccess, toastError } from '@/lib/toast';
import { Shot, ImageHistoryEntry } from '@/lib/types';
import { SHOT_TYPE_PRESETS, CAMERA_ANGLES } from '@/lib/shot-constants';
import Image from 'next/image';
import imageCompression from 'browser-image-compression';
import { EMERGENCY_MODE, EMERGENCY_FALLBACK_IMAGE_PROVIDER } from '@/lib/emergencyConfig';

interface CastMember { id: string; name: string; }
interface Location { id: string; name: string; }
interface Product { id: string; name: string; }

type ImageProvider = 'gemini' | 'seedream' | 'luma-uni-1';

interface ImageConfigurationModalProps {
    shot: Shot | null;
    projectId: string;
    episodeId: string;
    sceneId: string;
    isOpen: boolean;
    onClose: () => void;
    onUpdateShot: (id: string, field: string, value: any) => void;
    onGenerate: (
        referenceFile?: File | null,
        provider?: ImageProvider,
        continuityRefId?: string | null,
        cameraTransform?: any,
        cameraShotType?: string,
        modelTier?: 'flash' | 'pro'
    ) => void;
    isGenerating?: boolean;
    continuityRefId?: string | null;
    projectAspectRatio?: string;
    castMembers?: CastMember[];
    locations?: Location[];
    products?: Product[];
}

/** Hardcoded Luma cost -- will be made dynamic later */
const LUMA_IMAGE_COST = 0.5;

/** Aspect ratio options matching video modal */
const ASPECT_RATIOS = [
    { value: '16:9', label: 'Wide', icon: RectangleHorizontal },
    { value: '9:16', label: 'Social', icon: RectangleVertical },
    { value: '1:1', label: 'Square', icon: Square },
    { value: '4:3', label: '4:3', icon: RectangleHorizontal },
    { value: '3:4', label: '3:4', icon: RectangleVertical },
] as const;

export const ImageConfigurationModal: React.FC<ImageConfigurationModalProps> = ({
    shot,
    projectId,
    episodeId,
    sceneId,
    isOpen,
    onClose,
    onUpdateShot,
    onGenerate,
    isGenerating = false,
    continuityRefId,
    projectAspectRatio,
    castMembers = [],
    locations = [],
    products = [],
}) => {
    // --- State ---
    const [imageProvider, setImageProvider] = useState<ImageProvider>(
        EMERGENCY_MODE ? EMERGENCY_FALLBACK_IMAGE_PROVIDER as ImageProvider : 'gemini'
    );
    const [modelTier, setModelTier] = useState<'flash' | 'pro'>('pro');
    const [aspectRatio, setAspectRatio] = useState<string>(
        projectAspectRatio || '16:9'
    );
    const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
    const [isSettingPrimary, setIsSettingPrimary] = useState(false);

    // --- Shot Metadata State ---
    const [localShotType, setLocalShotType] = useState(shot?.shot_type || 'Wide Shot');
    const [isCustomShotType, setIsCustomShotType] = useState(
        () => !!shot?.shot_type && !(SHOT_TYPE_PRESETS as readonly string[]).includes(shot.shot_type)
    );
    const customInputRef = useRef<HTMLInputElement>(null);

    // --- Reference Image State ---
    const [refFile, setRefFile] = useState<File | null>(null);
    const [refPreviewUrl, setRefPreviewUrl] = useState<string | null>(null);
    const [isCompressing, setIsCompressing] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- Local Prompt (decoupled from Firestore) ---
    const [localPrompt, setLocalPrompt] = useState('');
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isPromptFocusedRef = useRef(false);

    // --- Pricing ---
    const { getImageCost } = usePricing();

    // Compute cost
    const imageCost = imageProvider === 'luma-uni-1'
        ? LUMA_IMAGE_COST
        : getImageCost(imageProvider as 'gemini' | 'seedream', modelTier, 'shot');

    // Reset modelTier when switching away from Gemini (Seedream/Luma use a single flat-rate tier)
    useEffect(() => {
        if (imageProvider !== 'gemini') {
            setModelTier('flash');
        }
    }, [imageProvider]);

    // Derived state
    const hasImage = Boolean(shot?.image_url);
    const isBusy = isGenerating || shot?.status === 'generating';

    // --- Sync local prompt from shot ---
    useEffect(() => {
        if (shot && !isPromptFocusedRef.current) {
            setLocalPrompt(shot.visual_action || '');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [shot?.id]);

    // Reset preview when shot changes
    useEffect(() => {
        setPreviewImageUrl(null);
    }, [shot?.id]);

    // Cleanup debounce on unmount
    useEffect(() => {
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, []);

    // Ref image cleanup
    useEffect(() => {
        if (!refFile) { setRefPreviewUrl(null); return; }
        const objectUrl = URL.createObjectURL(refFile);
        setRefPreviewUrl(objectUrl);
        return () => URL.revokeObjectURL(objectUrl);
    }, [refFile]);

    // --- Handlers ---
    const handlePromptChange = useCallback((value: string) => {
        setLocalPrompt(value);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            if (shot) onUpdateShot(shot.id, 'visual_action', value);
        }, 500);
    }, [shot?.id, onUpdateShot]);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            setIsCompressing(true);
            try {
                const compressed = await imageCompression(e.target.files[0], {
                    maxSizeMB: 1,
                    maxWidthOrHeight: 1500,
                    useWebWorker: true,
                });
                setRefFile(compressed);
            } finally {
                setIsCompressing(false);
            }
        }
    };

    const clearRefImage = (e: React.MouseEvent) => {
        e.stopPropagation();
        setRefFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleGenerate = () => {
        onGenerate(
            refFile,
            imageProvider,
            continuityRefId,
            undefined,
            undefined,
            modelTier
        );
    };

    const handleSetPrimary = async (entry: ImageHistoryEntry) => {
        if (!shot || isSettingPrimary) return;
        setIsSettingPrimary(true);
        try {
            await setPrimaryImage(projectId, episodeId, sceneId, shot.id, entry.image_url);
            toastSuccess("Primary image updated");
            setPreviewImageUrl(null);
        } catch (e: any) {
            console.error('[SetPrimary] Failed:', e);
            toastError("Failed to set primary image");
        } finally {
            setIsSettingPrimary(false);
        }
    };

    const handlePreviewHistory = (entry: ImageHistoryEntry) => {
        setPreviewImageUrl(entry.image_url);
    };

    // --- Pill Style Helper ---
    const pill = (active: boolean, disabled = false) =>
        `flex-1 px-2 py-1.5 text-[10px] font-semibold rounded-md text-center transition-all cursor-pointer select-none
        ${active
            ? 'bg-[#D40A12]/15 text-white border border-[#D40A12]/60'
            : 'bg-white/[0.03] text-neutral-500 border border-white/[0.08] hover:border-white/20 hover:text-neutral-300'
        }
        ${disabled ? 'opacity-30 !cursor-not-allowed' : ''}`;

    if (!isOpen || !shot) return null;

    // Determine which image to show in preview
    const displayImageUrl = previewImageUrl || shot.image_url;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200]"
                onClick={onClose}
            />

            {/* Centered Modal */}
            <div className="fixed inset-0 z-[201] flex items-center justify-center pointer-events-none">
                <div
                    className="pointer-events-auto w-[95%] max-w-6xl h-[90vh] bg-[#1a1a1a] rounded-2xl border border-white/[0.08] shadow-2xl flex flex-col overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="h-12 px-5 border-b border-white/[0.08] flex items-center justify-between bg-[#141414] flex-shrink-0">
                        <h2 className="text-sm font-bold text-white flex items-center gap-2">
                            Image Configuration
                            <span className="px-1.5 py-0.5 rounded bg-white/[0.08] text-[10px] text-neutral-500 font-mono">
                                {shot.id.slice(0, 8)}
                            </span>
                        </h2>
                        <button
                            onClick={onClose}
                            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/[0.1] transition-colors cursor-pointer"
                        >
                            <X size={16} className="text-neutral-400" />
                        </button>
                    </div>

                    {/* Two-Column Body */}
                    <div className="flex-1 grid grid-cols-12 gap-0 overflow-hidden">

                        {/* ======= LEFT COLUMN -- Preview & Prompt (7 cols) ======= */}
                        <div className="col-span-7 border-r border-white/[0.06] overflow-y-auto p-5 space-y-5">

                            {/* Image Preview */}
                            <div className="aspect-video bg-black rounded-xl overflow-hidden border border-white/[0.1] relative group">
                                {displayImageUrl ? (
                                    <Image
                                        src={displayImageUrl}
                                        alt="Shot Preview"
                                        fill
                                        className="object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center text-neutral-600 bg-white/[0.02]">
                                        <ImageIcon size={40} className="mb-3 opacity-40" />
                                        <span className="text-xs text-neutral-500">No image generated yet</span>
                                    </div>
                                )}

                                {/* Preview Badge */}
                                {previewImageUrl && previewImageUrl !== shot.image_url && (
                                    <div className="absolute top-3 left-3 px-2 py-1 rounded-md bg-black/70 backdrop-blur-sm border border-white/[0.15]">
                                        <span className="text-[9px] font-bold text-amber-400 uppercase tracking-wider">Preview</span>
                                    </div>
                                )}

                                {/* Generating Overlay */}
                                {isBusy && (
                                    <div className="absolute inset-0 z-10 overflow-hidden rounded-xl">
                                        <div className="absolute inset-0 bg-black/40">
                                            <div className="absolute w-[60%] h-[60%] rounded-full bg-[#D40A12]/30 blur-[40px]"
                                                style={{ animation: 'imgFlowBlob1 4s ease-in-out infinite', top: '10%', left: '10%' }} />
                                            <div className="absolute w-[50%] h-[50%] rounded-full bg-[#ff4d4d]/15 blur-[40px]"
                                                style={{ animation: 'imgFlowBlob2 5s ease-in-out infinite', top: '40%', right: '5%' }} />
                                        </div>
                                        <div className="absolute inset-0 backdrop-blur-xl bg-white/[0.03]" />
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <span className="text-[10px] font-semibold text-white/60 tracking-[3px] uppercase"
                                                style={{ animation: 'imgShimmer 2s ease-in-out infinite' }}>
                                                Generating...
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Image History Strip */}
                            <ImageHistoryStrip
                                history={shot.image_history || []}
                                activeImageUrl={shot.image_url}
                                onPreview={handlePreviewHistory}
                                onSetPrimary={handleSetPrimary}
                            />

                            {/* ====== Shot Metadata ====== */}
                            <div className="space-y-3 py-3 border-t border-b border-white/[0.06]">

                                {/* Row 1: Shot Type + Duration + Location */}
                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider mb-1 block">Shot Type</label>
                                        {isCustomShotType ? (
                                            <div className="flex gap-1">
                                                <input
                                                    ref={customInputRef}
                                                    autoFocus
                                                    value={localShotType}
                                                    onChange={(e) => setLocalShotType(e.target.value)}
                                                    onBlur={() => { if (shot && localShotType !== shot.shot_type) onUpdateShot(shot.id, 'shot_type', localShotType); }}
                                                    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                                                    placeholder="Custom shot type..."
                                                    className="flex-1 bg-white/[0.03] border border-[#D40A12]/40 text-neutral-200 text-[12px] px-2.5 py-2 rounded-lg outline-none focus:border-[#D40A12]/60 transition-colors"
                                                />
                                                <button
                                                    onClick={() => {
                                                        setIsCustomShotType(false);
                                                        setLocalShotType(shot?.shot_type || 'Wide Shot');
                                                        if (shot) onUpdateShot(shot.id, 'shot_type', shot.shot_type || 'Wide Shot');
                                                    }}
                                                    className="px-1.5 bg-white/[0.03] border border-white/[0.08] rounded-lg text-neutral-500 hover:text-white hover:border-white/20 transition-colors cursor-pointer"
                                                    title="Back to presets"
                                                >
                                                    <XCircle size={12} />
                                                </button>
                                            </div>
                                        ) : (
                                            <select
                                                value={localShotType}
                                                onChange={(e) => {
                                                    if (e.target.value === '__custom__') {
                                                        setIsCustomShotType(true);
                                                        setLocalShotType('');
                                                    } else {
                                                        setLocalShotType(e.target.value);
                                                        if (shot) onUpdateShot(shot.id, 'shot_type', e.target.value);
                                                    }
                                                }}
                                                className="w-full bg-white/[0.03] border border-white/[0.08] text-neutral-200 text-[12px] px-2.5 py-2 rounded-lg outline-none focus:border-[#D40A12]/40 transition-colors cursor-pointer"
                                            >
                                                {SHOT_TYPE_PRESETS.map(st => <option key={st} value={st}>{st}</option>)}
                                                <option value="__custom__">Custom...</option>
                                            </select>
                                        )}
                                    </div>
                                    {(shot as any)?.estimated_duration ? (
                                        <div className="w-14 shrink-0">
                                            <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider mb-1 block">Dur.</label>
                                            <div className="w-full bg-white/[0.03] border border-white/[0.08] text-amber-400 text-[12px] px-2.5 py-2 rounded-lg text-center font-mono font-bold">
                                                {(shot as any).estimated_duration}s
                                            </div>
                                        </div>
                                    ) : null}
                                    <div className="flex-1">
                                        <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider mb-1 block">Location</label>
                                        <select
                                            value={shot?.location || ''}
                                            onChange={(e) => { if (shot) onUpdateShot(shot.id, 'location', e.target.value); }}
                                            className="w-full bg-white/[0.03] border border-white/[0.08] text-neutral-200 text-[12px] px-2.5 py-2 rounded-lg outline-none focus:border-[#D40A12]/40 transition-colors cursor-pointer"
                                        >
                                            <option value="">NONE</option>
                                            {shot?.location && !locations.find(l => l.name === shot.location) && (
                                                <option value={shot.location}>{shot.location}</option>
                                            )}
                                            {locations.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
                                        </select>
                                    </div>
                                </div>

                                {/* Row 2: Camera Angle */}
                                <div>
                                    <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider mb-1 block">Camera Angle</label>
                                    <select
                                        value={(shot as any)?.location_angle || 'front'}
                                        onChange={(e) => { if (shot) onUpdateShot(shot.id, 'location_angle', e.target.value); }}
                                        className="w-full bg-white/[0.03] border border-white/[0.08] text-neutral-200 text-[12px] px-2.5 py-2 rounded-lg outline-none focus:border-[#D40A12]/40 transition-colors cursor-pointer"
                                    >
                                        {CAMERA_ANGLES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
                                    </select>
                                </div>

                                {/* Products */}
                                {products.length > 0 && (
                                    <div>
                                        <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider mb-1.5 block">Products</label>
                                        <div className="flex flex-wrap gap-1.5">
                                            {products.map((prod) => {
                                                const isActive = Array.isArray(shot?.products) && shot.products.includes(prod.id);
                                                return (
                                                    <button
                                                        key={prod.id}
                                                        onClick={() => {
                                                            if (!shot) return;
                                                            const current = Array.isArray(shot.products) ? [...shot.products] : [];
                                                            const updated = current.includes(prod.id)
                                                                ? current.filter(id => id !== prod.id)
                                                                : [...current, prod.id];
                                                            onUpdateShot(shot.id, 'products', updated);
                                                        }}
                                                        className={`px-2.5 py-1 rounded-md text-[10px] font-semibold border transition-all cursor-pointer select-none
                                                            ${isActive
                                                                ? 'bg-[#D40A12]/15 text-white border-[#D40A12]/40'
                                                                : 'bg-white/[0.03] text-neutral-500 border-white/[0.08] hover:border-white/20 hover:text-neutral-300'
                                                            }`}
                                                    >
                                                        {prod.name}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Cast */}
                                {castMembers.length > 0 && (
                                    <div>
                                        <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider mb-1.5 block">Cast</label>
                                        <div className="flex flex-wrap gap-1.5">
                                            {castMembers.map((char) => {
                                                const normalize = (s: string) => s ? s.toLowerCase().trim() : '';
                                                const isActive = Array.isArray(shot?.characters) && (
                                                    shot.characters.includes(char.id) ||
                                                    shot.characters.some(c => normalize(c) === normalize(char.name))
                                                );
                                                return (
                                                    <button
                                                        key={char.id}
                                                        onClick={() => {
                                                            if (!shot) return;
                                                            const current = Array.isArray(shot.characters) ? [...shot.characters] : [];
                                                            const isOn = current.includes(char.id) || current.some(c => normalize(c) === normalize(char.name));
                                                            const updated = isOn
                                                                ? current.filter(c => c !== char.id && normalize(c) !== normalize(char.name))
                                                                : [...current, char.id];
                                                            onUpdateShot(shot.id, 'characters', updated);
                                                        }}
                                                        className={`px-2.5 py-1 rounded-md text-[10px] font-semibold border transition-all cursor-pointer select-none
                                                            ${isActive
                                                                ? 'bg-[#D40A12]/15 text-white border-[#D40A12]/40'
                                                                : 'bg-white/[0.03] text-neutral-500 border-white/[0.08] hover:border-white/20 hover:text-neutral-300'
                                                            }`}
                                                    >
                                                        {char.name}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Prompt Editor */}
                            <div className="space-y-2">
                                <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                                    Image Prompt
                                </label>
                                <textarea
                                    value={localPrompt}
                                    onChange={(e) => handlePromptChange(e.target.value)}
                                    onFocus={() => { isPromptFocusedRef.current = true; }}
                                    onBlur={() => { isPromptFocusedRef.current = false; }}
                                    placeholder="Describe the visual for this shot..."
                                    className="w-full h-40 px-3 py-3 text-[13px] outline-none resize-none leading-relaxed
                                        bg-[#1a1a1a] border border-white/[0.1] rounded-lg text-neutral-200
                                        placeholder:text-neutral-600 focus:border-white/[0.3] transition-all"
                                />
                            </div>
                        </div>

                        {/* ======= RIGHT COLUMN -- Settings (5 cols) ======= */}
                        <div className="col-span-5 flex flex-col overflow-hidden bg-[#0d0d0d]">

                            {/* Scrollable Settings */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-4">

                                {/* Model Selector */}
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">Model</label>
                                    <div className="flex gap-1.5 flex-wrap">
                                        {!EMERGENCY_MODE && (
                                        <button
                                            type="button"
                                            onClick={() => setImageProvider('gemini')}
                                            className={pill(imageProvider === 'gemini')}
                                        >
                                            Gemini
                                        </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => setImageProvider('seedream')}
                                            className={pill(imageProvider === 'seedream')}
                                        >
                                            Seedream
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setImageProvider('luma-uni-1')}
                                            className={pill(imageProvider === 'luma-uni-1')}
                                        >
                                            Luma (uni-1)
                                        </button>
                                    </div>
                                </div>

                                {/* Model Tier Toggle -- only for Gemini (Seedream/Luma ignore tier) */}
                                {imageProvider === 'gemini' && (
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">Model Tier</label>
                                        <div className="flex gap-0 rounded-lg overflow-hidden border border-white/[0.08]">
                                            <button
                                                onClick={() => setModelTier('pro')}
                                                disabled={isBusy}
                                                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-bold transition-all cursor-pointer select-none
                                                    ${modelTier === 'pro'
                                                        ? 'bg-white/[0.08] text-white border-r border-white/[0.12]'
                                                        : 'bg-white/[0.02] text-neutral-500 border-r border-white/[0.08] hover:text-neutral-300'
                                                    }
                                                    ${isBusy ? '!cursor-not-allowed' : ''}`}
                                            >
                                                Nano Banana 1 Pro
                                            </button>
                                            <button
                                                onClick={() => setModelTier('flash')}
                                                disabled={isBusy}
                                                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-bold transition-all cursor-pointer select-none
                                                    ${modelTier === 'flash'
                                                        ? 'bg-white/[0.08] text-white'
                                                        : 'bg-white/[0.02] text-neutral-500 hover:text-neutral-300'
                                                    }
                                                    ${isBusy ? '!cursor-not-allowed' : ''}`}
                                            >
                                                Nano Banana 2
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Aspect Ratio Selector */}
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">Aspect Ratio</label>
                                    <div className="flex gap-1.5">
                                        {ASPECT_RATIOS.map(({ value, label, icon: Icon }) => (
                                            <button
                                                key={value}
                                                type="button"
                                                onClick={() => setAspectRatio(value)}
                                                className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-md border transition-all cursor-pointer select-none
                                                    ${aspectRatio === value
                                                        ? 'bg-[#D40A12]/15 text-white border-[#D40A12]/60'
                                                        : 'bg-white/[0.03] text-neutral-500 border-white/[0.08] hover:border-white/20 hover:text-neutral-300'
                                                    }`}
                                            >
                                                <Icon size={16} />
                                                <span className="text-[9px] font-semibold">{label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Reference Image */}
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">Reference Image</label>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleFileSelect}
                                        className="hidden"
                                        accept="image/*"
                                    />

                                    {refPreviewUrl ? (
                                        <div className="relative rounded-lg overflow-hidden border border-[#D40A12]/30 bg-white/[0.02]">
                                            <img
                                                src={refPreviewUrl}
                                                alt="Reference"
                                                className="w-full h-28 object-cover"
                                            />
                                            <button
                                                onClick={clearRefImage}
                                                className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center bg-black/60 hover:bg-red-500/60 text-white transition-colors cursor-pointer"
                                            >
                                                <XCircle size={12} />
                                            </button>
                                            <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-black/60 backdrop-blur-sm">
                                                <span className="text-[9px] font-bold text-[#D40A12]">Reference Active</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={isCompressing}
                                            className="w-full flex items-center justify-center gap-2 py-4 rounded-lg border border-dashed border-white/[0.1] bg-white/[0.02] text-neutral-500 hover:border-white/[0.2] hover:text-neutral-300 transition-all cursor-pointer disabled:cursor-wait"
                                        >
                                            {isCompressing ? (
                                                <>
                                                    <Loader2 size={14} className="animate-spin" />
                                                    <span className="text-[10px] font-semibold">Compressing...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <ImagePlus size={14} />
                                                    <span className="text-[10px] font-semibold">Add Reference Image</span>
                                                </>
                                            )}
                                        </button>
                                    )}
                                </div>


                                {/* Luma Native Audio Disclaimer */}
                                {imageProvider === 'luma-uni-1' && (
                                    <div className="px-3 py-2 rounded-lg bg-purple-500/[0.08] border border-purple-500/20">
                                        <span className="text-[10px] text-purple-300 font-semibold">
                                            Luma uni-1 &mdash; Experimental model
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Sticky CTA Footer */}
                            <div className="px-4 py-3 border-t border-white/[0.08] bg-[#1a1a1a] flex-shrink-0 space-y-2">
                                <button
                                    onClick={handleGenerate}
                                    disabled={isBusy}
                                    className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg text-[12px] font-bold transition-all
                                        ${isBusy
                                            ? 'bg-white/[0.03] text-neutral-600 border border-white/[0.05] cursor-not-allowed'
                                            : 'bg-white/[0.06] text-white border border-white/[0.1] hover:border-white/20 hover:bg-white/[0.1] cursor-pointer'
                                        }
                                    `}
                                >
                                    {isBusy ? (
                                        <Loader2 size={14} className="animate-spin" />
                                    ) : (
                                        <Sparkles size={14} />
                                    )}
                                    {isBusy ? 'Generating...' : hasImage ? 'Re-Generate' : 'Generate'}
                                    {!isBusy && (
                                        <span className="inline-flex items-center gap-1 opacity-60 text-[10px] font-normal">
                                            <TokenIcon size={9} />{formatCredits(imageCost)}
                                        </span>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

        </>
    );
};
