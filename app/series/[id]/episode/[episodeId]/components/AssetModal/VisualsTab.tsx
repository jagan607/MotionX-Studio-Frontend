import React, { useRef, useEffect } from 'react';
import { Upload, Loader2, Sparkles } from 'lucide-react';

interface VisualsTabProps {
    mode: 'upload' | 'generate';
    setMode: (m: 'upload' | 'generate') => void;
    currentImageUrl?: string;
    genPrompt: string;
    setGenPrompt: (s: string) => void;
    onGenerate: () => void;
    onUpload: (f: File) => void;
    isProcessing: boolean;
    styles: any;
    // ADD THIS: Pass the base prompt from the DB/Asset
    basePrompt?: string;
}

export const VisualsTab: React.FC<VisualsTabProps> = ({
    mode, setMode, currentImageUrl, genPrompt, setGenPrompt,
    onGenerate, onUpload, isProcessing, styles, basePrompt
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- EFFECT: Populate prompt on mount or when basePrompt changes ---
    useEffect(() => {
        // Only auto-fill if the current prompt box is empty
        if (basePrompt && !genPrompt) {
            setGenPrompt(basePrompt);
        }
    }, [basePrompt, setGenPrompt]);

    return (
        <div style={{ animation: 'fadeIn 0.3s ease', display: 'flex', flexDirection: 'column', height: '100%' }}>

            {/* CURRENT IMAGE PREVIEW */}
            {currentImageUrl && (
                <div style={{
                    marginBottom: '20px', backgroundColor: '#0a0a0a', border: '1px solid #222', borderRadius: '8px',
                    padding: '12px', display: 'flex', alignItems: 'center', gap: '15px', flexShrink: 0
                }}>
                    <div style={{ width: '50px', height: '50px', borderRadius: '6px', overflow: 'hidden', flexShrink: 0 }}>
                        <img src={currentImageUrl} alt="Current" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <div>
                        <div style={{ fontSize: '9px', color: '#666', letterSpacing: '1px', fontWeight: 'bold' }}>ACTIVE ASSET</div>
                        <div style={{ fontSize: '11px', color: '#CCC' }}>Generate new version to replace.</div>
                    </div>
                </div>
            )}

            {/* TOGGLE ROW */}
            <div style={{ ...styles.toggleRow, marginBottom: '20px' }}>
                <div style={styles.toggleBtn(mode === 'upload')} onClick={() => setMode('upload')}>UPLOAD REFERENCE</div>
                <div style={styles.toggleBtn(mode === 'generate')} onClick={() => setMode('generate')}>AI GENERATION</div>
            </div>

            {/* MODE: GENERATE */}
            {mode === 'generate' && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', marginBottom: '15px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <div style={{ fontSize: '10px', color: '#666', letterSpacing: '0.5px', fontWeight: 'bold' }}>
                                PROMPT (GENERATED FROM TRAITS)
                            </div>
                            {/* Option to reset to original if user edited it */}
                            {basePrompt && genPrompt !== basePrompt && (
                                <div
                                    onClick={() => setGenPrompt(basePrompt)}
                                    style={{ fontSize: '9px', color: '#FF0000', cursor: 'pointer', fontWeight: 'bold' }}
                                >
                                    RESET TO BASE
                                </div>
                            )}
                        </div>
                        <textarea
                            style={{
                                ...styles.textareaInput,
                                flex: 1,
                                width: '100%',
                                resize: 'none',
                                fontFamily: 'monospace',
                                fontSize: '12px',
                                lineHeight: '1.5',
                                padding: '15px',
                                boxSizing: 'border-box'
                            }}
                            value={genPrompt}
                            onChange={(e) => setGenPrompt(e.target.value)}
                            placeholder="Describe the look in detail..."
                        />
                    </div>

                    <button
                        style={{ ...styles.primaryBtn, width: '100%', height: '45px' }}
                        onClick={onGenerate}
                        disabled={isProcessing}
                    >
                        {isProcessing ? <Loader2 className="animate-spin" /> : <Sparkles size={18} />}
                        {isProcessing ? "GENERATING..." : "GENERATE VISUAL"}
                    </button>
                </div>
            )}

            {/* MODE: UPLOAD */}
            {mode === 'upload' && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ ...styles.uploadBox, flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }} onClick={() => fileInputRef.current?.click()}>
                        <Upload size={32} style={{ marginBottom: '15px', color: '#444' }} />
                        <p style={{ fontSize: '12px', color: '#666', letterSpacing: '1px' }}>CLICK TO UPLOAD IMAGE</p>
                    </div>
                    <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
                </div>
            )}
        </div>
    );
};