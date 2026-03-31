/**
 * Tests for the undo/redo system
 */

import { TimelineState, TimelineTrack, TimelineClip } from "@/lib/types/postprod";
import { MAX_UNDO_HISTORY } from "@/lib/postprod-utils";

// ── Helpers ──
function makeTimeline(overrides: Partial<TimelineState> = {}): TimelineState {
    return {
        tracks: [],
        transitions: [],
        playheadPosition: 0,
        zoom: 80,
        duration: 30,
        fps: 24,
        isPlaying: false,
        selectedClipIds: [],
        ...overrides,
    };
}

// Simulate the undo/redo logic from page.tsx
class UndoRedoManager {
    undoStack: TimelineState[] = [];
    redoStack: TimelineState[] = [];

    pushUndo(state: TimelineState) {
        this.undoStack = [state, ...this.undoStack].slice(0, MAX_UNDO_HISTORY);
        this.redoStack = [];
    }

    undo(currentState: TimelineState): TimelineState | null {
        if (this.undoStack.length === 0) return null;
        this.redoStack = [currentState, ...this.redoStack].slice(0, MAX_UNDO_HISTORY);
        const [restored, ...rest] = this.undoStack;
        this.undoStack = rest;
        return restored;
    }

    redo(currentState: TimelineState): TimelineState | null {
        if (this.redoStack.length === 0) return null;
        this.undoStack = [currentState, ...this.undoStack].slice(0, MAX_UNDO_HISTORY);
        const [restored, ...rest] = this.redoStack;
        this.redoStack = rest;
        return restored;
    }
}

describe("Undo/Redo System", () => {
    let manager: UndoRedoManager;

    beforeEach(() => {
        manager = new UndoRedoManager();
    });

    test("push and undo restores previous state", () => {
        const state1 = makeTimeline({ playheadPosition: 0 });
        const state2 = makeTimeline({ playheadPosition: 5 });

        manager.pushUndo(state1);
        const restored = manager.undo(state2);

        expect(restored).toBe(state1);
    });

    test("undo then redo restores the edit", () => {
        const state1 = makeTimeline({ playheadPosition: 0 });
        const state2 = makeTimeline({ playheadPosition: 5 });

        manager.pushUndo(state1);
        manager.undo(state2);
        const restored = manager.redo(state1);

        expect(restored).toBe(state2);
    });

    test("undo on empty stack returns null", () => {
        const state = makeTimeline();
        expect(manager.undo(state)).toBeNull();
    });

    test("redo on empty stack returns null", () => {
        const state = makeTimeline();
        expect(manager.redo(state)).toBeNull();
    });

    test("new edit clears redo stack", () => {
        const state1 = makeTimeline({ playheadPosition: 0 });
        const state2 = makeTimeline({ playheadPosition: 5 });
        const state3 = makeTimeline({ playheadPosition: 10 });

        manager.pushUndo(state1);
        manager.undo(state2); // redo now has state2
        expect(manager.redoStack).toHaveLength(1);

        manager.pushUndo(state1); // new edit after undo
        expect(manager.redoStack).toHaveLength(0); // cleared
    });

    test("undo stack limited to MAX_UNDO_HISTORY", () => {
        for (let i = 0; i < MAX_UNDO_HISTORY + 20; i++) {
            manager.pushUndo(makeTimeline({ playheadPosition: i }));
        }
        expect(manager.undoStack).toHaveLength(MAX_UNDO_HISTORY);
    });

    test("multiple undo steps work in order", () => {
        const state1 = makeTimeline({ playheadPosition: 1 });
        const state2 = makeTimeline({ playheadPosition: 2 });
        const state3 = makeTimeline({ playheadPosition: 3 });

        manager.pushUndo(state1);
        manager.pushUndo(state2);

        const r1 = manager.undo(state3);
        expect(r1?.playheadPosition).toBe(2);

        const r2 = manager.undo(r1!);
        expect(r2?.playheadPosition).toBe(1);

        expect(manager.undo(r2!)).toBeNull(); // empty
    });

    test("multiple redo steps work in order", () => {
        const state1 = makeTimeline({ playheadPosition: 1 });
        const state2 = makeTimeline({ playheadPosition: 2 });
        const state3 = makeTimeline({ playheadPosition: 3 });

        manager.pushUndo(state1);
        manager.pushUndo(state2);

        // Undo twice
        const after1 = manager.undo(state3)!;
        const after2 = manager.undo(after1)!;

        // Redo twice — redo stack is LIFO: most recent undo goes first
        const redo1 = manager.redo(after2)!;
        expect(redo1.playheadPosition).toBe(2); // state2's undo pushed after1 with pos=2

        const redo2 = manager.redo(redo1)!;
        expect(redo2.playheadPosition).toBe(3); // state3 was the current when first undo happened
    });

    test("redo stack also limited to MAX_UNDO_HISTORY", () => {
        // Fill undo stack
        for (let i = 0; i < MAX_UNDO_HISTORY + 10; i++) {
            manager.pushUndo(makeTimeline({ playheadPosition: i }));
        }
        // Undo all
        let current = makeTimeline({ playheadPosition: 999 });
        while (manager.undoStack.length > 0) {
            current = manager.undo(current)!;
        }
        expect(manager.redoStack.length).toBeLessThanOrEqual(MAX_UNDO_HISTORY);
    });
});
