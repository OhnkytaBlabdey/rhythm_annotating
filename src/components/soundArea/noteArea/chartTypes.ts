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

export interface ChartSegment {
    time: number;
    tempo: number;
    measures: ChartMeasure[];
}

export interface RawChartSegment {
    time: number;
    tempo: number;
    measures?: ChartMeasure[];
    beats?: ChartMeasure[];
}

export interface NoteLaneData {
    id: string;
    division: number;
    defaultBpm: number;
    chartData: ChartSegment[];
    /** @deprecated — boundary markers are now stored as boundary notes in chartData */
    startTime?: number | null;
    /** @deprecated — boundary markers are now stored as boundary notes in chartData */
    endTime?: number | null;
    isFolded?: boolean;
    /** Schema version for migration; v2 uses boundary notes */
    dataVersion?: number;
}
