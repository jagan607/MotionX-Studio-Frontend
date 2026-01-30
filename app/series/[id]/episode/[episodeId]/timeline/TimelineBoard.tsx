"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Rnd } from "react-rnd";
import { FFmpeg } from "@ffmpeg/ffmpeg";
// REMOVED: import { fetchFile, toBlobURL } from "@ffmpeg/util"; (This caused the dynamic error)
import {
    Play, Pause, ZoomIn, ZoomOut, Film, Music,
    Trash2, Wand2, GripVertical, Download, RefreshCw, Loader2, X
} from "lucide-react";
import { toastSuccess, toastError } from "@/lib/toast";
import { API_BASE_URL } from "@/lib/config";
import { auth } from "@/lib/firebase";

// --- TYPES ---
interface MediaAsset {
    id: string;
    type: 'video' | 'audio';
    src: string;
    thumbnail?: string;
    label: string;
    duration: number;
}

interface TrackClip {
    id: string;
    assetId: string;
    type: 'video' | 'audio';
    src: string;
    start: number;
    offset: number;
    duration: number;
    trackId: number;
    label: string;
    thumbnail?: string;
    volume: number;
}

export const TimelineBoard = ({ seriesId, episodeId, shots }: any) => {

    // --- STATE ---
    const [assets, setAssets] = useState<MediaAsset[]>([]);
    const [clips, setClips] = useState<TrackClip[]>([]);

    // Engine
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [zoom, setZoom] = useState(40);
    const [totalDuration, setTotalDuration] = useState(30);
    const [isExporting, setIsExporting] = useState(false);

    // Interaction
    const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
    const [sfxPrompt, setSfxPrompt] = useState("");
    const [isGeneratingSfx, setIsGeneratingSfx] = useState(false);

    // Refs
    // FIXED: Initialized with null (ts2554 error)
    const videoRef = useRef<HTMLVideoElement>(null);
    const audioPoolRef = useRef<Map<string, HTMLAudioElement>>(new Map());
    const timelineRef = useRef<HTMLDivElement>(null);
    const playReqRef = useRef<number | null>(null);
    const lastTimeRef = useRef<number>(0);
    const ffmpegRef = useRef(new FFmpeg());

    // --- 1. SETUP ---
    useEffect(() => {
        if (shots && shots.length > 0) {
            const newAssets: MediaAsset[] = shots
                .filter((s: any) => s.video_url || s.lipsync_url || s.audio_url)
                .map((s: any) => ({
                    id: s.id,
                    type: (s.video_url || s.lipsync_url) ? 'video' : 'audio',
                    src: s.lipsync_url || s.video_url || s.audio_url,
                    thumbnail: s.image_url,
                    label: s.video_prompt?.slice(0, 30) || "Generated Media",
                    duration: 5
                }));
            setAssets(newAssets);

            if (clips.length === 0) {
                const autoClips: TrackClip[] = newAssets
                    .filter(a => a.type === 'video')
                    .map((a, i) => ({
                        id: `clip_${a.id}_${Date.now()}`,
                        assetId: a.id,
                        type: 'video',
                        src: a.src,
                        start: i * 5,
                        offset: 0,
                        duration: 5,
                        trackId: 0,
                        label: a.label,
                        thumbnail: a.thumbnail,
                        volume: 1
                    }));
                setClips(autoClips);
            }
        }
    }, [shots]);

    useEffect(() => {
        if (clips.length > 0) {
            const max = Math.max(...clips.map(c => c.start + c.duration));
            setTotalDuration(Math.max(10, max));
        }
    }, [clips]);

    // --- 2. GAME LOOP (Playback Engine) ---
    const updateEngine = (time: number) => {
        const vid = videoRef.current;
        if (!vid) return;

        const activeVideo = clips.find(c => c.trackId === 0 && time >= c.start && time < c.start + c.duration);
        const activeAudios = clips.filter(c => c.trackId === 1 && time >= c.start && time < c.start + c.duration);

        // SYNC VIDEO
        if (activeVideo) {
            if (!vid.src.includes(activeVideo.src)) {
                vid.src = activeVideo.src;
            }
            const localTime = (time - activeVideo.start) + activeVideo.offset;

            if (Math.abs(vid.currentTime - localTime) > 0.25) {
                vid.currentTime = localTime;
            }

            if (isPlaying && vid.paused) vid.play().catch(() => { });
            if (!isPlaying && !vid.paused) vid.pause();
            vid.style.opacity = "1";
        } else {
            vid.style.opacity = "0";
            if (!vid.paused) vid.pause();
        }

        // SYNC AUDIO
        activeAudios.forEach(clip => {
            let audio = audioPoolRef.current.get(clip.id);
            if (!audio) {
                audio = new Audio(clip.src);
                audio.volume = clip.volume;
                audioPoolRef.current.set(clip.id, audio);
            }
            const localTime = (time - clip.start) + clip.offset;
            if (Math.abs(audio.currentTime - localTime) > 0.25) audio.currentTime = localTime;

            if (isPlaying && audio.paused) audio.play().catch(() => { });
            if (!isPlaying && !audio.paused) audio.pause();
        });

        audioPoolRef.current.forEach((audio, id) => {
            if (!activeAudios.find(c => c.id === id)) audio.pause();
        });
    };

    const animate = useCallback((time: number) => {
        if (!isPlaying) return;

        if (lastTimeRef.current !== 0) {
            const delta = (time - lastTimeRef.current) / 1000;
            const nextTime = currentTime + delta;

            if (nextTime >= totalDuration) {
                setIsPlaying(false);
                setCurrentTime(totalDuration);
                updateEngine(totalDuration);
                return;
            }

            setCurrentTime(nextTime);
            updateEngine(nextTime);
        }
        lastTimeRef.current = time;
        playReqRef.current = requestAnimationFrame(animate);
    }, [isPlaying, currentTime, totalDuration, clips]);

    useEffect(() => {
        if (isPlaying) {
            lastTimeRef.current = performance.now();
            playReqRef.current = requestAnimationFrame(animate);
        } else {
            lastTimeRef.current = 0;
            if (playReqRef.current) cancelAnimationFrame(playReqRef.current);
            updateEngine(currentTime);
        }
        return () => { if (playReqRef.current) cancelAnimationFrame(playReqRef.current); };
    }, [isPlaying, animate]);


    // --- 3. EXPORT ENGINE (MANUAL LOADER - FIXES "DYNAMIC" ERROR) ---

    // Custom Helper: Download file to Uint8Array (Replaces 'fetchFile')
    const customFetchFile = async (url: string): Promise<Uint8Array> => {
        const res = await fetch(url);
        const buf = await res.arrayBuffer();
        return new Uint8Array(buf);
    };

    // Custom Helper: Create Blob URL manually (Replaces 'toBlobURL')
    const loadBlob = async (url: string, type: string) => {
        const res = await fetch(url);
        const buf = await res.arrayBuffer();
        const blob = new Blob([buf], { type });
        return URL.createObjectURL(blob);
    };

    const handleExport = async () => {
        setIsExporting(true);
        const ffmpeg = ffmpegRef.current;

        try {
            toastSuccess("Initializing Export Engine...");

            if (!ffmpeg.loaded) {
                // FIXED: Manually loading resources avoids Webpack dynamic expression errors
                await ffmpeg.load({
                    coreURL: await loadBlob('https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js', 'text/javascript'),
                    wasmURL: await loadBlob('https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.wasm', 'application/wasm'),
                });
            }

            toastSuccess("Loading Assets...");
            const uniqueAssets = Array.from(new Set(clips.map(c => c.assetId)));

            for (const assetId of uniqueAssets) {
                const asset = assets.find(a => a.id === assetId);
                if (asset) {
                    const fileData = await customFetchFile(asset.src);
                    const ext = asset.type === 'video' ? 'mp4' : 'mp3';
                    await ffmpeg.writeFile(`${asset.id}.${ext}`, fileData);
                }
            }

            const sortedClips = [...clips].sort((a, b) => a.start - b.start);
            const videoClips = sortedClips.filter(c => c.trackId === 0);

            let concatList = "";
            for (const clip of videoClips) {
                concatList += `file '${clip.assetId}.mp4'\n`;
            }

            await ffmpeg.writeFile('list.txt', concatList);

            toastSuccess("Rendering Video...");
            await ffmpeg.exec(['-f', 'concat', '-safe', '0', '-i', 'list.txt', '-c', 'copy', 'output.mp4']);

            const data = await ffmpeg.readFile('output.mp4');

            // FIXED: Cast to 'any' to bypass 'SharedArrayBuffer' strict type check error
            const blob = new Blob([data as any], { type: 'video/mp4' });

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Studio_Export_${Date.now()}.mp4`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            toastSuccess("Export Complete!");

        } catch (e: any) {
            console.error(e);
            toastError("Export Failed: " + (e.message || "Unknown error"));
        } finally {
            setIsExporting(false);
        }
    };


    // --- 4. UI HANDLERS ---

    // FIXED: Added types for Rnd event parameters (fixes 'implicitly any' error)
    const handleResizeStop = (id: string, dir: string, ref: HTMLElement, delta: any, position: any) => {
        const deltaSeconds = delta.width / zoom;
        const deltaXSeconds = position.x / zoom;

        setClips(prev => prev.map(c => {
            if (c.id !== id) return c;

            if (dir === "left") {
                const newDuration = Math.max(0.5, c.duration + deltaSeconds);
                return {
                    ...c,
                    start: deltaXSeconds,
                    duration: newDuration,
                };
            } else {
                return {
                    ...c,
                    duration: Math.max(0.5, c.duration + deltaSeconds)
                };
            }
        }));
    };

    const handleGenerateSfx = async () => {
        if (!sfxPrompt.trim()) return;
        setIsGeneratingSfx(true);
        try {
            const token = await auth.currentUser?.getIdToken();
            const formData = new FormData();
            formData.append("prompt", sfxPrompt);
            const res = await fetch(`${API_BASE_URL}/api/v1/generate_sfx`, {
                method: "POST", headers: { "Authorization": `Bearer ${token}` }, body: formData
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail);

            const newAsset: MediaAsset = {
                id: `sfx_${Date.now()}`,
                type: 'audio',
                src: data.audio_url,
                label: sfxPrompt,
                duration: 5
            };
            setAssets(prev => [...prev, newAsset]);
            toastSuccess("SFX Generated");
        } catch (e: any) { toastError(e.message); }
        finally { setIsGeneratingSfx(false); }
    };

    const handleDropOnTrack = (e: React.DragEvent, trackId: number) => {
        e.preventDefault();
        const assetId = e.dataTransfer.getData("assetId");
        if (!assetId) return;

        const asset = assets.find(a => a.id === assetId);
        if (!asset) return;
        if (trackId === 0 && asset.type !== 'video') return toastError("Only Video allowed on Track 1");

        const rect = e.currentTarget.getBoundingClientRect();
        const offsetX = e.clientX - rect.left + e.currentTarget.scrollLeft;
        let dropTime = Math.max(0, (offsetX / zoom));

        clips.forEach(c => {
            if (c.trackId === trackId) {
                const end = c.start + c.duration;
                if (Math.abs(dropTime - end) < 0.2) dropTime = end;
            }
        });

        const newClip: TrackClip = {
            id: `clip_${Date.now()}`,
            assetId: asset.id,
            type: asset.type,
            src: asset.src,
            start: dropTime,
            offset: 0,
            duration: asset.duration,
            trackId: trackId,
            label: asset.label,
            thumbnail: asset.thumbnail,
            volume: 1.0
        };
        setClips(prev => [...prev, newClip]);
    };

    return (
        <div className="flex flex-col h-full bg-[#050505]">

            {/* TOP: LIBRARY & PREVIEW */}
            <div className="flex-1 flex overflow-hidden border-b border-[#222]">

                {/* LIBRARY */}
                <div className="w-80 bg-[#0A0A0A] border-r border-[#222] flex flex-col">
                    <div className="p-4 border-b border-[#222]">
                        <h3 className="text-xs font-bold text-[#666] uppercase mb-3">SFX Generator</h3>
                        <div className="flex gap-2">
                            <input
                                className="flex-1 bg-[#111] border border-[#333] rounded px-3 py-2 text-xs text-white outline-none"
                                placeholder="E.g. Explosion..."
                                value={sfxPrompt}
                                onChange={e => setSfxPrompt(e.target.value)}
                            />
                            <button onClick={handleGenerateSfx} disabled={isGeneratingSfx} className="bg-[#222] border border-[#333] text-white px-3 rounded hover:bg-[#333]">
                                {isGeneratingSfx ? <RefreshCw size={14} className="animate-spin" /> : <Wand2 size={14} />}
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                        {assets.map(asset => (
                            <div
                                key={asset.id}
                                draggable
                                onDragStart={(e) => { e.dataTransfer.setData("assetId", asset.id); }}
                                className="flex gap-3 p-2 bg-[#111] border border-[#222] rounded hover:border-[#444] cursor-grab group select-none"
                            >
                                <div className="w-16 h-10 bg-black rounded relative shrink-0">
                                    {asset.thumbnail && <img src={asset.thumbnail} className="w-full h-full object-cover" />}
                                    <div className="absolute bottom-0 right-0 bg-black/60 p-0.5 rounded-tl">
                                        {asset.type === 'video' ? <Film size={8} className="text-white" /> : <Music size={8} className="text-blue-400" />}
                                    </div>
                                </div>
                                <div className="min-w-0 flex-1 flex flex-col justify-center">
                                    <div className="text-[10px] text-[#DDD] font-bold truncate">{asset.label}</div>
                                    <div className="text-[9px] text-[#555] font-mono">{asset.duration}s</div>
                                </div>
                                <GripVertical size={12} className="text-[#333] opacity-0 group-hover:opacity-100 self-center" />
                            </div>
                        ))}
                    </div>
                </div>

                {/* PREVIEW */}
                <div className="flex-1 bg-black relative flex items-center justify-center">
                    <video ref={videoRef} className="max-h-[85%] max-w-[90%] shadow-2xl transition-opacity duration-100" />
                    <div className="absolute bottom-6 font-mono text-[#00FF41] text-xl drop-shadow-md bg-black/50 px-3 py-1 rounded">
                        {Math.floor(currentTime / 60)}:{Math.floor(currentTime % 60).toString().padStart(2, '0')}
                    </div>
                </div>
            </div>

            {/* BOTTOM: CONTROLS & TIMELINE */}
            <div className="h-12 bg-[#0A0A0A] border-b border-[#222] flex items-center px-4 justify-between shrink-0 select-none">
                <div className="flex items-center gap-4">
                    <button onClick={() => setIsPlaying(!isPlaying)} className="w-8 h-8 flex items-center justify-center bg-[#EEE] rounded-full hover:scale-105 transition-transform text-black">
                        {isPlaying ? <Pause size={14} fill="black" /> : <Play size={14} fill="black" className="ml-0.5" />}
                    </button>
                    <div className="flex items-center gap-2">
                        <ZoomOut size={14} className="text-[#666] cursor-pointer" onClick={() => setZoom(Math.max(10, zoom - 10))} />
                        <input type="range" min="10" max="100" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="w-24 h-1 accent-[#444] bg-[#222] rounded-lg" />
                        <ZoomIn size={14} className="text-[#666] cursor-pointer" onClick={() => setZoom(Math.min(100, zoom + 10))} />
                    </div>
                </div>
                <div className="flex gap-2">
                    {selectedClipId && (
                        <button onClick={() => { setClips(prev => prev.filter(c => c.id !== selectedClipId)); setSelectedClipId(null); }} className="text-red-500 hover:bg-red-900/10 p-2 rounded">
                            <Trash2 size={16} />
                        </button>
                    )}
                    <button
                        onClick={handleExport}
                        disabled={isExporting}
                        className="bg-[#00FF41] text-black text-[10px] font-bold px-3 py-1.5 rounded flex items-center gap-2 hover:bg-[#00CC33]"
                    >
                        {isExporting ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                        {isExporting ? "RENDERING..." : "EXPORT MP4"}
                    </button>
                </div>
            </div>

            <div className="h-[320px] bg-[#080808] flex flex-col relative select-none shrink-0 overflow-hidden">
                <div
                    ref={timelineRef}
                    className="flex-1 overflow-x-auto overflow-y-hidden relative custom-scrollbar"
                    onMouseDown={(e) => {
                        if ((e.target as HTMLElement).closest('.rnd-clip')) return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = e.clientX - rect.left + e.currentTarget.scrollLeft;
                        setCurrentTime(Math.min(totalDuration, Math.max(0, x / zoom)));
                    }}
                >
                    {/* RULER */}
                    <div className="h-8 bg-[#0F0F0F] border-b border-[#222] sticky top-0 z-20 flex" style={{ width: `${(totalDuration + 5) * zoom}px` }}>
                        {Array.from({ length: Math.ceil(totalDuration) + 5 }).map((_, i) => (
                            <div key={i} className="flex-shrink-0 h-full border-l border-[#222] relative" style={{ width: `${zoom}px` }}>
                                <span className="absolute top-1 left-1 text-[8px] text-[#555] font-mono">{i}s</span>
                            </div>
                        ))}
                    </div>

                    {/* PLAYHEAD */}
                    <div className="absolute top-0 bottom-0 w-[1px] bg-[#00FF41] z-30 pointer-events-none" style={{ left: `${currentTime * zoom}px`, height: '100%' }}>
                        <div className="w-3 h-3 -ml-1.5 bg-[#00FF41] transform rotate-45 -mt-1.5" />
                    </div>

                    {/* TRACK 0: VIDEO */}
                    <div
                        className="h-28 bg-[#0A0A0A] border-b border-[#222] relative"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => handleDropOnTrack(e, 0)}
                        style={{ width: `${(totalDuration + 5) * zoom}px` }}
                    >
                        <div className="absolute left-2 top-2 text-[9px] font-bold text-[#333] pointer-events-none flex gap-1 items-center z-0"><Film size={10} /> VIDEO</div>
                        {clips.filter(c => c.trackId === 0).map(clip => (
                            <Rnd
                                key={clip.id}
                                className={`rnd-clip rounded overflow-hidden border z-10 ${selectedClipId === clip.id ? 'border-[#00FF41] shadow-lg' : 'border-[#333] hover:border-[#666]'}`}
                                size={{ width: clip.duration * zoom, height: "70%" }}
                                position={{ x: clip.start * zoom, y: 20 }}
                                onDragStop={(e: any, d: any) => {
                                    const snapped = Math.round((d.x / zoom) * 10) / 10;
                                    setClips(prev => prev.map(c => c.id === clip.id ? { ...c, start: snapped } : c));
                                }}
                                onResizeStop={(e: any, dir: any, ref: any, delta: any, pos: any) => handleResizeStop(clip.id, dir, ref, delta, pos)}
                                bounds="parent"
                                dragAxis="x"
                                enableResizing={{ left: true, right: true }}
                                onClick={(e: React.MouseEvent) => { e.stopPropagation(); setSelectedClipId(clip.id); }}
                            >
                                <div className="w-full h-full bg-[#1a1a1a] relative">
                                    <div className="absolute inset-0 opacity-50 bg-repeat-x grayscale" style={{ backgroundImage: `url(${clip.thumbnail})`, backgroundSize: 'auto 100%' }} />
                                    <div className="absolute bottom-1 left-1 text-[9px] text-white font-bold truncate w-full px-1">{clip.label}</div>
                                    <div className="absolute left-0 top-0 bottom-0 w-2 hover:bg-white/20 cursor-w-resize z-20" />
                                    <div className="absolute right-0 top-0 bottom-0 w-2 hover:bg-white/20 cursor-e-resize z-20" />
                                </div>
                            </Rnd>
                        ))}
                    </div>

                    {/* TRACK 1: AUDIO */}
                    <div
                        className="h-20 bg-[#0A0A0A] border-b border-[#222] relative"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => handleDropOnTrack(e, 1)}
                        style={{ width: `${(totalDuration + 5) * zoom}px` }}
                    >
                        <div className="absolute left-2 top-2 text-[9px] font-bold text-[#333] pointer-events-none flex gap-1 items-center z-0"><Music size={10} /> AUDIO</div>
                        {clips.filter(c => c.trackId === 1).map(clip => (
                            <Rnd
                                key={clip.id}
                                className={`rnd-clip rounded overflow-hidden border z-10 ${selectedClipId === clip.id ? 'border-blue-400 bg-[#1e3a8a]' : 'border-[#334155] bg-[#1e293b]'}`}
                                size={{ width: clip.duration * zoom, height: "60%" }}
                                position={{ x: clip.start * zoom, y: 15 }}
                                onDragStop={(e: any, d: any) => {
                                    const snapped = Math.round((d.x / zoom) * 10) / 10;
                                    setClips(prev => prev.map(c => c.id === clip.id ? { ...c, start: snapped } : c));
                                }}
                                onResizeStop={(e: any, dir: any, ref: any, delta: any, pos: any) => handleResizeStop(clip.id, dir, ref, delta, pos)}
                                bounds="parent"
                                dragAxis="x"
                                enableResizing={{ left: true, right: true }}
                                onClick={(e: React.MouseEvent) => { e.stopPropagation(); setSelectedClipId(clip.id); }}
                            >
                                <div className="w-full h-full relative flex items-center justify-center">
                                    <div className="w-full h-[1px] bg-blue-300 opacity-50" />
                                    <span className="absolute top-1 left-2 text-[9px] text-blue-100 font-mono truncate">{clip.label}</span>
                                    <div className="absolute left-0 top-0 bottom-0 w-2 hover:bg-white/20 cursor-w-resize z-20" />
                                    <div className="absolute right-0 top-0 bottom-0 w-2 hover:bg-white/20 cursor-e-resize z-20" />
                                </div>
                            </Rnd>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};