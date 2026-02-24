"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
    ArrowLeft, Loader2, Download, CheckCircle2,
    Video, Sparkles, Palette, Film, Clapperboard,
    MonitorSmartphone, Zap, AlertCircle, RefreshCw,
    Clock, Scissors, Image as ImageIcon, VideoIcon, Play,
    Music, Volume2, X, ArrowRightLeft, ExternalLink
} from "lucide-react";
import { toast } from "react-hot-toast";
import { doc, collection, onSnapshot } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { fetchProject, fetchEpisodes, fetchUserCredits, generateUGC, animateShot, fetchMusicLibrary, exportUGC } from "@/lib/api";
import { Project } from "@/lib/types";

type UGCStatus = "idle" | "queued" | "generating_shots" | "generating_images" | "animating" | "rendering" | "completed" | "error";

interface MusicTrack {
    id: string;
    name: string;
    description: string;
    bpm: number;
    mood: string;
}

interface UGCClip {
    shot_id: string;
    scene_id: string;
    video_url: string;
    content_type: "talking_head" | "broll";
}

// Richer shot media type for per-shot tracking
interface ShotMedia {
    id: string;
    shot_id: string;
    scene_id: string;
    image_url: string | null;
    video_url: string | null;
    prompt: string;
    content_type: string;
    animating: boolean; // local UI state for per-shot animation
}

const STATUS_STAGES: { key: UGCStatus; label: string; Icon: React.ComponentType<any> }[] = [
    { key: "queued", label: "Starting...", Icon: Clock },
    { key: "generating_shots", label: "AI Director analyzing...", Icon: Scissors },
    { key: "generating_images", label: "Creating visuals...", Icon: ImageIcon },
    { key: "animating", label: "Bringing to life...", Icon: VideoIcon },
    { key: "rendering", label: "Rendering clips...", Icon: Film },
    { key: "completed", label: "Your video is ready!", Icon: CheckCircle2 },
];

const STAGE_ORDER = STATUS_STAGES.map(s => s.key);

export default function UGCStudioPage() {
    const params = useParams();
    const router = useRouter();
    const projectId = params.id as string;

    const [loading, setLoading] = useState(true);
    const [project, setProject] = useState<Project | null>(null);
    const [episodeId, setEpisodeId] = useState("");
    const [credits, setCredits] = useState<number | null>(null);

    const [ugcStatus, setUgcStatus] = useState<UGCStatus>("idle");
    const [ugcProgress, setUgcProgress] = useState(0);
    const [ugcStep, setUgcStep] = useState("");
    const [ugcError, setUgcError] = useState<string | null>(null);
    const [ugcClips, setUgcClips] = useState<UGCClip[]>([]);
    const [ugcTotalCredits, setUgcTotalCredits] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedClip, setSelectedClip] = useState(0);

    // Shot-level media for per-shot control
    const [shotMedia, setShotMedia] = useState<ShotMedia[]>([]);

    const [videoProvider, setVideoProvider] = useState("kling");
    const [videoDuration, setVideoDuration] = useState("5");
    const [videoMode, setVideoMode] = useState("standard");
    const [imageProvider, setImageProvider] = useState("gemini");

    // Music & Export
    const [musicTracks, setMusicTracks] = useState<MusicTrack[]>([]);
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportTrack, setExportTrack] = useState("none");
    const [exportVolume, setExportVolume] = useState(0.15);
    const [exportTransition, setExportTransition] = useState<"crossfade" | "fade_black" | "cut">("crossfade");
    const [exportTransitionDuration, setExportTransitionDuration] = useState(0.5);
    const [isExporting, setIsExporting] = useState(false);
    const [exportStatus, setExportStatus] = useState<string | null>(null);
    const [exportProgress, setExportProgress] = useState(0);
    const [exportUrl, setExportUrl] = useState<string | null>(null);
    const [exportError, setExportError] = useState<string | null>(null);

    // Init
    useEffect(() => {
        (async () => {
            try {
                const [proj, epsData, creds] = await Promise.all([
                    fetchProject(projectId),
                    fetchEpisodes(projectId),
                    fetchUserCredits(auth.currentUser?.uid || "")
                ]);
                setProject(proj);
                setCredits(creds);
                const eps = Array.isArray(epsData) ? epsData : (epsData.episodes || []);
                const mainEp = eps.find((e: any) => e.id === proj.default_episode_id) || eps[0];
                if (mainEp) setEpisodeId(mainEp.id);
            } catch (e) {
                console.error(e);
                toast.error("Failed to load project");
            } finally {
                setLoading(false);
            }
        })();
    }, [projectId]);

    // Pipeline progress listener
    useEffect(() => {
        if (!episodeId) return;
        const epRef = doc(db, "projects", projectId, "episodes", episodeId);
        const unsub = onSnapshot(epRef, (snap) => {
            const data = snap.data();
            if (!data) return;
            const status = data.ugc_status as UGCStatus | undefined;
            if (status) {
                setUgcStatus(status);
                setUgcProgress(data.ugc_progress || 0);
                setUgcStep(data.ugc_step || "");
                setUgcError(data.ugc_error || null);
                // Incremental clips during rendering and completed
                if ((status === "rendering" || status === "completed") && data.ugc_video_clips) {
                    setUgcClips(data.ugc_video_clips);
                    setUgcTotalCredits(data.ugc_total_credits || 0);
                }
            }
            // Export progress listener
            if (data.ugc_export_status) {
                setExportStatus(data.ugc_export_status);
                setExportProgress(data.ugc_export_progress || 0);
                if (data.ugc_export_url) setExportUrl(data.ugc_export_url);
                if (data.ugc_export_error) setExportError(data.ugc_export_error);
                // Reset submitting state when export finishes
                if (data.ugc_export_status === 'completed' || data.ugc_export_status === 'error') {
                    setIsExporting(false);
                }
            }
        });
        return () => unsub();
    }, [projectId, episodeId]);

    // Fetch music library
    useEffect(() => {
        fetchMusicLibrary().then(tracks => setMusicTracks(tracks)).catch(() => { });
    }, []);

    // Listen for shot-level media (images/videos as they appear)
    useEffect(() => {
        const active = ["queued", "generating_shots", "generating_images", "animating", "rendering", "completed", "error"].includes(ugcStatus);
        if (!episodeId || !active) return;

        const scenesRef = collection(db, "projects", projectId, "episodes", episodeId, "scenes");
        const unsubs: (() => void)[] = [];

        const scenesUnsub = onSnapshot(scenesRef, (scenesSnap) => {
            for (const sceneDoc of scenesSnap.docs) {
                const shotsRef = collection(db, "projects", projectId, "episodes", episodeId, "scenes", sceneDoc.id, "shots");
                const shotUnsub = onSnapshot(shotsRef, (shotsSnap) => {
                    const media: ShotMedia[] = [];
                    shotsSnap.docs.forEach(shotDoc => {
                        const d = shotDoc.data();
                        if (d.image_url || d.video_url) {
                            media.push({
                                id: shotDoc.id,
                                shot_id: shotDoc.id,
                                scene_id: sceneDoc.id,
                                image_url: d.image_url || null,
                                video_url: d.video_url || null,
                                prompt: d.video_prompt || d.visual_action || "Cinematic motion",
                                content_type: d.content_type || "broll",
                                animating: false,
                            });
                        }
                    });
                    setShotMedia(prev => {
                        // Keep shots from OTHER scenes, replace shots from THIS scene
                        const otherSceneShots = prev.filter(s => s.scene_id !== sceneDoc.id);
                        const prevMap = new Map(prev.map(s => [s.id, s]));
                        const thisSceneShots = media.map(m => {
                            const existing = prevMap.get(m.id);
                            return {
                                ...m,
                                animating: existing?.animating || false,
                                ...(m.video_url && existing?.animating ? { animating: false } : {}),
                            };
                        });
                        return [...otherSceneShots, ...thisSceneShots];
                    });
                });
                unsubs.push(shotUnsub);
            }
        });
        unsubs.push(scenesUnsub);

        return () => unsubs.forEach(u => u());
    }, [projectId, episodeId, ugcStatus]);

    // Animate a single shot
    const handleAnimateOne = useCallback(async (shot: ShotMedia) => {
        if (!shot.image_url) {
            toast.error("No image to animate");
            return;
        }
        setShotMedia(prev => prev.map(s => s.id === shot.id ? { ...s, animating: true } : s));
        try {
            await animateShot({
                project_id: projectId,
                episode_id: episodeId,
                scene_id: shot.scene_id,
                shot_id: shot.shot_id,
                image_url: shot.image_url,
                prompt: shot.prompt,
                provider: videoProvider,
                duration: videoDuration,
                mode: videoMode,
                aspect_ratio: project?.aspect_ratio || "9:16",
            });
            toast.success(`Shot ${shot.shot_id.slice(-4)} queued for animation`);
        } catch (e: any) {
            setShotMedia(prev => prev.map(s => s.id === shot.id ? { ...s, animating: false } : s));
            toast.error(e.response?.data?.detail || "Animation failed");
        }
    }, [projectId, episodeId, videoProvider, videoDuration, videoMode, project]);

    const handleGenerate = useCallback(async () => {
        if (!episodeId) return;
        // If images already exist, skip image generation and just animate
        const shotsWithImages = shotMedia.filter(s => s.image_url && !s.video_url && !s.animating);
        if (shotsWithImages.length > 0) {
            setUgcStatus("animating");
            toast.success(`Animating ${shotsWithImages.length} existing shots...`);
            for (const shot of shotsWithImages) {
                await handleAnimateOne(shot);
                await new Promise(r => setTimeout(r, 200));
            }
            return;
        }

        setIsSubmitting(true);
        try {
            await generateUGC({
                project_id: projectId,
                episode_id: episodeId,
                video_provider: videoProvider,
                video_duration: videoDuration,
                video_mode: videoMode,
                aspect_ratio: project?.aspect_ratio || "9:16",
                image_provider: imageProvider,
                style: "realistic",
            });
            setUgcStatus("queued");
            setShotMedia([]);
            toast.success("UGC pipeline started!");
        } catch (e: any) {
            toast.error(e.response?.data?.detail || "Failed to start generation");
        } finally {
            setIsSubmitting(false);
        }
    }, [projectId, episodeId, videoProvider, videoDuration, videoMode, imageProvider, project, shotMedia, handleAnimateOne]);

    // Animate all shots missing videos
    const handleAnimateAll = useCallback(async () => {
        const missing = shotMedia.filter(s => s.image_url && !s.video_url && !s.animating);
        if (missing.length === 0) {
            toast("All shots already have videos or are animating");
            return;
        }
        for (const shot of missing) {
            await handleAnimateOne(shot);
            await new Promise(r => setTimeout(r, 200));
        }
    }, [shotMedia, handleAnimateOne]);

    const handleDownloadAll = useCallback(async () => {
        const downloadable = ugcClips.length > 0
            ? ugcClips.map(c => ({ url: c.video_url, name: c.shot_id }))
            : shotMedia.filter(s => s.video_url).map(s => ({ url: s.video_url!, name: s.shot_id }));
        for (const item of downloadable) {
            const a = document.createElement("a");
            a.href = item.url;
            a.download = `${item.name}.mp4`;
            a.target = "_blank";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            await new Promise(r => setTimeout(r, 300));
        }
    }, [ugcClips, shotMedia]);

    // Export with music & transitions
    const handleExport = useCallback(async () => {
        if (!episodeId) return;
        setIsExporting(true);
        setExportError(null);
        try {
            await exportUGC({
                project_id: projectId,
                episode_id: episodeId,
                music_track: exportTrack,
                music_volume: exportVolume,
                transition_duration: exportTransitionDuration,
                transition_type: exportTransition,
            });
            setExportStatus("exporting");
            toast.success("Export started!");
        } catch (e: any) {
            toast.error(e.response?.data?.detail || "Export failed");
            setIsExporting(false);
        }
    }, [projectId, episodeId, exportTrack, exportVolume, exportTransitionDuration, exportTransition]);

    if (loading || !project) {
        return (
            <div className="fixed inset-0 z-[60] bg-[#050505] flex flex-col items-center justify-center gap-4">
                <Loader2 className="animate-spin text-[#E50914]" size={32} />
                <span className="text-xs tracking-widest text-neutral-600 uppercase">Loading UGC Studio...</span>
            </div>
        );
    }

    const isPipelineActive = ["queued", "generating_shots", "generating_images", "animating"].includes(ugcStatus);
    const isRendering = ugcStatus === "rendering";
    const isCompleted = ugcStatus === "completed";
    const isError = ugcStatus === "error";
    const hasErrorWithMedia = isError && shotMedia.length > 0;
    const showSettings = !isPipelineActive && !isRendering && !isCompleted && !hasErrorWithMedia;
    const activeStage = STATUS_STAGES.find(s => s.key === ugcStatus);

    // Build display clips for completed view
    const displayClips = ugcClips.length > 0 ? ugcClips.map(c => ({
        id: c.shot_id,
        url: c.video_url,
        type: 'video' as const,
        content_type: c.content_type,
    })) : shotMedia.filter(s => s.video_url || s.image_url).map(s => ({
        id: s.id,
        url: s.video_url || s.image_url || '',
        type: (s.video_url ? 'video' : 'image') as 'video' | 'image',
        content_type: s.content_type as "talking_head" | "broll",
    }));

    const safeSelected = Math.min(selectedClip, Math.max(displayClips.length - 1, 0));
    const currentClip = displayClips[safeSelected];

    return (
        <div className="fixed inset-0 z-[60] bg-[#050505] text-[#EEE] font-sans overflow-hidden flex flex-col">
            {/* HEADER */}
            <div className="h-12 border-b border-white/[0.06] bg-[#080808]/90 backdrop-blur-xl flex items-center justify-between px-5 shrink-0">
                <div className="flex items-center gap-3">
                    <Link href="/dashboard" className="flex items-center gap-1.5 text-neutral-500 hover:text-white transition-colors group no-underline">
                        <ArrowLeft size={13} className="group-hover:-translate-x-0.5 transition-transform" />
                        <span className="text-[9px] font-bold tracking-[0.2em] uppercase">Back</span>
                    </Link>
                    <div className="w-px h-4 bg-white/[0.08]" />
                    <div className="flex items-center gap-2">
                        <div className="h-6 w-6 bg-[#E50914]/10 border border-[#E50914]/30 flex items-center justify-center rounded">
                            <Video className="text-[#E50914]" size={12} />
                        </div>
                        <span className="text-[11px] font-bold text-white tracking-wide">{project.title}</span>
                        <span className="text-[8px] font-mono text-neutral-600 uppercase tracking-widest">UGC</span>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {(isCompleted || isRendering || hasErrorWithMedia) && (
                        <>
                            {isCompleted && (
                                <button onClick={() => setShowExportModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#E50914] hover:bg-[#ff1a25] rounded-lg text-[9px] font-bold text-white uppercase tracking-wider transition-all cursor-pointer shadow-[0_2px_12px_rgba(229,9,20,0.3)]">
                                    <Music size={11} /> Export
                                </button>
                            )}
                            {exportUrl && (
                                <a href={exportUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 border border-green-500/30 hover:border-green-500/60 rounded-lg text-[9px] font-bold text-green-400 uppercase tracking-wider transition-all">
                                    <ExternalLink size={11} /> Download MP4
                                </a>
                            )}
                            {(ugcClips.length > 0 || shotMedia.some(s => s.video_url)) && (
                                <button onClick={handleDownloadAll} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.06] border border-white/[0.1] hover:border-white/20 rounded-lg text-[9px] font-bold text-white uppercase tracking-wider transition-all cursor-pointer">
                                    <Download size={11} /> Clips
                                </button>
                            )}
                            {hasErrorWithMedia && shotMedia.some(s => !s.video_url && s.image_url) && (
                                <button onClick={handleAnimateAll} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#E50914]/10 border border-[#E50914]/30 hover:border-[#E50914]/60 rounded-lg text-[9px] font-bold text-[#E50914] uppercase tracking-wider transition-all cursor-pointer">
                                    <Play size={11} /> Animate All
                                </button>
                            )}
                            <button onClick={() => { setUgcStatus("idle"); setUgcClips([]); setSelectedClip(0); setUgcError(null); setExportUrl(null); setExportStatus(null); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.04] border border-white/[0.08] hover:border-white/20 rounded-lg text-[9px] font-bold text-neutral-400 hover:text-white uppercase tracking-wider transition-all cursor-pointer">
                                <RefreshCw size={11} /> New
                            </button>
                        </>
                    )}
                    {credits !== null && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/[0.03] border border-white/[0.06] rounded-lg">
                            <Sparkles size={10} className="text-amber-400" />
                            <span className="text-[11px] text-white font-bold font-mono">{credits.toLocaleString()}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* MAIN */}
            <div className="flex-1 relative overflow-hidden">
                {/* Floating background during pipeline */}
                {isPipelineActive && shotMedia.length > 0 && (
                    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                        {shotMedia.slice(0, 12).map((media, i) => {
                            const positions = [
                                { top: '5%', left: '8%' }, { top: '15%', right: '5%' },
                                { bottom: '20%', left: '3%' }, { bottom: '10%', right: '10%' },
                                { top: '40%', left: '2%' }, { top: '35%', right: '3%' },
                                { top: '60%', left: '7%' }, { top: '55%', right: '8%' },
                                { top: '8%', left: '25%' }, { bottom: '5%', left: '20%' },
                                { top: '25%', right: '20%' }, { bottom: '30%', right: '15%' },
                            ];
                            const pos = positions[i % positions.length];
                            const size = 80 + (i % 4) * 20;
                            const url = media.video_url || media.image_url;
                            if (!url) return null;
                            return (
                                <div key={media.id} className="absolute rounded-xl overflow-hidden" style={{ ...pos, width: size, height: size * (16 / 9), opacity: 0, filter: 'blur(2px)', animation: `floatMedia ${15 + (i % 5) * 5}s ease-in-out ${i * 0.4}s infinite, fadeInMedia 1.5s ease ${i * 0.4}s forwards` }}>
                                    {media.video_url ? (
                                        <video src={media.video_url} className="w-full h-full object-cover" autoPlay muted loop playsInline />
                                    ) : (
                                        <img src={url} alt="" className="w-full h-full object-cover" />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                <div className="relative z-10 h-full flex flex-col items-center justify-center p-6">
                    {/* SETTINGS */}
                    {showSettings && (
                        <div className="w-full max-w-md space-y-5 ugc-fade-in">
                            <div className="text-center space-y-1.5">
                                <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#E50914]/10 border border-[#E50914]/30 rounded-full text-[9px] font-bold text-[#E50914] uppercase tracking-widest">
                                    <Sparkles size={10} /> One-Click Video
                                </div>
                                <h2 className="text-xl font-bold text-white tracking-tight">Generate Your Reel</h2>
                                <p className="text-[11px] text-neutral-500">Configure and generate all shots in one go.</p>
                            </div>

                            {isError && ugcError && (
                                <div className="flex items-start gap-3 p-3 bg-red-950/20 border border-red-900/40 rounded-lg">
                                    <AlertCircle size={14} className="text-red-500 mt-0.5 shrink-0" />
                                    <div>
                                        <div className="text-[11px] font-bold text-red-400 mb-0.5">Failed</div>
                                        <div className="text-[10px] text-red-300/70">{ugcError}</div>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <label className="text-[8px] font-bold text-neutral-500 uppercase tracking-[3px] flex items-center gap-1.5"><Film size={9} /> Video Model</label>
                                <div className="grid grid-cols-3 gap-1.5">
                                    {[{ id: "kling", label: "Kling v2", desc: "Balanced" }, { id: "kling-v3", label: "Kling v3", desc: "Premium" }, { id: "seedance", label: "Seedance", desc: "Creative" }].map(p => (
                                        <button key={p.id} onClick={() => setVideoProvider(p.id)} className={`py-2 px-2 rounded-lg border text-center transition-all cursor-pointer ${videoProvider === p.id ? 'border-[#E50914]/50 bg-[#E50914]/[0.08]' : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]'}`}>
                                            <div className={`text-[10px] font-bold ${videoProvider === p.id ? 'text-white' : 'text-neutral-500'}`}>{p.label}</div>
                                            <div className={`text-[7px] uppercase tracking-wider ${videoProvider === p.id ? 'text-[#E50914]/60' : 'text-neutral-700'}`}>{p.desc}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-[8px] font-bold text-neutral-500 uppercase tracking-[3px] flex items-center gap-1.5"><Clapperboard size={9} /> Duration</label>
                                    <div className="flex gap-1">
                                        {["3", "5", "10"].map(d => (
                                            <button key={d} onClick={() => setVideoDuration(d)} className={`flex-1 py-2 rounded-lg border text-center transition-all cursor-pointer ${videoDuration === d ? 'border-[#E50914]/50 bg-[#E50914]/[0.08]' : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]'}`}>
                                                <div className={`text-[11px] font-bold font-mono ${videoDuration === d ? 'text-white' : 'text-neutral-500'}`}>{d}s</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[8px] font-bold text-neutral-500 uppercase tracking-[3px] flex items-center gap-1.5"><MonitorSmartphone size={9} /> Quality</label>
                                    <div className="flex gap-1">
                                        {[{ id: "standard", label: "720p" }, { id: "pro", label: "1080p" }].map(q => (
                                            <button key={q.id} onClick={() => setVideoMode(q.id)} className={`flex-1 py-2 rounded-lg border text-center transition-all cursor-pointer ${videoMode === q.id ? 'border-[#E50914]/50 bg-[#E50914]/[0.08]' : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]'}`}>
                                                <div className={`text-[10px] font-bold ${videoMode === q.id ? 'text-white' : 'text-neutral-500'}`}>{q.label}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[8px] font-bold text-neutral-500 uppercase tracking-[3px] flex items-center gap-1.5"><Palette size={9} /> Image Engine</label>
                                <div className="grid grid-cols-2 gap-1.5">
                                    {[{ id: "gemini", label: "Gemini", desc: "Google" }, { id: "seedream", label: "Seedream", desc: "ByteDance" }].map(p => (
                                        <button key={p.id} onClick={() => setImageProvider(p.id)} className={`py-2 px-2 rounded-lg border text-center transition-all cursor-pointer ${imageProvider === p.id ? 'border-[#E50914]/50 bg-[#E50914]/[0.08]' : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]'}`}>
                                            <div className={`text-[10px] font-bold ${imageProvider === p.id ? 'text-white' : 'text-neutral-500'}`}>{p.label}</div>
                                            <div className={`text-[7px] uppercase tracking-wider ${imageProvider === p.id ? 'text-[#E50914]/60' : 'text-neutral-700'}`}>{p.desc}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex items-center justify-between px-3 py-2 bg-white/[0.02] border border-white/[0.06] rounded-lg">
                                <span className="text-[8px] font-bold text-neutral-500 uppercase tracking-[3px]">Aspect Ratio</span>
                                <span className="text-[12px] font-bold font-mono text-white">{project.aspect_ratio || "9:16"}</span>
                            </div>

                            <button onClick={handleGenerate} disabled={isSubmitting || !episodeId} className="w-full py-3.5 rounded-xl text-[11px] font-bold uppercase tracking-[3px] transition-all duration-300 flex items-center justify-center gap-2.5 cursor-pointer bg-[#E50914] hover:bg-[#ff1a25] text-white shadow-[0_4px_24px_rgba(229,9,20,0.3)] hover:shadow-[0_4px_32px_rgba(229,9,20,0.5)] disabled:opacity-50 disabled:cursor-not-allowed">
                                {isSubmitting ? (<><Loader2 size={14} className="animate-spin" /> Starting...</>) : (<><Zap size={14} /> Generate Video</>)}
                            </button>
                        </div>
                    )}

                    {/* PROGRESS */}
                    {isPipelineActive && (
                        <div className="w-full max-w-sm space-y-6 text-center ugc-fade-in">
                            <div className="relative mx-auto w-20 h-20">
                                <div className="absolute inset-0 bg-[#E50914]/10 rounded-full animate-ping" />
                                <div className="relative w-full h-full flex items-center justify-center bg-[#E50914]/5 border border-[#E50914]/20 rounded-full">
                                    {activeStage ? <activeStage.Icon size={28} className="text-[#E50914]" /> : <Loader2 size={28} className="text-[#E50914] animate-spin" />}
                                </div>
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-white mb-1">{activeStage?.label || "Processing..."}</h2>
                                {ugcStep && <p className="text-[11px] text-neutral-400 font-mono">{ugcStep}</p>}
                            </div>
                            <div className="space-y-1.5">
                                <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-[#E50914] to-[#ff4757] rounded-full transition-all duration-500 ease-out" style={{ width: `${ugcProgress}%` }} />
                                </div>
                                <div className="text-[9px] font-mono text-neutral-500">{ugcProgress}%</div>
                            </div>
                            <div className="flex items-center justify-center gap-2">
                                {STATUS_STAGES.filter(s => s.key !== "completed").map((stage, i) => {
                                    const currentIdx = STAGE_ORDER.indexOf(ugcStatus);
                                    const stageIdx = STAGE_ORDER.indexOf(stage.key);
                                    const isDone = stageIdx < currentIdx;
                                    const isActive = stage.key === ugcStatus;
                                    return (
                                        <React.Fragment key={stage.key}>
                                            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider transition-all ${isActive ? 'bg-[#E50914]/20 text-[#E50914] border border-[#E50914]/40' : isDone ? 'bg-green-500/10 text-green-400 border border-green-500/30' : 'bg-white/[0.02] text-neutral-600 border border-white/[0.06]'}`}>
                                                <stage.Icon size={8} />
                                                {isActive && <span>{stage.label.split("...")[0]}</span>}
                                            </div>
                                            {i < 3 && <div className={`w-4 h-px ${isDone ? 'bg-green-500/40' : 'bg-white/[0.06]'}`} />}
                                        </React.Fragment>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* ERROR RECOVERY: Per-shot image grid with animate buttons */}
                    {hasErrorWithMedia && (
                        <div className="w-full h-full flex flex-col ugc-fade-in">
                            <div className="text-center space-y-2 py-3 shrink-0">
                                <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-500/10 border border-red-500/30 rounded-full text-[9px] font-bold text-red-400 uppercase tracking-widest">
                                    <AlertCircle size={10} /> Video Generation Failed
                                </div>
                                <h2 className="text-lg font-bold text-white tracking-tight">Your images are ready</h2>
                                <p className="text-[11px] text-neutral-500 max-w-md mx-auto">
                                    {ugcError || "The video API encountered an error."} Animate individual shots below or retry all at once.
                                </p>
                            </div>

                            <div className="flex-1 overflow-y-auto px-4 pb-4">
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-w-5xl mx-auto">
                                    {shotMedia.map((shot, i) => {
                                        const hasVideo = !!shot.video_url;
                                        const hasImage = !!shot.image_url;
                                        return (
                                            <div key={shot.id} className="relative rounded-xl overflow-hidden border border-white/[0.08] bg-[#0A0A0A] group">
                                                <div className="aspect-[9/16] relative">
                                                    {hasVideo ? (
                                                        <video src={shot.video_url!} className="w-full h-full object-cover" controls preload="metadata" />
                                                    ) : hasImage ? (
                                                        <img src={shot.image_url!} alt={`Shot ${i + 1}`} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center bg-neutral-900">
                                                            <ImageIcon size={24} className="text-neutral-700" />
                                                        </div>
                                                    )}

                                                    {/* Animate overlay for image-only shots */}
                                                    {!hasVideo && hasImage && !shot.animating && (
                                                        <button onClick={() => handleAnimateOne(shot)} className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                                            <div className="w-10 h-10 rounded-full bg-[#E50914] flex items-center justify-center shadow-[0_0_20px_rgba(229,9,20,0.5)]">
                                                                <Play size={18} className="text-white ml-0.5" />
                                                            </div>
                                                            <span className="text-[9px] font-bold text-white uppercase tracking-wider">Animate</span>
                                                        </button>
                                                    )}

                                                    {/* Animating spinner */}
                                                    {shot.animating && (
                                                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60">
                                                            <Loader2 size={20} className="text-[#E50914] animate-spin" />
                                                            <span className="text-[8px] font-bold text-white/70 uppercase tracking-wider">Animating...</span>
                                                        </div>
                                                    )}

                                                    {/* Video ready badge */}
                                                    {hasVideo && (
                                                        <div className="absolute top-2 right-2">
                                                            <div className="w-5 h-5 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center">
                                                                <CheckCircle2 size={10} className="text-green-400" />
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Bottom bar */}
                                                <div className="flex items-center justify-between px-2.5 py-2 border-t border-white/[0.06]">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-[9px] font-bold text-white">Shot {String(i + 1).padStart(2, "0")}</span>
                                                        <span className={`text-[7px] font-bold uppercase tracking-wider px-1 py-0.5 rounded-full ${shot.content_type === "talking_head" ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" : "bg-amber-500/10 text-amber-400 border border-amber-500/20"}`}>
                                                            {shot.content_type === "talking_head" ? "TH" : "BR"}
                                                        </span>
                                                    </div>
                                                    {hasVideo && (
                                                        <a href={shot.video_url!} download={`${shot.shot_id}.mp4`} target="_blank" rel="noopener noreferrer" className="p-1 text-neutral-500 hover:text-white transition-colors">
                                                            <Download size={11} />
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Bottom action bar */}
                            <div className="shrink-0 border-t border-white/[0.06] bg-[#080808]/80 backdrop-blur-xl">
                                <div className="flex items-center justify-center gap-3 px-4 py-3">
                                    <div className="flex items-center gap-1.5 mr-4">
                                        <span className="text-[9px] text-neutral-500">
                                            {shotMedia.filter(s => s.video_url).length}/{shotMedia.length} animated
                                        </span>
                                    </div>
                                    <button onClick={() => { setUgcStatus("idle"); setUgcError(null); setShotMedia([]); }} className="flex items-center gap-1.5 px-4 py-2 bg-white/[0.06] border border-white/[0.1] hover:border-white/20 rounded-xl text-[9px] font-bold text-white uppercase tracking-wider transition-all cursor-pointer">
                                        <RefreshCw size={11} /> Start Over
                                    </button>
                                    {shotMedia.some(s => !s.video_url && s.image_url && !s.animating) && (
                                        <button onClick={handleAnimateAll} className="flex items-center gap-1.5 px-4 py-2 bg-[#E50914] hover:bg-[#ff1a25] rounded-xl text-[9px] font-bold text-white uppercase tracking-wider transition-all cursor-pointer shadow-[0_4px_24px_rgba(229,9,20,0.3)]">
                                            <Play size={11} /> Animate All ({shotMedia.filter(s => !s.video_url && s.image_url && !s.animating).length})
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* COMPLETED / RENDERING: HERO + FILMSTRIP */}
                    {(isCompleted || isRendering) && (() => {
                        // During rendering, show available clips + shimmer placeholders
                        const totalExpected = isRendering ? Math.max(displayClips.length + 3, 6) : displayClips.length;
                        const shimmerCount = isRendering ? totalExpected - displayClips.length : 0;

                        if (displayClips.length === 0 && !isRendering) return (
                            <div className="text-center space-y-3 ugc-fade-in">
                                <CheckCircle2 size={32} className="text-green-400 mx-auto" />
                                <h2 className="text-lg font-bold text-white">Generation Complete</h2>
                                <p className="text-[11px] text-neutral-500">Your content has been generated.</p>
                                <button onClick={() => { setUgcStatus("idle"); setUgcClips([]); }} className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#E50914] hover:bg-[#ff1a25] rounded-xl text-[10px] font-bold text-white uppercase tracking-wider transition-all cursor-pointer">
                                    <RefreshCw size={12} /> Generate Again
                                </button>
                            </div>
                        );

                        return (
                            <div className="w-full h-full flex flex-col ugc-fade-in">
                                {/* Rendering banner */}
                                {isRendering && (
                                    <div className="shrink-0 flex items-center justify-center gap-3 py-2 bg-[#E50914]/5 border-b border-[#E50914]/20">
                                        <Loader2 size={12} className="text-[#E50914] animate-spin" />
                                        <span className="text-[10px] font-bold text-[#E50914] uppercase tracking-wider">{ugcStep || "Rendering clips..."}</span>
                                        <span className="text-[9px] font-mono text-neutral-500">{ugcProgress}%</span>
                                    </div>
                                )}

                                <div className="flex-1 flex items-center justify-center py-2 min-h-0">
                                    <div className="relative rounded-2xl overflow-hidden border border-white/[0.1] shadow-[0_0_60px_rgba(229,9,20,0.1)] bg-black" style={{ maxHeight: '100%', aspectRatio: '9/16' }}>
                                        {currentClip?.type === 'video' ? (
                                            <video key={currentClip.id} src={currentClip.url} className="w-full h-full object-contain" controls autoPlay preload="auto" />
                                        ) : currentClip ? (
                                            <img key={currentClip.id} src={currentClip.url} alt={`Shot ${safeSelected + 1}`} className="w-full h-full object-contain" />
                                        ) : null}
                                        {/* Shot info — positioned above native controls */}
                                        <div className="absolute top-3 left-3 right-3 flex items-start justify-between pointer-events-none">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-bold text-white/90 bg-black/40 backdrop-blur-md px-2 py-0.5 rounded-md">Shot {String(safeSelected + 1).padStart(2, "0")}</span>
                                                <span className={`text-[7px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full backdrop-blur-md ${currentClip?.content_type === "talking_head" ? "bg-blue-500/20 text-blue-300 border border-blue-500/30" : "bg-amber-500/20 text-amber-300 border border-amber-500/30"}`}>
                                                    {currentClip?.content_type === "talking_head" ? "Talking Head" : "B-Roll"}
                                                </span>
                                            </div>
                                            {currentClip && (
                                                <a href={currentClip.url} download={`shot_${safeSelected + 1}.mp4`} target="_blank" rel="noopener noreferrer" className="pointer-events-auto p-1.5 bg-black/40 backdrop-blur-md rounded-lg text-white/80 hover:text-white transition-colors">
                                                    <Download size={12} />
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="shrink-0 border-t border-white/[0.06] bg-[#080808]/80 backdrop-blur-xl">
                                    <div className="flex items-center gap-1 px-4 py-3 overflow-x-auto">
                                        <div className="flex items-center gap-1.5 mr-3 shrink-0">
                                            {isCompleted ? <CheckCircle2 size={11} className="text-green-400" /> : <Loader2 size={11} className="text-[#E50914] animate-spin" />}
                                            <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider whitespace-nowrap">{displayClips.length}{isRendering ? `/${totalExpected}` : ''} Clips</span>
                                        </div>
                                        {displayClips.map((clip, i) => (
                                            <button key={clip.id} onClick={() => setSelectedClip(i)} className={`shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${safeSelected === i ? 'border-[#E50914] shadow-[0_0_12px_rgba(229,9,20,0.3)]' : 'border-transparent hover:border-white/20 opacity-60 hover:opacity-100'}`}>
                                                {clip.type === 'video' ? (
                                                    <video src={clip.url} className="w-full h-full object-cover pointer-events-none" preload="metadata" muted />
                                                ) : (
                                                    <img src={clip.url} alt="" className="w-full h-full object-cover" />
                                                )}
                                            </button>
                                        ))}
                                        {/* Shimmer skeletons for pending clips */}
                                        {Array.from({ length: shimmerCount }).map((_, i) => (
                                            <div key={`shimmer-${i}`} className="shrink-0 w-14 h-14 rounded-lg border-2 border-white/[0.06] bg-white/[0.03] shimmer-pulse" />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </div>
            </div>

            {/* EXPORT MODAL */}
            {showExportModal && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="w-full max-w-lg bg-[#0A0A0A] border border-white/[0.1] rounded-2xl shadow-[0_0_60px_rgba(0,0,0,0.8)] overflow-hidden ugc-fade-in">
                        <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
                            <div className="flex items-center gap-2">
                                <Music size={14} className="text-[#E50914]" />
                                <span className="text-[12px] font-bold text-white uppercase tracking-wider">Export Video</span>
                            </div>
                            <button onClick={() => setShowExportModal(false)} className="p-1 text-neutral-500 hover:text-white transition-colors cursor-pointer">
                                <X size={16} />
                            </button>
                        </div>

                        <div className="p-5 space-y-5 max-h-[60vh] overflow-y-auto">
                            {/* Music Track */}
                            <div className="space-y-2">
                                <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-[3px] flex items-center gap-1.5"><Music size={9} /> Music Track</label>
                                <div className="grid grid-cols-2 gap-1.5 max-h-[200px] overflow-y-auto pr-1">
                                    {musicTracks.map(track => (
                                        <button key={track.id} onClick={() => setExportTrack(track.id)} className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${exportTrack === track.id ? 'border-[#E50914]/50 bg-[#E50914]/[0.08]' : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]'}`}>
                                            <div className={`text-[10px] font-bold ${exportTrack === track.id ? 'text-white' : 'text-neutral-400'}`}>{track.name}</div>
                                            <div className={`text-[8px] mt-0.5 ${exportTrack === track.id ? 'text-neutral-400' : 'text-neutral-600'}`}>{track.description}</div>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className={`text-[7px] uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${exportTrack === track.id ? 'bg-[#E50914]/10 text-[#E50914]/70 border-[#E50914]/20' : 'bg-white/[0.03] text-neutral-600 border-white/[0.06]'}`}>{track.mood}</span>
                                                {track.bpm > 0 && <span className="text-[7px] font-mono text-neutral-600">{track.bpm} BPM</span>}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Volume Slider */}
                            {exportTrack !== 'none' && (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-[3px] flex items-center gap-1.5"><Volume2 size={9} /> Music Volume</label>
                                        <span className="text-[10px] font-mono text-white">{Math.round(exportVolume * 100)}%</span>
                                    </div>
                                    <input type="range" min="0" max="1" step="0.05" value={exportVolume} onChange={e => setExportVolume(parseFloat(e.target.value))} className="w-full accent-[#E50914] h-1 bg-white/[0.06] rounded-full cursor-pointer" />
                                </div>
                            )}

                            {/* Transition Type */}
                            <div className="space-y-2">
                                <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-[3px] flex items-center gap-1.5"><ArrowRightLeft size={9} /> Transition</label>
                                <div className="flex gap-1.5">
                                    {(["crossfade", "fade_black", "cut"] as const).map(t => (
                                        <button key={t} onClick={() => setExportTransition(t)} className={`flex-1 py-2 rounded-lg border text-center transition-all cursor-pointer ${exportTransition === t ? 'border-[#E50914]/50 bg-[#E50914]/[0.08]' : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]'}`}>
                                            <div className={`text-[10px] font-bold ${exportTransition === t ? 'text-white' : 'text-neutral-500'}`}>{t === 'crossfade' ? 'Crossfade' : t === 'fade_black' ? 'Fade Black' : 'Hard Cut'}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Transition Duration */}
                            {exportTransition !== 'cut' && (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-[3px]">Duration</label>
                                        <span className="text-[10px] font-mono text-white">{exportTransitionDuration}s</span>
                                    </div>
                                    <input type="range" min="0" max="1" step="0.1" value={exportTransitionDuration} onChange={e => setExportTransitionDuration(parseFloat(e.target.value))} className="w-full accent-[#E50914] h-1 bg-white/[0.06] rounded-full cursor-pointer" />
                                </div>
                            )}

                            {/* Export Progress */}
                            {exportStatus === 'exporting' && (
                                <div className="space-y-2 p-3 bg-[#E50914]/5 border border-[#E50914]/20 rounded-lg">
                                    <div className="flex items-center gap-2">
                                        <Loader2 size={12} className="text-[#E50914] animate-spin" />
                                        <span className="text-[10px] font-bold text-white">Exporting...</span>
                                        <span className="text-[9px] font-mono text-neutral-500 ml-auto">{exportProgress}%</span>
                                    </div>
                                    <div className="w-full h-1 bg-white/[0.06] rounded-full overflow-hidden">
                                        <div className="h-full bg-gradient-to-r from-[#E50914] to-[#ff4757] rounded-full transition-all duration-500" style={{ width: `${exportProgress}%` }} />
                                    </div>
                                </div>
                            )}

                            {exportError && (
                                <div className="flex items-start gap-2 p-3 bg-red-950/20 border border-red-900/40 rounded-lg">
                                    <AlertCircle size={12} className="text-red-500 mt-0.5 shrink-0" />
                                    <span className="text-[10px] text-red-300/70">{exportError}</span>
                                </div>
                            )}

                            {exportUrl && exportStatus === 'completed' && (
                                <a href={exportUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full py-3 bg-green-500/10 border border-green-500/30 hover:border-green-500/60 rounded-xl text-[11px] font-bold text-green-400 uppercase tracking-wider transition-all">
                                    <ExternalLink size={14} /> Download Final MP4
                                </a>
                            )}
                        </div>

                        <div className="px-5 py-3 border-t border-white/[0.06] flex items-center justify-end gap-3">
                            <button onClick={() => setShowExportModal(false)} className="px-4 py-2 text-[10px] font-bold text-neutral-400 hover:text-white uppercase tracking-wider transition-colors cursor-pointer">
                                Cancel
                            </button>
                            <button onClick={handleExport} disabled={isExporting || exportStatus === 'exporting'} className="flex items-center gap-1.5 px-5 py-2 bg-[#E50914] hover:bg-[#ff1a25] rounded-xl text-[10px] font-bold text-white uppercase tracking-wider transition-all cursor-pointer shadow-[0_2px_12px_rgba(229,9,20,0.3)] disabled:opacity-50 disabled:cursor-not-allowed">
                                {isExporting || exportStatus === 'exporting' ? (<><Loader2 size={12} className="animate-spin" /> Exporting...</>) : (<><Music size={12} /> Export Video</>)}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx global>{`
                @keyframes ugcFadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
                .ugc-fade-in { animation: ugcFadeIn 0.5s ease both; }
                @keyframes floatMedia {
                    0%, 100% { transform: translateY(0px) scale(1); }
                    25% { transform: translateY(-12px) scale(1.02); }
                    50% { transform: translateY(-6px) scale(0.98); }
                    75% { transform: translateY(-18px) scale(1.01); }
                }
                @keyframes fadeInMedia {
                    from { opacity: 0; transform: scale(0.8); }
                    to { opacity: 0.12; transform: scale(1); }
                }
                @keyframes shimmerPulse {
                    0%, 100% { opacity: 0.3; }
                    50% { opacity: 0.1; }
                }
                .shimmer-pulse { animation: shimmerPulse 1.5s ease-in-out infinite; }
            `}</style>
        </div>
    );
}
