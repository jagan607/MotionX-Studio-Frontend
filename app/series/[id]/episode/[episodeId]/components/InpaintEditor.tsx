"use client";

import { useState, useEffect, useRef } from "react";
import { X, Loader2, Image as ImageIcon, Sparkles, Zap } from "lucide-react";
import { useCredits } from "@/hooks/useCredits"; // Ensure this path matches your project structure
import { toastError } from "@/lib/toast";

interface InpaintEditorProps {
    src: string;
    onSave: (prompt: string, maskBase64: string) => Promise<string | null>;
    onClose: () => void;
    styles: any;
    onApply: (url: string) => void;
}

export const InpaintEditor = ({ src, onSave, onClose, styles, onApply }: InpaintEditorProps) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [brushSize, setBrushSize] = useState(30);
    const [prompt, setPrompt] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);
    const [outputImage, setOutputImage] = useState<string | null>(null);

    // NEW: Credits Hook
    const { credits } = useCredits();

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        canvas.width = 800;
        canvas.height = 450;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }, []);

    const draw = (e: React.MouseEvent) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!ctx || !canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
        const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = "rgba(255, 0, 0, 0.6)";
        ctx.beginPath();
        ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
        ctx.fill();
    };

    const handleGenerateFix = async () => {
        if (!prompt) return toastError("Please describe what to change.");
        setIsProcessing(true);
        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = 800; maskCanvas.height = 450;
        const mCtx = maskCanvas.getContext('2d');
        if (mCtx && canvasRef.current) {
            mCtx.fillStyle = "black"; mCtx.fillRect(0, 0, 800, 450);
            mCtx.globalCompositeOperation = 'screen';
            mCtx.drawImage(canvasRef.current, 0, 0);
            mCtx.fillStyle = "white"; mCtx.globalCompositeOperation = 'source-in';
            mCtx.fillRect(0, 0, 800, 450);
        }
        const maskBase64 = maskCanvas.toDataURL('image/png');

        const newImageUrl = await onSave(prompt, maskBase64);
        if (newImageUrl) setOutputImage(newImageUrl);
        setIsProcessing(false);
    };

    return (
        <div style={styles.terminalOverlay}>
            <div style={{ ...styles.modal, width: '1200px', maxWidth: '95vw' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                    <h2 style={styles.modalTitle}>INPAINT: FIX AREA</h2>

                    {/* NEW: Credits Display */}
                    <div style={styles.infoBox}>
                        <Zap size={14} color="#FF0000" />
                        <div style={{ textAlign: 'right' }}>
                            <p style={{ fontSize: '9px', color: '#666', fontFamily: 'monospace' }}>CREDITS</p>
                            <p style={{ fontSize: '10px', color: credits && credits > 0 ? '#FFF' : '#FF0000', fontWeight: 'bold' }}>
                                {credits !== null ? credits : '...'}
                            </p>
                        </div>
                    </div>

                    <X size={24} onClick={onClose} style={{ cursor: 'pointer', color: 'white' }} />
                </div>

                {/* DUAL COLUMN LAYOUT */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginBottom: '30px' }}>

                    {/* LEFT: INPUT BOX */}
                    <div>
                        <label style={{ ...styles.label, marginBottom: '10px' }}>INPUT: MASKING AREA</label>
                        <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', backgroundColor: '#000', border: '1px solid #333' }}>
                            <img src={src} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.5 }} alt="original" />
                            <canvas
                                ref={canvasRef}
                                onMouseDown={() => setIsDrawing(true)}
                                onMouseUp={() => setIsDrawing(false)}
                                onMouseMove={draw}
                                style={{ position: 'absolute', inset: 0, zIndex: 5, cursor: 'crosshair', width: '100%', height: '100%' }}
                            />
                        </div>
                    </div>

                    {/* RIGHT: OUTPUT BOX */}
                    <div>
                        <label style={{ ...styles.label, marginBottom: '10px' }}>OUTPUT: RENDERED FIX</label>
                        <div style={{ width: '100%', aspectRatio: '16/9', backgroundColor: '#000', border: '1px solid #FF0000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
                            {isProcessing ? (
                                <div style={{ textAlign: 'center' }}>
                                    <Loader2 className="spin-loader" size={48} color="#FF0000" />
                                    <p style={{ fontSize: '10px', marginTop: '10px', letterSpacing: '2px', color: 'white' }}>RE-RENDERING PIXELS...</p>
                                </div>
                            ) : outputImage ? (
                                <>
                                    <img src={outputImage} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="output" />
                                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '20px', background: 'linear-gradient(transparent, rgba(0,0,0,0.9))', display: 'flex', justifyContent: 'center' }}>
                                        <button
                                            onClick={() => onApply(outputImage)}
                                            style={{ ...styles.primaryBtn, width: 'auto', padding: '10px 30px', fontSize: '12px', height: '40px', backgroundColor: '#FF0000', color: '#fff' }}
                                        >
                                            APPLY & SAVE TO STORYBOARD
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div style={{ color: '#222', textAlign: 'center' }}>
                                    <ImageIcon size={48} strokeWidth={1} />
                                    <p style={{ fontSize: '10px', marginTop: '10px' }}>READY TO RENDER</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div style={{ borderTop: '1px solid #222', paddingTop: '20px' }}>
                    <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-end' }}>
                        <div style={{ flex: 1 }}>
                            <label style={styles.label}>BRUSH SIZE: {brushSize}px</label>
                            <input type="range" min="10" max="100" value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} style={{ width: '100%', accentColor: '#FF0000' }} />
                        </div>
                        <div style={{ flex: 2 }}>
                            <label style={styles.label}>MODIFICATION PROMPT</label>
                            <textarea
                                style={{ ...styles.textareaInput, marginBottom: 0, height: '60px' }}
                                placeholder="Describe the change..."
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                            />
                        </div>
                        <button style={{ ...styles.primaryBtn, width: '200px', height: '60px' }} onClick={handleGenerateFix} disabled={isProcessing}>
                            {isProcessing ? <Loader2 className="spin-loader" /> : <Sparkles size={18} />}
                            {isProcessing ? "PROCESSING..." : "GENERATE FIX"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};