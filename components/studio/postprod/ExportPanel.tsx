"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
    X, Download, Smartphone, Settings, Loader2,
    Youtube, Instagram, Tv, CheckCircle, AlertCircle, ExternalLink
} from "lucide-react";
import { toast } from "react-hot-toast";
import { exportTimeline as exportTimelineAPI } from "@/lib/api";
import { TimelineState, ExportConfig } from "@/lib/types/postprod";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

// ═══════════════════════════════════════════════════════════
//   EXPORT PANEL (v3)
//   Calls real backend /export → FFmpeg worker → GCS upload
//   Progress tracked via Firestore episode doc
// ═══════════════════════════════════════════════════════════

interface ExportPanelProps {
    projectId: string;
    episodeId: string;
    timeline: TimelineState;
    onClose: () => void;
}

const PLATFORM_PRESETS: { key: ExportConfig["platform"]; label: string; icon: React.ReactNode; ratio: ExportConfig["aspectRatio"]; res: ExportConfig["resolution"] }[] = [
    { key: "youtube", label: "YouTube", icon: <Youtube size={14} />, ratio: "16:9", res: "1080p" },
    { key: "reels", label: "Reels / Stories", icon: <Instagram size={14} />, ratio: "9:16", res: "1080p" },
    { key: "tiktok", label: "TikTok", icon: <Smartphone size={14} />, ratio: "9:16", res: "1080p" },
    { key: "ads", label: "Ad / Commercial", icon: <Tv size={14} />, ratio: "16:9", res: "4k" },
    { key: "custom", label: "Custom", icon: <Settings size={14} />, ratio: "16:9", res: "1080p" },
];

export default function ExportPanel({ projectId, episodeId, timeline, onClose }: ExportPanelProps) {
    const [config, setConfig] = useState<ExportConfig>({
        aspectRatio: "16:9",
        resolution: "1080p",
        format: "mp4",
        watermark: false,
        platform: "youtube",
        fps: 24,
    });
    const [exporting, setExporting] = useState(false);
    const [progress, setProgress] = useState(0);
    const [exportStatus, setExportStatus] = useState<string | null>(null);
    const [exportUrl, setExportUrl] = useState<string | null>(null);
    const [exportError, setExportError] = useState<string | null>(null);

    const handlePreset = (preset: typeof PLATFORM_PRESETS[0]) => {
        setConfig({
            ...config,
            platform: preset.key,
            aspectRatio: preset.ratio,
            resolution: preset.res,
        });
    };

    // ── Real-time Firestore progress listener ──
    useEffect(() => {
        if (!exporting && !exportStatus) return;

        const episodeRef = doc(db, "projects", projectId, "episodes", episodeId);
        const unsub = onSnapshot(episodeRef, (snap) => {
            const data = snap.data();
            if (!data) return;

            const status = data.ugc_export_status;
            const prog = data.ugc_export_progress || 0;
            const url = data.ugc_export_url;
            const error = data.ugc_export_error;

            setProgress(prog);
            setExportStatus(status);

            if (status === "completed" && url) {
                setExportUrl(url);
                setExporting(false);
                toast.success("Export complete! Download your video.");
            } else if (status === "error") {
                setExportError(error || "Export failed");
                setExporting(false);
                toast.error(error || "Export failed");
            }
        });

        return () => unsub();
    }, [exporting, exportStatus, projectId, episodeId]);

    const handleExport = async () => {
        setExporting(true);
        setProgress(0);
        setExportUrl(null);
        setExportError(null);
        setExportStatus("queued");

        try {
            const result = await exportTimelineAPI(projectId, episodeId, {
                aspect_ratio: config.aspectRatio,
                resolution: config.resolution,
                format: config.format,
                watermark: config.watermark,
                platform: config.platform,
                fps: config.fps,
            });

            toast.success(`Export queued: ${result.clips_count} clips`);
        } catch (e: any) {
            console.error("Export failed:", e);
            toast.error(e?.response?.data?.detail || "Export failed");
            setExporting(false);
            setExportStatus(null);
        }
    };

    const totalClips = timeline.tracks.reduce((sum, t) => sum + t.clips.length, 0);

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
                    <Download size={12} className="text-[#E50914]" />
                    <span className="text-[10px] font-bold tracking-[2px] text-white uppercase">Export</span>
                </div>
                <button onClick={onClose} className="p-1 rounded hover:bg-[#1a1a1a] text-neutral-500 transition-colors">
                    <X size={13} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto">
                {/* Summary */}
                <div className="px-4 py-3 border-b border-[#141414]">
                    <div className="grid grid-cols-3 gap-2">
                        <StatBox label="Clips" value={totalClips} />
                        <StatBox label="Duration" value={`${timeline.duration.toFixed(1)}s`} />
                        <StatBox label="Tracks" value={timeline.tracks.length} />
                    </div>
                </div>

                {/* Platform Presets */}
                <div className="px-4 py-3 border-b border-[#141414]">
                    <span className="text-[8px] text-neutral-600 tracking-[2px] font-bold uppercase block mb-2">Platform</span>
                    <div className="space-y-1">
                        {PLATFORM_PRESETS.map((preset) => (
                            <button
                                key={preset.key}
                                onClick={() => handlePreset(preset)}
                                className={`w-full flex items-center gap-3 px-3 py-2 rounded transition-all ${
                                    config.platform === preset.key
                                        ? "bg-[#E50914]/15 border border-[#E50914]/30 text-white"
                                        : "bg-[#111] border border-[#1a1a1a] text-neutral-400 hover:border-[#333]"
                                }`}
                            >
                                <span className={config.platform === preset.key ? "text-[#E50914]" : "text-neutral-600"}>
                                    {preset.icon}
                                </span>
                                <span className="text-[9px] font-bold tracking-wider uppercase flex-1 text-left">
                                    {preset.label}
                                </span>
                                <span className="text-[8px] text-neutral-600">{preset.ratio}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Settings */}
                <div className="px-4 py-3 border-b border-[#141414]">
                    <span className="text-[8px] text-neutral-600 tracking-[2px] font-bold uppercase block mb-2">Settings</span>

                    {/* Resolution */}
                    <div className="mb-3">
                        <span className="text-[8px] text-neutral-500 block mb-1">Resolution</span>
                        <div className="flex gap-1">
                            {(["720p", "1080p", "2k", "4k"] as const).map((r) => (
                                <button
                                    key={r}
                                    onClick={() => setConfig({ ...config, resolution: r })}
                                    className={`flex-1 py-1.5 rounded text-[8px] font-bold tracking-wider uppercase transition-all ${
                                        config.resolution === r
                                            ? "bg-[#E50914] text-white"
                                            : "bg-[#111] text-neutral-500 hover:text-white"
                                    }`}
                                >
                                    {r}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* FPS */}
                    <div className="mb-3">
                        <span className="text-[8px] text-neutral-500 block mb-1">Frame Rate</span>
                        <div className="flex gap-1">
                            {([24, 30, 60] as const).map((f) => (
                                <button
                                    key={f}
                                    onClick={() => setConfig({ ...config, fps: f })}
                                    className={`flex-1 py-1.5 rounded text-[8px] font-bold tracking-wider transition-all ${
                                        config.fps === f
                                            ? "bg-[#E50914] text-white"
                                            : "bg-[#111] text-neutral-500 hover:text-white"
                                    }`}
                                >
                                    {f}fps
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Format */}
                    <div className="mb-3">
                        <span className="text-[8px] text-neutral-500 block mb-1">Format</span>
                        <div className="flex gap-1">
                            {(["mp4", "mov", "webm"] as const).map((fmt) => (
                                <button
                                    key={fmt}
                                    onClick={() => setConfig({ ...config, format: fmt })}
                                    className={`flex-1 py-1.5 rounded text-[8px] font-bold tracking-wider uppercase transition-all ${
                                        config.format === fmt
                                            ? "bg-[#E50914] text-white"
                                            : "bg-[#111] text-neutral-500 hover:text-white"
                                    }`}
                                >
                                    .{fmt}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Watermark */}
                    <div className="flex items-center justify-between">
                        <span className="text-[8px] text-neutral-500 tracking-wider uppercase">Watermark</span>
                        <button
                            onClick={() => setConfig({ ...config, watermark: !config.watermark })}
                            className={`w-8 h-4 rounded-full transition-all relative ${
                                config.watermark ? "bg-[#E50914]" : "bg-[#333]"
                            }`}
                        >
                            <div
                                className={`w-3 h-3 bg-white rounded-full absolute top-0.5 transition-all ${
                                    config.watermark ? "right-0.5" : "left-0.5"
                                }`}
                            />
                        </button>
                    </div>
                </div>
            </div>

            {/* Export Button / Progress / Result */}
            <div className="p-4 border-t border-[#1a1a1a] shrink-0">
                {exportUrl && exportStatus === "completed" ? (
                    /* ── COMPLETED: Show download link ── */
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-emerald-400 text-[9px] font-bold tracking-wider uppercase">
                            <CheckCircle size={12} /> Export Complete
                        </div>
                        <a
                            href={exportUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full py-2.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold tracking-[3px] uppercase transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                        >
                            <Download size={12} /> DOWNLOAD VIDEO
                        </a>
                        <button
                            onClick={() => { setExportUrl(null); setExportStatus(null); }}
                            className="w-full py-1.5 rounded bg-[#111] border border-[#1a1a1a] text-neutral-500 text-[8px] tracking-wider uppercase hover:text-white transition-all"
                        >
                            EXPORT AGAIN
                        </button>
                    </div>
                ) : exportError ? (
                    /* ── ERROR: Show error + retry ── */
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-red-400 text-[9px] font-bold tracking-wider">
                            <AlertCircle size={12} /> {exportError.slice(0, 80)}
                        </div>
                        <button
                            onClick={() => { setExportError(null); setExportStatus(null); handleExport(); }}
                            className="w-full py-2.5 rounded bg-[#E50914] hover:bg-[#ff1a25] text-white text-[10px] font-bold tracking-[3px] uppercase transition-all flex items-center justify-center gap-2"
                        >
                            RETRY EXPORT
                        </button>
                    </div>
                ) : exporting ? (
                    /* ── IN PROGRESS: Real Firestore progress ── */
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-[9px]">
                            <span className="text-neutral-500 tracking-wider uppercase flex items-center gap-1.5">
                                <Loader2 size={10} className="animate-spin" />
                                {exportStatus === "queued" ? "Queued..." : exportStatus === "exporting" ? "Rendering..." : "Processing..."}
                            </span>
                            <span className="text-[#E50914] font-bold">{progress}%</span>
                        </div>
                        <div className="h-1.5 bg-[#222] rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-[#E50914] to-[#ff4444] rounded-full transition-all duration-500"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <p className="text-[7px] text-neutral-600 text-center">
                            FFmpeg is stitching your clips — this may take a few minutes.
                        </p>
                    </div>
                ) : (
                    /* ── IDLE: Export button ── */
                    <button
                        onClick={handleExport}
                        disabled={totalClips === 0}
                        className={`w-full py-2.5 rounded text-white text-[10px] font-bold tracking-[3px] uppercase transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#E50914]/20 ${
                            totalClips === 0
                                ? 'bg-neutral-700 cursor-not-allowed opacity-50'
                                : 'bg-[#E50914] hover:bg-[#ff1a25]'
                        }`}
                    >
                        <Download size={12} />
                        EXPORT FINAL CUT
                    </button>
                )}
            </div>
        </motion.div>
    );
}

function StatBox({ label, value }: { label: string; value: string | number }) {
    return (
        <div className="bg-[#111] border border-[#1a1a1a] rounded p-2 text-center">
            <span className="text-[11px] font-bold text-white block">{value}</span>
            <span className="text-[7px] text-neutral-600 tracking-[2px] uppercase">{label}</span>
        </div>
    );
}
