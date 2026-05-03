import { ChartSegment, NoteLaneData } from "@/components/soundArea/noteArea/chartTypes";

function cloneChartData(chartData: ChartSegment[]): ChartSegment[] {
    return chartData.map((segment) => ({
        ...segment,
        measures: segment.measures.map((measure) => ({
            notes: measure.notes.map((note) => ({
                ...note,
                body: note.body ? [...note.body] : undefined,
            })),
        })),
    }));
}

function isMeasureEmpty(measure: { notes: unknown[] }) {
    return measure.notes.length === 0;
}

function isSegmentEmpty(segment: ChartSegment) {
    return segment.measures.every(isMeasureEmpty);
}

export function cleanChartData(
    chartData: ChartSegment[],
    defaultBpm: number,
): ChartSegment[] {
    const cleaned = cloneChartData(chartData);

    // strip trailing empty segments (keep at least one)
    while (cleaned.length > 1 && isSegmentEmpty(cleaned[cleaned.length - 1])) {
        cleaned.pop();
    }

    // strip trailing empty measures from each segment
    for (const segment of cleaned) {
        while (
            segment.measures.length > 0 &&
            isMeasureEmpty(segment.measures[segment.measures.length - 1])
        ) {
            segment.measures.pop();
        }
    }

    // if every segment is now empty, return a minimal fallback with no measures
    // so buildGridTicks will use defaultBpm for virtual rendering only
    if (cleaned.every((seg) => seg.measures.length === 0)) {
        return [
            {
                time: 0,
                tempo: defaultBpm,
                measures: [],
            },
        ];
    }

    return cleaned;
}

export function cleanNoteLaneData(lane: NoteLaneData): NoteLaneData {
    return {
        ...lane,
        chartData: cleanChartData(lane.chartData, lane.defaultBpm),
    };
}
