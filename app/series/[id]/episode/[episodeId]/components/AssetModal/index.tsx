import React, { useState, useRef, useEffect } from 'react';
import { X, User, MapPin, Upload, Sparkles, Play, RefreshCw, ArrowLeft } from 'lucide-react';
import { fetchElevenLabsVoices, Voice } from '@/lib/elevenLabs';
import { constructLocationPrompt, constructCharacterPrompt } from '@/lib/promptUtils';

// Import Sub-Components
// VisualsTab is removed as its logic is now inline
import { TraitsTab } from './TraitsTab';
import { VoiceTab } from './VoiceTab';

interface AssetModalProps {
    isOpen: boolean;
    onClose: () => void;
    assetId: string | null;
    assetName?: string;
    assetType: 'character' | 'location' | null;
    currentData?: any;
    mode: 'upload' | 'generate';
    setMode: (m: 'upload' | 'generate') => void;
    genPrompt: string;
    setGenPrompt: (p: string) => void;
    isProcessing: boolean;
    basePrompt?: string;
    onUpload: (f: File) => void;
    onGenerate: () => void;
    onUpdateTraits: (t: any) => Promise<void>;
    onLinkVoice: (v: { voice_id: string; voice_name: string }) => Promise<void>;
    styles: any;
}

export const AssetModal: React.FC<AssetModalProps> = (props) => {
    const {
        isOpen,
        assetType,
        currentData,
        assetName,
        onUpdateTraits,
        setGenPrompt,
        onClose,
        isProcessing,
        onGenerate,
        onUpload
    } = props;

    // --- LOCAL UI STATE ---
    const [editableTraits, setEditableTraits] = useState<any>({});
    const [isSavingTraits, setIsSavingTraits] = useState(false);

    // Voice State
    const [isVoiceMode, setIsVoiceMode] = useState(false); // Toggle to show full voice picker
    const [allVoices, setAllVoices] = useState<Voice[]>([]);
    const [filteredVoices, setFilteredVoices] = useState<Voice[]>([]);
    const [voiceSearch, setVoiceSearch] = useState('');
    const [isLoadingVoices, setIsLoadingVoices] = useState(false);
    const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
    const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(null);
    const [isLinkingVoice, setIsLinkingVoice] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // --- EFFECTS ---
    useEffect(() => {
        if (isOpen && currentData) {
            setIsVoiceMode(false); // Reset view on open

            // 1. Unified Traits Initialization
            // FIX: Type as 'any' to avoid TS errors
            let initialTraits: any = {};

            if (assetType === 'location') {
                // LOCATION LOGIC (Top-Level Fields)
                initialTraits = {
                    visual_traits: currentData.visual_traits || [],
                    atmosphere: currentData.atmosphere || "",
                    lighting: currentData.lighting || "",
                    terrain: currentData.terrain || "",
                };
            } else {
                // CHARACTER LOGIC (Nested Map Fields)
                const vt = currentData.visual_traits || {};
                initialTraits = {
                    age: vt.age || "",
                    ethnicity: vt.ethnicity || "",
                    hair: vt.hair || "",
                    clothing: vt.clothing || "",
                    vibe: vt.vibe || "",
                    visual_traits: vt
                };
            }

            setEditableTraits(initialTraits);
            setSelectedVoiceId(currentData?.voice_config?.voice_id || null);

            // 2. Local Prompt Construction
            if (assetType === 'location') {
                setGenPrompt(constructLocationPrompt(assetName || "Location", initialTraits.visual_traits, initialTraits));
            } else if (assetType === 'character') {
                setGenPrompt(constructCharacterPrompt(assetName || "Character", initialTraits, initialTraits));
            }
        }
        // FIX: Dependency array includes deep comparison for updates
    }, [isOpen, props.assetId, JSON.stringify(currentData), assetType]);

    // Lazy load voices
    useEffect(() => {
        if (isVoiceMode && allVoices.length === 0) loadVoices();
    }, [isVoiceMode, allVoices.length]);

    // Filter voices
    useEffect(() => {
        const query = voiceSearch.toLowerCase();
        setFilteredVoices(allVoices.filter(v => v.name.toLowerCase().includes(query)));
    }, [voiceSearch, allVoices]);

    // --- HANDLERS ---
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

    const handleTraitChange = (key: string, value: string) => {
        let finalValue: any = value;
        if (assetType === 'location' && key === 'visual_traits') {
            finalValue = value.split(',').map(t => t.trim()).filter(t => t !== "");
        }
        setEditableTraits((prev: any) => ({ ...prev, [key]: finalValue }));
    };

    const handleSaveTraits = async () => {
        setIsSavingTraits(true);
        await onUpdateTraits(editableTraits);
        setIsSavingTraits(false);
    };

    const handleVoiceLink = async () => {
        const v = allVoices.find(v => v.voice_id === selectedVoiceId);
        if (v) {
            setIsLinkingVoice(true);
            await props.onLinkVoice({ voice_id: v.voice_id, voice_name: v.name });
            setIsLinkingVoice(false);
            setIsVoiceMode(false); // Go back to main view after linking
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            onUpload(e.target.files[0]);
        }
    };

    if (!isOpen) return null;

    // Determine Image to Show
    const displayImage = currentData?.image_url || currentData?.face_sample_url;

    return (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ ...props.styles.modal, width: '600px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

                {/* 1. HEADER */}
                <div style={{ padding: '20px', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0a0a0a' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {isVoiceMode && (
                            <ArrowLeft size={20} style={{ cursor: 'pointer', color: '#FFF', marginRight: '5px' }} onClick={() => setIsVoiceMode(false)} />
                        )}
                        {assetType === 'location' ? <MapPin size={20} color="#FF4444" /> : <User size={20} color="#FF4444" />}
                        <div>
                            <h2 style={{ ...props.styles.modalTitle, fontSize: '18px', marginBottom: '2px' }}>{assetName}</h2>
                            <div style={{ fontSize: '10px', color: '#666', letterSpacing: '1px' }}>
                                {isVoiceMode ? "VOICE LIBRARY" : "CONFIGURATION STUDIO"}
                            </div>
                        </div>
                    </div>
                    <X size={20} style={{ cursor: 'pointer', color: '#666' }} onClick={onClose} />
                </div>

                {/* 2. CONTENT AREA */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '30px' }}>

                    {isVoiceMode ? (
                        // --- VIEW A: FULL VOICE PICKER ---
                        <VoiceTab
                            voiceSuggestion={currentData?.voice_config?.suggestion}
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
                                text: selectedVoiceId === currentData?.voice_config?.voice_id ? "CURRENTLY LINKED" : "LINK SELECTED VOICE",
                                disabled: !selectedVoiceId || selectedVoiceId === currentData?.voice_config?.voice_id || isLinkingVoice
                            }}
                            isLinkingVoice={isLinkingVoice}
                            styles={props.styles}
                        />
                    ) : (
                        // --- VIEW B: UNIFIED INSPECTOR (Traits + Visuals) ---
                        <>
                            {/* SECTION: TRAITS (Inputs) */}
                            <div style={{ animation: 'fadeIn 0.3s ease' }}>
                                <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#444', marginBottom: '10px', letterSpacing: '1px' }}>
                                    ASSET DEFINITION
                                </div>
                                <TraitsTab
                                    assetType={assetType!}
                                    editableTraits={editableTraits}
                                    handleTraitChange={handleTraitChange}
                                    handleSaveTraits={() => { }} // Save handled in footer
                                    isSavingTraits={false}
                                    styles={props.styles}
                                />
                            </div>

                            {/* SECTION: VISUALS (Output) */}
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                    <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#444', letterSpacing: '1px' }}>
                                        VISUAL REPRESENTATION
                                    </div>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <label style={{
                                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                                            fontSize: '10px', color: '#888', padding: '4px 8px',
                                            border: '1px solid #333', borderRadius: '4px'
                                        }}>
                                            <Upload size={12} /> UPLOAD REF
                                            <input type="file" hidden onChange={handleFileUpload} accept="image/*" />
                                        </label>
                                        <button
                                            onClick={onGenerate}
                                            disabled={isProcessing}
                                            style={{
                                                cursor: isProcessing ? 'not-allowed' : 'pointer',
                                                display: 'flex', alignItems: 'center', gap: '6px',
                                                fontSize: '10px', color: isProcessing ? '#555' : '#FFF',
                                                backgroundColor: isProcessing ? '#222' : '#FF4444',
                                                padding: '4px 12px', border: 'none', borderRadius: '4px'
                                            }}
                                        >
                                            {isProcessing ? <RefreshCw className="force-spin" size={12} /> : <Sparkles size={12} />}
                                            {isProcessing ? "GENERATING..." : "GENERATE AI"}
                                        </button>
                                    </div>
                                </div>

                                <div style={{
                                    width: '100%', height: '220px', backgroundColor: '#050505',
                                    border: '1px dashed #333', borderRadius: '6px', overflow: 'hidden',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    position: 'relative'
                                }}>
                                    {displayImage ? (
                                        <img src={displayImage} alt="Asset" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                    ) : (
                                        <div style={{ textAlign: 'center', color: '#333' }}>
                                            <Sparkles size={32} style={{ margin: '0 auto 10px', opacity: 0.2 }} />
                                            <div style={{ fontSize: '10px' }}>NO VISUAL GENERATED</div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* SECTION: VOICE (Compact Card) */}
                            {assetType === 'character' && (
                                <div>
                                    <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#444', marginBottom: '10px', letterSpacing: '1px' }}>
                                        VOICE CONFIGURATION
                                    </div>
                                    <div style={{
                                        padding: '15px', backgroundColor: '#0a0a0a', border: '1px solid #222',
                                        borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div style={{
                                                width: '30px', height: '30px', borderRadius: '50%', backgroundColor: '#222',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                                            }}>
                                                <Play size={12} color="white" />
                                            </div>
                                            <div>
                                                <div style={{ color: 'white', fontSize: '12px' }}>
                                                    {currentData?.voice_config?.voice_name || "No Voice Linked"}
                                                </div>
                                                <div style={{ color: '#555', fontSize: '10px' }}>
                                                    {currentData?.voice_config?.suggestion || "Neutral Tone"}
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setIsVoiceMode(true)}
                                            style={{ fontSize: '10px', color: '#888', background: 'none', border: '1px solid #333', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}
                                        >
                                            CHANGE
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* 3. FOOTER (Hidden in Voice Mode) */}
                {!isVoiceMode && (
                    <div style={{ padding: '20px', borderTop: '1px solid #222', backgroundColor: '#0a0a0a' }}>
                        <button
                            onClick={handleSaveTraits}
                            disabled={isSavingTraits}
                            style={{
                                width: '100%', padding: '12px', backgroundColor: '#FFF', color: '#000',
                                border: 'none', borderRadius: '4px', fontWeight: 'bold', fontSize: '11px', letterSpacing: '1px',
                                cursor: isSavingTraits ? 'wait' : 'pointer', opacity: isSavingTraits ? 0.7 : 1
                            }}
                        >
                            {isSavingTraits ? "SAVING..." : "SAVE CONFIGURATION"}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};