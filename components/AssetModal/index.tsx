"use client";

import React, { useState, useRef, useEffect } from 'react';
import { X, User, MapPin, ArrowLeft, Sparkles } from 'lucide-react';
import { fetchElevenLabsVoices, Voice } from '@/lib/elevenLabs';
import { uploadAssetReference, uploadAssetMain } from '@/lib/api';
import { constructLocationPrompt, constructCharacterPrompt } from '@/lib/promptUtils';
import { toast } from 'react-hot-toast';
import { Asset } from '@/lib/types';

// --- SUB-COMPONENTS ---
import { TraitsTab } from './TraitsTab';
import { VoiceTab } from './VoiceTab';
import { VisualsSection } from './VisualsSection';
import { VoicePreviewBar } from './VoicePreviewBar';

interface AssetModalProps {
    isOpen: boolean;
    onClose: () => void;
    projectId: string;
    assetId: string;
    assetName: string;
    assetType: 'character' | 'location';
    currentData: Asset;

    mode: 'upload' | 'generate';
    setMode: (m: 'upload' | 'generate') => void;
    genPrompt: string;
    setGenPrompt: (p: string) => void;
    isProcessing: boolean;

    genre: string;
    style: string;

    onUpload: (f: File) => void;
    onGenerate: (prompt: string, useRef: boolean) => Promise<string | void | undefined>;
    onCreateAndGenerate?: (data: any) => Promise<void>;
    onUpdateTraits: (data: any) => Promise<any>; // Update type to allow returning Asset
    onLinkVoice: (v: { voice_id: string; voice_name: string }) => Promise<void>;

    styles?: any;
}

export const AssetModal: React.FC<AssetModalProps> = (props) => {
    const {
        isOpen, assetType, currentData, assetName, onUpdateTraits,
        setGenPrompt, genPrompt, onClose, isProcessing: parentIsProcessing,
        genre, style
    } = props;

    // --- STATE ---
    const [editableName, setEditableName] = useState(assetName);
    const [editableTraits, setEditableTraits] = useState<any>({});
    const [initialTraits, setInitialTraits] = useState<any>({});
    const [initialName, setInitialName] = useState(assetName);
    const [isSavingTraits, setIsSavingTraits] = useState(false);

    // Local processing state
    const [isGenerating, setIsGenerating] = useState(false);
    const isProcessing = parentIsProcessing || isGenerating;

    // Visuals State
    const [refImage, setRefImage] = useState<string | null>(null);
    const [localDisplayImage, setLocalDisplayImage] = useState<string | undefined>(currentData.image_url);
    const [useRefForGen, setUseRefForGen] = useState(true);

    // Voice State
    const [isVoiceMode, setIsVoiceMode] = useState(false);
    const [allVoices, setAllVoices] = useState<Voice[]>([]);
    const [filteredVoices, setFilteredVoices] = useState<Voice[]>([]);
    const [voiceSearch, setVoiceSearch] = useState('');
    const [isLoadingVoices, setIsLoadingVoices] = useState(false);
    const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
    const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(null);
    const [isLinkingVoice, setIsLinkingVoice] = useState(false);

    const audioRef = useRef<HTMLAudioElement | null>(null);

    // --- DERIVED STATE ---
    const isCreationMode = currentData.id === 'new';
    const isNameValid = editableName && editableName.trim().length > 0;

    // --- INITIALIZATION ---
    useEffect(() => {
        if (isOpen && currentData) {
            setIsVoiceMode(false);
            initializeData();
        }
    }, [isOpen, props.assetId, JSON.stringify(currentData), assetType]);

    useEffect(() => {
        setLocalDisplayImage(currentData.image_url);
    }, [currentData.image_url]);

    useEffect(() => {
        if (isVoiceMode && allVoices.length === 0) loadVoices();
    }, [isVoiceMode, allVoices.length]);

    useEffect(() => {
        setFilteredVoices(allVoices.filter(v => v.name.toLowerCase().includes(voiceSearch.toLowerCase())));
    }, [voiceSearch, allVoices]);

    const initializeData = () => {
        let initialData: any = {};
        const rawData = currentData as any;
        const vt = rawData.visual_traits;

        if (assetType === 'location') {
            let keywordsString = "";
            if (Array.isArray(vt)) {
                keywordsString = vt.join(', ');
            } else if (typeof vt === 'object' && vt !== null) {
                const kw = vt.keywords;
                if (Array.isArray(kw)) keywordsString = kw.join(', ');
                else if (typeof kw === 'string') keywordsString = kw;
            } else if (typeof vt === 'string') {
                keywordsString = vt;
            }
            initialData = {
                visual_traits: keywordsString,
                atmosphere: rawData.atmosphere || vt?.atmosphere || "",
                lighting: rawData.lighting || vt?.lighting || "",
                terrain: rawData.terrain || vt?.terrain || "",
            };
        } else {
            const charTraits = (vt && !Array.isArray(vt)) ? vt : {};
            initialData = {
                age: charTraits.age || "",
                ethnicity: charTraits.ethnicity || "",
                hair: charTraits.hair || "",
                clothing: charTraits.clothing || "",
                vibe: charTraits.vibe || "",
                visual_traits: charTraits
            };
            if (rawData.type === 'character') {
                setSelectedVoiceId(rawData.voice_config?.voice_id || null);
            }
        }

        setEditableTraits(initialData);
        setInitialTraits(initialData);
        setEditableName(rawData.name || "");
        setInitialName(rawData.name || "");

        const hasRef = !!rawData.ref_image_url;
        setRefImage(rawData.ref_image_url || null);
        setUseRefForGen(hasRef);

        const existingPrompt = rawData.prompt || rawData.base_prompt;
        if (!existingPrompt) {
            updatePrompt(rawData.name || (assetType === 'location' ? "Location" : "Character"), initialData);
        } else {
            setGenPrompt(existingPrompt);
        }
    };

    const updatePrompt = (name: string, traits: any) => {
        const constructed = assetType === 'location'
            ? constructLocationPrompt(name || "Location", traits.visual_traits, traits, genre, style)
            : constructCharacterPrompt(name || "Character", traits, traits, genre, style);
        setGenPrompt(constructed);
    };

    const hasUnsavedChanges = () => {
        const traitsChanged = JSON.stringify(editableTraits) !== JSON.stringify(initialTraits);
        const nameChanged = editableName !== initialName;
        return traitsChanged || nameChanged;
    };

    const handleCloseRequest = () => {
        if (hasUnsavedChanges()) {
            if (isCreationMode && !isNameValid) {
                onClose();
                return;
            }
            if (window.confirm("You have unsaved changes. Do you want to save before closing?")) {
                if (isCreationMode && !isNameValid) {
                    toast.error("Please enter a name to save.");
                    return;
                }
                handleSaveOnly();
            } else {
                onClose();
            }
        } else {
            onClose();
        }
    };

    const loadVoices = async () => {
        setIsLoadingVoices(true);
        const voices = await fetchElevenLabsVoices();
        setAllVoices(voices); setFilteredVoices(voices);
        setIsLoadingVoices(false);
    };

    const handlePlayPreview = (url: string, id: string) => {
        if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
        if (playingVoiceId === id) { setPlayingVoiceId(null); return; }
        const audio = new Audio(url); audioRef.current = audio; audio.play(); setPlayingVoiceId(id);
        audio.onended = () => setPlayingVoiceId(null);
    };

    const handleMainViewPlay = async () => {
        if (currentData.type !== 'character') return;
        const vid = currentData.voice_config?.voice_id;
        if (!vid) return;

        if (playingVoiceId === vid) {
            if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
            setPlayingVoiceId(null);
            return;
        }

        let voice = allVoices.find(v => v.voice_id === vid);
        if (!voice) {
            setIsLoadingVoices(true);
            const fetched = await fetchElevenLabsVoices();
            setAllVoices(fetched); setFilteredVoices(fetched);
            voice = fetched.find(v => v.voice_id === vid);
            setIsLoadingVoices(false);
        }

        if (voice?.preview_url) handlePlayPreview(voice.preview_url, vid);
        else toast.error("Voice preview not found.");
    };

    const handleNameChange = (val: string) => {
        setEditableName(val);
        updatePrompt(val, editableTraits);
    };

    const handleTraitChange = (key: string, value: string) => {
        const updatedTraits = { ...editableTraits, [key]: value };
        setEditableTraits(updatedTraits);
        updatePrompt(editableName, updatedTraits);
    };

    const constructPayload = () => {
        let payload: any = {};
        if (assetType === 'location') {
            const kws = editableTraits.visual_traits || "";
            const keywordsArray = typeof kws === 'string'
                ? kws.split(',').map((s: string) => s.trim()).filter((s: string) => s)
                : kws;
            payload = {
                name: editableName,
                visual_traits: keywordsArray,
                atmosphere: editableTraits.atmosphere,
                lighting: editableTraits.lighting,
                terrain: editableTraits.terrain,
                prompt: genPrompt
            };
        } else {
            payload = {
                name: editableName,
                visual_traits: {
                    age: editableTraits.age,
                    ethnicity: editableTraits.ethnicity,
                    hair: editableTraits.hair,
                    clothing: editableTraits.clothing,
                    vibe: editableTraits.vibe
                },
                prompt: genPrompt
            };
        }
        return payload;
    };

    // --- UPLOAD HANDLER: REF (FIXED) ---
    const handleRefUpload = async (file: File) => {
        let targetId = currentData.id;

        if (isCreationMode) {
            if (!isNameValid) { toast.error("Enter a name first"); return; }
            const toastId = toast.loading("Creating asset before upload...");
            try {
                // Wait for parent to create and return the new asset
                const newAsset = await onUpdateTraits(constructPayload());
                if (!newAsset || !newAsset.id) throw new Error("Creation failed");

                targetId = newAsset.id;
                setInitialTraits(editableTraits);
                setInitialName(editableName);
                toast.success("Created!", { id: toastId });
            } catch (e) {
                toast.error("Failed to create asset", { id: toastId });
                return;
            }
        }

        // Proceed to upload with real ID
        const toastId = toast.loading("Uploading reference...");
        try {
            const res = await uploadAssetReference(props.projectId, assetType, targetId, file);
            if (res.data.ref_image_url) {
                setRefImage(res.data.ref_image_url);
                setUseRefForGen(true);
                toast.success("Reference Linked", { id: toastId });
            }
        } catch (e) {
            console.error(e);
            toast.error("Upload failed", { id: toastId });
        }
    };

    // --- UPLOAD HANDLER: MAIN (FIXED) ---
    const handleMainUpload = async (file: File) => {
        let targetId = currentData.id;

        if (isCreationMode) {
            if (!isNameValid) { toast.error("Enter a name first"); return; }
            const toastId = toast.loading("Creating asset before upload...");
            try {
                const newAsset = await onUpdateTraits(constructPayload());
                if (!newAsset || !newAsset.id) throw new Error("Creation failed");

                targetId = newAsset.id;
                setInitialTraits(editableTraits);
                setInitialName(editableName);
                toast.success("Created!", { id: toastId });
            } catch (e) {
                toast.error("Failed to create asset", { id: toastId });
                return;
            }
        }

        const toastId = toast.loading("Uploading visual...");
        try {
            const res = await uploadAssetMain(props.projectId, assetType, targetId, file);
            if (res.data.image_url) {
                setLocalDisplayImage(res.data.image_url);
                toast.success("Visual Updated", { id: toastId });
            }
        } catch (e) {
            console.error(e);
            toast.error("Upload failed", { id: toastId });
        }
    };

    const handleSaveOnly = async () => {
        if (isCreationMode && !isNameValid) {
            toast.error("Please enter a name");
            return;
        }
        setIsSavingTraits(true);
        try {
            await onUpdateTraits(constructPayload());
            setInitialTraits(editableTraits);
            setInitialName(editableName);
            toast.success("Configuration Saved");
            // Do not close, allow user to continue
        } catch (e) {
            console.error(e);
            toast.error("Failed to save");
        } finally {
            setIsSavingTraits(false);
        }
    };

    const handleGenerateClick = async () => {
        if (!isNameValid) {
            toast.error("Please enter a name");
            return;
        }

        setIsGenerating(true);
        try {
            if (isCreationMode && props.onCreateAndGenerate) {
                await props.onCreateAndGenerate(constructPayload());
            } else {
                await onUpdateTraits(constructPayload());
                setInitialTraits(editableTraits);
                setInitialName(editableName);

                const resultUrl = await props.onGenerate(genPrompt, useRefForGen);

                if (resultUrl && typeof resultUrl === 'string') {
                    setLocalDisplayImage(resultUrl);
                    toast.success("Visual Generated");
                }
            }
        } catch (e) {
            console.error(e);
            toast.error("Generation failed");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleVoiceLink = async () => {
        const v = allVoices.find(v => v.voice_id === selectedVoiceId);
        if (v) {
            setIsLinkingVoice(true);
            await props.onLinkVoice({ voice_id: v.voice_id, voice_name: v.name });
            setIsLinkingVoice(false);
            setIsVoiceMode(false);
        }
    };

    if (!isOpen) return null;

    const voiceConfig = currentData.type === 'character' ? currentData.voice_config : null;
    const isSaveDisabled = isSavingTraits || isGenerating || (isCreationMode && !isNameValid);

    return (
        <div className="fixed inset-0 bg-black/90 z-[200] flex items-center justify-center backdrop-blur-sm">
            <style>{`.modal-scroll::-webkit-scrollbar { width: 6px; } .modal-scroll::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }`}</style>

            <div className="bg-[#090909] border border-[#222] rounded-xl w-[600px] max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">

                {/* HEADER */}
                <div className="p-5 border-b border-[#222] flex justify-between items-center bg-[#0a0a0a] shrink-0">
                    <div className="flex items-center gap-3">
                        {isVoiceMode && <ArrowLeft size={20} className="cursor-pointer hover:text-motion-red" onClick={() => setIsVoiceMode(false)} />}
                        {assetType === 'location' ? <MapPin size={20} className="text-motion-red" /> : <User size={20} className="text-motion-red" />}
                        <div>
                            <h2 className="text-lg font-display uppercase text-white leading-none">
                                {editableName || (isCreationMode ? "New Asset" : "Untitled")}
                            </h2>
                            <div className="text-[10px] text-neutral-500 tracking-widest mt-1">
                                {isVoiceMode ? "VOICE LIBRARY" : "CONFIGURATION STUDIO"}
                            </div>
                        </div>
                    </div>
                    <X size={20} className="cursor-pointer text-neutral-500 hover:text-white" onClick={handleCloseRequest} />
                </div>

                {/* CONTENT */}
                <div className="modal-scroll flex-1 overflow-y-auto p-5 pb-10 flex flex-col gap-8">
                    {isVoiceMode ? (
                        <VoiceTab
                            voiceSuggestion={voiceConfig?.suggestion}
                            voiceSearch={voiceSearch}
                            setVoiceSearch={setVoiceSearch}
                            isLoadingVoices={isLoadingVoices}
                            filteredVoices={filteredVoices}
                            selectedVoiceId={selectedVoiceId}
                            setSelectedVoiceId={setSelectedVoiceId}
                            playingVoiceId={playingVoiceId}
                            handlePlayPreview={handlePlayPreview}
                            handleVoiceSelection={handleVoiceLink}
                            linkBtnState={{
                                text: selectedVoiceId === (voiceConfig?.voice_id) ? "CURRENTLY LINKED" : "LINK SELECTED VOICE",
                                disabled: !selectedVoiceId || selectedVoiceId === (voiceConfig?.voice_id) || isLinkingVoice
                            }}
                            isLinkingVoice={isLinkingVoice}
                            styles={props.styles}
                        />
                    ) : (
                        <>
                            <div className="animate-in fade-in duration-300">
                                <div className="text-[10px] font-bold text-neutral-500 mb-3 tracking-widest uppercase">Asset Definition</div>
                                <TraitsTab
                                    assetType={assetType!}
                                    editableName={editableName}
                                    onNameChange={handleNameChange}
                                    editableTraits={editableTraits}
                                    handleTraitChange={handleTraitChange}
                                />
                            </div>

                            <VisualsSection
                                displayImage={localDisplayImage}
                                refImage={refImage}
                                isProcessing={isProcessing}
                                genPrompt={genPrompt}
                                setGenPrompt={setGenPrompt}

                                onUploadRef={handleRefUpload}
                                onUploadMain={handleMainUpload}

                                useRef={useRefForGen}
                                onToggleUseRef={() => setUseRefForGen(!useRefForGen)}
                            />

                            {assetType === 'character' && (
                                <VoicePreviewBar
                                    voiceName={voiceConfig?.voice_name}
                                    suggestion={voiceConfig?.suggestion}
                                    isPlaying={playingVoiceId === voiceConfig?.voice_id}
                                    isLoading={isLoadingVoices && !allVoices.length}
                                    onPlay={handleMainViewPlay}
                                    onChange={() => setIsVoiceMode(true)}
                                />
                            )}
                        </>
                    )}
                </div>

                {/* FOOTER - SPLIT ACTIONS */}
                {!isVoiceMode && (
                    <div className="p-5 border-t border-[#222] bg-[#0a0a0a] shrink-0 grid grid-cols-2 gap-3">
                        <button
                            onClick={handleSaveOnly}
                            disabled={isSaveDisabled}
                            className="w-full py-3 bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 hover:border-neutral-700 text-neutral-300 font-bold text-xs tracking-widest rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSavingTraits ? "SAVING..." : "SAVE CONFIGURATION"}
                        </button>

                        <button
                            onClick={handleGenerateClick}
                            disabled={isSaveDisabled}
                            className="w-full py-3 bg-white hover:bg-neutral-200 text-black font-bold text-xs tracking-widest rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isGenerating ? (
                                <>GENERATING...</>
                            ) : (
                                <><Sparkles size={14} className="text-motion-red" /> GENERATE AI</>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};