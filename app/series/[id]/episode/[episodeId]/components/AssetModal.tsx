import React, { useState, useRef, useEffect } from 'react';
import {
    X, Upload, Loader2, Sparkles, User, Mic, FileText,
    Play, Square, Search, Check, Save
} from 'lucide-react';
import { fetchElevenLabsVoices, Voice } from '@/lib/elevenLabs';

interface AssetModalProps {
    isOpen: boolean;
    onClose: () => void;

    // Identity Props
    assetId: string | null;
    assetName?: string;
    assetType: 'character' | 'location' | null;
    currentData?: any;

    // Visual Generation Props
    mode: 'upload' | 'generate';
    setMode: (mode: 'upload' | 'generate') => void;
    genPrompt: string;
    setGenPrompt: (prompt: string) => void;
    isProcessing: boolean;
    onUpload: (file: File) => void;
    onGenerate: () => void;

    // Handlers
    onUpdateTraits: (newTraits: any) => Promise<void>;
    onLinkVoice: (voiceData: { voice_id: string; voice_name: string }) => Promise<void>;

    // Styling
    styles: any;
}

export const AssetModal: React.FC<AssetModalProps> = ({
    isOpen, onClose, assetId, assetName, assetType, currentData,
    mode, setMode, genPrompt, setGenPrompt, isProcessing, onUpload, onGenerate,
    onUpdateTraits, onLinkVoice,
    styles
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [activeTab, setActiveTab] = useState<'visual' | 'voice' | 'traits'>('visual');

    // Traits State
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

    // Determine original voice ID from DB data
    const originalVoiceId = currentData?.voice_config?.voice_id || null;

    // --- EFFECT 1: Reset Tab ONLY when opening a NEW asset ---
    useEffect(() => {
        if (isOpen) {
            setActiveTab('visual');
            // If character already has a voice, pre-select it
            if (currentData?.voice_config?.voice_id) {
                setSelectedVoiceId(currentData.voice_config.voice_id);
            } else {
                setSelectedVoiceId(null);
            }
        }
    }, [isOpen, assetId]);

    // --- EFFECT 2: Sync Traits Data ---
    useEffect(() => {
        if (isOpen) {
            if (currentData?.visual_traits) {
                setEditableTraits({ ...currentData.visual_traits });
            } else {
                setEditableTraits({});
            }
        }
    }, [isOpen, assetId, currentData]);

    // --- EFFECT 3: Fetch Voices when Voice Tab is active ---
    useEffect(() => {
        if (activeTab === 'voice' && allVoices.length === 0) {
            loadVoices();
        }
    }, [activeTab]);

    // --- EFFECT 4: Filter Voices ---
    useEffect(() => {
        if (!voiceSearch.trim()) {
            setFilteredVoices(allVoices);
        } else {
            const query = voiceSearch.toLowerCase();
            const filtered = allVoices.filter(v =>
                v.name.toLowerCase().includes(query) ||
                v.labels?.accent?.toLowerCase().includes(query) ||
                v.labels?.description?.toLowerCase().includes(query) ||
                v.labels?.use_case?.toLowerCase().includes(query)
            );
            setFilteredVoices(filtered);
        }
    }, [voiceSearch, allVoices]);

    // --- HELPERS ---
    const loadVoices = async () => {
        setIsLoadingVoices(true);
        const voices = await fetchElevenLabsVoices();
        setAllVoices(voices);
        setFilteredVoices(voices);
        setIsLoadingVoices(false);
    };

    const handlePlayPreview = (url: string, id: string) => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }
        if (playingVoiceId === id) {
            setPlayingVoiceId(null);
            return;
        }
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.play();
        setPlayingVoiceId(id);
        audio.onended = () => setPlayingVoiceId(null);
    };

    const handleVoiceSelection = async () => {
        if (!selectedVoiceId) return;
        const voice = allVoices.find(v => v.voice_id === selectedVoiceId);
        if (!voice) return;

        setIsLinkingVoice(true);
        await onLinkVoice({ voice_id: voice.voice_id, voice_name: voice.name });
        setIsLinkingVoice(false);
    };

    const handleTraitChange = (key: string, value: string) => {
        setEditableTraits((prev: any) => ({ ...prev, [key]: value }));
    };

    const handleSaveTraits = async () => {
        setIsSavingTraits(true);
        await onUpdateTraits(editableTraits);
        setIsSavingTraits(false);
    };

    // Helper logic for button text state
    const getLinkButtonState = () => {
        if (isLinkingVoice) return { text: "LINKING...", disabled: true };
        if (!selectedVoiceId) return { text: "SELECT A VOICE", disabled: true };

        if (selectedVoiceId === originalVoiceId) {
            return { text: "VOICE ALREADY LINKED", disabled: true };
        }

        // If we had an original voice but picked a new one
        if (originalVoiceId && selectedVoiceId !== originalVoiceId) {
            return { text: "CHANGE LINKED VOICE", disabled: false };
        }

        return { text: "LINK SELECTED VOICE", disabled: false };
    };

    const linkBtnState = getLinkButtonState();


    if (!isOpen) return null;

    // --- TAB RENDERERS ---

    const renderVisualTab = () => (
        <div style={{ animation: 'fadeIn 0.3s ease' }}>
            <div style={styles.toggleRow}>
                <div style={styles.toggleBtn(mode === 'upload')} onClick={() => setMode('upload')}>UPLOAD REF</div>
                <div style={styles.toggleBtn(mode === 'generate')} onClick={() => setMode('generate')}>AI GENERATION</div>
            </div>
            {mode === 'upload' && (
                <>
                    <div style={styles.uploadBox} onClick={() => fileInputRef.current?.click()}>
                        <Upload size={32} style={{ marginBottom: '15px', color: '#666' }} />
                        <p>CLICK TO UPLOAD REFERENCE</p>
                    </div>
                    <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
                    {isProcessing && <div style={{ textAlign: 'center', color: '#FF0000', marginTop: '10px' }}>UPLOADING...</div>}
                </>
            )}
            {mode === 'generate' && (
                <>
                    <textarea style={styles.textareaInput} value={genPrompt} onChange={(e) => setGenPrompt(e.target.value)} placeholder="Describe the look in detail..." />
                    <button style={styles.primaryBtn} onClick={onGenerate} disabled={isProcessing}>
                        {isProcessing ? <Loader2 className="spin-loader" /> : <Sparkles size={18} />}
                        {isProcessing ? "GENERATING..." : "GENERATE VISUAL"}
                    </button>
                </>
            )}
        </div>
    );

    const renderVoiceTab = () => (
        <div style={{ animation: 'fadeIn 0.3s ease', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* SEARCH BAR (Fixed at top) */}
            <div style={{ position: 'relative', marginBottom: '10px', flexShrink: 0 }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
                <input
                    type="text"
                    placeholder="Search voice (e.g. Dusky, Deep, British)..."
                    value={voiceSearch}
                    onChange={(e) => setVoiceSearch(e.target.value)}
                    style={{
                        width: '100%', padding: '12px 12px 12px 38px', backgroundColor: '#111',
                        color: 'white', border: '1px solid #333', borderRadius: '6px', fontSize: '12px', outline: 'none'
                    }}
                />
            </div>

            {/* VOICE LIST (Scrollable Area) - Added minHeight: 0 to allow flex shrink properly */}
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '5px', minHeight: 0, marginBottom: '10px' }}>
                {isLoadingVoices ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                        <Loader2 className="spin-loader" /> Loading Voices...
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
                        {filteredVoices.map(voice => (
                            <div
                                key={voice.voice_id}
                                onClick={() => setSelectedVoiceId(voice.voice_id)}
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '12px', borderRadius: '6px',
                                    backgroundColor: selectedVoiceId === voice.voice_id ? '#1a1a1a' : '#0a0a0a',
                                    border: selectedVoiceId === voice.voice_id ? '1px solid #FF0000' : '1px solid #222',
                                    cursor: 'pointer', transition: 'all 0.2s'
                                }}
                            >
                                <div>
                                    <div style={{ fontWeight: 'bold', fontSize: '13px', color: '#EEE', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {voice.name}
                                        {selectedVoiceId === voice.voice_id && <Check size={14} color="#FF0000" />}
                                    </div>
                                    <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                                        {voice.labels?.accent && <span style={styles.tag}>{voice.labels.accent}</span>}
                                        {voice.labels?.gender && <span style={styles.tag}>{voice.labels.gender}</span>}
                                        {voice.labels?.use_case && <span style={styles.tag}>{voice.labels.use_case}</span>}
                                    </div>
                                </div>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handlePlayPreview(voice.preview_url, voice.voice_id); }}
                                    style={{
                                        width: '32px', height: '32px', borderRadius: '50%', border: '1px solid #333',
                                        backgroundColor: playingVoiceId === voice.voice_id ? '#FF0000' : 'transparent',
                                        color: playingVoiceId === voice.voice_id ? 'white' : '#666',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                                        flexShrink: 0
                                    }}
                                >
                                    {playingVoiceId === voice.voice_id ? <Square size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ACTION FOOTER (Fixed at Bottom) */}
            <div style={{ paddingTop: '15px', borderTop: '1px solid #222', marginTop: 'auto', flexShrink: 0 }}>
                <button
                    style={{
                        ...styles.primaryBtn,
                        width: '100%',
                        opacity: linkBtnState.disabled ? 0.5 : 1,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                        cursor: linkBtnState.disabled ? 'not-allowed' : 'pointer'
                    }}
                    disabled={linkBtnState.disabled}
                    onClick={handleVoiceSelection}
                >
                    {isLinkingVoice ? <Loader2 className="spin-loader" size={16} /> : <Mic size={16} />}
                    {linkBtnState.text}
                </button>
            </div>
        </div>
    );

    const renderTraitsTab = () => (
        <div style={{ animation: 'fadeIn 0.3s ease', display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
                {Object.keys(editableTraits).length > 0 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        {Object.entries(editableTraits).map(([key, val]) => (
                            <div key={key} style={{ backgroundColor: '#0a0a0a', padding: '12px', borderRadius: '6px', border: '1px solid #222' }}>
                                <div style={{ color: '#555', fontSize: '9px', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.5px' }}>{key}</div>
                                <input value={String(val)} onChange={(e) => handleTraitChange(key, e.target.value)} style={{ width: '100%', backgroundColor: 'transparent', border: 'none', color: '#EEE', fontSize: '12px', fontFamily: 'inherit', borderBottom: '1px solid #333', paddingBottom: '4px', outline: 'none' }} />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div style={{ textAlign: 'center', color: '#666', padding: '30px', border: '1px dashed #333', borderRadius: '8px' }}>NO TRAIT DATA AVAILABLE TO EDIT</div>
                )}
            </div>
            <div style={{ marginTop: '20px', paddingTop: '15px', borderTop: '1px solid #222', flexShrink: 0 }}>
                <button style={{ ...styles.primaryBtn, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }} onClick={handleSaveTraits} disabled={isSavingTraits}>
                    {isSavingTraits ? <Loader2 className="spin-loader" size={16} /> : <Save size={16} />}
                    {isSavingTraits ? "UPDATING..." : "UPDATE TRAITS"}
                </button>
            </div>
        </div>
    );

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ ...styles.modal, width: '550px', maxHeight: '85vh', height: '80vh', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #222', paddingBottom: '15px', flexShrink: 0 }}>
                    <div>
                        <h2 style={{ ...styles.modalTitle, marginBottom: '2px' }}>{assetName || assetId}</h2>
                        <div style={{ fontSize: '10px', color: '#555', letterSpacing: '1px' }}>CONFIGURATION STUDIO</div>
                    </div>
                    <X size={24} style={{ cursor: 'pointer', color: 'white' }} onClick={onClose} />
                </div>
                {assetType === 'character' && (
                    <div style={{ display: 'flex', gap: '5px', marginBottom: '20px', backgroundColor: '#0a0a0a', padding: '4px', borderRadius: '6px', border: '1px solid #222', flexShrink: 0 }}>
                        {[{ id: 'visual', icon: User, label: 'VISUALS' }, { id: 'voice', icon: Mic, label: 'VOICE' }, { id: 'traits', icon: FileText, label: 'TRAITS' }].map(tab => (
                            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', letterSpacing: '0.5px', backgroundColor: activeTab === tab.id ? '#222' : 'transparent', color: activeTab === tab.id ? 'white' : '#555', transition: 'all 0.2s' }}>
                                <tab.icon size={12} /> {tab.label}
                            </button>
                        ))}
                    </div>
                )}
                {/* Content Container - Flex 1 handles the remaining height */}
                <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    {(assetType === 'location' || activeTab === 'visual') && renderVisualTab()}
                    {(assetType === 'character' && activeTab === 'voice') && renderVoiceTab()}
                    {(assetType === 'character' && activeTab === 'traits') && renderTraitsTab()}
                </div>
            </div>
        </div>
    );
};