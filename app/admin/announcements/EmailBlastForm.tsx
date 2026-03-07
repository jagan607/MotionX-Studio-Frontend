"use client";

import { useState, useRef, useEffect } from "react";
import { storage, auth } from "@/lib/firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import {
    Mail, Upload, X, Loader2, Image as ImageIcon, Film, Send,
    Eye, EyeOff, ChevronDown, Users, Crown, Building, Gift,
    Plus, LinkIcon, Type, FileText, Palette
} from "lucide-react";
import { API_BASE_URL } from "@/lib/config";

type Target = "all" | "pro" | "enterprise" | "free" | "custom";

interface UploadedMedia {
    url: string;
    type: "image" | "video" | "banner" | "video_thumbnail";
    name: string;
}

const TARGET_OPTIONS: { value: Target; label: string; icon: any; desc: string }[] = [
    { value: "all", label: "All Users", icon: Users, desc: "Every registered user" },
    { value: "pro", label: "Pro Plan", icon: Crown, desc: "Pro subscribers only" },
    { value: "enterprise", label: "Enterprise", icon: Building, desc: "Enterprise accounts" },
    { value: "free", label: "Free Tier", icon: Gift, desc: "Free plan users" },
    { value: "custom", label: "Custom List", icon: Mail, desc: "Specific email addresses" },
];

const TAG_OPTIONS = ["UPDATE", "NEW FEATURE", "FIX", "ANNOUNCEMENT", "MAINTENANCE"];

export function EmailBlastForm() {
    // Form state
    const [subject, setSubject] = useState("");
    const [heading, setHeading] = useState("");
    const [body, setBody] = useState("");
    const [ctaText, setCtaText] = useState("");
    const [ctaUrl, setCtaUrl] = useState("");
    const [tag, setTag] = useState("UPDATE");
    const [target, setTarget] = useState<Target>("all");
    const [customRecipients, setCustomRecipients] = useState("");

    // Media state
    const [images, setImages] = useState<UploadedMedia[]>([]);
    const [videoUrl, setVideoUrl] = useState("");
    const [videoThumbnailUrl, setVideoThumbnailUrl] = useState("");
    const [bannerUrl, setBannerUrl] = useState("");
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadType, setUploadType] = useState<"image" | "video" | "banner" | "video_thumbnail">("image");

    // UI state
    const [showPreview, setShowPreview] = useState(false);
    const [sending, setSending] = useState(false);
    const [result, setResult] = useState<{ status: string; recipient_count: number } | null>(null);
    const [error, setError] = useState("");

    const imageInputRef = useRef<HTMLInputElement>(null);
    const videoInputRef = useRef<HTMLInputElement>(null);
    const videoThumbInputRef = useRef<HTMLInputElement>(null);
    const bannerInputRef = useRef<HTMLInputElement>(null);

    // Parse body into paragraphs (split on double newlines)
    const paragraphs = body
        .split(/\n\s*\n/)
        .map(p => p.trim())
        .filter(Boolean);

    // Upload file to Firebase Storage
    const handleFileUpload = async (
        e: React.ChangeEvent<HTMLInputElement>,
        mediaType: "image" | "video" | "banner" | "video_thumbnail"
    ) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const isImage = file.type.startsWith("image/");
        const isVideo = file.type.startsWith("video/");

        if (mediaType === "video" && !isVideo) {
            setError("Please upload a video file");
            return;
        }
        if ((mediaType === "image" || mediaType === "banner" || mediaType === "video_thumbnail") && !isImage) {
            setError("Please upload an image file");
            return;
        }

        setUploading(true);
        setUploadProgress(0);
        setUploadType(mediaType);
        setError("");

        try {
            const timestamp = Date.now();
            const path = `email-blasts/${timestamp}_${file.name}`;
            const storageRef = ref(storage, path);
            const uploadTask = uploadBytesResumable(storageRef, file);

            uploadTask.on(
                "state_changed",
                (snapshot) => {
                    const pct = Math.round(
                        (snapshot.bytesTransferred / snapshot.totalBytes) * 100
                    );
                    setUploadProgress(pct);
                },
                (err) => {
                    console.error("Upload error:", err);
                    setError("Upload failed. Please try again.");
                    setUploading(false);
                },
                async () => {
                    const url = await getDownloadURL(uploadTask.snapshot.ref);
                    if (mediaType === "image") {
                        setImages(prev => [...prev, { url, type: "image", name: file.name }]);
                    } else if (mediaType === "video") {
                        setVideoUrl(url);
                    } else if (mediaType === "video_thumbnail") {
                        setVideoThumbnailUrl(url);
                    } else {
                        setBannerUrl(url);
                    }
                    setUploading(false);
                }
            );
        } catch (err) {
            console.error("Upload failed:", err);
            setError("Upload failed. Please try again.");
            setUploading(false);
        }
    };

    const removeImage = (idx: number) => {
        setImages(prev => prev.filter((_, i) => i !== idx));
    };

    // Send the email blast
    const handleSend = async () => {
        if (!subject.trim() || !heading.trim() || paragraphs.length === 0) {
            setError("Subject, heading, and body are required.");
            return;
        }

        setSending(true);
        setError("");
        setResult(null);

        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) {
                setError("Not authenticated. Please refresh and try again.");
                setSending(false);
                return;
            }

            const payload: any = {
                subject: subject.trim(),
                heading: heading.trim(),
                paragraphs,
                tag: tag || "UPDATE",
            };

            if (ctaText.trim()) payload.cta_text = ctaText.trim();
            if (ctaUrl.trim()) payload.cta_url = ctaUrl.trim();
            if (images.length > 0) payload.images = images.map(i => i.url);
            if (videoUrl) payload.video_url = videoUrl;
            if (videoThumbnailUrl) payload.video_thumbnail_url = videoThumbnailUrl;
            if (bannerUrl) payload.banner_url = bannerUrl;

            if (target === "custom") {
                const emails = customRecipients
                    .split(/[,;\n]/)
                    .map(e => e.trim())
                    .filter(e => e.includes("@"));
                if (emails.length === 0) {
                    setError("Please enter at least one valid email address.");
                    setSending(false);
                    return;
                }
                payload.recipients = emails;
            } else {
                payload.target = target;
            }

            const res = await fetch(`${API_BASE_URL}/api/admin/send-announcement`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.detail || `Request failed (${res.status})`);
            }

            const data = await res.json();
            setResult(data);

            // Reset form on success
            setSubject("");
            setHeading("");
            setBody("");
            setCtaText("");
            setCtaUrl("");
            setTag("UPDATE");
            setTarget("all");
            setCustomRecipients("");
            setImages([]);
            setVideoUrl("");
            setVideoThumbnailUrl("");
            setBannerUrl("");
        } catch (err: any) {
            console.error("Send failed:", err);
            setError(err.message || "Failed to send. Please try again.");
        } finally {
            setSending(false);
        }
    };

    // Clear result after 8s
    useEffect(() => {
        if (result) {
            const timer = setTimeout(() => setResult(null), 8000);
            return () => clearTimeout(timer);
        }
    }, [result]);

    const targetConfig = TARGET_OPTIONS.find(t => t.value === target)!;
    const TargetIcon = targetConfig.icon;

    return (
        <div className="space-y-6" id="email-blast">
            {/* ── COMPOSE SECTION ── */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">

                {/* LEFT: Form Fields */}
                <div className="space-y-5">

                    {/* Subject */}
                    <div className="space-y-1.5">
                        <label className="text-[9px] font-mono uppercase text-[#666] tracking-widest flex items-center gap-2">
                            <Mail size={10} />
                            Email Subject <span className="text-[#E50914]">*</span>
                        </label>
                        <input
                            value={subject}
                            onChange={e => setSubject(e.target.value)}
                            placeholder="e.g. New Feature: 4K Upscaling"
                            className="w-full bg-[#111] border border-[#333] text-white p-3 font-anton text-lg tracking-wide focus:border-[#E50914] outline-none transition-colors"
                        />
                    </div>

                    {/* Heading */}
                    <div className="space-y-1.5">
                        <label className="text-[9px] font-mono uppercase text-[#666] tracking-widest flex items-center gap-2">
                            <Type size={10} />
                            Heading <span className="text-[#E50914]">*</span>
                        </label>
                        <input
                            value={heading}
                            onChange={e => setHeading(e.target.value)}
                            placeholder="e.g. 4K Upscaling is Here"
                            className="w-full bg-[#111] border border-[#333] text-white p-3 text-sm font-semibold focus:border-[#E50914] outline-none transition-colors"
                        />
                    </div>

                    {/* Body → paragraphs */}
                    <div className="space-y-1.5">
                        <label className="text-[9px] font-mono uppercase text-[#666] tracking-widest flex items-center gap-2">
                            <FileText size={10} />
                            Body <span className="text-[#E50914]">*</span>
                            <span className="text-[#444] font-normal ml-1">(separate paragraphs with blank lines)</span>
                        </label>
                        <textarea
                            value={body}
                            onChange={e => setBody(e.target.value)}
                            rows={5}
                            placeholder={"We've just launched 4K video upscaling powered by AI.\n\nAll Pro users get 5 free upscales this month."}
                            className="w-full bg-[#111] border border-[#333] text-[#CCC] p-3 text-sm font-mono focus:border-[#E50914] outline-none transition-colors resize-none leading-relaxed"
                        />
                        {paragraphs.length > 0 && (
                            <span className="text-[8px] text-[#555] font-mono">{paragraphs.length} paragraph{paragraphs.length > 1 ? "s" : ""}</span>
                        )}
                    </div>

                    {/* CTA Row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-mono uppercase text-[#666] tracking-widest flex items-center gap-2">
                                <LinkIcon size={10} />
                                CTA Button Text
                            </label>
                            <input
                                value={ctaText}
                                onChange={e => setCtaText(e.target.value)}
                                placeholder='e.g. Try It Now →'
                                className="w-full bg-[#111] border border-[#333] text-[#AAA] p-3 text-xs font-mono focus:border-[#E50914] outline-none transition-colors"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-mono uppercase text-[#666] tracking-widest flex items-center gap-2">
                                <LinkIcon size={10} />
                                CTA URL
                            </label>
                            <input
                                value={ctaUrl}
                                onChange={e => setCtaUrl(e.target.value)}
                                placeholder="https://studio.motionx.in"
                                className="w-full bg-[#111] border border-[#333] text-[#AAA] p-3 text-xs font-mono focus:border-[#E50914] outline-none transition-colors"
                            />
                        </div>
                    </div>

                    {/* Tag + Target Row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Tag */}
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-mono uppercase text-[#666] tracking-widest flex items-center gap-2">
                                <Palette size={10} />
                                Tag Badge
                            </label>
                            <select
                                value={tag}
                                onChange={e => setTag(e.target.value)}
                                className="w-full bg-[#111] border border-[#333] text-[#AAA] p-3 text-xs font-mono focus:border-[#E50914] outline-none transition-colors h-[46px]"
                            >
                                {TAG_OPTIONS.map(t => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </select>
                        </div>

                        {/* Target */}
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-mono uppercase text-[#666] tracking-widest flex items-center gap-2">
                                <Users size={10} />
                                Target Audience
                            </label>
                            <select
                                value={target}
                                onChange={e => setTarget(e.target.value as Target)}
                                className="w-full bg-[#111] border border-[#333] text-[#AAA] p-3 text-xs font-mono focus:border-[#E50914] outline-none transition-colors h-[46px]"
                            >
                                {TARGET_OPTIONS.map(t => (
                                    <option key={t.value} value={t.value}>
                                        {t.label} — {t.desc}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Custom Recipients */}
                    {target === "custom" && (
                        <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
                            <label className="text-[9px] font-mono uppercase text-[#666] tracking-widest">
                                Recipient Emails <span className="text-[#E50914]">*</span>
                                <span className="text-[#444] font-normal ml-1">(comma or newline separated)</span>
                            </label>
                            <textarea
                                value={customRecipients}
                                onChange={e => setCustomRecipients(e.target.value)}
                                rows={3}
                                placeholder={"user1@example.com\nuser2@example.com"}
                                className="w-full bg-[#111] border border-[#333] text-[#AAA] p-3 text-xs font-mono focus:border-[#E50914] outline-none transition-colors resize-none"
                            />
                            {customRecipients && (
                                <span className="text-[8px] text-[#555] font-mono">
                                    {customRecipients.split(/[,;\n]/).filter(e => e.trim().includes("@")).length} valid email(s)
                                </span>
                            )}
                        </div>
                    )}

                    {/* ── MEDIA UPLOADS ── */}
                    <div className="space-y-3">
                        <label className="text-[9px] font-mono uppercase text-[#666] tracking-widest">
                            Media Attachments <span className="text-[#444]">(optional)</span>
                        </label>

                        <div className="flex flex-wrap gap-3">
                            {/* Image Upload */}
                            <input ref={imageInputRef} type="file" accept="image/*" onChange={e => handleFileUpload(e, "image")} className="hidden" />
                            <button
                                type="button"
                                onClick={() => imageInputRef.current?.click()}
                                disabled={uploading}
                                className="flex items-center gap-2 bg-[#111] border border-[#333] hover:border-[#555] px-4 py-2.5 text-[10px] font-mono text-[#888] uppercase tracking-widest transition-all cursor-pointer disabled:opacity-50"
                            >
                                <ImageIcon size={14} /> Add Image
                            </button>

                            {/* Video Upload */}
                            <input ref={videoInputRef} type="file" accept="video/*" onChange={e => handleFileUpload(e, "video")} className="hidden" />
                            <button
                                type="button"
                                onClick={() => videoInputRef.current?.click()}
                                disabled={uploading || !!videoUrl}
                                className="flex items-center gap-2 bg-[#111] border border-[#333] hover:border-[#555] px-4 py-2.5 text-[10px] font-mono text-[#888] uppercase tracking-widest transition-all cursor-pointer disabled:opacity-50"
                            >
                                <Film size={14} /> {videoUrl ? "Video Added" : "Add Video"}
                            </button>

                            {/* Video Thumbnail Upload (appears after video is added) */}
                            {videoUrl && (
                                <>
                                    <input ref={videoThumbInputRef} type="file" accept="image/*" onChange={e => handleFileUpload(e, "video_thumbnail")} className="hidden" />
                                    <button
                                        type="button"
                                        onClick={() => videoThumbInputRef.current?.click()}
                                        disabled={uploading || !!videoThumbnailUrl}
                                        className="flex items-center gap-2 bg-[#111] border border-[#333] hover:border-[#555] px-4 py-2.5 text-[10px] font-mono text-[#888] uppercase tracking-widest transition-all cursor-pointer disabled:opacity-50"
                                    >
                                        <ImageIcon size={14} /> {videoThumbnailUrl ? "Thumbnail Set" : "Video Thumbnail"}
                                    </button>
                                </>
                            )}

                            {/* Banner Upload */}
                            <input ref={bannerInputRef} type="file" accept="image/*" onChange={e => handleFileUpload(e, "banner")} className="hidden" />
                            <button
                                type="button"
                                onClick={() => bannerInputRef.current?.click()}
                                disabled={uploading || !!bannerUrl}
                                className="flex items-center gap-2 bg-[#111] border border-[#333] hover:border-[#555] px-4 py-2.5 text-[10px] font-mono text-[#888] uppercase tracking-widest transition-all cursor-pointer disabled:opacity-50"
                            >
                                <Palette size={14} /> {bannerUrl ? "Banner Set" : "Add Banner"}
                            </button>
                        </div>

                        {/* Upload Progress */}
                        {uploading && (
                            <div className="flex items-center gap-3">
                                <Loader2 size={14} className="animate-spin text-[#E50914]" />
                                <span className="text-[10px] font-mono text-[#666] uppercase tracking-widest">
                                    Uploading {uploadType}… {uploadProgress}%
                                </span>
                                <div className="flex-1 h-1 bg-[#222] rounded overflow-hidden">
                                    <div className="h-full bg-[#E50914] transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                                </div>
                            </div>
                        )}

                        {/* Uploaded Media Previews */}
                        {(images.length > 0 || videoUrl || bannerUrl) && (
                            <div className="flex flex-wrap gap-2 pt-1">
                                {bannerUrl && (
                                    <div className="relative group/media">
                                        <div className="w-32 h-16 rounded border border-[#333] overflow-hidden bg-[#111]">
                                            <img src={bannerUrl} alt="Banner" className="w-full h-full object-cover" />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => { setBannerUrl(""); if (bannerInputRef.current) bannerInputRef.current.value = ""; }}
                                            className="absolute -top-1.5 -right-1.5 bg-red-600 text-white rounded-full w-4 h-4 flex items-center justify-center cursor-pointer hover:bg-red-500 transition-colors opacity-0 group-hover/media:opacity-100"
                                        >
                                            <X size={8} />
                                        </button>
                                        <span className="text-[7px] text-[#555] font-mono uppercase mt-0.5 block">Banner</span>
                                    </div>
                                )}
                                {images.map((img, idx) => (
                                    <div key={idx} className="relative group/media">
                                        <div className="w-20 h-14 rounded border border-[#333] overflow-hidden bg-[#111]">
                                            <img src={img.url} alt="" className="w-full h-full object-cover" />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removeImage(idx)}
                                            className="absolute -top-1.5 -right-1.5 bg-red-600 text-white rounded-full w-4 h-4 flex items-center justify-center cursor-pointer hover:bg-red-500 transition-colors opacity-0 group-hover/media:opacity-100"
                                        >
                                            <X size={8} />
                                        </button>
                                        <span className="text-[7px] text-[#555] font-mono uppercase mt-0.5 block truncate w-20">Image {idx + 1}</span>
                                    </div>
                                ))}
                                {videoUrl && (
                                    <div className="relative group/media">
                                        <div className="w-20 h-14 rounded border border-[#333] overflow-hidden bg-[#111]">
                                            <video src={videoUrl} muted playsInline className="w-full h-full object-cover" />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => { setVideoUrl(""); setVideoThumbnailUrl(""); if (videoInputRef.current) videoInputRef.current.value = ""; if (videoThumbInputRef.current) videoThumbInputRef.current.value = ""; }}
                                            className="absolute -top-1.5 -right-1.5 bg-red-600 text-white rounded-full w-4 h-4 flex items-center justify-center cursor-pointer hover:bg-red-500 transition-colors opacity-0 group-hover/media:opacity-100"
                                        >
                                            <X size={8} />
                                        </button>
                                        <span className="text-[7px] text-[#555] font-mono uppercase mt-0.5 block">Video</span>
                                    </div>
                                )}
                                {videoThumbnailUrl && (
                                    <div className="relative group/media">
                                        <div className="w-20 h-14 rounded border border-[#333] overflow-hidden bg-[#111]">
                                            <img src={videoThumbnailUrl} alt="Thumbnail" className="w-full h-full object-cover" />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => { setVideoThumbnailUrl(""); if (videoThumbInputRef.current) videoThumbInputRef.current.value = ""; }}
                                            className="absolute -top-1.5 -right-1.5 bg-red-600 text-white rounded-full w-4 h-4 flex items-center justify-center cursor-pointer hover:bg-red-500 transition-colors opacity-0 group-hover/media:opacity-100"
                                        >
                                            <X size={8} />
                                        </button>
                                        <span className="text-[7px] text-[#555] font-mono uppercase mt-0.5 block">Thumb</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Error / Success */}
                    {error && (
                        <div className="bg-red-900/20 border border-red-900/50 text-red-400 text-[11px] font-mono px-4 py-3 rounded flex items-center gap-2">
                            <X size={14} /> {error}
                        </div>
                    )}
                    {result && (
                        <div className="bg-green-900/20 border border-green-900/50 text-green-400 text-[11px] font-mono px-4 py-3 rounded flex items-center gap-2 animate-in fade-in duration-300">
                            <Send size={14} />
                            Queued! Sending to <strong>{result.recipient_count}</strong> recipient{result.recipient_count !== 1 ? "s" : ""}.
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex items-center gap-3 pt-2">
                        <button
                            type="button"
                            onClick={() => setShowPreview(!showPreview)}
                            className="flex items-center gap-2 bg-[#111] border border-[#333] hover:border-[#555] text-[#AAA] hover:text-white px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-all cursor-pointer"
                        >
                            {showPreview ? <EyeOff size={14} /> : <Eye size={14} />}
                            {showPreview ? "Hide Preview" : "Preview Email"}
                        </button>
                        <button
                            type="button"
                            onClick={handleSend}
                            disabled={sending || uploading || !subject.trim() || !heading.trim() || !body.trim()}
                            className="flex items-center gap-2 bg-[#E50914] text-white hover:bg-[#ff1a25] px-6 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                            {sending ? "Sending…" : "Send Blast"}
                        </button>
                    </div>
                </div>

                {/* RIGHT: Live Preview Card */}
                {showPreview && (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-400">
                        <div className="sticky top-6 space-y-3">
                            <div className="flex items-center gap-2 mb-2">
                                <Eye size={12} className="text-[#555]" />
                                <span className="text-[9px] font-mono uppercase text-[#555] tracking-widest">Email Preview</span>
                            </div>

                            {/* Mock Email Card */}
                            <div className="bg-[#1a1a1a] border border-[#333] rounded-lg overflow-hidden shadow-2xl">
                                {/* Banner */}
                                <div
                                    className="w-full h-32 bg-cover bg-center relative"
                                    style={{
                                        backgroundImage: bannerUrl
                                            ? `url(${bannerUrl})`
                                            : "linear-gradient(135deg, #1a0000 0%, #0a0a0a 50%, #1a0000 100%)",
                                    }}
                                >
                                    <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a1a] to-transparent" />
                                    <div className="absolute bottom-3 left-4">
                                        {tag && (
                                            <span className="bg-[#E50914] text-white text-[7px] font-bold uppercase tracking-widest px-2 py-0.5 rounded">
                                                {tag}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="p-5 space-y-4">
                                    {/* Heading */}
                                    <h3 className="font-anton text-xl text-white uppercase tracking-wide leading-tight">
                                        {heading || "Your Heading Here"}
                                    </h3>

                                    {/* Paragraphs */}
                                    <div className="space-y-2.5">
                                        {(paragraphs.length > 0 ? paragraphs : ["Your email body text will appear here…"]).map((p, i) => (
                                            <p key={i} className="text-[12px] text-[#999] leading-relaxed">
                                                {p}
                                            </p>
                                        ))}
                                    </div>

                                    {/* Inline Images */}
                                    {images.length > 0 && (
                                        <div className="grid grid-cols-2 gap-2">
                                            {images.map((img, i) => (
                                                <div key={i} className="aspect-video rounded-md overflow-hidden border border-[#333]">
                                                    <img src={img.url} alt="" className="w-full h-full object-cover" />
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Video Thumbnail */}
                                    {videoUrl && (
                                        <div className="aspect-video rounded-md overflow-hidden border border-[#333] relative bg-black">
                                            {videoThumbnailUrl ? (
                                                <img src={videoThumbnailUrl} alt="Video thumbnail" className="w-full h-full object-cover opacity-80" />
                                            ) : (
                                                <video src={videoUrl} muted playsInline className="w-full h-full object-cover opacity-60" />
                                            )}
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <div className="w-12 h-12 rounded-full bg-[#E50914] flex items-center justify-center shadow-lg">
                                                    <div className="w-0 h-0 border-l-[10px] border-l-white border-y-[6px] border-y-transparent ml-1" />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* CTA Button */}
                                    {ctaText && (
                                        <div className="pt-2">
                                            <div className="inline-block bg-[#E50914] text-white text-[11px] font-bold uppercase tracking-widest px-6 py-3 rounded cursor-default">
                                                {ctaText}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Footer */}
                                <div className="px-5 py-3 border-t border-[#222] bg-[#111]">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[8px] text-[#444] font-mono uppercase tracking-widest">MotionX Studio</span>
                                        <div className="flex items-center gap-1.5">
                                            <TargetIcon size={10} className="text-[#555]" />
                                            <span className="text-[8px] text-[#555] font-mono uppercase tracking-widest">
                                                {targetConfig.label}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Subject line preview */}
                            <div className="bg-[#111] border border-[#222] rounded p-3">
                                <span className="text-[8px] text-[#555] font-mono uppercase tracking-widest block mb-1">Subject Line</span>
                                <span className="text-[12px] text-[#CCC]">{subject || "Your subject line here…"}</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
