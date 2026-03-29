"use client";

import React from "react";
import {
    Play, Pause, SkipBack, SkipForward,
    Scissors, ZoomIn, ZoomOut, Maximize2,
    Repeat, Magnet, Undo2, Redo2, Trash2, Copy,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════
//   TRANSPORT CONTROLS (v2 — Clipchamp-style toolbar)
// ═══════════════════════════════════════════════════════════

interface TransportControlsProps {
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    zoom: number;
    onTogglePlay: () => void;
    onSeek: (time: number) => void;
    onSkipForward: () => void;
    onSkipBackward: () => void;
    onZoomIn: () => void;
    onZoomOut: () => void;
    onZoomToFit: () => void;
    onSplit: () => void;
    onDelete: () => void;
    onUndo: () => void;
    onRedo: () => void;
    onDuplicate: () => void;
    snapEnabled: boolean;
    onToggleSnap: () => void;
    canUndo: boolean;
    canRedo: boolean;
    hasSelection: boolean;
    formatTimecode: (secs: number) => string;
    loopingClipName?: string | null;  // non-null when a clip is selected and looping
    loopClipTime?: { elapsed: number; total: number } | null;
}

function ToolBtn({
    onClick, title, disabled, active, children,
}: {
    onClick: () => void;
    title: string;
    disabled?: boolean;
    active?: boolean;
    children: React.ReactNode;
}) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`p-1.5 rounded transition-all ${
                disabled
                    ? "text-neutral-700 cursor-not-allowed"
                    : active
                    ? "bg-[#E50914]/20 text-[#E50914] hover:bg-[#E50914]/30"
                    : "text-neutral-500 hover:text-white hover:bg-[#1a1a1a]"
            }`}
            title={title}
        >
            {children}
        </button>
    );
}

export default function TransportControls({
    isPlaying,
    currentTime,
    duration,
    zoom,
    onTogglePlay,
    onSeek,
    onSkipForward,
    onSkipBackward,
    onZoomIn,
    onZoomOut,
    onZoomToFit,
    onSplit,
    onDelete,
    onUndo,
    onRedo,
    onDuplicate,
    snapEnabled,
    onToggleSnap,
    canUndo,
    canRedo,
    hasSelection,
    formatTimecode,
    loopingClipName,
    loopClipTime,
}: TransportControlsProps) {
    return (
        <div className="h-10 bg-[#080808] border-y border-[#1a1a1a] flex items-center justify-between px-3 shrink-0 gap-1">
            {/* LEFT: Undo/Redo + Timecodes */}
            <div className="flex items-center gap-1 min-w-[200px]">
                <ToolBtn onClick={onUndo} title="Undo (⌘Z)" disabled={!canUndo}>
                    <Undo2 size={13} />
                </ToolBtn>
                <ToolBtn onClick={onRedo} title="Redo (⌘⇧Z)" disabled={!canRedo}>
                    <Redo2 size={13} />
                </ToolBtn>

                <div className="h-4 w-px bg-[#222] mx-1" />

                <span className="text-[10px] font-mono text-neutral-500 min-w-[60px]">
                    {loopClipTime ? formatTimecode(loopClipTime.elapsed) : formatTimecode(currentTime)}
                </span>
                <div className="h-px flex-1 bg-[#222] mx-0.5 max-w-[20px]" />
                <span className="text-[10px] font-mono text-neutral-600 min-w-[60px]">
                    {loopClipTime ? formatTimecode(loopClipTime.total) : formatTimecode(duration)}
                </span>
            </div>

            {/* CENTER: Transport + Edit Tools */}
            <div className="flex items-center gap-0.5">
                <ToolBtn onClick={onSkipBackward} title="Skip Back (←)">
                    <SkipBack size={13} />
                </ToolBtn>

                <button
                    onClick={onTogglePlay}
                    className={`p-2 rounded-full mx-1 transition-all ${
                        isPlaying
                            ? "bg-[#E50914] text-white shadow-lg shadow-[#E50914]/25"
                            : "bg-[#1a1a1a] text-white hover:bg-[#E50914] hover:shadow-lg hover:shadow-[#E50914]/25"
                    }`}
                    title="Play/Pause (Space)"
                >
                    {isPlaying ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
                </button>

                <ToolBtn onClick={onSkipForward} title="Skip Forward (→)">
                    <SkipForward size={13} />
                </ToolBtn>

                <div className="h-4 w-px bg-[#222] mx-1.5" />

                {/* Edit tools */}
                <ToolBtn onClick={onSplit} title="Split at Playhead (S)">
                    <Scissors size={13} />
                </ToolBtn>
                <ToolBtn onClick={onDelete} title="Delete Selected (⌫)" disabled={!hasSelection}>
                    <Trash2 size={13} />
                </ToolBtn>
                <ToolBtn onClick={onDuplicate} title="Duplicate (⌘D)" disabled={!hasSelection}>
                    <Copy size={13} />
                </ToolBtn>

                <div className="h-4 w-px bg-[#222] mx-1.5" />

                <ToolBtn onClick={onToggleSnap} title={`Snap ${snapEnabled ? "ON" : "OFF"}`} active={snapEnabled}>
                    <Magnet size={13} />
                </ToolBtn>
                <ToolBtn onClick={() => {}} title={loopingClipName ? `Looping: ${loopingClipName}` : "Loop (select a clip)"} active={!!loopingClipName}>
                    <Repeat size={13} />
                </ToolBtn>
                {loopingClipName && (
                    <div className="flex items-center gap-1.5 ml-1 px-2 py-0.5 rounded bg-[#E50914]/10 border border-[#E50914]/20">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#E50914] animate-pulse" />
                        <span className="text-[8px] font-mono text-[#E50914] tracking-wider uppercase">
                            LOOP: {loopingClipName.length > 12 ? loopingClipName.slice(0, 12) + "…" : loopingClipName}
                        </span>
                    </div>
                )}
            </div>

            {/* RIGHT: Zoom */}
            <div className="flex items-center gap-1 min-w-[160px] justify-end">
                <ToolBtn onClick={onZoomOut} title="Zoom Out (⌘-)">
                    <ZoomOut size={12} />
                </ToolBtn>
                <div className="w-16 h-1 bg-[#222] rounded-full overflow-hidden mx-1">
                    <div
                        className="h-full bg-neutral-500 rounded-full transition-all duration-200"
                        style={{ width: `${((zoom - 20) / (300 - 20)) * 100}%` }}
                    />
                </div>
                <ToolBtn onClick={onZoomIn} title="Zoom In (⌘+)">
                    <ZoomIn size={12} />
                </ToolBtn>
                <ToolBtn onClick={onZoomToFit} title="Zoom to Fit (⌘0)">
                    <Maximize2 size={12} />
                </ToolBtn>
            </div>
        </div>
    );
}
