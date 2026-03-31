/**
 * Unit tests for pure functions in lib/postprod-utils.ts
 * Covers: recalcTracks, buildInitialTimeline, findClipAtTime, findClipById,
 *         formatTimecode, pixelsToTime, timeToPixels, formatRulerTime
 */

import {
    recalcTracks,
    recalcDuration,
    findGapsInTrack,
    removeGapInTrack,
    buildInitialTimeline,
    findClipAtTime,
    findClipById,
    formatTimecode,
    pixelsToTime,
    timeToPixels,
    formatRulerTime,
    TRACK_COLORS,
    DEFAULT_CLIP_DURATION,
    ShotEntry,
} from "@/lib/postprod-utils";
import { TimelineTrack, TimelineClip } from "@/lib/types/postprod";

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

// ═══════════════════════════════════════
//   recalcTracks
// ═══════════════════════════════════════
describe("recalcTracks", () => {
    test("recomputes startTimes for sequential clips", () => {
        const clips = [
            makeClip({ id: "c1", duration: 3, startTime: 100 }),
            makeClip({ id: "c2", duration: 4, startTime: 200 }),
            makeClip({ id: "c3", duration: 2, startTime: 300 }),
        ];
        const track = makeTrack({ clips });
        const { tracks, duration } = recalcTracks([track]);

        expect(tracks[0].clips[0].startTime).toBe(0);
        expect(tracks[0].clips[1].startTime).toBe(3);
        expect(tracks[0].clips[2].startTime).toBe(7);
        expect(duration).toBe(9);
    });

    test("duration is at least 5 for empty tracks", () => {
        const track = makeTrack({ clips: [] });
        const { duration } = recalcTracks([track]);
        expect(duration).toBe(5);
    });

    test("duration is at least 5 even if content is shorter", () => {
        const track = makeTrack({ clips: [makeClip({ duration: 2 })] });
        const { duration } = recalcTracks([track]);
        expect(duration).toBe(5); // max(2, 5) = 5
    });

    test("handles multiple tracks independently", () => {
        const videoTrack = makeTrack({
            id: "v1",
            clips: [makeClip({ id: "c1", duration: 10 })],
        });
        const audioTrack = makeTrack({
            id: "a1", type: "audio",
            clips: [makeClip({ id: "c2", duration: 3 }), makeClip({ id: "c3", duration: 4 })],
        });
        const { tracks, duration } = recalcTracks([videoTrack, audioTrack]);

        expect(tracks[0].clips[0].startTime).toBe(0);
        expect(tracks[1].clips[0].startTime).toBe(0);
        expect(tracks[1].clips[1].startTime).toBe(3);
        expect(duration).toBe(10); // max(10, 7, 5)
    });

    test("does not mutate original tracks", () => {
        const clip = makeClip({ startTime: 99 });
        const track = makeTrack({ clips: [clip] });
        recalcTracks([track]);
        expect(clip.startTime).toBe(99); // unchanged
    });
});

// ═══════════════════════════════════════
//   buildInitialTimeline
// ═══════════════════════════════════════
describe("buildInitialTimeline", () => {
    test("creates 4 default tracks", () => {
        const tl = buildInitialTimeline([]);
        expect(tl.tracks).toHaveLength(4);
        expect(tl.tracks.map(t => t.type)).toEqual(["video", "audio", "music", "sfx"]);
    });

    test("builds clips from shot entries with video_url", () => {
        const shots: ShotEntry[] = [
            { sceneId: "s1", shot: { id: "shot-1", shot_type: "Wide", video_url: "v.mp4", video_settings: { duration: "3" } } },
            { sceneId: "s1", shot: { id: "shot-2", shot_type: "CU", video_url: "v2.mp4", video_settings: { duration: "4" } } },
        ];
        const tl = buildInitialTimeline(shots);
        const videoClips = tl.tracks[0].clips;

        expect(videoClips).toHaveLength(2);
        expect(videoClips[0].label).toBe("Wide");
        expect(videoClips[0].duration).toBe(3);
        expect(videoClips[0].startTime).toBe(0);
        expect(videoClips[1].duration).toBe(4);
        expect(videoClips[1].startTime).toBe(3);
        expect(tl.duration).toBe(7);
    });

    test("filters out image-only shots (no video_url)", () => {
        const shots: ShotEntry[] = [
            { sceneId: "s1", shot: { id: "shot-1", shot_type: "Wide", image_url: "img.png" } },
            { sceneId: "s1", shot: { id: "shot-2", shot_type: "CU", video_url: "v.mp4", video_settings: { duration: "3" } } },
        ];
        const tl = buildInitialTimeline(shots);
        expect(tl.tracks[0].clips).toHaveLength(1);
        expect(tl.tracks[0].clips[0].label).toBe("CU");
    });

    test("defaults to 5s when shot has no video_settings.duration", () => {
        const shots: ShotEntry[] = [
            { sceneId: "s1", shot: { id: "shot-1", video_url: "v.mp4" } },
        ];
        const tl = buildInitialTimeline(shots);
        expect(tl.tracks[0].clips[0].duration).toBe(DEFAULT_CLIP_DURATION);
    });

    test("B4 fix: clamps zero duration to 0.5s", () => {
        const shots: ShotEntry[] = [
            { sceneId: "s1", shot: { id: "shot-1", video_url: "v.mp4", video_settings: { duration: "0" } } },
        ];
        const tl = buildInitialTimeline(shots);
        expect(tl.tracks[0].clips[0].duration).toBe(0.5);
    });

    test("B4 fix: clamps negative duration to 0.5s", () => {
        const shots: ShotEntry[] = [
            { sceneId: "s1", shot: { id: "shot-1", video_url: "v.mp4", video_settings: { duration: "-5" } } },
        ];
        const tl = buildInitialTimeline(shots);
        expect(tl.tracks[0].clips[0].duration).toBe(0.5);
    });

    test("B4 fix: handles NaN duration", () => {
        const shots: ShotEntry[] = [
            { sceneId: "s1", shot: { id: "shot-1", video_url: "v.mp4", video_settings: { duration: "abc" } } },
        ];
        const tl = buildInitialTimeline(shots);
        expect(tl.tracks[0].clips[0].duration).toBe(DEFAULT_CLIP_DURATION);
    });

    test("empty shots gives 30s default duration", () => {
        const tl = buildInitialTimeline([]);
        expect(tl.duration).toBe(30);
    });

    test("uses shot_type as clip label, falls back to Shot N", () => {
        const shots: ShotEntry[] = [
            { sceneId: "s1", shot: { id: "shot-1", video_url: "v.mp4" } },
        ];
        const tl = buildInitialTimeline(shots);
        expect(tl.tracks[0].clips[0].label).toBe("Shot 1");
    });

    test("initial state has correct defaults", () => {
        const tl = buildInitialTimeline([]);
        expect(tl.playheadPosition).toBe(0);
        expect(tl.zoom).toBe(80);
        expect(tl.fps).toBe(24);
        expect(tl.isPlaying).toBe(false);
        expect(tl.selectedClipIds).toEqual([]);
        expect(tl.transitions).toEqual([]);
    });
});

// ═══════════════════════════════════════
//   recalcDuration
// ═══════════════════════════════════════
describe("recalcDuration", () => {
    test("calculates max end time across tracks", () => {
        const tracks = [
            makeTrack({ clips: [
                makeClip({ startTime: 0, duration: 5 }),
                makeClip({ id: "c2", startTime: 10, duration: 3 }),
            ]}),
        ];
        expect(recalcDuration(tracks)).toBe(13);
    });

    test("preserves gaps (doesn't reassign startTimes)", () => {
        const tracks = [
            makeTrack({ clips: [
                makeClip({ startTime: 0, duration: 3 }),
                makeClip({ id: "c2", startTime: 8, duration: 2 }),
            ]}),
        ];
        expect(recalcDuration(tracks)).toBe(10); // 8 + 2
    });

    test("returns 5 for empty tracks", () => {
        expect(recalcDuration([makeTrack({ clips: [] })])).toBe(5);
    });
});

// ═══════════════════════════════════════
//   findGapsInTrack
// ═══════════════════════════════════════
describe("findGapsInTrack", () => {
    test("finds gap between two clips", () => {
        const track = makeTrack({ clips: [
            makeClip({ startTime: 0, duration: 3 }),
            makeClip({ id: "c2", startTime: 5, duration: 2 }),
        ]});
        const gaps = findGapsInTrack(track);
        expect(gaps).toHaveLength(1);
        expect(gaps[0].startTime).toBe(3);
        expect(gaps[0].duration).toBe(2);
    });

    test("finds gap at the start", () => {
        const track = makeTrack({ clips: [
            makeClip({ startTime: 3, duration: 5 }),
        ]});
        const gaps = findGapsInTrack(track);
        expect(gaps).toHaveLength(1);
        expect(gaps[0].startTime).toBe(0);
        expect(gaps[0].duration).toBe(3);
    });

    test("no gaps when clips are contiguous", () => {
        const track = makeTrack({ clips: [
            makeClip({ startTime: 0, duration: 3 }),
            makeClip({ id: "c2", startTime: 3, duration: 4 }),
        ]});
        const gaps = findGapsInTrack(track);
        expect(gaps).toHaveLength(0);
    });

    test("returns empty for empty track", () => {
        expect(findGapsInTrack(makeTrack({ clips: [] }))).toHaveLength(0);
    });
});

// ═══════════════════════════════════════
//   removeGapInTrack
// ═══════════════════════════════════════
describe("removeGapInTrack", () => {
    test("shifts subsequent clips left by gap duration", () => {
        const tracks = [
            makeTrack({ id: "v1", clips: [
                makeClip({ startTime: 0, duration: 3 }),
                makeClip({ id: "c2", startTime: 5, duration: 2 }),
            ]}),
        ];
        const result = removeGapInTrack(tracks, "v1", 3, 2);
        expect(result[0].clips[0].startTime).toBe(0); // unchanged
        expect(result[0].clips[1].startTime).toBe(3); // shifted left by 2
    });

    test("only affects the target track", () => {
        const tracks = [
            makeTrack({ id: "v1", clips: [
                makeClip({ startTime: 0, duration: 3 }),
                makeClip({ id: "c2", startTime: 5, duration: 2 }),
            ]}),
            makeTrack({ id: "a1", type: "audio", clips: [
                makeClip({ id: "c3", startTime: 5, duration: 2 }),
            ]}),
        ];
        const result = removeGapInTrack(tracks, "v1", 3, 2);
        expect(result[1].clips[0].startTime).toBe(5); // audio track unchanged
    });
});

// ═══════════════════════════════════════
//   findClipAtTime
// ═══════════════════════════════════════
describe("findClipAtTime", () => {
    const clips = [
        makeClip({ id: "c1", startTime: 0, duration: 5 }),
        makeClip({ id: "c2", startTime: 5, duration: 5 }),
    ];
    const tracks = [makeTrack({ clips })];

    test("finds clip when time is in range", () => {
        expect(findClipAtTime(tracks, 2.5)?.id).toBe("c1");
    });

    test("finds clip at exact start time", () => {
        expect(findClipAtTime(tracks, 0)?.id).toBe("c1");
        expect(findClipAtTime(tracks, 5)?.id).toBe("c2");
    });

    test("returns null at exact end time (exclusive boundary)", () => {
        // time < startTime + duration, so end is exclusive
        expect(findClipAtTime(tracks, 10)).toBeNull();
    });

    test("returns null for negative time", () => {
        expect(findClipAtTime(tracks, -1)).toBeNull();
    });

    test("returns null for time past all clips", () => {
        expect(findClipAtTime(tracks, 100)).toBeNull();
    });

    test("returns null for empty tracks", () => {
        expect(findClipAtTime([makeTrack({ clips: [] })], 0)).toBeNull();
    });

    test("only searches video tracks", () => {
        const audioTrack = makeTrack({
            type: "audio",
            clips: [makeClip({ id: "audio-clip", startTime: 0, duration: 10 })],
        });
        expect(findClipAtTime([audioTrack], 5)).toBeNull();
    });
});

// ═══════════════════════════════════════
//   findClipById
// ═══════════════════════════════════════
describe("findClipById", () => {
    const tracks = [
        makeTrack({ id: "v1", clips: [makeClip({ id: "c1" })] }),
        makeTrack({ id: "a1", type: "audio", clips: [makeClip({ id: "c2" })] }),
    ];

    test("finds clip in first track", () => {
        expect(findClipById(tracks, "c1")?.id).toBe("c1");
    });

    test("finds clip in second track", () => {
        expect(findClipById(tracks, "c2")?.id).toBe("c2");
    });

    test("returns null for non-existent ID", () => {
        expect(findClipById(tracks, "c99")).toBeNull();
    });

    test("returns null for empty tracks", () => {
        expect(findClipById([makeTrack({ clips: [] })], "c1")).toBeNull();
    });
});

// ═══════════════════════════════════════
//   formatTimecode
// ═══════════════════════════════════════
describe("formatTimecode", () => {
    test("formats 0 seconds", () => {
        expect(formatTimecode(0, 24)).toBe("00:00:00");
    });

    test("formats whole seconds", () => {
        expect(formatTimecode(65, 24)).toBe("01:05:00");
    });

    test("formats fractional seconds to frames", () => {
        expect(formatTimecode(1.5, 24)).toBe("00:01:12"); // 0.5 * 24 = 12 frames
    });

    test("formats with 30fps", () => {
        expect(formatTimecode(1.5, 30)).toBe("00:01:15"); // 0.5 * 30 = 15 frames
    });

    test("formats with 60fps", () => {
        expect(formatTimecode(0.5, 60)).toBe("00:00:30"); // 0.5 * 60 = 30 frames
    });

    test("uses default 24fps", () => {
        expect(formatTimecode(1.5)).toBe("00:01:12");
    });
});

// ═══════════════════════════════════════
//   pixelsToTime / timeToPixels
// ═══════════════════════════════════════
describe("pixelsToTime & timeToPixels", () => {
    test("converts pixels to time", () => {
        expect(pixelsToTime(160, 80)).toBe(2);
    });

    test("converts time to pixels", () => {
        expect(timeToPixels(2, 80)).toBe(160);
    });

    test("round-trip conversion", () => {
        const time = 3.5;
        const zoom = 100;
        expect(pixelsToTime(timeToPixels(time, zoom), zoom)).toBeCloseTo(time);
    });

    test("handles zoom = 1", () => {
        expect(pixelsToTime(100, 1)).toBe(100);
        expect(timeToPixels(100, 1)).toBe(100);
    });
});

// ═══════════════════════════════════════
//   formatRulerTime
// ═══════════════════════════════════════
describe("formatRulerTime", () => {
    test("formats 0 seconds", () => {
        expect(formatRulerTime(0)).toBe("0:00");
    });

    test("formats under a minute", () => {
        expect(formatRulerTime(30)).toBe("0:30");
    });

    test("formats over a minute", () => {
        expect(formatRulerTime(90)).toBe("1:30");
    });

    test("pads seconds to 2 digits", () => {
        expect(formatRulerTime(5)).toBe("0:05");
    });
});
