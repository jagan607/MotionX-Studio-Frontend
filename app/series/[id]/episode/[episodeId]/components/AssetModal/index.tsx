import React, { useState, useRef, useEffect } from 'react';
import { X, User, Mic, FileText, MapPin, Image as ImageIcon } from 'lucide-react';
import { fetchElevenLabsVoices, Voice } from '@/lib/elevenLabs';
import { constructLocationPrompt, constructCharacterPrompt } from '@/lib/promptUtils';

// Import Sub-Components
import { VisualsTab } from './VisualsTab';
import { TraitsTab } from './TraitsTab';
import { VoiceTab } from './VoiceTab';

interface AssetModalProps {
    isOpen: boolean; onClose: () => void;
    assetId: string | null; assetName?: string; assetType: 'character' | 'location' | null;
    currentData?: any;
    mode: 'upload' | 'generate'; setMode: (m: 'upload' | 'generate') => void;
    genPrompt: string; setGenPrompt: (p: string) => void;
    isProcessing: boolean; onUpload: (f: File) => void; onGenerate: () => void;
    onUpdateTraits: (t: any) => Promise<void>;
    onLinkVoice: (v: { voice_id: string; voice_name: string }) => Promise<void>;
    styles: any;
}

export const AssetModal: React.FC<AssetModalProps> = (props) => {
    const { isOpen, assetType, currentData, assetName, onUpdateTraits, setGenPrompt, genPrompt, onClose } = props;

    // State
    const [activeTab, setActiveTab] = useState<'visual' | 'voice' | 'traits'>('visual');
    const [editableTraits, setEditableTraits] = useState<any>({});
    const [isSavingTraits, setIsSavingTraits] = useState(false);

    // Voice State
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
        if (isOpen) {
            setActiveTab('visual');
            setEditableTraits(currentData?.visual_traits || {});
            setSelectedVoiceId(currentData?.voice_config?.voice_id || null);

            // Auto-Generate Prompt if empty
            if (!genPrompt) {
                if (assetType === 'location') setGenPrompt(constructLocationPrompt(assetName || "Location", currentData?.visual_traits));
                else if (assetType === 'character') setGenPrompt(constructCharacterPrompt(assetName || "Character", currentData?.visual_traits));
            }
        }
    }, [isOpen, props.assetId]);

    useEffect(() => {
        if (activeTab === 'voice' && allVoices.length === 0) loadVoices();
    }, [activeTab]);

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
        const newTraits = { ...editableTraits, [key]: value };
        setEditableTraits(newTraits);
        if (assetType === 'location') setGenPrompt(constructLocationPrompt(assetName || "Location", newTraits));
    };

    const handleSaveTraits = async () => {
        setIsSavingTraits(true); await onUpdateTraits(editableTraits); setIsSavingTraits(false);
    };

    const handleVoiceLink = async () => {
        const v = allVoices.find(v => v.voice_id === selectedVoiceId);
        if (v) { setIsLinkingVoice(true); await props.onLinkVoice({ voice_id: v.voice_id, voice_name: v.name }); setIsLinkingVoice(false); }
    };

    if (!isOpen) return null;

    // --- RENDER ---
    return (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ ...props.styles.modal, width: '550px', height: '80vh', display: 'flex', flexDirection: 'column' }}>

                {/* HEADER */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #222', paddingBottom: '15px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {assetType === 'location' ? <MapPin size={24} color="#FF0000" /> : <User size={24} color="#FF0000" />}
                        <div>
                            <h2 style={{ ...props.styles.modalTitle, marginBottom: '2px' }}>{assetName}</h2>
                            <div style={{ fontSize: '10px', color: '#555', letterSpacing: '1px' }}>CONFIGURATION STUDIO</div>
                        </div>
                    </div>
                    <X size={24} style={{ cursor: 'pointer', color: 'white' }} onClick={onClose} />
                </div>

                {/* TABS */}
                <div style={{ display: 'flex', gap: '5px', marginBottom: '20px', backgroundColor: '#0a0a0a', padding: '4px', borderRadius: '6px', border: '1px solid #222' }}>
                    {[
                        { id: 'visual', label: 'VISUALS', icon: ImageIcon },
                        ...(assetType === 'character' ? [{ id: 'voice', label: 'VOICE', icon: Mic }] : []),
                        { id: 'traits', label: 'TRAITS', icon: FileText }
                    ].map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
                            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold', letterSpacing: '0.5px', backgroundColor: activeTab === tab.id ? '#222' : 'transparent', color: activeTab === tab.id ? 'white' : '#555', transition: 'all 0.2s' }}>
                            <tab.icon size={12} /> {tab.label}
                        </button>
                    ))}
                </div>

                {/* CONTENT AREA */}
                <div style={{ flex: 1, overflow: 'hidden', padding: '5px' }}>
                    {activeTab === 'visual' && <VisualsTab {...props} currentImageUrl={currentData?.face_sample_url || currentData?.image_url} />}
                    {activeTab === 'traits' && <TraitsTab assetType={assetType!} editableTraits={editableTraits} handleTraitChange={handleTraitChange} handleSaveTraits={handleSaveTraits} isSavingTraits={isSavingTraits} styles={props.styles} />}
                    {activeTab === 'voice' && <VoiceTab
                        voiceSearch={voiceSearch} setVoiceSearch={setVoiceSearch} isLoadingVoices={isLoadingVoices} filteredVoices={filteredVoices}
                        selectedVoiceId={selectedVoiceId} setSelectedVoiceId={setSelectedVoiceId} playingVoiceId={playingVoiceId} handlePlayPreview={handlePlayPreview}
                        handleVoiceSelection={handleVoiceLink} linkBtnState={{ text: selectedVoiceId === currentData?.voice_config?.voice_id ? "LINKED" : "LINK VOICE", disabled: !selectedVoiceId || selectedVoiceId === currentData?.voice_config?.voice_id }} isLinkingVoice={isLinkingVoice} styles={props.styles} />}
                </div>
            </div>
        </div>
    );
};