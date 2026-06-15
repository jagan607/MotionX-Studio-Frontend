"use client";

import React, { useState, useEffect } from 'react';
import { X, Save, Sparkles, RefreshCcw } from "@/lib/lucide";
import { CameraTransform } from '@/lib/types';
import { CameraViewfinder, ImageProvider } from './InlineCameraGizmo';
import { EMERGENCY_MODE, EMERGENCY_FALLBACK_IMAGE_PROVIDER } from '@/lib/emergencyConfig';

export const DEFAULT_CAMERA: CameraTransform = { x: 0, y: 1.6, z: 3, rx: 0, ry: 0, fov: 50 };

function getShotLabel(cam: CameraTransform): string {
    const dist = Math.sqrt(cam.x * cam.x + cam.z * cam.z);
    let framing = dist > 5 ? 'Wide' : dist > 3 ? 'Medium' : dist > 1.5 ? 'Close-Up' : 'Extreme Close-Up';
    let angle = cam.y > 5 ? 'Top-Down' : cam.y > 3 ? 'High' : cam.y > 1 ? 'Eye Level' : cam.y > 0.3 ? 'Low' : 'Worm';
    return `${framing}, ${angle}`;
}

interface CameraGizmoOverlayProps {
    imageUrl: string;
    initialTransform?: CameraTransform;
    onClose: () => void;
    onSave: (transform: CameraTransform, shotType: string) => void;
    onRegenerate: (transform: CameraTransform, shotType: string) => void;
    isGenerating?: boolean;
}

export function CameraGizmoOverlay({
    imageUrl,
    initialTransform,
    onClose,
    onSave,
    onRegenerate,
    isGenerating = false
}: CameraGizmoOverlayProps) {
    const [cam, setCam] = useState<CameraTransform>(initialTransform || DEFAULT_CAMERA);
    const [internalGenerating, setInternalGenerating] = useState(false);
    const [provider, setProvider] = useState<ImageProvider>(
        EMERGENCY_MODE ? EMERGENCY_FALLBACK_IMAGE_PROVIDER as ImageProvider : 'gemini'
    );

    const activeIsGenerating = isGenerating || internalGenerating;
    const shotTypeStr = getShotLabel(cam);

    const handleReset = () => setCam(DEFAULT_CAMERA);

    useEffect(() => {
        handleReset();
        setInternalGenerating(false);
    }, [imageUrl]);

    return (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 md:p-8 font-sans">
            <div className="bg-[#0A0A0A] border border-white/[0.08] rounded-2xl w-full max-w-6xl h-full md:h-[85vh] flex flex-col overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)] relative">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-[#D40A12] animate-pulse" />
                        <h2 className="text-sm font-bold text-white tracking-widest uppercase">Camera Rig</h2>
                        <span className="text-[10px] font-mono text-neutral-500 bg-white/[0.04] px-2 py-0.5 rounded border border-white/[0.06]">
                            {shotTypeStr}
                        </span>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-[10px] font-mono text-neutral-600">
                            POS: {cam.x.toFixed(1)}, {cam.y.toFixed(1)}, {cam.z.toFixed(1)} · ROT: {cam.rx.toFixed(0)}°, {cam.ry.toFixed(0)}°
                        </span>
                        <button onClick={onClose} className="text-neutral-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors p-2 cursor-pointer">
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Same layout: Original + Scene map with draggable camera */}
                <div className="flex-1 p-6 flex flex-col gap-4 min-h-0">
                    <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
                        <div className="relative rounded-lg overflow-hidden bg-[#0a0a0a] border border-white/[0.06]">
                            <img src={imageUrl} alt="Original shot" className="w-full h-full object-cover" draggable={false} />
                            <div className="absolute top-3 left-3 pointer-events-none">
                                <span className="text-[9px] font-bold text-white/50 bg-black/60 px-2 py-1 rounded uppercase tracking-wider">Original</span>
                            </div>
                        </div>
                        <CameraViewfinder imageUrl={imageUrl} cam={cam} onCamChange={setCam} height="100%" />
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center gap-3 px-6 py-4 border-t border-white/5 shrink-0 bg-[#0a0a0a]">
                    <button onClick={handleReset} disabled={activeIsGenerating}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-white transition-colors cursor-pointer disabled:opacity-40">
                        <RefreshCcw size={14} /> Reset
                    </button>
                    <div className="flex-1" />
                    <button onClick={() => onSave(cam, shotTypeStr)} disabled={activeIsGenerating}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold bg-white/5 text-neutral-300 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-40">
                        <Save size={14} /> Save Position
                    </button>

                    {/* Provider picker */}
                    <div className="flex bg-white/[0.03] rounded-lg border border-white/[0.08] overflow-hidden">
                        {!EMERGENCY_MODE && (
                        <button onClick={() => setProvider('gemini')}
                            className={`px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer
                                ${provider === 'gemini' ? 'bg-[#D40A12]/15 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}>
                            Gemini
                        </button>
                        )}
                        <button onClick={() => setProvider('luma-uni-1')}
                            className={`px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${!EMERGENCY_MODE ? 'border-l border-white/[0.08]' : ''}
                                ${provider === 'luma-uni-1' ? 'bg-[#D40A12]/15 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}>
                            Uni
                        </button>
                    </div>

                    <button
                        onClick={() => { setInternalGenerating(true); onRegenerate(cam, shotTypeStr); }}
                        disabled={activeIsGenerating}
                        className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold bg-[#D40A12] text-white hover:bg-[#ff0f1a] shadow-[0_0_20px_rgba(212,10,18,0.2)] transition-all cursor-pointer disabled:opacity-50 disabled:grayscale">
                        {activeIsGenerating ? (
                            <>Generating... <span className="animate-pulse">⏳</span></>
                        ) : (
                            <><Sparkles size={16} /> Generate Shot</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
