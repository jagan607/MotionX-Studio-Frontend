"use client";

import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    X, Camera, Upload, Loader2, CheckCircle, Move,
    Clapperboard, ImagePlus, Type, Sparkles, SlidersHorizontal,
    ChevronDown, ChevronUp, Eye, Palette, History, RotateCcw
} from "lucide-react";
import { toast } from "react-hot-toast";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { generateShotImage, motionTransfer, videoEdit, uploadMotionRefVideo, revertVideo } from "@/lib/api";
import { TimelineClip } from "@/lib/types/postprod";

// ═══════════════════════════════════════════════════════════
//   SHOT INSPECTOR — LOOK DEVELOPMENT (v5)
//   Cinema-grade per-shot look dev panel
//   Reference → Prompt → Quick Look → Intensity → Apply
// ═══════════════════════════════════════════════════════════

interface ShotInspectorProps {
    clip: TimelineClip;
    projectId: string;
    episodeId: string;
    onClose: () => void;
    onProcessingStart?: (clipId: string) => void;
}

// Quick looks — Seedance 2.0 V2V re-grading prompts
// Each prompt is a natural-language lighting/grading instruction per the Seedance prompt guide:
// Style = [Visual anchor] + [Lighting] + [Color treatment]
const QUICK_LOOKS = [
    { label: "Natural",       key: "natural",          prompt: "Re-grade this video with natural balanced daylight. Soft diffused sunlight from above, even exposure across highlights and shadows, true-to-life colors with neutral white balance at 5600K. Clean, ungraded look." },
    { label: "Golden Hour",   key: "golden_hour",      prompt: "Re-grade this video with warm golden hour lighting. Strong warm backlight at 3200K casting long amber shadows, golden lens flares streaking across the frame, skin tones glow warmly, deep orange and yellow color grading." },
    { label: "Blue Hour",     key: "blue_hour",        prompt: "Re-grade this video with cool blue twilight atmosphere. Desaturated palette with deep blue color cast at 7500K, muted tones, soft diffused ambient light from an overcast evening sky, shadows shift toward deep navy." },
    { label: "Neon Noir",     key: "neon",             prompt: "Re-grade this video with neon-lit noir atmosphere. Saturated pools of pink, cyan, and purple neon light reflecting off wet surfaces, deep black shadows, high contrast, urban night mood with vivid color separation." },
    { label: "High Key",      key: "high_key",         prompt: "Re-grade this video with high-key flat lighting. Bright, airy, and evenly lit from multiple soft sources, minimal shadow depth, slightly overexposed highlights, clean white tones with a fashion-editorial feel." },
    { label: "Low Key",       key: "low_key",          prompt: "Re-grade this video with low-key chiaroscuro lighting. Single hard directional light source from one side, deep impenetrable shadows consuming most of the frame, extreme contrast ratio, film noir mood." },
    { label: "Silhouette",    key: "silhouette",       prompt: "Re-grade this video with strong backlight creating full silhouette. Subject rendered as pure dark shape against a bright luminous background, rim light outlining edges, no fill light on the front, dramatic and graphic." },
    { label: "Side Light",    key: "side_light",       prompt: "Re-grade this video with hard dramatic side lighting. A single strong light source at 90 degrees illuminates one half of the subject while the other half falls into deep shadow, Rembrandt lighting triangle visible on the cheek." },
    { label: "Candlelight",   key: "candlelight",      prompt: "Re-grade this video with warm candlelight at 1800K. Deep amber and burnt orange tones, intimate flickering light with soft dancing shadows, heavy vignette, warm skin tones, darkness surrounding the subject." },
    { label: "Overcast",      key: "overcast",         prompt: "Re-grade this video with soft overcast diffused lighting. No harsh shadows or directional light, muted desaturated colors, flat even illumination as through heavy clouds, contemplative and quiet mood." },
    { label: "Teal & Orange", key: "teal_orange",      prompt: "Re-grade this video with teal and orange complementary color grading. Push shadows and midtones toward cool teal, warm the highlights and skin tones toward deep orange, high contrast blockbuster cinema look." },
    { label: "Bleach Bypass", key: "bleach_bypass",     prompt: "Re-grade this video with bleach bypass processing. Heavily desaturated with metallic silver tones, high contrast with crushed blacks and blown highlights, gritty and unsettling texture, reminiscent of Saving Private Ryan." },
    { label: "Day for Night", key: "day_for_night",     prompt: "Re-grade this video as day-for-night. Deep blue tint simulating moonlight, crushed black levels, desaturated colors, cool 8000K color temperature, artificial moonlit atmosphere with visible stars implied." },
    { label: "Vintage Film",  key: "vintage_film",      prompt: "Re-grade this video with vintage 35mm film stock aesthetic. Subtle film grain texture, faded lifted black levels, warm color shift toward amber, gentle halation around highlights, slightly soft focus edges." },
    { label: "Deakins",       key: "deakins",           prompt: "Re-grade this video in a Roger Deakins naturalistic cinematography style. Precisely motivated light sources that feel organic, controlled contrast with detail preserved in shadows, naturalistic color palette, every light source justified by the scene." },
    { label: "Cyberpunk",     key: "cyberpunk",         prompt: "Re-grade this video with cyberpunk neon aesthetic. Vibrant magenta and cyan color palette, holographic reflections on surfaces, rain-soaked wet-look textures catching colored light, dark background with explosive neon accents." },
];

type ProviderOption = "kling" | "seedance-2";

export default function ShotInspector({ clip, projectId, episodeId, onClose, onProcessingStart }: ShotInspectorProps) {
    // Look Development state
    const [lookPrompt, setLookPrompt] = useState("");
    const [selectedQuickLook, setSelectedQuickLook] = useState<string | null>(null);
    const [referenceImageUrl, setReferenceImageUrl] = useState<string | null>(null);
    const [referenceImageName, setReferenceImageName] = useState("");
    const [isUploadingRef, setIsUploadingRef] = useState(false);
    const [isDraggingRef, setIsDraggingRef] = useState(false);
    const [intensity, setIntensity] = useState(80);
    const refImageInputRef = useRef<HTMLInputElement>(null);

    // Processing
    const [isProcessing, setIsProcessing] = useState(false);
    const [isReverting, setIsReverting] = useState(false);
    const [processingAction, setProcessingAction] = useState<string>("");

    // Motion Transfer (advanced section)
    const [showMotionSection, setShowMotionSection] = useState(false);
    const [motionProvider, setMotionProvider] = useState<ProviderOption>("kling");
    const [refVideoUrl, setRefVideoUrl] = useState("");
    const [refVideoName, setRefVideoName] = useState("");
    const [isUploadingVideo, setIsUploadingVideo] = useState(false);
    const [isDraggingVideo, setIsDraggingVideo] = useState(false);
    const [motionDirection, setMotionDirection] = useState<"video" | "image">("video");
    const [klingVersion, setKlingVersion] = useState<"2.6" | "3.0">("2.6");
    const [motionPrompt, setMotionPrompt] = useState("");
    const videoInputRef = useRef<HTMLInputElement>(null);

    // ── REFERENCE IMAGE UPLOAD ──
    const handleRefImageUpload = async (file: File) => {
        if (!file.type.startsWith("image/")) {
            toast.error("Please select an image file");
            return;
        }
        if (file.size > 20 * 1024 * 1024) {
            toast.error("Image must be under 20MB");
            return;
        }
        setIsUploadingRef(true);
        setReferenceImageName(file.name);
        try {
            const storageRef = ref(
                storage,
                `projects/${projectId}/postprod/look_refs/${Date.now()}_${file.name}`
            );
            const snapshot = await uploadBytes(storageRef, file);
            const url = await getDownloadURL(snapshot.ref);
            setReferenceImageUrl(url);
            toast.success("Reference uploaded");
        } catch (e) {
            console.error("Upload failed:", e);
            toast.error("Failed to upload reference");
            setReferenceImageName("");
        } finally {
            setIsUploadingRef(false);
        }
    };

    // ── MOTION REF VIDEO UPLOAD ──
    const handleRefVideoUpload = async (file: File) => {
        if (!file.type.startsWith("video/")) {
            toast.error("Please select a video file");
            return;
        }
        if (file.size > 100 * 1024 * 1024) {
            toast.error("Video must be under 100MB");
            return;
        }
        setIsUploadingVideo(true);
        setRefVideoName(file.name);
        try {
            const url = await uploadMotionRefVideo(projectId, file);
            setRefVideoUrl(url);
            toast.success("Reference video uploaded");
        } catch (e) {
            console.error("Upload failed:", e);
            toast.error("Failed to upload reference video");
            setRefVideoName("");
        } finally {
            setIsUploadingVideo(false);
        }
    };

    // ── BUILD FINAL LOOK PROMPT ──
    // Follows Seedance 2.0 prompting best practices:
    // - Natural descriptive sentences (not keyword lists)
    // - @imageN tags handled by backend worker (auto-injected if missing)
    // - Intensity-aware language
    const buildLookPrompt = (): string => {
        const parts: string[] = [];
        const hasRef = !!referenceImageUrl;

        // Quick look base (if selected)
        const quickLook = QUICK_LOOKS.find(q => q.key === selectedQuickLook);
        if (quickLook) {
            parts.push(quickLook.prompt);
        }

        // User's custom description (highest priority — overrides quick look details)
        if (lookPrompt.trim()) {
            parts.push(lookPrompt.trim());
        }

        // If user provided a reference but no text, send a minimal creative-intent prompt.
        // The backend worker handles @image tagging and extraction details — no need to duplicate here.
        if (parts.length === 0 && hasRef) {
            parts.push("Match the look of the reference");
        }

        // If absolutely nothing is set (shouldn't happen — button is disabled)
        if (parts.length === 0) {
            parts.push("Enhance the cinematic quality of this video while preserving the original action and framing");
        }

        // Intensity modulation — described naturally
        if (intensity < 30) {
            parts.push("Apply the changes very subtly, keeping the video mostly in its original look");
        } else if (intensity < 50) {
            parts.push("Apply the changes with light touch, blending with the original look");
        } else if (intensity > 90) {
            parts.push("Apply the changes boldly and dramatically, fully committing to the new look");
        }

        return parts.join(". ") + ".";
    };

    // ── APPLY LOOK ──
    const handleApplyLook = async () => {
        if (!clip.videoUrl) {
            toast.error("This clip has no video — generate one first");
            return;
        }

        setIsProcessing(true);
        setProcessingAction("look");
        onProcessingStart?.(clip.id);
        try {
            const prompt = buildLookPrompt();
            const refUrls = referenceImageUrl ? [referenceImageUrl] : [];

            await videoEdit(
                projectId,
                episodeId,
                clip.sceneId,
                clip.shotId,
                clip.videoUrl,
                prompt,
                "seedance-2",
                undefined,
                "5",
                "16:9",
                refUrls,
                clip.trimIn || undefined,
                clip.trimOut || undefined,
            );
            toast.success("Look applied — rendering via Seedance V2V");
        } catch (e: any) {
            console.error("Look application failed:", e);
            toast.error(e?.response?.data?.detail || "Look application failed");
        } finally {
            setIsProcessing(false);
            setProcessingAction("");
        }
    };

    // ── MOTION TRANSFER ──
    const handleMotionTransfer = async () => {
        if (!refVideoUrl) {
            toast.error("Upload a reference video first");
            return;
        }
        if (!clip.thumbnailUrl) {
            toast.error("This clip has no image to animate");
            return;
        }

        setIsProcessing(true);
        setProcessingAction("motion");
        onProcessingStart?.(clip.id);
        try {
            await motionTransfer(
                projectId, episodeId, clip.sceneId, clip.shotId,
                clip.thumbnailUrl, refVideoUrl,
                motionPrompt.trim(), motionProvider, motionDirection, klingVersion,
            );
            toast.success(`Motion transfer queued (${motionProvider === "kling" ? "Kling" : "Seedance 2.0"})`);
        } catch (e: any) {
            console.error("Motion transfer failed:", e);
            toast.error(e?.response?.data?.detail || "Motion transfer failed");
        } finally {
            setIsProcessing(false);
            setProcessingAction("");
        }
    };

    // Whether user has set any look direction
    const hasLookInput = !!lookPrompt.trim() || !!selectedQuickLook || !!referenceImageUrl;

    return (
        <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: "100%", opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="h-full border-l border-[#1a1a1a] bg-[#060606] flex flex-col overflow-hidden shrink-0"
        >
            {/* ═══ HEADER — Film strip accent ═══ */}
            <div className="px-4 py-3 border-b border-[#1a1a1a] flex items-center justify-between shrink-0 relative overflow-hidden">
                {/* Film sprocket holes */}
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#E50914]/30 to-transparent" />
                <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded bg-[#E50914]/10 flex items-center justify-center">
                        <Eye size={10} className="text-[#E50914]" />
                    </div>
                    <div>
                        <span className="text-[10px] font-bold tracking-[3px] text-white uppercase block leading-none">
                            Look Dev
                        </span>
                        <span className="text-[6px] text-neutral-600 tracking-[2px] uppercase">
                            Per-Shot Color & Light
                        </span>
                    </div>
                </div>
                <button onClick={onClose} className="p-1 rounded hover:bg-[#1a1a1a] text-neutral-500 transition-colors">
                    <X size={13} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">

                {/* ═══ SHOT PREVIEW ═══ */}
                <div className="p-3 border-b border-[#111]">
                    <div className="aspect-video rounded-md overflow-hidden bg-[#0a0a0a] border border-[#151515] relative group">
                        {clip.thumbnailUrl ? (
                            <img src={clip.thumbnailUrl} alt={clip.label} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-neutral-700">
                                <Camera size={24} />
                            </div>
                        )}
                        {/* Film frame overlay */}
                        <div className="absolute inset-0 pointer-events-none border border-white/[0.03] rounded-md" />
                        {/* Status badge */}
                        <div className="absolute bottom-1.5 right-1.5">
                            {clip.videoStatus === "animating" ? (
                                <span className="px-1.5 py-0.5 bg-amber-500/20 border border-amber-500/30 rounded text-[6px] text-amber-400 font-bold tracking-wider animate-pulse">
                                    RENDERING
                                </span>
                            ) : clip.videoStatus === "error" ? (
                                <span className="px-1.5 py-0.5 bg-red-500/20 border border-red-500/30 rounded text-[6px] text-red-400 font-bold tracking-wider" title={clip.errorMessage}>
                                    FAILED
                                </span>
                            ) : clip.videoUrl ? (
                                <span className="px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded text-[6px] text-emerald-500 font-bold tracking-wider">
                                    READY
                                </span>
                            ) : (
                                <span className="px-1.5 py-0.5 bg-neutral-800/80 border border-neutral-700/30 rounded text-[6px] text-neutral-500 font-bold tracking-wider">
                                    NO VIDEO
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between">
                        <span className="text-[8px] font-bold text-neutral-500 tracking-[2px] uppercase truncate">
                            {clip.label}
                        </span>
                        <span className="text-[7px] text-neutral-700 font-mono">
                            {clip.duration.toFixed(1)}s
                        </span>
                    </div>

                    {/* Error Banner — visible, not just a tooltip */}
                    {clip.videoStatus === "error" && clip.errorMessage && (
                        <div className="mt-2 px-2.5 py-2 bg-red-500/8 border border-red-500/20 rounded-md">
                            <div className="flex items-start gap-1.5">
                                <span className="text-red-400 text-[10px] mt-0.5">⚠</span>
                                <div>
                                    <p className="text-[8px] text-red-400 font-medium leading-relaxed">
                                        {clip.errorMessage}
                                    </p>
                                    <p className="text-[6px] text-red-400/50 mt-0.5 tracking-wider">
                                        Credits refunded · Try again with different settings
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* ═══ VERSION HISTORY ═══ */}
                {clip.videoUrl && (() => {
                    // Build unified version list — always include the current videoUrl
                    const rawHistory = clip.videoHistory || [];
                    const historyUrls = new Set(rawHistory.map(h => h.url));

                    // If current videoUrl isn't in history (legacy clips), add it as "Current"
                    const versions = historyUrls.has(clip.videoUrl)
                        ? rawHistory
                        : [{ url: clip.videoUrl, provider: undefined, mode: undefined, prompt: undefined, created_at: undefined, task_id: undefined }, ...rawHistory];

                    return (
                        <div className="px-4 py-3 border-b border-[#111]">
                            <div className="flex items-center gap-1.5 mb-2">
                                <History size={10} className="text-neutral-500" />
                                <span className="text-[8px] font-bold text-neutral-400 tracking-[2px] uppercase">
                                    Version History
                                </span>
                                <span className="text-[7px] text-neutral-600 ml-auto">
                                    {versions.length} version{versions.length > 1 ? 's' : ''}
                                </span>
                            </div>

                            <div className="space-y-1">
                                {[...versions].reverse().map((version, idx) => {
                                    const isActive = version.url === clip.videoUrl;
                                    const isOriginal = idx === versions.length - 1;
                                    const providerLabel = isOriginal
                                        ? 'Original'
                                        : version.provider === 'seedance-2' ? 'Seedance V2V'
                                        : version.provider === 'kling' ? 'Kling'
                                        : version.provider || 'Edit';
                                    const displayLabel = versions.length === 1 ? 'Current Version' : providerLabel;
                                    const timeStr = version.created_at
                                        ? new Date(version.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                        : '';

                                    return (
                                        <button
                                            key={version.task_id || version.url}
                                            onClick={async () => {
                                                if (isActive || isReverting) return;
                                                setIsReverting(true);
                                                try {
                                                    await revertVideo(
                                                        projectId,
                                                        episodeId,
                                                        clip.sceneId,
                                                        clip.shotId,
                                                        version.url,
                                                    );
                                                    toast.success(isOriginal ? 'Reverted to original' : `Switched to ${providerLabel} version`);
                                                } catch (e: any) {
                                                    toast.error(e?.response?.data?.detail || 'Revert failed');
                                                } finally {
                                                    setIsReverting(false);
                                                }
                                            }}
                                            disabled={isActive || isReverting}
                                            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md transition-all text-left ${
                                                isActive
                                                    ? 'bg-[#E50914]/10 border border-[#E50914]/30'
                                                    : 'bg-[#0a0a0a] border border-[#151515] hover:border-neutral-600 cursor-pointer'
                                            }`}
                                        >
                                            {/* Version indicator */}
                                            <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                                                isActive ? 'bg-[#E50914]/20' : 'bg-[#111]'
                                            }`}>
                                                {isActive ? (
                                                    <CheckCircle size={10} className="text-[#E50914]" />
                                                ) : isOriginal ? (
                                                    <span className="text-[7px] text-neutral-600 font-bold">OG</span>
                                                ) : (
                                                    <RotateCcw size={8} className="text-neutral-600" />
                                                )}
                                            </div>

                                            {/* Version info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <span className={`text-[9px] font-bold truncate ${
                                                        isActive ? 'text-[#E50914]' : 'text-neutral-400'
                                                    }`}>
                                                        {displayLabel}
                                                    </span>
                                                    {isActive && (
                                                        <span className="text-[6px] text-[#E50914]/60 tracking-wider font-bold uppercase">Active</span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    {timeStr && (
                                                        <span className="text-[7px] text-neutral-600 font-mono">{timeStr}</span>
                                                    )}
                                                    {version.prompt && (
                                                        <span className="text-[7px] text-neutral-700 truncate" title={version.prompt}>
                                                            · {version.prompt.slice(0, 30)}{version.prompt.length > 30 ? '…' : ''}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })()}


                {/* ═══ 1. REFERENCE IMAGE ═══ */}
                <div className="px-4 py-3 border-b border-[#111]">
                    <SectionHeader icon={<ImagePlus size={10} />} label="Reference" sublabel="Upload a still, frame, or painting as your target look" />

                    <input
                        ref={refImageInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleRefImageUpload(file);
                            e.target.value = "";
                        }}
                    />

                    {referenceImageUrl ? (
                        <div className="relative group rounded-md overflow-hidden border border-[#1a1a1a]">
                            <img src={referenceImageUrl} alt="Reference" className="w-full aspect-[2.35/1] object-cover" />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                <button
                                    onClick={() => refImageInputRef.current?.click()}
                                    className="px-2 py-1 bg-white/10 border border-white/20 rounded text-[7px] text-white tracking-wider uppercase hover:bg-white/20 transition-all"
                                >
                                    Replace
                                </button>
                                <button
                                    onClick={() => { setReferenceImageUrl(null); setReferenceImageName(""); }}
                                    className="px-2 py-1 bg-red-500/20 border border-red-500/30 rounded text-[7px] text-red-400 tracking-wider uppercase hover:bg-red-500/30 transition-all"
                                >
                                    Remove
                                </button>
                            </div>
                            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1">
                                <span className="text-[6px] text-white/60 tracking-wider truncate block">
                                    {referenceImageName || "Reference image"}
                                </span>
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={() => refImageInputRef.current?.click()}
                            disabled={isUploadingRef}
                            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingRef(true); }}
                            onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingRef(false); }}
                            onDrop={(e) => {
                                e.preventDefault(); e.stopPropagation(); setIsDraggingRef(false);
                                const file = e.dataTransfer.files?.[0];
                                if (file) handleRefImageUpload(file);
                            }}
                            className={`w-full rounded-md border border-dashed transition-all ${
                                isDraggingRef
                                    ? "border-[#E50914]/60 bg-[#E50914]/5"
                                    : "border-[#222] hover:border-[#444] bg-[#0a0a0a]"
                            }`}
                        >
                            <div className="py-4 flex flex-col items-center gap-1.5">
                                {isUploadingRef ? (
                                    <>
                                        <Loader2 size={14} className="animate-spin text-[#E50914]" />
                                        <span className="text-[7px] text-neutral-400 tracking-wider">Uploading...</span>
                                    </>
                                ) : (
                                    <>
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                                            isDraggingRef ? "bg-[#E50914]/10" : "bg-[#111]"
                                        }`}>
                                            <ImagePlus size={14} className={isDraggingRef ? "text-[#E50914]" : "text-neutral-600"} />
                                        </div>
                                        <span className={`text-[8px] font-medium tracking-wider ${
                                            isDraggingRef ? "text-[#E50914]" : "text-neutral-500"
                                        }`}>
                                            {isDraggingRef ? "Drop reference here" : "Drop a reference frame"}
                                        </span>
                                        <span className="text-[6px] text-neutral-700 tracking-wider">
                                            Film stills · Photos · Paintings · Any visual reference
                                        </span>
                                    </>
                                )}
                            </div>
                        </button>
                    )}
                </div>


                {/* ═══ 2. DESCRIBE THE LOOK ═══ */}
                <div className="px-4 py-3 border-b border-[#111]">
                    <SectionHeader icon={<Type size={10} />} label="Describe the Look" sublabel="Tell the colorist what you want" />

                    <div className="relative">
                        <textarea
                            value={lookPrompt}
                            onChange={(e) => { setLookPrompt(e.target.value); setSelectedQuickLook(null); }}
                            placeholder={`"Pull shadows cooler, add warm rim light"\n"Match the interrogation scene from Se7en"\n"Desaturate everything except the red dress"`}
                            className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-md px-3 py-2.5 text-[9px] text-white placeholder:text-neutral-700 resize-none focus:outline-none focus:border-[#E50914]/40 leading-relaxed transition-colors"
                            rows={3}
                        />
                        {lookPrompt && (
                            <button
                                onClick={() => setLookPrompt("")}
                                className="absolute top-2 right-2 p-0.5 rounded bg-[#1a1a1a] hover:bg-[#333] text-neutral-600 hover:text-white transition-all"
                            >
                                <X size={8} />
                            </button>
                        )}
                    </div>
                </div>


                {/* ═══ 3. QUICK LOOKS ═══ */}
                <div className="px-4 py-3 border-b border-[#111]">
                    <SectionHeader icon={<Palette size={10} />} label="Quick Looks" sublabel="Starting points — customize with your own prompt" />

                    <div className="flex flex-wrap gap-1">
                        {QUICK_LOOKS.map((look) => (
                            <button
                                key={look.key}
                                onClick={() => {
                                    if (selectedQuickLook === look.key) {
                                        setSelectedQuickLook(null);
                                    } else {
                                        setSelectedQuickLook(look.key);
                                        setLookPrompt("");
                                    }
                                }}
                                className={`px-2 py-1 rounded-full text-[7px] font-medium tracking-wider transition-all whitespace-nowrap ${
                                    selectedQuickLook === look.key
                                        ? "bg-[#E50914]/15 text-[#E50914] border border-[#E50914]/40 shadow-[0_0_8px_rgba(229,9,20,0.15)]"
                                        : "bg-[#0e0e0e] text-neutral-500 border border-[#1a1a1a] hover:border-[#333] hover:text-neutral-300"
                                }`}
                                title={look.prompt}
                            >
                                {look.label}
                            </button>
                        ))}
                    </div>

                    {/* Show selected look description */}
                    <AnimatePresence>
                        {selectedQuickLook && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                            >
                                <p className="mt-2 text-[7px] text-neutral-600 italic leading-relaxed bg-[#0a0a0a] rounded px-2.5 py-1.5 border border-[#111]">
                                    {QUICK_LOOKS.find(q => q.key === selectedQuickLook)?.prompt}
                                </p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>


                {/* ═══ 4. INTENSITY ═══ */}
                <div className="px-4 py-3 border-b border-[#111]">
                    <SectionHeader icon={<SlidersHorizontal size={10} />} label="Intensity" sublabel={`${intensity}% — How strongly to apply the look`} />

                    <div className="flex items-center gap-3">
                        <span className="text-[7px] text-neutral-700 font-mono w-6 text-right">SUB</span>
                        <div className="flex-1 relative">
                            <input
                                type="range"
                                min={10}
                                max={100}
                                value={intensity}
                                onChange={(e) => setIntensity(Number(e.target.value))}
                                className="w-full h-1 bg-[#1a1a1a] rounded-full appearance-none cursor-pointer
                                    [&::-webkit-slider-thumb]:appearance-none
                                    [&::-webkit-slider-thumb]:w-3
                                    [&::-webkit-slider-thumb]:h-3
                                    [&::-webkit-slider-thumb]:rounded-full
                                    [&::-webkit-slider-thumb]:bg-[#E50914]
                                    [&::-webkit-slider-thumb]:shadow-[0_0_6px_rgba(229,9,20,0.4)]
                                    [&::-webkit-slider-thumb]:cursor-pointer
                                    [&::-webkit-slider-thumb]:transition-shadow
                                    [&::-webkit-slider-thumb]:hover:shadow-[0_0_10px_rgba(229,9,20,0.6)]"
                            />
                            {/* Track fill */}
                            <div
                                className="absolute top-[calc(50%-2px)] left-0 h-1 bg-gradient-to-r from-[#E50914]/60 to-[#E50914] rounded-full pointer-events-none"
                                style={{ width: `${((intensity - 10) / 90) * 100}%` }}
                            />
                        </div>
                        <span className="text-[7px] text-neutral-700 font-mono w-8">MAX</span>
                    </div>
                </div>


                {/* ═══ APPLY LOOK — Primary CTA ═══ */}
                <div className="px-4 py-3 border-b border-[#111]">
                    <button
                        onClick={handleApplyLook}
                        disabled={isProcessing || !clip.videoUrl || !hasLookInput}
                        className={`w-full py-2.5 rounded-md text-[9px] font-bold tracking-[3px] uppercase transition-all flex items-center justify-center gap-2 relative overflow-hidden ${
                            !clip.videoUrl
                                ? "bg-neutral-800 text-neutral-600 cursor-not-allowed"
                                : !hasLookInput
                                ? "bg-[#1a1a1a] text-neutral-500 border border-[#222]"
                                : "bg-[#E50914] text-white shadow-[0_0_20px_rgba(229,9,20,0.25)] hover:shadow-[0_0_30px_rgba(229,9,20,0.4)] hover:bg-[#ff1a25]"
                        } disabled:opacity-50`}
                    >
                        {isProcessing && processingAction === "look" ? (
                            <Loader2 size={11} className="animate-spin" />
                        ) : (
                            <Sparkles size={11} />
                        )}
                        {!clip.videoUrl
                            ? "NO VIDEO — GENERATE FIRST"
                            : !hasLookInput
                            ? "SET A LOOK TO APPLY"
                            : "APPLY LOOK"}
                    </button>
                    {hasLookInput && clip.videoUrl && (
                        <p className="text-[6px] text-neutral-700 text-center mt-1.5 tracking-wider">
                            Seedance V2V — motion preserved · ~2-5 min render
                        </p>
                    )}
                </div>


                {/* ═══ MOTION TRANSFER — Collapsible Advanced ═══ */}
                <div className="border-b border-[#111]">
                    <button
                        onClick={() => setShowMotionSection(!showMotionSection)}
                        className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-[#0a0a0a] transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <Move size={10} className="text-purple-500" />
                            <span className="text-[8px] font-bold text-neutral-400 tracking-[2px] uppercase">
                                Motion Transfer
                            </span>
                        </div>
                        {showMotionSection ? <ChevronUp size={10} className="text-neutral-600" /> : <ChevronDown size={10} className="text-neutral-600" />}
                    </button>

                    <AnimatePresence>
                        {showMotionSection && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                            >
                                <div className="px-4 pb-3 space-y-2">
                                    <p className="text-[7px] text-neutral-600 leading-relaxed">
                                        Transfer motion from a reference video onto this shot&apos;s character.
                                    </p>

                                    {/* Character Image (auto from shot) */}
                                    <div className="flex items-center gap-2 bg-[#0a0a0a] border border-[#151515] rounded-md px-2 py-1.5">
                                        {clip.thumbnailUrl ? (
                                            <>
                                                <img src={clip.thumbnailUrl} alt="character" className="w-7 h-7 rounded object-cover" />
                                                <div>
                                                    <span className="text-[7px] text-emerald-500 flex items-center gap-1">
                                                        <CheckCircle size={7} /> Character detected
                                                    </span>
                                                    <span className="text-[6px] text-neutral-700 block">From shot frame</span>
                                                </div>
                                            </>
                                        ) : (
                                            <span className="text-[7px] text-red-500">No image — generate shot first</span>
                                        )}
                                    </div>

                                    {/* Reference Video Upload */}
                                    <input
                                        ref={videoInputRef}
                                        type="file"
                                        accept="video/*"
                                        className="hidden"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) handleRefVideoUpload(file);
                                            e.target.value = "";
                                        }}
                                    />
                                    <button
                                        onClick={() => videoInputRef.current?.click()}
                                        disabled={isUploadingVideo}
                                        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingVideo(true); }}
                                        onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingVideo(false); }}
                                        onDrop={(e) => {
                                            e.preventDefault(); e.stopPropagation(); setIsDraggingVideo(false);
                                            const file = e.dataTransfer.files?.[0];
                                            if (file) handleRefVideoUpload(file);
                                        }}
                                        className={`w-full bg-[#0a0a0a] border border-dashed rounded-md px-2 py-3 text-center transition-all disabled:opacity-50 ${
                                            isDraggingVideo
                                                ? "border-purple-500 bg-purple-500/5"
                                                : "border-[#222] hover:border-purple-500/40"
                                        }`}
                                    >
                                        {isUploadingVideo ? (
                                            <div className="flex items-center justify-center gap-1.5">
                                                <Loader2 size={10} className="animate-spin text-purple-400" />
                                                <span className="text-[7px] text-purple-400 tracking-wider">Uploading...</span>
                                            </div>
                                        ) : refVideoUrl ? (
                                            <div className="flex items-center justify-center gap-1.5">
                                                <CheckCircle size={10} className="text-emerald-500" />
                                                <span className="text-[7px] text-emerald-500 truncate max-w-[180px]">
                                                    {refVideoName || "Video uploaded"}
                                                </span>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center gap-1">
                                                <Upload size={12} className={isDraggingVideo ? "text-purple-400" : "text-neutral-600"} />
                                                <span className="text-[7px] text-neutral-500 tracking-wider">
                                                    Drop reference motion video
                                                </span>
                                                <span className="text-[6px] text-neutral-700">.mp4 · Max 100MB</span>
                                            </div>
                                        )}
                                    </button>

                                    {/* Motion Prompt */}
                                    <textarea
                                        value={motionPrompt}
                                        onChange={(e) => setMotionPrompt(e.target.value)}
                                        placeholder='Scene context: "A dancer on a dimly lit stage"'
                                        className="w-full bg-[#0a0a0a] border border-[#151515] rounded-md px-2.5 py-2 text-[8px] text-white placeholder:text-neutral-700 resize-none focus:outline-none focus:border-purple-500/40 transition-colors"
                                        rows={2}
                                    />

                                    {/* Provider Toggle */}
                                    <div className="flex gap-1">
                                        {(["kling", "seedance-2"] as const).map((p) => (
                                            <button
                                                key={p}
                                                onClick={() => setMotionProvider(p)}
                                                className={`flex-1 py-1.5 rounded-md text-[7px] font-bold tracking-[1px] uppercase transition-all border ${
                                                    motionProvider === p
                                                        ? "bg-purple-600/15 text-purple-400 border-purple-500/30"
                                                        : "bg-[#0a0a0a] text-neutral-600 border-[#151515] hover:border-[#333]"
                                                }`}
                                            >
                                                {p === "kling" ? "Kling" : "Seedance 2.0"}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-[6px] text-neutral-700 italic">
                                        {motionProvider === "kling" ? "Motion Control — maps pose from ref video" : "V2V — blends motion with prompt"}
                                    </p>

                                    {/* Kling-specific options */}
                                    {motionProvider === "kling" && (
                                        <div className="flex gap-1">
                                            {(["video", "image"] as const).map((o) => (
                                                <button
                                                    key={o}
                                                    onClick={() => setMotionDirection(o)}
                                                    className={`flex-1 py-1 rounded-md text-[6px] font-bold tracking-[1px] uppercase transition-all border ${
                                                        motionDirection === o
                                                            ? "bg-purple-600/15 text-purple-400 border-purple-500/30"
                                                            : "bg-[#0a0a0a] text-neutral-600 border-[#151515]"
                                                    }`}
                                                >
                                                    {o === "video" ? "Match Video (30s)" : "Keep Image (10s)"}
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {/* Apply Motion */}
                                    <button
                                        onClick={handleMotionTransfer}
                                        disabled={isProcessing || !refVideoUrl || !clip.thumbnailUrl}
                                        className="w-full py-2 rounded-md bg-purple-600/15 border border-purple-500/30 text-[8px] text-purple-400 font-bold tracking-[2px] uppercase hover:bg-purple-600/25 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                                    >
                                        {isProcessing && processingAction === "motion" ? (
                                            <Loader2 size={10} className="animate-spin" />
                                        ) : (
                                            <Move size={10} />
                                        )}
                                        APPLY MOTION
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

            </div>
        </motion.div>
    );
}


// ── Section Header ──
function SectionHeader({ icon, label, sublabel }: { icon: React.ReactNode; label: string; sublabel?: string }) {
    return (
        <div className="flex items-start gap-1.5 mb-2">
            <span className="text-neutral-600 mt-0.5">{icon}</span>
            <div>
                <span className="text-[8px] font-bold text-neutral-400 tracking-[2px] uppercase block leading-none">
                    {label}
                </span>
                {sublabel && (
                    <span className="text-[6px] text-neutral-700 tracking-wider block mt-0.5">
                        {sublabel}
                    </span>
                )}
            </div>
        </div>
    );
}
