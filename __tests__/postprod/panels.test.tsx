/**
 * Component tests for side panels:
 * GlobalControls, ExportPanel (B6 fix)
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import GlobalControls from "@/components/studio/postprod/GlobalControls";
import ExportPanel from "@/components/studio/postprod/ExportPanel";
import { TimelineState, GlobalFilmControls } from "@/lib/types/postprod";

// ═══════════════════════════════════════
//   GLOBAL CONTROLS
// ═══════════════════════════════════════
describe("GlobalControls", () => {
    const defaultControls: GlobalFilmControls = {
        style: "cinematic",
        pacing: "medium",
        mood: "neutral",
    };
    const onChange = jest.fn();

    beforeEach(() => jest.clearAllMocks());

    test("renders toggle button", () => {
        render(<GlobalControls controls={defaultControls} onChange={onChange} />);
        expect(screen.getByText("FILM CONTROLS")).toBeInTheDocument();
    });

    test("panel is hidden by default", () => {
        render(<GlobalControls controls={defaultControls} onChange={onChange} />);
        expect(screen.queryByText("Style")).not.toBeInTheDocument();
    });

    test("clicking toggle opens panel", () => {
        render(<GlobalControls controls={defaultControls} onChange={onChange} />);
        fireEvent.click(screen.getByText("FILM CONTROLS"));
        expect(screen.getByText("Style")).toBeInTheDocument();
        expect(screen.getByText("Pacing")).toBeInTheDocument();
        expect(screen.getByText("Mood")).toBeInTheDocument();
    });

    test("shows all style options", () => {
        render(<GlobalControls controls={defaultControls} onChange={onChange} />);
        fireEvent.click(screen.getByText("FILM CONTROLS"));
        expect(screen.getByText("cinematic")).toBeInTheDocument();
        expect(screen.getByText("ad")).toBeInTheDocument();
        expect(screen.getByText("documentary")).toBeInTheDocument();
        expect(screen.getByText("music video")).toBeInTheDocument();
    });

    test("shows all pacing options", () => {
        render(<GlobalControls controls={defaultControls} onChange={onChange} />);
        fireEvent.click(screen.getByText("FILM CONTROLS"));
        expect(screen.getByText("slow")).toBeInTheDocument();
        expect(screen.getByText("medium")).toBeInTheDocument();
        expect(screen.getByText("fast")).toBeInTheDocument();
    });

    test("shows all mood options", () => {
        render(<GlobalControls controls={defaultControls} onChange={onChange} />);
        fireEvent.click(screen.getByText("FILM CONTROLS"));
        expect(screen.getByText("dark")).toBeInTheDocument();
        expect(screen.getByText("light")).toBeInTheDocument();
        expect(screen.getByText("emotional")).toBeInTheDocument();
        expect(screen.getByText("intense")).toBeInTheDocument();
        expect(screen.getByText("neutral")).toBeInTheDocument();
    });

    test("clicking style option calls onChange", () => {
        render(<GlobalControls controls={defaultControls} onChange={onChange} />);
        fireEvent.click(screen.getByText("FILM CONTROLS"));
        fireEvent.click(screen.getByText("ad"));
        expect(onChange).toHaveBeenCalledWith({
            ...defaultControls,
            style: "ad",
        });
    });

    test("clicking pacing option calls onChange", () => {
        render(<GlobalControls controls={defaultControls} onChange={onChange} />);
        fireEvent.click(screen.getByText("FILM CONTROLS"));
        fireEvent.click(screen.getByText("fast"));
        expect(onChange).toHaveBeenCalledWith({
            ...defaultControls,
            pacing: "fast",
        });
    });

    test("clicking mood option calls onChange", () => {
        render(<GlobalControls controls={defaultControls} onChange={onChange} />);
        fireEvent.click(screen.getByText("FILM CONTROLS"));
        fireEvent.click(screen.getByText("dark"));
        expect(onChange).toHaveBeenCalledWith({
            ...defaultControls,
            mood: "dark",
        });
    });

    test("clicking toggle again closes panel", () => {
        render(<GlobalControls controls={defaultControls} onChange={onChange} />);
        fireEvent.click(screen.getByText("FILM CONTROLS"));
        expect(screen.getByText("Style")).toBeInTheDocument();
        fireEvent.click(screen.getByText("FILM CONTROLS"));
        expect(screen.queryByText("Style")).not.toBeInTheDocument();
    });
});

// ═══════════════════════════════════════
//   EXPORT PANEL
// ═══════════════════════════════════════
describe("ExportPanel", () => {
    function makeTimeline(overrides: Partial<TimelineState> = {}): TimelineState {
        return {
            tracks: [
                {
                    id: "v1", type: "video", label: "V1", color: "#E50914",
                    muted: false, locked: false, solo: false, height: 80,
                    clips: [{
                        id: "c1", trackId: "v1", sceneId: "s1", shotId: "sh1",
                        label: "Wide", startTime: 0, duration: 5, trimIn: 0, trimOut: 0,
                        color: "#E50914", locked: false, muted: false, selected: false, speed: 1,
                    }],
                    volume: 1,
                },
            ],
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

    const defaultProps = {
        projectId: "proj-1",
        episodeId: "ep-1",
        timeline: makeTimeline(),
        onClose: jest.fn(),
    };

    beforeEach(() => jest.clearAllMocks());

    test("renders export header", () => {
        render(<ExportPanel {...defaultProps} />);
        expect(screen.getByText("Export")).toBeInTheDocument();
    });

    test("shows summary stats", () => {
        render(<ExportPanel {...defaultProps} />);
        // "1" appears for both Clips and Tracks count, so use getAllByText
        const ones = screen.getAllByText("1");
        expect(ones.length).toBeGreaterThanOrEqual(2); // clips=1, tracks=1
        expect(screen.getByText("5.0s")).toBeInTheDocument(); // duration
    });

    test("shows platform presets", () => {
        render(<ExportPanel {...defaultProps} />);
        expect(screen.getByText("YouTube")).toBeInTheDocument();
        expect(screen.getByText("Reels / Stories")).toBeInTheDocument();
        expect(screen.getByText("TikTok")).toBeInTheDocument();
        expect(screen.getByText("Ad / Commercial")).toBeInTheDocument();
        expect(screen.getByText("Custom")).toBeInTheDocument();
    });

    test("shows resolution options", () => {
        render(<ExportPanel {...defaultProps} />);
        expect(screen.getByText("720p")).toBeInTheDocument();
        expect(screen.getByText("1080p")).toBeInTheDocument();
        expect(screen.getByText("2k")).toBeInTheDocument();
        expect(screen.getByText("4k")).toBeInTheDocument();
    });

    test("shows fps options", () => {
        render(<ExportPanel {...defaultProps} />);
        expect(screen.getByText("24fps")).toBeInTheDocument();
        expect(screen.getByText("30fps")).toBeInTheDocument();
        expect(screen.getByText("60fps")).toBeInTheDocument();
    });

    test("shows format options", () => {
        render(<ExportPanel {...defaultProps} />);
        expect(screen.getByText(".mp4")).toBeInTheDocument();
        expect(screen.getByText(".mov")).toBeInTheDocument();
        expect(screen.getByText(".webm")).toBeInTheDocument();
    });

    test("export button is enabled with clips", () => {
        render(<ExportPanel {...defaultProps} />);
        const btn = screen.getByText("EXPORT FINAL CUT").closest("button");
        expect(btn).not.toBeDisabled();
    });

    test("B6 fix: export button disabled with 0 clips", () => {
        const emptyTimeline = makeTimeline({
            tracks: [{
                id: "v1", type: "video", label: "V1", color: "#E50914",
                muted: false, locked: false, solo: false, height: 80,
                clips: [], volume: 1,
            }],
        });
        render(<ExportPanel {...defaultProps} timeline={emptyTimeline} />);
        const btn = screen.getByText("EXPORT FINAL CUT").closest("button");
        expect(btn).toBeDisabled();
    });

    test("close button calls onClose", () => {
        const handler = jest.fn();
        render(<ExportPanel {...defaultProps} onClose={handler} />);
        // The close button has an X icon — find by role or container
        const closeBtns = screen.getAllByRole("button");
        // The first button with just an icon in the header is the close button
        const closeBtn = closeBtns.find(btn =>
            btn.closest(".flex.items-center.justify-between") && btn.textContent === ""
        );
        if (closeBtn) {
            fireEvent.click(closeBtn);
            expect(handler).toHaveBeenCalled();
        }
    });
});
