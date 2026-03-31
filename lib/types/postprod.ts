// ═══════════════════════════════════════════════════════════
//   POST-PRODUCTION TYPES
//   Data structures for the Timeline & AI Editing Engine
// ═══════════════════════════════════════════════════════════

export interface TimelineClip {
    id: string;
    trackId: string;

    // Source reference
    sceneId: string;
    shotId: string;
    label: string;

    // Media
    thumbnailUrl?: string;
    videoUrl?: string;
    audioUrl?: string;

    // Timing (in seconds)
    startTime: number;
    duration: number;
    trimIn: number;   // offset from clip start
    trimOut: number;  // offset from clip end

    // Visual
    color: string;    // Track color indicator

    // State
    locked: boolean;
    muted: boolean;
    selected: boolean;
    speed: number;    // 0.25 – 4.0 (1.0 = normal)

    // V2V processing status
    videoStatus?: 'ready' | 'animating' | 'error';
    errorMessage?: string;

    // Audio metadata (for SFX/BGM/voiceover clips)
    audioType?: 'sfx' | 'bgm' | 'voiceover' | 'original';
    audioPrompt?: string;

    // Version history — each edit/relight/generation is a version
    videoHistory?: {
        url: string;
        provider?: string;
        mode?: string;
        prompt?: string;
        created_at?: string;
        task_id?: string;
    }[];
}

export type TrackType = 'video' | 'audio' | 'music' | 'sfx' | 'voiceover';

export interface TimelineTrack {
    id: string;
    type: TrackType;
    label: string;
    color: string;
    muted: boolean;
    locked: boolean;
    solo: boolean;
    height: number; // px
    clips: TimelineClip[];
    volume: number; // 0-1
}

export interface TimelineTransition {
    id: string;
    type: 'cut' | 'crossfade' | 'dissolve' | 'fade_black' | 'fade_white' | 'wipe';
    duration: number; // seconds
    clipAId: string;
    clipBId: string;
}

export interface TimelineState {
    tracks: TimelineTrack[];
    transitions: TimelineTransition[];
    playheadPosition: number; // seconds
    zoom: number;             // pixels per second
    duration: number;         // total timeline duration
    fps: number;
    isPlaying: boolean;
    selectedClipIds: string[];
}

export interface GlobalFilmControls {
    style: 'cinematic' | 'ad' | 'documentary' | 'music_video';
    pacing: 'slow' | 'medium' | 'fast';
    mood: 'dark' | 'light' | 'emotional' | 'intense' | 'neutral';
}

export interface AIEditCommand {
    prompt: string;
    scope: 'clip' | 'scene' | 'global';
    targetIds?: string[];   // clip or scene IDs
}

export interface AIEditResult {
    status: 'success' | 'partial' | 'failed';
    changes: {
        type: 'trim' | 'split' | 'reorder' | 'transition' | 'pacing' | 'audio';
        description: string;
        clipId?: string;
    }[];
    message: string;
}

export interface ExportConfig {
    aspectRatio: '16:9' | '9:16' | '1:1' | '4:5';
    resolution: '720p' | '1080p' | '2k' | '4k';
    format: 'mp4' | 'mov' | 'webm';
    watermark: boolean;
    platform: 'youtube' | 'reels' | 'tiktok' | 'ads' | 'custom';
    fps: 24 | 30 | 60;
}
