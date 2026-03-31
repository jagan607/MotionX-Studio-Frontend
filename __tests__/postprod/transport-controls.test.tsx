/**
 * Component tests for TransportControls.tsx
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import TransportControls from "@/components/studio/postprod/TransportControls";

const formatTimecode = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const f = Math.floor((secs % 1) * 24);
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}:${String(f).padStart(2, "0")}`;
};

const defaultProps = {
    isPlaying: false,
    currentTime: 0,
    duration: 30,
    zoom: 80,
    onTogglePlay: jest.fn(),
    onSeek: jest.fn(),
    onSkipForward: jest.fn(),
    onSkipBackward: jest.fn(),
    onZoomIn: jest.fn(),
    onZoomOut: jest.fn(),
    onZoomToFit: jest.fn(),
    onSplit: jest.fn(),
    onDelete: jest.fn(),
    onUndo: jest.fn(),
    onRedo: jest.fn(),
    onDuplicate: jest.fn(),
    snapEnabled: true,
    onToggleSnap: jest.fn(),
    canUndo: true,
    canRedo: true,
    hasSelection: true,
    formatTimecode,
};

describe("TransportControls Component", () => {
    beforeEach(() => jest.clearAllMocks());

    // ═══ TIMECODES ═══
    describe("Timecode Display", () => {
        test("shows current time", () => {
            render(<TransportControls {...defaultProps} currentTime={5.5} />);
            expect(screen.getByText("00:05:12")).toBeInTheDocument(); // 5.5s = 00:05:12 at 24fps
        });

        test("shows total duration", () => {
            render(<TransportControls {...defaultProps} duration={65} />);
            expect(screen.getByText("01:05:00")).toBeInTheDocument();
        });
    });

    // ═══ PLAY BUTTON ═══
    describe("Play Button", () => {
        test("shows play icon when paused", () => {
            render(<TransportControls {...defaultProps} isPlaying={false} />);
            const playBtn = screen.getByTitle("Play/Pause (Space)");
            expect(playBtn).toBeInTheDocument();
        });

        test("clicking play button calls onTogglePlay", () => {
            const handler = jest.fn();
            render(<TransportControls {...defaultProps} onTogglePlay={handler} />);
            fireEvent.click(screen.getByTitle("Play/Pause (Space)"));
            expect(handler).toHaveBeenCalledTimes(1);
        });
    });

    // ═══ SKIP BUTTONS ═══
    describe("Skip Buttons", () => {
        test("skip forward button works", () => {
            const handler = jest.fn();
            render(<TransportControls {...defaultProps} onSkipForward={handler} />);
            fireEvent.click(screen.getByTitle("Skip Forward (→)"));
            expect(handler).toHaveBeenCalledTimes(1);
        });

        test("skip backward button works", () => {
            const handler = jest.fn();
            render(<TransportControls {...defaultProps} onSkipBackward={handler} />);
            fireEvent.click(screen.getByTitle("Skip Back (←)"));
            expect(handler).toHaveBeenCalledTimes(1);
        });
    });

    // ═══ DISABLED STATES ═══
    describe("Disabled States", () => {
        test("undo button disabled when canUndo=false", () => {
            render(<TransportControls {...defaultProps} canUndo={false} />);
            const btn = screen.getByTitle("Undo (⌘Z)");
            expect(btn).toBeDisabled();
        });

        test("redo button disabled when canRedo=false", () => {
            render(<TransportControls {...defaultProps} canRedo={false} />);
            const btn = screen.getByTitle("Redo (⌘⇧Z)");
            expect(btn).toBeDisabled();
        });

        test("delete button disabled when no selection", () => {
            render(<TransportControls {...defaultProps} hasSelection={false} />);
            const btn = screen.getByTitle("Delete Selected (⌫)");
            expect(btn).toBeDisabled();
        });

        test("duplicate button disabled when no selection", () => {
            render(<TransportControls {...defaultProps} hasSelection={false} />);
            const btn = screen.getByTitle("Duplicate (⌘D)");
            expect(btn).toBeDisabled();
        });

        test("undo button enabled when canUndo=true", () => {
            render(<TransportControls {...defaultProps} canUndo={true} />);
            const btn = screen.getByTitle("Undo (⌘Z)");
            expect(btn).not.toBeDisabled();
        });
    });

    // ═══ EDIT TOOLS ═══
    describe("Edit Tools", () => {
        test("split button calls onSplit", () => {
            const handler = jest.fn();
            render(<TransportControls {...defaultProps} onSplit={handler} />);
            fireEvent.click(screen.getByTitle("Split at Playhead (S)"));
            expect(handler).toHaveBeenCalledTimes(1);
        });

        test("delete button calls onDelete", () => {
            const handler = jest.fn();
            render(<TransportControls {...defaultProps} onDelete={handler} />);
            fireEvent.click(screen.getByTitle("Delete Selected (⌫)"));
            expect(handler).toHaveBeenCalledTimes(1);
        });

        test("duplicate button calls onDuplicate", () => {
            const handler = jest.fn();
            render(<TransportControls {...defaultProps} onDuplicate={handler} />);
            fireEvent.click(screen.getByTitle("Duplicate (⌘D)"));
            expect(handler).toHaveBeenCalledTimes(1);
        });
    });

    // ═══ SNAP TOGGLE ═══
    describe("Snap Toggle", () => {
        test("shows snap ON state", () => {
            render(<TransportControls {...defaultProps} snapEnabled={true} />);
            expect(screen.getByTitle("Snap ON")).toBeInTheDocument();
        });

        test("shows snap OFF state", () => {
            render(<TransportControls {...defaultProps} snapEnabled={false} />);
            expect(screen.getByTitle("Snap OFF")).toBeInTheDocument();
        });

        test("clicking snap calls onToggleSnap", () => {
            const handler = jest.fn();
            render(<TransportControls {...defaultProps} onToggleSnap={handler} />);
            fireEvent.click(screen.getByTitle("Snap ON"));
            expect(handler).toHaveBeenCalledTimes(1);
        });
    });

    // ═══ ZOOM CONTROLS ═══
    describe("Zoom Controls", () => {
        test("zoom in button works", () => {
            const handler = jest.fn();
            render(<TransportControls {...defaultProps} onZoomIn={handler} />);
            fireEvent.click(screen.getByTitle("Zoom In (⌘+)"));
            expect(handler).toHaveBeenCalledTimes(1);
        });

        test("zoom out button works", () => {
            const handler = jest.fn();
            render(<TransportControls {...defaultProps} onZoomOut={handler} />);
            fireEvent.click(screen.getByTitle("Zoom Out (⌘-)"));
            expect(handler).toHaveBeenCalledTimes(1);
        });

        test("zoom to fit button works", () => {
            const handler = jest.fn();
            render(<TransportControls {...defaultProps} onZoomToFit={handler} />);
            fireEvent.click(screen.getByTitle("Zoom to Fit (⌘0)"));
            expect(handler).toHaveBeenCalledTimes(1);
        });

        test("loop button shows hint when no clip selected", () => {
            render(<TransportControls {...defaultProps} />);
            const btn = screen.getByTitle("Loop (select a clip)");
            expect(btn).toBeInTheDocument();
        });

        test("loop button is active when clip is looping", () => {
            render(<TransportControls {...defaultProps} loopingClipName="Shot 1" loopClipTime={{ elapsed: 1, total: 3 }} />);
            const btn = screen.getByTitle("Looping: Shot 1");
            expect(btn).toBeInTheDocument();
            expect(screen.getByText(/LOOP: Shot 1/)).toBeInTheDocument();
        });
    });

    // ═══ ZOOM SLIDER ═══
    describe("Zoom Slider", () => {
        test("slider reflects zoom level at min", () => {
            const { container } = render(<TransportControls {...defaultProps} zoom={20} />);
            const slider = container.querySelector(".bg-neutral-500");
            expect(slider).toHaveStyle({ width: "0%" });
        });

        test("slider reflects zoom level at max", () => {
            const { container } = render(<TransportControls {...defaultProps} zoom={300} />);
            const slider = container.querySelector(".bg-neutral-500");
            expect(slider).toHaveStyle({ width: "100%" });
        });

        test("slider reflects zoom level at midpoint", () => {
            const midZoom = (300 + 20) / 2; // 160
            const expectedWidth = ((midZoom - 20) / (300 - 20)) * 100;
            const { container } = render(<TransportControls {...defaultProps} zoom={midZoom} />);
            const slider = container.querySelector(".bg-neutral-500");
            expect(slider).toHaveStyle({ width: `${expectedWidth}%` });
        });
    });
});
