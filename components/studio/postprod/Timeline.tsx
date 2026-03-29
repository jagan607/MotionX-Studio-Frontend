"use client";

import React, { useRef, useCallback, useEffect, useState } from "react";
import {
    Lock, Unlock, Volume2, VolumeX,
    GripVertical, Plus, Scissors, Trash2, Copy, Gauge, Loader2
} from "lucide-react";
import {
    pixelsToTime,
    timeToPixels,
    formatRulerTime,
    findGapsInTrack,
    TimelineGap,
} from "@/lib/postprod-utils";
import {
    DndContext,
    closestCenter,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    DragStartEvent,
    DragOverlay,
    useDraggable,
    useDroppable,
} from "@dnd-kit/core";
import {
    TimelineState,
    TimelineTrack,
    TimelineClip,
} from "@/lib/types/postprod";

// ═══════════════════════════════════════════════════════════
//   TIMELINE COMPONENT (v5 — absolute positioning + gaps)
// ═══════════════════════════════════════════════════════════

interface TimelineProps {
    state: TimelineState;
    onClipSelect: (clip: TimelineClip | null, addToSelection?: boolean) => void;
    onClipTrim: (clipId: string, newDuration: number, trimInDelta?: number) => void;
    onTrimEnd: () => void;
    onClipReorder: (trackId: string, fromIndex: number, toIndex: number) => void;
    onClipSplit: (clipId?: string, time?: number) => void;
    onClipDelete: () => void;
    onClipDuplicate: () => void;
    onClipSpeed: (clipId: string, speed: number) => void;
    onSeek: (time: number) => void;
    selectedClipIds: string[];
    onTrackToggleMute: (trackId: string) => void;
    onTrackToggleLock: (trackId: string) => void;
    onRemoveGap: (trackId: string, gapStartTime: number, gapDuration: number) => void;
    snapEnabled: boolean;
    // Scene-scoped
    scenes: { id: string; label: string }[];
    activeSceneId: string | null;
    onSceneChange: (sceneId: string) => void;
    // Processing state
    processingClipIds: Set<string>;
}

// ─── GAP CONTEXT MENU ───
interface GapContextMenuState {
    x: number;
    y: number;
    trackId: string;
    gap: TimelineGap;
}

// ─── CONTEXT MENU ───
interface ContextMenuState {
    x: number;
    y: number;
    clipId: string;
}

const SPEED_OPTIONS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 4];

function ClipContextMenu({
    menu,
    clip,
    playheadPosition,
    onSplit,
    onDelete,
    onDuplicate,
    onSpeed,
    onClose,
}: {
    menu: ContextMenuState;
    clip: TimelineClip | undefined;
    playheadPosition: number;
    onSplit: (clipId: string, time: number) => void;
    onDelete: () => void;
    onDuplicate: () => void;
    onSpeed: (clipId: string, speed: number) => void;
    onClose: () => void;
}) {
    const [showSpeedMenu, setShowSpeedMenu] = useState(false);

    useEffect(() => {
        const handler = () => onClose();
        window.addEventListener("click", handler);
        window.addEventListener("contextmenu", handler);
        return () => {
            window.removeEventListener("click", handler);
            window.removeEventListener("contextmenu", handler);
        };
    }, [onClose]);

    if (!clip) return null;

    const canSplit =
        playheadPosition > clip.startTime + 0.2 &&
        playheadPosition < clip.startTime + clip.duration - 0.2;

    return (
        <div
            className="fixed z-[100] bg-[#181818] border border-[#333] rounded-lg shadow-2xl py-1 min-w-[180px]"
            style={{ left: menu.x, top: menu.y }}
            onClick={(e) => e.stopPropagation()}
        >
            <button
                onClick={() => { if (canSplit) onSplit(clip.id, playheadPosition); onClose(); }}
                disabled={!canSplit}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-[11px] text-neutral-300 hover:bg-[#E50914]/20 hover:text-white transition-colors disabled:text-neutral-600 disabled:hover:bg-transparent"
            >
                <Scissors size={12} /> Split at Playhead
                <span className="ml-auto text-[9px] text-neutral-600 font-mono">S</span>
            </button>

            <button
                onClick={() => { onDuplicate(); onClose(); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-[11px] text-neutral-300 hover:bg-[#E50914]/20 hover:text-white transition-colors"
            >
                <Copy size={12} /> Duplicate
                <span className="ml-auto text-[9px] text-neutral-600 font-mono">⌘D</span>
            </button>

            <div className="h-px bg-[#333] my-1 mx-2" />

            {/* Speed submenu */}
            <div className="relative">
                <button
                    onClick={(e) => { e.stopPropagation(); setShowSpeedMenu(!showSpeedMenu); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-[11px] text-neutral-300 hover:bg-[#E50914]/20 hover:text-white transition-colors"
                >
                    <Gauge size={12} /> Speed
                    <span className="ml-auto text-[9px] text-neutral-500">{clip.speed || 1}x ▸</span>
                </button>
                {showSpeedMenu && (
                    <div className="absolute left-full top-0 ml-1 bg-[#181818] border border-[#333] rounded-lg shadow-2xl py-1 min-w-[100px]">
                        {SPEED_OPTIONS.map((s) => (
                            <button
                                key={s}
                                onClick={() => { onSpeed(clip.id, s); onClose(); }}
                                className={`w-full text-left px-3 py-1.5 text-[11px] transition-colors ${
                                    (clip.speed || 1) === s
                                        ? "text-[#E50914] bg-[#E50914]/10"
                                        : "text-neutral-300 hover:bg-[#E50914]/20 hover:text-white"
                                }`}
                            >
                                {s}x
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="h-px bg-[#333] my-1 mx-2" />

            <button
                onClick={() => { onDelete(); onClose(); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-[11px] text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors"
            >
                <Trash2 size={12} /> Delete
                <span className="ml-auto text-[9px] text-neutral-600 font-mono">⌫</span>
            </button>
        </div>
    );
}

// ─── GAP CONTEXT MENU ───
function GapContextMenu({
    menu,
    onRemoveGap,
    onClose,
}: {
    menu: GapContextMenuState;
    onRemoveGap: (trackId: string, gapStartTime: number, gapDuration: number) => void;
    onClose: () => void;
}) {
    return (
        <div
            className="fixed z-50 bg-[#111] border border-[#2a2a2a] rounded-lg shadow-2xl py-1.5 min-w-[160px]"
            style={{ left: menu.x, top: menu.y }}
            onClick={(e) => e.stopPropagation()}
        >
            <button
                onClick={() => { onRemoveGap(menu.trackId, menu.gap.startTime, menu.gap.duration); onClose(); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-[11px] text-neutral-300 hover:bg-[#E50914]/20 hover:text-white transition-colors"
            >
                <Trash2 size={12} /> Remove Gap
                <span className="ml-auto text-[9px] text-neutral-600 font-mono">{menu.gap.duration.toFixed(1)}s</span>
            </button>
        </div>
    );
}

// ─── DRAGGABLE CLIP ───
function DraggableClip({
    clip,
    trackHeight,
    zoom,
    isSelected,
    isLocked,
    isProcessing,
    onClipSelect,
    onTrimStart,
    onContextMenu,
}: {
    clip: TimelineClip;
    trackHeight: number;
    zoom: number;
    isSelected: boolean;
    isLocked: boolean;
    isProcessing: boolean;
    onClipSelect: (clip: TimelineClip | null, addToSelection?: boolean) => void;
    onTrimStart: (e: React.MouseEvent, clip: TimelineClip, edge: "left" | "right") => void;
    onContextMenu: (e: React.MouseEvent, clip: TimelineClip) => void;
}) {
    // Bug 1 fix: separate IDs so dnd-kit doesn't confuse drag source with drop target
    const {
        attributes, listeners, setNodeRef: setDragRef, isDragging,
    } = useDraggable({ id: `drag-${clip.id}`, disabled: isLocked });
    const { setNodeRef: setDropRef } = useDroppable({ id: `drop-${clip.id}` });

    // Merge drag + drop refs onto one element
    const mergedRef = (node: HTMLElement | null) => {
        setDragRef(node);
        setDropRef(node);
    };

    const w = timeToPixels(clip.duration, zoom);
    const h = trackHeight - 8;
    const showSpeed = (clip.speed || 1) !== 1;
    const left = timeToPixels(clip.startTime, zoom);

    const style: React.CSSProperties = {
        position: "absolute" as const,
        left: left,
        width: w,
        height: h,
        backgroundColor: `${clip.color}22`,
        borderLeft: `2px solid ${clip.color}`,
        opacity: isDragging ? 0.3 : 1,
        zIndex: isDragging ? 50 : 1,
    };

    return (
        <div
            ref={mergedRef}
            className={`cursor-pointer group rounded-sm overflow-hidden ${
                isSelected ? "ring-2 ring-[#E50914] ring-offset-1 ring-offset-black" : ""
            }`}
            style={style}
            onClick={(e) => {
                e.stopPropagation();
                // Bug 3 fix: proper null call instead of type hack
                if (isSelected && !e.shiftKey) {
                    onClipSelect(null);
                    return;
                }
                onClipSelect(clip, e.shiftKey);
            }}
            onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onContextMenu(e, clip);
            }}
        >
            {/* Bug 7 fix: full-height drag handle for easier discovery */}
            <div
                className="absolute inset-0 cursor-grab z-20"
                {...attributes}
                {...listeners}
            >
                <div className="absolute top-0 left-0 right-0 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <GripVertical size={8} className="text-white/40" />
                </div>
            </div>

            {/* Thumbnail */}
            {clip.thumbnailUrl && w > 50 && (
                <div className="absolute inset-0 opacity-30">
                    <img src={clip.thumbnailUrl} alt="" className="w-full h-full object-cover" draggable={false} />
                </div>
            )}

            {/* Hover brightness effect */}
            <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-colors pointer-events-none" />

            {/* Awaiting video indicator — shows when clip has no video yet */}
            {!clip.videoUrl && !isProcessing && (
                <div className="absolute inset-0 z-25 pointer-events-none overflow-hidden rounded-sm">
                    <div className="absolute inset-0 skeleton-shimmer" />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="flex items-center gap-1.5 bg-black/60 px-2 py-1 rounded">
                            <Loader2 size={10} className="animate-spin text-neutral-500" />
                            <span className="text-[7px] font-mono text-neutral-500 tracking-wider uppercase">
                                Awaiting Video
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* Processing shimmer overlay — active generation in progress */}
            {isProcessing && (
                <div className="absolute inset-0 z-30 pointer-events-none overflow-hidden rounded-sm">
                    <div className="absolute inset-0 bg-black/50" />
                    <div
                        className="absolute inset-0"
                        style={{
                            background: "linear-gradient(90deg, transparent 0%, rgba(229,9,20,0.15) 40%, rgba(229,9,20,0.25) 50%, rgba(229,9,20,0.15) 60%, transparent 100%)",
                            backgroundSize: "200% 100%",
                            animation: "shimmer 1.5s ease-in-out infinite",
                        }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="flex items-center gap-1.5">
                            <Loader2 size={10} className="animate-spin text-[#E50914]" />
                            <span className="text-[7px] font-mono text-white/70 tracking-wider uppercase">
                                Processing
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* Start time tooltip */}
            <div className="absolute -top-5 left-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30">
                <span className="text-[7px] font-mono text-neutral-500 bg-[#111] px-1 py-0.5 rounded border border-[#222]">
                    {clip.startTime.toFixed(1)}s
                </span>
            </div>

            {/* Label row */}
            <div className="relative z-10 h-full flex items-center px-2 gap-1">
                <span className="text-[8px] font-bold text-white/80 tracking-wider uppercase truncate flex-1">
                    {clip.label}
                </span>
                {/* Speed badge */}
                {showSpeed && w > 50 && (
                    <span className="text-[7px] px-1 py-0.5 rounded bg-purple-500/30 text-purple-300 font-mono shrink-0">
                        {clip.speed}x
                    </span>
                )}
                {w > 80 && (
                    <span className="text-[7px] text-white/30 font-mono shrink-0">
                        {clip.duration.toFixed(1)}s
                    </span>
                )}
            </div>

            {/* Trim handles — B2 fix: disabled on locked clips */}
            {!clip.locked && (
            <div
                className="absolute left-0 top-0 w-[6px] h-full cursor-col-resize z-20 group/trim"
                onMouseDown={(e) => { e.stopPropagation(); onTrimStart(e, clip, "left"); }}
            >
                <div className="w-full h-full opacity-0 group-hover:opacity-100 group-hover/trim:opacity-100 bg-white/30 transition-opacity rounded-l-sm" />
            </div>
            )}
            {!clip.locked && (
            <div
                className="absolute right-0 top-0 w-[6px] h-full cursor-col-resize z-20 group/trim"
                onMouseDown={(e) => { e.stopPropagation(); onTrimStart(e, clip, "right"); }}
            >
                <div className="w-full h-full opacity-0 group-hover:opacity-100 group-hover/trim:opacity-100 bg-white/30 transition-opacity rounded-r-sm" />
            </div>
            )}
        </div>
    );
}

// ─── DRAG OVERLAY CLIP ───
function ClipOverlay({ clip, trackHeight, zoom }: {
    clip: TimelineClip; trackHeight: number; zoom: number;
}) {
    const w = timeToPixels(clip.duration, zoom);
    const h = trackHeight - 8;

    return (
        <div
            className="rounded-sm overflow-hidden ring-2 ring-[#E50914] shadow-2xl"
            style={{
                width: w, height: h,
                backgroundColor: `${clip.color}44`,
                borderLeft: `2px solid ${clip.color}`,
            }}
        >
            {clip.thumbnailUrl && (
                <div className="absolute inset-0 opacity-40">
                    <img src={clip.thumbnailUrl} alt="" className="w-full h-full object-cover" draggable={false} />
                </div>
            )}
            <div className="relative z-10 h-full flex items-center px-2">
                <span className="text-[8px] font-bold text-white tracking-wider uppercase truncate">
                    {clip.label}
                </span>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════
//   MAIN TIMELINE
// ═══════════════════════════════════════════════════════════
export default function Timeline({
    state,
    onClipSelect,
    onClipTrim,
    onTrimEnd,
    onClipReorder,
    onClipSplit,
    onClipDelete,
    onClipDuplicate,
    onClipSpeed,
    onSeek,
    selectedClipIds,
    onTrackToggleMute,
    onTrackToggleLock,
    onRemoveGap,
    snapEnabled,
    scenes,
    activeSceneId,
    onSceneChange,
    processingClipIds,
}: TimelineProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const rulerRef = useRef<HTMLDivElement>(null);
    const [trimHandle, setTrimHandle] = useState<{
        clipId: string;
        edge: "left" | "right";
        startX: number;
        originalDuration: number;
    } | null>(null);
    const [activeDragClip, setActiveDragClip] = useState<TimelineClip | null>(null);
    const [activeDragTrackHeight, setActiveDragTrackHeight] = useState(80);
    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
    const [gapContextMenu, setGapContextMenu] = useState<GapContextMenuState | null>(null);

    const { tracks, zoom, duration, playheadPosition } = state;
    const totalWidth = timeToPixels(duration + 10, zoom);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
    );

    // ─── RULER ───
    const renderRuler = () => {
        const markers: React.ReactNode[] = [];
        const intervalSec = zoom > 100 ? 1 : zoom > 50 ? 2 : 5;

        for (let t = 0; t <= duration + 5; t += intervalSec) {
            const x = timeToPixels(t, zoom);
            const isMajor = t % (intervalSec * 5) === 0 || t === 0;
            markers.push(
                <div key={t} className="absolute top-0 flex flex-col items-center" style={{ left: x }}>
                    <div className={`w-px ${isMajor ? "h-4 bg-[#555]" : "h-2 bg-[#333]"}`} />
                    {isMajor && (
                        <span className="text-[8px] text-neutral-600 font-mono mt-0.5 select-none">
                            {formatRulerTime(t)}
                        </span>
                    )}
                </div>
            );
        }
        return markers;
    };

    // ─── RULER CLICK ───
    const handleRulerClick = useCallback(
        (e: React.MouseEvent) => {
            if (!rulerRef.current) return;
            const rect = rulerRef.current.getBoundingClientRect();
            const scrollLeft = scrollRef.current?.scrollLeft || 0;
            const x = e.clientX - rect.left + scrollLeft;
            const time = pixelsToTime(x, zoom);
            onSeek(Math.max(0, Math.min(time, duration)));
        },
        [zoom, duration, onSeek]
    );

    // ─── TRIM ───
    const handleTrimStart = useCallback(
        (e: React.MouseEvent, clip: TimelineClip, edge: "left" | "right") => {
            setTrimHandle({
                clipId: clip.id, edge,
                startX: e.clientX,
                originalDuration: clip.duration,
            });
        },
        []
    );

    useEffect(() => {
        if (!trimHandle) return;

        const onMouseMove = (e: MouseEvent) => {
            const dx = e.clientX - trimHandle.startX;
            const dtSec = pixelsToTime(
                trimHandle.edge === "right" ? dx : -dx, zoom
            );
            // B1 fix: pass trimIn delta for left-edge trims
            const trimInDelta = trimHandle.edge === "left" ? -dtSec : undefined;
            onClipTrim(trimHandle.clipId, trimHandle.originalDuration + dtSec, trimInDelta);
        };

        const onMouseUp = () => {
            setTrimHandle(null);
            onTrimEnd();
        };

        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
        return () => {
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
        };
    }, [trimHandle, zoom, onClipTrim, onTrimEnd]);

    // ─── SCROLL SYNC ───
    useEffect(() => {
        if (!scrollRef.current || !state.isPlaying) return;
        const playheadPx = timeToPixels(playheadPosition, zoom);
        const scrollLeft = scrollRef.current.scrollLeft;
        const width = scrollRef.current.clientWidth;
        if (playheadPx < scrollLeft + 60 || playheadPx > scrollLeft + width - 60) {
            scrollRef.current.scrollTo({ left: playheadPx - width / 3, behavior: "smooth" });
        }
    }, [playheadPosition, zoom, state.isPlaying]);

    // ─── CONTEXT MENU ───
    const handleContextMenu = useCallback((e: React.MouseEvent, clip: TimelineClip) => {
        // B5 fix: clamp context menu position to viewport bounds
        const MENU_WIDTH = 200;
        const MENU_HEIGHT = 220;
        const x = Math.min(e.clientX, window.innerWidth - MENU_WIDTH);
        const y = Math.min(e.clientY, window.innerHeight - MENU_HEIGHT);
        setContextMenu({ x, y, clipId: clip.id });
        // Ensure the right-clicked clip is selected
        if (!selectedClipIds.includes(clip.id)) {
            onClipSelect(clip);
        }
    }, [selectedClipIds, onClipSelect]);

    // ─── DND ───
    const handleDragStart = useCallback(
        (event: DragStartEvent) => {
            // Strip "drag-" prefix to find the clip
            const clipId = (event.active.id as string).replace(/^drag-/, "");
            for (const track of tracks) {
                const clip = track.clips.find((c) => c.id === clipId);
                if (clip) {
                    setActiveDragClip(clip);
                    setActiveDragTrackHeight(track.height);
                    break;
                }
            }
        },
        [tracks]
    );

    const handleDragEnd = useCallback(
        (event: DragEndEvent) => {
            setActiveDragClip(null);
            const { active, over } = event;
            if (!over || active.id === over.id) return;

            // Bug 1 fix: strip prefixes to get clip IDs
            const activeClipId = (active.id as string).replace(/^drag-/, "");
            const overClipId = (over.id as string).replace(/^drop-/, "");
            if (activeClipId === overClipId) return;

            for (const track of tracks) {
                const fromIdx = track.clips.findIndex((c) => c.id === activeClipId);
                const toIdx = track.clips.findIndex((c) => c.id === overClipId);
                if (fromIdx !== -1 && toIdx !== -1) {
                    onClipReorder(track.id, fromIdx, toIdx);
                    break;
                }
            }
        },
        [tracks, onClipReorder]
    );

    // Find clip for context menu
    const contextMenuClip = contextMenu
        ? tracks.flatMap((t) => t.clips).find((c) => c.id === contextMenu.clipId)
        : undefined;

    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-[#0a0a0a] border-t border-[#1a1a1a]">
            <div className="flex flex-1 overflow-hidden">
                {/* ═══ TRACK HEADERS ═══ */}
                <div className="w-[180px] shrink-0 border-r border-[#1a1a1a] bg-[#080808] flex flex-col">
                    <div className="h-7 border-b border-[#1a1a1a] flex items-center px-3 justify-between">
                        <span className="text-[8px] text-neutral-600 tracking-[2px] font-mono uppercase">TRACKS</span>
                        {scenes.length > 1 && (
                            <select
                                value={activeSceneId || ""}
                                onChange={(e) => onSceneChange(e.target.value)}
                                className="text-[9px] bg-[#111] border border-[#2a2a2a] text-neutral-400 rounded px-1.5 py-0.5 font-mono tracking-wider uppercase cursor-pointer hover:border-[#444] transition-colors focus:outline-none focus:border-[#E50914] appearance-none pr-4"
                                style={{
                                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
                                    backgroundRepeat: "no-repeat",
                                    backgroundPosition: "right 4px center",
                                }}
                            >
                                {scenes.map((scene) => (
                                    <option key={scene.id} value={scene.id}>
                                        {scene.label}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    {tracks.map((track) => (
                        <div
                            key={track.id}
                            className="border-b border-[#141414] flex items-center px-2 gap-1.5 group"
                            style={{ height: track.height }}
                        >
                            <div
                                className="w-1.5 h-1.5 rounded-full shrink-0"
                                style={{ backgroundColor: track.color }}
                            />
                            <span className="text-[9px] font-bold text-neutral-400 tracking-wider truncate flex-1 uppercase">
                                {track.label}
                            </span>
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => onTrackToggleMute(track.id)}
                                    className="p-0.5 rounded hover:bg-[#222] transition-colors"
                                    title={track.muted ? "Unmute" : "Mute"}
                                >
                                    {track.muted ? (
                                        <VolumeX size={10} className="text-red-500" />
                                    ) : (
                                        <Volume2 size={10} className="text-neutral-500" />
                                    )}
                                </button>
                                <button
                                    onClick={() => onTrackToggleLock(track.id)}
                                    className="p-0.5 rounded hover:bg-[#222] transition-colors"
                                    title={track.locked ? "Unlock" : "Lock"}
                                >
                                    {track.locked ? (
                                        <Lock size={10} className="text-yellow-500" />
                                    ) : (
                                        <Unlock size={10} className="text-neutral-500" />
                                    )}
                                </button>
                            </div>
                        </div>
                    ))}

                    <div className="p-2">
                        <button className="w-full flex items-center justify-center gap-1 py-1.5 rounded border border-dashed border-[#222] hover:border-[#444] text-[8px] text-neutral-600 tracking-[2px] transition-all">
                            <Plus size={9} /> ADD TRACK
                        </button>
                    </div>
                </div>

                {/* ═══ SCROLLABLE TRACKS ═══ */}
                <div
                    ref={scrollRef}
                className="flex-1 overflow-x-auto overflow-y-hidden relative"
                    onClick={() => { onClipSelect(null); setContextMenu(null); setGapContextMenu(null); }}
                >
                    {/* Ruler */}
                    <div
                        ref={rulerRef}
                        className="h-7 border-b border-[#1a1a1a] bg-[#080808] sticky top-0 z-20 cursor-pointer relative"
                        style={{ width: totalWidth }}
                        onClick={(e) => { e.stopPropagation(); handleRulerClick(e); }}
                    >
                        {renderRuler()}
                    </div>

                    {/* Track Lanes */}
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                    >
                        <div className="relative" style={{ width: totalWidth }}>
                            {tracks.map((track) => (
                                <div
                                    key={track.id}
                                    className={`relative border-b border-[#141414] ${track.muted ? "opacity-40" : ""}`}
                                    style={{ height: track.height }}
                                >
                                    {/* Grid */}
                                    <div
                                        className="absolute inset-0 opacity-[0.03]"
                                        style={{
                                            backgroundImage: `repeating-linear-gradient(90deg, #fff 0, #fff 1px, transparent 1px, transparent ${zoom}px)`,
                                        }}
                                    />

                                    {/* Lock overlay */}
                                    {track.locked && (
                                        <div className="absolute inset-0 bg-yellow-500/5 z-10 pointer-events-none flex items-center justify-center">
                                            <Lock size={14} className="text-yellow-500/20" />
                                        </div>
                                    )}

                                    {/* Clips (absolute positioning — no SortableContext) */}
                                        <div
                                            className="relative w-full h-full pt-1"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            {track.clips.length === 0 && (
                                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                    <span className="text-[8px] text-neutral-700 tracking-[2px] uppercase font-mono">
                                                        Drop clips here
                                                    </span>
                                                </div>
                                            )}

                                            {/* Gap markers */}
                                            {findGapsInTrack(track).map((gap) => (
                                                <div
                                                    key={`gap-${track.id}-${gap.startTime}`}
                                                    className="absolute top-1 cursor-pointer group/gap"
                                                    style={{
                                                        left: timeToPixels(gap.startTime, zoom),
                                                        width: timeToPixels(gap.duration, zoom),
                                                        height: track.height - 8,
                                                    }}
                                                    onContextMenu={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        const MENU_WIDTH = 180;
                                                        const MENU_HEIGHT = 60;
                                                        const x = Math.min(e.clientX, window.innerWidth - MENU_WIDTH);
                                                        const y = Math.min(e.clientY, window.innerHeight - MENU_HEIGHT);
                                                        setGapContextMenu({ x, y, trackId: track.id, gap });
                                                    }}
                                                >
                                                    <div className="w-full h-full border border-dashed border-neutral-800 rounded-sm opacity-0 group-hover/gap:opacity-100 transition-opacity flex items-center justify-center">
                                                        {timeToPixels(gap.duration, zoom) > 60 && (
                                                            <span className="text-[7px] text-neutral-700 font-mono">
                                                                {gap.duration.toFixed(1)}s
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}

                                            {/* Clips */}
                                            {track.clips.map((clip) => (
                                                <DraggableClip
                                                    key={clip.id}
                                                    clip={clip}
                                                    trackHeight={track.height}
                                                    zoom={zoom}
                                                    isSelected={selectedClipIds.includes(clip.id)}
                                                    isLocked={track.locked}
                                                    isProcessing={processingClipIds.has(clip.id)}
                                                    onClipSelect={onClipSelect}
                                                    onTrimStart={handleTrimStart}
                                                    onContextMenu={handleContextMenu}
                                                />
                                            ))}
                                        </div>
                                </div>
                            ))}

                            {/* ═══ LOOP REGION OVERLAY ═══ */}
                            {selectedClipIds.length === 1 && (() => {
                                const loopClip = tracks.flatMap(t => t.clips).find(c => c.id === selectedClipIds[0]);
                                if (!loopClip) return null;
                                const loopLeft = timeToPixels(loopClip.startTime, zoom);
                                const loopWidth = timeToPixels(loopClip.duration, zoom);
                                return (
                                    <>
                                        {/* Dim outside loop region */}
                                        <div
                                            className="absolute top-0 bottom-0 left-0 bg-black/30 z-20 pointer-events-none"
                                            style={{ width: loopLeft }}
                                        />
                                        <div
                                            className="absolute top-0 bottom-0 bg-black/30 z-20 pointer-events-none"
                                            style={{ left: loopLeft + loopWidth, right: 0 }}
                                        />
                                        {/* Loop region highlight */}
                                        <div
                                            className="absolute top-0 bottom-0 z-20 pointer-events-none"
                                            style={{ left: loopLeft, width: loopWidth }}
                                        >
                                            {/* Left bracket */}
                                            <div className="absolute left-0 top-0 bottom-0 w-px bg-[#E50914]/60" />
                                            <div className="absolute left-0 top-0 w-2 h-px bg-[#E50914]/60" />
                                            <div className="absolute left-0 bottom-0 w-2 h-px bg-[#E50914]/60" />
                                            {/* Right bracket */}
                                            <div className="absolute right-0 top-0 bottom-0 w-px bg-[#E50914]/60" />
                                            <div className="absolute right-0 top-0 w-2 h-px bg-[#E50914]/60" />
                                            <div className="absolute right-0 bottom-0 w-2 h-px bg-[#E50914]/60" />
                                            {/* Loop label */}
                                            <div className="absolute -top-6 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-[#E50914]/20 border border-[#E50914]/30 rounded px-1.5 py-0.5">
                                                <div className="w-1 h-1 rounded-full bg-[#E50914] animate-pulse" />
                                                <span className="text-[7px] font-mono text-[#E50914] tracking-wider uppercase">LOOP</span>
                                            </div>
                                        </div>
                                    </>
                                );
                            })()}

                            {/* ═══ PLAYHEAD ═══ */}
                            <div
                                className="absolute top-0 bottom-0 z-30 pointer-events-none"
                                style={{ left: timeToPixels(playheadPosition, zoom) }}
                            >
                                <div className="relative -top-7 -left-[5px]">
                                    <div className="w-0 h-0 border-l-[5px] border-r-[5px] border-t-[7px] border-l-transparent border-r-transparent border-t-[#E50914]" />
                                </div>
                                <div className="w-px h-full bg-[#E50914] -mt-0.5" />
                            </div>

                            {/* ═══ SNAP LINE (at playhead when snap is on) ═══ */}
                            {snapEnabled && trimHandle && (
                                <div
                                    className="absolute top-0 bottom-0 z-20 pointer-events-none"
                                    style={{ left: timeToPixels(playheadPosition, zoom) }}
                                >
                                    <div className="w-px h-full bg-yellow-400/40 border-dashed" />
                                </div>
                            )}
                        </div>

                        <DragOverlay dropAnimation={null}>
                            {activeDragClip ? (
                                <ClipOverlay
                                    clip={activeDragClip}
                                    trackHeight={activeDragTrackHeight}
                                    zoom={zoom}
                                />
                            ) : null}
                        </DragOverlay>
                    </DndContext>
                </div>
            </div>

            {/* ═══ CONTEXT MENU ═══ */}
            {contextMenu && (
                <ClipContextMenu
                    menu={contextMenu}
                    clip={contextMenuClip}
                    playheadPosition={playheadPosition}
                    onSplit={onClipSplit}
                    onDelete={onClipDelete}
                    onDuplicate={onClipDuplicate}
                    onSpeed={onClipSpeed}
                    onClose={() => setContextMenu(null)}
                />
            )}

            {/* ═══ GAP CONTEXT MENU ═══ */}
            {gapContextMenu && (
                <GapContextMenu
                    menu={gapContextMenu}
                    onRemoveGap={onRemoveGap}
                    onClose={() => setGapContextMenu(null)}
                />
            )}
        </div>
    );
}
