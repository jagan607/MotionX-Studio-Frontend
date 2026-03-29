/**
 * Tests for clip operation callbacks:
 * split, delete, duplicate, reorder, speed, trim
 * Tests the logic by simulating what the page.tsx callbacks do.
 */

import { recalcTracks, recalcDuration, shortId } from "@/lib/postprod-utils";
import { TimelineTrack, TimelineClip, TimelineState } from "@/lib/types/postprod";

// ── Helpers ──
function makeClip(overrides: Partial<TimelineClip> = {}): TimelineClip {
    return {
        id: "clip-1",
        trackId: "track-video-main",
        sceneId: "scene-1",
        shotId: "shot-1",
        label: "Wide",
        startTime: 0,
        duration: 5,
        trimIn: 0,
        trimOut: 0,
        color: "#E50914",
        locked: false,
        muted: false,
        selected: false,
        speed: 1,
        ...overrides,
    };
}

function makeTrack(overrides: Partial<TimelineTrack> = {}): TimelineTrack {
    return {
        id: "track-video-main",
        type: "video",
        label: "V1",
        color: "#E50914",
        muted: false,
        locked: false,
        solo: false,
        height: 80,
        clips: [],
        volume: 1,
        ...overrides,
    };
}

function makeTimeline(overrides: Partial<TimelineState> = {}): TimelineState {
    return {
        tracks: [makeTrack({ clips: [makeClip()] })],
        transitions: [],
        playheadPosition: 0,
        zoom: 80,
        duration: 5,
        fps: 24,
        isPlaying: false,
        selectedClipIds: [],
        ...overrides,
    };
}

// ── Simulate split logic (mirrors page.tsx) ──
function splitClipAtTime(prev: TimelineState, playhead: number): TimelineState {
    let targetId: string | undefined;
    for (const track of prev.tracks) {
        for (const clip of track.clips) {
            if (playhead >= clip.startTime && playhead < clip.startTime + clip.duration) {
                targetId = clip.id;
                break;
            }
        }
        if (targetId) break;
    }
    if (!targetId) return prev;

    const rawTracks = prev.tracks.map((track) => {
        const idx = track.clips.findIndex((c) => c.id === targetId);
        if (idx === -1) return track;
        const clip = track.clips[idx];
        const relSplit = playhead - clip.startTime;
        if (relSplit <= 0.2 || relSplit >= clip.duration - 0.2) return track;

        const clipA: TimelineClip = { ...clip, id: `clip-a`, duration: relSplit };
        const clipB: TimelineClip = {
            ...clip, id: `clip-b`,
            startTime: clip.startTime + relSplit,
            duration: clip.duration - relSplit,
            trimIn: clip.trimIn + relSplit,
        };

        const newClips = [...track.clips];
        newClips.splice(idx, 1, clipA, clipB);
        return { ...track, clips: newClips };
    });

    const { tracks, duration } = recalcTracks(rawTracks);
    return { ...prev, tracks, duration };
}

// Split that preserves gaps (mirrors updated page.tsx)
function splitClipPreservingGaps(prev: TimelineState, playhead: number): TimelineState {
    let targetId: string | undefined;
    for (const track of prev.tracks) {
        for (const clip of track.clips) {
            if (playhead >= clip.startTime && playhead < clip.startTime + clip.duration) {
                targetId = clip.id;
                break;
            }
        }
        if (targetId) break;
    }
    if (!targetId) return prev;

    const rawTracks = prev.tracks.map((track) => {
        const idx = track.clips.findIndex((c) => c.id === targetId);
        if (idx === -1) return track;
        const clip = track.clips[idx];
        const relSplit = playhead - clip.startTime;
        if (relSplit <= 0.2 || relSplit >= clip.duration - 0.2) return track;

        const clipA: TimelineClip = { ...clip, id: `clip-a`, duration: relSplit };
        const clipB: TimelineClip = {
            ...clip, id: `clip-b`,
            startTime: clip.startTime + relSplit,
            duration: clip.duration - relSplit,
            trimIn: clip.trimIn + relSplit,
        };

        const newClips = [...track.clips];
        newClips.splice(idx, 1, clipA, clipB);
        return { ...track, clips: newClips };
    });

    const duration = recalcDuration(rawTracks);
    return { ...prev, tracks: rawTracks, duration };
}

// ═══════════════════════════════════════
//   SPLIT
// ═══════════════════════════════════════
describe("Clip Split", () => {
    test("splits clip into two at playhead", () => {
        const tl = makeTimeline();
        const result = splitClipAtTime(tl, 2.5);
        const clips = result.tracks[0].clips;

        expect(clips).toHaveLength(2);
        expect(clips[0].duration).toBe(2.5);
        expect(clips[1].duration).toBe(2.5);
    });

    test("right part gets correct trimIn", () => {
        const tl = makeTimeline({
            tracks: [makeTrack({ clips: [makeClip({ trimIn: 1 })] })],
        });
        const result = splitClipAtTime(tl, 2);
        expect(result.tracks[0].clips[1].trimIn).toBe(3); // 1 + 2
    });

    test("rejects split within 0.2s of clip start", () => {
        const tl = makeTimeline();
        const result = splitClipAtTime(tl, 0.1);
        expect(result.tracks[0].clips).toHaveLength(1); // unchanged
    });

    test("rejects split within 0.2s of clip end", () => {
        const tl = makeTimeline();
        const result = splitClipAtTime(tl, 4.9);
        expect(result.tracks[0].clips).toHaveLength(1);
    });

    test("no clip under playhead — no change", () => {
        const tl = makeTimeline();
        const result = splitClipAtTime(tl, 100);
        expect(result).toBe(tl);
    });

    test("split recalculates start times", () => {
        const tl = makeTimeline({
            tracks: [makeTrack({
                clips: [
                    makeClip({ id: "c1", duration: 4, startTime: 0 }),
                    makeClip({ id: "c2", duration: 3, startTime: 4 }),
                ],
            })],
        });
        const result = splitClipAtTime(tl, 2);
        const clips = result.tracks[0].clips;

        expect(clips).toHaveLength(3);
        expect(clips[0].startTime).toBe(0);
        expect(clips[1].startTime).toBe(2);
        expect(clips[2].startTime).toBe(4);
    });

    test("split preserves gaps between other clips", () => {
        const tl = makeTimeline({
            tracks: [makeTrack({
                clips: [
                    makeClip({ id: "c1", duration: 4, startTime: 0 }),
                    // 2s gap
                    makeClip({ id: "c2", duration: 3, startTime: 6 }),
                ],
            })],
        });
        const result = splitClipPreservingGaps(tl, 2);
        const clips = result.tracks[0].clips;

        expect(clips).toHaveLength(3);
        expect(clips[0].startTime).toBe(0);  // clip A
        expect(clips[1].startTime).toBe(2);  // clip B
        expect(clips[2].startTime).toBe(6);  // unchanged — gap preserved
    });
});

// ═══════════════════════════════════════
//   DELETE
// ═══════════════════════════════════════
describe("Clip Delete", () => {
    function deleteSelected(prev: TimelineState): TimelineState {
        if (prev.selectedClipIds.length === 0) return prev;
        const idsToDelete = new Set(prev.selectedClipIds);
        const rawTracks = prev.tracks.map((track) => ({
            ...track,
            clips: track.clips.filter((c) => !idsToDelete.has(c.id)),
        }));
        const { tracks, duration } = recalcTracks(rawTracks);
        return { ...prev, tracks, duration, selectedClipIds: [] };
    }

    // Gap-preserving delete (mirrors updated page.tsx)
    function deletePreservingGaps(prev: TimelineState): TimelineState {
        if (prev.selectedClipIds.length === 0) return prev;
        const idsToDelete = new Set(prev.selectedClipIds);
        const rawTracks = prev.tracks.map((track) => ({
            ...track,
            clips: track.clips.filter((c) => !idsToDelete.has(c.id)),
        }));
        const duration = recalcDuration(rawTracks);
        return { ...prev, tracks: rawTracks, duration, selectedClipIds: [] };
    }

    test("deletes selected clip", () => {
        const tl = makeTimeline({ selectedClipIds: ["clip-1"] });
        const result = deleteSelected(tl);
        expect(result.tracks[0].clips).toHaveLength(0);
    });

    test("deletes multiple selected clips", () => {
        const tl = makeTimeline({
            tracks: [makeTrack({
                clips: [
                    makeClip({ id: "c1" }),
                    makeClip({ id: "c2" }),
                    makeClip({ id: "c3" }),
                ],
            })],
            selectedClipIds: ["c1", "c3"],
        });
        const result = deleteSelected(tl);
        expect(result.tracks[0].clips).toHaveLength(1);
        expect(result.tracks[0].clips[0].id).toBe("c2");
    });

    test("no selection — no change", () => {
        const tl = makeTimeline();
        const result = deleteSelected(tl);
        expect(result).toBe(tl);
    });

    test("clears selectedClipIds after delete", () => {
        const tl = makeTimeline({ selectedClipIds: ["clip-1"] });
        const result = deleteSelected(tl);
        expect(result.selectedClipIds).toEqual([]);
    });

    test("deleting all clips gives minimum 5s duration", () => {
        const tl = makeTimeline({ selectedClipIds: ["clip-1"] });
        const result = deleteSelected(tl);
        expect(result.duration).toBe(5);
    });

    test("delete preserves gaps — other clips keep positions", () => {
        const tl = makeTimeline({
            tracks: [makeTrack({
                clips: [
                    makeClip({ id: "c1", duration: 3, startTime: 0 }),
                    makeClip({ id: "c2", duration: 2, startTime: 3 }),
                    makeClip({ id: "c3", duration: 4, startTime: 5 }),
                ],
            })],
            selectedClipIds: ["c2"],
        });
        const result = deletePreservingGaps(tl);
        expect(result.tracks[0].clips).toHaveLength(2);
        expect(result.tracks[0].clips[0].startTime).toBe(0);  // c1 unchanged
        expect(result.tracks[0].clips[1].startTime).toBe(5);  // c3 unchanged — gap preserved
    });
});

// ═══════════════════════════════════════
//   DUPLICATE
// ═══════════════════════════════════════
describe("Clip Duplicate", () => {
    function duplicateSelected(prev: TimelineState): TimelineState {
        if (prev.selectedClipIds.length === 0) return prev;
        const rawTracks = prev.tracks.map((track) => {
            const newClips: TimelineClip[] = [];
            for (const clip of track.clips) {
                newClips.push(clip);
                if (prev.selectedClipIds.includes(clip.id)) {
                    newClips.push({
                        ...clip,
                        id: `clip-dup-${clip.id}`,
                        selected: false,
                    });
                }
            }
            return { ...track, clips: newClips };
        });
        const { tracks, duration } = recalcTracks(rawTracks);
        return { ...prev, tracks, duration };
    }

    // Gap-preserving duplicate (mirrors updated page.tsx)
    function duplicatePreservingGaps(prev: TimelineState): TimelineState {
        if (prev.selectedClipIds.length === 0) return prev;
        const rawTracks = prev.tracks.map((track) => {
            const newClips: TimelineClip[] = [];
            for (const clip of track.clips) {
                newClips.push(clip);
                if (prev.selectedClipIds.includes(clip.id)) {
                    newClips.push({
                        ...clip,
                        id: `clip-dup-${clip.id}`,
                        startTime: clip.startTime + clip.duration,
                        selected: false,
                    });
                }
            }
            return { ...track, clips: newClips };
        });
        const duration = recalcDuration(rawTracks);
        return { ...prev, tracks: rawTracks, duration };
    }

    test("duplicates selected clip after original", () => {
        const tl = makeTimeline({ selectedClipIds: ["clip-1"] });
        const result = duplicateSelected(tl);
        expect(result.tracks[0].clips).toHaveLength(2);
    });

    test("duplicate has different ID", () => {
        const tl = makeTimeline({ selectedClipIds: ["clip-1"] });
        const result = duplicateSelected(tl);
        const ids = result.tracks[0].clips.map(c => c.id);
        expect(new Set(ids).size).toBe(2);
    });

    test("duplicate preserves original properties", () => {
        const tl = makeTimeline({
            tracks: [makeTrack({
                clips: [makeClip({ id: "c1", label: "Wide", duration: 7 })],
            })],
            selectedClipIds: ["c1"],
        });
        const result = duplicateSelected(tl);
        const dup = result.tracks[0].clips[1];
        expect(dup.label).toBe("Wide");
        expect(dup.duration).toBe(7);
    });

    test("no selection — no change", () => {
        const tl = makeTimeline();
        const result = duplicateSelected(tl);
        expect(result).toBe(tl);
    });

    test("duration updates after duplicate", () => {
        const tl = makeTimeline({ selectedClipIds: ["clip-1"] });
        const result = duplicateSelected(tl);
        expect(result.duration).toBe(10); // 5 + 5
    });

    test("duplicate preserves gaps between other clips", () => {
        const tl = makeTimeline({
            tracks: [makeTrack({
                clips: [
                    makeClip({ id: "c1", duration: 3, startTime: 0 }),
                    // 4s gap
                    makeClip({ id: "c2", duration: 2, startTime: 7 }),
                ],
            })],
            selectedClipIds: ["c1"],
        });
        const result = duplicatePreservingGaps(tl);
        const clips = result.tracks[0].clips;

        expect(clips).toHaveLength(3);
        expect(clips[0].startTime).toBe(0);   // c1 unchanged
        expect(clips[1].startTime).toBe(3);   // duplicate placed right after c1
        expect(clips[2].startTime).toBe(7);   // c2 unchanged — gap preserved
    });
});

// ═══════════════════════════════════════
//   REORDER
// ═══════════════════════════════════════
describe("Clip Reorder", () => {
    function reorder(prev: TimelineState, trackId: string, fromIdx: number, toIdx: number): TimelineState {
        const rawTracks = prev.tracks.map((track) => {
            if (track.id !== trackId) return track;
            if (fromIdx < 0 || fromIdx >= track.clips.length ||
                toIdx < 0 || toIdx >= track.clips.length) return track;
            const clips = [...track.clips];
            const [moved] = clips.splice(fromIdx, 1);
            clips.splice(toIdx, 0, moved);
            return { ...track, clips };
        });
        const { tracks, duration } = recalcTracks(rawTracks);
        return { ...prev, tracks, duration };
    }

    test("swaps two clips", () => {
        const tl = makeTimeline({
            tracks: [makeTrack({
                clips: [
                    makeClip({ id: "c1", duration: 3 }),
                    makeClip({ id: "c2", duration: 5 }),
                ],
            })],
        });
        const result = reorder(tl, "track-video-main", 0, 1);
        expect(result.tracks[0].clips[0].id).toBe("c2");
        expect(result.tracks[0].clips[1].id).toBe("c1");
    });

    test("recalculates start times after reorder", () => {
        const tl = makeTimeline({
            tracks: [makeTrack({
                clips: [
                    makeClip({ id: "c1", duration: 3 }),
                    makeClip({ id: "c2", duration: 5 }),
                ],
            })],
        });
        const result = reorder(tl, "track-video-main", 0, 1);
        expect(result.tracks[0].clips[0].startTime).toBe(0);
        expect(result.tracks[0].clips[1].startTime).toBe(5);
    });

    test("invalid from index — no change", () => {
        const tl = makeTimeline();
        const result = reorder(tl, "track-video-main", -1, 0);
        expect(result.tracks[0].clips[0].id).toBe("clip-1");
    });

    test("wrong track ID — no change", () => {
        const tl = makeTimeline();
        const result = reorder(tl, "non-existent", 0, 1);
        expect(result.tracks[0].clips).toEqual(tl.tracks[0].clips);
    });
});

// ═══════════════════════════════════════
//   SPEED
// ═══════════════════════════════════════
describe("Clip Speed", () => {
    function changeSpeed(prev: TimelineState, clipId: string, speed: number): TimelineState {
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
    }

    test("2x speed halves duration", () => {
        const tl = makeTimeline();
        const result = changeSpeed(tl, "clip-1", 2);
        expect(result.tracks[0].clips[0].duration).toBe(2.5);
        expect(result.tracks[0].clips[0].speed).toBe(2);
    });

    test("0.5x speed doubles duration", () => {
        const tl = makeTimeline();
        const result = changeSpeed(tl, "clip-1", 0.5);
        expect(result.tracks[0].clips[0].duration).toBe(10);
    });

    test("changing from 2x to 0.5x quadruples duration", () => {
        const tl = makeTimeline({
            tracks: [makeTrack({
                clips: [makeClip({ speed: 2, duration: 2.5 })],
            })],
        });
        const result = changeSpeed(tl, "clip-1", 0.5);
        expect(result.tracks[0].clips[0].duration).toBe(10);
    });

    test("speed 1x keeps original duration", () => {
        const tl = makeTimeline();
        const result = changeSpeed(tl, "clip-1", 1);
        expect(result.tracks[0].clips[0].duration).toBe(5);
    });
});

// ═══════════════════════════════════════
//   TRIM
// ═══════════════════════════════════════
describe("Clip Trim", () => {
    function trimClip(prev: TimelineState, clipId: string, newDuration: number, trimInDelta?: number): TimelineState {
        const rawTracks = prev.tracks.map((track) => ({
            ...track,
            clips: track.clips.map((c) => {
                if (c.id !== clipId) return c;
                const clampedDuration = Math.max(0.5, newDuration);
                const newTrimIn = trimInDelta !== undefined
                    ? Math.max(0, c.trimIn + trimInDelta)
                    : c.trimIn;
                return { ...c, duration: clampedDuration, trimIn: newTrimIn };
            }),
        }));
        const { tracks, duration } = recalcTracks(rawTracks);
        return { ...prev, tracks, duration };
    }

    test("right-edge trim extends duration", () => {
        const tl = makeTimeline();
        const result = trimClip(tl, "clip-1", 8);
        expect(result.tracks[0].clips[0].duration).toBe(8);
    });

    test("right-edge trim shrinks duration", () => {
        const tl = makeTimeline();
        const result = trimClip(tl, "clip-1", 3);
        expect(result.tracks[0].clips[0].duration).toBe(3);
    });

    test("clamps to minimum 0.5s", () => {
        const tl = makeTimeline();
        const result = trimClip(tl, "clip-1", 0.1);
        expect(result.tracks[0].clips[0].duration).toBe(0.5);
    });

    test("clamps zero duration", () => {
        const tl = makeTimeline();
        const result = trimClip(tl, "clip-1", 0);
        expect(result.tracks[0].clips[0].duration).toBe(0.5);
    });

    test("clamps negative duration", () => {
        const tl = makeTimeline();
        const result = trimClip(tl, "clip-1", -5);
        expect(result.tracks[0].clips[0].duration).toBe(0.5);
    });

    test("B1 fix: left-edge trim updates trimIn", () => {
        const tl = makeTimeline({
            tracks: [makeTrack({
                clips: [makeClip({ trimIn: 0, duration: 5 })],
            })],
        });
        // Left-edge trim: trimInDelta = 1 (trimmed 1s from left)
        const result = trimClip(tl, "clip-1", 4, 1);
        expect(result.tracks[0].clips[0].duration).toBe(4);
        expect(result.tracks[0].clips[0].trimIn).toBe(1);
    });

    test("B1 fix: left-edge trim clamps trimIn at 0", () => {
        const tl = makeTimeline({
            tracks: [makeTrack({
                clips: [makeClip({ trimIn: 0, duration: 5 })],
            })],
        });
        const result = trimClip(tl, "clip-1", 6, -2);
        expect(result.tracks[0].clips[0].trimIn).toBe(0); // clamped
    });

    test("right-edge trim does not change trimIn", () => {
        const tl = makeTimeline({
            tracks: [makeTrack({
                clips: [makeClip({ trimIn: 2 })],
            })],
        });
        const result = trimClip(tl, "clip-1", 8); // no trimInDelta
        expect(result.tracks[0].clips[0].trimIn).toBe(2); // unchanged
    });
});
