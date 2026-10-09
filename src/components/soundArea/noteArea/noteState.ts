import { ChartNote, ChartSegment } from "./chartTypes";
import { defaultSiriusProperties, type SiriusNoteProperties } from "./siriusTypes";

/** Editor interaction modes for the note lane */
export type EditMode =
    | "browse" // read-only browsing
    | "insert-strong" // tap note, type 0 (strong beat)
    | "insert-weak" // tap note, type 1 (weak beat)
    | "insert-ln" // long note, two-click: head then tail
    | "insert-sirius" // Sirius point or grouped hold (head, then tail)
    | "select" // select / drag notes
    | "paste" // paste clipboard notes at cursor
    | "insert-start" // set start marker
    | "insert-end" // set end marker
    | "annotate"; // edit annotation text

/** Phase of long-note input (two-click workflow) */
export type LnPhase = "head" | "tail";

/** Per-noteLane edit state managed in soundLane */
export interface NoteEditState {
    mode: EditMode;
    /** IDs of currently selected notes */
    selectedIds: Set<string>;
    /** Clipboard notes; Sirius head/tail/body use relative global beats. */
    clipboard: ChartNote[];
    /** For undo: stack of previous chartData states (max 50) */
    undoStack: ChartSegment[][];
    /** For redo */
    redoStack: ChartSegment[][];
    /** Current BPM used when filling virtual measures */
    currentBpm: number;
    /** LN two-click state: time of head already placed */
    lnHeadTime: number | null;
    /** Current Sirius registry code and complete insertion properties. */
    siriusType: number;
    siriusProperties: SiriusNoteProperties;
}

export function defaultNoteEditState(currentBpm = 120): NoteEditState {
    return {
        mode: "browse",
        selectedIds: new Set(),
        clipboard: [],
        undoStack: [],
        redoStack: [],
        currentBpm,
        lnHeadTime: null,
        siriusType: 10,
        siriusProperties: defaultSiriusProperties(10),
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
