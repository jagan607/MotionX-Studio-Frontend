"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
    Play, Pause, ZoomIn, ZoomOut, Download, Wand2,
    Music, Film, Trash2, Volume2, Video, GripVertical, Loader2
} from "lucide-react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toastSuccess, toastError } from "@/lib/toast";
import { db, auth } from "@/lib/firebase";
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp } from "firebase/firestore";
import { API_BASE_URL } from "@/lib/config";

// --- CONFIG ---
const MIN_ZOOM = 10;
const MAX_ZOOM = 200;
const HEADER_HEIGHT = 40; // Track header height
const TRACK_HEIGHT = 80;

// --- TYPES ---
interface Clip {
    id: string;
    assetId: string;
    src: string;
    type: 'video' | 'audio';
    start: number;    // Start time on timeline (seconds)
    duration: number; // Duration (seconds)
    track: number;    // 0 = Video, 1 = Audio
    label: string;
    thumbnail?: string;
    volume: number;
}

interface Asset {
    id: string;
    type: 'video' | 'audio';
    src: string;
    thumbnail?: string;
    label: string;
    duration: number;
}

export const TimelineBoard = ({ seriesId, episodeId, sceneId, shots }: any) => {

    // --- STATE ---
    const [assets, setAssets] = useState<Asset[]>([]);
    const [clips, setClips] = useState<Clip[]>([]);

    // Playback
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [zoom, setZoom] = useState(50); // Pixels per second
    const [duration, setDuration] = useState(60);

    // Interaction
    const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
    const [dragging, setDragging] = useState<{ id: string, mode: 'move' | 'trim-l' | 'trim-r', startX: number, originalStart: number, originalDur: number } | null>(null);

    // Features
    const [sfxPrompt, setSfxPrompt] = useState("");
    const [isGeneratingSfx, setIsGeneratingSfx] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [exportProgress, setExportProgress] = useState(0);

    // --- REFS ---
    const videoRef = useRef<HTMLVideoElement>(null);
    const timelineContainerRef = useRef<HTMLDivElement>(null);
    const audioPool = useRef<Map<string, HTMLAudioElement>>(new Map());
    const ffmpegRef = useRef(new FFmpeg());
    const rafRef = useRef<number | null>(null);
    const lastTimeRef = useRef<number>(0);

    // --- 1. DATA SYNC (Assets) ---
    useEffect(() => {
        // A. Visual Shots
        const visualAssets: Asset[] = (shots || [])
            .filter((s: any) => s.video_url || s.lipsync_url)
            .map((s: any) => ({
                id: s.id,
                type: 'video',
                src: s.lipsync_url || s.video_url,
                thumbnail: s.image_url,
                label: s.video_prompt?.slice(0, 30) || "Shot",
                duration: 5
            }));

        // B. SFX from Firebase
        if (sceneId) {
            const q = query(collection(db, `series/${seriesId}/episodes/${episodeId}/scenes/${sceneId}/sfx`), orderBy("created_at", "desc"));
            const unsub = onSnapshot(q, (snap) => {
                const sfxAssets: Asset[] = snap.docs.map(d => ({
                    id: d.id,
                    type: 'audio',
                    src: d.data().url,
                    label: d.data().prompt,
                    duration: 5,
                    thumbnail: ""
                }));
                setAssets([...visualAssets, ...sfxAssets]);
            });
            return () => unsub();
        } else {
            setAssets(visualAssets);
        }
    }, [shots, sceneId]);

    // Update Total Duration
    useEffect(() => {
        if (clips.length > 0) {
            const end = Math.max(...clips.map(c => c.start + c.duration));
            setDuration(Math.max(60, end + 10));
        }
    }, [clips]);


    // --- 2. PLAYBACK ENGINE (The "Heart") ---
    const tick = useCallback((time: number) => {
        if (!isPlaying) return;

        // Calculate Delta
        if (lastTimeRef.current !== 0) {
            const dt = (time - lastTimeRef.current) / 1000;
            setCurrentTime(prev => {
                const next = prev + dt;
                if (next >= duration) {
                    setIsPlaying(false);
                    return prev;
                }
                syncMedia(next);
                return next;
            });
        }
        lastTimeRef.current = time;
        rafRef.current = requestAnimationFrame(tick);
    }, [isPlaying, duration, clips]); // Added clips to dep to ensure sync sees latest

    const syncMedia = (time: number) => {
        // Sync Video
        const vid = videoRef.current;
        if (vid) {
            const activeVideo = clips.find(c => c.track === 0 && time >= c.start && time < c.start + c.duration);
            if (activeVideo) {
                if (!vid.src.includes(activeVideo.src)) {
                    vid.src = activeVideo.src;
                    vid.load(); // Important for smooth switch
                }
                const offset = time - activeVideo.start;
                // Soft sync: only seek if drift > 0.2s
                if (Math.abs(vid.currentTime - offset) > 0.25) vid.currentTime = offset;
                vid.play().catch(() => { });
                vid.style.opacity = "1";
            } else {
                vid.pause();
                vid.style.opacity = "0";
            }
        }

        // Sync Audio
        const activeAudios = clips.filter(c => c.track === 1 && time >= c.start && time < c.start + c.duration);

        // Play active
        activeAudios.forEach(c => {
            let audio = audioPool.current.get(c.id);
            if (!audio) {
                audio = new Audio(c.src);
                audio.volume = c.volume;
                audioPool.current.set(c.id, audio);
            }
            const offset = time - c.start;
            if (Math.abs(audio.currentTime - offset) > 0.25) audio.currentTime = offset;
            audio.play().catch(() => { });
        });

        // Pause inactive
        audioPool.current.forEach((a, id) => {
            if (!activeAudios.find(c => c.id === id)) a.pause();
        });
    };

    useEffect(() => {
        if (isPlaying) {
            lastTimeRef.current = performance.now();
            rafRef.current = requestAnimationFrame(tick);
        } else {
            lastTimeRef.current = 0;
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            videoRef.current?.pause();
            audioPool.current.forEach(a => a.pause());
        }
        return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    }, [isPlaying, tick]);


    // --- 3. DRAG & DROP LOGIC (Native Pointer Events) ---

    // A. Library -> Timeline Drop
    const handleLibraryDragStart = (e: React.DragEvent, asset: Asset) => {
        e.dataTransfer.setData("assetId", asset.id);
        e.dataTransfer.setData("type", asset.type);
    };

    const handleTrackDrop = (e: React.DragEvent, trackIdx: number) => {
        e.preventDefault();
        const assetId = e.dataTransfer.getData("assetId");
        const asset = assets.find(a => a.id === assetId);

        if (!asset) return;
        if (trackIdx === 0 && asset.type !== 'video') return toastError("Video track only accepts video");
        // if (trackIdx === 1 && asset.type !== 'audio') return toastError("Audio track only accepts audio");

        const rect = e.currentTarget.getBoundingClientRect();
        const offsetX = e.clientX - rect.left + e.currentTarget.scrollLeft;
        const start = Math.max(0, offsetX / zoom);

        const newClip: Clip = {
            id: `clip_${Date.now()}`,
            assetId: asset.id,
            src: asset.src,
            type: asset.type,
            start,
            duration: asset.duration,
            track: trackIdx,
            label: asset.label,
            thumbnail: asset.thumbnail,
            volume: 1
        };
        setClips(prev => [...prev, newClip]);
    };

    // B. Timeline Clip Manipulation (Move/Resize)
    const handlePointerDown = (e: React.PointerEvent, clip: Clip, mode: 'move' | 'trim-l' | 'trim-r') => {
        e.preventDefault();
        e.stopPropagation();

        setSelectedClipId(clip.id);
        setDragging({
            id: clip.id,
            mode,
            startX: e.clientX,
            originalStart: clip.start,
            originalDur: clip.duration
        });

        // Capture pointer to handle dragging even if mouse leaves div
        (e.target as Element).setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!dragging) return;

        const deltaPx = e.clientX - dragging.startX;
        const deltaSec = deltaPx / zoom;

        setClips(prev => prev.map(c => {
            if (c.id !== dragging.id) return c;

            if (dragging.mode === 'move') {
                return { ...c, start: Math.max(0, dragging.originalStart + deltaSec) };
            }
            if (dragging.mode === 'trim-r') {
                return { ...c, duration: Math.max(0.5, dragging.originalDur + deltaSec) };
            }
            if (dragging.mode === 'trim-l') {
                const newStart = Math.min(dragging.originalStart + deltaSec, dragging.originalStart + dragging.originalDur - 0.5);
                const newDur = dragging.originalDur - (newStart - dragging.originalStart);
                return { ...c, start: Math.max(0, newStart), duration: Math.max(0.5, newDur) };
            }
            return c;
        }));
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        if (dragging) {
            (e.target as Element).releasePointerCapture(e.pointerId);
            setDragging(null);
            // Snap logic could go here
        }
    };


    // --- 4. EXPORT (Static Import Fix) ---
    const handleExport = async () => {
        setIsExporting(true);
        setExportProgress(10);
        const ffmpeg = ffmpegRef.current;

        try {
            if (!ffmpeg.loaded) {
                // MANUAL FETCH to avoid Webpack errors
                const load = async (url: string, type: string) => {
                    const r = await fetch(url);
                    const b = await r.arrayBuffer();
                    return URL.createObjectURL(new Blob([b], { type }));
                };
                await ffmpeg.load({
                    coreURL: await load('https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js', 'text/javascript'),
                    wasmURL: await load('https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.wasm', 'application/wasm'),
                });
            }
            setExportProgress(30);

            // Write Files
            const uniqueAssets = Array.from(new Set(clips.map(c => c.assetId)));
            for (const assetId of uniqueAssets) {
                const asset = assets.find(a => a.id === assetId);
                if (asset) {
                    const data = await fetch(asset.src).then(r => r.arrayBuffer());
                    await ffmpeg.writeFile(`${asset.id}.mp4`, new Uint8Array(data)); // Simplified extension assumption
                }
            }
            setExportProgress(60);

            // Concat
            const vidClips = clips.filter(c => c.track === 0).sort((a, b) => a.start - b.start);
            let list = "";
            vidClips.forEach(c => { list += `file '${c.assetId}.mp4'\n`; });
            await ffmpeg.writeFile('list.txt', list);

            await ffmpeg.exec(['-f', 'concat', '-safe', '0', '-i', 'list.txt', '-c', 'copy', 'output.mp4']);
            setExportProgress(90);

            // Download
            const data = await ffmpeg.readFile('output.mp4');
            const blob = new Blob([data as any], { type: 'video/mp4' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Export_${Date.now()}.mp4`;
            a.click();
            toastSuccess("Export Complete!");

        } catch (e: any) {
            console.error(e);
            toastError("Export Failed: " + e.message);
        } finally {
            setIsExporting(false);
            setExportProgress(0);
        }
    };

    // --- 5. SFX GEN ---
    const handleGenerateSfx = async () => {
        if (!sfxPrompt) return;
        setIsGeneratingSfx(true);
        try {
            const token = await auth.currentUser?.getIdToken();
            const formData = new FormData();
            formData.append("prompt", sfxPrompt);
            const res = await fetch(`${API_BASE_URL}/api/v1/generate_sfx`, { method: "POST", headers: { "Authorization": `Bearer ${token}` }, body: formData });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail);

            await addDoc(collection(db, "series", seriesId, "episodes", episodeId, "scenes", sceneId, "sfx"), {
                url: data.audio_url,
                prompt: sfxPrompt,
                created_at: serverTimestamp()
            });
            toastSuccess("SFX Saved");
            setSfxPrompt("");
        } catch (e: any) { toastError(e.message); }
        finally { setIsGeneratingSfx(false); }
    };


    // --- RENDER ---
    return (
        <div className="flex flex-col h-full bg-[#0E0E0E] text-gray-300 font-sans selection:bg-blue-500/30"
            onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}>

            {/* TOP SPLIT */}
            <div className="flex-1 flex overflow-hidden border-b border-[#222]">

                {/* LIBRARY */}
                <div className="w-80 bg-[#111] border-r border-[#222] flex flex-col">
                    <div className="p-4 border-b border-[#222]">
                        <h3 className="text-[10px] font-bold text-[#666] uppercase mb-2">Sound Generator</h3>
                        <div className="flex gap-2">
                            <input className="bg-[#050505] border border-[#333] rounded flex-1 px-3 py-1.5 text-xs focus:border-blue-500 outline-none"
                                placeholder="E.g. Footsteps..." value={sfxPrompt} onChange={e => setSfxPrompt(e.target.value)} />
                            <button onClick={handleGenerateSfx} disabled={isGeneratingSfx} className="bg-[#222] border border-[#333] px-3 rounded hover:bg-[#333]">
                                {isGeneratingSfx ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-2">
                        {assets.map(a => (
                            <div key={a.id} draggable onDragStart={e => handleLibraryDragStart(e, a)}
                                className="flex gap-3 p-2 bg-[#161616] border border-[#222] rounded hover:border-[#444] cursor-grab active:cursor-grabbing group">
                                <div className="w-12 h-8 bg-black rounded overflow-hidden relative border border-[#222]">
                                    {a.thumbnail ? <img src={a.thumbnail} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Music size={12} /></div>}
                                </div>
                                <div className="flex-1 min-w-0 flex flex-col justify-center">
                                    <div className="text-[11px] font-medium truncate text-gray-300 group-hover:text-white">{a.label}</div>
                                    <div className="text-[9px] text-[#555] uppercase">{a.type}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* PREVIEW */}
                <div className="flex-1 bg-black relative flex items-center justify-center">
                    <video ref={videoRef} className="max-h-[80%] max-w-[90%] shadow-2xl border border-[#222]" />
                    {isExporting && (
                        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-50">
                            <Loader2 size={32} className="text-blue-500 animate-spin mb-4" />
                            <div className="text-sm font-bold text-white mb-2">EXPORTING {exportProgress}%</div>
                            <div className="w-48 h-1 bg-[#333] rounded-full overflow-hidden"><div className="h-full bg-blue-500" style={{ width: `${exportProgress}%` }} /></div>
                        </div>
                    )}
                </div>
            </div>

            {/* CONTROLS */}
            <div className="h-12 bg-[#111] border-b border-[#222] flex items-center px-4 justify-between shrink-0 z-20">
                <div className="flex items-center gap-4">
                    <button onClick={() => setIsPlaying(!isPlaying)} className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-black hover:scale-105 transition">
                        {isPlaying ? <Pause size={14} fill="black" /> : <Play size={14} fill="black" className="ml-0.5" />}
                    </button>
                    <span className="font-mono text-blue-500 font-bold">{currentTime.toFixed(2)}s</span>
                    <div className="h-6 w-[1px] bg-[#333] mx-2" />
                    <ZoomOut size={14} className="cursor-pointer text-[#666] hover:text-white" onClick={() => setZoom(Math.max(MIN_ZOOM, zoom - 10))} />
                    <input type="range" min={MIN_ZOOM} max={MAX_ZOOM} value={zoom} onChange={e => setZoom(Number(e.target.value))} className="w-24 h-1 bg-[#333] accent-blue-500" />
                    <ZoomIn size={14} className="cursor-pointer text-[#666] hover:text-white" onClick={() => setZoom(Math.min(MAX_ZOOM, zoom + 10))} />
                </div>
                <div className="flex items-center gap-3">
                    {selectedClipId && <button onClick={() => { setClips(prev => prev.filter(c => c.id !== selectedClipId)); setSelectedClipId(null); }} className="text-red-500 hover:bg-red-900/20 p-2 rounded"><Trash2 size={16} /></button>}
                    <button onClick={handleExport} disabled={isExporting} className="bg-blue-600 hover:bg-blue-500 px-4 py-1.5 rounded text-[11px] font-bold text-white flex items-center gap-2">
                        <Download size={12} /> EXPORT
                    </button>
                </div>
            </div>

            {/* TRACKS */}
            <div className="flex-1 bg-[#080808] overflow-hidden flex flex-col relative">
                {/* Ruler */}
                <div ref={timelineContainerRef} className="flex-1 overflow-x-auto overflow-y-hidden custom-scrollbar relative"
                    onMouseDown={(e) => {
                        if ((e.target as HTMLElement).closest('.timeline-clip')) return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = e.clientX - rect.left + e.currentTarget.scrollLeft;
                        setCurrentTime(x / zoom);
                    }}>

                    <div className="h-8 border-b border-[#222] bg-[#0C0C0C] sticky top-0 z-10 flex min-w-max" style={{ width: `${duration * zoom}px` }}>
                        {Array.from({ length: Math.ceil(duration) }).map((_, i) => (
                            <div key={i} className="h-full border-l border-[#222] relative flex-shrink-0" style={{ width: `${zoom}px` }}>
                                <span className="text-[9px] text-[#555] ml-1">{i}s</span>
                            </div>
                        ))}
                    </div>

                    {/* Playhead */}
                    <div className="absolute top-0 bottom-0 w-[1px] bg-blue-500 z-30 pointer-events-none" style={{ left: `${currentTime * zoom}px` }}>
                        <div className="w-3 h-3 -ml-1.5 bg-blue-500 rotate-45 -mt-1.5" />
                    </div>

                    {/* Tracks Container */}
                    <div className="py-4 space-y-2 min-w-max" style={{ width: `${duration * zoom}px` }}>
                        {[0, 1].map(trackId => (
                            <div
                                key={trackId}
                                className="h-24 bg-[#0B0B0B] border-y border-[#1A1A1A] relative group"
                                onDragOver={e => e.preventDefault()}
                                onDrop={e => handleTrackDrop(e, trackId)}
                            >
                                <div className="sticky left-0 top-0 text-[9px] font-bold text-[#333] p-1 pointer-events-none uppercase">
                                    {trackId === 0 ? "Video Track" : "Audio Track"}
                                </div>

                                {clips.filter(c => c.track === trackId).map(clip => (
                                    <div
                                        key={clip.id}
                                        className={`timeline-clip absolute top-2 bottom-2 rounded overflow-hidden cursor-grab active:cursor-grabbing border ${selectedClipId === clip.id ? 'border-yellow-400 z-20' : 'border-[#333] hover:border-[#555] z-10'}`}
                                        style={{
                                            left: `${clip.start * zoom}px`,
                                            width: `${clip.duration * zoom}px`,
                                            backgroundColor: trackId === 0 ? '#151515' : '#1e293b'
                                        }}
                                        onPointerDown={(e) => handlePointerDown(e, clip, 'move')}
                                    >
                                        {/* Trim Handles */}
                                        <div className="absolute left-0 top-0 bottom-0 w-4 cursor-w-resize hover:bg-white/20 z-30 flex items-center justify-center"
                                            onPointerDown={(e) => handlePointerDown(e, clip, 'trim-l')}>
                                            <div className="w-[1px] h-3 bg-white/50" />
                                        </div>
                                        <div className="absolute right-0 top-0 bottom-0 w-4 cursor-e-resize hover:bg-white/20 z-30 flex items-center justify-center"
                                            onPointerDown={(e) => handlePointerDown(e, clip, 'trim-r')}>
                                            <div className="w-[1px] h-3 bg-white/50" />
                                        </div>

                                        {/* Content */}
                                        <div className="absolute inset-0 pointer-events-none">
                                            {clip.thumbnail && <div className="absolute inset-0 opacity-30 grayscale bg-repeat-x" style={{ backgroundImage: `url(${clip.thumbnail})`, backgroundSize: 'auto 100%' }} />}
                                            <div className="absolute bottom-1 left-2 text-[10px] font-bold text-white drop-shadow-md truncate max-w-full pr-4">{clip.label}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};