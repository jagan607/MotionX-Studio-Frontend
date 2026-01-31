"use client";

import React, { useState, useRef, useEffect } from 'react';
import { X, User, MapPin, ArrowLeft } from 'lucide-react';
import { fetchElevenLabsVoices, Voice } from '@/lib/elevenLabs';
import { constructLocationPrompt, constructCharacterPrompt } from '@/lib/promptUtils';
import { toast } from 'react-hot-toast';
import { Asset, CharacterProfile, LocationProfile } from '@/lib/types';

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
    onGenerate: () => void;
    onCreateAndGenerate?: (data: any) => Promise<void>;
    onUpdateTraits: (data: any) => Promise<void>;
    onLinkVoice: (v: { voice_id: string; voice_name: string }) => Promise<void>;

    styles?: any;
}

export const AssetModal: React.FC<AssetModalProps> = (props) => {
    const {
        isOpen, assetType, currentData, assetName, onUpdateTraits,
        setGenPrompt, genPrompt, onClose, isProcessing, onGenerate,
        onCreateAndGenerate,
        onUpload, genre, style
    } = props;

    // --- STATE ---
    const [editableName, setEditableName] = useState(assetName);
    const [editableTraits, setEditableTraits] = useState<any>({});
    const [initialTraits, setInitialTraits] = useState<any>({});
    const [initialName, setInitialName] = useState(assetName);
    const [isSavingTraits, setIsSavingTraits] = useState(false);

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
        if (isVoiceMode && allVoices.length === 0) loadVoices();
    }, [isVoiceMode, allVoices.length]);

    useEffect(() => {
        setFilteredVoices(allVoices.filter(v => v.name.toLowerCase().includes(voiceSearch.toLowerCase())));
    }, [voiceSearch, allVoices]);

    const initializeData = () => {
        let initialData: any = {};

        // FIX: Cast to 'any' to strictly bypass TS checks against the Interface
        // This allows us to handle the DB Array format even if Interface says Object
        const rawData = currentData as any;
        const vt = rawData.visual_traits;

        if (assetType === 'location') {
            // 1. Handle Visual Keywords (DB Array vs Interface String)
            let keywordsString = "";

            if (Array.isArray(vt)) {
                // DB Format: ["tag1", "tag2"]
                keywordsString = vt.join(', ');
            } else if (typeof vt === 'object' && vt !== null) {
                // Interface Format: { keywords: "tag1, tag2" }
                const kw = vt.keywords;
                if (Array.isArray(kw)) keywordsString = kw.join(', ');
                else if (typeof kw === 'string') keywordsString = kw;
            } else if (typeof vt === 'string') {
                keywordsString = vt;
            }

            // 2. Map Flat DB Fields to UI State
            // Locations in DB have flat atmosphere/lighting/terrain fields
            initialData = {
                visual_traits: keywordsString, // Mapped to 'keywords' input
                atmosphere: rawData.atmosphere || vt?.atmosphere || "",
                lighting: rawData.lighting || vt?.lighting || "",
                terrain: rawData.terrain || vt?.terrain || "",
            };
        } else {
            // Character Logic (Matches Interface)
            // Ensure we handle case where vt is undefined or array safely
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

        // Update prompt immediately
        const existingPrompt = rawData.prompt || rawData.base_prompt; // Handle DB field differences
        if (!existingPrompt) {
            updatePrompt(rawData.name || (assetType === 'location' ? "Location" : "Character"), initialData);
        } else {
            setGenPrompt(existingPrompt);
        }
    };

    // --- HANDLERS ---

    const updatePrompt = (name: string, traits: any) => {
        // Pass the raw string from UI inputs to the utility
        // The utility is now robust enough (via our previous fix) to handle strings
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
                handleSave();
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
        // Keep value as string in state for smooth typing
        const updatedTraits = { ...editableTraits, [key]: value };
        setEditableTraits(updatedTraits);
        updatePrompt(editableName, updatedTraits);
    };

    // Helper to construct the full payload for saving/generating
    const constructPayload = () => {
        let payload: any = {};

        if (assetType === 'location') {
            // 1. Convert UI String (keywords) -> DB Array
            const kws = editableTraits.visual_traits || "";
            const keywordsArray = typeof kws === 'string'
                ? kws.split(',').map((s: string) => s.trim()).filter((s: string) => s)
                : kws;

            // 2. Construct Flat DB Payload
            // We save visual_traits as Array, and others as siblings
            payload = {
                name: editableName,
                visual_traits: keywordsArray,
                atmosphere: editableTraits.atmosphere,
                lighting: editableTraits.lighting,
                terrain: editableTraits.terrain,
                prompt: genPrompt
            };
        } else {
            // Character Payload
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

    const handleSave = async () => {
        if (isCreationMode && !isNameValid) {
            toast.error("Please enter a name for the asset");
            return;
        }

        setIsSavingTraits(true);
        await onUpdateTraits(constructPayload());
        setInitialTraits(editableTraits);
        setInitialName(editableName);
        setIsSavingTraits(false);
        onClose();
    };

    const handleSmartGenerate = async () => {
        if (isCreationMode) {
            if (!isNameValid) {
                toast.error("Please name your asset before generating.");
                return;
            }
            if (onCreateAndGenerate) {
                await onCreateAndGenerate(constructPayload());
            }
        } else {
            onGenerate();
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
    const isSaveDisabled = isSavingTraits || (isCreationMode && !isNameValid);
    const saveButtonText = isSavingTraits
        ? (isCreationMode ? "CREATING..." : "SAVING...")
        : (isCreationMode ? "CREATE ASSET" : "SAVE CONFIGURATION");

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
                                displayImage={currentData?.image_url}
                                isProcessing={isProcessing}
                                genPrompt={genPrompt}
                                setGenPrompt={setGenPrompt}
                                onGenerate={handleSmartGenerate}
                                onUpload={(e) => { if (e.target.files?.[0]) onUpload(e.target.files[0]) }}
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

                {/* FOOTER */}
                {!isVoiceMode && (
                    <div className="p-5 border-t border-[#222] bg-[#0a0a0a] shrink-0">
                        <button
                            onClick={handleSave}
                            disabled={isSaveDisabled}
                            className="w-full py-3 bg-white hover:bg-neutral-200 text-black font-bold text-xs tracking-widest rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {saveButtonText}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};