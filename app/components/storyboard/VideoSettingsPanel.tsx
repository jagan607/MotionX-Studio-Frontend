import React, { useState, useRef, useEffect } from 'react';
import {
    Film, RefreshCw, Link2, Mic2,
    ChevronDown, ChevronUp, Sliders, Plus, Trash2, AlertCircle, Loader2,
    RectangleHorizontal, RectangleVertical, Square, Volume2, FastForward,
    ImagePlus, X
} from 'lucide-react';
import type { VideoProvider, AnimateOptions, PromptSegment } from '@/app/hooks/shot-manager/useShotVideoGen';
import type { KlingElement } from '@/app/hooks/shot-manager/useElementLibrary';
import { usePricing, formatCredits } from '@/app/hooks/usePricing';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { api } from '@/lib/api';
import Image from 'next/image';

interface VideoSettingsPanelProps {
    hasImage: boolean;
    hasVideo: boolean;
    isBusy: boolean;
    isLinked: boolean;
    nextShotImage?: string;
    onAnimate: (provider: VideoProvider, endFrameUrl?: string | null, options?: AnimateOptions) => void;
    onText2Video?: (options?: AnimateOptions) => void;
    onLipSync: () => void;

    // Elements
    elementList?: string[];
    selectedElements?: KlingElement[];
    onElementListChange?: (list: string[]) => void;
    onOpenElementLibrary?: () => void;

    // Seedance 2.0
    shot?: { seedance_task_id?: string; video_url?: string; video_provider?: string };
    sceneCharacters?: { name: string; image_url: string }[];
    locationImage?: string;
    onExtend?: (parentTaskId: string, options?: AnimateOptions) => void;

    // Persistence
    initialSettings?: any;
    onSettingsChange?: (settings: any) => void;

    // External action button
    hideActions?: boolean;
    onAnimateInfoChange?: (info: {
        handleAnimate: () => void;
        cost: number;
        disabled: boolean;
        label: string;
        icon: 'animate' | 're-animate' | 'morph' | 'busy';
        extendAction?: { handleExtend: () => void; cost: number };
    }) => void;
}

export const VideoSettingsPanel: React.FC<VideoSettingsPanelProps> = ({
    hasImage,
    hasVideo,
    isBusy,
    isLinked,
    nextShotImage,
    onAnimate,
    onLipSync,
    elementList: propElementList,
    selectedElements = [],
    onElementListChange,
    onOpenElementLibrary,
    initialSettings,
    onSettingsChange,
    onText2Video,
    shot: shotData,
    sceneCharacters = [],
    locationImage,
    onExtend,
    hideActions = false,
    onAnimateInfoChange
}) => {
    // --- State ---
    const [provider, setProvider] = useState<VideoProvider>(initialSettings?.provider || 'seedance-2');
    const [duration, setDuration] = useState<string>(initialSettings?.duration || '5');
    const [mode, setMode] = useState<'std' | 'pro'>(initialSettings?.mode || 'pro');
    // --- Provider Flags ---
    const isV3 = provider === 'kling-v3';
    const isSeedance2 = provider === 'seedance-2' || provider === 'seedance';
    const isKling26 = provider === 'kling';
    const isSeedance15 = provider === 'seedance-1.5';
    const showSoundToggle = isKling26 || isSeedance15;

    // --- Pricing ---
    const { getVideoCost, getLipSyncCost } = usePricing();
    const [quality, setQuality] = useState<'fast' | 'pro'>(initialSettings?.quality || 'fast');
    const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16' | '4:3' | '3:4'>(initialSettings?.aspect_ratio || '16:9');
    const [refImages, setRefImages] = useState<string[]>(initialSettings?.reference_image_urls || []);
    const [isUploadingRef, setIsUploadingRef] = useState(false);
    const refInputRef = useRef<HTMLInputElement>(null);

     // End Frame (Seedance 2.0 start-to-end)
    const [endFrameUrl, setEndFrameUrl] = useState<string | null>(initialSettings?.end_frame_url || null);
    const [isUploadingEndFrame, setIsUploadingEndFrame] = useState(false);
    const endFrameInputRef = useRef<HTMLInputElement>(null);

    // Compute pricing key — seedance-2 draft uses 'seedance-2-fast' pricing
    const pricingKey = (isSeedance2 && quality === 'fast') ? 'seedance-2-fast' : provider;
    const [showAdvanced, setShowAdvanced] = useState(false);

    // Advanced
    const [negativePrompt, setNegativePrompt] = useState(initialSettings?.negative_prompt || '');
    const [cfgScale, setCfgScale] = useState(initialSettings?.cfg_scale || 0.5);
    const [sound, setSound] = useState<'on' | 'off'>(initialSettings?.sound || 'on');
    const [watermark, setWatermark] = useState(initialSettings?.watermark || false);

    // Multi-Shot
    const [multiShot, setMultiShot] = useState(initialSettings?.multi_shot || false);
    const [shotType, setShotType] = useState<'intelligence' | 'customize'>(initialSettings?.shot_type || 'intelligence');
    const [segments, setSegments] = useState<PromptSegment[]>(initialSettings?.multi_prompt || []);

    // Elements & Voices
    const [elementIdInput, setElementIdInput] = useState('');
    const [internalElementList, setInternalElementList] = useState<string[]>(initialSettings?.element_list || []);
    const [voiceIdInput, setVoiceIdInput] = useState('');
    const [voiceList, setVoiceList] = useState<string[]>(initialSettings?.voice_list || []);

    // Surcharge-aware pricing (must be after state declarations)
    const surchargeFlags = {
        sound: isV3 ? sound === 'on' : (showSoundToggle ? sound === 'on' : false),
        multiShot: isV3 && multiShot,
        hasEndFrame: (isSeedance2 || isV3) && (!!endFrameUrl || (isLinked && !!nextShotImage)),
    };
    const videoCost = getVideoCost(pricingKey, mode, duration, surchargeFlags);
    const finalCost = isSeedance2 ? getVideoCost('seedance-2', mode, duration, surchargeFlags) : videoCost;

    // Peak Hours Detection
    const [peakStatus, setPeakStatus] = useState<{ is_peak: boolean; wait: string; message: string } | null>(null);
    useEffect(() => {
        if (!isSeedance2) { setPeakStatus(null); return; }
        let cancelled = false;
        api.get('/api/v1/system/generation_status?provider=seedance-2')
            .then(res => {
                if (cancelled) return;
                if (res.data?.is_peak_hours) {
                    setPeakStatus({
                        is_peak: true,
                        wait: res.data.estimated_wait || '10-20 min',
                        message: res.data.message || 'High demand — generation may take longer.',
                    });
                } else {
                    setPeakStatus(null);
                }
            })
            .catch(() => { if (!cancelled) setPeakStatus(null); });
        return () => { cancelled = true; };
    }, [isSeedance2]);

    // Available durations per provider
    const availableDurations = (() => {
        if (provider === 'kling') return ['5', '10'] as const;
        if (provider === 'seedance-1.5') return ['5', '10'] as const;
        return ['3', '5', '10', '15'] as const; // seedance-2, kling-v3
    })();

    // Auto-correct duration if not available for selected provider
    React.useEffect(() => {
        if (provider === 'kling-v3') {
            const val = parseInt(duration);
            if (isNaN(val) || val < 3 || val > 15) setDuration('5');
        } else if (!availableDurations.includes(duration as any)) {
            setDuration(availableDurations[1] as any); // default to 5s
        }
    }, [provider]);

    // Auto-expand Advanced Settings for Kling v3
    React.useEffect(() => {
        if (provider === 'kling-v3') setShowAdvanced(true);
    }, [provider]);

    // Seedance 2.0 has native audio — force sound on
    React.useEffect(() => {
        if (isSeedance2) setSound('on');
    }, [isSeedance2]);

    // Auto-switch from legacy models when morph-to-next is linked
    React.useEffect(() => {
        if (isLinked && (provider === 'kling' || provider === 'seedance-1.5')) {
            setProvider('kling-v3');
        }
    }, [isLinked, provider]);

    // Auto-populate reference images from scene assets
    React.useEffect(() => {
        if (!isSeedance2) return;
        const autoRefs: string[] = [];
        sceneCharacters.forEach(c => { if (c.image_url && !autoRefs.includes(c.image_url)) autoRefs.push(c.image_url); });
        if (locationImage && !autoRefs.includes(locationImage)) autoRefs.push(locationImage);
        if (autoRefs.length > 0 && refImages.length === 0) setRefImages(autoRefs.slice(0, 5));
    }, [isSeedance2, sceneCharacters, locationImage]);

    // Derived state for controlled vs uncontrolled
    const elementList = propElementList || internalElementList;
    const handleElementListChange = (newList: string[]) => {
        if (onElementListChange) {
            onElementListChange(newList);
        } else {
            setInternalElementList(newList);
        }
    };

    // Effects to Notify Parent
    React.useEffect(() => {
        if (!onSettingsChange) return;
        const currentSettings = {
            provider, duration, mode, quality, aspect_ratio: aspectRatio,
            reference_image_urls: refImages,
            end_frame_url: endFrameUrl,
            negative_prompt: negativePrompt,
            cfg_scale: cfgScale, sound, watermark, multi_shot: multiShot,
            shot_type: shotType, multi_prompt: segments,
            element_list: elementList,
            voice_list: voiceList
        };
        const timer = setTimeout(() => {
            onSettingsChange(currentSettings);
        }, 500);
        return () => clearTimeout(timer);
    }, [provider, duration, mode, quality, aspectRatio, refImages, endFrameUrl, negativePrompt, cfgScale, sound, watermark, multiShot, shotType, segments, elementList, voiceList, onSettingsChange]);

    // --- Validation & Options Building ---
    const getTotalSegmentDuration = () => {
        return segments.reduce((acc, seg) => acc + (parseFloat(seg.duration) || 0), 0);
    };

    const isDurationValid = !multiShot || shotType === 'intelligence' || getTotalSegmentDuration() === parseFloat(duration);

    const buildOptions = (): AnimateOptions => ({
        duration,
        mode,
        aspect_ratio: aspectRatio,
        ...(isSeedance2 ? {
            sound: 'on',
            quality,
            reference_image_urls: refImages.length > 0 ? refImages : undefined,
        } : {}),
        ...(showSoundToggle ? { sound } : {}),
        // TODO: Uncomment when switching to official Kling API
        // ...(isV3 && negativePrompt ? { negative_prompt: negativePrompt } : {}),
        ...(isV3 ? {
            // cfg_scale: cfgScale,        // TODO: Uncomment for official Kling API
            sound,
            // watermark,                  // TODO: Uncomment for official Kling API
            multi_shot: multiShot,
            shot_type: multiShot ? shotType : undefined,
            multi_prompt: (multiShot && shotType === 'customize') ? segments : undefined,
            // element_list: elementList.length > 0 ? elementList.map(id => ({ element_id: String(id) })) : undefined,  // TODO: Uncomment for official Kling API
            // voice_list: voiceList.length > 0 ? voiceList.map(id => ({ voice_id: id })) : undefined,                  // TODO: Uncomment for official Kling API
        } : {}),
    });

    const handleAnimate = () => {
        if (!isDurationValid) return;
        const options = buildOptions();
        // Linked morph-to-next takes priority; otherwise use manual end frame
        const endFrame = isLinked ? nextShotImage : (endFrameUrl || null);
        onAnimate(provider, endFrame, options);
    };

    // Report animate info to parent when hideActions is on
    React.useEffect(() => {
        if (!onAnimateInfoChange) return;
        const extendAction = (!isBusy && shotData?.seedance_task_id && shotData?.video_url && onExtend)
            ? {
                handleExtend: () => onExtend(shotData.seedance_task_id!, buildOptions()),
                cost: videoCost
            } : undefined;
        onAnimateInfoChange({
            handleAnimate,
            cost: videoCost,
            disabled: !hasImage || isBusy || !isDurationValid,
            label: isBusy
                ? (hasVideo ? 'Animating...' : 'Generating...')
                : isLinked
                    ? 'Morph to Next'
                    : (hasVideo ? 'Re-Animate' : 'Animate'),
            icon: isBusy ? 'busy' : isLinked ? 'morph' : (hasVideo ? 're-animate' : 'animate'),
            extendAction,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [provider, duration, mode, quality, aspectRatio, endFrameUrl, negativePrompt, cfgScale, sound,
        watermark, multiShot, shotType, segments, elementList, voiceList, refImages,
        hasImage, hasVideo, isBusy, isLinked, isDurationValid, videoCost]);

    // --- Helpers ---
    const addSegment = () => {
        setSegments([...segments, { index: segments.length + 1, prompt: '', duration: '5' }]);
    };

    const removeSegment = (idx: number) => {
        const filtered = segments.filter((_, i) => i !== idx);
        setSegments(filtered.map((s, i) => ({ ...s, index: i + 1 })));
    };

    const updateSegment = (idx: number, field: keyof PromptSegment, val: string) => {
        const newSegs = [...segments];
        newSegs[idx] = { ...newSegs[idx], [field]: val };
        setSegments(newSegs);
    };

    // Manual add (fallback if library not available)
    const addElement = (e?: React.MouseEvent) => {
        e?.preventDefault();
        const val = elementIdInput.trim();
        if (val && elementList.length < 6 && !elementList.includes(val)) {
            handleElementListChange([...elementList, val]);
            setElementIdInput('');
        }
    };

    const addVoice = (e?: React.MouseEvent) => {
        e?.preventDefault();
        const val = voiceIdInput.trim();
        if (val && voiceList.length < 2 && !voiceList.includes(val)) {
            setVoiceList([...voiceList, val]);
            setVoiceIdInput('');
        }
    };

    // --- Pill style helper ---
    const pill = (active: boolean, disabled = false) =>
        `flex-1 px-2 py-1.5 text-[10px] font-semibold rounded-md text-center transition-all cursor-pointer select-none
        ${active
            ? 'bg-[#E50914]/15 text-white border border-[#E50914]/60'
            : 'bg-white/[0.03] text-neutral-500 border border-white/[0.08] hover:border-white/20 hover:text-neutral-300'
        }
        ${disabled ? 'opacity-30 !cursor-not-allowed' : ''}`;

    return (
        <div className="mt-2 pt-2 border-t border-white/[0.06] space-y-2">

            {/* ── Provider Selector ── */}
            {!isBusy && (
                <div className="flex gap-1.5 flex-wrap">
                    <button
                        type="button"
                        onClick={() => setProvider('seedance-2')}
                        className={pill(isSeedance2)}
                    >
                        Seedance 2.0
                    </button>
                    <button type="button" onClick={() => setProvider('kling-v3')} className={pill(provider === 'kling-v3')}>
                        Kling v3
                    </button>
                    <button
                        type="button"
                        disabled={isLinked}
                        onClick={() => setProvider('seedance-1.5')}
                        className={`${pill(provider === 'seedance-1.5')} ${isLinked ? 'opacity-30 !cursor-not-allowed' : ''}`}
                    >
                        Seedance 1.5
                    </button>
                    <button
                        type="button"
                        disabled={isLinked}
                        onClick={() => setProvider('kling')}
                        className={`${pill(provider === 'kling')} ${isLinked ? 'opacity-30 !cursor-not-allowed' : ''}`}
                    >
                        Kling 2.6
                    </button>
                </div>
            )}

            {/* ── Basic Controls ── */}
            {!isBusy && (
                <div className="flex gap-1.5 flex-wrap">
                    {/* Duration */}
                    <div className="flex gap-1 flex-1 min-w-[100px]">
                        {isV3 ? (
                            <div className="flex items-center gap-2 flex-1 px-2 py-1 bg-white/[0.03] border border-white/[0.08] rounded-md group hover:border-white/20 transition-colors">
                                <span className="text-[10px] font-semibold text-neutral-400 group-hover:text-neutral-300 w-4">{duration}s</span>
                                <input
                                    type="range"
                                    min="3"
                                    max="15"
                                    step="1"
                                    value={duration}
                                    onChange={(e) => setDuration(e.target.value)}
                                    className="flex-1 h-1 bg-white/[0.08] rounded-full appearance-none cursor-pointer accent-[#E50914] min-w-[60px]"
                                />
                            </div>
                        ) : (
                            availableDurations.map(d => (
                                <button
                                    key={d}
                                    type="button"
                                    onClick={() => setDuration(d as any)}
                                    className={pill(duration === d)}
                                >
                                    {d}s
                                </button>
                            ))
                        )}
                    </div>

                    {/* Quality */}
                    <div className="flex gap-1 flex-shrink-0">
                        <button type="button" onClick={() => setMode('std')} className={pill(mode === 'std')}>
                            720p
                        </button>
                        <button type="button" onClick={() => setMode('pro')} className={pill(mode === 'pro')}>
                            1080p
                        </button>
                    </div>
                </div>
            )}

            {/* ── Sound Toggle (Kling 2.6 & Seedance 1.5) ── */}
            {showSoundToggle && !isBusy && (
                <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] font-semibold text-neutral-400 flex items-center gap-1.5">
                        <Volume2 size={12} className={sound === 'on' ? 'text-emerald-400' : 'text-neutral-600'} />
                        Sound
                    </span>
                    <div className="flex gap-1">
                        <button type="button" onClick={() => setSound('off')} className={pill(sound === 'off')}>
                            Off
                        </button>
                        <button type="button" onClick={() => setSound('on')} className={pill(sound === 'on')}>
                            On
                        </button>
                    </div>
                </div>
            )}

            {/* ── Seedance 2.0 Features ── */}
            {isSeedance2 && !isBusy && (
                <div className="space-y-2">
                    {/* Peak Hours Warning */}
                    {peakStatus?.is_peak && (
                        <div className="flex items-start gap-2 px-2.5 py-2 rounded-md bg-amber-500/10 border border-amber-500/25">
                            <span className="text-amber-400 text-[11px] mt-px">⚠</span>
                            <div className="flex-1">
                                <span className="text-[9px] text-amber-300 leading-relaxed">
                                    High demand — generation may take {peakStatus.wait}. Use <strong>Draft</strong> mode for faster previews.
                                </span>
                            </div>
                        </div>
                    )}
                    {/* Draft / Final Toggle */}
                    <div className="flex gap-1.5">
                        <button type="button" onClick={() => setQuality('fast')}
                            className={`flex-1 px-2 py-2 rounded-md text-center transition-all cursor-pointer select-none border
                                ${quality === 'fast'
                                    ? 'bg-amber-500/10 text-amber-300 border-amber-500/40'
                                    : 'bg-white/[0.03] text-neutral-500 border-white/[0.08] hover:border-white/20'}`}
                        >
                            <div className="flex items-center justify-center gap-1.5">
                                <FastForward size={10} />
                                <span className="text-[10px] font-bold">Draft</span>
                            </div>
                            <div className="text-[8px] mt-0.5 opacity-60">{formatCredits(getVideoCost('seedance-2-fast', mode, duration, surchargeFlags))} cr</div>
                        </button>
                        <button type="button" onClick={() => setQuality('pro')}
                            className={`flex-1 px-2 py-2 rounded-md text-center transition-all cursor-pointer select-none border
                                ${quality === 'pro'
                                    ? 'bg-[#E50914]/15 text-white border-[#E50914]/60'
                                    : 'bg-white/[0.03] text-neutral-500 border-white/[0.08] hover:border-white/20'}`}
                        >
                            <div className="flex items-center justify-center gap-1.5">
                                <Film size={10} />
                                <span className="text-[10px] font-bold">Final</span>
                            </div>
                            <div className="text-[8px] mt-0.5 opacity-60">{formatCredits(getVideoCost('seedance-2', mode, duration, surchargeFlags))} cr</div>
                        </button>
                    </div>

                    {/* Aspect Ratio Icons */}
                    <div className="flex gap-1.5">
                        {[
                            { value: '16:9' as const, icon: <RectangleHorizontal size={14} />, label: 'Wide' },
                            { value: '9:16' as const, icon: <RectangleVertical size={14} />, label: 'Social' },
                            { value: '4:3' as const, icon: <RectangleHorizontal size={12} />, label: '4:3' },
                            { value: '3:4' as const, icon: <RectangleVertical size={12} />, label: '3:4' },
                        ].map(ar => (
                            <button key={ar.value} type="button" onClick={() => setAspectRatio(ar.value)}
                                className={`flex-1 flex flex-col items-center gap-1 py-1.5 rounded-md border transition-all cursor-pointer select-none
                                    ${aspectRatio === ar.value
                                        ? 'bg-[#E50914]/15 text-white border-[#E50914]/60'
                                        : 'bg-white/[0.03] text-neutral-500 border-white/[0.08] hover:border-white/20 hover:text-neutral-300'}`}
                            >
                                {ar.icon}
                                <span className="text-[8px] font-semibold">{ar.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Reference Images Strip */}
                    <div>
                        <label className="text-[9px] font-semibold text-neutral-500 mb-1 flex items-center justify-between">
                            <span>Reference Images</span>
                            <span className="text-neutral-600">{refImages.length}/5</span>
                        </label>
                        <div className="flex gap-1.5 overflow-x-auto pb-1">
                            {refImages.map((url, i) => (
                                <div key={i} className="relative w-10 h-10 rounded-md overflow-hidden border border-white/[0.1] flex-shrink-0 group">
                                    <img src={url} alt="" className="w-full h-full object-cover" />
                                    <button
                                        type="button"
                                        onClick={() => setRefImages(refImages.filter((_, idx) => idx !== i))}
                                        className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <Trash2 size={10} className="text-red-400" />
                                    </button>
                                </div>
                            ))}
                            {refImages.length < 5 && (
                                <>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        ref={refInputRef}
                                        onChange={async (e) => {
                                            const file = e.target.files?.[0];
                                            if (!file) return;
                                            try {
                                                setIsUploadingRef(true);
                                                const path = `ref_images/${Date.now()}_${file.name}`;
                                                const storageRef = ref(storage, path);
                                                await uploadBytes(storageRef, file);
                                                const url = await getDownloadURL(storageRef);
                                                setRefImages(prev => [...prev, url].slice(0, 5));
                                            } catch (err) {
                                                console.error('[RefUpload] Failed:', err);
                                            } finally {
                                                setIsUploadingRef(false);
                                                if (refInputRef.current) refInputRef.current.value = '';
                                            }
                                        }}
                                    />
                                    <button
                                        type="button"
                                        disabled={isUploadingRef}
                                        onClick={() => refInputRef.current?.click()}
                                        className="w-10 h-10 rounded-md border border-dashed border-white/[0.15] flex items-center justify-center flex-shrink-0
                                            bg-white/[0.02] hover:bg-white/[0.06] hover:border-amber-500/40 transition-all cursor-pointer
                                            disabled:opacity-40 disabled:cursor-wait"
                                    >
                                        {isUploadingRef
                                            ? <Loader2 size={12} className="text-amber-400 animate-spin" />
                                            : <Plus size={14} className="text-neutral-500" />}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* ── End Frame Upload Zone ── */}
                    <div>
                        <label className="text-[9px] font-semibold text-neutral-500 mb-1 flex items-center justify-between">
                            <span>
                                End Frame
                                {isLinked && nextShotImage
                                    ? <span className="text-[#E50914] font-normal ml-1">· Linked</span>
                                    : <span className="text-neutral-600 font-normal ml-1">(optional)</span>
                                }
                            </span>
                            {!isLinked && endFrameUrl && (
                                <button
                                    type="button"
                                    onClick={() => setEndFrameUrl(null)}
                                    className="text-[8px] text-red-400/70 hover:text-red-400 transition-colors"
                                >
                                    Remove
                                </button>
                            )}
                        </label>

                        {isLinked && nextShotImage ? (
                            <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-[#E50914]/30 bg-black">
                                <img src={nextShotImage} alt="Next Shot (Linked)" className="w-full h-full object-cover" />
                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2.5 py-2">
                                    <div className="flex items-center gap-1.5">
                                        <Link2 size={9} className="text-[#E50914]" />
                                        <span className="text-[8px] text-neutral-300">Linked to next shot — morph target</span>
                                    </div>
                                </div>
                            </div>
                        ) : endFrameUrl ? (
                            <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-white/[0.1] bg-black group">
                                <img src={endFrameUrl} alt="End Frame" className="w-full h-full object-cover" />
                                <button
                                    type="button"
                                    onClick={() => setEndFrameUrl(null)}
                                    className="absolute top-1.5 right-1.5 p-1 bg-black/60 hover:bg-red-500/80 rounded-full text-white opacity-0 group-hover:opacity-100 transition-all"
                                >
                                    <X size={10} />
                                </button>
                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5">
                                    <span className="text-[8px] text-neutral-300">Target frame — video will transition to this image</span>
                                </div>
                            </div>
                        ) : (
                            <>
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    ref={endFrameInputRef}
                                    onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;
                                        try {
                                            setIsUploadingEndFrame(true);
                                            const path = `end_frames/${Date.now()}_${file.name}`;
                                            const storageRef = ref(storage, path);
                                            await uploadBytes(storageRef, file);
                                            const url = await getDownloadURL(storageRef);
                                            setEndFrameUrl(url);
                                        } catch (err) {
                                            console.error('[EndFrameUpload] Failed:', err);
                                        } finally {
                                            setIsUploadingEndFrame(false);
                                            if (endFrameInputRef.current) endFrameInputRef.current.value = '';
                                        }
                                    }}
                                />
                                <button
                                    type="button"
                                    disabled={isUploadingEndFrame}
                                    onClick={() => endFrameInputRef.current?.click()}
                                    className="w-full py-3 rounded-lg border border-dashed border-white/[0.12] flex flex-col items-center justify-center gap-1.5
                                        bg-white/[0.02] hover:bg-white/[0.05] hover:border-amber-500/30 transition-all cursor-pointer
                                        disabled:opacity-40 disabled:cursor-wait"
                                >
                                    {isUploadingEndFrame ? (
                                        <Loader2 size={16} className="text-amber-400 animate-spin" />
                                    ) : (
                                        <>
                                            <ImagePlus size={16} className="text-neutral-500" />
                                            <span className="text-[9px] text-neutral-500">Add End Frame</span>
                                            <span className="text-[7px] text-neutral-600">Video will smoothly transition to this image</span>
                                        </>
                                    )}
                                </button>
                            </>
                        )}
                    </div>

                    {/* Native Audio Badge */}
                    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                        <Volume2 size={10} className="text-emerald-400" />
                        <span className="text-[9px] font-semibold text-emerald-400 tracking-wider uppercase">Native Audio Included</span>
                    </div>
                </div>
            )
            }

            {/* ── Advanced Settings (Kling 3.0 only) ── */}
            {
                isV3 && !isBusy && (
                    <div className="rounded-lg border border-white/[0.06] overflow-hidden">
                        <button
                            type="button"
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            className={`w-full flex items-center justify-between px-3 py-2 text-[10px] font-semibold transition-colors
                            ${showAdvanced ? 'bg-white/[0.05] text-white' : 'bg-white/[0.02] text-neutral-400 hover:text-neutral-200'}
                        `}
                        >
                            <span className="flex items-center gap-1.5">
                                <Sliders size={11} className={showAdvanced ? "text-[#E50914]" : ""} />
                                Advanced Settings
                            </span>
                            {showAdvanced ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>

                        {showAdvanced && (
                            <div className="px-3 pb-3 space-y-4 border-t border-white/[0.04] bg-black/20 pt-3">
                                {/* TODO: Uncomment Negative Prompt when switching to official Kling API
                                <div>
                                    <label className="text-[9px] font-semibold text-neutral-500 mb-1 block">Negative Prompt</label>
                                    <textarea
                                        value={negativePrompt}
                                        onChange={(e) => setNegativePrompt(e.target.value)}
                                        placeholder="blurry, distorted, low quality..."
                                        className="w-full bg-white/[0.03] border border-white/[0.08] rounded-md px-2.5 py-2 text-[11px] text-neutral-300 placeholder:text-neutral-600 outline-none focus:border-[#E50914]/40 resize-none transition-colors"
                                        rows={2}
                                    />
                                </div>
                                */}

                                {/* TODO: Uncomment CFG Scale when switching to official Kling API
                                <div>
                                    <label className="text-[9px] font-semibold text-neutral-500 mb-1.5 flex items-center justify-between">
                                        <span>Creativity (CFG)</span>
                                        <span className="text-neutral-400 font-mono">{cfgScale.toFixed(1)}</span>
                                    </label>
                                    <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.1"
                                        value={cfgScale}
                                        onChange={(e) => setCfgScale(parseFloat(e.target.value))}
                                        className="w-full h-1 bg-white/[0.08] rounded-full appearance-none cursor-pointer accent-[#E50914]"
                                    />
                                </div>
                                */}

                                {/* Sound + Multi-Shot Toggles */}
                                <div className="flex flex-wrap gap-4">
                                    {/* Sound Toggle */}
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <div onClick={() => setSound(sound === 'on' ? 'off' : 'on')} className={`w-7 h-3.5 rounded-full transition-colors relative ${sound === 'on' ? 'bg-[#E50914]' : 'bg-white/[0.1]'}`}>
                                            <div className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white transition-transform ${sound === 'on' ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                                        </div>
                                        <span className="text-[10px] text-neutral-400 group-hover:text-neutral-300">Sound</span>
                                    </label>

                                    {/* TODO: Uncomment Watermark toggle when switching to official Kling API
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <div onClick={() => setWatermark(!watermark)} className={`w-7 h-3.5 rounded-full transition-colors relative ${watermark ? 'bg-[#E50914]' : 'bg-white/[0.1]'}`}>
                                            <div className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white transition-transform ${watermark ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                                        </div>
                                        <span className="text-[10px] text-neutral-400 group-hover:text-neutral-300">Watermark</span>
                                    </label>
                                    */}

                                    {/* Multi-Shot Toggle */}
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <div onClick={() => setMultiShot(!multiShot)} className={`w-7 h-3.5 rounded-full transition-colors relative ${multiShot ? 'bg-[#E50914]' : 'bg-white/[0.1]'}`}>
                                            <div className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white transition-transform ${multiShot ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                                        </div>
                                        <span className="text-[10px] text-neutral-400 group-hover:text-neutral-300">Multi-Shot</span>
                                    </label>
                                </div>

                                {/* ── Multi-Shot Editor ── */}
                                {multiShot && (
                                    <div className="p-2.5 rounded-lg border border-white/[0.08] bg-white/[0.02]">
                                        <div className="flex gap-2 mb-2">
                                            <button type="button" onClick={() => setShotType('intelligence')} className={pill(shotType === 'intelligence')}>Auto (Intelligence)</button>
                                            <button type="button" onClick={() => setShotType('customize')} className={pill(shotType === 'customize')}>Manual (Customize)</button>
                                        </div>

                                        {shotType === 'customize' && (
                                            <div className="space-y-2">
                                                {segments.map((seg, idx) => (
                                                    <div key={idx} className="flex gap-2 items-start">
                                                        <span className="text-[9px] text-neutral-500 pt-2 w-3 text-center">{seg.index}</span>
                                                        <textarea
                                                            value={seg.prompt}
                                                            onChange={(e) => updateSegment(idx, 'prompt', e.target.value)}
                                                            placeholder="Segment prompt..."
                                                            className="flex-1 bg-white/[0.03] border border-white/[0.08] rounded-md px-2 py-1.5 text-[10px] text-white outline-none focus:border-[#E50914]/40 resize-none h-[34px]"
                                                        />
                                                        <input
                                                            type="number"
                                                            value={seg.duration}
                                                            onChange={(e) => updateSegment(idx, 'duration', e.target.value)}
                                                            className="w-10 bg-white/[0.03] border border-white/[0.08] rounded-md px-1 py-1.5 text-[10px] text-center outline-none focus:border-[#E50914]/40"
                                                        />
                                                        <button type="button" onClick={() => removeSegment(idx)} className="text-neutral-600 hover:text-red-500 pt-1.5"><Trash2 size={12} /></button>
                                                    </div>
                                                ))}
                                                <button type="button" onClick={addSegment} className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md border border-dashed border-white/[0.1] text-[10px] text-neutral-500 hover:border-white/20 hover:text-neutral-300">
                                                    <Plus size={10} /> Add Segment
                                                </button>

                                                <div className={`text-[9px] flex items-center gap-1.5 ${isDurationValid ? 'text-green-500' : 'text-red-500'}`}>
                                                    <AlertCircle size={10} />
                                                    Total Duration: {getTotalSegmentDuration()}s / {duration}s required
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* ── End Frame (Kling v3) ── */}
                                <div>
                                    <label className="text-[9px] font-semibold text-neutral-500 mb-1 flex items-center justify-between">
                                        <span>
                                            End Frame
                                            {isLinked && nextShotImage
                                                ? <span className="text-[#E50914] font-normal ml-1">· Linked</span>
                                                : <span className="text-neutral-600 font-normal ml-1">(optional)</span>
                                            }
                                        </span>
                                        {!isLinked && endFrameUrl && (
                                            <button
                                                type="button"
                                                onClick={() => setEndFrameUrl(null)}
                                                className="text-[8px] text-red-400/70 hover:text-red-400 transition-colors"
                                            >
                                                Remove
                                            </button>
                                        )}
                                    </label>

                                    {isLinked && nextShotImage ? (
                                        <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-[#E50914]/30 bg-black">
                                            <img src={nextShotImage} alt="Next Shot (Linked)" className="w-full h-full object-cover" />
                                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2.5 py-2">
                                                <div className="flex items-center gap-1.5">
                                                    <Link2 size={9} className="text-[#E50914]" />
                                                    <span className="text-[8px] text-neutral-300">Linked to next shot — morph target</span>
                                                </div>
                                            </div>
                                        </div>
                                    ) : endFrameUrl ? (
                                        <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-white/[0.1] bg-black group">
                                            <img src={endFrameUrl} alt="End Frame" className="w-full h-full object-cover" />
                                            <button
                                                type="button"
                                                onClick={() => setEndFrameUrl(null)}
                                                className="absolute top-1.5 right-1.5 p-1 bg-black/60 hover:bg-red-500/80 rounded-full text-white opacity-0 group-hover:opacity-100 transition-all"
                                            >
                                                <X size={10} />
                                            </button>
                                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5">
                                                <span className="text-[8px] text-neutral-300">Target frame — video will transition to this image</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                ref={endFrameInputRef}
                                                onChange={async (e) => {
                                                    const file = e.target.files?.[0];
                                                    if (!file) return;
                                                    try {
                                                        setIsUploadingEndFrame(true);
                                                        const path = `end_frames/${Date.now()}_${file.name}`;
                                                        const storageRef = ref(storage, path);
                                                        await uploadBytes(storageRef, file);
                                                        const url = await getDownloadURL(storageRef);
                                                        setEndFrameUrl(url);
                                                    } catch (err) {
                                                        console.error('[EndFrameUpload] Failed:', err);
                                                    } finally {
                                                        setIsUploadingEndFrame(false);
                                                        if (endFrameInputRef.current) endFrameInputRef.current.value = '';
                                                    }
                                                }}
                                            />
                                            <button
                                                type="button"
                                                disabled={isUploadingEndFrame}
                                                onClick={() => endFrameInputRef.current?.click()}
                                                className="w-full py-3 rounded-lg border border-dashed border-white/[0.12] flex flex-col items-center justify-center gap-1.5
                                                    bg-white/[0.02] hover:bg-white/[0.05] hover:border-[#E50914]/30 transition-all cursor-pointer
                                                    disabled:opacity-40 disabled:cursor-wait"
                                            >
                                                {isUploadingEndFrame ? (
                                                    <Loader2 size={16} className="text-[#E50914] animate-spin" />
                                                ) : (
                                                    <>
                                                        <ImagePlus size={16} className="text-neutral-500" />
                                                        <span className="text-[9px] text-neutral-500">Add End Frame</span>
                                                        <span className="text-[7px] text-neutral-600">Video will smoothly transition to this image</span>
                                                    </>
                                                )}
                                            </button>
                                        </>
                                    )}
                                </div>

                                {/* TODO: Uncomment Elements & Voices sections when switching to official Kling API
                                <div className="space-y-3">
                                    <div className={voiceList.length > 0 ? 'opacity-30 pointer-events-none' : ''}>
                                        <label className="text-[9px] font-semibold text-neutral-500 mb-1 flex justify-between items-center">
                                            <span>Elements (Max 6)</span>
                                            <span className="text-neutral-500">{elementList.length}/6</span>
                                        </label>

                                        <div className="grid grid-cols-3 gap-2">
                                            {elementList.map((id) => {
                                                const el = selectedElements.find(e => e.id === id || e.local_id === id);
                                                return (
                                                    <div key={id} className="relative aspect-square rounded-lg overflow-hidden border border-white/[0.1] bg-white/[0.02] group">
                                                        {el ? (
                                                            <Image src={el.image_url} alt={el.name} fill className="object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-[9px] text-neutral-500 font-mono break-all p-1">
                                                                {id.slice(0, 4)}
                                                            </div>
                                                        )}

                                                        <div className="absolute inset-x-0 bottom-0 bg-black/60 backdrop-blur-sm px-1.5 py-1 text-[8px] text-white font-mono truncate">
                                                            {el?.name || id}
                                                        </div>

                                                        <button
                                                            onClick={() => handleElementListChange(elementList.filter(e => e !== id))}
                                                            className="absolute top-1 right-1 p-1 bg-black/50 hover:bg-red-500/80 rounded-full text-white opacity-0 group-hover:opacity-100 transition-all"
                                                        >
                                                            <Trash2 size={10} />
                                                        </button>
                                                    </div>
                                                );
                                            })}

                                            {elementList.length < 6 && (
                                                <button
                                                    type="button"
                                                    onClick={onOpenElementLibrary}
                                                    className="aspect-square rounded-lg border border-dashed border-white/[0.1] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.2] flex flex-col items-center justify-center gap-1 text-neutral-500 hover:text-neutral-300 transition-all"
                                                >
                                                    <Plus size={16} />
                                                    <span className="text-[9px]">Add</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div className={elementList.length > 0 ? 'opacity-30 pointer-events-none' : ''}>
                                        <label className="text-[9px] font-semibold text-neutral-500 mb-1 block">Voices (Max 2)</label>
                                        <div className="flex gap-1.5 mb-1.5">
                                            <input
                                                value={voiceIdInput}
                                                onChange={(e) => setVoiceIdInput(e.target.value)}
                                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addVoice(); } }}
                                                placeholder="Voice ID..."
                                                className="flex-1 bg-white/[0.03] border border-white/[0.08] rounded-md px-2 py-1.5 text-[10px] min-w-0"
                                            />
                                            <button type="button" onClick={addVoice} className="w-7 h-7 flex items-center justify-center bg-white/[0.05] rounded-md border border-white/[0.1] text-white hover:bg-white/[0.1]"><Plus size={12} /></button>
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            {voiceList.map((id, i) => (
                                                <div key={i} className="bg-blue-500/20 border border-blue-500/40 text-white text-[9px] px-1.5 py-0.5 rounded flex items-center gap-1">
                                                    <span className="truncate max-w-[60px]">{id}</span>
                                                    <button type="button" onClick={() => setVoiceList(voiceList.filter(v => v !== id))}><Trash2 size={8} /></button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                */}

                            </div>
                        )}
                    </div>
                )
            }

            {/* ── Action Buttons ── */}
            {!hideActions && (
                <>
                    <div className="flex gap-2">
                        <button
                            onClick={handleAnimate}
                            disabled={!hasImage || isBusy}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[11px] font-bold transition-all
                                ${isLinked
                                    ? 'bg-[#E50914] text-white border border-[#E50914] hover:bg-[#E50914]/90'
                                    : hasImage
                                        ? 'bg-white/[0.06] text-white border border-white/[0.1] hover:border-white/20 hover:bg-white/[0.1]'
                                        : 'bg-white/[0.03] text-neutral-600 border border-white/[0.05] cursor-not-allowed'
                                }
                                ${isBusy ? '!cursor-not-allowed opacity-50' : ''}
                            `}
                        >
                            {isBusy ? (
                                <>
                                    <Loader2 size={13} className="animate-spin" />
                                    {hasVideo ? 'Animating...' : 'Generating...'}
                                </>
                            ) : isLinked ? (
                                <><Link2 size={13} /> Morph to Next {videoCost > 0 && <span className="opacity-60 text-[9px] font-normal">· {formatCredits(videoCost)} cr</span>}</>
                            ) : (
                                <>
                                    {hasVideo ? <RefreshCw size={13} /> : <Film size={13} />}
                                    {hasVideo ? 'Re-Animate' : 'Animate'}
                                    {videoCost > 0 && (
                                        <span className="opacity-60 text-[9px] font-normal">· {formatCredits(videoCost)} cr</span>
                                    )}
                                </>
                            )}
                        </button>
                    </div>

                    {/* Disabled Reason Helper */}
                    {
                        (!isBusy && !isLinked) && !hasImage && (
                            <div className="text-[9px] text-center min-h-[14px]">
                                <span className="text-red-400/80">Image required to animate.</span>
                            </div>
                        )
                    }

                    {/* ── Extend + (Seedance 2.0 video continuation) ── */}
                    {
                        !isBusy && shotData?.seedance_task_id && shotData?.video_url && (
                            <button
                                type="button"
                                onClick={() => {
                                    if (onExtend && shotData.seedance_task_id) {
                                        onExtend(shotData.seedance_task_id, buildOptions());
                                    }
                                }}
                                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-bold transition-all cursor-pointer
                                bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30
                                text-amber-300 hover:border-amber-500/60 hover:from-amber-500/15 hover:to-orange-500/15
                                shadow-[0_0_12px_rgba(245,158,11,0.08)] hover:shadow-[0_0_20px_rgba(245,158,11,0.15)]"
                            >
                                <Plus size={12} /> Extend Video
                                {videoCost > 0 && <span className="opacity-60 text-[9px] font-normal">· {formatCredits(videoCost)} cr</span>}
                            </button>
                        )
                    }
                </>
            )}
        </div >
    );
};
