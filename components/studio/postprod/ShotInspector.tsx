"use client";

import React, { useState, useRef } from "react";
import { motion } from "framer-motion";
import {
    X, Sun, Palette, Wand2, RotateCcw,
    Move, Clapperboard, Loader2, Lightbulb, Camera, Upload, CheckCircle
} from "lucide-react";
import { toast } from "react-hot-toast";
import { generateShotImage, motionTransfer, videoEdit, uploadMotionRefVideo } from "@/lib/api";
import { TimelineClip } from "@/lib/types/postprod";

// ═══════════════════════════════════════════════════════════
//   SHOT INSPECTOR (v4)
//   Dual Provider: Kling + Seedance for both features
// ═══════════════════════════════════════════════════════════

interface ShotInspectorProps {
    clip: TimelineClip;
    projectId: string;
    episodeId: string;
    onClose: () => void;
    onProcessingStart?: (clipId: string) => void;
}

const LIGHTING_PRESETS = [
    { name: "Natural", key: "natural", image: "https://firebasestorage.googleapis.com/v0/b/motionx-studio.firebasestorage.app/o/assets%2Flighting_presets%2Fnatural.png?alt=media&token=d15d7b5f-1363-40a9-8aa1-f9dc1abb73c0" },
    { name: "Golden Hour", key: "golden_hour", image: "https://firebasestorage.googleapis.com/v0/b/motionx-studio.firebasestorage.app/o/assets%2Flighting_presets%2Fgolden_hour.png?alt=media&token=dc1f0744-de7a-4bae-8eb6-1f6b67164d32" },
    { name: "Blue Hour", key: "blue_hour", image: "https://firebasestorage.googleapis.com/v0/b/motionx-studio.firebasestorage.app/o/assets%2Flighting_presets%2Fblue_hour.png?alt=media&token=361cdabb-b3de-4514-9379-8c9684deb157" },
    { name: "Neon", key: "neon", image: "https://firebasestorage.googleapis.com/v0/b/motionx-studio.firebasestorage.app/o/assets%2Flighting_presets%2Fneon.png?alt=media&token=5e2439cf-fc8a-4f57-8631-4e2ff048fa46" },
    { name: "High Key", key: "high_key", image: "https://firebasestorage.googleapis.com/v0/b/motionx-studio.firebasestorage.app/o/assets%2Flighting_presets%2Fhigh_key.png?alt=media&token=d3cfb9d6-24cd-4e6c-968d-b76555954c24" },
    { name: "Low Key", key: "low_key", image: "https://firebasestorage.googleapis.com/v0/b/motionx-studio.firebasestorage.app/o/assets%2Flighting_presets%2Flow_key.png?alt=media&token=307b3bf6-b660-4003-8087-d3ee13f11b2c" },
    { name: "Silhouette", key: "silhouette", image: "https://firebasestorage.googleapis.com/v0/b/motionx-studio.firebasestorage.app/o/assets%2Flighting_presets%2Fsilhouette.png?alt=media&token=98eb9738-63fa-4a9d-b255-4562320df60a" },
    { name: "Dramatic Side Light", key: "dramatic_side_light", image: "https://firebasestorage.googleapis.com/v0/b/motionx-studio.firebasestorage.app/o/assets%2Flighting_presets%2Fdramatic_side_light.png?alt=media&token=0268d5e5-656e-43c1-a76e-397e08a1a296" },
    { name: "Studio", key: "studio", image: "https://firebasestorage.googleapis.com/v0/b/motionx-studio.firebasestorage.app/o/assets%2Flighting_presets%2Fstudio.png?alt=media&token=7254e397-42d2-40af-9789-62ab3d67d4d3" },
    { name: "Candlelight", key: "candlelight", image: "https://firebasestorage.googleapis.com/v0/b/motionx-studio.firebasestorage.app/o/assets%2Flighting_presets%2Fcandlelight.png?alt=media&token=8ba40b07-ace2-4b34-8db2-0c5473404ec6" },
];

const MOODS = [
    "Neutral", "Dramatic", "Romantic", "Tense",
    "Mysterious", "Euphoric", "Melancholic",
    "Action", "Serene", "Horror"
];

type ProviderOption = "kling" | "seedance-2";

export default function ShotInspector({ clip, projectId, episodeId, onClose, onProcessingStart }: ShotInspectorProps) {
    const [lighting, setLighting] = useState(LIGHTING_PRESETS[0].name);
    const [mood, setMood] = useState(MOODS[0]);
    const [aiPrompt, setAiPrompt] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingAction, setProcessingAction] = useState<string>("");

    // Provider state (motion transfer only)
    const [motionProvider, setMotionProvider] = useState<ProviderOption>("kling");

    // Motion Transfer state
    const [refVideoUrl, setRefVideoUrl] = useState("");
    const [refVideoName, setRefVideoName] = useState("");
    const [isUploading, setIsUploading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [motionDirection, setMotionDirection] = useState<"video" | "image">("video");
    const [klingVersion, setKlingVersion] = useState<"2.6" | "3.0">("2.6");
    const [motionPrompt, setMotionPrompt] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleRefVideoUpload = async (file: File) => {
        if (!file.type.startsWith("video/")) {
            toast.error("Please select a video file");
            return;
        }
        if (file.size > 100 * 1024 * 1024) {
            toast.error("Video must be under 100MB");
            return;
        }
        setIsUploading(true);
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
            setIsUploading(false);
        }
    };

    const handleRegenerate = async () => {
        setIsProcessing(true);
        setProcessingAction("regenerate");
        try {
            const parts = [
                `Lighting: ${lighting}`,
                `Mood: ${mood}`,
            ];
            if (aiPrompt.trim()) parts.push(aiPrompt.trim());
            const fullPrompt = parts.join(". ") + ".";

            await generateShotImage(projectId, clip.shotId, fullPrompt, null, "gemini");
            toast.success("Shot regenerated with new settings");
        } catch (e) {
            console.error("Regeneration failed:", e);
            toast.error("Regeneration failed — check credits");
        } finally {
            setIsProcessing(false);
            setProcessingAction("");
        }
    };

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
            // Send motion prompt only if user typed one; otherwise empty = PiAPI defaults
            const prompt = motionPrompt.trim();

            await motionTransfer(
                projectId,
                episodeId,
                clip.sceneId,
                clip.shotId,
                clip.thumbnailUrl,     // Character image (auto from shot)
                refVideoUrl,           // Uploaded reference motion video
                prompt,
                motionProvider,
                motionDirection,
                klingVersion,
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

    const handleRelighting = async () => {
        if (!clip.videoUrl) {
            toast.error("This clip has no video — generate one first");
            return;
        }

        setIsProcessing(true);
        setProcessingAction("relight");
        onProcessingStart?.(clip.id);
        try {
            const relightPrompt = aiPrompt.trim()
                || `Change lighting to ${lighting}. Mood: ${mood}. Maintain original motion and composition.`;

            await videoEdit(
                projectId,
                episodeId,
                clip.sceneId,
                clip.shotId,
                clip.videoUrl,
                relightPrompt,
            );
            toast.success("Relighting queued (Seedance V2V)");
        } catch (e: any) {
            console.error("Relighting failed:", e);
            toast.error(e?.response?.data?.detail || "Relighting failed");
        } finally {
            setIsProcessing(false);
            setProcessingAction("");
        }
    };

    return (
        <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: "100%", opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="h-full border-l border-[#1a1a1a] bg-[#080808] flex flex-col overflow-hidden shrink-0"
        >
            {/* Header */}
            <div className="px-4 py-3 border-b border-[#1a1a1a] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                    <Clapperboard size={12} className="text-[#E50914]" />
                    <span className="text-[10px] font-bold tracking-[2px] text-white uppercase">
                        Shot Inspector
                    </span>
                </div>
                <button onClick={onClose} className="p-1 rounded hover:bg-[#1a1a1a] text-neutral-500 transition-colors">
                    <X size={13} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto">
                {/* Thumbnail Preview */}
                <div className="p-4 border-b border-[#141414]">
                    <div className="aspect-video rounded overflow-hidden bg-[#111] border border-[#1a1a1a]">
                        {clip.thumbnailUrl ? (
                            <img src={clip.thumbnailUrl} alt={clip.label} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-neutral-700">
                                <Camera size={24} />
                            </div>
                        )}
                    </div>
                    <div className="mt-2 text-center">
                        <span className="text-[9px] font-bold text-neutral-400 tracking-[2px] uppercase">
                            {clip.label}
                        </span>
                        <span className="text-[8px] text-neutral-600 block mt-0.5">
                            {clip.duration.toFixed(1)}s · Shot {clip.shotId.slice(-6)}
                        </span>
                        {/* Video Status Indicator */}
                        {clip.videoStatus === "animating" ? (
                            <span className="text-[7px] text-amber-500 block mt-0.5 animate-pulse">
                                ◉ Animating — video is being generated...
                            </span>
                        ) : clip.videoStatus === "error" ? (
                            <span className="text-[7px] text-red-500 block mt-0.5" title={clip.errorMessage}>
                                ✕ Failed — {clip.errorMessage?.slice(0, 40) || "generation error"}
                            </span>
                        ) : clip.videoUrl ? (
                            <span className="text-[7px] text-emerald-600 block mt-0.5">● Video ready</span>
                        ) : (
                            <span className="text-[7px] text-neutral-600 block mt-0.5">○ No video yet</span>
                        )}
                    </div>
                </div>

                {/* Lighting */}
                <Section title="Lighting" icon={<Sun size={10} />}>
                    <div className="grid grid-cols-2 gap-1.5">
                        {LIGHTING_PRESETS.map((preset) => (
                            <button
                                key={preset.key}
                                onClick={() => setLighting(preset.name)}
                                className={`relative rounded overflow-hidden transition-all ${
                                    lighting === preset.name
                                        ? "ring-2 ring-[#E50914] ring-offset-1 ring-offset-black"
                                        : "ring-1 ring-[#1a1a1a] hover:ring-[#333]"
                                }`}
                            >
                                <img
                                    src={preset.image}
                                    alt={preset.name}
                                    className="w-full aspect-[16/10] object-cover"
                                    loading="lazy"
                                />
                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-1.5 py-1">
                                    <span className={`text-[7px] font-bold tracking-wider uppercase ${
                                        lighting === preset.name ? "text-[#E50914]" : "text-white/80"
                                    }`}>
                                        {preset.name}
                                    </span>
                                </div>
                            </button>
                        ))}
                    </div>
                </Section>

                {/* Mood */}
                <Section title="Mood" icon={<Palette size={10} />}>
                    <div className="grid grid-cols-2 gap-1">
                        {MOODS.map((m) => (
                            <button
                                key={m}
                                onClick={() => setMood(m)}
                                className={`px-2 py-1.5 rounded text-[8px] tracking-wider transition-all ${
                                    mood === m
                                        ? "bg-[#E50914]/20 text-[#E50914] border border-[#E50914]/30"
                                        : "bg-[#111] text-neutral-500 border border-[#1a1a1a] hover:border-[#333]"
                                }`}
                            >
                                {m}
                            </button>
                        ))}
                    </div>
                </Section>

                {/* AI Shot Prompt */}
                <Section title="AI Shot Prompt" icon={<Wand2 size={10} />}>
                    <textarea
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        placeholder='e.g. "Make this darker and more dramatic"'
                        className="w-full bg-[#111] border border-[#1a1a1a] rounded px-2.5 py-2 text-[9px] text-white placeholder:text-neutral-600 resize-none focus:outline-none focus:border-[#E50914]/50"
                        rows={2}
                    />
                </Section>

                {/* ── RELIGHTING (Seedance V2V) ── */}
                <Section title="Relight Video" icon={<Lightbulb size={10} />}>
                    <p className="text-[8px] text-neutral-600 mb-2 leading-relaxed">
                        Re-render this video with new lighting &amp; mood using Seedance V2V. Motion is preserved.
                    </p>

                    <button
                        onClick={handleRelighting}
                        disabled={isProcessing || !clip.videoUrl}
                        className="w-full py-2 rounded bg-amber-600/20 border border-amber-500/30 text-[9px] text-amber-400 font-bold tracking-[2px] uppercase hover:bg-amber-600/30 disabled:opacity-50 transition-all flex items-center justify-center gap-2 mt-2"
                    >
                        {isProcessing && processingAction === "relight" ? (
                            <Loader2 size={10} className="animate-spin" />
                        ) : (
                            <Lightbulb size={10} />
                        )}
                        {clip.videoUrl ? "APPLY RELIGHTING" : "NO VIDEO YET"}
                    </button>
                </Section>

                {/* ── MOTION TRANSFER ── */}
                <Section title="Motion Transfer" icon={<Move size={10} />}>
                    <p className="text-[8px] text-neutral-600 mb-2 leading-relaxed">
                        Upload a reference video to transfer its motion onto this shot&apos;s character.
                    </p>

                    {/* Character Image (auto) */}
                    <div className="mb-2">
                        <label className="text-[7px] text-neutral-500 tracking-[1px] uppercase block mb-1">
                            Character Image (from shot)
                        </label>
                        <div className="flex items-center gap-2 bg-[#111] border border-[#1a1a1a] rounded px-2 py-1.5">
                            {clip.thumbnailUrl ? (
                                <>
                                    <img src={clip.thumbnailUrl} alt="character" className="w-8 h-8 rounded object-cover" />
                                    <span className="text-[7px] text-emerald-500 flex items-center gap-1">
                                        <CheckCircle size={8} /> Auto-detected
                                    </span>
                                </>
                            ) : (
                                <span className="text-[7px] text-red-500">No image — generate shot first</span>
                            )}
                        </div>
                    </div>

                    {/* Reference Video Upload */}
                    <div className="mb-2">
                        <label className="text-[7px] text-neutral-500 tracking-[1px] uppercase block mb-1">
                            Reference Motion Video
                        </label>
                        <input
                            ref={fileInputRef}
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
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading}
                            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
                            onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }}
                            onDrop={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setIsDragging(false);
                                const file = e.dataTransfer.files?.[0];
                                if (file) handleRefVideoUpload(file);
                            }}
                            className={`w-full bg-[#111] border border-dashed rounded px-2 py-3 text-center transition-all disabled:opacity-50 ${
                                isDragging
                                    ? "border-purple-500 bg-purple-500/10"
                                    : "border-[#333] hover:border-purple-500/50"
                            }`}
                        >
                            {isUploading ? (
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
                                    <Upload size={14} className={isDragging ? "text-purple-400" : "text-neutral-600"} />
                                    <span className={`text-[7px] tracking-wider ${isDragging ? "text-purple-400" : "text-neutral-500"}`}>
                                        {isDragging ? "Drop video here" : "Drag & drop or click to upload"}
                                    </span>
                                    <span className="text-[6px] text-neutral-700">.mp4 · Max 100MB</span>
                                </div>
                            )}
                        </button>
                    </div>

                    {/* Motion Prompt (optional) */}
                    <div className="mb-2">
                        <label className="text-[7px] text-neutral-500 tracking-[1px] uppercase block mb-1">
                            Scene Context (optional)
                        </label>
                        <textarea
                            value={motionPrompt}
                            onChange={(e) => setMotionPrompt(e.target.value)}
                            placeholder='e.g. "A dancer performing on a stage with dramatic lighting"'
                            className="w-full bg-[#111] border border-[#1a1a1a] rounded px-2.5 py-2 text-[9px] text-white placeholder:text-neutral-600 resize-none focus:outline-none focus:border-purple-500/50"
                            rows={2}
                        />
                    </div>

                    {/* Provider Toggle */}
                    <ProviderToggle
                        value={motionProvider}
                        onChange={setMotionProvider}
                        labels={{ "kling": "Kling", "seedance-2": "Seedance 2.0" }}
                        descriptions={{
                            "kling": "Motion Control — maps pose from ref video",
                            "seedance-2": "V2V — blends motion with prompt",
                        }}
                        color="purple"
                    />

                    {/* Motion Direction + Version (Kling only) */}
                    {motionProvider === "kling" && (
                        <>
                            <div className="mb-2 mt-2 flex gap-1">
                                {(["video", "image"] as const).map((o) => (
                                    <button
                                        key={o}
                                        onClick={() => setMotionDirection(o)}
                                        className={`flex-1 py-1 rounded text-[7px] font-bold tracking-[1px] uppercase transition-all ${
                                            motionDirection === o
                                                ? "bg-purple-600/20 text-purple-400 border border-purple-500/30"
                                                : "bg-[#111] text-neutral-600 border border-[#1a1a1a] hover:border-[#333]"
                                        }`}
                                    >
                                        {o === "video" ? "Match Video (30s)" : "Keep Image (10s)"}
                                    </button>
                                ))}
                            </div>
                            <div className="mb-3 flex gap-1">
                                {(["2.6", "3.0"] as const).map((v) => (
                                    <button
                                        key={v}
                                        onClick={() => setKlingVersion(v)}
                                        className={`flex-1 py-1 rounded text-[7px] font-bold tracking-[1px] uppercase transition-all ${
                                            klingVersion === v
                                                ? "bg-purple-600/20 text-purple-400 border border-purple-500/30"
                                                : "bg-[#111] text-neutral-600 border border-[#1a1a1a] hover:border-[#333]"
                                        }`}
                                    >
                                        Kling v{v}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}

                    <button
                        onClick={handleMotionTransfer}
                        disabled={isProcessing || !refVideoUrl || !clip.thumbnailUrl}
                        className="w-full py-2 rounded bg-purple-600/20 border border-purple-500/30 text-[9px] text-purple-400 font-bold tracking-[2px] uppercase hover:bg-purple-600/30 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                    >
                        {isProcessing && processingAction === "motion" ? (
                            <Loader2 size={10} className="animate-spin" />
                        ) : (
                            <Move size={10} />
                        )}
                        APPLY MOTION
                    </button>
                </Section>
            </div>

            {/* Bottom Actions */}
            <div className="p-3 border-t border-[#1a1a1a] flex gap-2 shrink-0">
                <button
                    onClick={handleRegenerate}
                    disabled={isProcessing}
                    className="flex-1 py-2 rounded bg-[#E50914] text-white text-[9px] font-bold tracking-[2px] uppercase hover:bg-[#ff1a25] disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
                >
                    {isProcessing && processingAction === "regenerate" ? (
                        <Loader2 size={10} className="animate-spin" />
                    ) : (
                        <RotateCcw size={10} />
                    )}
                    REGENERATE
                </button>
            </div>
        </motion.div>
    );
}


// ── Reusable Section ──
function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="px-4 py-3 border-b border-[#141414]">
            <div className="flex items-center gap-1.5 mb-2">
                <span className="text-neutral-500">{icon}</span>
                <span className="text-[8px] font-bold text-neutral-400 tracking-[2px] uppercase">{title}</span>
            </div>
            {children}
        </div>
    );
}


// ── Provider Toggle Component ──
function ProviderToggle({
    value,
    onChange,
    labels,
    descriptions,
    color,
}: {
    value: ProviderOption;
    onChange: (v: ProviderOption) => void;
    labels: Record<ProviderOption, string>;
    descriptions: Record<ProviderOption, string>;
    color: "amber" | "purple";
}) {
    const activeClasses = color === "amber"
        ? "bg-amber-600/20 text-amber-400 border-amber-500/30"
        : "bg-purple-600/20 text-purple-400 border-purple-500/30";

    return (
        <div className="space-y-1">
            <div className="flex gap-1">
                {(Object.keys(labels) as ProviderOption[]).map((key) => (
                    <button
                        key={key}
                        onClick={() => onChange(key)}
                        className={`flex-1 py-1.5 rounded text-[7px] font-bold tracking-[1px] uppercase transition-all border ${
                            value === key
                                ? activeClasses
                                : "bg-[#111] text-neutral-600 border-[#1a1a1a] hover:border-[#333]"
                        }`}
                    >
                        {labels[key]}
                    </button>
                ))}
            </div>
            <p className="text-[7px] text-neutral-600 italic">{descriptions[value]}</p>
        </div>
    );
}
