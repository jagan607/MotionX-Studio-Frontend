import React, { useRef } from 'react';
import { X, Upload, Loader2, Sparkles } from 'lucide-react';

interface AssetModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedAsset: string | null;
    mode: 'upload' | 'generate';
    setMode: (mode: 'upload' | 'generate') => void;
    genPrompt: string;
    setGenPrompt: (prompt: string) => void;
    isProcessing: boolean;
    onUpload: (file: File) => void;
    onGenerate: () => void;
    styles: any;
}

export const AssetModal: React.FC<AssetModalProps> = ({
    isOpen,
    onClose,
    selectedAsset,
    mode,
    setMode,
    genPrompt,
    setGenPrompt,
    isProcessing,
    onUpload,
    onGenerate,
    styles
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={styles.modal}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                    <h2 style={styles.modalTitle}>{selectedAsset}</h2>
                    <X size={24} style={{ cursor: 'pointer', color: 'white' }} onClick={onClose} />
                </div>

                <p style={styles.modalSub}>ASSET GENERATION</p>

                {/* Mode Toggles */}
                <div style={styles.toggleRow}>
                    <div style={styles.toggleBtn(mode === 'upload')} onClick={() => setMode('upload')}>UPLOAD REF</div>
                    <div style={styles.toggleBtn(mode === 'generate')} onClick={() => setMode('generate')}>AI GENERATION</div>
                </div>

                {/* Mode: Upload */}
                {mode === 'upload' && (
                    <>
                        <div style={styles.uploadBox} onClick={() => fileInputRef.current?.click()}>
                            <Upload size={32} style={{ marginBottom: '15px' }} />
                            <p>CLICK TO UPLOAD REF</p>
                        </div>
                        <input
                            type="file"
                            ref={fileInputRef}
                            hidden
                            accept="image/*"
                            onChange={(e) => {
                                if (e.target.files?.[0]) {
                                    onUpload(e.target.files[0]);
                                }
                            }}
                        />
                        {isProcessing && <div style={{ textAlign: 'center', color: '#FF0000', marginTop: '10px' }}>UPLOADING...</div>}
                    </>
                )}

                {/* Mode: Generate */}
                {mode === 'generate' && (
                    <>
                        <textarea
                            style={styles.textareaInput}
                            value={genPrompt}
                            onChange={(e) => setGenPrompt(e.target.value)}
                            placeholder="Describe details (e.g. A futuristic samurai helmet...)"
                        />
                        <button
                            style={styles.primaryBtn}
                            onClick={onGenerate}
                            disabled={isProcessing}
                        >
                            {isProcessing ? <Loader2 className="spin-loader" /> : <Sparkles size={18} />}
                            {isProcessing ? "DREAMING..." : "GENERATE"}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};