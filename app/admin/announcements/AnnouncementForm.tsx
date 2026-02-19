"use client";

import { useState, useRef } from "react";
import { storage } from "@/lib/firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { Megaphone, Upload, X, Loader2, Image as ImageIcon, Film } from "lucide-react";

interface Props {
    onPublish: (formData: FormData) => void;
}

export function AnnouncementForm({ onPublish }: Props) {
    const [mediaUrl, setMediaUrl] = useState("");
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [preview, setPreview] = useState<{ url: string; type: 'image' | 'video' } | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        const isImage = file.type.startsWith('image/');
        const isVideo = file.type.startsWith('video/');
        if (!isImage && !isVideo) {
            alert("Please upload an image or video file");
            return;
        }

        setUploading(true);
        setUploadProgress(0);

        try {
            const timestamp = Date.now();
            const path = `announcements/${timestamp}_${file.name}`;
            const storageRef = ref(storage, path);
            const uploadTask = uploadBytesResumable(storageRef, file);

            uploadTask.on('state_changed',
                (snapshot) => {
                    const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
                    setUploadProgress(pct);
                },
                (error) => {
                    console.error("Upload error:", error);
                    setUploading(false);
                },
                async () => {
                    const url = await getDownloadURL(uploadTask.snapshot.ref);
                    setMediaUrl(url);
                    setPreview({ url, type: isVideo ? 'video' : 'image' });
                    setUploading(false);
                }
            );
        } catch (err) {
            console.error("Upload failed:", err);
            setUploading(false);
        }
    };

    const clearMedia = () => {
        setMediaUrl("");
        setPreview(null);
        if (fileRef.current) fileRef.current.value = "";
    };

    const handleSubmit = (formData: FormData) => {
        formData.set('media_url', mediaUrl);
        onPublish(formData);
        // Reset form
        setMediaUrl("");
        setPreview(null);
        if (fileRef.current) fileRef.current.value = "";
    };

    return (
        <form action={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_160px] gap-4">
                <div className="space-y-1">
                    <label className="text-[9px] font-mono uppercase text-[#666] tracking-widest">Title</label>
                    <input
                        name="title"
                        required
                        placeholder="e.g. Kling 3.0 Integration"
                        className="w-full bg-[#111] border border-[#333] text-white p-3 font-anton text-lg tracking-wide focus:border-[#E50914] outline-none transition-colors"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-[9px] font-mono uppercase text-[#666] tracking-widest">Type</label>
                    <select
                        name="type"
                        className="w-full bg-[#111] border border-[#333] text-[#AAA] p-3 text-xs font-mono focus:border-[#E50914] outline-none transition-colors h-[50px]"
                    >
                        <option value="feature">🚀 Feature</option>
                        <option value="update">⚡ Update</option>
                        <option value="fix">🔧 Fix</option>
                    </select>
                </div>
            </div>

            <div className="space-y-1">
                <label className="text-[9px] font-mono uppercase text-[#666] tracking-widest">Body</label>
                <textarea
                    name="body"
                    required
                    rows={3}
                    placeholder="Describe the announcement..."
                    className="w-full bg-[#111] border border-[#333] text-[#AAA] p-3 text-sm font-mono focus:border-[#E50914] outline-none transition-colors resize-none"
                />
            </div>

            {/* Media Upload */}
            <div className="space-y-2">
                <label className="text-[9px] font-mono uppercase text-[#666] tracking-widest">Media <span className="text-[#444]">(optional)</span></label>

                {preview ? (
                    <div className="relative inline-block">
                        <div className="w-40 h-24 rounded border border-[#333] overflow-hidden bg-[#111]">
                            {preview.type === 'video' ? (
                                <video src={preview.url} autoPlay loop muted playsInline className="w-full h-full object-cover" />
                            ) : (
                                <img src={preview.url} alt="Preview" className="w-full h-full object-cover" />
                            )}
                        </div>
                        <button type="button" onClick={clearMedia} className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center cursor-pointer hover:bg-red-500 transition-colors">
                            <X size={10} />
                        </button>
                        <div className="flex items-center gap-1 mt-1">
                            {preview.type === 'video' ? <Film size={10} className="text-[#555]" /> : <ImageIcon size={10} className="text-[#555]" />}
                            <span className="text-[8px] text-[#555] font-mono uppercase">{preview.type} uploaded</span>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center gap-3">
                        <input
                            ref={fileRef}
                            type="file"
                            accept="image/*,video/*"
                            onChange={handleFileUpload}
                            className="hidden"
                        />
                        <button
                            type="button"
                            onClick={() => fileRef.current?.click()}
                            disabled={uploading}
                            className="flex items-center gap-2 bg-[#111] border border-[#333] hover:border-[#555] px-4 py-2.5 text-[10px] font-mono text-[#888] uppercase tracking-widest transition-all cursor-pointer disabled:opacity-50"
                        >
                            {uploading ? (
                                <>
                                    <Loader2 size={14} className="animate-spin" />
                                    Uploading {uploadProgress}%
                                </>
                            ) : (
                                <>
                                    <Upload size={14} />
                                    Upload Image or Video
                                </>
                            )}
                        </button>
                        {uploading && (
                            <div className="flex-1 h-1 bg-[#222] rounded overflow-hidden">
                                <div className="h-full bg-[#E50914] transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Hidden field for media_url */}
            <input type="hidden" name="media_url" value={mediaUrl} />

            <div className="flex justify-end pt-2">
                <button type="submit" disabled={uploading} className="flex items-center gap-2 bg-[#E50914] text-white hover:bg-[#ff1a25] px-6 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-all disabled:opacity-50">
                    <Megaphone size={14} /> Publish
                </button>
            </div>
        </form>
    );
}
