import {
    ChartMeasure,
    ChartNote,
    NoteLaneData,
    ChartSegment,
    RawChartSegment,
    Fraction,
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

function gcd(a: number, b: number): number {
    let x = Math.abs(Math.trunc(a));
    let y = Math.abs(Math.trunc(b));
    while (y !== 0) {
        const t = x % y;
        x = y;
        y = t;
    }
    return x === 0 ? 1 : x;
}

export function normalizeFraction(
    input: Fraction | undefined,
): Fraction | null {
    if (
        !input ||
        !Number.isFinite(input.a) ||
        !Number.isFinite(input.b) ||
        input.b === 0
    ) {
        return null;
    }

    const sign = input.b < 0 ? -1 : 1;
    const a = Math.trunc(input.a) * sign;
    const b = Math.abs(Math.trunc(input.b));
    const d = gcd(a, b);
    return {
        a: a / d,
        b: b / d,
    };
}

function fractionKey(input: Fraction | undefined): string | null {
    const f = normalizeFraction(input);
    if (!f) return null;
    return `${f.a}/${f.b}`;
}

function validateMeasureNotes(notes: ChartNote[]): string | null {
    const occupiedHead = new Set<string>();
    for (const note of notes) {
        const head = fractionKey(note.head);
        if (!head) {
            return "Note 缺少合法头部时刻";
        }
        if (occupiedHead.has(head)) {
            return "同一单拍中存在重复时刻 note";
        }
        occupiedHead.add(head);

        const hasTail = note.tail !== undefined;
        if (note.type === 2) {
            if (!hasTail) {
                return "长条 note 必须包含 tail";
            }
            const h = normalizeFraction(note.head);
            const t = normalizeFraction(note.tail);
            if (!h || !t) {
                return "长条 note 的 head/tail 非法";
            }
            if (h.a * t.b > t.a * h.b) {
                return "长条 note 的 tail 不能早于 head";
            }
        }
    }
    return null;
}

export function validateChartData(chartData: ChartSegment[]): string | null {
    for (const segment of chartData) {
        for (const measure of segment.measures) {
            const msg = validateMeasureNotes(measure.notes);
            if (msg) {
                return msg;
            }
        }
    }
    return null;
}

export function validateNoteLaneData(lane: NoteLaneData): string | null {
    if (!lane.id) return "NoteLane 缺少 id";
    if (!Number.isFinite(lane.defaultBpm) || lane.defaultBpm <= 0) {
        return "defaultBpm 非法";
    }
    if (!Number.isFinite(lane.division) || lane.division < 1) {
        return "division 非法";
    }
    return validateChartData(lane.chartData);
}
