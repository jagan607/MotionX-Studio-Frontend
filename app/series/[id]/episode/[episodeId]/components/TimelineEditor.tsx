"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
    Play, Pause, Download, Wand2, X, Film, Music,
    Trash2, ZoomIn, ZoomOut, Volume2, GripVertical, Settings2
} from "lucide-react";
import { toastError, toastSuccess } from "@/lib/toast";
import { API_BASE_URL } from "@/lib/config";
import { auth } from "@/lib/firebase";

// --- TYPES ---

// 1. Source Asset (Lives in the Library)
interface MediaAsset {
    id: string;
    type: 'video' | 'audio';
    src: string;
    thumbnail?: string;
    label: string;
    duration: number; // Native duration of the source file
}

// 2. Timeline Instance (Lives on the Track)
interface TimelineClip {
    id: string;          // Unique ID for this specific instance
    assetId: string;     // Reference back to source asset
    type: 'video' | 'audio';
    src: string;
    start: number;       // Where it starts on the timeline (seconds)
    offset: number;      // Trim start (how far into the source we start)
    duration: number;    // How long it plays on timeline
    track: number;       // 0 = Video, 1 = Audio
    label: string;
    thumbnail?: string;
}

interface TimelineEditorProps {
    shots: any[];
    onClose: () => void;
}

export const TimelineEditor = ({ shots, onClose }: TimelineEditorProps) => {

    // --- STATE ---

    // Data
    const [assets, setAssets] = useState<MediaAsset[]>([]);
    const [clips, setClips] = useState<TimelineClip[]>([]);

    // Playback
    const [totalDuration, setTotalDuration] = useState(60);
    const [currentTime, setCurrentTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [zoom, setZoom] = useState(20); // Pixels per second

    // Interaction
    const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
    const [draggedAsset, setDraggedAsset] = useState<MediaAsset | null>(null);
    const [draggedClipId, setDraggedClipId] = useState<string | null>(null);

    // SFX Gen
    const [sfxPrompt, setSfxPrompt] = useState("");
    const [isGeneratingSfx, setIsGeneratingSfx] = useState(false);

    // Refs (Fixed Types)
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const audioPoolRef = useRef<Map<string, HTMLAudioElement>>(new Map());
    const requestRef = useRef<number | null>(null);
    const timelineScrollRef = useRef<HTMLDivElement>(null);

    // --- INITIALIZATION ---
    useEffect(() => {
        // Load initial assets from shots
        const initialAssets: MediaAsset[] = shots
            .filter(s => s.video_url || s.lipsync_url)
            .map(s => ({
                id: s.id,
                type: 'video',
                src: s.lipsync_url || s.video_url,
                thumbnail: s.image_url,
                label: s.video_prompt?.slice(0, 25) || "Generated Shot",
                duration: 5 // Default for Kling/Gen-3
            }));
        setAssets(initialAssets);
    }, [shots]);


    // --- ENGINE: PLAYBACK SYNC ---

    // 1. Sync Video Element
    useEffect(() => {
        const vid = videoRef.current;
        if (!vid) return;

        // Find visual clip at playhead
        const activeClip = clips.find(c => c.track === 0 && currentTime >= c.start && currentTime < (c.start + c.duration));

        if (activeClip) {
            if (!vid.src.includes(activeClip.src)) {
                vid.src = activeClip.src;
            }

            // Calculate exact frame time: (TimelineTime - ClipStart) + TrimOffset
            const frameTime = (currentTime - activeClip.start) + activeClip.offset;

            // Anti-Jitter: Only seek if drift is noticeable (> 0.2s)
            if (Math.abs(vid.currentTime - frameTime) > 0.2) {
                vid.currentTime = frameTime;
            }

            if (isPlaying && vid.paused) vid.play().catch(() => { });
            if (!isPlaying && !vid.paused) vid.pause();
        } else {
            // No clip? Show black.
            if (vid.getAttribute('src')) {
                vid.pause();
                vid.removeAttribute('src');
                vid.load();
            }
        }
    }, [currentTime, clips, isPlaying]);

    // 2. Sync Audio Elements (SFX/Music)
    useEffect(() => {
        // Pause all if stopped
        if (!isPlaying) {
            audioPoolRef.current.forEach(a => a.pause());
            return;
        }

        // Identify active audio clips
        const activeAudioClips = clips.filter(c => c.track === 1 && currentTime >= c.start && currentTime < (c.start + c.duration));

        // Play active ones
        activeAudioClips.forEach(clip => {
            let audio = audioPoolRef.current.get(clip.id);
            if (!audio) {
                audio = new Audio(clip.src);
                audioPoolRef.current.set(clip.id, audio);
            }

            const frameTime = (currentTime - clip.start) + clip.offset;
            if (Math.abs(audio.currentTime - frameTime) > 0.2) {
                audio.currentTime = frameTime;
            }
            if (audio.paused) audio.play().catch(() => { });
        });

        // Silence inactive ones
        audioPoolRef.current.forEach((audio, id) => {
            if (!activeAudioClips.find(c => c.id === id)) audio.pause();
        });

    }, [currentTime, clips, isPlaying]);

    // 3. Animation Loop
    const animate = useCallback(() => {
        if (!isPlaying) return;

        setCurrentTime(prev => {
            const next = prev + 0.05; // 50ms ticks approx
            if (next >= totalDuration) {
                setIsPlaying(false);
                return prev;
            }
            return next;
        });

        requestRef.current = requestAnimationFrame(animate);
    }, [isPlaying, totalDuration]);

    useEffect(() => {
        if (isPlaying) {
            requestRef.current = requestAnimationFrame(animate);
        } else {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        }
        return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
    }, [isPlaying, animate]);


    // --- HANDLERS ---

    const handleScrub = (e: React.MouseEvent) => {
        // Don't scrub if dragging a clip
        if (draggedClipId) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const offsetX = e.clientX - rect.left + e.currentTarget.scrollLeft;
        const newTime = Math.max(0, offsetX / zoom);
        setCurrentTime(newTime);
    };

    const handleGenerateSfx = async () => {
        if (!sfxPrompt.trim()) return;
        setIsGeneratingSfx(true);
        try {
            const token = await auth.currentUser?.getIdToken();
            const formData = new FormData();
            formData.append("prompt", sfxPrompt);

            const res = await fetch(`${API_BASE_URL}/api/v1/shot/generate_sfx`, {
                method: "POST", headers: { "Authorization": `Bearer ${token}` }, body: formData
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail);

            // 1. ADD TO MEDIA POOL (Library)
            const newAsset: MediaAsset = {
                id: `sfx_${Date.now()}`,
                type: 'audio',
                src: data.audio_url,
                label: sfxPrompt,
                duration: 5
            };
            setAssets(prev => [...prev, newAsset]);
            toastSuccess("SFX added to Media Pool");
            setSfxPrompt("");

        } catch (e: any) {
            toastError(e.message);
        } finally {
            setIsGeneratingSfx(false);
        }
    };

    // --- DRAG & DROP LOGIC ---

    const handleDrop = (e: React.DragEvent, trackIndex: number) => {
        e.preventDefault();
        const rect = e.currentTarget.getBoundingClientRect();
        const offsetX = e.clientX - rect.left + e.currentTarget.scrollLeft;
        let dropTime = Math.max(0, offsetX / zoom);

        // SNAP LOGIC (Magnetic)
        const SNAP_DIST = 0.5; // seconds
        clips.forEach(c => {
            if (c.track === trackIndex) {
                const end = c.start + c.duration;
                if (Math.abs(dropTime - end) < SNAP_DIST) dropTime = end;
            }
        });

        // A. Adding NEW Asset from Library
        if (draggedAsset) {
            // Validation: Only audio on audio track
            if (trackIndex === 1 && draggedAsset.type === 'video') {
                toastError("Video clips cannot go on audio track");
                setDraggedAsset(null);
                return;
            }

            const newClip: TimelineClip = {
                id: `clip_${Date.now()}`,
                assetId: draggedAsset.id,
                type: draggedAsset.type,
                src: draggedAsset.src,
                start: dropTime,
                offset: 0,
                duration: draggedAsset.duration,
                track: trackIndex,
                label: draggedAsset.label,
                thumbnail: draggedAsset.thumbnail
            };
            setClips(prev => [...prev, newClip]);
            setDraggedAsset(null);
        }

        // B. Moving EXISTING Clip
        if (draggedClipId) {
            setClips(prev => prev.map(c => {
                if (c.id === draggedClipId) {
                    return { ...c, start: dropTime, track: trackIndex };
                }
                return c;
            }));
            setDraggedClipId(null);
        }
    };

    // Helper to format time
    const fmt = (t: number) => {
        const m = Math.floor(t / 60);
        const s = Math.floor(t % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div className="fixed inset-0 z-[60] bg-[#090909] flex flex-col font-sans select-none text-white">

            {/* HEADER */}
            <div className="h-14 border-b border-[#222] bg-[#050505] flex items-center px-4 justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={onClose} className="text-[#666] hover:text-white flex items-center gap-2 text-xs font-bold">
                        <X size={16} /> EXIT
                    </button>
                    <div className="h-4 w-[1px] bg-[#222]" />
                    <h2 className="text-[#CCC] font-bold text-sm">POST-PRODUCTION TIMELINE</h2>
                </div>
                <button className="bg-white text-black px-4 py-1.5 text-xs font-bold rounded flex items-center gap-2 hover:bg-gray-200">
                    <Download size={14} /> EXPORT
                </button>
            </div>

            <div className="flex-1 flex overflow-hidden">

                {/* 1. MEDIA LIBRARY */}
                <div className="w-72 bg-[#0A0A0A] border-r border-[#222] flex flex-col">
                    <div className="p-3 border-b border-[#222] flex items-center justify-between">
                        <span className="text-[10px] font-bold text-[#555] uppercase tracking-widest">Media Pool</span>
                        <Settings2 size={12} className="text-[#444]" />
                    </div>

                    {/* SFX GENERATOR */}
                    <div className="p-3 border-b border-[#222] space-y-2 bg-[#0F0F0F]">
                        <div className="flex items-center gap-2 bg-[#1a1a1a] border border-[#333] rounded px-2">
                            <Wand2 size={12} className="text-[#666]" />
                            <input
                                className="flex-1 bg-transparent border-none text-[10px] py-2 text-white outline-none"
                                placeholder="Generate SFX (e.g. Rain)"
                                value={sfxPrompt}
                                onChange={e => setSfxPrompt(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleGenerateSfx()}
                            />
                        </div>
                        <button
                            onClick={handleGenerateSfx}
                            disabled={isGeneratingSfx || !sfxPrompt}
                            className="w-full py-1.5 bg-[#222] hover:bg-[#333] text-[9px] font-bold text-[#888] rounded transition-colors"
                        >
                            {isGeneratingSfx ? "GENERATING..." : "ADD TO POOL"}
                        </button>
                    </div>

                    {/* ASSET LIST */}
                    <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                        {assets.map((asset) => (
                            <div
                                key={asset.id}
                                draggable
                                onDragStart={(e) => {
                                    setDraggedAsset(asset);
                                    e.dataTransfer.effectAllowed = "copy";
                                }}
                                className="flex gap-3 p-2 bg-[#111] border border-[#222] rounded hover:border-[#444] cursor-grab active:cursor-grabbing group"
                            >
                                <div className="w-12 h-8 bg-black rounded flex items-center justify-center relative overflow-hidden">
                                    {asset.type === 'video' ? (
                                        asset.thumbnail ? <img src={asset.thumbnail} className="w-full h-full object-cover" /> : <Film size={12} className="text-gray-600" />
                                    ) : (
                                        <Music size={12} className="text-blue-500" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-[10px] font-bold truncate text-gray-300">{asset.label}</div>
                                    <div className="text-[9px] text-gray-600 font-mono">{asset.type.toUpperCase()} • {asset.duration}s</div>
                                </div>
                                <GripVertical size={12} className="text-[#333] opacity-0 group-hover:opacity-100" />
                            </div>
                        ))}
                    </div>
                </div>

                {/* 2. EDITOR */}
                <div className="flex-1 flex flex-col bg-[#050505]">

                    {/* PLAYER */}
                    <div className="flex-1 relative flex items-center justify-center border-b border-[#222] bg-black">
                        <video ref={videoRef} className="max-h-[90%] max-w-[90%] shadow-2xl" />

                        {/* Playback Controls Overlay */}
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-[#111]/80 backdrop-blur px-4 py-2 rounded-full border border-[#333]">
                            <button onClick={() => setIsPlaying(!isPlaying)} className="hover:text-green-400">
                                {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
                            </button>
                            <span className="text-xs font-mono w-12 text-center">{fmt(currentTime)}</span>
                        </div>
                    </div>

                    {/* TIMELINE AREA */}
                    <div className="h-[300px] flex flex-col bg-[#0A0A0A]">

                        {/* TOOLBAR */}
                        <div className="h-8 border-b border-[#222] flex items-center px-4 justify-between bg-[#0F0F0F]">
                            <div className="flex items-center gap-2">
                                <ZoomOut size={12} className="text-[#555] cursor-pointer" onClick={() => setZoom(Math.max(5, zoom - 5))} />
                                <input type="range" min="5" max="100" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="w-20 h-1 accent-[#444]" />
                                <ZoomIn size={12} className="text-[#555] cursor-pointer" onClick={() => setZoom(Math.min(100, zoom + 5))} />
                            </div>
                            {selectedClipId && (
                                <button
                                    onClick={() => {
                                        setClips(prev => prev.filter(c => c.id !== selectedClipId));
                                        setSelectedClipId(null);
                                    }}
                                    className="text-red-500 hover:text-red-400"
                                >
                                    <Trash2 size={12} />
                                </button>
                            )}
                        </div>

                        {/* TRACKS SCROLL AREA */}
                        <div
                            className="flex-1 overflow-auto relative custom-scrollbar"
                            ref={timelineScrollRef}
                            onClick={handleScrub}
                        >
                            {/* RULER */}
                            <div className="h-6 border-b border-[#222] sticky top-0 bg-[#0A0A0A] z-20 flex" style={{ width: `${totalDuration * zoom}px` }}>
                                {Array.from({ length: Math.ceil(totalDuration) + 1 }).map((_, i) => (
                                    <div key={i} className="relative h-full border-l border-[#222]" style={{ width: `${zoom}px` }}>
                                        <span className="absolute top-1 left-1 text-[8px] text-[#444] font-mono select-none">{i}</span>
                                    </div>
                                ))}
                            </div>

                            {/* PLAYHEAD */}
                            <div
                                className="absolute top-0 bottom-0 w-[1px] bg-red-500 z-30 pointer-events-none"
                                style={{ left: `${currentTime * zoom}px` }}
                            >
                                <div className="w-2 h-2 -ml-1 bg-red-500 transform rotate-45 -mt-1" />
                            </div>

                            {/* VIDEO TRACK */}
                            <div
                                className="h-24 border-b border-[#222] relative group"
                                onDragOver={e => e.preventDefault()}
                                onDrop={e => handleDrop(e, 0)}
                                style={{ minWidth: `${totalDuration * zoom}px` }}
                            >
                                <div className="absolute left-2 top-2 text-[8px] font-bold text-[#333] pointer-events-none">VIDEO TRACK</div>
                                {clips.filter(c => c.track === 0).map(clip => (
                                    <TimelineClipItem
                                        key={clip.id}
                                        clip={clip}
                                        zoom={zoom}
                                        isSelected={selectedClipId === clip.id}
                                        onSelect={() => setSelectedClipId(clip.id)}
                                        onDragStart={() => setDraggedClipId(clip.id)}
                                    />
                                ))}
                            </div>

                            {/* AUDIO TRACK */}
                            <div
                                className="h-16 border-b border-[#222] relative group"
                                onDragOver={e => e.preventDefault()}
                                onDrop={e => handleDrop(e, 1)}
                                style={{ minWidth: `${totalDuration * zoom}px` }}
                            >
                                <div className="absolute left-2 top-2 text-[8px] font-bold text-[#333] pointer-events-none">AUDIO / SFX</div>
                                {clips.filter(c => c.track === 1).map(clip => (
                                    <TimelineClipItem
                                        key={clip.id}
                                        clip={clip}
                                        zoom={zoom}
                                        isSelected={selectedClipId === clip.id}
                                        onSelect={() => setSelectedClipId(clip.id)}
                                        onDragStart={() => setDraggedClipId(clip.id)}
                                        isAudio
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- SUBCOMPONENT: CLIP ---
const TimelineClipItem = ({ clip, zoom, isSelected, onSelect, onDragStart, isAudio }: any) => {
    return (
        <div
            draggable
            onDragStart={(e) => {
                e.stopPropagation();
                onDragStart();
            }}
            onClick={(e) => {
                e.stopPropagation();
                onSelect();
            }}
            className={`
                absolute top-6 bottom-2 rounded-sm overflow-hidden cursor-move border
                ${isSelected ? 'border-yellow-400 z-10' : 'border-[#333] hover:border-[#666]'}
                ${isAudio ? 'bg-blue-900/20' : 'bg-[#1a1a1a]'}
            `}
            style={{
                left: `${clip.start * zoom}px`,
                width: `${clip.duration * zoom}px`
            }}
        >
            {!isAudio && clip.thumbnail && (
                <div
                    className="absolute inset-0 opacity-40 grayscale"
                    style={{ backgroundImage: `url(${clip.thumbnail})`, backgroundSize: 'auto 100%' }}
                />
            )}

            <div className={`absolute inset-0 px-2 flex items-center ${isAudio ? 'text-blue-300' : 'text-gray-300'}`}>
                <span className="text-[9px] font-bold truncate drop-shadow-md">{clip.label}</span>
            </div>

            {/* Resize Handles (Visual only for this iteration) */}
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-white/10 hover:bg-white/50 cursor-w-resize" />
            <div className="absolute right-0 top-0 bottom-0 w-1 bg-white/10 hover:bg-white/50 cursor-e-resize" />
        </div>
    );
};