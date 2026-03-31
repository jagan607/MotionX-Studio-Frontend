"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    Loader2, ArrowLeft, Film, Download, SlidersHorizontal,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { AnimatePresence } from "framer-motion";
import { collection, query, orderBy, getDocs, onSnapshot, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
    fetchProject, fetchEpisodes, saveTimeline as saveTimelineAPI,
    loadTimeline as loadTimelineAPI,
} from "@/lib/api";
import { Project, Shot } from "@/lib/types";

import Timeline from "@/components/studio/postprod/Timeline";
import ShotInspector from "@/components/studio/postprod/ShotInspector";
import TransportControls from "@/components/studio/postprod/TransportControls";
import VideoEditOverlay from "@/components/studio/postprod/VideoEditOverlay";
import ExportPanel from "@/components/studio/postprod/ExportPanel";
import AudioGenerateBar from "@/components/studio/postprod/AudioGenerateBar";

import {
    TimelineState,
    TimelineTrack,
    TimelineClip,
    TrackType,
} from "@/lib/types/postprod";

import {
    TRACK_COLORS,
    DEFAULT_CLIP_DURATION,
    MAX_UNDO_HISTORY,
    shortId,
    recalcTracks,
    recalcDuration,
    removeGapInTrack,
    buildInitialTimeline,
    findClipAtTime,
    findClipById,
    formatTimecode as formatTimecodeUtil,
    ShotEntry,
} from "@/lib/postprod-utils";

// ═══════════════════════════════════════════════════════════
//   POST-PRODUCTION TERMINAL (v3 — Clipchamp features)
//   Pure utilities imported from @/lib/postprod-utils
// ═══════════════════════════════════════════════════════════

export default function PostProdPage() {
    const params = useParams();
    const router = useRouter();
    const projectId = params.id as string;

    // Data
    const [loading, setLoading] = useState(true);
    const [project, setProject] = useState<Project | null>(null);
    const [episodeId, setEpisodeId] = useState("main");

    // Scene-scoped timeline
    const [scenes, setScenes] = useState<{ id: string; label: string }[]>([]);
    const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
    const [allShotEntries, setAllShotEntries] = useState<ShotEntry[]>([]);

    // Timeline
    const [timeline, setTimeline] = useState<TimelineState | null>(null);
    const [selectedClip, setSelectedClip] = useState<TimelineClip | null>(null);
    const [activeVideoClip, setActiveVideoClip] = useState<TimelineClip | null>(null);

    // Panels
    const [showExport, setShowExport] = useState(false);
    const [exportProgress, setExportProgress] = useState<{ status: string | null; progress: number }>({ status: null, progress: 0 });
    const [showShotInspector, setShowShotInspector] = useState(false);

    // Undo/Redo
    const [undoStack, setUndoStack] = useState<TimelineState[]>([]);
    const [redoStack, setRedoStack] = useState<TimelineState[]>([]);

    // Snap
    const [snapEnabled, setSnapEnabled] = useState(true);

    // Processing clips (motion transfer / relighting in progress)
    const [processingClipIds, setProcessingClipIds] = useState<Set<string>>(new Set());
    // Client-side timeout safety net: tracks when each shotId entered processing
    const processingStartTimesRef = useRef<Map<string, number>>(new Map());

    // Resizable layout panels
    const [previewHeightPct, setPreviewHeightPct] = useState(35); // % of main area
    const [sidebarWidth, setSidebarWidth] = useState(360);        // px
    const mainAreaRef = useRef<HTMLDivElement>(null);

    // Refs
    const videoRef = useRef<HTMLVideoElement>(null);
    const playbackRef = useRef<number | null>(null);
    const isSavingRef = useRef(false);
    const timelineContainerRef = useRef<HTMLDivElement>(null);
    const previewContainerRef = useRef<HTMLDivElement>(null);

    // Edit mode (Generative Edit overlay)
    const [isEditMode, setIsEditMode] = useState(false);

    // Audio generation
    const [audioGenBar, setAudioGenBar] = useState<{ type: 'sfx' | 'bgm'; trackId: string } | null>(null);
    const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());

    // ─── PUSH STATE TO UNDO STACK ───
    const pushUndo = useCallback((state: TimelineState) => {
        setUndoStack((prev) => {
            const stack = [state, ...prev].slice(0, MAX_UNDO_HISTORY);
            return stack;
        });
        setRedoStack([]); // clear redo on new action
    }, []);

    // ─── APPLY EDIT (with undo snapshot) ───
    const applyEdit = useCallback((
        editFn: (prev: TimelineState) => TimelineState
    ) => {
        setTimeline((prev) => {
            if (!prev) return prev;
            pushUndo(prev);
            return editFn(prev);
        });
    }, [pushUndo]);

    // ─── UNDO ───
    const undo = useCallback(() => {
        if (undoStack.length === 0) return;
        setTimeline((prev) => {
            if (!prev) return prev;
            setRedoStack((rs) => [prev, ...rs].slice(0, MAX_UNDO_HISTORY));
            const [restored, ...rest] = undoStack;
            setUndoStack(rest);
            return restored;
        });
        toast.success("Undo");
    }, [undoStack]);

    // ─── REDO ───
    const redo = useCallback(() => {
        if (redoStack.length === 0) return;
        setTimeline((prev) => {
            if (!prev) return prev;
            setUndoStack((us) => [prev, ...us].slice(0, MAX_UNDO_HISTORY));
            const [restored, ...rest] = redoStack;
            setRedoStack(rest);
            return restored;
        });
        toast.success("Redo");
    }, [redoStack]);

    // ─── INIT ───
    useEffect(() => {
        if (!projectId) return;

        async function init() {
            try {
                const proj = await fetchProject(projectId);
                setProject(proj);

                let epId = proj.default_episode_id || "main";
                try {
                    const epsData = await fetchEpisodes(projectId);
                    const eps = Array.isArray(epsData) ? epsData : (epsData.episodes || []);
                    const targetEp = eps.find((e: any) => e.id === epId) || eps[0];
                    if (targetEp?.id) epId = targetEp.id;
                } catch {
                    console.warn("Episodes not found, using default:", epId);
                }
                setEpisodeId(epId);
                let restoredFromSave = false;
                try {
                    const saved = await loadTimelineAPI(projectId, epId);
                    if (saved.status === "loaded" && saved.timeline) {
                        const tl = saved.timeline;

                        // Hydrate clip from backend snake_case → frontend camelCase
                        const hydrateClip = (c: any): TimelineClip => ({
                            id: c.id,
                            trackId: c.track_id ?? c.trackId ?? "",
                            sceneId: c.scene_id ?? c.sceneId ?? "",
                            shotId: c.shot_id ?? c.shotId ?? "",
                            label: c.label ?? "",
                            thumbnailUrl: c.thumbnail_url ?? c.thumbnailUrl,
                            videoUrl: c.video_url ?? c.videoUrl,
                            audioUrl: c.audio_url ?? c.audioUrl,
                            startTime: c.start_time ?? c.startTime ?? 0,
                            duration: c.duration ?? DEFAULT_CLIP_DURATION,
                            trimIn: c.trim_in ?? c.trimIn ?? 0,
                            trimOut: c.trim_out ?? c.trimOut ?? 0,
                            color: c.color ?? TRACK_COLORS.video,
                            locked: c.locked ?? false,
                            muted: c.muted ?? false,
                            selected: false,
                            speed: c.speed ?? 1,
                            // Audio metadata
                            audioType: c.audio_type ?? c.audioType,
                            audioPrompt: c.audio_prompt ?? c.audioPrompt,
                            // Version history
                            videoHistory: c.video_history ?? c.videoHistory,
                        });

                        const filteredTracks = (tl.tracks || []).map((track: any) => ({
                            id: track.id,
                            type: track.type,
                            label: track.label,
                            color: track.color,
                            muted: track.muted ?? false,
                            locked: track.locked ?? false,
                            solo: track.solo ?? false,
                            height: track.height ?? 80,
                            volume: track.volume ?? 1,
                            clips: (track.clips || [])
                                .map(hydrateClip)
                                .filter((c: TimelineClip) =>
                                    track.type !== "video" || c.videoUrl || c.thumbnailUrl
                                ),
                        }));

                        setTimeline({
                            tracks: filteredTracks,
                            transitions: tl.transitions || [],
                            playheadPosition: 0,
                            zoom: 80,
                            duration: tl.duration || 30,
                            fps: tl.fps || 24,
                            isPlaying: false,
                            selectedClipIds: [],
                        });
                        restoredFromSave = true;
                    }
                } catch {
                    console.warn("No saved timeline found, building from shots");
                }

                const scenesQuery = query(
                    collection(db, "projects", projectId, "episodes", epId, "scenes"),
                    orderBy("scene_number", "asc")
                );
                const scenesSnap = await getDocs(scenesQuery);

                // Build scene list + shot entries
                const sceneList: { id: string; label: string }[] = [];
                const shotEntries: ShotEntry[] = [];
                for (const sceneDoc of scenesSnap.docs) {
                    const sceneData = sceneDoc.data();
                    sceneList.push({
                        id: sceneDoc.id,
                        label: sceneData.title || `Scene ${sceneData.scene_number || sceneList.length + 1}`,
                    });
                    const shotsQuery = query(
                        collection(sceneDoc.ref, "shots"),
                        orderBy("created_at", "asc")
                    );
                    const shotsSnap = await getDocs(shotsQuery);
                    shotsSnap.docs.forEach((shotDoc) => {
                        const data = shotDoc.data() as Shot;
                        shotEntries.push({
                            sceneId: sceneDoc.id,
                            shot: { ...data, id: shotDoc.id },
                        });
                    });
                }

                // Store scene data for dropdown
                setScenes(sceneList);
                setAllShotEntries(shotEntries);
                const firstSceneId = sceneList[0]?.id || null;
                setActiveSceneId(firstSceneId);

                // Only build from shots if we didn't restore a saved timeline
                if (!restoredFromSave) {
                    const filtered = firstSceneId
                        ? shotEntries.filter((e) => e.sceneId === firstSceneId)
                        : shotEntries;
                    setTimeline(buildInitialTimeline(filtered));
                }
            } catch (e) {
                console.error("PostProd Load Error:", e);
                toast.error("Failed to load post-production");
            } finally {
                setLoading(false);
            }
        }

        init();
    }, [projectId]);

    // ─── CLEANUP ───
    useEffect(() => {
        return () => {
            if (playbackRef.current) {
                cancelAnimationFrame(playbackRef.current);
                playbackRef.current = null;
            }
        };
    }, []);

    // ─── REAL-TIME SHOT VIDEO REFRESH ───
    // After V2V edits (motion transfer / relighting), Firestore shot docs update.
    // This listener auto-refreshes clip videoUrl when video_status changes to "ready".
    useEffect(() => {
        if (!timeline || !projectId || !episodeId) return;

        // Collect unique sceneId+shotId pairs from video clips
        const shotRefs: { sceneId: string; shotId: string }[] = [];
        const seen = new Set<string>();
        for (const track of timeline.tracks) {
            if (track.type !== "video") continue;
            for (const clip of track.clips) {
                const key = `${clip.sceneId}/${clip.shotId}`;
                if (clip.sceneId && clip.shotId && !seen.has(key)) {
                    seen.add(key);
                    shotRefs.push({ sceneId: clip.sceneId, shotId: clip.shotId });
                }
            }
        }

        if (shotRefs.length === 0) return;

        const unsubscribes = shotRefs.map(({ sceneId, shotId }) => {
            const shotDocRef = doc(
                db, "projects", projectId, "episodes", episodeId,
                "scenes", sceneId, "shots", shotId
            );
            // Track whether each shot's initial snapshot has fired.
            // Suppress toasts during initial load to avoid spam on page refresh.
            const initialFired = new Set<string>();
            return onSnapshot(shotDocRef, (snap) => {
                const data = snap.data();
                if (!data) return;
                const newVideoUrl = data.video_url;
                const status = data.video_status;
                const isInitialSnapshot = !initialFired.has(shotId);
                if (isInitialSnapshot) initialFired.add(shotId);

                // Find clip IDs for this shot
                const clipIdsForShot: string[] = [];
                if (timeline) {
                    for (const track of timeline.tracks) {
                        for (const clip of track.clips) {
                            if (clip.shotId === shotId) clipIdsForShot.push(clip.id);
                        }
                    }
                }

                // Track processing state — controls shimmer overlay on timeline clips
                if (status === "animating" || status === "processing" || status === "pending" || status === "queued") {
                    setProcessingClipIds((prev) => {
                        const next = new Set(prev);
                        clipIdsForShot.forEach((id) => next.add(id));
                        return next;
                    });
                    // Record when this shot started processing (for timeout)
                    if (!processingStartTimesRef.current.has(shotId)) {
                        processingStartTimesRef.current.set(shotId, Date.now());
                    }
                } else if (status === "ready") {
                    processingStartTimesRef.current.delete(shotId);
                    setProcessingClipIds((prev) => {
                        const next = new Set(prev);
                        clipIdsForShot.forEach((id) => next.delete(id));
                        return next;
                    });
                }

                if (status === "ready" && newVideoUrl) {
                    const videoHistory = data.video_history || [];
                    setTimeline((prev) => {
                        if (!prev) return prev;
                        let changed = false;
                        const updatedTracks = prev.tracks.map((track) => ({
                            ...track,
                            clips: track.clips.map((clip) => {
                                if (clip.shotId === shotId && (clip.videoUrl !== newVideoUrl || clip.videoStatus !== "ready")) {
                                    changed = true;
                                    return { ...clip, videoUrl: newVideoUrl, videoStatus: "ready" as const, errorMessage: undefined, videoHistory: videoHistory };
                                }
                                // Also update video_history even if videoUrl hasn't changed
                                if (clip.shotId === shotId && JSON.stringify(clip.videoHistory) !== JSON.stringify(videoHistory)) {
                                    changed = true;
                                    return { ...clip, videoHistory: videoHistory };
                                }
                                return clip;
                            }),
                        }));
                        if (!changed) return prev;
                        if (!isInitialSnapshot) toast.success(`Video ready for ${shotId.slice(-6)}`);
                        return { ...prev, tracks: updatedTracks };
                    });
                } else if (status === "animating" || status === "processing" || status === "pending") {
                    setTimeline((prev) => {
                        if (!prev) return prev;
                        let changed = false;
                        const updatedTracks = prev.tracks.map((track) => ({
                            ...track,
                            clips: track.clips.map((clip) => {
                                if (clip.shotId === shotId && clip.videoStatus !== "animating") {
                                    changed = true;
                                    return { ...clip, videoStatus: "animating" as const };
                                }
                                return clip;
                            }),
                        }));
                        if (!changed) return prev;
                        return { ...prev, tracks: updatedTracks };
                    });
                } else if (status === "error" || status === "failed") {
                    const errMsg = data.error_message || "Video generation failed";
                    processingStartTimesRef.current.delete(shotId);
                    setProcessingClipIds((prev) => {
                        const next = new Set(prev);
                        clipIdsForShot.forEach((id) => next.delete(id));
                        return next;
                    });
                    setTimeline((prev) => {
                        if (!prev) return prev;
                        let changed = false;
                        const updatedTracks = prev.tracks.map((track) => ({
                            ...track,
                            clips: track.clips.map((clip) => {
                                if (clip.shotId === shotId && clip.videoStatus !== "error") {
                                    changed = true;
                                    return { ...clip, videoStatus: "error" as const, errorMessage: errMsg };
                                }
                                return clip;
                            }),
                        }));
                        if (!changed) return prev;
                        if (!isInitialSnapshot) toast.error(`Shot ${shotId.slice(-6)}: ${errMsg}`);
                        return { ...prev, tracks: updatedTracks };
                    });
                }
            });
        });

        return () => unsubscribes.forEach((unsub) => unsub());
    }, [
        // Re-subscribe when track structure changes (new clips added/removed)
        timeline?.tracks.flatMap(t => t.clips.map(c => c.shotId)).join(","),
        projectId, episodeId,
    ]);

    // ─── CLIENT-SIDE TIMEOUT SAFETY NET ───
    // If a shot stays in "animating" for >15 min, auto-mark as error (webhook may have failed)
    useEffect(() => {
        const TIMEOUT_MS = 60 * 60 * 1000; // 60 minutes — PiAPI may queue as "Staged" during high traffic
        const interval = setInterval(() => {
            const now = Date.now();
            const staleShots: string[] = [];
            processingStartTimesRef.current.forEach((startTime, shotId) => {
                if (now - startTime > TIMEOUT_MS) {
                    staleShots.push(shotId);
                }
            });
            if (staleShots.length === 0) return;

            // Clear stale shots from processing
            staleShots.forEach((shotId) => processingStartTimesRef.current.delete(shotId));

            setProcessingClipIds((prev) => {
                const next = new Set(prev);
                setTimeline((prevTl) => {
                    if (!prevTl) return prevTl;
                    const updatedTracks = prevTl.tracks.map((track) => ({
                        ...track,
                        clips: track.clips.map((clip) => {
                            if (staleShots.includes(clip.shotId) && clip.videoStatus === "animating") {
                                next.delete(clip.id);
                                return { ...clip, videoStatus: "error" as const, errorMessage: "Timed out — generation took too long. Try again." };
                            }
                            return clip;
                        }),
                    }));
                    return { ...prevTl, tracks: updatedTracks };
                });
                return next;
            });

            staleShots.forEach((shotId) =>
                toast.error(`Shot ${shotId.slice(-6)} timed out — try again.`)
            );
        }, 60_000); // Check every 60 seconds

        return () => clearInterval(interval);
    }, []);

    // ─── SAVE ───
    const saveTimelineToBackend = useCallback(async () => {
        if (!timeline || !projectId || isSavingRef.current) return;
        isSavingRef.current = true;

        try {
            const backendTracks = timeline.tracks.map((t) => ({
                id: t.id, type: t.type, label: t.label, color: t.color,
                muted: t.muted, locked: t.locked, solo: t.solo,
                height: t.height, volume: t.volume,
                clips: t.clips.map((c) => ({
                    id: c.id, track_id: c.trackId, scene_id: c.sceneId, shot_id: c.shotId,
                    label: c.label,
                    thumbnail_url: c.thumbnailUrl || null,
                    video_url: c.videoUrl || null,
                    audio_url: c.audioUrl || null,
                    start_time: c.startTime, duration: c.duration,
                    trim_in: c.trimIn, trim_out: c.trimOut,
                    color: c.color, locked: c.locked, muted: c.muted,
                    speed: c.speed,
                    // Audio metadata
                    audio_type: c.audioType || null,
                    audio_prompt: c.audioPrompt || null,
                    // Version history
                    video_history: c.videoHistory || null,
                })),
            }));

            const backendTransitions = timeline.transitions.map((t) => ({
                id: t.id, type: t.type, duration: t.duration,
                clip_a_id: t.clipAId, clip_b_id: t.clipBId,
            }));

            await saveTimelineAPI(
                projectId, episodeId, backendTracks, backendTransitions,
                timeline.duration, timeline.fps
            );
            toast.success("Timeline saved");
        } catch (e) {
            console.error("Save error:", e);
            toast.error("Failed to save timeline");
        } finally {
            isSavingRef.current = false;
        }
    }, [timeline, projectId, episodeId]);

    // ─── AUTOSAVE (debounced 2s after structural edits) ───
    const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);
    const hasUnsavedRef = useRef(false);
    const isInitialLoadRef = useRef(true);

    // Fingerprint: only tracks/transitions/duration matter for save
    const structureFingerprint = timeline
        ? JSON.stringify({
            tracks: timeline.tracks.map(t => ({
                ...t,
                clips: t.clips.map(c => ({ ...c, selected: undefined })),
            })),
            transitions: timeline.transitions,
            duration: timeline.duration,
        })
        : "";

    useEffect(() => {
        if (!timeline || !projectId || !structureFingerprint) return;
        // Skip autosave on initial load
        if (isInitialLoadRef.current) {
            isInitialLoadRef.current = false;
            return;
        }
        hasUnsavedRef.current = true;

        if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = setTimeout(() => {
            saveTimelineToBackend();
            hasUnsavedRef.current = false;
        }, 2000);

        return () => {
            if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
        };
    }, [structureFingerprint, projectId, saveTimelineToBackend]);

    // ─── WARN ON UNSAVED CHANGES ───
    useEffect(() => {
        const handler = (e: BeforeUnloadEvent) => {
            if (hasUnsavedRef.current) {
                e.preventDefault();
                e.returnValue = "";
            }
        };
        window.addEventListener("beforeunload", handler);
        return () => window.removeEventListener("beforeunload", handler);
    }, []);

    // ─── VIDEO PREVIEW SYNC ───
    useEffect(() => {
        if (!timeline) return;
        const clip = findClipAtTime(timeline.tracks, timeline.playheadPosition);
        if (clip?.id !== activeVideoClip?.id) {
            setActiveVideoClip(clip);
        }
    }, [timeline?.playheadPosition, timeline?.tracks]);

    useEffect(() => {
        if (!videoRef.current || !activeVideoClip?.videoUrl) return;
        const video = videoRef.current;
        const localTime = (timeline?.playheadPosition || 0) - activeVideoClip.startTime + activeVideoClip.trimIn;

        // Compute trim bounds in terms of the source video time
        const trimStart = activeVideoClip.trimIn;
        const trimEnd = video.duration
            ? video.duration - (activeVideoClip.trimOut || 0)
            : Infinity;
        const clampedTime = Math.max(trimStart, Math.min(localTime, trimEnd));

        // Sync audio: mute/volume from the clip's parent track
        const parentTrack = timeline?.tracks.find(t => t.clips.some(c => c.id === activeVideoClip.id));
        if (parentTrack) {
            video.muted = parentTrack.muted || activeVideoClip.muted;
            video.volume = parentTrack.volume ?? 1;
        }

        if (timeline?.isPlaying) {
            // If we've reached the trim end, stop
            if (localTime >= trimEnd && isFinite(trimEnd)) {
                video.pause();
                video.currentTime = trimEnd;
            } else if (video.paused) {
                video.currentTime = Math.max(0, clampedTime);
                video.play().catch(() => { });
            }
        } else {
            video.pause();
            video.currentTime = Math.max(0, clampedTime);
        }
    }, [activeVideoClip, timeline?.isPlaying, timeline?.playheadPosition, timeline?.tracks]);

    // ─── AUDIO PLAYBACK SYNC (SFX / BGM tracks) ───
    useEffect(() => {
        if (!timeline) return;
        const { playheadPosition, isPlaying, tracks } = timeline;

        // Collect all audio-type clips across all audio tracks
        const audioTracks = tracks.filter(t => t.type === 'sfx' || t.type === 'music');
        const activeClipIds = new Set<string>();

        for (const track of audioTracks) {
            for (const clip of track.clips) {
                if (!clip.audioUrl) continue;
                const clipEnd = clip.startTime + clip.duration;
                const isInRange = playheadPosition >= clip.startTime && playheadPosition < clipEnd;

                if (isInRange) {
                    activeClipIds.add(clip.id);
                    let audio = audioElementsRef.current.get(clip.id);
                    if (!audio) {
                        audio = new Audio(clip.audioUrl);
                        audio.preload = "auto";
                        audioElementsRef.current.set(clip.id, audio);
                    }

                    // Volume & mute
                    audio.muted = track.muted || clip.muted;
                    audio.volume = track.volume ?? 1;

                    const localTime = playheadPosition - clip.startTime + clip.trimIn;
                    if (isPlaying) {
                        if (audio.paused) {
                            audio.currentTime = Math.max(0, localTime);
                            audio.play().catch(() => {});
                        }
                        // Correct drift > 0.3s
                        if (Math.abs(audio.currentTime - localTime) > 0.3) {
                            audio.currentTime = Math.max(0, localTime);
                        }
                    } else {
                        audio.pause();
                        audio.currentTime = Math.max(0, localTime);
                    }
                }
            }
        }

        // Pause any audio elements no longer in range
        audioElementsRef.current.forEach((audio, clipId) => {
            if (!activeClipIds.has(clipId)) {
                audio.pause();
            }
        });
    }, [timeline?.isPlaying, timeline?.playheadPosition, timeline?.tracks]);

    // ─── PLAYBACK ───
    // Keep a ref to selectedClip for the playback tick closure
    const selectedClipRef = useRef<TimelineClip | null>(null);
    selectedClipRef.current = selectedClip;

    const togglePlayback = useCallback(() => {
        if (!timeline) return;

        if (timeline.isPlaying) {
            if (playbackRef.current) {
                cancelAnimationFrame(playbackRef.current);
                playbackRef.current = null;
            }
            setTimeline((prev) => prev ? { ...prev, isPlaying: false } : prev);
        } else {
            // If a clip is selected, snap playhead to clip start
            const loopClip = selectedClipRef.current;
            if (loopClip) {
                const clipStart = loopClip.startTime;
                setTimeline((prev) => prev ? {
                    ...prev,
                    isPlaying: true,
                    playheadPosition: clipStart,
                } : prev);
            } else {
                setTimeline((prev) => prev ? { ...prev, isPlaying: true } : prev);
            }

            let lastTime = performance.now();
            const tick = (now: number) => {
                const dt = (now - lastTime) / 1000;
                lastTime = now;
                let shouldContinue = true;

                setTimeline((prev) => {
                    if (!prev || !prev.isPlaying) { shouldContinue = false; return prev; }

                    const clip = selectedClipRef.current;
                    let nextPos = prev.playheadPosition + dt;

                    if (clip) {
                        // Loop within selected clip range
                        const clipEnd = clip.startTime + clip.duration;
                        if (nextPos >= clipEnd) {
                            nextPos = clip.startTime; // loop back
                        }
                    } else {
                        // Full timeline — stop at end
                        if (nextPos >= prev.duration) {
                            shouldContinue = false;
                            return { ...prev, playheadPosition: 0, isPlaying: false };
                        }
                    }

                    return { ...prev, playheadPosition: nextPos };
                });

                if (shouldContinue) {
                    playbackRef.current = requestAnimationFrame(tick);
                } else {
                    playbackRef.current = null;
                }
            };
            playbackRef.current = requestAnimationFrame(tick);
        }
    }, [timeline?.isPlaying]);

    const seekTo = useCallback((time: number) => {
        setTimeline((prev) =>
            prev ? { ...prev, playheadPosition: Math.max(0, Math.min(time, prev.duration)) } : prev
        );
    }, []);

    const skipForward = useCallback(() => {
        seekTo((timeline?.playheadPosition || 0) + 5);
    }, [timeline?.playheadPosition, seekTo]);

    const skipBackward = useCallback(() => {
        seekTo((timeline?.playheadPosition || 0) - 5);
    }, [timeline?.playheadPosition, seekTo]);

    // ─── ZOOM ───
    const zoomIn = useCallback(() => {
        setTimeline((prev) => prev ? { ...prev, zoom: Math.min(prev.zoom * 1.3, 300) } : prev);
    }, []);

    const zoomOut = useCallback(() => {
        setTimeline((prev) => prev ? { ...prev, zoom: Math.max(prev.zoom / 1.3, 20) } : prev);
    }, []);

    // ─── ZOOM TO FIT (⌘0) ───
    const zoomToFit = useCallback(() => {
        if (!timeline || !timelineContainerRef.current) return;
        const containerWidth = timelineContainerRef.current.clientWidth - 200; // minus track headers
        const idealZoom = Math.max(20, Math.min(containerWidth / (timeline.duration + 2), 300));
        setTimeline((prev) => prev ? { ...prev, zoom: idealZoom } : prev);
    }, [timeline?.duration]);

    // ─── CLIP SELECTION (multi-select with shift) ───
    const onClipSelect = useCallback((clip: TimelineClip | null, addToSelection?: boolean) => {
        if (!clip) {
            // U11: Clicked on empty area or toggle-deselected
            setSelectedClip(null);
            setShowShotInspector(false);
            setTimeline((prev) => prev ? { ...prev, selectedClipIds: [] } : prev);
            return;
        }

        const isAudioClip = !!clip.audioType || !!clip.audioUrl;

        if (addToSelection) {
            // Shift+click: toggle in selection
            setTimeline((prev) => {
                if (!prev) return prev;
                const ids = prev.selectedClipIds.includes(clip.id)
                    ? prev.selectedClipIds.filter((id) => id !== clip.id)
                    : [...prev.selectedClipIds, clip.id];
                return { ...prev, selectedClipIds: ids };
            });
            setSelectedClip(clip);
            if (!isAudioClip) setShowShotInspector(true);
        } else {
            setSelectedClip(clip);
            // Only show inspector for video clips, not SFX/BGM
            if (!isAudioClip) setShowShotInspector(true);
            else setShowShotInspector(false);
            setTimeline((prev) => prev ? { ...prev, selectedClipIds: [clip.id] } : prev);
        }
    }, []);

    // U6/U8: Sync selectedClip with selectedClipIds — handles delete, deselect, undo
    useEffect(() => {
        if (!timeline) return;
        if (timeline.selectedClipIds.length === 0) {
            setSelectedClip(null);
            setShowShotInspector(false);
        } else if (selectedClip && !timeline.selectedClipIds.includes(selectedClip.id)) {
            // selectedClip was deleted or deselected — pick the first remaining
            const firstId = timeline.selectedClipIds[0];
            const found = findClipById(timeline.tracks, firstId);
            setSelectedClip(found);
            setShowShotInspector(!!found);
        } else if (selectedClip) {
            // Refresh selectedClip data in case it was trimmed/moved/muted or video updated
            const refreshed = findClipById(timeline.tracks, selectedClip.id);
            if (refreshed && (
                refreshed.duration !== selectedClip.duration ||
                refreshed.startTime !== selectedClip.startTime ||
                refreshed.videoUrl !== selectedClip.videoUrl ||
                refreshed.videoStatus !== selectedClip.videoStatus ||
                refreshed.muted !== selectedClip.muted ||
                refreshed.trimIn !== selectedClip.trimIn
            )) {
                setSelectedClip(refreshed);
            }
        }
    }, [timeline?.tracks, timeline?.selectedClipIds]);

    // ═════════════════════════════════════════════════════════
    //   EXPORT PROGRESS (Firestore real-time listener)
    // ═════════════════════════════════════════════════════════
    useEffect(() => {
        if (!projectId || !episodeId) return;

        const episodeRef = doc(db, "projects", projectId, "episodes", episodeId);
        const unsub = onSnapshot(episodeRef, (snap) => {
            const data = snap.data();
            if (!data) return;
            const status = data.ugc_export_status || null;
            const progress = data.ugc_export_progress || 0;

            if (status === "queued" || status === "exporting") {
                setExportProgress({ status, progress });
            } else if (status === "completed") {
                setExportProgress({ status: null, progress: 0 });
            } else if (status === "error") {
                setExportProgress({ status: null, progress: 0 });
            }
        });

        return () => unsub();
    }, [projectId, episodeId]);

    // ═════════════════════════════════════════════════════════
    //   CLIP OPERATIONS (all use applyEdit for undo support)
    // ═════════════════════════════════════════════════════════

    // ─── TRIM ───
    const onClipTrim = useCallback((clipId: string, newDuration: number, trimInDelta?: number) => {
        // Trim is continuous (drag), so we DON'T push undo here
        // We push undo when the trim handle is released (via onTrimEnd)
        setTimeline((prev) => {
            if (!prev) return prev;
            const rawTracks = prev.tracks.map((track) => ({
                ...track,
                clips: track.clips.map((c) => {
                    if (c.id !== clipId) return c;
                    const clampedDuration = Math.max(0.5, newDuration);
                    // B1 fix: update trimIn when trimming the left edge
                    const newTrimIn = trimInDelta !== undefined
                        ? Math.max(0, c.trimIn + trimInDelta)
                        : c.trimIn;
                    return { ...c, duration: clampedDuration, trimIn: newTrimIn };
                }),
            }));
            const { tracks, duration } = recalcTracks(rawTracks);
            return { ...prev, tracks, duration };
        });
    }, []);

    // Called when trim handle is released — pushes to undo
    const onTrimEnd = useCallback(() => {
        if (!timeline) return;
        pushUndo(timeline);
    }, [timeline, pushUndo]);

    // ─── SPLIT (S key or button — splits clip under playhead) ───
    const onClipSplit = useCallback((clipId?: string, time?: number) => {
        let didSplit = false;
        applyEdit((prev) => {
            const playhead = time ?? prev.playheadPosition;

            // If no clipId, prefer the selected clip, else find clip under playhead
            let targetId = clipId;
            if (!targetId) {
                // First: check if any selected clip is under the playhead
                if (prev.selectedClipIds.length > 0) {
                    for (const track of prev.tracks) {
                        for (const clip of track.clips) {
                            if (prev.selectedClipIds.includes(clip.id) &&
                                playhead >= clip.startTime && playhead < clip.startTime + clip.duration) {
                                targetId = clip.id;
                                break;
                            }
                        }
                        if (targetId) break;
                    }
                }
                // Fallback: find any clip under playhead
                if (!targetId) {
                    for (const track of prev.tracks) {
                        for (const clip of track.clips) {
                            if (playhead >= clip.startTime && playhead < clip.startTime + clip.duration) {
                                targetId = clip.id;
                                break;
                            }
                        }
                        if (targetId) break;
                    }
                }
            }

            if (!targetId) return prev;

            const rawTracks = prev.tracks.map((track) => {
                const idx = track.clips.findIndex((c) => c.id === targetId);
                if (idx === -1) return track;

                const clip = track.clips[idx];
                const relSplit = playhead - clip.startTime;
                if (relSplit <= 0.2 || relSplit >= clip.duration - 0.2) return track;

                const clipA: TimelineClip = {
                    ...clip, id: `clip-${shortId()}`, duration: relSplit,
                };
                const clipB: TimelineClip = {
                    ...clip, id: `clip-${shortId()}`,
                    startTime: clip.startTime + relSplit,
                    duration: clip.duration - relSplit,
                    trimIn: clip.trimIn + relSplit,
                };

                const newClips = [...track.clips];
                newClips.splice(idx, 1, clipA, clipB);
                didSplit = true;
                return { ...track, clips: newClips };
            });

            // Bug 2 fix: use recalcDuration to preserve gaps
            const duration = recalcDuration(rawTracks);
            return { ...prev, tracks: rawTracks, duration };
        });
        // U12: Only show toast if a clip was actually split
        if (didSplit) toast.success("Split");
    }, [applyEdit]);

    // ─── DELETE SELECTED CLIPS (preserves gaps) ───
    const onDeleteSelected = useCallback(() => {
        if (!timeline || timeline.selectedClipIds.length === 0) return;

        applyEdit((prev) => {
            const idsToDelete = new Set(prev.selectedClipIds);

            const rawTracks = prev.tracks.map((track) => ({
                ...track,
                clips: track.clips.filter((c) => !idsToDelete.has(c.id)),
            }));

            // Use recalcDuration (not recalcTracks) to preserve gaps
            const duration = recalcDuration(rawTracks);
            return { ...prev, tracks: rawTracks, duration, selectedClipIds: [] };
        });
        setSelectedClip(null);
        setShowShotInspector(false);
        toast.success(`Deleted ${timeline.selectedClipIds.length} clip(s)`);
    }, [timeline?.selectedClipIds, applyEdit]);

    // ─── REMOVE GAP (shifts subsequent clips left) ───
    const onRemoveGap = useCallback((trackId: string, gapStartTime: number, gapDuration: number) => {
        applyEdit((prev) => {
            const rawTracks = removeGapInTrack(prev.tracks, trackId, gapStartTime, gapDuration);
            const duration = recalcDuration(rawTracks);
            return { ...prev, tracks: rawTracks, duration };
        });
        toast.success("Gap removed");
    }, [applyEdit]);

    // ─── SCENE CHANGE ───
    // Keep a ref for allShotEntries so onSceneChange always gets latest
    const allShotEntriesRef = useRef<ShotEntry[]>([]);
    allShotEntriesRef.current = allShotEntries;

    const onSceneChange = useCallback((sceneId: string) => {
        const entries = allShotEntriesRef.current;
        console.log("[Scene Switch]", sceneId, "shots:", entries.length, "for scene:", entries.filter(e => e.sceneId === sceneId).length);
        setActiveSceneId(sceneId);
        const filtered = entries.filter((e) => e.sceneId === sceneId);
        setTimeline(buildInitialTimeline(filtered));
        setSelectedClip(null);
        setActiveVideoClip(null);
        setShowShotInspector(false);
    }, []);

    // ─── DUPLICATE SELECTED CLIPS (⌘D) ───
    const onDuplicateSelected = useCallback(() => {
        if (!timeline || timeline.selectedClipIds.length === 0) return;

        applyEdit((prev) => {
            const rawTracks = prev.tracks.map((track) => {
                const newClips: TimelineClip[] = [];
                for (const clip of track.clips) {
                    newClips.push(clip);
                    if (prev.selectedClipIds.includes(clip.id)) {
                        // Bug 2 fix: duplicate at exact position after original, preserving gaps
                        newClips.push({
                            ...clip,
                            id: `clip-${shortId()}`,
                            startTime: clip.startTime + clip.duration,
                            selected: false,
                        });
                    }
                }
                return { ...track, clips: newClips };
            });

            const duration = recalcDuration(rawTracks);
            return { ...prev, tracks: rawTracks, duration };
        });
        toast.success("Duplicated");
    }, [timeline?.selectedClipIds, applyEdit]);

    // ─── REORDER ───
    const onClipReorder = useCallback((trackId: string, fromIndex: number, toIndex: number) => {
        applyEdit((prev) => {
            const rawTracks = prev.tracks.map((track) => {
                if (track.id !== trackId) return track;
                if (fromIndex < 0 || fromIndex >= track.clips.length ||
                    toIndex < 0 || toIndex >= track.clips.length) return track;
                const clips = [...track.clips];
                const [moved] = clips.splice(fromIndex, 1);
                clips.splice(toIndex, 0, moved);
                return { ...track, clips };
            });

            const { tracks, duration } = recalcTracks(rawTracks);
            return { ...prev, tracks, duration };
        });
    }, [applyEdit]);

    // ─── CLIP SPEED (from context menu) ───
    const onClipSpeed = useCallback((clipId: string, speed: number) => {
        applyEdit((prev) => {
            const rawTracks = prev.tracks.map((track) => ({
                ...track,
                clips: track.clips.map((c) =>
                    c.id === clipId
                        ? { ...c, speed, duration: c.duration * (c.speed / speed) }
                        : c
                ),
            }));
            const { tracks, duration } = recalcTracks(rawTracks);
            return { ...prev, tracks, duration };
        });
        toast.success(`Speed: ${speed}x`);
    }, [applyEdit]);

    // ─── CLIP MUTE (per-clip audio toggle) ───
    const onClipToggleMute = useCallback((clipId: string) => {
        applyEdit((prev) => ({
            ...prev,
            tracks: prev.tracks.map((t) => ({
                ...t,
                clips: t.clips.map((c) =>
                    c.id === clipId ? { ...c, muted: !c.muted } : c
                ),
            })),
        }));
    }, [applyEdit]);

    // ─── TRACK MUTE / LOCK ───
    const onTrackToggleMute = useCallback((trackId: string) => {
        setTimeline((prev) => {
            if (!prev) return prev;
            return { ...prev, tracks: prev.tracks.map((t) =>
                t.id === trackId ? { ...t, muted: !t.muted } : t
            ) };
        });
    }, []);

    const onTrackToggleLock = useCallback((trackId: string) => {
        setTimeline((prev) => {
            if (!prev) return prev;
            return { ...prev, tracks: prev.tracks.map((t) =>
                t.id === trackId ? { ...t, locked: !t.locked } : t
            ) };
        });
    }, []);

    // ─── ADD / DELETE AUDIO TRACKS ───
    const onAddTrack = useCallback((type: TrackType) => {
        if (!timeline) return;
        const trackId = `track-${type}-${shortId()}`;
        const newTrack: TimelineTrack = {
            id: trackId,
            type,
            label: type === 'sfx' ? 'SFX' : 'BGM',
            color: type === 'sfx' ? '#22d3ee' : '#a855f7',
            muted: false,
            locked: false,
            solo: false,
            height: 50,
            clips: [],
            volume: 1,
        };
        applyEdit((prev) => ({
            ...prev,
            tracks: [...prev.tracks, newTrack],
        }));
        // Open audio generate bar for the new track
        setAudioGenBar({ type: type === 'sfx' ? 'sfx' : 'bgm', trackId });
        toast.success(`${type === 'sfx' ? 'SFX' : 'BGM'} track added`);
    }, [timeline, applyEdit]);

    const onDeleteTrack = useCallback((trackId: string) => {
        if (!timeline) return;
        // Clean up audio elements for clips in this track
        const track = timeline.tracks.find(t => t.id === trackId);
        if (track) {
            track.clips.forEach(c => {
                const audio = audioElementsRef.current.get(c.id);
                if (audio) { audio.pause(); audioElementsRef.current.delete(c.id); }
            });
        }
        applyEdit((prev) => ({
            ...prev,
            tracks: prev.tracks.filter(t => t.id !== trackId),
        }));
        if (audioGenBar?.trackId === trackId) setAudioGenBar(null);
        toast.success('Track deleted');
    }, [timeline, applyEdit, audioGenBar]);

    const onAudioGenerated = useCallback((audioUrl: string, prompt: string, duration: number) => {
        if (!timeline || !audioGenBar) return;
        const clipId = `clip-${audioGenBar.type}-${shortId()}`;
        const playhead = timeline.playheadPosition;
        const newClip: TimelineClip = {
            id: clipId,
            trackId: audioGenBar.trackId,
            sceneId: '',
            shotId: '',
            label: prompt.length > 20 ? prompt.slice(0, 20) + '...' : prompt,
            audioUrl,
            startTime: playhead,
            duration,
            trimIn: 0,
            trimOut: 0,
            color: audioGenBar.type === 'sfx' ? '#22d3ee' : '#a855f7',
            locked: false,
            muted: false,
            selected: false,
            speed: 1,
            audioType: audioGenBar.type === 'sfx' ? 'sfx' : 'bgm',
            audioPrompt: prompt,
        };
        applyEdit((prev) => {
            const updatedTracks = prev.tracks.map(t =>
                t.id === audioGenBar.trackId
                    ? { ...t, clips: [...t.clips, newClip] }
                    : t
            );
            return {
                ...prev,
                tracks: updatedTracks,
                duration: recalcDuration(updatedTracks),
            };
        });
        toast.success(`${audioGenBar.type === 'sfx' ? 'SFX' : 'BGM'} clip added`);
        setAudioGenBar(null);
    }, [timeline, audioGenBar, applyEdit]);

    // ─── KEYBOARD SHORTCUTS ───
    // B7 fix: warn on unsaved changes
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (undoStack.length > 0) {
                e.preventDefault();
            }
        };
        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, [undoStack.length]);

    // ─── KEYBOARD SHORTCUTS ───
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            // B3 fix: guard both input and textarea elements
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            const isMeta = e.metaKey || e.ctrlKey;

            switch (e.key) {
                case " ":
                    e.preventDefault();
                    togglePlayback();
                    break;
                case "ArrowRight":
                    skipForward();
                    break;
                case "ArrowLeft":
                    skipBackward();
                    break;

                // ── Split (S key, no modifier)
                case "s":
                case "S":
                    if (isMeta) {
                        e.preventDefault();
                        saveTimelineToBackend();
                    } else {
                        e.preventDefault();
                        onClipSplit();
                    }
                    break;

                // U7: Outer guard already blocks inputs/textareas — just handle delete
                case "Delete":
                case "Backspace":
                    e.preventDefault();
                    onDeleteSelected();
                    break;

                // ── Mute selected clip (M key)
                case "m":
                case "M":
                    if (!isMeta && selectedClip) {
                        e.preventDefault();
                        onClipToggleMute(selectedClip.id);
                    }
                    break;

                // ── Undo (⌘Z)
                case "z":
                case "Z":
                    if (isMeta) {
                        e.preventDefault();
                        if (e.shiftKey) {
                            redo();
                        } else {
                            undo();
                        }
                    }
                    break;

                // ── Redo (⌘Y)
                case "y":
                case "Y":
                    if (isMeta) { e.preventDefault(); redo(); }
                    break;

                // ── Duplicate (⌘D)
                case "d":
                case "D":
                    if (isMeta) { e.preventDefault(); onDuplicateSelected(); }
                    break;

                // ── Zoom to fit (⌘0)
                case "0":
                    if (isMeta) { e.preventDefault(); zoomToFit(); }
                    break;

                // ── Zoom
                case "=":
                case "+":
                    if (isMeta) { e.preventDefault(); zoomIn(); }
                    break;
                case "-":
                    if (isMeta) { e.preventDefault(); zoomOut(); }
                    break;

                // ── Generative Edit (E)
                case "e":
                case "E":
                    if (!isMeta && !e.altKey) {
                        const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
                        if (tag !== "input" && tag !== "textarea") {
                            e.preventDefault();
                            const hasVideo = !!(selectedClip?.videoUrl || activeVideoClip?.videoUrl);
                            if (!isEditMode && hasVideo) {
                                if (timeline?.isPlaying) togglePlayback();
                                setIsEditMode(true);
                            } else {
                                setIsEditMode(false);
                            }
                        }
                    }
                    break;

                // ── Deselect (Escape)
                case "Escape":
                    if (isEditMode) {
                        setIsEditMode(false);
                    } else {
                        onClipSelect(null);
                    }
                    break;
            }
        };

        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [togglePlayback, skipForward, skipBackward, zoomIn, zoomOut, zoomToFit,
        saveTimelineToBackend, onClipSplit, onDeleteSelected, onDuplicateSelected,
        undo, redo, onClipSelect, isEditMode, selectedClip, activeVideoClip, timeline?.isPlaying]);

    // ─── LOADING ───
    if (loading || !project || !timeline) {
        return (
            <div className="fixed inset-0 bg-[#030303] flex flex-col items-center justify-center gap-4">
                <div className="relative">
                    <div className="absolute inset-0 bg-[#E50914]/20 rounded-full blur-xl animate-pulse" />
                    <Loader2 size={32} className="animate-spin text-[#E50914] relative z-10" />
                </div>
                <span className="text-[10px] text-neutral-600 tracking-[4px] uppercase font-mono">
                    Initializing Post-Production...
                </span>
            </div>
        );
    }

    const formatTimecode = (secs: number) => formatTimecodeUtil(secs, timeline.fps);

    const previewClip = selectedClip || activeVideoClip;

    return (
        <div ref={timelineContainerRef} className="fixed inset-0 bg-[#030303] flex flex-col overflow-hidden">
            {/* ═══ TOP BAR ═══ */}
            <header className="h-12 border-b border-[#1a1a1a] bg-[#080808] flex items-center justify-between px-4 shrink-0 z-50">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => router.push(`/project/${projectId}/storyboard`)}
                        className="flex items-center gap-1.5 text-[9px] font-bold tracking-[2px] text-neutral-500 hover:text-white transition-colors"
                    >
                        <ArrowLeft size={11} /> STORYBOARD
                    </button>
                    <div className="h-3 w-px bg-[#333]" />
                    <div className="flex items-center gap-2">
                        <Film size={13} className="text-[#E50914]" />
                        <span className="text-[11px] font-bold text-white tracking-wider uppercase">
                            {project.title}
                        </span>
                        <span className="text-[9px] text-neutral-600 tracking-[3px]">// POST-PRODUCTION</span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="bg-[#111] border border-[#222] rounded px-3 py-1 font-mono text-[11px] text-[#E50914] tracking-wider min-w-[90px] text-center">
                        {formatTimecode(timeline.playheadPosition)}
                    </div>
                    <div className="h-3 w-px bg-[#333]" />
                    <button
                        onClick={() => {
                            if (showShotInspector) {
                                setShowShotInspector(false);
                            } else {
                                // If no clip selected, select the first video clip automatically
                                if (!selectedClip) {
                                    const firstVideoClip = timeline.tracks
                                        .filter(t => t.type === 'video')
                                        .flatMap(t => t.clips)
                                        .find(c => c.videoUrl);
                                    if (firstVideoClip) {
                                        onClipSelect(firstVideoClip);
                                    } else {
                                        toast.error('Select a clip in the timeline first');
                                        return;
                                    }
                                }
                                setShowShotInspector(true);
                                setShowExport(false);
                            }
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded border text-[9px] font-bold tracking-widest transition-all ${
                            showShotInspector
                                ? 'bg-[#E50914]/10 border-[#E50914]/30 text-[#E50914]'
                                : 'bg-[#111] border-[#222] hover:border-[#444] text-neutral-400'
                        }`}
                    >
                        <SlidersHorizontal size={11} /> INSPECTOR
                    </button>
                    <button
                        onClick={() => setShowExport(!showExport)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded border text-[9px] font-bold tracking-widest transition-all ${
                            exportProgress.status === 'exporting' || exportProgress.status === 'queued'
                                ? 'bg-[#E50914]/20 border-[#E50914]/50 text-[#E50914] animate-pulse'
                                : showExport
                                    ? 'bg-[#E50914]/10 border-[#E50914]/30 text-[#E50914]'
                                    : 'bg-[#111] border-[#222] hover:border-[#444] text-neutral-400'
                        }`}
                    >
                        {exportProgress.status === 'exporting' || exportProgress.status === 'queued' ? (
                            <>
                                <Loader2 size={11} className="animate-spin" />
                                EXPORTING {exportProgress.progress}%
                            </>
                        ) : (
                            <>
                                <Download size={11} /> EXPORT
                            </>
                        )}
                    </button>
                </div>
            </header>

            {/* ═══ MAIN AREA ═══ */}
            <div ref={mainAreaRef} className="flex-1 flex overflow-hidden">
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* ──── VIDEO PREVIEW ──── */}
                    <div
                        ref={previewContainerRef}
                        className="min-h-[120px] bg-black flex items-center justify-center border-b border-[#1a1a1a] relative"
                        style={{ height: `${previewHeightPct}%` }}
                    >
                        <div className="absolute top-0 left-0 right-0 h-[10%] bg-black z-10" />
                        <div className="absolute bottom-0 left-0 right-0 h-[10%] bg-black z-10" />

                        {previewClip?.videoUrl ? (
                            <video
                                ref={videoRef}
                                key={previewClip.videoUrl}
                                src={previewClip.videoUrl}
                                className="max-h-full max-w-full object-contain"
                                crossOrigin="anonymous"
                                playsInline
                                preload="auto"
                            />
                        ) : previewClip?.thumbnailUrl ? (
                            <img src={previewClip.thumbnailUrl} alt="Preview" className="max-h-full max-w-full object-contain" />
                        ) : (
                            <div className="flex flex-col items-center gap-3 text-neutral-600">
                                <Film size={40} strokeWidth={1} />
                                <span className="text-[10px] tracking-[3px] uppercase font-mono">Select a clip to preview</span>
                            </div>
                        )}
                        {/* Generative Edit overlay */}
                        {isEditMode && previewClip?.videoUrl && (
                            <VideoEditOverlay
                                clip={previewClip}
                                projectId={projectId}
                                episodeId={episodeId}
                                videoRef={videoRef}
                                containerRef={previewContainerRef}
                                onClose={() => setIsEditMode(false)}
                                onProcessingStart={(clipId) => {
                                    setProcessingClipIds((prev) => new Set([...prev, clipId]));
                                }}
                            />
                        )}


                    </div>

                    {/* ──── HORIZONTAL RESIZE HANDLE (preview ↕ timeline) ──── */}
                    <div
                        className="h-1.5 bg-[#0a0a0a] cursor-row-resize flex items-center justify-center group hover:bg-[#E50914]/20 transition-colors shrink-0 relative z-10"
                        onMouseDown={(e) => {
                            e.preventDefault();
                            const startY = e.clientY;
                            const startPct = previewHeightPct;
                            const container = mainAreaRef.current;
                            if (!container) return;
                            const containerH = container.getBoundingClientRect().height;

                            const onMove = (ev: MouseEvent) => {
                                const dy = ev.clientY - startY;
                                const deltaPct = (dy / containerH) * 100;
                                setPreviewHeightPct(Math.min(60, Math.max(15, startPct + deltaPct)));
                            };
                            const onUp = () => {
                                document.removeEventListener("mousemove", onMove);
                                document.removeEventListener("mouseup", onUp);
                                document.body.style.cursor = "";
                                document.body.style.userSelect = "";
                            };
                            document.body.style.cursor = "row-resize";
                            document.body.style.userSelect = "none";
                            document.addEventListener("mousemove", onMove);
                            document.addEventListener("mouseup", onUp);
                        }}
                    >
                        <div className="w-8 h-0.5 rounded-full bg-neutral-700 group-hover:bg-[#E50914]/60 transition-colors" />
                    </div>

                    {/* Transport Controls */}
                    <TransportControls
                        isPlaying={timeline.isPlaying}
                        currentTime={timeline.playheadPosition}
                        duration={timeline.duration}
                        zoom={timeline.zoom}
                        onTogglePlay={togglePlayback}
                        onSeek={seekTo}
                        onSkipForward={skipForward}
                        onSkipBackward={skipBackward}
                        onZoomIn={zoomIn}
                        onZoomOut={zoomOut}
                        onZoomToFit={zoomToFit}
                        onSplit={() => onClipSplit()}
                        onDelete={onDeleteSelected}
                        onUndo={undo}
                        onRedo={redo}
                        onDuplicate={onDuplicateSelected}
                        snapEnabled={snapEnabled}
                        onToggleSnap={() => setSnapEnabled(!snapEnabled)}
                        canUndo={undoStack.length > 0}
                        canRedo={redoStack.length > 0}
                        hasSelection={timeline.selectedClipIds.length > 0}
                        formatTimecode={formatTimecode}
                        loopingClipName={selectedClip?.label || null}
                        loopClipTime={selectedClip ? {
                            elapsed: Math.max(0, timeline.playheadPosition - selectedClip.startTime),
                            total: selectedClip.duration,
                        } : null}
                        isEditMode={isEditMode}
                        onToggleEditMode={() => {
                            if (!isEditMode && previewClip?.videoUrl) {
                                // Entering edit mode — auto-pause
                                if (timeline.isPlaying) togglePlayback();
                                setIsEditMode(true);
                            } else {
                                setIsEditMode(false);
                            }
                        }}
                        hasVideo={!!previewClip?.videoUrl}
                    />

                    {/* Timeline */}
                    <Timeline
                        state={timeline}
                        onClipSelect={onClipSelect}
                        onClipTrim={onClipTrim}
                        onTrimEnd={onTrimEnd}
                        onClipReorder={onClipReorder}
                        onClipSplit={onClipSplit}
                        onClipDelete={onDeleteSelected}
                        onClipDuplicate={onDuplicateSelected}
                        onClipSpeed={onClipSpeed}
                        onClipToggleMute={onClipToggleMute}
                        onSeek={seekTo}
                        selectedClipIds={timeline.selectedClipIds}
                        onTrackToggleMute={onTrackToggleMute}
                        onTrackToggleLock={onTrackToggleLock}
                        onRemoveGap={onRemoveGap}
                        snapEnabled={snapEnabled}
                        scenes={scenes}
                        activeSceneId={activeSceneId}
                        onSceneChange={onSceneChange}
                        processingClipIds={processingClipIds}
                        onAddTrack={onAddTrack}
                        onDeleteTrack={onDeleteTrack}
                        onOpenAudioGen={(trackId, type) => setAudioGenBar({ type, trackId })}
                    />

                    {/* Audio Generate Bar */}
                    {audioGenBar && (
                        <AudioGenerateBar
                            type={audioGenBar.type}
                            projectId={projectId}
                            onGenerated={onAudioGenerated}
                            onClose={() => setAudioGenBar(null)}
                        />
                    )}
                </div>

                {/* ──── VERTICAL RESIZE HANDLE (main area ↔ sidebar) ──── */}
                {(showShotInspector || showExport) && (
                    <div
                        className="w-1.5 bg-[#0a0a0a] cursor-col-resize flex items-center justify-center group hover:bg-[#E50914]/20 transition-colors shrink-0 relative z-10"
                        onMouseDown={(e) => {
                            e.preventDefault();
                            const startX = e.clientX;
                            const startW = sidebarWidth;
                            const maxW = window.innerWidth * 0.5;

                            const onMove = (ev: MouseEvent) => {
                                const dx = startX - ev.clientX; // dragging left = grow
                                setSidebarWidth(Math.min(maxW, Math.max(280, startW + dx)));
                            };
                            const onUp = () => {
                                document.removeEventListener("mousemove", onMove);
                                document.removeEventListener("mouseup", onUp);
                                document.body.style.cursor = "";
                                document.body.style.userSelect = "";
                            };
                            document.body.style.cursor = "col-resize";
                            document.body.style.userSelect = "none";
                            document.addEventListener("mousemove", onMove);
                            document.addEventListener("mouseup", onUp);
                        }}
                    >
                        <div className="h-8 w-0.5 rounded-full bg-neutral-700 group-hover:bg-[#E50914]/60 transition-colors" />
                    </div>
                )}

                {/* ═══ SIDE PANELS ═══ */}
                <AnimatePresence>
                    {showShotInspector && selectedClip && (
                        <div style={{ width: sidebarWidth }} className="shrink-0 overflow-hidden">
                            <ShotInspector
                                clip={selectedClip}
                                projectId={projectId}
                                episodeId={episodeId}
                                onClose={() => { setShowShotInspector(false); onClipSelect(null); }}
                                onProcessingStart={(clipId: string) => {
                                    setProcessingClipIds((prev) => {
                                        const next = new Set(prev);
                                        next.add(clipId);
                                        return next;
                                    });
                                }}
                            />
                        </div>
                    )}
                </AnimatePresence>



                <AnimatePresence>
                    {showExport && (
                        <div style={{ width: sidebarWidth }} className="shrink-0 overflow-hidden">
                            <ExportPanel
                                projectId={projectId}
                                episodeId={episodeId}
                                timeline={timeline}
                                onClose={() => setShowExport(false)}
                            />
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
