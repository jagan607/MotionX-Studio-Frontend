"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { X, Image as ImageIcon, ChevronRight, Sparkles, Loader2, Film, RefreshCw, Link2, Plus } from 'lucide-react';
import { VideoHistoryStrip } from './VideoHistoryStrip';
import { VideoSettingsPanel, RefMediaItem, getMediaTag } from './VideoSettingsPanel';
import { MentionDropdown } from './MentionDropdown';
import { ElementLibraryModal } from './ElementLibraryModal';
import { KlingElement, useElementLibrary } from '@/app/hooks/shot-manager/useElementLibrary';
import { AnimateOptions, VideoProvider, PreflightResult } from '@/app/hooks/shot-manager/useShotVideoGen';
import { usePromptMention, MentionItem } from '@/app/hooks/usePromptMention';
import { formatCredits } from '@/app/hooks/usePricing';
import { api } from '@/lib/api';
import Image from 'next/image';
import { Shot, VideoHistoryEntry } from '@/lib/types';
import { TourOverlay } from '@/components/tour/TourOverlay';
import { SHOT_SETTINGS_TOUR_STEPS } from '@/lib/tourConfigs';
import { useTour } from '@/hooks/useTour';

interface ShotEditorPanelProps {
    shot: Shot | null;
    projectId: string;
    isOpen: boolean;
    isLinked?: boolean;
    nextShotImage?: string;
    onClose: () => void;
    onUpdateShot: (id: string, field: string, value: any) => void;
    onAnimate: (provider: VideoProvider, endFrameUrl?: string | null, options?: AnimateOptions) => Promise<PreflightResult | void>;
    onText2Video?: (options?: AnimateOptions) => void;
    onLipSync: (shot: Shot) => void;
    isGenerating?: boolean;
    sceneCharacters?: { name: string; image_url: string }[];
    locationImage?: string;
    sceneContext?: { genre?: string; location?: string; scene_action?: string; dialogues?: { speaker: string; line: string }[] };
    sceneShots?: { id: string; image_url?: string; video_url?: string; visual_action?: string }[];
}

export const ShotEditorPanel: React.FC<ShotEditorPanelProps> = ({
    shot,
    projectId,
    isOpen,
    isLinked = false,
    nextShotImage,
    onClose,
    onUpdateShot,
    onAnimate,
    onLipSync,
    onText2Video,
    isGenerating = false,
    sceneCharacters = [],
    locationImage,
    sceneContext,
    sceneShots = [],
}) => {
    // ── Track the active provider locally so the @mention hook stays in sync
    //    even when onUpdateShot is a no-op (e.g. Playground flow). ──
    const [localProvider, setLocalProvider] = useState<string | undefined>(shot?.video_settings?.provider);

    // ── Shot Settings Tour ──
    const { step: settingsTourStep, nextStep: settingsTourNext, completeTour: settingsTourComplete } = useTour('shot_settings_tour');

    // ── Stable callbacks for VideoSettingsPanel (breaks Firestore write loops) ──
    const handleSettingsChange = useCallback((newSettings: any) => {
        if (newSettings?.provider) setLocalProvider(newSettings.provider);
        if (shot) onUpdateShot(shot.id, 'video_settings', newSettings);
    }, [shot?.id, onUpdateShot]);

    const handleElementListChangeForSettings = useCallback((list: string[]) => {
        if (!shot) return;
        setElementList(list);
        const currentSettings = shot.video_settings || {};
        onUpdateShot(shot.id, 'video_settings', { ...currentSettings, element_list: list });
    }, [shot?.id, shot?.video_settings, onUpdateShot]);

    // ── Local Prompt State (decoupled from Firestore to prevent cursor jumping) ──
    const [localPrompt, setLocalPrompt] = useState('');
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const promptTextareaRef = useRef<HTMLTextAreaElement>(null);
    const promptBackdropRef = useRef<HTMLDivElement>(null);
    const isPromptFocusedRef = useRef(false);

    // ── Preflight Warnings State (Phase 3) ──
    const [preflightWarnings, setPreflightWarnings] = useState<string[]>([]);
    const preflightSeenRef = useRef(false);

    // ── @Mention Autocomplete Bridge ──
    const [displayMedia, setDisplayMedia] = useState<RefMediaItem[]>([]);
    const handleDisplayMediaChange = useCallback((items: RefMediaItem[]) => {
        setDisplayMedia(items);
    }, []);

    // ── Active provider for tag format ──
    const activeProvider = localProvider || shot?.video_settings?.provider;

    /** Build reference_media manifest for the enhance_prompt API */
    const buildRefMediaPayload = useCallback(() => {
        if (displayMedia.length === 0) return undefined;
        return displayMedia.map((item, i) => ({
            tag: getMediaTag(displayMedia, i, activeProvider),
            type: item.type,
            name: item.name,
            locked: !!item.locked,
        }));
    }, [displayMedia, activeProvider]);

    // ── Trigger @mention from banner click ──
    const handleTriggerMention = useCallback(() => {
        const textarea = promptTextareaRef.current;
        if (!textarea) return;
        textarea.focus();
        // Insert ' @' at cursor to trigger the autocomplete
        const pos = textarea.selectionStart ?? textarea.value.length;
        const before = textarea.value.slice(0, pos);
        const after = textarea.value.slice(pos);
        const needsSpace = before.length > 0 && !before.endsWith(' ');
        const injection = (needsSpace ? ' ' : '') + '@';
        const newValue = before + injection + after;
        const newCursorPos = pos + injection.length;

        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLTextAreaElement.prototype, 'value'
        )?.set;
        if (nativeInputValueSetter) {
            nativeInputValueSetter.call(textarea, newValue);
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
        }
        requestAnimationFrame(() => {
            textarea.focus();
            textarea.setSelectionRange(newCursorPos, newCursorPos);
        });
    }, []);

    // ── Local Submitting State (covers preflight + animate dead zone) ──
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Sync local prompt from Firestore ONLY when the shot changes (by ID)
    // Focus Lock: never overwrite while the user is actively typing
    useEffect(() => {
        if (shot && !isPromptFocusedRef.current) {
            setLocalPrompt(shot.video_prompt ?? shot.visual_action ?? '');
            setLocalProvider(shot.video_settings?.provider);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [shot?.id]);

    // ── Auto-translate media tags when provider changes ──
    const prevProviderRef = useRef<string | undefined>(shot?.video_settings?.provider);

    useEffect(() => {
        const currentProvider = shot?.video_settings?.provider;
        const prevProvider = prevProviderRef.current;
        prevProviderRef.current = currentProvider;

        // Only translate between Seedance ↔ Omni
        if (!prevProvider || !currentProvider || prevProvider === currentProvider) return;

        const fromSeedanceToOmni =
            (prevProvider === 'seedance-2' || prevProvider === 'seedance') &&
            currentProvider === 'kling-v3-omni';
        const fromOmniToSeedance =
            prevProvider === 'kling-v3-omni' &&
            (currentProvider === 'seedance-2' || currentProvider === 'seedance');

        if (!fromSeedanceToOmni && !fromOmniToSeedance) return;

        let updated = localPrompt;
        if (fromSeedanceToOmni) {
            // @image1 → @image_1  (add underscore)
            updated = updated.replace(/@image(\d+)/g, '@image_$1');
            // @video1 → @video  (flatten to single un-numbered tag)
            updated = updated.replace(/@video\d+/g, '@video');
            // Deduplicate @video if multiple existed
            const videoCount = (updated.match(/@video/g) || []).length;
            if (videoCount > 1) {
                let seen = false;
                updated = updated.replace(/@video/g, () => {
                    if (!seen) { seen = true; return '@video'; }
                    return '';
                });
            }
            // Remove @audio tags (Omni doesn't support audio refs)
            updated = updated.replace(/@audio\d+\s*/g, '');
        } else {
            // @image_1 → @image1  (remove underscore)
            updated = updated.replace(/@image_(\d+)/g, '@image$1');
            // @video → @video1  (add number)
            updated = updated.replace(/@video(?!\d)/g, '@video1');
        }

        updated = updated.replace(/\s{2,}/g, ' ').trim();

        if (updated !== localPrompt) {
            setLocalPrompt(updated);
            if (shot) onUpdateShot(shot.id, 'video_prompt', updated);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [shot?.video_settings?.provider]);

    // Cleanup debounce timer on unmount
    useEffect(() => {
        return () => {
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        };
    }, []);

    const handlePromptChange = useCallback((value: string) => {
        setLocalPrompt(value);

        // Debounce the Firestore write
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => {
            if (shot) onUpdateShot(shot.id, 'video_prompt', value);
        }, 500);
    }, [shot?.id, onUpdateShot]);

    // ── @imageN Cursor-Position Tag Injection (Phase 2) ──
    const handleInsertPromptTag = useCallback((tag: string) => {
        if (!shot) return;
        const textarea = promptTextareaRef.current;
        const current = localPrompt;

        let newPrompt: string;
        if (textarea) {
            const start = textarea.selectionStart ?? current.length;
            const end = textarea.selectionEnd ?? current.length;
            // Splice the tag at cursor position
            newPrompt = current.slice(0, start) + ` ${tag} ` + current.slice(end);
        } else {
            // Fallback: append
            newPrompt = current ? `${current} ${tag}` : tag;
        }

        setLocalPrompt(newPrompt);

        // Debounce Firestore write
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => {
            onUpdateShot(shot.id, 'video_prompt', newPrompt);
        }, 300);

        // Restore focus and cursor position after tag insertion
        if (textarea) {
            const newCursorPos = (textarea.selectionStart ?? current.length) + tag.length + 2;
            requestAnimationFrame(() => {
                textarea.focus();
                textarea.setSelectionRange(newCursorPos, newCursorPos);
            });
        }
    }, [shot?.id, localPrompt, onUpdateShot]);

    // ── @Mention Autocomplete Hook (must be after handleInsertPromptTag) ──
    const isSeedance2 = activeProvider === 'seedance-2' || activeProvider === 'seedance';
    const isOmniProvider = activeProvider === 'kling-v3-omni';
    const mentionItems: MentionItem[] = React.useMemo(() =>
        displayMedia.map((item, i) => ({
            tag: getMediaTag(displayMedia, i, activeProvider),
            type: item.type,
            url: item.url,
            name: item.name,
            locked: item.locked,
        })),
        [displayMedia, activeProvider]
    );

    const mention = usePromptMention({
        textareaRef: promptTextareaRef,
        items: mentionItems,
        enabled: !!(isSeedance2 || isOmniProvider),
        onInsert: handlePromptChange,
    });

    // ── Backdrop highlight: build tag→type lookup + renderer ──
    const knownTagMap = useMemo(() => {
        const map = new Map<string, string>(); // lowercase tag → type
        for (const item of mentionItems) {
            map.set(item.tag.toLowerCase(), item.type);
        }
        return map;
    }, [mentionItems]);

    const TAG_COLOR: Record<string, string> = {
        image: '#F6C46C',  // warm amber
        video: '#C084FC',  // purple
        audio: '#67E8F9',  // cyan
    };

    const renderHighlightedPrompt = useCallback((text: string) => {
        if (!text) return <>&nbsp;</>;
        const parts = text.split(/(@\w+)/g);
        return parts.map((part, idx) => {
            if (part.startsWith('@')) {
                const mediaType = knownTagMap.get(part.toLowerCase());
                if (mediaType) {
                    return (
                        <span key={idx} style={{ color: TAG_COLOR[mediaType] || '#60A5FA', fontWeight: 600 }}>
                            {part}
                        </span>
                    );
                }
            }
            return <span key={idx} style={{ color: 'rgba(255,255,255,0.9)' }}>{part}</span>;
        });
    }, [knownTagMap]);

    // Sync scroll between textarea and backdrop
    const handlePromptScroll = useCallback(() => {
        if (promptTextareaRef.current && promptBackdropRef.current) {
            promptBackdropRef.current.scrollTop = promptTextareaRef.current.scrollTop;
        }
    }, []);


    const {
        elements: allElements,
        fetchElements,
        isLoading: isLibLoading,
        createElement,
        deleteElement,
        uploadImage,
        registerKlingAsset
    } = useElementLibrary(projectId);

    const [isLibraryOpen, setIsLibraryOpen] = useState(false);
    const [elementList, setElementList] = useState<string[]>([]);
    const [manualElements, setManualElements] = useState<KlingElement[]>([]);

    // ── AI Prompt Enhancement State ──
    const [isEnhancing, setIsEnhancing] = useState(false);
    const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);
    // Reset preview when shot changes
    useEffect(() => {
        setPreviewVideoUrl(null);
    }, [shot?.id]);

    // ── Animate Info (reported by VideoSettingsPanel) ──
    const [animateInfo, setAnimateInfo] = useState<{
        handleAnimate: () => void;
        cost: number;
        disabled: boolean;
        label: string;
        icon: 'animate' | 're-animate' | 'morph' | 'busy';
        extendAction?: { handleExtend: () => void; cost: number };
    } | null>(null);
    const handleAnimateInfoChange = useCallback((info: typeof animateInfo) => {
        setAnimateInfo(info);
    }, []);

    // Fetch elements on mount
    useEffect(() => {
        fetchElements();
    }, [fetchElements]);

    // Reset state when shot changes
    // NOTE: Use serialized string for element_list dep to avoid infinite loop —
    // each Firestore snapshot creates a new [] reference even if content is identical.
    const elementListKey = shot?.video_settings?.element_list?.join(',') ?? '';
    useEffect(() => {
        if (shot) {
            setElementList(shot.video_settings?.element_list || []);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [shot?.id, elementListKey]);


    // Derive full element objects (merge fresh fetch + manual cache)
    const combinedElements = [...allElements, ...manualElements];
    // Build lookup map keyed by BOTH id and local_id so elements are found
    // regardless of whether the shot stores the Kling ID or the local asset ID
    const uniqueElementsMap = new Map<string, KlingElement>();
    combinedElements.forEach(e => {
        uniqueElementsMap.set(e.id, e);
        if (e.local_id) uniqueElementsMap.set(e.local_id, e);
    });

    const selectedElements = elementList
        .map(id => uniqueElementsMap.get(id))
        .filter((e): e is KlingElement => !!e);

    const handleAnimateWrapper = async (provider: VideoProvider, endFrameUrl?: string | null, options?: AnimateOptions) => {
        // Inject the perfectly synced local text into the options.
        // If preflight warnings were already shown, the user is acknowledging them by clicking again.
        const mergedOptions = {
            ...options,
            prompt: localPrompt,
            skipPreflight: preflightSeenRef.current,
        };

        setIsSubmitting(true);
        try {
            // Await the result of the animation/preflight attempt
            const result = await onAnimate(provider, endFrameUrl, mergedOptions);

            // If it was intercepted by preflight and returned warnings, halt!
            if (result?.preflight) {
                setPreflightWarnings(result.warnings);
                preflightSeenRef.current = true;
                return; // DO NOT close the panel
            }

            // If successful or bypassed (no warnings), clear warnings and close
            setPreflightWarnings([]);
            preflightSeenRef.current = false;
            onClose();
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleExtend = (parentTaskId: string, options?: AnimateOptions) => {
        onAnimate('seedance-2', null, { ...options, parent_task_id: parentTaskId });
        onClose();
    };

    const handleElementSelect = (el: KlingElement) => {
        if (!shot) return;

        const newList = [...elementList];
        if (!newList.includes(el.id) && newList.length < 6) {
            newList.push(el.id);
            setElementList(newList);
            setManualElements(prev => [...prev, el]);

            const currentSettings = shot.video_settings || {};
            onUpdateShot(shot.id, 'video_settings', { ...currentSettings, element_list: newList });
        }

        const currentPrompt = localPrompt || shot.visual_action || "";
        const injection = ` <<<${el.id}>>>`;
        if (!currentPrompt.includes(injection)) {
            const updated = currentPrompt + injection;
            setLocalPrompt(updated);
            onUpdateShot(shot.id, 'video_prompt', updated);
        }

        setIsLibraryOpen(false);
    };

    if (!isOpen || !shot) return null;

    return (
        <>
            {/* ── Shot Settings Tour ── */}
            <TourOverlay
                step={settingsTourStep}
                steps={SHOT_SETTINGS_TOUR_STEPS}
                onNext={settingsTourNext}
                onComplete={settingsTourComplete}
            />

            {/* ── Backdrop ── */}
            <div
                className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200]"
                onClick={onClose}
            />

            {/* ── Centered Modal ── */}
            <div className="fixed inset-0 z-[201] flex items-center justify-center pointer-events-none">
                <div
                    className="pointer-events-auto w-[95%] max-w-6xl h-[90vh] bg-[#111] rounded-2xl border border-white/[0.08] shadow-2xl flex flex-col overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* ── Header ── */}
                    <div className="h-12 px-5 border-b border-white/[0.08] flex items-center justify-between bg-[#141414] flex-shrink-0">
                        <h2 className="text-sm font-bold text-white flex items-center gap-2">
                            Shot Configuration
                            <span className="px-1.5 py-0.5 rounded bg-white/[0.08] text-[10px] text-neutral-500 font-mono">
                                {shot.id.slice(0, 8)}
                            </span>
                        </h2>
                        <button
                            onClick={onClose}
                            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/[0.1] transition-colors"
                        >
                            <X size={16} className="text-neutral-400" />
                        </button>
                    </div>

                    {/* ── Two-Column Body ── */}
                    <div className="flex-1 grid grid-cols-12 gap-0 overflow-hidden">

                        {/* ═══════ LEFT COLUMN — Visuals & Intent (7 cols) ═══════ */}
                        <div className="col-span-7 border-r border-white/[0.06] overflow-y-auto p-5 space-y-5">

                            {/* Video Preview */}
                            <div id="tour-shot-preview" className="aspect-video bg-black rounded-xl overflow-hidden border border-white/[0.1] relative group">
                                {(previewVideoUrl || shot.video_url) ? (
                                    <video
                                        key={previewVideoUrl || shot.video_url}
                                        src={previewVideoUrl || shot.video_url}
                                        controls
                                        className="w-full h-full object-contain"
                                    />
                                ) : shot.image_url ? (
                                    <Image src={shot.image_url} alt="Shot Preview" fill className="object-cover" />
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center text-neutral-600 bg-white/[0.02]">
                                        <ImageIcon size={40} className="mb-3 opacity-40" />
                                        <span className="text-xs text-neutral-500">No image generated yet</span>
                                    </div>
                                )}
                            </div>

                            {/* Shot History */}
                            <VideoHistoryStrip
                                history={shot.video_history || []}
                                activeVideoUrl={shot.video_url}
                                onPreview={(entry) => setPreviewVideoUrl(entry.url)}
                                onRestore={(entry) => {
                                    onUpdateShot(shot.id, 'video_url', entry.url);
                                    setPreviewVideoUrl(null);
                                }}
                            />

                            {/* Prompt Editor */}
                            <div id="tour-shot-prompt" className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">Prompt</label>
                                    <button
                                        type="button"
                                        disabled={isEnhancing || !(shot.video_prompt || shot.visual_action)}
                                        onClick={async () => {
                                            const prompt = shot.video_prompt || shot.visual_action || '';
                                            if (!prompt.trim()) return;
                                            setIsEnhancing(true);
                                            try {
                                                const res = await api.post('/api/v1/shot/enhance_prompt', {
                                                    prompt,
                                                    provider: shot.video_settings?.provider || 'seedance-2',
                                                    duration: shot.video_settings?.duration || '5',
                                                    aspect_ratio: shot.video_settings?.aspect_ratio || '16:9',
                                                    shot_type: shot.shot_type || shot.camera_shot_type,
                                                    characters: sceneCharacters.map(c => c.name).join(', ') || undefined,
                                                    location: sceneContext?.location || undefined,
                                                    genre: sceneContext?.genre || undefined,
                                                    scene_action: sceneContext?.scene_action || shot.visual_action || undefined,
                                                    reference_media: buildRefMediaPayload(),
                                                    dialogues: sceneContext?.dialogues || undefined,
                                                });
                                                if (res.data?.enhanced_prompt) {
                                                    setLocalPrompt(res.data.enhanced_prompt);
                                                    onUpdateShot(shot.id, 'video_prompt', res.data.enhanced_prompt);
                                                }
                                            } catch (e: any) {
                                                console.error('[Enhance] Failed:', e);
                                            } finally {
                                                setIsEnhancing(false);
                                            }
                                        }}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all
                                            ${isEnhancing
                                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 cursor-wait shadow-[0_0_12px_rgba(245,158,11,0.15)]'
                                                : displayMedia.length > 0
                                                    ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 border border-amber-500/40 hover:border-amber-400/60 hover:shadow-[0_0_16px_rgba(245,158,11,0.25)] cursor-pointer'
                                                    : 'bg-white/[0.05] text-neutral-400 border border-white/[0.1] hover:bg-white/[0.1] hover:border-white/[0.2] hover:text-white cursor-pointer'}
                                            disabled:opacity-30 disabled:cursor-not-allowed`}
                                    >
                                        {isEnhancing ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                                        {isEnhancing ? 'Enhancing...' : 'Enhance'}
                                        {displayMedia.length > 0 && !isEnhancing && (
                                            <span className="relative flex h-2 w-2">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                                            </span>
                                        )}
                                    </button>
                                </div>
                                <div className="relative">
                                    {/* Grid stack: backdrop + textarea share the same cell */}
                                    <div
                                        className={`relative grid bg-[#0a0a0a] border border-white/[0.1] rounded-lg overflow-hidden transition-all focus-within:border-white/[0.3]
                                            ${isEnhancing ? 'animate-pulse opacity-60' : ''}`}
                                        style={{ gridTemplateColumns: '1fr' }}
                                    >
                                        {/* Backdrop: highlighted text layer behind the textarea */}
                                        <div
                                            ref={promptBackdropRef}
                                            aria-hidden="true"
                                            className="pointer-events-none whitespace-pre-wrap break-words text-[13px] leading-relaxed px-3 py-3 h-40 overflow-y-auto"
                                            style={{
                                                gridArea: '1 / 1',
                                                wordWrap: 'break-word',
                                                overflowWrap: 'break-word',
                                            }}
                                        >
                                            {renderHighlightedPrompt(localPrompt)}
                                        </div>

                                        <textarea
                                            ref={promptTextareaRef}
                                            value={localPrompt}
                                            onChange={(e) => {
                                                handlePromptChange(e.target.value);
                                                mention.handleChange(e.target.value, e.target.selectionStart ?? undefined);
                                            }}
                                            onFocus={() => { isPromptFocusedRef.current = true; }}
                                            onBlur={(e) => {
                                                isPromptFocusedRef.current = false;
                                                mention.handleBlur();
                                            }}
                                            onKeyDown={mention.handleKeyDown}
                                            onScroll={handlePromptScroll}
                                            aria-expanded={mention.isOpen}
                                            aria-activedescendant={mention.isOpen ? `mention-option-${mention.activeIndex}` : undefined}
                                            placeholder="Describe the shot..."
                                            className="w-full h-40 px-3 py-3 text-[13px] outline-none resize-none leading-relaxed placeholder:text-neutral-600"
                                            style={{
                                                gridArea: '1 / 1',
                                                background: 'transparent',
                                                color: 'transparent',
                                                caretColor: '#F6C46C',
                                            }}
                                        />
                                    </div>

                                    {/* @mention autocomplete dropdown */}
                                    {mention.isOpen && (
                                        <MentionDropdown
                                            items={mention.filteredItems}
                                            activeIndex={mention.activeIndex}
                                            position={mention.menuPosition}
                                            onSelect={mention.insertTag}
                                            onHover={(i) => {}}
                                        />
                                    )}

                                    <div className="absolute bottom-2 right-2 flex gap-1">
                                        {(shot.video_settings?.provider === 'kling-v3') && (
                                            <button
                                                onClick={() => setIsLibraryOpen(true)}
                                                className="px-2 py-1 bg-white/[0.05] hover:bg-white/[0.1] rounded text-[9px] text-neutral-400 hover:text-white transition-colors border border-white/[0.05]"
                                            >
                                                + Character
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Camera Direction Hints */}
                                {(shot.video_settings?.provider === 'seedance-2' || shot.video_settings?.provider === 'seedance' || shot.video_settings?.provider === 'kling-v3-omni') && (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                        {['slow dolly in', 'tracking shot', 'pan left', 'zoom out', 'static close-up', 'crane up'].map(hint => (
                                            <button
                                                key={hint}
                                                type="button"
                                                onClick={() => {
                                                    const current = localPrompt;
                                                    if (!current.toLowerCase().includes(hint)) {
                                                        const updated = current ? `${current}, ${hint}` : hint;
                                                        setLocalPrompt(updated);
                                                        onUpdateShot(shot.id, 'video_prompt', updated);
                                                    }
                                                }}
                                                className="px-2 py-0.5 bg-white/[0.03] border border-white/[0.06] rounded text-[9px] text-neutral-500 hover:text-amber-300 hover:border-amber-500/30 transition-colors"
                                            >
                                                {hint}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ═══════ RIGHT COLUMN — Settings & Execution (5 cols) ═══════ */}
                        <div className="col-span-5 flex flex-col overflow-hidden bg-[#0d0d0d]">

                            {/* Scrollable Settings Area */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                {(shot.image_url || shot.video_url) ? (
                                    <VideoSettingsPanel
                                        hasImage={!!shot.image_url}
                                        hasVideo={!!shot.video_url}
                                        isBusy={isGenerating || isSubmitting}
                                        isLinked={isLinked}
                                        nextShotImage={nextShotImage}
                                        onAnimate={handleAnimateWrapper}
                                        onLipSync={() => onLipSync(shot)}
                                        selectedElements={selectedElements}
                                        elementList={elementList}
                                        onElementListChange={handleElementListChangeForSettings}
                                        onOpenElementLibrary={() => setIsLibraryOpen(true)}
                                        initialSettings={shot.video_settings}
                                        onSettingsChange={handleSettingsChange}
                                        shot={{
                                            seedance_task_id: (shot as any).seedance_task_id,
                                            video_url: shot.video_url,
                                            video_provider: shot.video_settings?.provider,
                                            image_url: shot.image_url,
                                        }}
                                        sceneCharacters={sceneCharacters}
                                        locationImage={locationImage}
                                        onExtend={handleExtend}
                                        hideActions
                                        onAnimateInfoChange={handleAnimateInfoChange}
                                        onInsertPromptTag={handleInsertPromptTag}
                                        onDisplayMediaChange={handleDisplayMediaChange}
                                        promptText={localPrompt}
                                        onTriggerMention={handleTriggerMention}
                                        preflightWarnings={preflightWarnings}
                                        onClearPreflightWarnings={() => { setPreflightWarnings([]); preflightSeenRef.current = false; }}
                                        sceneShots={sceneShots}
                                    />
                                ) : (
                                    <div className="p-6 rounded-xl border border-dashed border-white/[0.1] bg-white/[0.02] text-center mt-4">
                                        <ImageIcon size={28} className="mx-auto mb-2 text-neutral-600 opacity-50" />
                                        <p className="text-[11px] text-neutral-500">
                                            Generate or upload an image to enable video settings.
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* ── Sticky CTA Footer ── */}
                            {(shot.image_url || shot.video_url) && animateInfo && (
                                <div id="tour-shot-animate-btn" className="px-4 py-3 border-t border-white/[0.08] bg-[#111] flex-shrink-0">
                                    <button
                                        onClick={animateInfo.handleAnimate}
                                        disabled={animateInfo.disabled}
                                        className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg text-[12px] font-bold transition-all
                                            ${animateInfo.icon === 'morph'
                                                ? 'bg-[#E50914] text-white border border-[#E50914] hover:bg-[#E50914]/90'
                                                : animateInfo.disabled
                                                    ? 'bg-white/[0.03] text-neutral-600 border border-white/[0.05] cursor-not-allowed'
                                                    : 'bg-white/[0.06] text-white border border-white/[0.1] hover:border-white/20 hover:bg-white/[0.1]'
                                            }
                                        `}
                                    >
                                        {animateInfo.icon === 'busy' ? (
                                            <Loader2 size={14} className="animate-spin" />
                                        ) : animateInfo.icon === 'morph' ? (
                                            <Link2 size={14} />
                                        ) : animateInfo.icon === 're-animate' ? (
                                            <RefreshCw size={14} />
                                        ) : (
                                            <Film size={14} />
                                        )}
                                        {animateInfo.label}
                                        {!animateInfo.disabled && animateInfo.cost > 0 && (
                                            <span className="opacity-60 text-[10px] font-normal">· {formatCredits(animateInfo.cost)} cr</span>
                                        )}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <ElementLibraryModal
                projectId={projectId}
                isOpen={isLibraryOpen}
                onClose={() => {
                    setIsLibraryOpen(false);
                    fetchElements();
                }}
                onSelect={handleElementSelect}
                elements={allElements}
                isLoading={isLibLoading}
                onFetch={fetchElements}
                onCreate={createElement}
                onDelete={deleteElement}
                onUpload={uploadImage}
                onRegister={registerKlingAsset}
            />
        </>
    );
};
