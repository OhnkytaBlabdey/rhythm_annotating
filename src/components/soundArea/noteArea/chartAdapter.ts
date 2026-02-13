import { ChartMeasure, ChartSegment, RawChartSegment } from "./chartTypes";

function sanitizeMeasures(input: ChartMeasure[] | undefined): ChartMeasure[] {
    if (!input) {
        return [];
    }

    return input.map((measure) => ({
        notes: Array.isArray(measure.notes) ? measure.notes : [],
    }));
}

export function normalizeChartSegments(rawSegments: RawChartSegment[]): ChartSegment[] {
    return rawSegments
        .filter((segment) => Number.isFinite(segment.time) && Number.isFinite(segment.tempo))
        .map((segment) => {
            const measures = sanitizeMeasures(segment.measures ?? segment.beats);

            return {
                time: segment.time,
                tempo: segment.tempo,
                measures,
            };
        })
        .sort((a, b) => a.time - b.time);
}
