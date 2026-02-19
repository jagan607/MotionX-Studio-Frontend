import React, { useState } from 'react';
import {
    Film, RefreshCw, Link2, Mic2,
    ChevronDown, ChevronUp, Sliders, Plus, Trash2, AlertCircle, Loader2
} from 'lucide-react';
import type { VideoProvider, AnimateOptions, PromptSegment } from '@/app/hooks/shot-manager/useShotVideoGen';
import type { KlingElement } from '@/app/hooks/shot-manager/useElementLibrary';
import { usePricing } from '@/app/hooks/usePricing';
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
    selectedElements?: KlingElement[]; // [NEW] Full objects for display
    onElementListChange?: (list: string[]) => void;
    onOpenElementLibrary?: () => void;

    // Persistence
    initialSettings?: any;
    onSettingsChange?: (settings: any) => void;
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
    onText2Video
}) => {
    // --- State ---
    const [provider, setProvider] = useState<VideoProvider>(initialSettings?.provider || 'kling-v3');
    const [duration, setDuration] = useState<'3' | '5' | '10' | '15'>(initialSettings?.duration || '5');
    const [mode, setMode] = useState<'std' | 'pro'>(initialSettings?.mode || 'pro');

    // --- Pricing ---
    const { getVideoCost, getLipSyncCost } = usePricing();
    const videoCost = getVideoCost(provider, mode, duration);
    const [showAdvanced, setShowAdvanced] = useState(false);

    // Advanced
    const [negativePrompt, setNegativePrompt] = useState(initialSettings?.negative_prompt || '');
    const [cfgScale, setCfgScale] = useState(initialSettings?.cfg_scale || 0.5);
    const [sound, setSound] = useState<'on' | 'off'>(initialSettings?.sound || 'off');
    const [watermark, setWatermark] = useState(initialSettings?.watermark || false);

    // Multi-Shot
    const [multiShot, setMultiShot] = useState(initialSettings?.multi_shot || false);
    const [shotType, setShotType] = useState<'intelligence' | 'customize'>(initialSettings?.shot_type || 'intelligence');
    const [segments, setSegments] = useState<PromptSegment[]>(initialSettings?.multi_prompt || []);

    // Elements & Voices (Voices still just ID based for now as we don't have a voice library UI yet)
    const [elementIdInput, setElementIdInput] = useState('');
    const [internalElementList, setInternalElementList] = useState<string[]>(initialSettings?.element_list || []);
    const [voiceIdInput, setVoiceIdInput] = useState('');
    const [voiceList, setVoiceList] = useState<string[]>(initialSettings?.voice_list || []);

    const isV3 = provider === 'kling-v3';

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
            provider, duration, mode, negative_prompt: negativePrompt,
            cfg_scale: cfgScale, sound, watermark, multi_shot: multiShot,
            shot_type: shotType, multi_prompt: segments,
            element_list: elementList,
            voice_list: voiceList
        };
        const timer = setTimeout(() => {
            onSettingsChange(currentSettings);
        }, 500);
        return () => clearTimeout(timer);
    }, [provider, duration, mode, negativePrompt, cfgScale, sound, watermark, multiShot, shotType, segments, elementList, voiceList, onSettingsChange]);

    // --- Validation & Options Building ---
    const getTotalSegmentDuration = () => {
        return segments.reduce((acc, seg) => acc + (parseFloat(seg.duration) || 0), 0);
    };

    const isDurationValid = !multiShot || shotType === 'intelligence' || getTotalSegmentDuration() === parseFloat(duration);

    const buildOptions = (): AnimateOptions => ({
        duration,
        mode,
        ...(isV3 && negativePrompt ? { negative_prompt: negativePrompt } : {}),
        ...(isV3 ? {
            cfg_scale: cfgScale,
            sound,
            watermark,
            multi_shot: multiShot,
            shot_type: multiShot ? shotType : undefined,
            multi_prompt: (multiShot && shotType === 'customize') ? segments : undefined,
            element_list: elementList.length > 0 ? elementList.map(id => ({ element_id: String(id) })) : undefined,
            voice_list: voiceList.length > 0 ? voiceList.map(id => ({ voice_id: id })) : undefined,
        } : {}),
    });

    const handleAnimate = () => {
        if (!isDurationValid) return;
        const options = buildOptions();
        onAnimate(provider, isLinked ? nextShotImage : null, options);
    };

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
        if (val && elementList.length < 3 && !elementList.includes(val)) {
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
                <div className="flex gap-1.5">
                    <button type="button" onClick={() => setProvider('kling')} className={pill(provider === 'kling')}>
                        Kling 2.6
                    </button>
                    <button type="button" onClick={() => setProvider('kling-v3')} className={pill(provider === 'kling-v3')}>
                        Kling 3.0
                    </button>
                    <button
                        type="button"
                        onClick={() => { if (!isLinked) setProvider('seedance'); }}
                        disabled={isLinked}
                        className={pill(provider === 'seedance', isLinked)}
                    >
                        Seedance
                    </button>
                </div>
            )}

            {/* ── Basic Controls ── */}
            {!isBusy && (
                <div className="flex gap-1.5 flex-wrap">
                    {/* Duration */}
                    <div className="flex gap-1 flex-1 min-w-[100px]">
                        {(['3', '5', '10', '15'] as const).map(d => (
                            <button
                                key={d}
                                type="button"
                                onClick={() => setDuration(d)}
                                className={pill(duration === d)}
                            >
                                {d}s
                            </button>
                        ))}
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

            {/* ── Advanced Settings (Kling 3.0 only) ── */}
            {isV3 && !isBusy && (
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
                            {/* Negative Prompt */}
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

                            {/* CFG Scale */}
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

                            {/* Sound + Watermark + Multi-Shot Toggles */}
                            <div className="flex flex-wrap gap-4">
                                {[{ label: 'Sound', val: sound === 'on', set: () => setSound(sound === 'on' ? 'off' : 'on') }, { label: 'Watermark', val: watermark, set: () => setWatermark(!watermark) }, { label: 'Multi-Shot', val: multiShot, set: () => setMultiShot(!multiShot) }].map((t, i) => (
                                    <label key={i} className="flex items-center gap-2 cursor-pointer group">
                                        <div onClick={t.set} className={`w-7 h-3.5 rounded-full transition-colors relative ${t.val ? 'bg-[#E50914]' : 'bg-white/[0.1]'}`}>
                                            <div className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white transition-transform ${t.val ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                                        </div>
                                        <span className="text-[10px] text-neutral-400 group-hover:text-neutral-300">{t.label}</span>
                                    </label>
                                ))}
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

                            {/* ── Elements & Voices ── */}
                            <div className="space-y-3">
                                {/* Elements */}
                                <div className={voiceList.length > 0 ? 'opacity-30 pointer-events-none' : ''}>
                                    <label className="text-[9px] font-semibold text-neutral-500 mb-1 flex justify-between items-center">
                                        <span>Elements (Max 3)</span>
                                        <span className="text-neutral-500">{elementList.length}/3</span>
                                    </label>

                                    {/* Element Grid */}
                                    <div className="grid grid-cols-3 gap-2">
                                        {/* Render Selected */}
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

                                                    {/* ID Badge */}
                                                    <div className="absolute inset-x-0 bottom-0 bg-black/60 backdrop-blur-sm px-1.5 py-1 text-[8px] text-white font-mono truncate">
                                                        {el?.name || id}
                                                    </div>

                                                    {/* Remove Button */}
                                                    <button
                                                        onClick={() => handleElementListChange(elementList.filter(e => e !== id))}
                                                        className="absolute top-1 right-1 p-1 bg-black/50 hover:bg-red-500/80 rounded-full text-white opacity-0 group-hover:opacity-100 transition-all"
                                                    >
                                                        <Trash2 size={10} />
                                                    </button>
                                                </div>
                                            );
                                        })}

                                        {/* Add Button */}
                                        {elementList.length < 3 && (
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

                                {/* Voices (Simple List) */}
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

                        </div>
                    )}
                </div>
            )}

            {/* ── Action Buttons ── */}
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
                        <><Link2 size={13} /> Morph to Next</>
                    ) : (
                        <>
                            {hasVideo ? <RefreshCw size={13} /> : <Film size={13} />}
                            {hasVideo ? 'Re-Animate' : 'Animate'}
                            {videoCost > 0 && (
                                <span className="opacity-60 text-[9px] font-normal">· {videoCost} cr</span>
                            )}
                        </>
                    )}
                </button>
            </div>

            {/* Disabled Reason Helper */}
            {(!isBusy && !isLinked) && !hasImage && (
                <div className="text-[9px] text-center min-h-[14px]">
                    <span className="text-red-400/80">Image required to animate.</span>
                </div>
            )}
        </div>
    );
};
