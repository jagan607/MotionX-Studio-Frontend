import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, Loader2, Sparkles, User, Mic, FileText, Play, Save } from 'lucide-react';

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

    // Trait Update Handler
    onUpdateTraits: (newTraits: any) => Promise<void>;

    // Styling
    styles: any;
}

export const AssetModal: React.FC<AssetModalProps> = ({
    isOpen, onClose, assetId, assetName, assetType, currentData,
    mode, setMode, genPrompt, setGenPrompt, isProcessing, onUpload, onGenerate,
    onUpdateTraits,
    styles
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [activeTab, setActiveTab] = useState<'visual' | 'voice' | 'traits'>('visual');

    // Local State for Editing Traits
    const [editableTraits, setEditableTraits] = useState<any>({});
    const [isSavingTraits, setIsSavingTraits] = useState(false);

    // --- EFFECT 1: Reset Tab ONLY when opening a NEW asset ---
    useEffect(() => {
        if (isOpen) {
            setActiveTab('visual');
        }
    }, [isOpen, assetId]);
    // Note: Removed 'currentData' from deps to prevent tab flipping on save.

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

    const handleTraitChange = (key: string, value: string) => {
        setEditableTraits((prev: any) => ({ ...prev, [key]: value }));
    };

    const handleSaveTraits = async () => {
        setIsSavingTraits(true);
        await onUpdateTraits(editableTraits);
        setIsSavingTraits(false);
        // User stays on the same tab because we didn't trigger Effect 1
    };

    if (!isOpen) return null;

    // --- TAB 1: VISUALS ---
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
                    <input
                        type="file"
                        ref={fileInputRef}
                        hidden
                        accept="image/*"
                        onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
                    />
                    {isProcessing && <div style={{ textAlign: 'center', color: '#FF0000', marginTop: '10px' }}>UPLOADING...</div>}
                </>
            )}

            {mode === 'generate' && (
                <>
                    <textarea
                        style={styles.textareaInput}
                        value={genPrompt}
                        onChange={(e) => setGenPrompt(e.target.value)}
                        placeholder="Describe the look in detail..."
                    />
                    <button style={styles.primaryBtn} onClick={onGenerate} disabled={isProcessing}>
                        {isProcessing ? <Loader2 className="spin-loader" /> : <Sparkles size={18} />}
                        {isProcessing ? "GENERATING..." : "GENERATE VISUAL"}
                    </button>
                </>
            )}
        </div>
    );

    // --- TAB 2: VOICE ---
    const renderVoiceTab = () => (
        <div style={{ animation: 'fadeIn 0.3s ease', textAlign: 'center', padding: '20px 0' }}>
            <div style={{ marginBottom: '20px', color: '#888', fontSize: '11px', letterSpacing: '1px' }}>
                VOICE SYNC / ELEVENLABS INTEGRATION
            </div>
            <select style={{
                width: '100%', padding: '12px', backgroundColor: '#111',
                color: 'white', border: '1px solid #333', borderRadius: '4px', marginBottom: '15px',
                fontSize: '12px'
            }}>
                <option>Select a Voice Model...</option>
                <option value="antoni">Antoni (Deep, American)</option>
                <option value="rachel">Rachel (Clear, American)</option>
            </select>
            <div style={{ display: 'flex', gap: '10px' }}>
                <button style={{ ...styles.secondaryBtn, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <Play size={14} /> PREVIEW
                </button>
                <button style={{ ...styles.primaryBtn, flex: 1 }}>
                    LINK VOICE
                </button>
            </div>
        </div>
    );

    // --- TAB 3: TRAITS (EDITABLE) ---
    const renderTraitsTab = () => (
        <div style={{ animation: 'fadeIn 0.3s ease', display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
                {Object.keys(editableTraits).length > 0 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        {Object.entries(editableTraits).map(([key, val]) => (
                            <div key={key} style={{ backgroundColor: '#0a0a0a', padding: '12px', borderRadius: '6px', border: '1px solid #222' }}>
                                <div style={{ color: '#555', fontSize: '9px', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.5px' }}>{key}</div>
                                <input
                                    value={String(val)}
                                    onChange={(e) => handleTraitChange(key, e.target.value)}
                                    style={{
                                        width: '100%', backgroundColor: 'transparent', border: 'none',
                                        color: '#EEE', fontSize: '12px', fontFamily: 'inherit',
                                        borderBottom: '1px solid #333', paddingBottom: '4px', outline: 'none'
                                    }}
                                />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div style={{ textAlign: 'center', color: '#666', padding: '30px', border: '1px dashed #333', borderRadius: '8px' }}>
                        NO TRAIT DATA AVAILABLE TO EDIT
                    </div>
                )}
            </div>

            {/* Update Action */}
            <div style={{ marginTop: '20px', paddingTop: '15px', borderTop: '1px solid #222' }}>
                <button
                    style={{ ...styles.primaryBtn, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    onClick={handleSaveTraits}
                    disabled={isSavingTraits}
                >
                    {isSavingTraits ? <Loader2 className="spin-loader" size={16} /> : <Save size={16} />}
                    {isSavingTraits ? "UPDATING..." : "UPDATE TRAITS"}
                </button>
            </div>
        </div>
    );

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 200,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
            <div style={{ ...styles.modal, width: '550px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>

                {/* HEADER */}
                <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    marginBottom: '20px', borderBottom: '1px solid #222', paddingBottom: '15px'
                }}>
                    <div>
                        <h2 style={{ ...styles.modalTitle, marginBottom: '2px' }}>{assetName || assetId}</h2>
                        <div style={{ fontSize: '10px', color: '#555', letterSpacing: '1px' }}>CONFIGURATION STUDIO</div>
                    </div>
                    <X size={24} style={{ cursor: 'pointer', color: 'white' }} onClick={onClose} />
                </div>

                {/* TABS */}
                {assetType === 'character' && (
                    <div style={{ display: 'flex', gap: '5px', marginBottom: '20px', backgroundColor: '#0a0a0a', padding: '4px', borderRadius: '6px', border: '1px solid #222' }}>
                        {[
                            { id: 'visual', icon: User, label: 'VISUALS' },
                            { id: 'voice', icon: Mic, label: 'VOICE' },
                            { id: 'traits', icon: FileText, label: 'TRAITS' }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                style={{
                                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                    padding: '8px', borderRadius: '4px', border: 'none', cursor: 'pointer',
                                    fontSize: '11px', fontWeight: 'bold', letterSpacing: '0.5px',
                                    backgroundColor: activeTab === tab.id ? '#222' : 'transparent',
                                    color: activeTab === tab.id ? 'white' : '#555',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <tab.icon size={12} /> {tab.label}
                            </button>
                        ))}
                    </div>
                )}

                {/* BODY CONTENT */}
                <div style={{ flex: 1, overflowY: 'auto', minHeight: '300px' }}>
                    {(assetType === 'location' || activeTab === 'visual') && renderVisualTab()}
                    {(assetType === 'character' && activeTab === 'voice') && renderVoiceTab()}
                    {(assetType === 'character' && activeTab === 'traits') && renderTraitsTab()}
                </div>

            </div>
        </div>
    );
};