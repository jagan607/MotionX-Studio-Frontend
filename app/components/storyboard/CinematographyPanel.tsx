"use client";

import React, { useState, useEffect, useRef } from "react";
import {
    Sparkles, X, Loader2, Save, Upload, Palette, Sun, Layers,
    CloudFog, Camera, RefreshCw, AlertTriangle, CheckCircle2, ImageOff
} from "lucide-react";
import { SceneMood } from "@/lib/types";
import {
    updateSceneMood, generateStyleReference, uploadStyleReference
} from "@/lib/api";
import { toastError, toastSuccess } from "@/lib/toast";

/* ── Props ──────────────────────────────────────────────── */
interface CinematographyPanelProps {
    isOpen: boolean;
    onClose: () => void;
    projectId: string;
    episodeId: string;
    sceneId: string;
    mood: SceneMood;
    onMoodUpdate?: (mood: SceneMood) => void;
}

/* ── Status Badge ───────────────────────────────────────── */
const StatusBadge: React.FC<{ status: SceneMood["style_reference_status"] }> = ({ status }) => {
    if (!status) return null;

    const configs: Record<string, { color: string; bg: string; border: string; label: string; icon: React.ReactNode }> = {
        generating: {
            color: "rgb(251, 191, 36)", bg: "rgba(251, 191, 36, 0.1)",
            border: "rgba(251, 191, 36, 0.3)", label: "Generating",
            icon: <Loader2 size={10} className="animate-spin" />,
        },
        ready: {
            color: "rgb(34, 197, 94)", bg: "rgba(34, 197, 94, 0.1)",
            border: "rgba(34, 197, 94, 0.3)", label: "Active",
            icon: <CheckCircle2 size={10} />,
        },
        stale: {
            color: "rgb(251, 191, 36)", bg: "rgba(251, 191, 36, 0.1)",
            border: "rgba(251, 191, 36, 0.3)", label: "Stale",
            icon: <AlertTriangle size={10} />,
        },
        failed: {
            color: "rgb(239, 68, 68)", bg: "rgba(239, 68, 68, 0.1)",
            border: "rgba(239, 68, 68, 0.3)", label: "Failed",
            icon: <ImageOff size={10} />,
        },
    };
    const cfg = configs[status];
    if (!cfg) return null;

    return (
        <div
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-[2px]"
            style={{ color: cfg.color, backgroundColor: cfg.bg, border: `1px solid ${cfg.border}` }}
        >
            {cfg.icon} {cfg.label}
        </div>
    );
};

/* ── Main Panel ─────────────────────────────────────────── */
export const CinematographyPanel: React.FC<CinematographyPanelProps> = ({
    isOpen, onClose, projectId, episodeId, sceneId,
    mood, onMoodUpdate,
}) => {
    // UI state
    const [isVisible, setIsVisible] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Editable text fields — local copies
    const [colorPalette, setColorPalette] = useState(mood.color_palette || "");
    const [lighting, setLighting] = useState(mood.lighting || "");
    const [texture, setTexture] = useState(mood.texture || "");
    const [atmosphere, setAtmosphere] = useState(mood.atmosphere || "");

    // Derived from the reactive mood prop (Firestore snapshot)
    const styleRefUrl = mood.style_reference_url;
    const styleRefStatus = mood.style_reference_status;
    const isStale = styleRefStatus === "stale";
    const isRefGenerating = styleRefStatus === "generating";
    const isReady = styleRefStatus === "ready";
    const isFailed = styleRefStatus === "failed";
    const hasImage = !!styleRefUrl;

    // Sync local fields when mood prop changes (scene switch, Firestore update)
    useEffect(() => {
        setColorPalette(mood.color_palette || "");
        setLighting(mood.lighting || "");
        setTexture(mood.texture || "");
        setAtmosphere(mood.atmosphere || "");
    }, [mood]);

    // Panel animation
    useEffect(() => {
        if (isOpen) requestAnimationFrame(() => setIsVisible(true));
        else setIsVisible(false);
    }, [isOpen]);

    // Dirty check
    const isDirty =
        colorPalette !== (mood.color_palette || "") ||
        lighting !== (mood.lighting || "") ||
        texture !== (mood.texture || "") ||
        atmosphere !== (mood.atmosphere || "");

    /* ── Handlers ─────────────────────────────────────────── */
    const handleSave = async () => {
        setIsSaving(true);
        try {
            const res = await updateSceneMood(projectId, episodeId, sceneId, {
                color_palette: colorPalette,
                lighting,
                texture,
                atmosphere,
            });
            if (onMoodUpdate && res.mood) onMoodUpdate(res.mood);
            toastSuccess("Cinematography directives saved");
        } catch (e: any) {
            toastError(e?.response?.data?.detail || "Failed to save mood");
        } finally {
            setIsSaving(false);
        }
    };

    const handleGenerate = async () => {
        setIsGenerating(true);
        try {
            await generateStyleReference(projectId, episodeId, sceneId);
            toastSuccess("Style reference generation queued");
            // Firestore snapshot will update mood.style_reference_status → "generating"
        } catch (e: any) {
            toastError(e?.response?.data?.detail || "Failed to generate style reference");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleUpload = async (file: File) => {
        setIsUploading(true);
        try {
            await uploadStyleReference(projectId, episodeId, sceneId, file);
            toastSuccess("Custom style reference uploaded");
            // Firestore snapshot will update mood → style_reference_url + status = "ready"
        } catch (e: any) {
            toastError("Failed to upload reference");
        } finally {
            setIsUploading(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleUpload(file);
        e.target.value = ""; // Reset so re-upload of same file works
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (file && file.type.startsWith("image/")) handleUpload(file);
    };

    const handleClose = () => {
        setIsVisible(false);
        setTimeout(onClose, 300);
    };

    if (!isOpen) return null;

    /* ── Field Definitions ─────────────────────────────── */
    const fields = [
        { key: "color_palette", label: "Color Palette", icon: Palette, value: colorPalette, setter: setColorPalette, placeholder: "Warm amber and deep gold with desaturated shadows. Earthy browns grounded by burnished copper highlights...", rows: 2 },
        { key: "lighting", label: "Lighting", icon: Sun, value: lighting, setter: setLighting, placeholder: "Chiaroscuro with a single golden key light from camera-left. Harsh overhead practicals in Act 3...", rows: 2 },
        { key: "texture", label: "Texture & Grade", icon: Layers, value: texture, setter: setTexture, placeholder: "Fine 35mm grain, heavy halation around practicals. Bleach-bypass look, pushed two stops...", rows: 2 },
        { key: "atmosphere", label: "Atmosphere", icon: CloudFog, value: atmosphere, setter: setAtmosphere, placeholder: "Reverent, intimate, sacred stillness broken only by whispered dialogue and ambient hum...", rows: 2 },
    ];

    return (
        <div
            className="fixed inset-0 z-[200] flex"
            style={{ opacity: isVisible ? 1 : 0, transition: "opacity 0.3s ease" }}
        >
            {/* ═══ BACKDROP — Style Reference Image ═══ */}
            <div className="absolute inset-0 bg-[#050505]">
                {hasImage ? (
                    <img
                        key={styleRefUrl}
                        src={styleRefUrl}
                        alt="Scene Style Reference"
                        className="absolute inset-0 w-full h-full object-cover object-center"
                        style={{
                            filter: isStale ? "blur(6px) grayscale(0.5) brightness(0.6)" : isFailed ? "grayscale(0.8) brightness(0.3)" : "none",
                            transition: "filter 0.6s ease",
                        }}
                    />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center opacity-[0.04]">
                        <Camera size={200} strokeWidth={0.5} />
                    </div>
                )}

                {/* Generating overlay */}
                {isRefGenerating && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                        <div className="text-center">
                            <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-4 relative overflow-hidden">
                                <div className="absolute inset-0 bg-amber-500/10 animate-ping" />
                                <Sparkles size={24} className="text-amber-400 animate-pulse relative z-10" />
                            </div>
                            <div className="text-[12px] font-mono font-bold text-amber-400 uppercase tracking-[4px] mb-1">Rendering Lookbook</div>
                            <div className="text-[11px] text-white/40">Compositing scene cinematography into a reference frame...</div>
                        </div>
                    </div>
                )}

                {/* Gradients for text readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-80" />
                <div className="absolute inset-y-0 right-0 w-[60%] bg-gradient-to-l from-black/90 via-black/40 to-transparent" />
                <div className="absolute inset-y-0 left-0 w-[20%] bg-gradient-to-r from-black/60 to-transparent" />
            </div>

            {/* ═══ CONTENT ═══ */}
            <div className="relative z-10 flex w-full h-full p-4 md:p-8 gap-6 overflow-hidden">

                {/* LEFT: Title & Stale Warning */}
                <div
                    className="flex-1 h-full relative flex flex-col justify-end pb-8 pointer-events-none"
                    style={{
                        transform: isVisible ? "translateY(0)" : "translateY(30px)",
                        opacity: isVisible ? 1 : 0,
                        transition: "all 0.5s ease 0.2s",
                    }}
                >
                    <div className="max-w-[600px]">
                        {/* Status badge */}
                        {styleRefStatus && (
                            <div className="mb-4">
                                <StatusBadge status={styleRefStatus} />
                            </div>
                        )}

                        {/* Stale warning */}
                        {isStale && (
                            <div className="bg-amber-900/20 backdrop-blur-md border border-amber-500/30 p-4 rounded-xl mb-4 max-w-[480px] pointer-events-auto">
                                <div className="flex items-start gap-3">
                                    <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                                    <div>
                                        <div className="text-[11px] font-bold text-amber-300 uppercase tracking-wider mb-1">Reference Out of Sync</div>
                                        <div className="text-[11px] text-white/50 leading-relaxed">
                                            Text directives changed since this reference was generated.
                                            Regenerate or upload a new reference to apply to shots.
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Failed error */}
                        {isFailed && (
                            <div className="bg-red-900/20 backdrop-blur-md border border-red-500/30 p-4 rounded-xl mb-4 max-w-[480px] pointer-events-auto">
                                <div className="flex items-center gap-3">
                                    <ImageOff size={16} className="text-red-400 shrink-0" />
                                    <div className="text-[11px] text-red-300">
                                        Style reference generation failed. Try again or upload a custom image.
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Panel title */}
                        <div className="text-[10px] font-bold text-amber-400/80 uppercase tracking-[5px] mb-2 drop-shadow-md">
                            Director of Photography
                        </div>
                        <h2
                            className="text-white uppercase leading-none"
                            style={{
                                fontFamily: "Anton, sans-serif",
                                fontSize: "clamp(36px, 5vw, 72px)",
                                letterSpacing: "2px",
                                textShadow: "0 4px 40px rgba(0,0,0,0.8)",
                            }}
                        >
                            CINEMATOGRAPHY
                        </h2>
                    </div>
                </div>

                {/* RIGHT: Controls Panel */}
                <div
                    className="w-[420px] lg:w-[480px] shrink-0 h-full max-h-[95vh] flex flex-col rounded-3xl overflow-hidden bg-black/60 backdrop-blur-[30px] border border-white/[0.08] shadow-[0_0_80px_rgba(0,0,0,0.8)] self-center relative z-20"
                    style={{
                        transform: isVisible ? "translateX(0)" : "translateX(40px)",
                        opacity: isVisible ? 1 : 0,
                        transition: "all 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.3s",
                    }}
                >
                    {/* Header */}
                    <div className="px-8 pt-8 pb-5 shrink-0 border-b border-white/[0.03] bg-gradient-to-b from-white/[0.02] to-transparent">
                        <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-[1px] bg-amber-500" />
                                <span className="text-[10px] font-mono text-amber-400 uppercase tracking-[4px]">Cinematography</span>
                            </div>
                            <button
                                onClick={handleClose}
                                className="w-10 h-10 rounded-full flex items-center justify-center bg-white/[0.05] border border-white/10 text-white/40 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Action buttons row */}
                        <div className="flex gap-2">
                            {/* Generate AI Reference */}
                            <button
                                onClick={handleGenerate}
                                disabled={isGenerating || isRefGenerating}
                                className="flex-1 flex items-center justify-center gap-3 px-4 py-3.5 rounded-xl transition-all cursor-pointer disabled:cursor-not-allowed group border border-white/[0.05] hover:border-amber-500/40 relative overflow-hidden"
                                style={{ background: (isGenerating || isRefGenerating) ? "rgba(251, 191, 36, 0.05)" : "rgba(255, 255, 255, 0.02)" }}
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-amber-500/0 via-amber-500/5 to-amber-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                                <div className="flex items-center gap-3 relative z-10">
                                    {(isGenerating || isRefGenerating) ? (
                                        <Loader2 size={14} className="animate-spin text-amber-400" />
                                    ) : (
                                        <Sparkles size={14} className="text-amber-400 group-hover:scale-110 transition-transform" />
                                    )}
                                    <span className={`text-[11px] font-bold uppercase tracking-[1.5px] ${(isGenerating || isRefGenerating) ? "text-amber-400" : "text-white/80 group-hover:text-white"}`}>
                                        {(isGenerating || isRefGenerating) ? "Generating..." : (hasImage ? "Regenerate" : "Generate Reference")}
                                    </span>
                                </div>
                            </button>

                            {/* Upload Custom */}
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isUploading}
                                className="flex items-center gap-2 px-4 py-3.5 rounded-xl transition-all cursor-pointer border border-white/[0.05] hover:border-white/[0.15] bg-white/[0.02] hover:bg-white/[0.04] disabled:cursor-not-allowed"
                            >
                                {isUploading ? (
                                    <Loader2 size={14} className="animate-spin text-white/60" />
                                ) : (
                                    <Upload size={14} className="text-white/50" />
                                )}
                                <span className="text-[11px] font-bold uppercase tracking-[1.5px] text-white/60">
                                    {isUploading ? "Uploading..." : "Upload"}
                                </span>
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleFileChange}
                                className="hidden"
                            />
                        </div>
                    </div>

                    {/* Body — Style Reference Preview + Text Fields */}
                    <div
                        className="flex-1 overflow-y-auto px-8 py-6 space-y-5"
                        style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.1) transparent" }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={handleDrop}
                    >
                        {/* Mini preview tile (if image exists) */}
                        {hasImage && (
                            <div className="relative rounded-xl overflow-hidden border border-white/[0.06] group">
                                <img
                                    src={styleRefUrl}
                                    alt="Style reference"
                                    className="w-full h-32 object-cover"
                                    style={{
                                        filter: isStale ? "blur(3px) grayscale(0.4)" : "none",
                                        transition: "filter 0.4s ease",
                                    }}
                                />
                                {isStale && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                                        <div className="flex items-center gap-2 text-amber-400 text-[10px] font-bold uppercase tracking-wider">
                                            <AlertTriangle size={12} />
                                            Out of sync
                                        </div>
                                    </div>
                                )}
                                {isReady && (
                                    <div className="absolute top-2 right-2">
                                        <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Drop zone hint (when no image) */}
                        {!hasImage && !isRefGenerating && (
                            <div
                                className="rounded-xl border-2 border-dashed border-white/[0.06] hover:border-amber-500/30 transition-colors p-8 text-center cursor-pointer"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <Camera size={28} className="text-white/10 mx-auto mb-3" />
                                <div className="text-[11px] text-white/30 mb-1">
                                    Drop a reference image here or click to upload
                                </div>
                                <div className="text-[9px] text-white/15 font-mono">
                                    Or use &quot;Generate Reference&quot; for AI concept art
                                </div>
                            </div>
                        )}

                        {/* Divider */}
                        <div className="flex items-center gap-3 pt-1">
                            <div className="h-px flex-1 bg-white/[0.04]" />
                            <span className="text-[8px] font-mono text-white/20 uppercase tracking-[3px]">Scene Directives</span>
                            <div className="h-px flex-1 bg-white/[0.04]" />
                        </div>

                        {/* Text fields */}
                        {fields.map(({ key, label, icon: Icon, value, setter, placeholder, rows }) => (
                            <div key={key} className="bg-white/[0.015] rounded-2xl p-4 border border-white/[0.03] hover:border-white/[0.08] transition-colors">
                                <div className="flex items-center gap-3 mb-2 pb-2 border-b border-white/[0.02]">
                                    <Icon size={12} className="text-amber-500/50" />
                                    <div>
                                        <div className="text-[11px] font-bold text-white/80 uppercase tracking-widest">{label}</div>
                                    </div>
                                </div>
                                <textarea
                                    value={value}
                                    onChange={(e) => setter(e.target.value)}
                                    placeholder={placeholder}
                                    rows={rows}
                                    className="w-full bg-transparent text-[13px] text-white/80 focus:outline-none resize-none placeholder:text-white/10 leading-relaxed font-sans"
                                />
                            </div>
                        ))}
                    </div>

                    {/* Footer */}
                    <div className="px-8 py-5 shrink-0 flex items-center justify-between border-t border-white/[0.03] bg-black/20">
                        <div className="text-[9px] font-mono text-white/20 uppercase tracking-wider">
                            {isDirty ? "Unsaved changes" : hasImage && isReady ? "Reference active" : ""}
                        </div>
                        <button
                            onClick={handleSave}
                            disabled={!isDirty || isSaving}
                            className="flex items-center gap-3 px-8 py-3.5 bg-amber-600 hover:bg-amber-500 text-white transition-all cursor-pointer rounded-xl disabled:opacity-40 disabled:cursor-not-allowed"
                            style={{ boxShadow: isDirty ? "0 0 30px rgba(251, 191, 36, 0.3)" : "0 0 15px rgba(251, 191, 36, 0.1)" }}
                        >
                            {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                            <span className="text-[11px] font-bold uppercase tracking-[2px]">
                                {isSaving ? "Saving..." : "Save Directives"}
                            </span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
