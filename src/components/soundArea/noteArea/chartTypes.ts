import type { WdsNoteProperties } from "./wdsTypes";
export type { WdsNoteProperties } from "./wdsTypes";

export interface Fraction {
    a: number;
    b: number;
}

export const NOTE_STRONG = 0;
export const NOTE_WEAK = 1;
export const NOTE_LN = 2;
export const NOTE_BOUNDARY_START = -1;
export const NOTE_BOUNDARY_END = -2;

export interface ChartNote {
    id: string;
    type: number;
    head?: Fraction;
    body?: Fraction[];
    tail?: Fraction;
    annotation?: string;
    /** Required for WDS notes. head is local [0, 1); tail/body
     * are musical beat offsets from the same owning beat, across BPM changes. */
    wds?: WdsNoteProperties;
}

export function isNoteBoundary(note: ChartNote): boolean {
    return note.type === NOTE_BOUNDARY_START || note.type === NOTE_BOUNDARY_END;
}

export function isNoteRegular(note: ChartNote): boolean {
    return !isNoteBoundary(note);
}

export interface ChartMeasure {
    notes: ChartNote[];
}

export interface ChartMeasureRef {
    /** 0-based measure index across the note lane's chartData list. */
    globalIndex: number;
    /** Segment index in the current chartData list, used as a fast path only. */
    segmentIndex: number;
    /** Measure index inside segmentIndex, used as a fast path only. */
    measureIndex: number;
}

export interface ChartSegment {
    time: number;
    tempo: number;
    measures: ChartMeasure[];
}

export interface RawChartSegment {
    time?: number;
    tempo: number;
    measures?: ChartMeasure[];
    beats?: ChartMeasure[];
}

export interface NoteLaneData {
    id: string;
    /** Omitted on legacy rhythm charts; independent of audio and UI offsets. */
    chartKind?: "rhythm" | "wds";
    /** User-explicit WDS export time offset in seconds (default 0). */
    wdsOffset?: number;
    division: number;
    defaultBpm: number;
    chartData: ChartSegment[];
    /** @deprecated — boundary markers are now stored as boundary notes in chartData */
    startTime?: number | null;
    /** @deprecated — boundary markers are now stored as boundary notes in chartData */
    endTime?: number | null;
    isFolded?: boolean;
    /** Internal storage marker; independent of the application release version. */
    dataVersion?: number;
}
