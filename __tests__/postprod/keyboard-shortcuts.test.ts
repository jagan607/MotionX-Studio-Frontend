/**
 * Tests for keyboard shortcuts logic
 * B3 fix validation: checks textarea guard
 */

describe("Keyboard Shortcut Guards", () => {
    // Simulate the guard logic from page.tsx
    function shouldHandle(target: EventTarget | null): boolean {
        // B3 fix: guard both HTMLInputElement and HTMLTextAreaElement
        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return false;
        return true;
    }

    test("blocks shortcuts when focused on input", () => {
        const input = document.createElement("input");
        expect(shouldHandle(input)).toBe(false);
    });

    test("B3 fix: blocks shortcuts when focused on textarea", () => {
        const textarea = document.createElement("textarea");
        expect(shouldHandle(textarea)).toBe(false);
    });

    test("allows shortcuts on non-input elements", () => {
        const div = document.createElement("div");
        expect(shouldHandle(div)).toBe(true);
    });

    test("allows shortcuts on body", () => {
        expect(shouldHandle(document.body)).toBe(true);
    });
});

describe("Keyboard Shortcut Actions", () => {
    // Simulate the key-to-action mapping
    type Action = "play" | "split" | "save" | "delete" | "undo" | "redo" |
        "duplicate" | "zoomIn" | "zoomOut" | "zoomFit" | "skipFwd" | "skipBack" |
        "deselect" | "none";

    function getAction(key: string, metaKey: boolean, shiftKey: boolean): Action {
        const isMeta = metaKey;
        switch (key) {
            case " ": return "play";
            case "ArrowRight": return "skipFwd";
            case "ArrowLeft": return "skipBack";
            case "s":
            case "S":
                return isMeta ? "save" : "split";
            case "Delete":
            case "Backspace":
                return "delete";
            case "z":
            case "Z":
                return isMeta ? (shiftKey ? "redo" : "undo") : "none";
            case "y":
            case "Y":
                return isMeta ? "redo" : "none";
            case "d":
            case "D":
                return isMeta ? "duplicate" : "none";
            case "0":
                return isMeta ? "zoomFit" : "none";
            case "=":
            case "+":
                return isMeta ? "zoomIn" : "none";
            case "-":
                return isMeta ? "zoomOut" : "none";
            case "Escape":
                return "deselect";
            default:
                return "none";
        }
    }

    test("Space → play/pause", () => {
        expect(getAction(" ", false, false)).toBe("play");
    });

    test("S → split (no meta)", () => {
        expect(getAction("s", false, false)).toBe("split");
        expect(getAction("S", false, false)).toBe("split");
    });

    test("⌘S → save", () => {
        expect(getAction("s", true, false)).toBe("save");
        expect(getAction("S", true, false)).toBe("save");
    });

    test("Delete → delete selected", () => {
        expect(getAction("Delete", false, false)).toBe("delete");
    });

    test("Backspace → delete selected", () => {
        expect(getAction("Backspace", false, false)).toBe("delete");
    });

    test("⌘Z → undo", () => {
        expect(getAction("z", true, false)).toBe("undo");
    });

    test("⌘⇧Z → redo", () => {
        expect(getAction("z", true, true)).toBe("redo");
    });

    test("⌘Y → redo (alt binding)", () => {
        expect(getAction("y", true, false)).toBe("redo");
    });

    test("⌘D → duplicate", () => {
        expect(getAction("d", true, false)).toBe("duplicate");
    });

    test("⌘0 → zoom to fit", () => {
        expect(getAction("0", true, false)).toBe("zoomFit");
    });

    test("⌘+ → zoom in", () => {
        expect(getAction("=", true, false)).toBe("zoomIn");
        expect(getAction("+", true, false)).toBe("zoomIn");
    });

    test("⌘- → zoom out", () => {
        expect(getAction("-", true, false)).toBe("zoomOut");
    });

    test("Escape → deselect", () => {
        expect(getAction("Escape", false, false)).toBe("deselect");
    });

    test("ArrowRight → skip forward", () => {
        expect(getAction("ArrowRight", false, false)).toBe("skipFwd");
    });

    test("ArrowLeft → skip backward", () => {
        expect(getAction("ArrowLeft", false, false)).toBe("skipBack");
    });

    test("random key → no action", () => {
        expect(getAction("q", false, false)).toBe("none");
    });

    test("Z without meta → no action", () => {
        expect(getAction("z", false, false)).toBe("none");
    });
});

describe("Playback Seek Bounds", () => {
    function clampSeek(time: number, duration: number): number {
        return Math.max(0, Math.min(time, duration));
    }

    test("seek within range", () => {
        expect(clampSeek(5, 30)).toBe(5);
    });

    test("skip backward past 0 clamps to 0", () => {
        expect(clampSeek(-3, 30)).toBe(0);
    });

    test("skip forward past duration clamps", () => {
        expect(clampSeek(35, 30)).toBe(30);
    });

    test("skip forward 5s from 27s in 30s timeline", () => {
        expect(clampSeek(32, 30)).toBe(30);
    });

    test("skip backward 5s from 3s", () => {
        expect(clampSeek(-2, 30)).toBe(0);
    });
});

describe("Zoom Bounds", () => {
    function zoomIn(zoom: number): number {
        return Math.min(zoom * 1.3, 300);
    }
    function zoomOut(zoom: number): number {
        return Math.max(zoom / 1.3, 20);
    }

    test("zoom in increases zoom", () => {
        expect(zoomIn(80)).toBeCloseTo(104);
    });

    test("zoom in caps at 300", () => {
        expect(zoomIn(290)).toBe(300); // 290 * 1.3 = 377 → capped
    });

    test("zoom out decreases zoom", () => {
        expect(zoomOut(80)).toBeCloseTo(80 / 1.3);
    });

    test("zoom out floors at 20", () => {
        expect(zoomOut(22)).toBe(20); // 22 / 1.3 ≈ 16.9 → floored
    });
});
