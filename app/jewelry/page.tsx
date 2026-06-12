"use client";

import React, { useState, useEffect, useRef } from "react";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth, storage } from "@/lib/firebase";
import { API_BASE_URL } from "@/lib/config";
import { Sparkles, Upload, Loader2, Download as DownloadIcon, RefreshCw, Layers, CheckCircle2, AlertCircle, X, ImagePlus, Gem, Camera, User, Crosshair, Play, Trash2, XCircle } from "@/lib/lucide";
import { toast } from "react-hot-toast";

// ── BRAND PRESETS ──
const BRAND_PRESETS = [
    {
        id: "luxury_white_studio",
        name: "White Studio",
        description: "Pristine white matte surface, platinum reflections",
        colorClass: "from-white/[0.08] to-gray-500/[0.04]",
        borderActive: "border-white/40",
        icon: "◇"
    },
    {
        id: "black_premium_studio",
        name: "Black Premium",
        description: "Obsidian surface, dramatic spotlights",
        colorClass: "from-neutral-900/80 to-black/40",
        borderActive: "border-neutral-400/40",
        icon: "◆"
    },
    {
        id: "marble_luxury",
        name: "Marble & Gold",
        description: "Calacatta marble, warm sunlight shadows",
        colorClass: "from-amber-900/[0.08] to-orange-950/[0.04]",
        borderActive: "border-amber-500/40",
        icon: "❖"
    },
    {
        id: "fashion_editorial",
        name: "Editorial",
        description: "Pastel backdrop, high-contrast flash",
        colorClass: "from-purple-900/[0.06] to-pink-950/[0.04]",
        borderActive: "border-purple-400/40",
        icon: "✦"
    },
    {
        id: "high_jewelry",
        name: "Velvet & Bokeh",
        description: "Dark velvet, glass case lighting, sparkle",
        colorClass: "from-emerald-900/[0.06] to-blue-950/[0.04]",
        borderActive: "border-emerald-400/40",
        icon: "✧"
    }
];

export default function JewelryAutomationPage() {
    const [templateId, setTemplateId] = useState<"product_only" | "product_human">("product_only");
    const [brandPreset, setBrandPreset] = useState("luxury_white_studio");
    const [sku, setSku] = useState("");
    const [aspectRatio, setAspectRatio] = useState("9:16");

    // Product images (multi-upload, up to 9)
    const [productFiles, setProductFiles] = useState<File[]>([]);
    // Model photo (single, for product_human only)
    const [modelFile, setModelFile] = useState<File | null>(null);

    const [uploading, setUploading] = useState(false);

    // Run status
    const [runId, setRunId] = useState<string | null>(null);
    const [runStatus, setRunStatus] = useState<string | null>(null);
    const [runProgress, setRunProgress] = useState<number>(0);
    const [runStepDesc, setRunStepDesc] = useState<string>("");
    const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const [currentUser, setCurrentUser] = useState<any>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [cancelling, setCancelling] = useState(false);

    // Staleness detection: track when progress last changed
    const [lastProgressChange, setLastProgressChange] = useState<number>(Date.now());
    const [isStale, setIsStale] = useState(false);

    const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const productInputRef = useRef<HTMLInputElement | null>(null);
    const modelInputRef = useRef<HTMLInputElement | null>(null);

    const uuidShort = () => Math.random().toString(36).substring(2, 10);

    // ── Handlers ──
    const handleProductFilesAdd = (newFiles: FileList) => {
        const incoming = Array.from(newFiles);
        setProductFiles(prev => [...prev, ...incoming].slice(0, 9));
    };

    const removeProductFile = (index: number) => {
        setProductFiles(prev => prev.filter((_, i) => i !== index));
    };

    const uploadAllFiles = async (userUid: string) => {
        const productUrls: string[] = [];
        const results = await Promise.all(
            productFiles.map(async (file, idx) => {
                const fileExt = file.name.split(".").pop();
                const storagePath = `users/${userUid}/jewelry/${sku || "product"}_${idx}_${uuidShort()}.${fileExt}`;
                const storageRef = ref(storage, storagePath);
                const snap = await uploadBytes(storageRef, file);
                return { idx, url: await getDownloadURL(snap.ref) };
            })
        );
        results.sort((a, b) => a.idx - b.idx);
        results.forEach(r => productUrls.push(r.url));

        let modelUrl: string | undefined;
        if (templateId === "product_human" && modelFile) {
            const fileExt = modelFile.name.split(".").pop();
            const storagePath = `users/${userUid}/jewelry/${sku || "product"}_model_${uuidShort()}.${fileExt}`;
            const storageRef = ref(storage, storagePath);
            const snap = await uploadBytes(storageRef, modelFile);
            modelUrl = await getDownloadURL(snap.ref);
        }

        return { product_image_urls: productUrls, model_image_url: modelUrl };
    };

    const handleGenerate = async () => {
        const user = auth.currentUser;
        if (!user) { toast.error("Please sign in."); return; }
        if (productFiles.length === 0) { toast.error("Upload at least one product photo."); return; }
        if (templateId === "product_human" && !modelFile) { toast.error("Upload a model photo."); return; }

        try {
            setUploading(true);
            setErrorMsg(null);
            setFinalVideoUrl(null);
            setRunStatus("uploading");
            setRunStepDesc("Uploading photos…");

            const { product_image_urls, model_image_url } = await uploadAllFiles(user.uid);

            const payloadInputs: { [key: string]: any } = { product_image_urls };
            if (model_image_url) payloadInputs["model_image_url"] = model_image_url;

            setRunStepDesc("Starting generation…");
            const token = await user.getIdToken();
            const response = await fetch(`${API_BASE_URL}/api/v1/jewelry/generate`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({
                    template_id: templateId,
                    brand_preset: brandPreset,
                    sku: sku.trim() || "SKU-AUTO",
                    aspect_ratio: aspectRatio,
                    inputs: payloadInputs
                })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.detail || "Failed to start");

            setRunId(data.run_id);
            setRunStatus("queued");
            setRunProgress(5);
            setRunStepDesc("Queued…");
            toast.success("Generation started!");
            fetchHistory();
        } catch (e: any) {
            setErrorMsg(e.message || "Failed.");
            setRunStatus("error");
            toast.error(e.message || "Failed.");
        } finally {
            setUploading(false);
        }
    };

    // ── Fetch History ──
    const fetchHistory = async () => {
        const user = auth.currentUser;
        if (!user) return;
        try {
            setLoadingHistory(true);
            const token = await user.getIdToken();
            const res = await fetch(`${API_BASE_URL}/api/v1/jewelry/history`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setHistory(data.history || []);
            }
        } catch (e) {
            console.error("Failed to fetch history:", e);
        } finally {
            setLoadingHistory(false);
        }
    };

    useEffect(() => {
        if (currentUser) {
            fetchHistory();
        }
    }, [currentUser]);

    // ── Auth Listener ──
    useEffect(() => {
        const unsub = auth.onAuthStateChanged((user) => {
            setCurrentUser(user);
        });
        return () => unsub();
    }, []);

    // ── Load run from localStorage on mount ──
    useEffect(() => {
        const storedRunId = localStorage.getItem("motionx_jewelry_run_id");
        if (storedRunId) {
            setRunId(storedRunId);
            setSku(localStorage.getItem("motionx_jewelry_sku") || "");
            setRunStatus(localStorage.getItem("motionx_jewelry_status") || "queued");
            setRunProgress(Number(localStorage.getItem("motionx_jewelry_progress")) || 0);
            setRunStepDesc(localStorage.getItem("motionx_jewelry_step_desc") || "");
            setFinalVideoUrl(localStorage.getItem("motionx_jewelry_video_url") || null);
            setErrorMsg(localStorage.getItem("motionx_jewelry_error") || null);

            const storedTemplate = localStorage.getItem("motionx_jewelry_template_id");
            const storedPreset = localStorage.getItem("motionx_jewelry_brand_preset");
            const storedRatio = localStorage.getItem("motionx_jewelry_aspect_ratio");
            if (storedTemplate) setTemplateId(storedTemplate as any);
            if (storedPreset) setBrandPreset(storedPreset);
            if (storedRatio) setAspectRatio(storedRatio);
        }
    }, []);

    // ── Sync run state to localStorage ──
    useEffect(() => {
        if (runId) {
            localStorage.setItem("motionx_jewelry_run_id", runId);
            localStorage.setItem("motionx_jewelry_sku", sku);
            localStorage.setItem("motionx_jewelry_status", runStatus || "");
            localStorage.setItem("motionx_jewelry_progress", String(runProgress));
            localStorage.setItem("motionx_jewelry_step_desc", runStepDesc || "");
            localStorage.setItem("motionx_jewelry_video_url", finalVideoUrl || "");
            localStorage.setItem("motionx_jewelry_error", errorMsg || "");
            localStorage.setItem("motionx_jewelry_template_id", templateId);
            localStorage.setItem("motionx_jewelry_brand_preset", brandPreset);
            localStorage.setItem("motionx_jewelry_aspect_ratio", aspectRatio);
        } else {
            localStorage.removeItem("motionx_jewelry_run_id");
            localStorage.removeItem("motionx_jewelry_sku");
            localStorage.removeItem("motionx_jewelry_status");
            localStorage.removeItem("motionx_jewelry_progress");
            localStorage.removeItem("motionx_jewelry_step_desc");
            localStorage.removeItem("motionx_jewelry_video_url");
            localStorage.removeItem("motionx_jewelry_error");
            localStorage.removeItem("motionx_jewelry_template_id");
            localStorage.removeItem("motionx_jewelry_brand_preset");
            localStorage.removeItem("motionx_jewelry_aspect_ratio");
        }
    }, [runId, sku, runStatus, runProgress, runStepDesc, finalVideoUrl, errorMsg, templateId, brandPreset, aspectRatio]);

    // ── Polling ──
    useEffect(() => {
        if (!runId || runStatus === "completed" || runStatus === "error" || !currentUser) {
            if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
            return;
        }
        const poll = async () => {
            try {
                const token = await currentUser.getIdToken();
                const res = await fetch(`${API_BASE_URL}/api/v1/jewelry/${runId}/status`, {
                    headers: { "Authorization": `Bearer ${token}` }
                });
                if (res.status === 200) {
                    const data = await res.json();
                    setRunStatus(data.status);
                    setRunProgress(data.progress || 0);
                    setRunStepDesc(data.step_desc || "");
                    if (data.status === "completed") {
                        setFinalVideoUrl(data.final_video_url);
                        toast.success("Video ready!");
                        fetchHistory();
                    } else if (data.status === "error") {
                        setErrorMsg(data.error || "An error occurred.");
                        toast.error("Generation failed.");
                        fetchHistory();
                    }
                }
            } catch (e) { console.error("Poll error:", e); }
        };
        poll();
        pollingIntervalRef.current = setInterval(poll, 5000);
        return () => { if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current); };
    }, [runId, runStatus, currentUser]);

    const resetForm = () => {
        setRunId(null); setRunStatus(null); setRunProgress(0);
        setRunStepDesc(""); setFinalVideoUrl(null); setErrorMsg(null);
        setProductFiles([]); setModelFile(null);
        setCancelling(false); setIsStale(false);
    };

    // ── Cancel a running generation ──
    const handleCancelRun = async (targetRunId?: string) => {
        const rid = targetRunId || runId;
        if (!rid || !currentUser) return;
        try {
            setCancelling(true);
            const token = await currentUser.getIdToken();
            const res = await fetch(`${API_BASE_URL}/api/v1/jewelry/${rid}/cancel`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${token}` },
            });
            if (res.ok) {
                toast.success("Generation cancelled. Credits refunded.");
                if (!targetRunId || targetRunId === runId) {
                    resetForm();
                }
                fetchHistory();
            } else {
                const data = await res.json();
                toast.error(data.detail || "Failed to cancel.");
            }
        } catch (e: any) {
            toast.error(e.message || "Failed to cancel.");
        } finally {
            setCancelling(false);
        }
    };

    // ── Delete a run from history ──
    const handleDeleteRun = async (targetRunId: string) => {
        if (!currentUser) return;
        try {
            const token = await currentUser.getIdToken();
            const res = await fetch(`${API_BASE_URL}/api/v1/jewelry/${targetRunId}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${token}` },
            });
            if (res.ok) {
                toast.success("Generation deleted.");
                if (targetRunId === runId) {
                    resetForm();
                }
                fetchHistory();
            } else {
                const data = await res.json();
                toast.error(data.detail || "Failed to delete.");
            }
        } catch (e: any) {
            toast.error(e.message || "Failed to delete.");
        }
    };

    // ── Track staleness: if progress hasn't changed for 3 minutes, show warning ──
    useEffect(() => {
        setLastProgressChange(Date.now());
        setIsStale(false);
    }, [runProgress]);

    useEffect(() => {
        if (!runId || runStatus === "completed" || runStatus === "error") {
            setIsStale(false);
            return;
        }
        const interval = setInterval(() => {
            const elapsed = Date.now() - lastProgressChange;
            if (elapsed > 3 * 60 * 1000) {
                setIsStale(true);
            }
        }, 10_000);
        return () => clearInterval(interval);
    }, [runId, runStatus, lastProgressChange]);

    const selectedPreset = BRAND_PRESETS.find(p => p.id === brandPreset)!;

    return (
        <div className="w-full h-full bg-[#111111] text-[#EDEDED] flex flex-col overflow-hidden relative select-none">
            {/* Film grain + vignette (consistent with dashboard) */}
            <div className="film-grain" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)] pointer-events-none z-[1]" />

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto no-scrollbar relative z-10 p-4 sm:p-6 lg:p-8">

                {!runStatus ? (
                    <>
                        {/* ═══ HERO MONITOR ═══ */}
                        <div className="relative bg-black border border-white/[0.08] rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.8)] overflow-hidden h-[28vh] min-h-[180px] max-h-[280px] mb-8 group transition-colors hover:border-white/[0.12]">
                            {/* Viewfinder corners */}
                            <div className="absolute inset-0 pointer-events-none z-20 p-5">
                                <div className="absolute top-5 left-5 w-6 h-6 border-l border-t border-white/[0.1]" />
                                <div className="absolute top-5 right-5 w-6 h-6 border-r border-t border-white/[0.1]" />
                                <div className="absolute bottom-5 left-5 w-6 h-6 border-l border-b border-white/[0.1]" />
                                <div className="absolute bottom-5 right-5 w-6 h-6 border-r border-b border-white/[0.1]" />
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"><Crosshair size={32} strokeWidth={0.5} className="text-white/[0.06]" /></div>
                            </div>

                            {/* Background gradient */}
                            <div className="absolute inset-0 bg-gradient-to-br from-[#0a0000] via-[#0f0808] to-[#111111]" />
                            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.6)_100%)] pointer-events-none" />

                            {/* Content */}
                            <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-6 z-30 bg-gradient-to-t from-black/95 via-black/60 to-transparent">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-[8px] font-bold px-2.5 py-1 rounded-md uppercase tracking-[2px] border border-[#D40A12]/30 bg-[#D40A12]/10 text-[#D40A12]">
                                        B2B Engine
                                    </span>
                                    <span className="text-[8px] font-bold px-2.5 py-1 rounded-md uppercase tracking-[2px] border border-white/10 bg-white/[0.03] text-white/40">
                                        Seedance 2.0
                                    </span>
                                </div>
                                <h1 className="text-[28px] sm:text-[36px] lg:text-[44px] font-['Anton'] uppercase leading-[0.9] tracking-[1px] text-white drop-shadow-2xl">
                                    Jewelry Video Ads
                                </h1>
                                <p className="text-[11px] sm:text-[12px] text-white/40 mt-2 max-w-lg leading-relaxed">
                                    Upload product photos → Pick a studio environment → Get a 15-second cinematic commercial.
                                </p>
                            </div>

                            {/* Decorative gem icon */}
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 opacity-[0.03]">
                                <Gem size={160} strokeWidth={0.5} />
                            </div>
                        </div>

                        {/* ═══ MAIN FORM ═══ */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-7xl">

                            {/* ── LEFT: Config Panels ── */}
                            <div className="lg:col-span-8 flex flex-col gap-6">

                                {/* Template Selection */}
                                <section>
                                    <SectionLabel>Video Type</SectionLabel>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                                        <TemplateCard
                                            active={templateId === "product_only"}
                                            onClick={() => setTemplateId("product_only")}
                                            icon={<Camera size={18} />}
                                            title="Product Showcase"
                                            desc="Upload product photos from any angle. AI creates a cinematic studio showcase."
                                            credits={10}
                                        />
                                        <TemplateCard
                                            active={templateId === "product_human"}
                                            onClick={() => setTemplateId("product_human")}
                                            icon={<User size={18} />}
                                            title="Product + Model"
                                            desc="Combine product photos with a model photo for a lifestyle video ad."
                                            credits={20}
                                        />
                                    </div>
                                </section>

                                {/* Upload Product Photos */}
                                <section>
                                    <div className="flex items-center justify-between">
                                        <SectionLabel>Product Photos</SectionLabel>
                                        <span className="text-[9px] font-mono text-white/20 tracking-wider">{productFiles.length}/9</span>
                                    </div>
                                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2.5 mt-3">
                                        {productFiles.map((file, idx) => (
                                            <div
                                                key={idx}
                                                className="aspect-square rounded-xl border border-white/[0.08] bg-[#1a1a1a] relative group overflow-hidden hover:border-white/[0.15] hover:shadow-[0_4px_20px_rgba(0,0,0,0.5)] transition-all duration-300"
                                            >
                                                <img
                                                    src={URL.createObjectURL(file)}
                                                    alt={file.name}
                                                    className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
                                                />
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); removeProductFile(idx); }}
                                                    className="absolute top-1.5 right-1.5 w-5 h-5 bg-black/70 backdrop-blur-sm rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer border border-white/10"
                                                >
                                                    <X size={10} className="text-white/80" />
                                                </button>
                                                <span className="absolute bottom-1.5 left-1.5 text-[7px] font-bold font-mono bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded text-[#D40A12] border border-white/[0.06]">
                                                    @image{idx + 1}
                                                </span>
                                            </div>
                                        ))}

                                        {productFiles.length < 9 && (
                                            <div
                                                onClick={() => productInputRef.current?.click()}
                                                className="aspect-square rounded-xl border border-dashed border-white/[0.08] bg-[#161616] hover:border-[#D40A12]/40 hover:bg-[#1a1a1a] cursor-pointer flex flex-col items-center justify-center gap-1.5 transition-all duration-300 group"
                                            >
                                                <ImagePlus className="text-white/15 group-hover:text-[#D40A12]/60 transition-colors" size={20} />
                                                <span className="text-[7px] text-white/20 font-bold uppercase tracking-widest group-hover:text-white/40 transition-colors">Add</span>
                                            </div>
                                        )}
                                    </div>
                                    <input
                                        ref={productInputRef} type="file" accept="image/*" multiple className="hidden"
                                        onChange={(e) => { if (e.target.files) handleProductFilesAdd(e.target.files); e.target.value = ""; }}
                                    />
                                </section>

                                {/* Model Photo (conditional) */}
                                {templateId === "product_human" && (
                                    <section>
                                        <SectionLabel>Model Photo</SectionLabel>
                                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2.5 mt-3">
                                            {modelFile ? (
                                                <div className="aspect-square rounded-xl border border-white/[0.08] bg-[#1a1a1a] relative group overflow-hidden hover:border-white/[0.15] transition-all duration-300">
                                                    <img src={URL.createObjectURL(modelFile)} alt="Model" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500" />
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />
                                                    <button
                                                        onClick={() => setModelFile(null)}
                                                        className="absolute top-1.5 right-1.5 w-5 h-5 bg-black/70 backdrop-blur-sm rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer border border-white/10"
                                                    >
                                                        <X size={10} className="text-white/80" />
                                                    </button>
                                                    <span className="absolute bottom-1.5 left-1.5 text-[7px] font-bold font-mono bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded text-purple-400 border border-white/[0.06]">Model</span>
                                                </div>
                                            ) : (
                                                <div
                                                    onClick={() => modelInputRef.current?.click()}
                                                    className="aspect-square rounded-xl border border-dashed border-white/[0.08] bg-[#161616] hover:border-purple-400/40 hover:bg-[#1a1a1a] cursor-pointer flex flex-col items-center justify-center gap-1.5 transition-all duration-300 group"
                                                >
                                                    <User className="text-white/15 group-hover:text-purple-400/60 transition-colors" size={20} />
                                                    <span className="text-[7px] text-white/20 font-bold uppercase tracking-widest group-hover:text-white/40 transition-colors">Person</span>
                                                </div>
                                            )}
                                        </div>
                                        <input
                                            ref={modelInputRef} type="file" accept="image/*" className="hidden"
                                            onChange={(e) => { if (e.target.files?.[0]) setModelFile(e.target.files[0]); e.target.value = ""; }}
                                        />
                                    </section>
                                )}

                                {/* Brand Preset */}
                                <section>
                                    <SectionLabel>Studio Environment</SectionLabel>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 mt-3">
                                        {BRAND_PRESETS.map(preset => (
                                            <div
                                                key={preset.id}
                                                onClick={() => setBrandPreset(preset.id)}
                                                className={`p-3 rounded-xl border cursor-pointer flex flex-col gap-1.5 transition-all duration-300 bg-gradient-to-br ${preset.colorClass} ${
                                                    brandPreset === preset.id
                                                        ? `${preset.borderActive} ring-1 ring-[#D40A12]/20 shadow-[0_4px_20px_rgba(0,0,0,0.4)]`
                                                        : "border-white/[0.06] opacity-50 hover:opacity-80"
                                                }`}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[12px]">{preset.icon}</span>
                                                    <span className="text-[10px] font-bold uppercase tracking-wider leading-none">{preset.name}</span>
                                                </div>
                                                <p className="text-[8px] text-white/30 leading-snug">{preset.description}</p>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            </div>

                            {/* ── RIGHT: Settings Panel ── */}
                            <div className="lg:col-span-4">
                                <div className="glass-panel rounded-2xl p-5 flex flex-col gap-5 sticky top-0">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-bold uppercase tracking-[2px]">Settings</span>
                                        <span className="text-[8px] font-mono text-white/20 uppercase tracking-wider">Output Config</span>
                                    </div>

                                    {/* SKU */}
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[9px] font-bold uppercase tracking-[1.5px] text-white/30">Product Name / SKU</label>
                                        <input
                                            type="text" value={sku} onChange={(e) => setSku(e.target.value)}
                                            className="w-full bg-[#111111] border border-white/[0.08] rounded-lg px-3.5 py-2.5 text-[11px] font-mono text-white/90 focus:border-[#D40A12]/50 transition-colors placeholder:text-white/15"
                                            placeholder="e.g., Diamond Ring 02"
                                        />
                                    </div>

                                    {/* Aspect Ratio */}
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[9px] font-bold uppercase tracking-[1.5px] text-white/30">Orientation</label>
                                        <div className="grid grid-cols-3 gap-1.5">
                                            {(["9:16", "1:1", "16:9"] as const).map(ratio => (
                                                <button
                                                    key={ratio} onClick={() => setAspectRatio(ratio)}
                                                    className={`py-2 text-[10px] font-mono rounded-lg border font-bold cursor-pointer transition-all duration-200 ${
                                                        aspectRatio === ratio
                                                            ? "bg-[#D40A12] text-white border-transparent shadow-[0_2px_10px_rgba(212,10,18,0.3)]"
                                                            : "bg-[#111111] border-white/[0.08] text-white/30 hover:text-white/60 hover:border-white/[0.15]"
                                                    }`}
                                                >
                                                    {ratio === "9:16" ? "9:16" : ratio === "16:9" ? "16:9" : "1:1"}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Summary */}
                                    <div className="border-t border-white/[0.06] pt-4 flex flex-col gap-2.5">
                                        <InfoRow label="Video" value="15 seconds" />
                                        <InfoRow label="Photos" value={`${productFiles.length} product${templateId === "product_human" && modelFile ? " + 1 model" : ""}`} />
                                        <InfoRow label="Environment" value={selectedPreset.name} />
                                        <InfoRow label="Cost" value={`${templateId === "product_only" ? "10" : "20"} credits`} accent />
                                    </div>

                                    {/* Generate Button */}
                                    <button
                                        onClick={handleGenerate}
                                        disabled={uploading || productFiles.length === 0}
                                        className="w-full bg-[#D40A12] text-white py-3 rounded-xl font-bold text-[10px] uppercase tracking-[2px] hover:brightness-110 disabled:opacity-30 transition-all flex items-center justify-center gap-2 cursor-pointer border-none shadow-[0_4px_20px_rgba(212,10,18,0.25)] glow-pulse"
                                    >
                                        {uploading ? (
                                            <><Loader2 className="animate-spin" size={13} /> Uploading…</>
                                        ) : (
                                            <><Sparkles size={13} /> Generate Video</>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    /* ═══ PIPELINE STATE ═══ */
                    <div className="flex-1 flex items-center justify-center min-h-[60vh]">
                        <div className="w-full max-w-lg">
                            {/* Monitor-style panel */}
                            <div className="relative bg-black border border-white/[0.08] rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.8)] overflow-hidden">
                                {/* Viewfinder corners */}
                                <div className="absolute inset-0 pointer-events-none z-20 p-4">
                                    <div className="absolute top-4 left-4 w-5 h-5 border-l border-t border-white/[0.08]" />
                                    <div className="absolute top-4 right-4 w-5 h-5 border-r border-t border-white/[0.08]" />
                                    <div className="absolute bottom-4 left-4 w-5 h-5 border-l border-b border-white/[0.08]" />
                                    <div className="absolute bottom-4 right-4 w-5 h-5 border-r border-b border-white/[0.08]" />
                                </div>

                                {/* Progress bar */}
                                <div className="absolute top-0 left-0 right-0 h-[3px] bg-white/[0.04] z-30">
                                    <div
                                        className="h-full bg-[#D40A12] transition-all duration-700 ease-out"
                                        style={{ width: `${runProgress}%`, boxShadow: "0 0 12px #D40A12" }}
                                    />
                                </div>

                                <div className="p-8 sm:p-10">
                                    {runStatus !== "completed" && runStatus !== "error" ? (
                                        /* ── Rendering ── */
                                        <div className="flex flex-col items-center gap-6 text-center">
                                            <div className="relative">
                                                <div className="w-20 h-20 rounded-full border-2 border-[#D40A12]/20 border-t-[#D40A12] animate-spin" />
                                                <Gem size={22} className="text-[#D40A12] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <span className="text-[9px] font-bold tracking-[3px] uppercase text-[#D40A12]">Rendering</span>
                                                <p className="text-[18px] text-white font-['Anton'] uppercase tracking-wider">
                                                    {runProgress}%
                                                </p>
                                                <p className="text-[10px] text-white/30 font-mono leading-snug mt-1 max-w-xs">
                                                    {runStepDesc || "Sending to Seedance 2.0…"}
                                                </p>
                                            </div>

                                            {/* Staleness warning */}
                                            {isStale && (
                                                <div className="bg-amber-950/30 border border-amber-700/30 rounded-lg p-3 max-w-xs">
                                                    <p className="text-[9px] text-amber-400 font-mono leading-snug">
                                                        ⚠ This generation appears stuck. Progress hasn't changed for 3+ minutes. You can cancel and retry.
                                                    </p>
                                                </div>
                                            )}

                                            {/* Cancel button */}
                                            <button
                                                onClick={() => handleCancelRun()}
                                                disabled={cancelling}
                                                className="flex items-center justify-center gap-2 bg-white/[0.04] border border-white/[0.08] text-white/50 font-bold text-[9px] uppercase tracking-[1.5px] px-5 py-2.5 rounded-lg hover:bg-red-950/30 hover:border-red-800/30 hover:text-red-400 transition-all cursor-pointer mt-2"
                                            >
                                                {cancelling ? (
                                                    <><Loader2 className="animate-spin" size={11} /> Cancelling…</>
                                                ) : (
                                                    <><XCircle size={11} /> Cancel Generation</>
                                                )}
                                            </button>
                                        </div>
                                    ) : runStatus === "completed" && finalVideoUrl ? (
                                        /* ── Complete ── */
                                        <div className="w-full flex flex-col items-center gap-6">
                                            <div className="flex flex-col items-center gap-2 text-center">
                                                <CheckCircle2 className="text-[#22C55E]" size={40} />
                                                <span className="text-[8px] font-bold tracking-[3px] uppercase text-[#22C55E] mt-1">Ready</span>
                                                <h2 className="text-[20px] font-['Anton'] uppercase tracking-wider">{sku || "Product"} Ad</h2>
                                            </div>

                                            {/* Video Player */}
                                            <div className="relative aspect-[9/16] w-[220px] rounded-xl overflow-hidden border border-white/[0.08] shadow-[0_8px_30px_rgba(0,0,0,0.6)] bg-black group">
                                                <video src={finalVideoUrl} controls autoPlay loop playsInline className="w-full h-full object-cover" />
                                                {/* Viewfinder on video */}
                                                <div className="absolute inset-0 pointer-events-none p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <div className="absolute top-3 left-3 w-4 h-4 border-l border-t border-white/20" />
                                                    <div className="absolute top-3 right-3 w-4 h-4 border-r border-t border-white/20" />
                                                    <div className="absolute bottom-3 left-3 w-4 h-4 border-l border-b border-white/20" />
                                                    <div className="absolute bottom-3 right-3 w-4 h-4 border-r border-b border-white/20" />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3 w-full mt-2">
                                                <a
                                                    href={finalVideoUrl} download={`jewelry_${sku || "video"}.mp4`} target="_blank" rel="noreferrer"
                                                    className="flex items-center justify-center gap-2 bg-white text-black font-bold text-[9px] uppercase tracking-[1.5px] py-2.5 rounded-lg hover:brightness-90 transition-all cursor-pointer no-underline"
                                                >
                                                    <DownloadIcon size={12} /> Download
                                                </a>
                                                <button
                                                    onClick={resetForm}
                                                    className="flex items-center justify-center gap-2 bg-white/[0.04] border border-white/[0.08] text-white/70 font-bold text-[9px] uppercase tracking-[1.5px] py-2.5 rounded-lg hover:bg-white/[0.08] hover:text-white transition-all cursor-pointer"
                                                >
                                                    <RefreshCw size={11} /> New Video
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        /* ── Error ── */
                                        <div className="w-full flex flex-col items-center gap-5 text-center">
                                            <AlertCircle className="text-[#EF4444]" size={40} />
                                            <div className="flex flex-col gap-2">
                                                <span className="text-[9px] font-bold tracking-[3px] uppercase text-[#EF4444]">Error</span>
                                                <h2 className="text-[16px] font-['Anton'] uppercase tracking-wider">Generation Failed</h2>
                                                <p className="text-[10px] text-white/40 bg-red-950/20 border border-red-900/20 rounded-lg p-3 max-w-sm mx-auto font-mono text-left break-words">
                                                    {errorMsg || "Unknown error."}
                                                </p>
                                            </div>
                                            <button
                                                onClick={resetForm}
                                                className="flex items-center justify-center gap-2 bg-[#D40A12] text-white font-bold text-[9px] uppercase tracking-[1.5px] px-5 py-2.5 rounded-lg hover:brightness-110 transition-all cursor-pointer border-none shadow-[0_2px_10px_rgba(212,10,18,0.2)]"
                                            >
                                                <RefreshCw size={11} /> Try Again
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ═══ PREVIOUS GENERATIONS ═══ */}
                {history.length > 0 && (
                    <section className="mt-12 border-t border-white/[0.06] pt-8 max-w-7xl relative z-10">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-2">
                                <Layers size={14} className="text-[#D40A12]" />
                                <span className="text-[10px] font-bold uppercase tracking-[2px] text-white/80">Previous Generations</span>
                            </div>
                            <button
                                onClick={fetchHistory}
                                disabled={loadingHistory}
                                className="text-[9px] uppercase tracking-wider text-white/40 hover:text-white/85 transition-colors bg-transparent border-none cursor-pointer flex items-center gap-1.5"
                            >
                                <RefreshCw size={10} className={loadingHistory ? "animate-spin" : ""} /> Refresh
                            </button>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {history.map((item) => (
                                <HistoryCard key={item.run_id} item={item} onDelete={handleDeleteRun} onCancel={handleCancelRun} />
                            ))}
                        </div>
                    </section>
                )}
            </div>
        </div>
    );
}


// ── Sub-Components ──

function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <span className="text-[9px] font-bold uppercase tracking-[2px] text-white/25 block">
            {children}
        </span>
    );
}

function TemplateCard({ active, onClick, icon, title, desc, credits }: {
    active: boolean; onClick: () => void; icon: React.ReactNode;
    title: string; desc: string; credits: number;
}) {
    return (
        <div
            onClick={onClick}
            className={`p-4 rounded-xl border cursor-pointer flex flex-col gap-2.5 transition-all duration-300 relative overflow-hidden group ${
                active
                    ? "bg-[#D40A12]/[0.06] border-[#D40A12]/60 shadow-[0_0_20px_rgba(212,10,18,0.1)]"
                    : "bg-[#161616] border-white/[0.06] hover:border-white/[0.12] hover:bg-[#1a1a1a]"
            }`}
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                    <div className={`p-1.5 rounded-lg ${active ? "bg-[#D40A12]/20 text-[#D40A12]" : "bg-white/[0.04] text-white/30"} transition-colors`}>
                        {icon}
                    </div>
                    <span className="text-[12px] font-bold tracking-wide">{title}</span>
                </div>
                <span className={`text-[8px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider ${
                    active ? "bg-[#D40A12] text-white" : "bg-white/[0.04] text-white/30 border border-white/[0.06]"
                }`}>
                    {credits} cr
                </span>
            </div>
            <p className="text-[10px] text-white/35 leading-relaxed">{desc}</p>
        </div>
    );
}

function InfoRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
    return (
        <div className="flex items-center justify-between text-[10px]">
            <span className="text-white/25 font-mono uppercase tracking-wider">{label}</span>
            <span className={`font-bold ${accent ? "text-[#D40A12]" : "text-white/70"}`}>{value}</span>
        </div>
    );
}

function HistoryCard({ item, onDelete, onCancel }: { item: any; onDelete: (runId: string) => void; onCancel: (runId: string) => void }) {
    const isCompleted = item.status === "completed";
    const isError = item.status === "error";
    const isInProgress = !isCompleted && !isError;
    const presetName = BRAND_PRESETS.find(p => p.id === item.brand_preset)?.name || item.brand_preset;
    
    const dateStr = item.created_at
        ? new Date(item.created_at).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit"
          })
        : "Unknown date";

    return (
        <div className="glass-panel rounded-xl overflow-hidden border border-white/[0.06] bg-[#161616]/60 flex flex-col group hover:border-white/[0.12] hover:bg-[#1a1a1a]/80 transition-all duration-300 relative">
            {/* Delete button — always visible on hover */}
            <button
                onClick={(e) => { e.stopPropagation(); onDelete(item.run_id); }}
                className="absolute top-2 left-2 z-30 w-6 h-6 bg-black/70 backdrop-blur-sm rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer border border-white/10 hover:bg-red-950/60 hover:border-red-800/30"
                title="Delete"
            >
                <Trash2 size={10} className="text-white/60 hover:text-red-400" />
            </button>

            <div className="aspect-[9/16] w-full bg-black relative flex items-center justify-center overflow-hidden border-b border-white/[0.04] max-h-[300px]">
                {isCompleted && item.final_video_url ? (
                    <>
                        <video
                            src={item.final_video_url}
                            preload="metadata"
                            muted
                            loop
                            playsInline
                            className="w-full h-full object-cover opacity-65 group-hover:opacity-100 group-hover:scale-[1.03] transition-all duration-500"
                            onMouseOver={(e) => (e.target as HTMLVideoElement).play().catch(() => {})}
                            onMouseOut={(e) => {
                                const v = e.target as HTMLVideoElement;
                                v.pause();
                                v.currentTime = 0;
                            }}
                        />
                        <div className="absolute top-2.5 right-2.5 w-6 h-6 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center border border-white/10 pointer-events-none opacity-80 group-hover:opacity-100 transition-opacity">
                            <Play size={10} className="text-white fill-white ml-0.5" />
                        </div>
                    </>
                ) : isError ? (
                    <div className="flex flex-col items-center gap-1.5 p-4 text-center">
                        <AlertCircle className="text-[#EF4444]/60" size={24} />
                        <span className="text-[8px] font-bold uppercase tracking-wider text-[#EF4444]">Failed</span>
                        <p className="text-[8px] text-white/30 line-clamp-2 max-w-[150px] font-mono">{item.error || "Generation error"}</p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-2 text-center p-4">
                        <Loader2 className="animate-spin text-[#D40A12]/60" size={24} />
                        <span className="text-[8px] font-bold uppercase tracking-[2px] text-[#D40A12] animate-pulse">Rendering</span>
                        <span className="text-[9px] font-mono text-white/30">{item.progress || 0}%</span>
                        {/* Cancel button for in-progress items */}
                        <button
                            onClick={(e) => { e.stopPropagation(); onCancel(item.run_id); }}
                            className="mt-1 flex items-center justify-center gap-1 bg-white/[0.04] border border-white/[0.08] text-white/40 font-bold text-[7px] uppercase tracking-wider px-3 py-1 rounded hover:bg-red-950/30 hover:border-red-800/30 hover:text-red-400 transition-all cursor-pointer"
                        >
                            <XCircle size={8} /> Cancel
                        </button>
                    </div>
                )}
                
                <div className="absolute inset-0 pointer-events-none p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="absolute top-2 left-2 w-2 h-2 border-l border-t border-white/30" />
                    <div className="absolute top-2 right-2 w-2 h-2 border-r border-t border-white/30" />
                    <div className="absolute bottom-2 left-2 w-2 h-2 border-l border-b border-white/30" />
                    <div className="absolute bottom-2 right-2 w-2 h-2 border-r border-b border-white/30" />
                </div>
            </div>

            <div className="p-3.5 flex flex-col gap-1.5 flex-1 justify-between">
                <div>
                    <div className="flex items-start justify-between gap-1">
                        <span className="text-[11px] font-bold truncate text-white/95 uppercase tracking-wide max-w-[80%]">
                            {item.sku || "Jewelry Ad"}
                        </span>
                        <span className="text-[7px] font-mono text-white/30 shrink-0 mt-0.5">{dateStr}</span>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        <span className="text-[7px] font-bold font-mono bg-white/[0.04] text-white/40 px-1.5 py-0.5 rounded border border-white/[0.04] uppercase">
                            {presetName}
                        </span>
                        <span className="text-[7px] font-bold font-mono bg-white/[0.04] text-white/40 px-1.5 py-0.5 rounded border border-white/[0.04] uppercase">
                            {item.aspect_ratio || "9:16"}
                        </span>
                    </div>
                </div>

                {isCompleted && item.final_video_url && (
                    <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-white/[0.04] mt-2">
                        <a
                            href={item.final_video_url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center justify-center gap-1.5 bg-white text-black font-bold text-[8px] uppercase tracking-wider py-1.5 rounded hover:brightness-95 transition-all no-underline"
                        >
                            <Play size={8} fill="black" /> View
                        </a>
                        <a
                            href={item.final_video_url}
                            download={`jewelry_${item.sku || "video"}.mp4`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center justify-center gap-1.5 bg-white/[0.04] border border-white/[0.08] text-white/80 font-bold text-[8px] uppercase tracking-wider py-1.5 rounded hover:bg-white/[0.08] hover:text-white transition-all no-underline"
                        >
                            <DownloadIcon size={8} /> Save
                        </a>
                    </div>
                )}
            </div>
        </div>
    );
}
