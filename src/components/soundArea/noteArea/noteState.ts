import { ChartNote, ChartSegment } from "./chartTypes";

/** Editor interaction modes for the note lane */
export type EditMode =
    | "browse" // read-only, no interaction
    | "insert-strong" // tap note, type 0 (strong beat)
    | "insert-weak" // tap note, type 1 (weak beat)
    | "insert-ln" // long note, two-click: head then tail
    | "select" // select / drag notes
    | "paste"; // paste clipboard notes at cursor

/** Phase of long-note input (two-click workflow) */
export type LnPhase = "head" | "tail";

/** Per-noteLane edit state managed in soundLane */
export interface NoteEditState {
    mode: EditMode;
    /** IDs of currently selected notes */
    selectedIds: Set<string>;
    /** Notes copied to clipboard (time-shifted on paste) */
    clipboard: ChartNote[];
    /** For undo: stack of previous chartData states (max 50) */
    undoStack: ChartSegment[][];
    /** For redo */
    redoStack: ChartSegment[][];
    /** Current BPM used when filling virtual measures */
    currentBpm: number;
    /** LN two-click state: time of head already placed */
    lnHeadTime: number | null;
}

export function defaultNoteEditState(): NoteEditState {
    return {
        mode: "browse",
        selectedIds: new Set(),
        clipboard: [],
        undoStack: [],
        redoStack: [],
        currentBpm: 120,
        lnHeadTime: null,
    };
}

/** Snapshot format for Feature 17 – only data, no UI */
export interface NoteLaneSnapshot {
    version: 1;
    savedAt: number;
    label?: string;
    chartData: ChartSegment[];
    currentBpm: number;
}
