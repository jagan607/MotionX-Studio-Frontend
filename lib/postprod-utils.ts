/**
 * Post-Production Timeline Utilities
 * Pure functions extracted for testability and reuse.
 */

import {
    TimelineState,
    TimelineTrack,
    TimelineClip,
} from "@/lib/types/postprod";

// ── Track colors ──
export const TRACK_COLORS: Record<string, string> = {
    video: "#E50914",
    audio: "#3B82F6",
    music: "#A855F7",
    sfx: "#F59E0B",
    voiceover: "#10B981",
};

export const DEFAULT_CLIP_DURATION = 5;
export const MAX_UNDO_HISTORY = 50;

// ── Generate a short unique ID ──
export function shortId(): string {
    return Math.random().toString(36).substring(2, 8);
}

// ── Recalculate startTimes + total duration (closes gaps — used for reorder, initial build) ──
export function recalcTracks(tracks: TimelineTrack[]): { tracks: TimelineTrack[]; duration: number } {
    const newTracks = tracks.map((track) => {
        let currentTime = 0;
        const newClips = track.clips.map((clip) => {
            const newClip = { ...clip, startTime: currentTime };
            currentTime += clip.duration;
            return newClip;
        });
        return { ...track, clips: newClips };
    });

    const duration = Math.max(
        ...newTracks.map((t) =>
            t.clips.length > 0
                ? t.clips[t.clips.length - 1].startTime + t.clips[t.clips.length - 1].duration
                : 0
        ),
        5
    );

    return { tracks: newTracks, duration };
}

// ── Recalculate duration only (preserves gaps — used after delete) ──
export function recalcDuration(tracks: TimelineTrack[]): number {
    return Math.max(
        ...tracks.map((t) =>
            t.clips.length > 0
                ? Math.max(...t.clips.map((c) => c.startTime + c.duration))
                : 0
        ),
        5
    );
}

// ── Find gaps in a track (sorted by time) ──
export interface TimelineGap {
    startTime: number;
    duration: number;
}

export function findGapsInTrack(track: TimelineTrack): TimelineGap[] {
    if (track.clips.length === 0) return [];
    const sorted = [...track.clips].sort((a, b) => a.startTime - b.startTime);
    const gaps: TimelineGap[] = [];

    // Gap at the start
    if (sorted[0].startTime > 0.01) {
        gaps.push({ startTime: 0, duration: sorted[0].startTime });
    }

    // Gaps between clips
    for (let i = 0; i < sorted.length - 1; i++) {
        const endOfCurrent = sorted[i].startTime + sorted[i].duration;
        const startOfNext = sorted[i + 1].startTime;
        const gapDuration = startOfNext - endOfCurrent;
        if (gapDuration > 0.01) {
            gaps.push({ startTime: endOfCurrent, duration: gapDuration });
        }
    }

    return gaps;
}

// ── Remove a gap by shifting subsequent clips left ──
export function removeGapInTrack(
    tracks: TimelineTrack[],
    trackId: string,
    gapStartTime: number,
    gapDuration: number
): TimelineTrack[] {
    return tracks.map((track) => {
        if (track.id !== trackId) return track;
        const newClips = track.clips.map((clip) => {
            if (clip.startTime >= gapStartTime + gapDuration) {
                return { ...clip, startTime: clip.startTime - gapDuration };
            }
            return clip;
        });
        return { ...track, clips: newClips };
    });
}

// ── Build initial timeline from shots ──
export interface ShotEntry {
    sceneId: string;
    shot: {
        id: string;
        shot_type?: string;
        image_url?: string;
        video_url?: string;
        video_settings?: { duration?: string };
    };
}

export function buildInitialTimeline(allShots: ShotEntry[]): TimelineState {
    const videoClips: TimelineClip[] = [];
    let currentTime = 0;

    allShots.forEach((entry, index) => {
        const { sceneId, shot } = entry;

        // Only include shots that have a video — image-only shots stay off the timeline
        if (!shot.video_url) return;

        const rawDuration = shot.video_settings?.duration
            ? parseFloat(shot.video_settings.duration)
            : DEFAULT_CLIP_DURATION;
        // B4 fix: clamp to minimum 0.5s
        const duration = Math.max(0.5, isNaN(rawDuration) ? DEFAULT_CLIP_DURATION : rawDuration);

        videoClips.push({
            id: `clip-${shot.id}`,
            trackId: "track-video-main",
            sceneId,
            shotId: shot.id,
            label: shot.shot_type || `Shot ${index + 1}`,
            thumbnailUrl: shot.image_url,
            videoUrl: shot.video_url,
            audioUrl: undefined,
            startTime: currentTime,
            duration,
            trimIn: 0,
            trimOut: 0,
            color: TRACK_COLORS.video,
            locked: false,
            muted: false,
            selected: false,
            speed: 1,
        });

        currentTime += duration;
    });

    const tracks: TimelineTrack[] = [
        {
            id: "track-video-main", type: "video", label: "V1 — Main Video",
            color: TRACK_COLORS.video, muted: false, locked: false, solo: false,
            height: 80, clips: videoClips, volume: 1,
        },
        {
            id: "track-audio-dialogue", type: "audio", label: "A1 — Dialogue",
            color: TRACK_COLORS.audio, muted: false, locked: false, solo: false,
            height: 48, clips: [], volume: 0.8,
        },
        {
            id: "track-music", type: "music", label: "M1 — Score",
            color: TRACK_COLORS.music, muted: false, locked: false, solo: false,
            height: 48, clips: [], volume: 0.6,
        },
        {
            id: "track-sfx", type: "sfx", label: "SFX — Effects",
            color: TRACK_COLORS.sfx, muted: false, locked: false, solo: false,
            height: 40, clips: [], volume: 0.7,
        },
    ];

    return {
        tracks,
        transitions: [],
        playheadPosition: 0,
        zoom: 80,
        duration: currentTime || 30,
        fps: 24,
        isPlaying: false,
        selectedClipIds: [],
    };
}

// ── Find clip at a specific time ──
export function findClipAtTime(tracks: TimelineTrack[], time: number): TimelineClip | null {
    for (const track of tracks) {
        if (track.type !== "video") continue;
        for (const clip of track.clips) {
            if (time >= clip.startTime && time < clip.startTime + clip.duration) {
                return clip;
            }
        }
    }
    return null;
}

// ── Find a clip by ID across all tracks ──
export function findClipById(tracks: TimelineTrack[], clipId: string): TimelineClip | null {
    for (const track of tracks) {
        const clip = track.clips.find((c) => c.id === clipId);
        if (clip) return clip;
    }
    return null;
}

// ── Format timecode ──
export function formatTimecode(secs: number, fps: number = 24): string {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const f = Math.floor((secs % 1) * fps);
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}:${String(f).padStart(2, "0")}`;
}

// ── Pixel/time conversion ──
export function pixelsToTime(px: number, zoom: number): number { return px / zoom; }
export function timeToPixels(time: number, zoom: number): number { return time * zoom; }

// ── Ruler time format ──
export function formatRulerTime(s: number): string {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, "0")}`;
}
