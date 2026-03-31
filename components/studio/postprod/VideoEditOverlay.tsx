"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Trash2, ArrowLeftRight, Paintbrush, Wand2,
    Loader2, Sparkles, ArrowRight, ImagePlus, X,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { generativeEdit } from "@/lib/api";
import { TimelineClip } from "@/lib/types/postprod";

// ═══════════════════════════════════════════════════════════
//   VIDEO EDIT OVERLAY v3 — Photoshop Generative Fill style
//   The prompt lives INSIDE the selection, not a popup.
// ═══════════════════════════════════════════════════════════

interface VideoEditOverlayProps {
    clip: TimelineClip;
    projectId: string;
    episodeId: string;
    videoRef: React.RefObject<HTMLVideoElement | null>;
    containerRef: React.RefObject<HTMLDivElement | null>;
    onClose: () => void;
    onProcessingStart?: (clipId: string) => void;
}

type EditAction = "remove" | "replace" | "restyle" | "custom";

interface SelectionRect { x: number; y: number; width: number; height: number; }

const ACTIONS: { key: EditAction; icon: React.ReactNode; tip: string }[] = [
    { key: "remove",  icon: <Trash2 size={13} />,          tip: "Remove" },
    { key: "replace", icon: <ArrowLeftRight size={13} />,   tip: "Replace" },
    { key: "restyle", icon: <Paintbrush size={13} />,       tip: "Restyle" },
    { key: "custom",  icon: <Wand2 size={13} />,           tip: "Custom" },
];

export default function VideoEditOverlay({
    clip, projectId, episodeId, videoRef, containerRef, onClose, onProcessingStart,
}: VideoEditOverlayProps) {
    const [isDrawing, setIsDrawing] = useState(false);
    const [selection, setSelection] = useState<SelectionRect | null>(null);
    const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
    const [editAction, setEditAction] = useState<EditAction>("replace");
    const [editPrompt, setEditPrompt] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);
    const [phase, setPhase] = useState<"draw" | "prompt">("draw");
    const [refImageUrl, setRefImageUrl] = useState<string | null>(null);
    const [isUploadingRef, setIsUploadingRef] = useState(false);
    const [isDraggingOver, setIsDraggingOver] = useState(false);
    const dragCounter = useRef(0);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ── Reference image upload ──
    const handleRefUpload = async (file: File) => {
        if (!file.type.startsWith("image/")) { toast.error("Upload an image file"); return; }
        setIsUploadingRef(true);
        try {
            const fileName = `ref_${Date.now()}_${file.name}`;
            const storageRef = ref(storage, `projects/${projectId}/postprod/edit_refs/${fileName}`);
            const snap = await uploadBytes(storageRef, file);
            const url = await getDownloadURL(snap.ref);
            setRefImageUrl(url);
            toast.success("Reference uploaded");
        } catch {
            toast.error("Upload failed");
        } finally {
            setIsUploadingRef(false);
        }
    };

    // ── Video bounds ──
    const getVideoBounds = useCallback(() => {
        const video = videoRef.current;
        const container = containerRef.current;
        if (!video || !container) return null;
        const cr = container.getBoundingClientRect();
        const vr = video.getBoundingClientRect();
        return { left: vr.left - cr.left, top: vr.top - cr.top, width: vr.width, height: vr.height };
    }, [videoRef, containerRef]);

    const normalizePos = useCallback((clientX: number, clientY: number) => {
        const container = containerRef.current;
        const vb = getVideoBounds();
        if (!container || !vb) return { x: 0, y: 0 };
        const cr = container.getBoundingClientRect();
        return {
            x: Math.max(0, Math.min(1, (clientX - cr.left - vb.left) / vb.width)),
            y: Math.max(0, Math.min(1, (clientY - cr.top - vb.top) / vb.height)),
        };
    }, [containerRef, getVideoBounds]);

    // ── Keep canvas sized ──
    useEffect(() => {
        const resize = () => {
            const canvas = canvasRef.current;
            const container = containerRef.current;
            if (!canvas || !container) return;
            const r = container.getBoundingClientRect();
            if (canvas.width !== r.width || canvas.height !== r.height) {
                canvas.width = r.width; canvas.height = r.height;
            }
        };
        resize();
        window.addEventListener("resize", resize);
        const iv = setInterval(resize, 300);
        return () => { window.removeEventListener("resize", resize); clearInterval(iv); };
    }, [containerRef]);

    // ── Draw selection overlay ──
    useEffect(() => {
        let raf: number;
        const draw = () => {
            const canvas = canvasRef.current;
            const container = containerRef.current;
            const vb = getVideoBounds();
            if (!canvas || !container || !vb) { raf = requestAnimationFrame(draw); return; }

            const r = container.getBoundingClientRect();
            if (canvas.width !== r.width || canvas.height !== r.height) {
                canvas.width = r.width; canvas.height = r.height;
            }
            const ctx = canvas.getContext("2d");
            if (!ctx) { raf = requestAnimationFrame(draw); return; }

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            if (!selection) {
                // No selection yet — draw subtle guide crosshairs at cursor would be complex,
                // just keep it clean and empty
                raf = requestAnimationFrame(draw);
                return;
            }

            const px = vb.left + selection.x * vb.width;
            const py = vb.top + selection.y * vb.height;
            const pw = selection.width * vb.width;
            const ph = selection.height * vb.height;
            const t = Date.now();

            // ── Outside: darken + slight blur-like effect ──
            ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // ── Clear the selection area ──
            ctx.clearRect(px, py, pw, ph);

            // ── Selection border: clean, glowing ──
            // Outer glow
            ctx.save();
            ctx.shadowColor = "rgba(229, 9, 20, 0.6)";
            ctx.shadowBlur = 15;
            ctx.strokeStyle = "rgba(229, 9, 20, 0.8)";
            ctx.lineWidth = 2;
            ctx.strokeRect(px, py, pw, ph);
            ctx.restore();

            // Clean white inner border
            ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
            ctx.lineWidth = 1;
            ctx.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1);

            // ── Corner dots (4 corners + 4 midpoints) ──
            const dotR = 3;
            const dots = [
                [px, py], [px + pw, py], [px, py + ph], [px + pw, py + ph],  // corners
                [px + pw / 2, py], [px + pw / 2, py + ph],  // mid top/bottom
                [px, py + ph / 2], [px + pw, py + ph / 2],  // mid left/right
            ];
            dots.forEach(([dx, dy]) => {
                ctx.beginPath();
                ctx.arc(dx, dy, dotR, 0, Math.PI * 2);
                ctx.fillStyle = "#fff";
                ctx.fill();
                ctx.strokeStyle = "rgba(229, 9, 20, 0.8)";
                ctx.lineWidth = 1.5;
                ctx.stroke();
            });

            // ── Scanning line animation (only during draw phase) ──
            if (isDrawing || (phase === "draw" && !isDrawing && selection)) {
                const scanProgress = ((t % 2000) / 2000);
                const scanY = py + ph * scanProgress;
                ctx.strokeStyle = `rgba(229, 9, 20, ${0.4 * (1 - scanProgress)})`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(px + 4, scanY);
                ctx.lineTo(px + pw - 4, scanY);
                ctx.stroke();
            }

            raf = requestAnimationFrame(draw);
        };
        raf = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(raf);
    }, [selection, isDrawing, phase, getVideoBounds, containerRef]);

    // ── Mouse handlers ──
    const handleMouseDown = (e: React.MouseEvent) => {
        if (isProcessing || phase === "prompt") return;
        const pos = normalizePos(e.clientX, e.clientY);
        setDrawStart(pos);
        setIsDrawing(true);
        setSelection(null);
        setPhase("draw");
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDrawing || !drawStart) return;
        const pos = normalizePos(e.clientX, e.clientY);
        const x = Math.min(drawStart.x, pos.x);
        const y = Math.min(drawStart.y, pos.y);
        const w = Math.abs(pos.x - drawStart.x);
        const h = Math.abs(pos.y - drawStart.y);
        if (w > 0.01 || h > 0.01) setSelection({ x, y, width: w, height: h });
    };

    const handleMouseUp = () => {
        if (!isDrawing) return;
        setIsDrawing(false);
        setDrawStart(null);
        if (selection && selection.width > 0.02 && selection.height > 0.02) {
            setPhase("prompt");
            setTimeout(() => inputRef.current?.focus(), 100);
        } else {
            setSelection(null);
        }
    };

    // ── Frame capture ──
    const captureFrame = async (): Promise<string> => {
        const video = videoRef.current;
        if (!video || !video.videoWidth) throw new Error("Video not ready");
        const c = document.createElement("canvas");
        c.width = video.videoWidth; c.height = video.videoHeight;
        const ctx = c.getContext("2d")!;
        ctx.drawImage(video, 0, 0, c.width, c.height);
        const blob = await new Promise<Blob>((res, rej) =>
            c.toBlob((b) => (b ? res(b) : rej(new Error("Blob failed"))), "image/png")
        );
        const storageRef = ref(storage, `projects/${projectId}/postprod/frame_captures/frame_${Date.now()}.png`);
        const snap = await uploadBytes(storageRef, blob);
        return getDownloadURL(snap.ref);
    };

    // ── Submit ──
    const handleSubmit = async () => {
        if (!selection || !clip.videoUrl) return;
        if (editAction !== "remove" && !editPrompt.trim()) { toast.error("Describe the edit"); return; }

        setIsProcessing(true);
        onProcessingStart?.(clip.id);
        try {
            toast.loading("Capturing frame...", { id: "gedit" });
            const frameUrl = await captureFrame();
            toast.loading("Submitting to Seedance...", { id: "gedit" });
            await generativeEdit(
                projectId, episodeId, clip.sceneId, clip.shotId, clip.videoUrl,
                frameUrl, selection,
                editAction === "remove" ? "Remove this element cleanly" : editPrompt.trim(),
                editAction, refImageUrl || undefined, "16:9",
                clip.trimIn || undefined, clip.trimOut || undefined,
            );
            toast.success("Edit queued — rendering in progress", { id: "gedit" });
            onClose();
        } catch (e: any) {
            toast.error(e?.response?.data?.detail || e?.message || "Edit failed", { id: "gedit" });
        } finally {
            setIsProcessing(false);
        }
    };

    // ── Keyboard ──
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                if (phase === "prompt") { setPhase("draw"); setSelection(null); setEditPrompt(""); }
                else onClose();
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [onClose, phase]);

    // ── Compute inline bar position (bottom edge of selection) ──
    const getBarPosition = (): React.CSSProperties => {
        if (!selection) return { display: "none" };
        const vb = getVideoBounds();
        if (!vb) return { display: "none" };
        const centerX = vb.left + (selection.x + selection.width / 2) * vb.width;
        const bottomY = vb.top + (selection.y + selection.height) * vb.height + 10;
        return {
            position: "absolute",
            left: `${centerX}px`,
            top: `${bottomY}px`,
            transform: "translateX(-50%)",
            zIndex: 50,
        };
    };

    return (
        <>
            {/* Full canvas overlay for drawing */}
            <canvas
                ref={canvasRef}
                className="absolute inset-0 z-20"
                style={{ cursor: phase === "draw" ? "crosshair" : "default" }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={() => { if (isDrawing) handleMouseUp(); }}
            />

            {/* ── Inline Generative Fill Bar ── */}
            <AnimatePresence>
                {phase === "prompt" && selection && (
                    <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.96 }}
                        transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                        style={getBarPosition()}
                        className="z-50"
                    >
                        <div
                            className={`flex items-center gap-0 rounded-2xl overflow-hidden transition-all duration-200 ${
                                isDraggingOver ? 'ring-2 ring-[#E50914]/50 scale-[1.02]' : ''
                            }`}
                            style={{
                                background: isDraggingOver ? "rgba(229, 9, 20, 0.08)" : "rgba(10, 10, 10, 0.92)",
                                backdropFilter: "blur(40px) saturate(180%)",
                                border: isDraggingOver ? "1px solid rgba(229,9,20,0.3)" : "1px solid rgba(255,255,255,0.08)",
                                boxShadow: isDraggingOver
                                    ? "0 20px 60px -15px rgba(229,9,20,0.3), 0 0 0 1px rgba(229,9,20,0.3)"
                                    : "0 20px 60px -15px rgba(0,0,0,0.9), 0 0 0 1px rgba(229,9,20,0.15)",
                            }}
                            onDragEnter={(e) => {
                                e.preventDefault();
                                dragCounter.current++;
                                if (editAction === "replace" || editAction === "restyle") {
                                    setIsDraggingOver(true);
                                }
                            }}
                            onDragOver={(e) => {
                                e.preventDefault();
                                e.dataTransfer.dropEffect = "copy";
                            }}
                            onDragLeave={(e) => {
                                e.preventDefault();
                                dragCounter.current--;
                                if (dragCounter.current <= 0) {
                                    dragCounter.current = 0;
                                    setIsDraggingOver(false);
                                }
                            }}
                            onDrop={(e) => {
                                e.preventDefault();
                                dragCounter.current = 0;
                                setIsDraggingOver(false);
                                const file = e.dataTransfer.files?.[0];
                                if (file && file.type.startsWith("image/")) {
                                    // Auto-switch to replace if not already
                                    if (editAction !== "replace" && editAction !== "restyle") {
                                        setEditAction("replace");
                                    }
                                    handleRefUpload(file);
                                } else {
                                    toast.error("Drop an image file");
                                }
                            }}
                        >
                            {/* Action icons */}
                            <div className="flex items-center gap-0.5 pl-1.5 pr-1">
                                {ACTIONS.map((a) => (
                                    <button
                                        key={a.key}
                                        onClick={() => setEditAction(a.key)}
                                        title={a.tip}
                                        className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-150 ${
                                            editAction === a.key
                                                ? "bg-[#E50914] text-white shadow-md shadow-[#E50914]/30 scale-105"
                                                : "text-neutral-500 hover:text-white hover:bg-white/10"
                                        }`}
                                    >
                                        {a.icon}
                                    </button>
                                ))}
                            </div>

                            {/* Divider */}
                            <div className="w-px h-6 bg-white/10" />

                            {/* Reference image upload (for Replace/Restyle) */}
                            {(editAction === "replace" || editAction === "restyle") && (
                                <>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => {
                                            const f = e.target.files?.[0];
                                            if (f) handleRefUpload(f);
                                            e.target.value = "";
                                        }}
                                    />
                                    {refImageUrl ? (
                                        <div className="flex items-center gap-1 pl-2">
                                            <div className="relative group">
                                                <img
                                                    src={refImageUrl}
                                                    alt="ref"
                                                    className="w-7 h-7 rounded-md object-cover border border-white/10"
                                                />
                                                <button
                                                    onClick={() => setRefImageUrl(null)}
                                                    className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-black/80 border border-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <X size={7} className="text-white" />
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={isUploadingRef}
                                            title="Upload reference image"
                                            className="flex items-center justify-center w-8 h-8 ml-1 rounded-lg text-neutral-500 hover:text-white hover:bg-white/10 transition-all"
                                        >
                                            {isUploadingRef ? (
                                                <Loader2 size={12} className="animate-spin" />
                                            ) : (
                                                <ImagePlus size={13} />
                                            )}
                                        </button>
                                    )}
                                </>
                            )}

                            {/* Prompt input */}
                            {editAction === "remove" ? (
                                <div className="flex items-center gap-2 px-3 py-2">
                                    <span className="text-[11px] text-neutral-400 whitespace-nowrap">
                                        Remove selected region
                                    </span>
                                </div>
                            ) : (
                                <input
                                    ref={inputRef}
                                    value={editPrompt}
                                    onChange={(e) => setEditPrompt(e.target.value)}
                                    placeholder={
                                        editAction === "replace"
                                            ? (refImageUrl ? "Describe how to place it..." : "Replace with...")
                                            : editAction === "restyle" ? "Restyle as..."
                                            : "Describe edit..."
                                    }
                                    className="w-[220px] bg-transparent px-3 py-2.5 text-[12px] text-white placeholder-neutral-600 focus:outline-none"
                                    style={{ caretColor: "#E50914" }}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") handleSubmit();
                                        if (e.key === "Escape") {
                                            e.stopPropagation();
                                            setPhase("draw");
                                            setSelection(null);
                                            setEditPrompt("");
                                            setRefImageUrl(null);
                                        }
                                    }}
                                />
                            )}

                            {/* Submit button */}
                            <button
                                onClick={handleSubmit}
                                disabled={isProcessing || (editAction !== "remove" && !editPrompt.trim())}
                                className={`h-full flex items-center justify-center px-3 py-2.5 transition-all duration-200 ${
                                    isProcessing || (editAction !== "remove" && !editPrompt.trim())
                                        ? "text-neutral-700 cursor-not-allowed"
                                        : "text-[#E50914] hover:bg-[#E50914]/10 cursor-pointer"
                                }`}
                            >
                                {isProcessing ? (
                                    <Loader2 size={16} className="animate-spin" />
                                ) : (
                                    <div className="w-7 h-7 rounded-lg bg-[#E50914] flex items-center justify-center shadow-lg shadow-[#E50914]/30">
                                        <ArrowRight size={14} className="text-white" />
                                    </div>
                                )}
                            </button>
                        </div>

                        {/* Hint below */}
                        <div className="flex justify-center mt-1.5">
                            <span className="text-[8px] text-neutral-600 tracking-wider">
                                press <span className="text-neutral-500 font-mono">↵</span> to generate · <span className="text-neutral-500 font-mono">esc</span> to redraw
                            </span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Bottom HUD */}
            <div className="absolute bottom-0 left-0 right-0 z-30 pointer-events-none">
                <div className="flex items-center justify-center py-2">
                    <div className="flex items-center gap-3 pointer-events-auto px-4 py-1.5 rounded-full"
                        style={{
                            background: "rgba(0,0,0,0.5)",
                            backdropFilter: "blur(12px)",
                            border: "1px solid rgba(255,255,255,0.05)",
                        }}
                    >
                        <div className="flex items-center gap-1.5">
                            <div className="relative">
                                <div className="w-1.5 h-1.5 rounded-full bg-[#E50914]" />
                                <div className="absolute inset-0 w-1.5 h-1.5 rounded-full bg-[#E50914] animate-ping opacity-30" />
                            </div>
                            <span className="text-[8px] font-bold text-[#E50914] tracking-[2px] uppercase">
                                Edit
                            </span>
                        </div>

                        <div className="w-px h-3 bg-white/10" />

                        <span className="text-[8px] text-neutral-500">
                            {phase === "draw"
                                ? (isDrawing ? "Release to confirm selection" : "Click & drag to select a region")
                                : "Type your edit prompt"
                            }
                        </span>

                        <div className="w-px h-3 bg-white/10" />

                        <button
                            onClick={onClose}
                            className="text-[8px] text-neutral-600 hover:text-white transition-colors"
                        >
                            ESC
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
