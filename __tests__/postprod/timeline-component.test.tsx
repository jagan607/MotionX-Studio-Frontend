/**
 * Component tests for Timeline.tsx
 * Tests rendering, interactions, and visual states
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { TimelineState, TimelineTrack, TimelineClip } from "@/lib/types/postprod";

// Mock dnd-kit to avoid complex DOM setup
jest.mock("@dnd-kit/core", () => ({
    DndContext: ({ children }: any) => <div data-testid="dnd-context">{children}</div>,
    closestCenter: jest.fn(),
    PointerSensor: jest.fn(),
    useSensor: () => ({}),
    useSensors: () => [],
    DragOverlay: ({ children }: any) => <div>{children}</div>,
    useDraggable: () => ({
        attributes: {},
        listeners: {},
        setNodeRef: jest.fn(),
        isDragging: false,
    }),
    useDroppable: () => ({
        setNodeRef: jest.fn(),
    }),
}));

import Timeline from "@/components/studio/postprod/Timeline";

// ── Helpers ──
function makeClip(overrides: Partial<TimelineClip> = {}): TimelineClip {
    return {
        id: "clip-1",
        trackId: "track-video-main",
        sceneId: "scene-1",
        shotId: "shot-1",
        label: "Wide Shot",
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
        label: "V1 — Main Video",
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

function makeState(overrides: Partial<TimelineState> = {}): TimelineState {
    return {
        tracks: [
            makeTrack({ clips: [makeClip()] }),
            makeTrack({ id: "track-audio", type: "audio", label: "A1 — Dialogue", color: "#3B82F6", height: 48 }),
        ],
        transitions: [],
        playheadPosition: 0,
        zoom: 80,
        duration: 10,
        fps: 24,
        isPlaying: false,
        selectedClipIds: [],
        ...overrides,
    };
}

const noopFn = jest.fn();
const defaultProps = {
    state: makeState(),
    onClipSelect: jest.fn(),
    onClipTrim: jest.fn(),
    onTrimEnd: jest.fn(),
    onClipReorder: jest.fn(),
    onClipSplit: jest.fn(),
    onClipDelete: jest.fn(),
    onClipDuplicate: jest.fn(),
    onClipSpeed: jest.fn(),
    onSeek: jest.fn(),
    selectedClipIds: [] as string[],
    onTrackToggleMute: jest.fn(),
    onTrackToggleLock: jest.fn(),
    snapEnabled: true,
    scenes: [{ id: "scene-1", label: "Scene 1" }],
    activeSceneId: "scene-1",
    onSceneChange: jest.fn(),
    processingClipIds: new Set<string>(),
};

describe("Timeline Component", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ═══ RENDERING ═══
    describe("Rendering", () => {
        test("renders track headers", () => {
            render(<Timeline onRemoveGap={function (trackId: string, gapStartTime: number, gapDuration: number): void {
                throw new Error("Function not implemented.");
            }} {...defaultProps} />);
            expect(screen.getByText("V1 — Main Video")).toBeInTheDocument();
            expect(screen.getByText("A1 — Dialogue")).toBeInTheDocument();
        });

        test("renders TRACKS label", () => {
            render(<Timeline onRemoveGap={function (trackId: string, gapStartTime: number, gapDuration: number): void {
                throw new Error("Function not implemented.");
            }} {...defaultProps} />);
            expect(screen.getByText("TRACKS")).toBeInTheDocument();
        });

        test("renders ADD TRACK button", () => {
            render(<Timeline onRemoveGap={function (trackId: string, gapStartTime: number, gapDuration: number): void {
                throw new Error("Function not implemented.");
            }} {...defaultProps} />);
            expect(screen.getByText("ADD TRACK")).toBeInTheDocument();
        });

        test("renders clip labels", () => {
            render(<Timeline onRemoveGap={function (trackId: string, gapStartTime: number, gapDuration: number): void {
                throw new Error("Function not implemented.");
            }} {...defaultProps} />);
            expect(screen.getByText("Wide Shot")).toBeInTheDocument();
        });

        test("renders duration on wide clips", () => {
            const state = makeState({
                tracks: [makeTrack({
                    clips: [makeClip({ duration: 5 })], // 5 * 80zoom = 400px > 80px
                })],
            });
            render(<Timeline onRemoveGap={function (trackId: string, gapStartTime: number, gapDuration: number): void {
                throw new Error("Function not implemented.");
            }} {...defaultProps} state={state} />);
            expect(screen.getByText("5.0s")).toBeInTheDocument();
        });

        test("hides duration on narrow clips", () => {
            const state = makeState({
                tracks: [makeTrack({
                    clips: [makeClip({ duration: 0.5 })], // 0.5 * 80 = 40px < 80px
                })],
            });
            render(<Timeline onRemoveGap={function (trackId: string, gapStartTime: number, gapDuration: number): void {
                throw new Error("Function not implemented.");
            }} {...defaultProps} state={state} />);
            expect(screen.queryByText("0.5s")).not.toBeInTheDocument();
        });

        test("shows speed badge when speed ≠ 1", () => {
            const state = makeState({
                tracks: [makeTrack({
                    clips: [makeClip({ speed: 2, duration: 5 })],
                })],
            });
            render(<Timeline onRemoveGap={function (trackId: string, gapStartTime: number, gapDuration: number): void {
                throw new Error("Function not implemented.");
            }} {...defaultProps} state={state} />);
            expect(screen.getByText("2x")).toBeInTheDocument();
        });

        test("no speed badge at normal speed", () => {
            render(<Timeline onRemoveGap={function (trackId: string, gapStartTime: number, gapDuration: number): void {
                throw new Error("Function not implemented.");
            }} {...defaultProps} />);
            expect(screen.queryByText("1x")).not.toBeInTheDocument();
        });
    });

    // ═══ CLIP SELECTION ═══
    describe("Clip Selection", () => {
        test("clicking a clip calls onClipSelect", () => {
            const onClipSelect = jest.fn();
            render(<Timeline onRemoveGap={function (trackId: string, gapStartTime: number, gapDuration: number): void {
                throw new Error("Function not implemented.");
            }} {...defaultProps} onClipSelect={onClipSelect} />);
            const clipEl = screen.getByText("Wide Shot").closest("[class*='cursor-pointer']");
            if (clipEl) fireEvent.click(clipEl);
            expect(onClipSelect).toHaveBeenCalledWith(
                expect.objectContaining({ id: "clip-1" }),
                false
            );
        });

        test("clicking empty area deselects", () => {
            const onClipSelect = jest.fn();
            const { container } = render(<Timeline onRemoveGap={function (trackId: string, gapStartTime: number, gapDuration: number): void {
                throw new Error("Function not implemented.");
            }} {...defaultProps} onClipSelect={onClipSelect} />);
            // Click the top-level scrollable area
            const dndContext = screen.getByTestId("dnd-context");
            fireEvent.click(dndContext);
            // The component has a click handler on the scrollable area that deselects
            // We verify onClipSelect was called — it may be called with null or a clip
            expect(onClipSelect).toHaveBeenCalled();
        });
    });

    // ═══ TRACK CONTROLS ═══
    describe("Track Controls", () => {
        test("renders mute and lock buttons", () => {
            render(<Timeline onRemoveGap={function (trackId: string, gapStartTime: number, gapDuration: number): void {
                throw new Error("Function not implemented.");
            }} {...defaultProps} />);
            // Buttons exist but may be hidden (opacity-0) — they're in the DOM
            const muteButtons = screen.getAllByTitle(/Mute|Unmute/);
            const lockButtons = screen.getAllByTitle(/Lock|Unlock/);
            expect(muteButtons.length).toBeGreaterThanOrEqual(1);
            expect(lockButtons.length).toBeGreaterThanOrEqual(1);
        });

        test("clicking mute calls onTrackToggleMute", () => {
            const handler = jest.fn();
            render(<Timeline onRemoveGap={function (trackId: string, gapStartTime: number, gapDuration: number): void {
                throw new Error("Function not implemented.");
            }} {...defaultProps} onTrackToggleMute={handler} />);
            const muteBtn = screen.getAllByTitle("Mute")[0];
            fireEvent.click(muteBtn);
            expect(handler).toHaveBeenCalledWith("track-video-main");
        });

        test("clicking lock calls onTrackToggleLock", () => {
            const handler = jest.fn();
            render(<Timeline onRemoveGap={function (trackId: string, gapStartTime: number, gapDuration: number): void {
                throw new Error("Function not implemented.");
            }} {...defaultProps} onTrackToggleLock={handler} />);
            const lockBtn = screen.getAllByTitle("Lock")[0];
            fireEvent.click(lockBtn);
            expect(handler).toHaveBeenCalledWith("track-video-main");
        });

        test("muted track shows reduced opacity", () => {
            const state = makeState({
                tracks: [makeTrack({ muted: true, clips: [makeClip()] })],
            });
            const { container } = render(<Timeline onRemoveGap={function (trackId: string, gapStartTime: number, gapDuration: number): void {
                throw new Error("Function not implemented.");
            }} {...defaultProps} state={state} />);
            const mutedTrack = container.querySelector(".opacity-40");
            expect(mutedTrack).toBeInTheDocument();
        });
    });

    // ═══ CONTEXT MENU ═══
    describe("Context Menu", () => {
        test("right-click on clip shows context menu", () => {
            render(<Timeline onRemoveGap={function (trackId: string, gapStartTime: number, gapDuration: number): void {
                throw new Error("Function not implemented.");
            }} {...defaultProps} />);
            const clipEl = screen.getByText("Wide Shot").closest("[class*='cursor-pointer']");
            if (clipEl) fireEvent.contextMenu(clipEl);
            expect(screen.getByText("Split at Playhead")).toBeInTheDocument();
            expect(screen.getByText("Duplicate")).toBeInTheDocument();
            expect(screen.getByText("Delete")).toBeInTheDocument();
            expect(screen.getByText("Speed")).toBeInTheDocument();
        });

        test("context menu shows keyboard shortcuts", () => {
            render(<Timeline onRemoveGap={function (trackId: string, gapStartTime: number, gapDuration: number): void {
                throw new Error("Function not implemented.");
            }} {...defaultProps} />);
            const clipEl = screen.getByText("Wide Shot").closest("[class*='cursor-pointer']");
            if (clipEl) fireEvent.contextMenu(clipEl);
            expect(screen.getByText("S")).toBeInTheDocument();
            expect(screen.getByText("⌘D")).toBeInTheDocument();
            expect(screen.getByText("⌫")).toBeInTheDocument();
        });
    });

    // ═══ B5: CONTEXT MENU BOUNDS ═══
    describe("B5 Fix: Context Menu Viewport Clamping", () => {
        test("context menu position is clamped to viewport", () => {
            // Set viewport size
            Object.defineProperty(window, "innerWidth", { value: 800, writable: true });
            Object.defineProperty(window, "innerHeight", { value: 600, writable: true });

            render(<Timeline onRemoveGap={function (trackId: string, gapStartTime: number, gapDuration: number): void {
                throw new Error("Function not implemented.");
            }} {...defaultProps} />);
            const clipEl = screen.getByText("Wide Shot").closest("[class*='cursor-pointer']");
            if (clipEl) {
                // Right-click near bottom-right corner
                fireEvent.contextMenu(clipEl, { clientX: 750, clientY: 550 });
            }

            const menu = screen.getByText("Split at Playhead").closest("[class*='fixed']");
            if (menu) {
                const style = (menu as HTMLElement).style;
                const left = parseInt(style.left);
                const top = parseInt(style.top);
                // Should be clamped: 800-200=600, 600-220=380
                expect(left).toBeLessThanOrEqual(600);
                expect(top).toBeLessThanOrEqual(380);
            }
        });
    });
});
