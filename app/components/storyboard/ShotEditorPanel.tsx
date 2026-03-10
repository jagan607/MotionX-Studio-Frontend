"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Image as ImageIcon, ChevronRight, Sparkles, Loader2, Check, Film, RefreshCw, Link2, Plus } from 'lucide-react';
import { VideoHistoryStrip } from './VideoHistoryStrip';
import { VideoSettingsPanel } from './VideoSettingsPanel';
import { ElementLibraryModal } from './ElementLibraryModal';
import { KlingElement, useElementLibrary } from '@/app/hooks/shot-manager/useElementLibrary';
import { AnimateOptions, VideoProvider } from '@/app/hooks/shot-manager/useShotVideoGen';
import { formatCredits } from '@/app/hooks/usePricing';
import { api } from '@/lib/api';
import Image from 'next/image';
import { Shot, VideoHistoryEntry } from '@/lib/types';

interface ShotEditorPanelProps {
    shot: Shot | null;
    projectId: string;
    isOpen: boolean;
    isLinked?: boolean;
    nextShotImage?: string;
    onClose: () => void;
    onUpdateShot: (id: string, field: string, value: any) => void;
    onAnimate: (provider: VideoProvider, endFrameUrl?: string | null, options?: AnimateOptions) => void;
    onText2Video?: (options?: AnimateOptions) => void;
    onLipSync: (shot: Shot) => void;
    isGenerating?: boolean;
    sceneCharacters?: { name: string; image_url: string }[];
    locationImage?: string;
    sceneContext?: { genre?: string; location?: string; scene_action?: string };
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
    sceneContext
}) => {
    // ── Stable callbacks for VideoSettingsPanel (breaks Firestore write loops) ──
    const handleSettingsChange = useCallback((newSettings: any) => {
        if (shot) onUpdateShot(shot.id, 'video_settings', newSettings);
    }, [shot?.id, onUpdateShot]);

    const handleElementListChangeForSettings = useCallback((list: string[]) => {
        if (!shot) return;
        setElementList(list);
        const currentSettings = shot.video_settings || {};
        onUpdateShot(shot.id, 'video_settings', { ...currentSettings, element_list: list });
    }, [shot?.id, shot?.video_settings, onUpdateShot]);

    const [isEnhancing, setIsEnhancing] = useState(false);
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

    // ── AI Prompt Suggestion State ──
    const suggestionCacheRef = useRef<Map<string, string>>(new Map());
    const dismissedRef = useRef<Set<string>>(new Set());
    const userEditedRef = useRef(false);
    const [suggestion, setSuggestion] = useState<string | null>(null);
    const [isFetchingSuggestion, setIsFetchingSuggestion] = useState(false);

    // ── Video History Preview State ──
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

    // ── Background AI Suggestion Fetch ──
    useEffect(() => {
        if (!isOpen || !shot) {
            setSuggestion(null);
            return;
        }

        const shotId = shot.id;
        userEditedRef.current = false;

        // Already dismissed for this shot
        if (dismissedRef.current.has(shotId)) {
            setSuggestion(null);
            return;
        }

        // Already cached
        if (suggestionCacheRef.current.has(shotId)) {
            setSuggestion(suggestionCacheRef.current.get(shotId)!);
            return;
        }

        const prompt = shot.video_prompt || shot.visual_action || '';
        if (!prompt.trim()) {
            setSuggestion(null);
            return;
        }

        const controller = new AbortController();
        setIsFetchingSuggestion(true);

        (async () => {
            try {
                const res = await api.post('/api/v1/shot/enhance_prompt', {
                    prompt,
                    provider: shot.video_settings?.provider || 'seedance-2',
                    duration: shot.video_settings?.duration || '5',
                    aspect_ratio: shot.video_settings?.aspect_ratio || '16:9',
                    shot_type: shot.shot_type || shot.camera_shot_type,
                    characters: sceneCharacters?.map(c => c.name).join(', ') || undefined,
                    location: sceneContext?.location || undefined,
                    genre: sceneContext?.genre || undefined,
                    scene_action: sceneContext?.scene_action || shot.visual_action || undefined,
                }, { signal: controller.signal });

                if (controller.signal.aborted) return;

                const enhanced = res.data?.enhanced_prompt;
                if (enhanced && enhanced !== prompt) {
                    suggestionCacheRef.current.set(shotId, enhanced);
                    // Only show if user hasn't edited since we started
                    if (!userEditedRef.current) {
                        setSuggestion(enhanced);
                    }
                }
            } catch {
                // Fail silently — no toast, no error UI
            } finally {
                if (!controller.signal.aborted) {
                    setIsFetchingSuggestion(false);
                }
            }
        })();

        return () => {
            controller.abort();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, shot?.id]);

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

    const handleAnimateWrapper = (provider: VideoProvider, endFrameUrl?: string | null, options?: AnimateOptions) => {
        onAnimate(provider, endFrameUrl, options);
        onClose();
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

        const currentPrompt = shot.video_prompt || shot.visual_action || "";
        const injection = ` <<<${el.id}>>>`;
        if (!currentPrompt.includes(injection)) {
            onUpdateShot(shot.id, 'video_prompt', currentPrompt + injection);
        }

        setIsLibraryOpen(false);
    };

    if (!isOpen || !shot) return null;

    return (
        <>
            <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[40]"
                onClick={onClose}
            />

            <div className="fixed right-0 top-0 bottom-0 w-[450px] bg-[#141414] border-l border-white/[0.1] z-[50] shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out">
                {/* Header */}
                <div className="h-14 px-5 border-b border-white/[0.08] flex items-center justify-between bg-[#1a1a1a]">
                    <h2 className="text-sm font-bold text-white flex items-center gap-2">
                        Shot Inspector
                        <span className="px-1.5 py-0.5 rounded bg-white/[0.1] text-[10px] text-neutral-400 font-mono">
                            {shot.id.slice(0, 4)}...
                        </span>
                    </h2>
                    <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/[0.1] transition-colors">
                        <X size={16} className="text-neutral-400" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-6">
                    {/* Preview Area */}
                    <div className="aspect-video bg-black rounded-lg overflow-hidden border border-white/[0.1] relative group">
                        {(previewVideoUrl || shot.video_url) ? (
                            <video key={previewVideoUrl || shot.video_url} src={previewVideoUrl || shot.video_url} controls className="w-full h-full object-contain" />
                        ) : shot.image_url ? (
                            <Image src={shot.image_url} alt="Shot Preview" fill className="object-cover" />
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-neutral-600 bg-white/[0.02]">
                                <ImageIcon size={32} className="mb-2 opacity-50" />
                                <span className="text-xs">No image generated yet</span>
                            </div>
                        )}
                    </div>

                    {/* Video History Strip */}
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
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">Prompt</label>
                            <button
                                type="button"
                                disabled={isEnhancing || isFetchingSuggestion || !(shot.video_prompt || shot.visual_action)}
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
                                        });
                                        if (res.data?.enhanced_prompt) {
                                            onUpdateShot(shot.id, 'video_prompt', res.data.enhanced_prompt);
                                        }
                                    } catch (e: any) {
                                        console.error('[Enhance] Failed:', e);
                                    } finally {
                                        setIsEnhancing(false);
                                    }
                                }}
                                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-bold transition-all
                                    ${(isEnhancing || isFetchingSuggestion)
                                        ? 'bg-white/[0.08] text-neutral-300 border border-white/[0.15] cursor-wait'
                                        : 'bg-white/[0.05] text-neutral-400 border border-white/[0.1] hover:bg-white/[0.1] hover:border-white/[0.2] hover:text-white cursor-pointer'}
                                    disabled:opacity-30 disabled:cursor-not-allowed`}
                            >
                                {(isEnhancing || isFetchingSuggestion) ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                                {isEnhancing ? 'Enhancing...' : isFetchingSuggestion ? 'Analyzing...' : 'Enhance'}
                            </button>
                        </div>
                        <div className="relative">
                            <textarea
                                value={shot.video_prompt ?? shot.visual_action ?? ""}
                                onChange={(e) => {
                                    userEditedRef.current = true;
                                    setSuggestion(null);
                                    onUpdateShot(shot.id, 'video_prompt', e.target.value);
                                }}
                                placeholder="Describe the shot..."
                                className={`w-full h-32 bg-[#1a1a1a] border border-white/[0.1] rounded-lg px-3 py-3 text-xs text-white outline-none focus:border-white/[0.3] resize-none leading-relaxed transition-all
                                    ${isEnhancing ? 'animate-pulse opacity-60' : ''}`}
                            />
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

                        {/* ── AI Suggestion Banner ── */}
                        {suggestion && !isEnhancing && (
                            <div className="mt-1.5 px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.1]">
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-1.5">
                                        <Sparkles size={10} className="text-neutral-500" /> AI Suggestion
                                    </span>
                                    <div className="flex items-center gap-1">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                onUpdateShot(shot.id, 'video_prompt', suggestion);
                                                setSuggestion(null);
                                            }}
                                            className="flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-bold bg-white/[0.06] text-neutral-300 border border-white/[0.1] hover:bg-white/[0.1] hover:border-white/[0.2] hover:text-white transition-all cursor-pointer"
                                        >
                                            <Check size={10} /> Apply
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                dismissedRef.current.add(shot.id);
                                                setSuggestion(null);
                                            }}
                                            className="p-1 rounded-md text-neutral-600 hover:text-neutral-300 hover:bg-white/[0.05] transition-all cursor-pointer"
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                </div>
                                <p className="text-[11px] text-neutral-400 leading-relaxed">
                                    {suggestion}
                                </p>
                            </div>
                        )}

                        {/* Camera Direction Hints */}
                        {(shot.video_settings?.provider === 'seedance-2' || shot.video_settings?.provider === 'seedance') && (
                            <div className="flex flex-wrap gap-1 mt-1">
                                {['slow dolly in', 'tracking shot', 'pan left', 'zoom out', 'static close-up', 'crane up'].map(hint => (
                                    <button
                                        key={hint}
                                        type="button"
                                        onClick={() => {
                                            const current = shot.video_prompt ?? shot.visual_action ?? '';
                                            if (!current.toLowerCase().includes(hint)) {
                                                onUpdateShot(shot.id, 'video_prompt', current ? `${current}, ${hint}` : hint);
                                            }
                                        }}
                                        className="px-1.5 py-0.5 bg-white/[0.03] border border-white/[0.06] rounded text-[8px] text-neutral-500 hover:text-amber-300 hover:border-amber-500/30 transition-colors"
                                    >
                                        {hint}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Settings */}
                    {shot.image_url ? (
                        <div className="space-y-2">
                            <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">Generation Settings</label>
                            <div className="bg-[#1a1a1a] rounded-xl p-1 border border-white/[0.05]">
                                <VideoSettingsPanel
                                    hasImage={!!shot.image_url}
                                    hasVideo={!!shot.video_url}
                                    isBusy={isGenerating}
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
                                    }}
                                    sceneCharacters={sceneCharacters}
                                    locationImage={locationImage}
                                    onExtend={handleExtend}
                                    hideActions
                                    onAnimateInfoChange={handleAnimateInfoChange}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="p-4 rounded-xl border border-dashed border-white/[0.1] bg-white/[0.02] text-center">
                            <p className="text-[10px] text-neutral-500">
                                Generate or upload an image above to enable video settings.
                            </p>
                        </div>
                    )}
                </div>

                {/* ── Sticky Bottom Footer ── */}
                {shot.image_url && animateInfo && (
                    <div className="px-5 py-3 border-t border-white/[0.08] bg-[#141414] space-y-2 flex-shrink-0">
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
                                ${animateInfo.icon === 'busy' ? '!cursor-not-allowed opacity-50' : ''}
                            `}
                        >
                            {animateInfo.icon === 'busy' ? (
                                <><Loader2 size={14} className="animate-spin" /> {animateInfo.label}</>
                            ) : animateInfo.icon === 'morph' ? (
                                <><Link2 size={14} /> {animateInfo.label} {animateInfo.cost > 0 && <span className="opacity-60 text-[10px] font-normal">· {formatCredits(animateInfo.cost)} cr</span>}</>
                            ) : (
                                <>
                                    {animateInfo.icon === 're-animate' ? <RefreshCw size={14} /> : <Film size={14} />}
                                    {animateInfo.label}
                                    {animateInfo.cost > 0 && (
                                        <span className="opacity-60 text-[10px] font-normal">· {formatCredits(animateInfo.cost)} cr</span>
                                    )}
                                </>
                            )}
                        </button>

                        {animateInfo.extendAction && (
                            <button
                                type="button"
                                onClick={animateInfo.extendAction.handleExtend}
                                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-bold transition-all cursor-pointer
                                    bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30
                                    text-amber-300 hover:border-amber-500/60 hover:from-amber-500/15 hover:to-orange-500/15
                                    shadow-[0_0_12px_rgba(245,158,11,0.08)] hover:shadow-[0_0_20px_rgba(245,158,11,0.15)]"
                            >
                                <Plus size={12} /> Extend Video
                                {animateInfo.extendAction.cost > 0 && <span className="opacity-60 text-[9px] font-normal">· {formatCredits(animateInfo.extendAction.cost)} cr</span>}
                            </button>
                        )}
                    </div>
                )}
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
