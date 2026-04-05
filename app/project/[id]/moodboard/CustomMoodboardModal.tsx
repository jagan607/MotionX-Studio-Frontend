"use client";

import React, { useState, useRef, useCallback } from "react";
import {
    X, Upload, Scan, PenLine, Loader2,
    Palette, Sun, Layers, CloudFog, ImageIcon, Type
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface CustomMoodboardResult {
    mode: 'ai' | 'manual';
    file: File;
    /** Only populated in manual mode */
    manualParams?: {
        name: string;
        color_palette: string;
        lighting: string;
        texture: string;
        atmosphere: string;
    };
}

interface CustomMoodboardModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (result: CustomMoodboardResult) => void;
    isSubmitting?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function CustomMoodboardModal({
    isOpen,
    onClose,
    onSubmit,
    isSubmitting = false,
}: CustomMoodboardModalProps) {
    // --- State ---
    const [mode, setMode] = useState<'ai' | 'manual'>('ai');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    // Manual entry fields
    const [name, setName] = useState('');
    const [colorPalette, setColorPalette] = useState('');
    const [lighting, setLighting] = useState('');
    const [texture, setTexture] = useState('');
    const [atmosphere, setAtmosphere] = useState('');

    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- Helpers ---
    const handleFileSelect = useCallback((file: File) => {
        // Revoke old preview
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        const url = URL.createObjectURL(file);
        setSelectedFile(file);
        setPreviewUrl(url);
    }, [previewUrl]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file && file.type.startsWith('image/')) {
            handleFileSelect(file);
        }
    }, [handleFileSelect]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback(() => {
        setIsDragging(false);
    }, []);

    const handleSubmit = () => {
        if (!selectedFile) return;
        if (mode === 'manual') {
            onSubmit({
                mode: 'manual',
                file: selectedFile,
                manualParams: { name, color_palette: colorPalette, lighting, texture, atmosphere },
            });
        } else {
            onSubmit({ mode: 'ai', file: selectedFile });
        }
    };

    const handleClose = () => {
        if (isSubmitting) return;
        // Cleanup
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setSelectedFile(null);
        setPreviewUrl(null);
        setName('');
        setColorPalette('');
        setLighting('');
        setTexture('');
        setAtmosphere('');
        setMode('ai');
        onClose();
    };

    const isManualValid = mode === 'manual'
        ? (name.trim() && colorPalette.trim() && lighting.trim() && texture.trim() && atmosphere.trim())
        : true;
    const canSubmit = !!selectedFile && !isSubmitting && isManualValid;

    if (!isOpen) return null;

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────────────

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={handleClose} />

            {/* Modal */}
            <div
                className="relative z-10 bg-[#0a0a0a] border border-white/[0.08] rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl"
                style={{ animation: "fadeSlideUp 0.3s ease both" }}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
                    <div>
                        <h2 className="text-[13px] font-bold uppercase tracking-[2px] text-white">
                            Custom Moodboard
                        </h2>
                        <p className="text-[10px] text-white/25 mt-0.5 tracking-wide">
                            Upload a reference image to set your visual direction
                        </p>
                    </div>
                    <button
                        onClick={handleClose}
                        disabled={isSubmitting}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white/30 hover:text-white hover:bg-white/[0.05] transition-all cursor-pointer disabled:opacity-30"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">

                    {/* ── Image Upload Zone ── */}
                    <div
                        onClick={() => !isSubmitting && fileInputRef.current?.click()}
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        className={`relative rounded-xl overflow-hidden cursor-pointer transition-all duration-300
                            ${selectedFile
                                ? 'h-48'
                                : 'h-40 border-2 border-dashed hover:border-amber-500/30 hover:bg-amber-500/[0.02]'
                            }
                            ${isDragging
                                ? 'border-amber-400/50 bg-amber-500/[0.04] scale-[1.01]'
                                : selectedFile
                                    ? 'border border-white/[0.08]'
                                    : 'border-white/[0.08]'
                            }
                            ${isSubmitting ? 'pointer-events-none opacity-60' : ''}
                        `}
                    >
                        {previewUrl ? (
                            <>
                                <img
                                    src={previewUrl}
                                    alt="Preview"
                                    className="absolute inset-0 w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
                                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                                    <span className="text-[9px] font-mono text-white/50 uppercase tracking-wider truncate max-w-[60%]">
                                        {selectedFile?.name}
                                    </span>
                                    <span className="text-[9px] text-amber-400/60 font-bold uppercase tracking-wider">
                                        Click to change
                                    </span>
                                </div>
                            </>
                        ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                                <div className="w-14 h-14 rounded-full border border-white/[0.06] bg-white/[0.02] flex items-center justify-center">
                                    <ImageIcon size={22} className={`transition-colors ${isDragging ? 'text-amber-400' : 'text-white/15'}`} />
                                </div>
                                <div className="text-center">
                                    <span className="text-[11px] text-white/40 block">
                                        {isDragging ? 'Drop your image here' : 'Click to upload or drag & drop'}
                                    </span>
                                    <span className="text-[9px] text-white/15 mt-1 block">
                                        JPG, PNG, WebP — max 10MB
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileSelect(file);
                            e.target.value = '';
                        }}
                    />

                    {/* ── Generation Mode Toggle ── */}
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => setMode('ai')}
                            disabled={isSubmitting}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer border
                                ${mode === 'ai'
                                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                                    : 'bg-white/[0.02] border-white/[0.06] text-white/30 hover:text-white/50 hover:border-white/[0.12]'
                                }
                                ${isSubmitting ? 'pointer-events-none' : ''}
                            `}
                        >
                            <Scan size={13} className={mode === 'ai' ? 'text-amber-400' : ''} />
                            AI Auto-Extract
                        </button>
                        <button
                            type="button"
                            onClick={() => setMode('manual')}
                            disabled={isSubmitting}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer border
                                ${mode === 'manual'
                                    ? 'bg-white/[0.06] border-white/[0.15] text-white'
                                    : 'bg-white/[0.02] border-white/[0.06] text-white/30 hover:text-white/50 hover:border-white/[0.12]'
                                }
                                ${isSubmitting ? 'pointer-events-none' : ''}
                            `}
                        >
                            <PenLine size={13} />
                            Manual Entry
                        </button>
                    </div>

                    {/* ── Dynamic Form Area ── */}
                    {mode === 'ai' ? (
                        /* AI Mode — Just a description, no fields */
                        <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-4">
                            <div className="flex items-start gap-3">
                                <Scan size={16} className="text-amber-400/40 mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="text-[11px] text-white/50 leading-relaxed">
                                        Our AI will analyze your reference image and automatically extract the
                                        cinematic parameters — <span className="text-white/70">color palette</span>,{' '}
                                        <span className="text-white/70">lighting</span>,{' '}
                                        <span className="text-white/70">texture</span>, and{' '}
                                        <span className="text-white/70">atmosphere</span>.
                                    </p>
                                    <p className="text-[9px] text-white/20 mt-2 uppercase tracking-wider">
                                        Takes about 3-5 seconds
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* Manual Mode — Editable text fields */
                        <div className="space-y-3">
                            <ParamField
                                icon={<Type size={12} />}
                                label="Name"
                                placeholder="e.g. Amber Noir Intimacy"
                                value={name}
                                onChange={setName}
                                disabled={isSubmitting}
                            />
                            <ParamField
                                icon={<Palette size={12} />}
                                label="Color Palette"
                                placeholder="e.g. Deep amber, muted golds, warm shadows..."
                                value={colorPalette}
                                onChange={setColorPalette}
                                disabled={isSubmitting}
                                multiline
                            />
                            <ParamField
                                icon={<Sun size={12} />}
                                label="Lighting"
                                placeholder="e.g. Low-key chiaroscuro with warm practicals..."
                                value={lighting}
                                onChange={setLighting}
                                disabled={isSubmitting}
                                multiline
                            />
                            <ParamField
                                icon={<Layers size={12} />}
                                label="Texture"
                                placeholder="e.g. Fine 35mm grain, soft halation..."
                                value={texture}
                                onChange={setTexture}
                                disabled={isSubmitting}
                                multiline
                            />
                            <ParamField
                                icon={<CloudFog size={12} />}
                                label="Atmosphere"
                                placeholder="e.g. Oppressive intimacy, claustrophobic warmth..."
                                value={atmosphere}
                                onChange={setAtmosphere}
                                disabled={isSubmitting}
                                multiline
                            />
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-white/[0.06] flex items-center justify-between">
                    <span className="text-[9px] text-white/15 font-mono uppercase tracking-wider">
                        {mode === 'ai' ? 'Gemini Vision Analysis' : 'Manual Parameters'}
                    </span>
                    <button
                        onClick={handleSubmit}
                        disabled={!canSubmit}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-[2px] transition-all cursor-pointer
                            ${canSubmit
                                ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-[0_0_20px_rgba(245,158,11,0.15)] hover:shadow-[0_0_30px_rgba(245,158,11,0.25)]'
                                : 'bg-white/[0.04] text-white/20 border border-white/[0.06] cursor-not-allowed'
                            }`}
                    >
                        {isSubmitting ? (
                            <><Loader2 size={13} className="animate-spin" /> Analyzing...</>
                        ) : mode === 'ai' ? (
                            <>Analyze</>
                        ) : (
                            <><PenLine size={13} /> Save Custom Mood</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// PARAM FIELD SUBCOMPONENT
// ─────────────────────────────────────────────────────────────────────────────

function ParamField({
    icon,
    label,
    placeholder,
    value,
    onChange,
    disabled,
    multiline,
}: {
    icon: React.ReactNode;
    label: string;
    placeholder: string;
    value: string;
    onChange: (v: string) => void;
    disabled?: boolean;
    multiline?: boolean;
}) {
    const baseClasses = `w-full bg-transparent text-[11px] text-white/70 placeholder:text-white/15 outline-none resize-none leading-relaxed disabled:opacity-40`;

    return (
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.04]">
                <span className="text-white/20">{icon}</span>
                <span className="text-[8px] font-mono text-white/25 uppercase tracking-[3px]">{label}</span>
            </div>
            <div className="px-3 py-2.5">
                {multiline ? (
                    <textarea
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder={placeholder}
                        disabled={disabled}
                        rows={2}
                        className={baseClasses}
                    />
                ) : (
                    <input
                        type="text"
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder={placeholder}
                        disabled={disabled}
                        className={baseClasses}
                    />
                )}
            </div>
        </div>
    );
}
