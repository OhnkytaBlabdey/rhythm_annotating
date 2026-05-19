import {
    ChartMeasure,
    ChartNote,
    NoteLaneData,
    ChartSegment,
    RawChartSegment,
    Fraction,
    isNoteBoundary,
    NOTE_BOUNDARY_START,
    NOTE_BOUNDARY_END,
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
        if (isNoteBoundary(note)) continue;
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
                if (isNoteBoundary(note)) continue;
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
                // Exception: LN head adjacent to another LN's tail (or vice versa) is allowed.
                if (
                    nearlyEqual(anchor, ln.head) ||
                    nearlyEqual(anchor, ln.tail)
                ) {
                    if (note.type === 2 && note.tail !== undefined) {
                        const isAdjacent =
                            (nearlyEqual(anchor, ln.head) &&
                                nearlyEqual(anchor, note.tail)) ||
                            (nearlyEqual(anchor, ln.tail) &&
                                nearlyEqual(anchor, note.head));
                        if (isAdjacent) continue;
                    }
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
            // Overlap (excluding endpoint adjacency) is forbidden.
            if (
                ln.head + TIME_EPS < other.tail &&
                other.head + TIME_EPS < ln.tail
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

// ---- boundary note helpers ----

export function findBoundaryNoteTime(
    chartData: ChartSegment[],
    type: number,
): number | null {
    for (const seg of chartData) {
        if (!Number.isFinite(seg.tempo) || seg.tempo <= 0) continue;
        const bd = 60 / seg.tempo;
        for (let mi = 0; mi < seg.measures.length; mi++) {
            for (const n of seg.measures[mi].notes) {
                if (n.type === type && n.head) {
                    const head = normalizeFraction(n.head);
                    if (head) {
                        return seg.time + mi * bd + (head.a / head.b) * bd;
                    }
                }
            }
        }
    }
    return null;
}

// ---- cascade cleanup ----

export function removeTrailingEmptyMeasures(
    data: ChartSegment[],
): ChartSegment[] {
    if (data.length === 0) return [];
    const cloned = data.map((seg) => ({
        ...seg,
        measures: seg.measures.map((m) => ({ notes: [...m.notes] })),
    }));
    for (let s = cloned.length - 1; s >= 0; s--) {
        const seg = cloned[s];
        while (
            seg.measures.length > 0 &&
            seg.measures[seg.measures.length - 1].notes.every((n) =>
                isNoteBoundary(n),
            )
        ) {
            seg.measures.pop();
        }
        if (seg.measures.length === 0) {
            const poppedTempo = seg.tempo;
            cloned.pop();
            const newTail = cloned[cloned.length - 1];
            if (
                newTail &&
                Number.isFinite(newTail.tempo) &&
                Number.isFinite(poppedTempo) &&
                Math.abs(newTail.tempo - poppedTempo) > 1e-6
            ) {
                break;
            }
        } else {
            break;
        }
    }
    return cloned;
}

// ---- gap fill ----

export function fillGapBetweenMeasures(
    data: ChartSegment[],
    targetSegIdx: number,
    targetMeasureIdx: number,
    _defaultBpm: number,
): ChartSegment[] {
    void _defaultBpm;
    if (data.length === 0) return data;

    // find the last measure that has at least one regular (non-boundary) note,
    // scanning backwards from just before the target
    let lastRealSeg = -1;
    let lastRealMeasure = -1;

    for (let s = targetSegIdx; s >= 0 && lastRealSeg < 0; s--) {
        const seg = data[s];
        const endM =
            s === targetSegIdx ? targetMeasureIdx - 1 : seg.measures.length - 1;
        for (let m = endM; m >= 0; m--) {
            if (seg.measures[m].notes.some((n) => !isNoteBoundary(n))) {
                lastRealSeg = s;
                lastRealMeasure = m;
                break;
            }
        }
    }

    if (lastRealSeg < 0) return data; // no previous real measure, nothing to fill

    // check if target is adjacent (immediately after lastReal)
    if (
        targetSegIdx === lastRealSeg &&
        targetMeasureIdx === lastRealMeasure + 1
    ) {
        return data; // adjacent, no gap
    }

    // fill gap within the same segment: ensure measures exist
    // between lastRealMeasure+1 and targetMeasureIdx
    if (targetSegIdx === lastRealSeg) {
        const cloned = data.map((seg) => ({
            ...seg,
            measures: seg.measures.map((m) => ({ notes: [...m.notes] })),
        }));
        const seg = cloned[targetSegIdx];
        while (seg.measures.length < targetMeasureIdx) {
            seg.measures.push({ notes: [] });
        }
        return cloned;
    }

    // target is in a later segment — fill intermediate measures
    const cloned = data.map((seg) => ({
        ...seg,
        measures: seg.measures.map((m) => ({ notes: [...m.notes] })),
    }));

    // ensure all measures in lastReal segment from lastRealMeasure+1 onward exist
    const lastSeg = cloned[lastRealSeg];
    while (lastSeg.measures.length > lastRealMeasure + 1) {
        // measures already exist, just ensure they're there
    }

    // ensure measures in intermediate segments
    for (let s = lastRealSeg + 1; s < targetSegIdx; s++) {
        const bridgeSeg = cloned[s];
        // ensure all measures exist (they should already)
        for (let m = 0; m < bridgeSeg.measures.length; m++) {
            bridgeSeg.measures[m] = bridgeSeg.measures[m] || { notes: [] };
        }
    }

    // ensure measures up to targetMeasureIdx in target segment
    const targetSeg = cloned[targetSegIdx];
    while (targetSeg.measures.length < targetMeasureIdx) {
        targetSeg.measures.push({ notes: [] });
    }

    return cloned;
}

// ---- BPM list collection ----

export function collectMeasureTimesAndBpms(
    allLanes: NoteLaneData[],
): Array<{ time: number; bpm: number }> {
    const seen = new Set<number>();
    const out: Array<{ time: number; bpm: number }> = [];
    for (const lane of allLanes) {
        for (const seg of lane.chartData) {
            if (!Number.isFinite(seg.tempo) || seg.tempo <= 0) continue;
            const bd = 60 / seg.tempo;
            for (let mi = 0; mi < seg.measures.length; mi++) {
                const t = seg.time + mi * bd;
                const key = Math.round(t * 1000);
                if (!seen.has(key)) {
                    seen.add(key);
                    out.push({ time: t, bpm: seg.tempo });
                }
            }
        }
    }
    return out.sort((a, b) => a.time - b.time);
}

export function buildSegmentsFromMeasureList(
    measures: Array<{ time: number; bpm: number }>,
): ChartSegment[] {
    if (measures.length === 0) return [];
    const segments: ChartSegment[] = [];
    let current: ChartSegment | null = null;
    for (const { time, bpm } of measures) {
        if (
            !current ||
            Math.abs(current.tempo - bpm) > 1e-6
        ) {
            current = { time, tempo: bpm, measures: [] };
            segments.push(current);
        }
        current.measures.push({ notes: [] });
    }
    return segments;
}

// ---- migration ----

function addBoundaryNoteToChartData(
    chartData: ChartSegment[],
    time: number,
    type: number,
    defaultBpm: number,
): void {
    if (!Number.isFinite(time) || time < 0) return;

    if (chartData.length === 0) {
        chartData.push({
            time: 0,
            tempo: Math.max(1, defaultBpm),
            measures: [],
        });
    }

    if (chartData[0].time > 0) {
        chartData[0].time = 0;
    }

    // find or create the segment for this time
    let segIdx = 0;
    for (let i = chartData.length - 1; i >= 0; i--) {
        if (time >= chartData[i].time - 1e-6) {
            segIdx = i;
            break;
        }
    }

    const seg = chartData[segIdx];
    const tempo =
        Number.isFinite(seg.tempo) && seg.tempo > 0 ? seg.tempo : Math.max(1, defaultBpm);
    const bd = 60 / tempo;
    const rel = Math.max(0, time - seg.time);
    const measureIdx = Math.floor(rel / bd);

    while (seg.measures.length <= measureIdx) {
        seg.measures.push({ notes: [] });
    }

    const measureStart = seg.time + measureIdx * bd;
    const beat = (time - measureStart) / bd;

    // remove any existing boundary note of the same type
    for (const s of chartData) {
        for (const m of s.measures) {
            m.notes = m.notes.filter((n) => n.type !== type);
        }
    }

    seg.measures[measureIdx].notes.push({
        id: generateNoteId(),
        type,
        head: { a: Math.round(beat * 10000), b: 10000 },
    });
}

export function migrateNoteLaneData(lane: NoteLaneData): NoteLaneData {
    // Normalize empty segments — always run regardless of dataVersion.
    // Segments with measures:[] should have at least one empty measure so
    // that rendering / index / BPM lookup functions see them.
    let chartData = lane.chartData;
    let hasEmpty = false;
    for (const seg of chartData) {
        if (seg.measures.length === 0) {
            hasEmpty = true;
            break;
        }
    }
    if (hasEmpty) {
        chartData = chartData.map((seg) =>
            seg.measures.length === 0
                ? { ...seg, measures: [{ notes: [] }] }
                : seg,
        );
    }

    const normalized: NoteLaneData = { ...lane, chartData };

    if (normalized.dataVersion && normalized.dataVersion >= 2) {
        return normalized;
    }

    const next: NoteLaneData = {
        ...normalized,
        chartData: normalized.chartData.map((seg) => ({
            ...seg,
            measures: seg.measures.map((m) => ({ notes: [...m.notes] })),
        })),
    };

    const bpm = next.defaultBpm ?? 120;

    if (next.startTime != null) {
        addBoundaryNoteToChartData(
            next.chartData,
            next.startTime,
            NOTE_BOUNDARY_START,
            bpm,
        );
    }
    if (next.endTime != null) {
        addBoundaryNoteToChartData(
            next.chartData,
            next.endTime,
            NOTE_BOUNDARY_END,
            bpm,
        );
    }

    delete next.startTime;
    delete next.endTime;
    next.dataVersion = 3;

    return next;
}
