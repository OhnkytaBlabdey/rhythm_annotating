import {
    ChartMeasure,
    ChartNote,
    ChartSegment,
    RawChartSegment,
} from "./chartTypes";

let _idCounter = 0;
export function generateNoteId(): string {
    return `note_${Date.now()}_${++_idCounter}`;
}

function backfillNoteId(note: ChartNote): ChartNote {
    if (note.id && typeof note.id === "string" && note.id.length > 0) {
        return note;
    }
    return { ...note, id: generateNoteId() };
}

function sanitizeMeasures(input: ChartMeasure[] | undefined): ChartMeasure[] {
    if (!input) {
        return [];
    }

    return input.map((measure) => ({
        notes: Array.isArray(measure.notes)
            ? measure.notes.map(backfillNoteId)
            : [],
    }));
}

export function normalizeChartSegments(
    rawSegments: RawChartSegment[],
): ChartSegment[] {
    return rawSegments
        .filter(
            (segment) =>
                Number.isFinite(segment.time) && Number.isFinite(segment.tempo),
        )
        .map((segment) => {
            const measures = sanitizeMeasures(
                segment.measures ?? segment.beats,
            );

            return {
                time: segment.time,
                tempo: segment.tempo,
                measures,
            };
        })
        .sort((a, b) => a.time - b.time);
}

/** Parse a NoteLaneSnapshot (Feature 17) back into usable ChartSegment[] */
export function parseNoteLaneSnapshot(raw: unknown): ChartSegment[] {
    if (!raw || typeof raw !== "object") return [];
    const snap = raw as Record<string, unknown>;
    if (!Array.isArray(snap.chartData)) return [];
    return normalizeChartSegments(snap.chartData as RawChartSegment[]);
}
