"use client";

import React, { useState, useEffect } from 'react';
import { X, Image as ImageIcon, ChevronRight } from 'lucide-react';
import { VideoSettingsPanel } from './VideoSettingsPanel';
import { ElementLibraryModal } from './ElementLibraryModal';
import { KlingElement, useElementLibrary } from '@/app/hooks/shot-manager/useElementLibrary';
import { AnimateOptions, VideoProvider } from '@/app/hooks/shot-manager/useShotVideoGen';
import Image from 'next/image';
import { Shot } from '@/lib/types';

interface ShotEditorPanelProps {
    shot: Shot | null;
    projectId: string;
    isOpen: boolean;
    onClose: () => void;
    onUpdateShot: (id: string, field: string, value: any) => void;
    onAnimate: (provider: VideoProvider, endFrameUrl?: string | null, options?: AnimateOptions) => void;
    onText2Video?: (options?: AnimateOptions) => void;
    onLipSync: (shot: Shot) => void;
    isGenerating?: boolean;
}

export const ShotEditorPanel: React.FC<ShotEditorPanelProps> = ({
    shot,
    projectId,
    isOpen,
    onClose,
    onUpdateShot,
    onAnimate,
    onLipSync,
    onText2Video,
    isGenerating = false
}) => {
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

    // Fetch elements on mount
    useEffect(() => {
        fetchElements();
    }, [fetchElements]);

    // Reset state when shot changes
    useEffect(() => {
        if (shot) {
            setElementList(shot.video_settings?.element_list || []);
        }
    }, [shot?.id, shot?.video_settings?.element_list]);

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

    const handleElementSelect = (el: KlingElement) => {
        if (!shot) return;

        const newList = [...elementList];
        if (!newList.includes(el.id) && newList.length < 3) {
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
                        {shot.video_url ? (
                            <video src={shot.video_url} controls className="w-full h-full object-contain" />
                        ) : shot.image_url ? (
                            <Image src={shot.image_url} alt="Shot Preview" fill className="object-cover" />
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-neutral-600 bg-white/[0.02]">
                                <ImageIcon size={32} className="mb-2 opacity-50" />
                                <span className="text-xs">No image generated yet</span>
                            </div>
                        )}
                    </div>

                    {/* Prompt Editor */}
                    <div className="space-y-2">
                        <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">Prompt</label>
                        <div className="relative">
                            <textarea
                                value={shot.video_prompt || shot.visual_action || ""}
                                onChange={(e) => onUpdateShot(shot.id, 'video_prompt', e.target.value)}
                                placeholder="Describe the shot..."
                                className="w-full h-32 bg-[#1a1a1a] border border-white/[0.1] rounded-lg px-3 py-3 text-xs text-white outline-none focus:border-white/[0.3] resize-none leading-relaxed"
                            />
                            <div className="absolute bottom-2 right-2 flex gap-1">
                                <button
                                    onClick={() => setIsLibraryOpen(true)}
                                    className="px-2 py-1 bg-white/[0.05] hover:bg-white/[0.1] rounded text-[9px] text-neutral-400 hover:text-white transition-colors border border-white/[0.05]"
                                >
                                    + Character
                                </button>
                            </div>
                        </div>
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
                                    isLinked={false}
                                    onAnimate={handleAnimateWrapper}
                                    onLipSync={() => onLipSync(shot)}
                                    selectedElements={selectedElements}
                                    elementList={elementList}
                                    onElementListChange={(list) => {
                                        setElementList(list);
                                        const currentSettings = shot.video_settings || {};
                                        onUpdateShot(shot.id, 'video_settings', { ...currentSettings, element_list: list });
                                    }}
                                    onOpenElementLibrary={() => setIsLibraryOpen(true)}
                                    initialSettings={shot.video_settings}
                                    onSettingsChange={(newSettings) => {
                                        onUpdateShot(shot.id, 'video_settings', newSettings);
                                    }}
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
