"use client";

import { useState, useEffect, useRef } from "react";
import { X, Loader2, Sparkles, Check, Terminal, Activity, ImagePlus, Undo2, Redo2, Zap } from "lucide-react";
import { useCredits } from "@/hooks/useCredits";
import { toastError } from "@/lib/toast";

interface InpaintEditorProps {
    src: string;
    onSave: (prompt: string, maskBase64: string, refImages: File[]) => Promise<string | null>;
    onClose: () => void;
    styles: any;
    onApply: (url: string) => void;
}

export const InpaintEditor = ({ src, onSave, onClose, onApply }: InpaintEditorProps) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const imgRef = useRef<HTMLImageElement>(null); // Ref to read image dimensions

    // Dynamic Dimensions State
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

    const [isDrawing, setIsDrawing] = useState(false);
    const [brushSize, setBrushSize] = useState(40);
    const [prompt, setPrompt] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);
    const [outputImage, setOutputImage] = useState<string | null>(null);

    // Reference Images
    const [refImages, setRefImages] = useState<File[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- UNDO / REDO STATE ---
    const [history, setHistory] = useState<ImageData[]>([]);
    const [historyStep, setHistoryStep] = useState(-1);

    const { credits } = useCredits();

    // 1. Initialize Canvas when Dimensions Change
    useEffect(() => {
        if (dimensions.width === 0 || dimensions.height === 0) return;

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;

        // Set internal resolution to match Image Natural Size
        canvas.width = dimensions.width;
        canvas.height = dimensions.height;

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Clear and Save Initial State
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const initialData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        setHistory([initialData]);
        setHistoryStep(0);
    }, [dimensions]);

    // 2. Handle Image Load to get Natural Dimensions
    const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
        const { naturalWidth, naturalHeight } = e.currentTarget;
        setDimensions({ width: naturalWidth, height: naturalHeight });
    };

    // Drawing Logic
    const draw = (e: React.MouseEvent) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!ctx || !canvas) return;

        const rect = canvas.getBoundingClientRect();

        // Critical: Map Screen Coordinates to Image Natural Coordinates
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = "rgba(255, 0, 0, 0.5)";
        ctx.beginPath();
        // Scale brush size too so it looks consistent regardless of resolution
        ctx.arc(x, y, (brushSize * scaleX) / 2, 0, Math.PI * 2);
        ctx.fill();
    };

    const startDrawing = () => {
        setIsDrawing(true);
    };

    const stopDrawing = () => {
        if (!isDrawing) return;
        setIsDrawing(false);
        saveHistory();
    };

    // --- HISTORY MANAGEMENT ---
    const saveHistory = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const newHistory = history.slice(0, historyStep + 1);
        newHistory.push(data);
        setHistory(newHistory);
        setHistoryStep(newHistory.length - 1);
    };

    const handleUndo = () => {
        if (historyStep <= 0) return;
        const prevStep = historyStep - 1;
        restoreCanvas(history[prevStep]);
        setHistoryStep(prevStep);
    };

    const handleRedo = () => {
        if (historyStep >= history.length - 1) return;
        const nextStep = historyStep + 1;
        restoreCanvas(history[nextStep]);
        setHistoryStep(nextStep);
    };

    const restoreCanvas = (data: ImageData) => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx || !data) return;
        ctx.putImageData(data, 0, 0);
    };

    // File Handling
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
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
        if (dimensions.width === 0) return toastError("Image not loaded yet.");

        setIsProcessing(true);

        const maskCanvas = document.createElement('canvas');
        // Use Dynamic Dimensions
        maskCanvas.width = dimensions.width;
        maskCanvas.height = dimensions.height;
        const mCtx = maskCanvas.getContext('2d');

        if (mCtx && canvasRef.current) {
            mCtx.fillStyle = "black";
            mCtx.fillRect(0, 0, dimensions.width, dimensions.height);

            mCtx.drawImage(canvasRef.current, 0, 0);

            mCtx.globalCompositeOperation = 'source-in';
            mCtx.fillStyle = "white";
            mCtx.fillRect(0, 0, dimensions.width, dimensions.height);
        }

        const maskBase64 = maskCanvas.toDataURL('image/png');
        const newImageUrl = await onSave(prompt, maskBase64, refImages);

        if (newImageUrl) setOutputImage(newImageUrl);
        setIsProcessing(false);
    };

    // Styles
    const panelStyle: React.CSSProperties = {
        flex: 1,
        position: 'relative',
        backgroundColor: '#000',
        border: '1px solid #222',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    };

    // Dynamic Container Style
    // We let the image dictate the size, but constrain it to the panel
    const imageWrapperStyle: React.CSSProperties = {
        position: 'relative',
        width: 'auto',
        height: 'auto',
        maxWidth: '100%',
        maxHeight: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
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

                    {/* The wrapper shrinks to fit the image exactly */}
                    <div style={imageWrapperStyle}>
                        <img
                            ref={imgRef}
                            src={src}
                            onLoad={handleImageLoad} // <--- MAGIC HAPPENS HERE
                            style={{
                                maxWidth: '100%',
                                maxHeight: '100%',
                                display: 'block',
                                objectFit: 'contain'
                            }}
                            alt="source"
                        />
                        {/* Canvas sits absolutely on top, matching image dimensions */}
                        <canvas
                            ref={canvasRef}
                            onMouseDown={startDrawing}
                            onMouseUp={stopDrawing}
                            onMouseLeave={stopDrawing}
                            onMouseMove={draw}
                            style={{
                                position: 'absolute',
                                inset: 0,
                                width: '100%',
                                height: '100%',
                                cursor: 'crosshair',
                                zIndex: 10
                            }}
                        />
                    </div>

                    {/* CONTROLS */}
                    <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '10px', zIndex: 30, backgroundColor: 'rgba(0,0,0,0.8)', padding: '5px 10px', borderRadius: '20px', border: '1px solid #333' }}>
                        <button onClick={handleUndo} disabled={historyStep <= 0} style={{ background: 'none', border: 'none', color: historyStep > 0 ? 'white' : '#444', cursor: 'pointer' }}>
                            <Undo2 size={16} />
                        </button>
                        <div style={{ width: '1px', backgroundColor: '#333' }} />
                        <button onClick={handleRedo} disabled={historyStep >= history.length - 1} style={{ background: 'none', border: 'none', color: historyStep < history.length - 1 ? 'white' : '#444', cursor: 'pointer' }}>
                            <Redo2 size={16} />
                        </button>
                    </div>
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
                        <img src={outputImage} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} alt="output" />
                    ) : (
                        <Activity size={40} color="#222" />
                    )}
                </div>
            </div>

            {/* 3. CONTROL BAR */}
            <div style={{ height: '80px', borderTop: '1px solid #333', backgroundColor: '#0A0A0A', display: 'flex', alignItems: 'center', padding: '0 20px', gap: '20px' }}>
                <div style={{ width: '150px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '5px', color: '#888' }}>
                        <span>BRUSH SIZE</span><span>{brushSize}px</span>
                    </div>
                    <input type="range" min="5" max="100" value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} style={{ width: '100%', accentColor: '#FF0000' }} />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingRight: '15px', borderRight: '1px solid #333' }}>
                    <input type="file" multiple accept="image/*" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileSelect} />
                    <button onClick={() => fileInputRef.current?.click()} disabled={refImages.length >= 3} style={{ width: '40px', height: '40px', border: '1px dashed #444', backgroundColor: '#111', color: '#666', cursor: refImages.length >= 3 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px' }}>
                        <ImagePlus size={16} />
                    </button>
                    {refImages.map((file, i) => (
                        <div key={i} style={{ position: 'relative', width: '40px', height: '40px', border: '1px solid #333', borderRadius: '4px', overflow: 'hidden' }}>
                            <img src={URL.createObjectURL(file)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={`Ref ${i}`} />
                            <button onClick={() => removeRefImage(i)} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0 }}>
                                <X size={14} />
                            </button>
                        </div>
                    ))}
                    <div style={{ fontSize: '9px', color: '#666', width: '30px', textAlign: 'center' }}>{refImages.length}/3</div>
                </div>

                <div style={{ flex: 1 }}>
                    <input type="text" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Describe change..." style={{ width: '100%', height: '40px', backgroundColor: '#000', border: '1px solid #333', color: '#FFF', padding: '0 15px', fontSize: '12px', fontFamily: 'monospace', outline: 'none' }} />
                </div>

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