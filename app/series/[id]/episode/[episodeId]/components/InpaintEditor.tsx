"use client";

import { useState, useEffect, useRef } from "react";
import { X, Loader2, Sparkles, Check, Terminal, Activity, ImagePlus, Trash2, Zap } from "lucide-react";
import { useCredits } from "@/hooks/useCredits";
import { toastError } from "@/lib/toast";

interface InpaintEditorProps {
    src: string;
    // UPDATED: Accept files
    onSave: (prompt: string, maskBase64: string, refImages: File[]) => Promise<string | null>;
    onClose: () => void;
    styles: any;
    onApply: (url: string) => void;
}

export const InpaintEditor = ({ src, onSave, onClose, onApply }: InpaintEditorProps) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [brushSize, setBrushSize] = useState(40);
    const [prompt, setPrompt] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);
    const [outputImage, setOutputImage] = useState<string | null>(null);

    // NEW: State for Reference Images
    const [refImages, setRefImages] = useState<File[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { credits } = useCredits();

    // Setup Canvas (Unchanged)
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        canvas.width = 1280;
        canvas.height = 720;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
    }, []);

    // Drawing Logic (Unchanged)
    const draw = (e: React.MouseEvent) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!ctx || !canvas) return;

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = "rgba(255, 0, 0, 0.5)";
        ctx.beginPath();
        ctx.arc(x, y, (brushSize * scaleX) / 2, 0, Math.PI * 2);
        ctx.fill();
    };

    // Handle File Selection
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            // Limit to 3 total
            if (refImages.length + files.length > 3) {
                toastError("Max 3 reference images allowed.");
                return;
            }
            setRefImages(prev => [...prev, ...files]);
        }
    };

    const removeRefImage = (index: number) => {
        setRefImages(prev => prev.filter((_, i) => i !== index));
    };

    const handleGenerateFix = async () => {
        if (!prompt) return toastError("MISSING_PROMPT: Please describe the change.");
        setIsProcessing(true);

        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = 1280; maskCanvas.height = 720;
        const mCtx = maskCanvas.getContext('2d');

        if (mCtx && canvasRef.current) {
            mCtx.fillStyle = "black";
            mCtx.fillRect(0, 0, 1280, 720);
            mCtx.globalCompositeOperation = 'screen';
            mCtx.drawImage(canvasRef.current, 0, 0);
            mCtx.fillStyle = "white";
            mCtx.globalCompositeOperation = 'source-in';
            mCtx.fillRect(0, 0, 1280, 720);
        }

        const maskBase64 = maskCanvas.toDataURL('image/png');

        // Pass refImages to onSave
        const newImageUrl = await onSave(prompt, maskBase64, refImages);

        if (newImageUrl) setOutputImage(newImageUrl);
        setIsProcessing(false);
    };

    // Styles (Unchanged)
    const panelStyle: React.CSSProperties = {
        flex: 1, position: 'relative', backgroundColor: '#000', border: '1px solid #222',
        overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center'
    };
    const badgeStyle: React.CSSProperties = {
        position: 'absolute', top: 10, left: 10, fontSize: '10px', fontWeight: 'bold',
        backgroundColor: '#000', color: '#FFF', padding: '2px 6px', border: '1px solid #333', zIndex: 20
    };

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: '#050505', display: 'flex', flexDirection: 'column', fontFamily: 'monospace', color: '#EDEDED' }}>

            {/* 1. HEADER */}
            <div style={{ height: '50px', borderBottom: '1px solid #333', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', backgroundColor: '#0A0A0A' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Terminal size={16} color="#FF0000" />
                    <span style={{ fontWeight: 'bold', letterSpacing: '2px' }}>VFX_INPAINT_TERMINAL</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Zap size={12} color="#FF0000" />
                        <span style={{ fontSize: '12px' }}>{credits ?? 0} TOKENS</span>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#666' }}><X size={20} /></button>
                </div>
            </div>

            {/* 2. MAIN WORKSPACE */}
            <div style={{ flex: 1, display: 'flex', padding: '20px', gap: '20px', overflow: 'hidden' }}>
                {/* LEFT: INPUT */}
                <div style={panelStyle}>
                    <div style={badgeStyle}>SOURCE PLATE</div>
                    <img src={src} style={{ width: '100%', height: '100%', objectFit: 'contain' }} alt="source" />
                    <canvas
                        ref={canvasRef}
                        onMouseDown={() => setIsDrawing(true)}
                        onMouseUp={() => setIsDrawing(false)}
                        onMouseMove={draw}
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'crosshair', zIndex: 10 }}
                    />
                </div>

                {/* RIGHT: OUTPUT */}
                <div style={{ ...panelStyle, borderColor: outputImage ? '#FF0000' : '#222' }}>
                    <div style={{ ...badgeStyle, color: outputImage ? '#FF0000' : '#666' }}>
                        {isProcessing ? 'RENDERING...' : outputImage ? 'FINAL RENDER' : 'AWAITING INPUT'}
                    </div>
                    {isProcessing ? (
                        <div style={{ textAlign: 'center' }}>
                            <Loader2 className="animate-spin" size={40} color="#FF0000" />
                            <div style={{ marginTop: '10px', fontSize: '10px', letterSpacing: '2px' }}>PROCESSING...</div>
                        </div>
                    ) : outputImage ? (
                        <img src={outputImage} style={{ width: '100%', height: '100%', objectFit: 'contain' }} alt="output" />
                    ) : (
                        <Activity size={40} color="#222" />
                    )}
                </div>
            </div>

            {/* 3. CONTROL BAR */}
            <div style={{ height: '80px', borderTop: '1px solid #333', backgroundColor: '#0A0A0A', display: 'flex', alignItems: 'center', padding: '0 20px', gap: '20px' }}>

                {/* Brush Control */}
                <div style={{ width: '150px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '5px', color: '#888' }}>
                        <span>BRUSH SIZE</span><span>{brushSize}px</span>
                    </div>
                    <input type="range" min="5" max="100" value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} style={{ width: '100%', accentColor: '#FF0000' }} />
                </div>

                {/* Reference Images Section */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingRight: '15px', borderRight: '1px solid #333' }}>
                    <input
                        type="file"
                        multiple
                        accept="image/*"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        onChange={handleFileSelect}
                    />

                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={refImages.length >= 3}
                        style={{
                            width: '40px', height: '40px',
                            border: '1px dashed #444',
                            backgroundColor: '#111',
                            color: '#666',
                            cursor: refImages.length >= 3 ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            borderRadius: '4px'
                        }}
                        title="Add Reference Images (Max 3)"
                    >
                        <ImagePlus size={16} />
                    </button>

                    {/* Preview Thumbnails */}
                    {refImages.map((file, i) => (
                        <div key={i} style={{ position: 'relative', width: '40px', height: '40px', border: '1px solid #333', borderRadius: '4px', overflow: 'hidden' }}>
                            <img
                                src={URL.createObjectURL(file)}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                alt={`Ref ${i}`}
                            />
                            <button
                                onClick={() => removeRefImage(i)}
                                style={{
                                    position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
                                    border: 'none', color: 'white', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    opacity: 0, transition: 'opacity 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                                onMouseLeave={(e) => e.currentTarget.style.opacity = '0'}
                            >
                                <X size={14} />
                            </button>
                        </div>
                    ))}
                    <div style={{ fontSize: '9px', color: '#666', width: '30px', textAlign: 'center' }}>
                        {refImages.length}/3
                    </div>
                </div>

                {/* Prompt Input */}
                <div style={{ flex: 1 }}>
                    <input
                        type="text"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Describe change..."
                        style={{ width: '100%', height: '40px', backgroundColor: '#000', border: '1px solid #333', color: '#FFF', padding: '0 15px', fontSize: '12px', fontFamily: 'monospace', outline: 'none' }}
                    />
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={handleGenerateFix} disabled={isProcessing} style={{ height: '40px', padding: '0 25px', backgroundColor: '#FF0000', color: '#FFF', border: 'none', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', cursor: isProcessing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px', opacity: isProcessing ? 0.5 : 1 }}>
                        <Sparkles size={14} /> {isProcessing ? 'WORKING...' : 'GENERATE'}
                    </button>
                    <button onClick={() => outputImage && onApply && onApply(outputImage)} disabled={!outputImage || isProcessing} style={{ height: '40px', padding: '0 25px', backgroundColor: '#FFF', color: '#000', border: 'none', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', cursor: (!outputImage || isProcessing) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px', opacity: (!outputImage || isProcessing) ? 0.3 : 1 }}>
                        <Check size={14} /> APPLY
                    </button>
                </div>
            </div>
        </div>
    );
};