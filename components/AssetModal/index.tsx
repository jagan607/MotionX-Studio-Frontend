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

    // Generation Props
    mode: 'upload' | 'generate';
    setMode: (m: 'upload' | 'generate') => void;
    genPrompt: string;
    setGenPrompt: (p: string) => void;

    // "Persistent Loading" State from Parent
    isProcessing: boolean;

    // Context
    genre: string;
    style: string;

    // Handlers
    onUpload: (f: File) => void;
    onGenerate: () => void;
    onUpdateTraits: (t: any) => Promise<void>;
    onLinkVoice: (v: { voice_id: string; voice_name: string }) => Promise<void>;

    styles?: any;
}

export const AssetModal: React.FC<AssetModalProps> = (props) => {
    const {
        isOpen, assetType, currentData, assetName, onUpdateTraits,
        setGenPrompt, genPrompt, onClose, isProcessing, onGenerate,
        onUpload, genre, style
    } = props;

    // --- STATE ---
    const [editableTraits, setEditableTraits] = useState<any>({});
    const [initialTraits, setInitialTraits] = useState<any>({});
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

    // --- INITIALIZATION ---
    useEffect(() => {
        if (isOpen && currentData) {
            setIsVoiceMode(false);
            initializeTraits();
        }
    }, [isOpen, props.assetId, JSON.stringify(currentData), assetType]);

    useEffect(() => {
        if (isVoiceMode && allVoices.length === 0) loadVoices();
    }, [isVoiceMode, allVoices.length]);

    useEffect(() => {
        setFilteredVoices(allVoices.filter(v => v.name.toLowerCase().includes(voiceSearch.toLowerCase())));
    }, [voiceSearch, allVoices]);

    const initializeTraits = () => {
        let initialData: any = {};
        const vt = currentData.visual_traits || {};

        if (assetType === 'location') {
            const locTraits = vt as LocationProfile['visual_traits'];
            // Map DB 'keywords' to Local 'visual_traits' for the UI input
            initialData = {
                visual_traits: locTraits.keywords ? (Array.isArray(locTraits.keywords) ? locTraits.keywords : locTraits.keywords.split(', ')) : [],
                atmosphere: locTraits.atmosphere || "",
                lighting: locTraits.lighting || "",
                terrain: locTraits.terrain || "",
            };
        } else {
            const charTraits = vt as CharacterProfile['visual_traits'];
            initialData = {
                age: charTraits.age || "",
                ethnicity: charTraits.ethnicity || "",
                hair: charTraits.hair || "",
                clothing: charTraits.clothing || "",
                vibe: charTraits.vibe || "",
                visual_traits: charTraits
            };
            if (currentData.type === 'character') {
                setSelectedVoiceId(currentData.voice_config?.voice_id || null);
            }
        }

        setEditableTraits(initialData);
        setInitialTraits(initialData);

        if (!currentData.prompt) {
            const constructed = assetType === 'location'
                ? constructLocationPrompt(assetName || "Location", initialData.visual_traits, initialData, genre, style)
                : constructCharacterPrompt(assetName || "Character", initialData, initialData, genre, style);
            setGenPrompt(constructed);
        } else {
            setGenPrompt(currentData.prompt);
        }
    };

    // --- HANDLERS ---

    const hasUnsavedChanges = () => {
        return JSON.stringify(editableTraits) !== JSON.stringify(initialTraits);
    };

    const handleCloseRequest = () => {
        if (hasUnsavedChanges()) {
            if (window.confirm("You have unsaved changes. Do you want to save before closing?")) {
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

    const handleTraitChange = (key: string, value: string) => {
        let finalValue: any = value;
        // Logic to keep visual_traits as array in local state
        if (assetType === 'location' && key === 'visual_traits' && typeof value === 'string') {
            finalValue = value.split(',').map(t => t.trim()).filter(t => t !== "");
        }

        const updatedTraits = { ...editableTraits, [key]: finalValue };
        setEditableTraits(updatedTraits);

        const constructedPrompt = assetType === 'location'
            ? constructLocationPrompt(assetName || "Location", updatedTraits.visual_traits, updatedTraits, genre, style)
            : constructCharacterPrompt(assetName || "Character", updatedTraits, updatedTraits, genre, style);
        setGenPrompt(constructedPrompt);
    };

    const handleSave = async () => {
        setIsSavingTraits(true);

        // --- MAP DATA BACK TO DB SCHEMA ---
        let payload: any = {};

        if (assetType === 'location') {
            // Local 'visual_traits' array -> DB 'keywords' string
            let kws = editableTraits.visual_traits;
            if (Array.isArray(kws)) kws = kws.join(', ');

            payload = {
                keywords: kws,
                atmosphere: editableTraits.atmosphere,
                lighting: editableTraits.lighting,
                terrain: editableTraits.terrain
            };
        } else {
            // Character: Map specific keys to avoid nesting mess
            payload = {
                age: editableTraits.age,
                ethnicity: editableTraits.ethnicity,
                hair: editableTraits.hair,
                clothing: editableTraits.clothing,
                vibe: editableTraits.vibe
            };
        }

        await onUpdateTraits(payload);
        setInitialTraits(editableTraits);
        setIsSavingTraits(false);
        onClose();
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
                            <h2 className="text-lg font-display uppercase text-white leading-none">{assetName}</h2>
                            <div className="text-[10px] text-neutral-500 tracking-widest mt-1">
                                {isVoiceMode ? "VOICE LIBRARY" : "CONFIGURATION STUDIO"}
                            </div>
                        </div>
                    </div>
                    {/* Intercept Close Here */}
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
                                {/* Cleaned up props passed to TraitsTab */}
                                <TraitsTab
                                    assetType={assetType!}
                                    editableTraits={editableTraits}
                                    handleTraitChange={handleTraitChange}
                                />
                            </div>

                            <VisualsSection
                                displayImage={currentData?.image_url}
                                isProcessing={isProcessing}
                                genPrompt={genPrompt}
                                setGenPrompt={setGenPrompt}
                                onGenerate={onGenerate}
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
                            disabled={isSavingTraits}
                            className="w-full py-3 bg-white hover:bg-neutral-200 text-black font-bold text-xs tracking-widest rounded transition-colors disabled:opacity-50"
                        >
                            {isSavingTraits ? "SAVING..." : "SAVE CONFIGURATION"}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};