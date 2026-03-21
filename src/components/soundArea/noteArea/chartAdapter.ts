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

export function compareFractions(a: Fraction, b: Fraction): number {
    const left = a.a * b.b;
    const right = b.a * a.b;
    if (left < right) return -1;
    if (left > right) return 1;
    return 0;
}

function collectAnchors(note: ChartNote): Fraction[] {
    const out: Fraction[] = [];
    const head = normalizeFraction(note.head);
    if (head) out.push(head);
    if (Array.isArray(note.body)) {
        for (const p of note.body) {
            const n = normalizeFraction(p);
            if (n) out.push(n);
        }
    }
    const tail = normalizeFraction(note.tail);
    if (tail) out.push(tail);
    return out;
}

function isStrictlyBetween(x: Fraction, a: Fraction, b: Fraction): boolean {
    return compareFractions(x, a) > 0 && compareFractions(x, b) < 0;
}

function rangesOverlap(
    aStart: Fraction,
    aEnd: Fraction,
    bStart: Fraction,
    bEnd: Fraction,
): boolean {
    return (
        compareFractions(aStart, bEnd) < 0 && compareFractions(bStart, aEnd) < 0
    );
}

function validateMeasureNotes(notes: ChartNote[]): string | null {
    const occupiedHead = new Set<string>();

    const lnRanges: Array<{ id: string; head: Fraction; tail: Fraction }> = [];
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
            if (compareFractions(h, t) === 0) {
                return "长条 note 的 head/tail 不能重合";
            }
            lnRanges.push({ id: note.id, head: h, tail: t });
        }
    }

    for (const ln of lnRanges) {
        for (const note of notes) {
            if (note.id === ln.id) continue;

            const anchors = collectAnchors(note);
            for (const anchor of anchors) {
                if (isStrictlyBetween(anchor, ln.head, ln.tail)) {
                    return "长条 note 不能横跨其它 note";
                }
            }

            if (note.type === 2) {
                const head = normalizeFraction(note.head);
                const tail = normalizeFraction(note.tail);
                if (!head || !tail) {
                    return "长条 note 的 head/tail 非法";
                }
                if (rangesOverlap(ln.head, ln.tail, head, tail)) {
                    return "长条 note 之间不能重叠";
                }
            }
        }
    }

    return null;
}

interface AbsoluteNote {
    id: string;
    type: number;
    head: number;
    tail?: number;
    anchors: number[];
}

const TIME_EPS = 1e-6;

function nearlyEqual(a: number, b: number): boolean {
    return Math.abs(a - b) <= TIME_EPS;
}

function toAbsoluteNote(
    note: ChartNote,
    measureStart: number,
    beatDuration: number,
): AbsoluteNote | null {
    const head = normalizeFraction(note.head);
    if (!head) {
        return null;
    }
    const headTime = measureStart + (head.a / head.b) * beatDuration;

    const anchors: number[] = [headTime];
    if (Array.isArray(note.body)) {
        for (const point of note.body) {
            const n = normalizeFraction(point);
            if (!n) continue;
            anchors.push(measureStart + (n.a / n.b) * beatDuration);
        }
    }

    let tailTime: number | undefined;
    if (note.tail) {
        const tail = normalizeFraction(note.tail);
        if (tail) {
            tailTime = measureStart + (tail.a / tail.b) * beatDuration;
            anchors.push(tailTime);
        }
    }

    return {
        id: note.id,
        type: note.type,
        head: headTime,
        tail: tailTime,
        anchors,
    };
}

function collectAbsoluteNotes(chartData: ChartSegment[]): AbsoluteNote[] {
    const out: AbsoluteNote[] = [];
    const sorted = [...chartData].sort((a, b) => a.time - b.time);
    for (const segment of sorted) {
        if (!Number.isFinite(segment.tempo) || segment.tempo <= 0) {
            continue;
        }
        const beatDuration = 60 / segment.tempo;
        for (let m = 0; m < segment.measures.length; m++) {
            const measureStart = segment.time + m * beatDuration;
            const measure = segment.measures[m];
            for (const note of measure.notes) {
                const abs = toAbsoluteNote(note, measureStart, beatDuration);
                if (abs) {
                    out.push(abs);
                }
            }
        }
    }
    return out;
}

function validateGlobalAbsoluteOverlaps(
    chartData: ChartSegment[],
): string | null {
    const notes = collectAbsoluteNotes(chartData);

    const heads = notes
        .map((n) => ({ id: n.id, time: n.head }))
        .sort((a, b) => a.time - b.time);
    for (let i = 1; i < heads.length; i++) {
        if (Math.abs(heads[i].time - heads[i - 1].time) <= TIME_EPS) {
            return "存在重复时刻 note";
        }
    }

    const lnRanges = notes
        .filter((n) => n.type === 2 && n.tail !== undefined)
        .map((n) => ({
            id: n.id,
            head: n.head,
            tail: n.tail as number,
        }));

    for (let i = 0; i < lnRanges.length; i++) {
        const ln = lnRanges[i];
        for (const note of notes) {
            if (note.id === ln.id) continue;
            for (const anchor of note.anchors) {
                // LN endpoints touching any other note anchor is forbidden.
                if (
                    nearlyEqual(anchor, ln.head) ||
                    nearlyEqual(anchor, ln.tail)
                ) {
                    return "长条 note 端点不能与其它 note 重合";
                }
                if (
                    anchor > ln.head + TIME_EPS &&
                    anchor < ln.tail - TIME_EPS
                ) {
                    return "长条 note 不能横跨其它 note";
                }
            }
        }
        for (let j = i + 1; j < lnRanges.length; j++) {
            const other = lnRanges[j];
            // Any overlap including endpoint contact is forbidden.
            if (
                ln.head <= other.tail + TIME_EPS &&
                other.head <= ln.tail + TIME_EPS
            ) {
                return "长条 note 之间不能重叠";
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
    const globalMsg = validateGlobalAbsoluteOverlaps(chartData);
    if (globalMsg) {
        return globalMsg;
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

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === "object";
}

function pickImportCandidate(raw: unknown): {
    chartData: unknown;
    defaultBpm?: unknown;
    division?: unknown;
} | null {
    if (Array.isArray(raw)) {
        return {
            chartData: raw,
        };
    }

    if (!isRecord(raw)) {
        return null;
    }

    if (isRecord(raw.lane)) {
        return {
            chartData: raw.lane.chartData,
            defaultBpm: raw.lane.defaultBpm,
            division: raw.lane.division,
        };
    }

    return {
        chartData: raw.chartData,
        defaultBpm:
            raw.defaultBpm !== undefined ? raw.defaultBpm : raw.currentBpm,
        division: raw.division,
    };
}

function validateImportSegments(rawSegments: unknown): string | null {
    if (!Array.isArray(rawSegments)) {
        return "导入内容缺少 chartData 数组";
    }

    if (rawSegments.length === 0) {
        return "导入内容没有任何节拍段";
    }

    for (let index = 0; index < rawSegments.length; index++) {
        const segment = rawSegments[index];
        if (!isRecord(segment)) {
            return `第 ${index + 1} 个节拍段不是对象`;
        }
        const time = Number(segment.time);
        const tempo = Number(segment.tempo);
        if (!Number.isFinite(time) || time < 0) {
            return `第 ${index + 1} 个节拍段的 time 非法`;
        }
        if (!Number.isFinite(tempo) || tempo <= 0) {
            return `第 ${index + 1} 个节拍段的 tempo 非法`;
        }
    }

    return null;
}

export function parseImportedNoteLaneText(
    text: string,
    currentLane: NoteLaneData,
): { lane: NoteLaneData } | { error: string } {
    if (!text.trim()) {
        return { error: "导入文本为空" };
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "未知 JSON 解析错误";
        return {
            error: `JSON 解析失败: ${message}`,
        };
    }

    const candidate = pickImportCandidate(parsed);
    if (!candidate) {
        return {
            error: "仅支持内部 NoteLane JSON 或 chartData JSON",
        };
    }

    const segmentError = validateImportSegments(candidate.chartData);
    if (segmentError) {
        return { error: segmentError };
    }

    const chartData = normalizeChartSegments(
        candidate.chartData as RawChartSegment[],
    );

    if (chartData.length === 0) {
        return {
            error: "导入后没有可用的 chartData",
        };
    }

    const nextLane: NoteLaneData = {
        id: currentLane.id,
        defaultBpm:
            Number.isFinite(Number(candidate.defaultBpm)) &&
            Number(candidate.defaultBpm) > 0
                ? Math.max(1, Math.floor(Number(candidate.defaultBpm)))
                : currentLane.defaultBpm,
        division:
            Number.isFinite(Number(candidate.division)) &&
            Number(candidate.division) >= 1
                ? Math.max(1, Math.floor(Number(candidate.division)))
                : currentLane.division,
        chartData,
    };

    const validationError = validateNoteLaneData(nextLane);
    if (validationError) {
        return {
            error: validationError,
        };
    }

    return { lane: nextLane };
}
