import {
    ChartMeasure,
    ChartNote,
    NoteLaneData,
    ChartSegment,
    ChartMeasureRef,
    RawChartSegment,
    Fraction,
    WdsNoteProperties,
    isNoteBoundary,
    NOTE_BOUNDARY_START,
    NOTE_BOUNDARY_END,
} from "./chartTypes";
import {
    getWdsScratchSpan,
    isWdsHoldType,
    isWdsBodyNoteType,
    isWdsJumpScratch,
    isWdsNoteType,
    isWdsScratchType,
    normalizeWdsJumpScratch,
} from "./wdsTypes";

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
    chartKind?: NoteLaneData["chartKind"],
): ChartSegment[] {
    rawSegments = normalizeStoredWdsRecords(rawSegments) as RawChartSegment[];
    const error = validateImportSegments(rawSegments, chartKind);
    if (error) throw new Error(error);
    // Stored times are derived; list order and tempos are the source of truth.
    return alignWdsBodyData(recomputeSegmentTimes(
        rawSegments.map((segment) => ({
            tempo: segment.tempo,
            measures: sanitizeMeasures(segment.measures ?? segment.beats),
        })),
    ));
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

/** Legacy rhythm fractions historically truncate finite numerator/denominator.
 * WDS validation and arithmetic use normalizeWdsFraction instead. */
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
    if (b === 0) return null;
    const d = gcd(a, b);
    return {
        a: a / d,
        b: b / d,
    };
}

function normalizeWdsFraction(input: Fraction | undefined): Fraction | null {
    if (!input || !Number.isSafeInteger(input.a) || !Number.isSafeInteger(input.b)) return null;
    return normalizeFraction(input);
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
    notes = notes.filter((note) => !note.wds);
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
                if (isNoteBoundary(note) || note.wds) continue;
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
    const structureError = validateImportSegments(chartData);
    if (structureError) return structureError;
    const ids = new Set<string>();
    const records = new Set<string>();
    let beat = 0;
    for (const segment of chartData) {
        if (!Array.isArray(segment.measures)) return "节拍段缺少 measures 数组";
        for (const measure of segment.measures) {
            for (const note of measure.notes) {
                if (!note.id || ids.has(note.id)) return "Note 缺少 id 或 id 重复";
                ids.add(note.id);
                if (!note.wds) continue;
                const key = [beat, fractionKey(note.head), fractionKey(note.tail),
                    note.type, note.wds.lane, note.wds.width].join(":");
                if (records.has(key)) return "存在重复的 WDS note（类型、时刻与范围相同）";
                records.add(key);
            }
            const msg = validateMeasureNotes(measure.notes);
            if (msg) {
                return msg;
            }
            beat++;
        }
    }
    const globalMsg = validateGlobalAbsoluteOverlaps(chartData);
    if (globalMsg) {
        return globalMsg;
    }
    return null;
}

export function validateNoteLaneData(lane: NoteLaneData): string | null {
    if (!isRecord(lane) || typeof lane.id !== "string" || !lane.id) return "NoteLane 缺少 id";
    const metadataError = validateLaneMetadata(lane);
    if (metadataError) return metadataError;
    if (!Number.isFinite(lane.defaultBpm) || lane.defaultBpm <= 0) {
        return "defaultBpm 非法";
    }
    if (!Number.isFinite(lane.division) || lane.division < 1) {
        return "division 非法";
    }
    const error = validateChartData(lane.chartData);
    if (error) return error;
    for (const segment of lane.chartData) {
        for (const measure of segment.measures) {
            for (const note of measure.notes) {
                if (lane.chartKind === "wds") {
                    const wdsError = validateNoteShape(note, "wds");
                    if (wdsError) return wdsError;
                }
                if (isNoteBoundary(note)) {
                    if (lane.chartKind === "wds") {
                        const head = normalizeWdsFraction(note.head)!;
                        if (head.a < 0 || head.a >= head.b) return "WDS 边界 head 必须在所属拍的 [0,1) 内";
                    }
                    continue;
                }
                if ((lane.chartKind === "wds") !== !!note.wds) {
                    return "Note 类型与 chartKind 不匹配；WDS 与节奏谱不能混用";
                }
            }
        }
    }
    return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === "object" && !Array.isArray(value);
}

function validateLaneMetadata(lane: Record<string, unknown>): string | null {
    if (lane.chartKind !== undefined && lane.chartKind !== "rhythm" && lane.chartKind !== "wds") {
        return "未知的 chartKind";
    }
    if (lane.wdsOffset !== undefined && !Number.isFinite(lane.wdsOffset)) return "wdsOffset 必须是有限秒数";
    if (lane.defaultBpm !== undefined && (typeof lane.defaultBpm !== "number" || !Number.isFinite(lane.defaultBpm) || lane.defaultBpm <= 0 || !Number.isFinite(60 / lane.defaultBpm))) return "defaultBpm 非法";
    if (lane.division !== undefined && (!Number.isFinite(lane.division) || Number(lane.division) < 1 || (lane.chartKind === "wds" && !Number.isSafeInteger(lane.division)))) return "division 非法";
    if (lane.dataVersion !== undefined && (!Number.isInteger(lane.dataVersion) || Number(lane.dataVersion) < 1 || Number(lane.dataVersion) > 4)) return "不支持的 dataVersion";
    if (lane.isFolded !== undefined && typeof lane.isFolded !== "boolean") return "isFolded 非法";
    for (const key of ["startTime", "endTime"]) {
        if (lane[key] != null && (typeof lane[key] !== "number" || !Number.isFinite(lane[key]) || Number(lane[key]) < 0)) return `${key} 非法`;
    }
    return null;
}

function validateNoteShape(value: unknown, chartKind?: NoteLaneData["chartKind"]): string | null {
    if (!isRecord(value)) return "Note 必须是对象";
    const note = value as unknown as ChartNote;
    // A legacy numeric type is not a WDS discriminator. Old rhythm projects
    // allowed extension types and non-integral fractions; preserve them verbatim.
    const wds = chartKind === "wds" || note.wds !== undefined;
    if (!wds) {
        if (!Number.isFinite(note.type)) return "Note type 必须是有限数";
        return null;
    }
    if (value.id !== undefined && (typeof value.id !== "string" || !value.id)) return "Note id 非法";
    if (!Number.isSafeInteger(note.type)) return "WDS note type 必须是整数";
    if (!isNoteBoundary(note) && !isWdsNoteType(note.type)) return `不支持的 WDS note type: ${note.type}`;
    const head = normalizeWdsFraction(note.head);
    if (!head) return "Note 缺少合法 head 分数（整数分子与非零整数分母）";
    if (note.tail !== undefined && !normalizeWdsFraction(note.tail)) return "Note tail 分数非法";
    if (note.body !== undefined && (!Array.isArray(note.body) || note.body.some((f) => !normalizeWdsFraction(f)))) return "Note body 分数数组非法";
    if (note.annotation !== undefined && typeof note.annotation !== "string") return "Note annotation 非法";
    if (head.a < 0 || head.a >= head.b) return "WDS head 必须在所属拍的 [0,1) 内";
    if (isNoteBoundary(note)) {
        if (note.wds !== undefined) return "边界标记不能包含 wds 属性";
        return null;
    }
    const p = note.wds;
    if (!isRecord(p)) return "WDS note 缺少 wds 属性";
    const fields = ["lane", "width", "gimmickType", "gimmickValue", "autoTicks"];
    if (Object.keys(p).some((key) => !fields.includes(key))) return "未知的 wds 属性";
    if (!getWdsScratchSpan(p)) return "WDS lane/width 或 JumpScratch 覆盖范围非法（1..12 列，宽度大于 0）";
    if (!["0", "1", "JumpScratch", "2", "OneDirection"].includes(p.gimmickType)) return "WDS gimmickType 非法";
    if (typeof p.autoTicks !== "boolean") return "WDS autoTicks 必须是布尔值";
    if (!isWdsScratchType(note.type) && !(isWdsHoldType(note.type) && isWdsJumpScratch(p)) && p.gimmickType !== "0") return "该 WDS 类型不支持划动 gimmick";
    if (!isWdsHoldType(note.type)) {
        if (note.tail !== undefined || (note.body?.length ?? 0) > 0 || p.autoTicks) return "WDS 点 note 不能包含长条属性";
    } else {
        const tail = normalizeWdsFraction(note.tail);
        if (!tail || compareFractions(head, tail) >= 0) return "WDS 长条必须包含晚于 head 的 tail";
        let previous = head;
        for (const anchor of note.body ?? []) {
            const f = normalizeWdsFraction(anchor)!;
            if (compareFractions(previous, f) >= 0 || compareFractions(f, tail) >= 0) return "WDS body 必须递增并严格位于 head/tail 之间";
            previous = f;
        }
    }
    return null;
}

function pickImportCandidate(raw: unknown): {
    chartData: unknown;
    defaultBpm?: unknown;
    division?: unknown;
    startTime?: unknown;
    endTime?: unknown;
    dataVersion?: unknown;
    isFolded?: unknown;
    chartKind?: unknown;
    wdsOffset?: unknown;
} | null {
    if (Array.isArray(raw)) {
        return {
            chartData: normalizeStoredWdsRecords(raw),
        };
    }

    if (!isRecord(raw)) {
        return null;
    }

    const source = normalizeStoredNoteLane(isRecord(raw.lane) ? raw.lane : raw);
    if (!isRecord(source)) return null;

    return {
        chartData: normalizeStoredWdsRecords(source.chartData),
        defaultBpm:
            source.defaultBpm !== undefined ? source.defaultBpm : source.currentBpm,
        division: source.division,
        startTime: source.startTime,
        endTime: source.endTime,
        dataVersion: source.dataVersion,
        isFolded: source.isFolded,
        chartKind: source.chartKind,
        wdsOffset: source.wdsOffset,
    };
}

function validateImportSegments(rawSegments: unknown, chartKind?: NoteLaneData["chartKind"]): string | null {
    if (!Array.isArray(rawSegments)) {
        return "导入内容缺少 chartData 数组";
    }

    for (let index = 0; index < rawSegments.length; index++) {
        const segment = rawSegments[index];
        if (!isRecord(segment)) {
            return `第 ${index + 1} 个节拍段不是对象`;
        }
        const tempo = segment.tempo;
        if (typeof tempo !== "number" || !Number.isFinite(tempo) || tempo <= 0 || !Number.isFinite(60 / tempo)) {
            return `第 ${index + 1} 个节拍段的 tempo 非法`;
        }
        if (segment.time !== undefined) {
            const time = segment.time;
            if (typeof time !== "number" || !Number.isFinite(time) || time < 0) {
                return `第 ${index + 1} 个节拍段的 time 非法`;
            }
        }
        if (segment.measures !== undefined && !Array.isArray(segment.measures)) return "measures 必须是数组";
        if (segment.beats !== undefined && !Array.isArray(segment.beats)) return "beats 必须是数组";
        const measures = segment.measures ?? segment.beats;
        if (!Array.isArray(measures)) return `第 ${index + 1} 个节拍段缺少 measures/beats 数组`;
        for (const measure of measures) {
            if (!isRecord(measure) || !Array.isArray(measure.notes)) return `第 ${index + 1} 个节拍段的 notes 结构非法`;
            for (const note of measure.notes) {
                const error = validateNoteShape(note, chartKind);
                if (error) return `第 ${index + 1} 个节拍段: ${error}`;
            }
        }
    }

    return null;
}

/** Full lane JSON uses its own kind/offset (omitted kind means legacy rhythm).
 * A bare chartData array replaces only chart content in the destination kind. */
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

    let candidate: ReturnType<typeof pickImportCandidate>;
    try {
        candidate = pickImportCandidate(parsed);
    } catch (error) {
        return { error: error instanceof Error ? error.message : "谱面存储字段读取失败" };
    }
    if (!candidate) {
        return {
            error: "仅支持内部 NoteLane JSON 或 chartData JSON",
        };
    }
    const metadataError = validateLaneMetadata(candidate);
    if (metadataError) return { error: metadataError };

    const segmentError = validateImportSegments(candidate.chartData);
    if (segmentError) {
        return { error: segmentError };
    }

    try {
        const nextLane = migrateNoteLaneData({
            id: currentLane.id,
            chartKind: Array.isArray(parsed) ? currentLane.chartKind : candidate.chartKind as NoteLaneData["chartKind"],
            wdsOffset: Array.isArray(parsed) ? currentLane.wdsOffset : candidate.wdsOffset as number | undefined,
            defaultBpm: (candidate.defaultBpm as number | undefined) ?? currentLane.defaultBpm,
            division: (candidate.division as number | undefined) ?? currentLane.division,
            chartData: normalizeChartSegments(candidate.chartData as RawChartSegment[]),
            startTime: candidate.startTime as number | null | undefined,
            endTime: candidate.endTime as number | null | undefined,
            isFolded: (candidate.isFolded as boolean | undefined) ?? currentLane.isFolded,
            dataVersion: candidate.dataVersion as number | undefined,
        });
        const validationError = validateNoteLaneData(nextLane);
        return validationError ? { error: validationError } : { lane: nextLane };
    } catch (error) {
        return { error: error instanceof Error ? error.message : "导入谱面结构非法" };
    }
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
    // Empty beats before a WDS tail still carry tempo. Never compact gaps.
    if (data.some((seg) => seg.measures.some((m) => m.notes.some((n) => n.wds)))) {
        let count = 0;
        let required = 0;
        for (const seg of data) {
            for (const measure of seg.measures) {
                for (const note of measure.notes) {
                    required = Math.max(required, count + 1);
                    const tail = normalizeFraction(note.tail);
                    if (note.wds && tail) required = Math.max(required, Math.ceil(count + tail.a / tail.b));
                }
                count++;
            }
        }
        while (cloned.length > 0) {
            const seg = cloned[cloned.length - 1];
            if (seg.measures.length === 0) {
                cloned.pop();
            } else if (count > required && seg.measures[seg.measures.length - 1].notes.length === 0) {
                seg.measures.pop();
                count--;
            } else break;
        }
        return recomputeSegmentTimes(cloned);
    }
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

    // Different segment: no gap to fill across BPM boundaries.
    // Each segment is self-contained; resolveInsertTarget already
    // ensured the target measure exists.
    return data;
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

// ---- time computation ----

export function recomputeSegmentTimes(
    segments: (Omit<ChartSegment, 'time'> & { time?: number })[],
): ChartSegment[] {
    let time = 0;
    return segments.map((seg) => {
        const beatDuration = 60 / seg.tempo;
        const segWithTime: ChartSegment = {
            time,
            tempo: seg.tempo,
            measures: seg.measures as ChartMeasure[],
        };
        time += segWithTime.measures.length * beatDuration;
        return segWithTime;
    });
}

export function stripChartDataTimes(
    chartData: ChartSegment[],
): Omit<ChartSegment, 'time'>[] {
    return chartData.map(({ time, ...rest }) => {
        void time;
        return rest;
    });
}

// ---- measure insertion / deletion ----

interface MeasureChunk {
    tempo: number;
    measures: ChartMeasure[];
}

export interface LocatedChartMeasure extends ChartMeasureRef {
    tempo: number;
    measureStart: number;
    measure: ChartMeasure;
}

export function locateMeasureByGlobalIndex(
    chartData: ChartSegment[],
    globalIndex: number,
): LocatedChartMeasure | null {
    if (!Number.isInteger(globalIndex) || globalIndex < 0) return null;

    let cumulative = 0;
    for (let s = 0; s < chartData.length; s++) {
        const seg = chartData[s];
        const tempo =
            Number.isFinite(seg.tempo) && seg.tempo > 0 ? seg.tempo : 120;
        const measureCount = seg.measures.length;
        if (globalIndex < cumulative + measureCount) {
            const measureIndex = globalIndex - cumulative;
            return {
                globalIndex,
                segmentIndex: s,
                measureIndex,
                tempo,
                measureStart: seg.time + measureIndex * (60 / tempo),
                measure: seg.measures[measureIndex],
            };
        }
        cumulative += measureCount;
    }

    return null;
}

export function locateMeasureByRef(
    chartData: ChartSegment[],
    ref: ChartMeasureRef | null | undefined,
): LocatedChartMeasure | null {
    if (!ref) return null;
    return locateMeasureByGlobalIndex(chartData, ref.globalIndex);
}

function rebuildChartSegments(chunks: MeasureChunk[], initialTime: number): ChartSegment[] {
    const rebuilt: ChartSegment[] = [];
    let nextTime = initialTime;
    for (const chunk of chunks) {
        if (chunk.measures.length === 0) continue;
        const safeTempo = chunk.tempo;
        const tail = rebuilt[rebuilt.length - 1];
        if (tail && tail.tempo === safeTempo) {
            tail.measures.push(...chunk.measures);
        } else {
            rebuilt.push({ time: nextTime, tempo: safeTempo, measures: chunk.measures });
        }
        nextTime += chunk.measures.length * (60 / safeTempo);
    }
    return rebuilt;
}

/** Pass lane.defaultBpm and lane.chartKind: empty WDS charts still own an
 * explicit tempo map. Existing two/three-argument calls remain compatible. */
export function insertMeasureAtRef(
    chartData: ChartSegment[],
    ref: ChartMeasureRef | null | undefined,
    defaultBpm = 120,
    chartKind?: "rhythm" | "wds",
): ChartSegment[] | null {
    const located = locateMeasureByRef(chartData, ref);
    if (!located) return null;
    if (chartKind === "wds" || hasWdsNotes(chartData)) {
        return editWdsBeat(chartData, located.globalIndex + 1, false, defaultBpm);
    }

    const chunks: MeasureChunk[] = [];
    const initialTime = chartData[0]?.time ?? 0;

    for (let s = 0; s < chartData.length; s++) {
        const seg = chartData[s];
        const segTempo = seg.tempo;
        if (seg.measures.length === 0) continue;
        if (s !== located.segmentIndex) {
            chunks.push({ tempo: segTempo, measures: seg.measures });
            continue;
        }

        const before = seg.measures.slice(0, located.measureIndex + 1);
        const after = seg.measures.slice(located.measureIndex + 1);
        if (before.length > 0) {
            chunks.push({ tempo: segTempo, measures: before });
        }
        chunks.push({ tempo: segTempo, measures: [{ notes: [] }] });
        if (after.length > 0) {
            chunks.push({ tempo: segTempo, measures: after });
        }
    }

    return removeTrailingEmptyMeasures(rebuildChartSegments(chunks, initialTime));
}

/** See insertMeasureAtRef for the optional defaultBpm/chartKind arguments. */
export function deleteMeasureAtRef(
    chartData: ChartSegment[],
    ref: ChartMeasureRef | null | undefined,
    defaultBpm = 120,
    chartKind?: "rhythm" | "wds",
): ChartSegment[] | null {
    const located = locateMeasureByRef(chartData, ref);
    if (!located) return null;
    if (chartKind === "wds" || hasWdsNotes(chartData)) {
        return editWdsBeat(chartData, located.globalIndex, true, defaultBpm);
    }

    const chunks: MeasureChunk[] = [];
    const initialTime = chartData[0]?.time ?? 0;

    for (let s = 0; s < chartData.length; s++) {
        const seg = chartData[s];
        const segTempo = seg.tempo;
        if (seg.measures.length === 0) continue;
        if (s !== located.segmentIndex) {
            chunks.push({ tempo: segTempo, measures: seg.measures });
            continue;
        }

        const before = seg.measures.slice(0, located.measureIndex);
        const after = seg.measures.slice(located.measureIndex + 1);
        if (before.length > 0) {
            chunks.push({ tempo: segTempo, measures: before });
        }
        if (after.length > 0) {
            chunks.push({ tempo: segTempo, measures: after });
        }
    }

    let rebuilt = rebuildChartSegments(chunks, initialTime);
    if (rebuilt.length === 0) {
        const fallbackBpm = Math.max(1, Math.floor(chartData[0]?.tempo ?? 120));
        rebuilt = [{ time: 0, tempo: fallbackBpm, measures: [{ notes: [] }] }];
    }
    return removeTrailingEmptyMeasures(rebuilt);
}

// ---- WDS musical timeline and immutable mutations ----

function assertBpm(bpm: number): void {
    if (!Number.isFinite(bpm) || bpm <= 0 || !Number.isFinite(60 / bpm)) {
        throw new Error("BPM 必须是正有限数");
    }
}

function wdsTempoMap(data: ChartSegment[], defaultBpm: number) {
    assertBpm(defaultBpm);
    if (!Array.isArray(data)) throw new Error("chartData 必须是数组");
    let beat = 0;
    let time = 0;
    const segments = data.map((seg) => {
        if (!seg || !Array.isArray(seg.measures)) throw new Error("节拍段结构非法");
        assertBpm(seg.tempo);
        const start = { beat, time, duration: 60 / seg.tempo, count: seg.measures.length };
        beat += seg.measures.length;
        time += seg.measures.length * start.duration;
        if (!Number.isFinite(time)) throw new Error("谱面时间超出范围");
        return start;
    });
    return { segments, beat, time };
}

/** List-order tempo map; the implicit tail (and negative pre-roll) uses
 * defaultBpm, even when the final stored segment has another tempo. No offsets. */
export function wdsBeatToTime(data: ChartSegment[], beat: number, defaultBpm: number): number {
    if (!Number.isFinite(beat)) throw new Error("拍数必须是有限数");
    const map = wdsTempoMap(data, defaultBpm);
    let time = beat * (60 / defaultBpm);
    if (beat >= 0) {
        const seg = map.segments.find((s) => beat < s.beat + s.count);
        time = seg ? seg.time + (beat - seg.beat) * seg.duration
            : map.time + (beat - map.beat) * (60 / defaultBpm);
    }
    if (!Number.isFinite(time)) throw new Error("谱面时间超出范围");
    return time;
}

export function wdsTimeToBeat(data: ChartSegment[], time: number, defaultBpm: number): number {
    if (!Number.isFinite(time)) throw new Error("时间必须是有限数");
    const map = wdsTempoMap(data, defaultBpm);
    let beat = time / (60 / defaultBpm);
    if (time >= 0) {
        const seg = map.segments.find((s) => time < s.time + s.count * s.duration);
        beat = seg ? seg.beat + (time - seg.time) / seg.duration
            : map.beat + (time - map.time) / (60 / defaultBpm);
    }
    if (!Number.isFinite(beat)) throw new Error("谱面拍数超出范围");
    return beat;
}

export interface CollectedWdsNote {
    note: ChartNote;
    beat: number;
    tailBeat: number | null;
    /** Global single-beat index (the legacy model calls beats measures). */
    measureIndex: number;
    segmentIndex: number;
    localMeasureIndex: number;
    time: number;
    endTime: number | null;
}

type WdsBodyRecord = Pick<CollectedWdsNote, "note" | "beat" | "tailBeat">;

function wdsBodyRecords(data: ChartSegment[]): WdsBodyRecord[] {
    let beat = 0;
    return data.flatMap((segment) => segment.measures.flatMap((measure) => {
        const owningBeat = beat++;
        return measure.notes.filter((note) => note.wds).map((note) => ({
            note, beat: owningBeat + fractionValue(note.head!),
            tailBeat: note.tail ? owningBeat + fractionValue(note.tail) : null,
        }));
    }));
}

/** Scratch/Sound records on a body inherit that body's horizontal span.
 * Prefer an exact span, then the most recently started overlapping body. */
export function findWdsNoteBody(records: readonly WdsBodyRecord[], note: ChartNote, beat: number): WdsBodyRecord | null {
    if (!isWdsBodyNoteType(note.type) || !note.wds) return null;
    const p = note.wds;
    const candidates = records.filter((record) => {
        const body = record.note.wds;
        return body && isWdsHoldType(record.note.type) && record.tailBeat !== null &&
            beat >= record.beat && beat <= record.tailBeat &&
            p.lane < body.lane + body.width && body.lane < p.lane + p.width;
    });
    const exact = (record: WdsBodyRecord) => Number(record.note.wds!.lane === p.lane && record.note.wds!.width === p.width);
    candidates.sort((a, b) => exact(b) - exact(a) || b.beat - a.beat || a.note.wds!.width - b.note.wds!.width);
    return candidates[0] ?? null;
}

export function getWdsBodyLinks(records: readonly WdsBodyRecord[], previous?: ReadonlyMap<string, string>): Map<string, string> {
    const byId = new Map(records.map((record) => [record.note.id, record]));
    const links = new Map<string, string>();
    for (const record of records) {
        if (!isWdsBodyNoteType(record.note.type)) continue;
        const prior = byId.get(previous?.get(record.note.id) ?? "");
        const body = prior && isWdsHoldType(prior.note.type) && prior.tailBeat !== null &&
            record.beat >= prior.beat && record.beat <= prior.tailBeat
            ? prior : findWdsNoteBody(records, record.note, record.beat);
        if (body) links.set(record.note.id, body.note.id);
    }
    return links;
}

export function alignWdsBodyRecords<T extends WdsBodyRecord>(records: readonly T[], previous?: ReadonlyMap<string, string>): T[] {
    const links = getWdsBodyLinks(records, previous);
    const byId = new Map(records.map((record) => [record.note.id, record]));
    return records.map((record) => {
        const body = byId.get(links.get(record.note.id) ?? "")?.note.wds;
        const p = record.note.wds;
        if (!body || !p || (p.lane === body.lane && p.width === body.width)) return record;
        return { ...record, note: { ...record.note, wds: normalizeWdsJumpScratch({ ...p, lane: body.lane, width: body.width }) } };
    });
}

/** Derived ownership is never persisted as a new schema or version. */
function alignWdsBodyData(data: ChartSegment[], before?: ChartSegment[], rebind = new Set<string>()): ChartSegment[] {
    const records = wdsBodyRecords(data);
    const previous = before ? getWdsBodyLinks(wdsBodyRecords(before)) : undefined;
    for (const id of rebind) previous?.delete(id);
    const aligned = alignWdsBodyRecords(records, previous);
    if (aligned.every((record, index) => record === records[index])) return data;
    const notes = new Map(aligned.map((record) => [record.note.id, record.note]));
    return data.map((segment) => ({ ...segment, measures: segment.measures.map((measure) => ({
        ...measure, notes: measure.notes.map((note) => notes.get(note.id) ?? note),
    })) }));
}

export function expandWdsBodySelection(records: readonly WdsBodyRecord[], ids: readonly string[]): string[] {
    const selected = new Set(ids);
    for (const [id, body] of getWdsBodyLinks(records)) {
        if (selected.has(body)) selected.add(id);
    }
    return [...selected];
}

function hasWdsNotes(data: ChartSegment[]): boolean {
    return data.some((s) => s.measures.some((m) => m.notes.some((n) => !!n.wds)));
}

function assertWdsData(data: ChartSegment[]): void {
    const structureError = validateImportSegments(data, "wds");
    if (structureError) throw new Error(structureError);
    const error = validateChartData(data);
    if (error) throw new Error(error);
    if (data.some((s) => s.measures.some((m) => m.notes.some((n) => !isNoteBoundary(n) && !n.wds)))) {
        throw new Error("WDS 编辑 API 仅适用于 WDS 谱面");
    }
}

/** Boundary markers are excluded. Returned notes reference source notes; do not mutate. */
export function collectWdsNotes(data: ChartSegment[], defaultBpm: number): CollectedWdsNote[] {
    assertWdsData(data);
    assertBpm(defaultBpm);
    const out: CollectedWdsNote[] = [];
    let measureIndex = 0;
    data.forEach((segment, segmentIndex) => {
        segment.measures.forEach((measure, localMeasureIndex) => {
            for (const note of measure.notes) {
                if (isNoteBoundary(note)) continue;
                const beat = measureIndex + fractionValue(note.head!);
                const tailBeat = note.tail ? measureIndex + fractionValue(note.tail) : null;
                out.push({
                    note, beat, tailBeat, measureIndex, segmentIndex, localMeasureIndex,
                    time: wdsBeatToTime(data, beat, defaultBpm),
                    endTime: tailBeat === null ? null : wdsBeatToTime(data, tailBeat, defaultBpm),
                });
            }
            measureIndex++;
        });
    });
    return out.sort((a, b) => a.beat - b.beat || a.note.wds!.lane - b.note.wds!.lane || a.note.type - b.note.type);
}

function fractionValue(f: Fraction): number {
    return f.a / f.b;
}

// Continued fractions recover musical divisions from numeric canvas positions.
// Stored fractions are otherwise added exactly, including clipboard body anchors.
function beatFraction(value: number): Fraction {
    if (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER) throw new Error("拍数超出范围");
    const sign = value < 0 ? -1 : 1;
    const target = Math.abs(value);
    let x = target;
    let p0 = 0, p1 = 1, q0 = 1, q1 = 0;
    for (let i = 0; i < 64; i++) {
        const whole = Math.floor(x);
        const p = whole * p1 + p0;
        const q = whole * q1 + q0;
        if (!Number.isSafeInteger(p) || !Number.isSafeInteger(q) || q > 1e9) break;
        p0 = p1; p1 = p; q0 = q1; q1 = q;
        if (Math.abs(p / q - target) <= 1e-10 || x === whole) break;
        x = 1 / (x - whole);
    }
    if (!q1 || Math.abs(p1 / q1 - target) > 1e-9) throw new Error("拍数无法表示为安全分数");
    return { a: sign * p1, b: q1 };
}

function addBeatFractions(left: Fraction, right: Fraction): Fraction {
    const a = normalizeWdsFraction(left);
    const b = normalizeWdsFraction(right);
    if (!a || !b) throw new Error("拍分数非法");
    const divisor = gcd(a.b, b.b);
    const result = normalizeWdsFraction({ a: a.a * (b.b / divisor) + b.a * (a.b / divisor), b: a.b * (b.b / divisor) });
    if (!result) throw new Error("拍分数超出安全整数范围");
    return result;
}

function shiftFraction(f: Fraction, beats: number): Fraction {
    return addBeatFractions(f, beatFraction(beats));
}

function cloneNote(note: ChartNote): ChartNote {
    return {
        ...note,
        ...(note.head ? { head: { ...note.head } } : {}),
        ...(note.tail ? { tail: { ...note.tail } } : {}),
        ...(note.body ? { body: note.body.map((f) => ({ ...f })) } : {}),
        ...(note.wds ? { wds: { ...note.wds } } : {}),
    };
}

function cloneSegments(data: ChartSegment[]): ChartSegment[] {
    return recomputeSegmentTimes(data.map((s) => ({ ...s, measures: s.measures.map((m) => ({ notes: m.notes.map(cloneNote) })) })));
}

interface PositionedWdsNote {
    note: ChartNote;
    head: Fraction;
    tail?: Fraction;
    body?: Fraction[];
}

function wdsPositions(data: ChartSegment[]): PositionedWdsNote[] {
    assertWdsData(data);
    const out: PositionedWdsNote[] = [];
    let beat = 0;
    for (const seg of data) {
        for (const measure of seg.measures) {
            for (const note of measure.notes) {
                if (!note.wds) continue;
                out.push({
                    note: cloneNote(note), head: shiftFraction(note.head!, beat),
                    tail: note.tail ? shiftFraction(note.tail, beat) : undefined,
                    body: note.body?.map((f) => shiftFraction(f, beat)),
                });
            }
            beat++;
        }
    }
    return out;
}

/** Materialize virtual beats with defaultBpm, never the last segment's tempo. */
function placeWdsNote(data: ChartSegment[], position: PositionedWdsNote, defaultBpm: number): void {
    const { note, head, tail, body } = position;
    const owningBeat = Math.floor(fractionValue(head));
    if (owningBeat < 0) throw new Error("WDS note 不能移动到第 0 拍之前");
    const required = Math.max(owningBeat + 1, tail ? Math.ceil(fractionValue(tail)) : 0);
    let count = data.reduce((sum, s) => sum + s.measures.length, 0);
    if (required - count > 1_000_000) throw new Error("一次编辑需要创建过多节拍（超过 100 万）");
    if (count < required) {
        let last = data[data.length - 1];
        if (!last || last.tempo !== defaultBpm) {
            last = { time: 0, tempo: defaultBpm, measures: [] };
            data.push(last);
        }
        while (count++ < required) last.measures.push({ notes: [] });
    }
    const placed = cloneNote(note);
    if (placed.wds) placed.wds = normalizeWdsJumpScratch(placed.wds);
    placed.head = shiftFraction(head, -owningBeat);
    placed.tail = tail ? shiftFraction(tail, -owningBeat) : undefined;
    placed.body = body?.map((f) => shiftFraction(f, -owningBeat));
    const error = validateNoteShape(placed, "wds");
    if (error) throw new Error(error);
    const target = locateMeasureByGlobalIndex(data, owningBeat);
    if (!target) throw new Error("无法定位 WDS note 所在拍");
    target.measure.notes.push(placed);
}

function finishWdsMutation(data: ChartSegment[], before?: ChartSegment[], rebind?: Set<string>): ChartSegment[] {
    const result = recomputeSegmentTimes(alignWdsBodyData(data, before, rebind));
    for (const seg of result) {
        for (const measure of seg.measures) {
            measure.notes.sort((a, b) => compareFractions(a.head!, b.head!) || (a.wds?.lane ?? 0) - (b.wds?.lane ?? 0) || a.type - b.type);
        }
    }
    assertWdsData(result);
    return result;
}

/** All WDS mutations are immutable/atomic and throw Error on invalid input.
 * beat/tailBeat are GLOBAL beats; body offsets are local to floor(beat).
 * A supplied ID is preserved; only an omitted/empty ID is generated. */
export function insertWdsNote(data: ChartSegment[], note: ChartNote, beat: number, tailBeat: number | null, defaultBpm: number): ChartSegment[] {
    assertWdsData(data);
    assertBpm(defaultBpm);
    if (!note || !isWdsNoteType(note.type)) throw new Error("只能插入已核实的 WDS note 类型");
    if (beat < 0) throw new Error("WDS note 不能插入到第 0 拍之前");
    const cloned = cloneSegments(data);
    let next = cloneNote({ ...note, id: note.id || generateNoteId() });
    const body = findWdsNoteBody(wdsBodyRecords(data), next, beat)?.note.wds;
    if (body) next = { ...next, wds: { ...next.wds!, lane: body.lane, width: body.width } };
    placeWdsNote(cloned, {
        note: next, head: beatFraction(beat),
        tail: tailBeat === null ? undefined : beatFraction(tailBeat),
        body: next.body?.map((f) => shiftFraction(f, Math.floor(beat))),
    }, defaultBpm);
    return finishWdsMutation(cloned);
}

export type WdsNoteUpdate = Partial<Omit<ChartNote, "id">> | ((note: ChartNote) => ChartNote);

/** Resizing a body preserves the tail's extra columns, not its old total width.
 * Shared by canvas resizing, linked Sound/Scratch edits and the property form. */
export function withWdsBodySpan(p: WdsNoteProperties, lane: number, width: number): WdsNoteProperties {
    const extra = isWdsJumpScratch(p) ? Math.max(0, Math.abs(p.gimmickValue) - p.width) : 0;
    return normalizeWdsJumpScratch({ ...p, lane, width,
        ...(isWdsJumpScratch(p) ? { gimmickValue: (p.gimmickValue < 0 ? -1 : 1) * (width + extra) } : {}),
    });
}

/** Width-drag projection, shared by preview and commit. Does not clamp invalid
 * spans: updateWdsNotes validates the final change atomically on pointer-up.
 * Every hold's tail edits only its gimmick; its body and times stay intact.
 * Crossing the fixed endpoint reverses the resize instead of collapsing it. */
export function resizeWdsNoteWidth(
    note: ChartNote,
    edge: "left" | "right",
    deltaColumns: number,
    part: "note" | "tail" = "note",
): ChartNote {
    if (!note.wds || !Number.isSafeInteger(deltaColumns)) throw new Error("宽度拖动参数非法");
    if (deltaColumns === 0) return note;
    const p = note.wds;
    if (part === "tail" && !isWdsHoldType(note.type)) {
        throw new Error("只有长条拥有可独立调整的尾部");
    }
    // The renderer also accepts raw scratch point records carrying a span.
    // Preserve their encoding when resizing imported data.
    if (part === "tail" || (!isWdsHoldType(note.type) && isWdsJumpScratch(p))) {
        const span = getWdsScratchSpan(p);
        if (!span) throw new Error("原有尾部范围非法");
        const target = (edge === "left" ? span.lane : span.lane + span.width - 1) + deltaColumns;
        const right = p.lane + p.width - 1;
        const leftward = edge === "left" ? target <= right : target < p.lane;
        const wds = normalizeWdsJumpScratch({ ...p,
            gimmickType: isWdsJumpScratch(p) ? p.gimmickType : "JumpScratch",
            gimmickValue: leftward ? target - right - 1 : target - p.lane + 1,
        });
        return wds.gimmickType === p.gimmickType && wds.gimmickValue === p.gimmickValue ? note : { ...note, wds };
    }
    const fixed = edge === "left" ? p.lane + p.width - 1 : p.lane;
    const target = (edge === "left" ? p.lane : p.lane + p.width - 1) + deltaColumns;
    const lane = Math.min(fixed, target), width = Math.abs(target - fixed) + 1;
    return { ...note, wds: isWdsHoldType(note.type) ? withWdsBodySpan(p, lane, width) : { ...p, lane, width } };
}

/** Updates local fractions/properties, preserving IDs. Use moveWdsNotes for
 * cross-beat motion. Property objects (including wds) are replaced whole. */
export function updateWdsNotes(data: ChartSegment[], ids: readonly string[], update: WdsNoteUpdate, defaultBpm: number): ChartSegment[] {
    assertBpm(defaultBpm);
    const selected = new Set(ids);
    const positions = wdsPositions(data).filter((p) => selected.has(p.note.id));
    const cloned = removeWdsNotes(data, ids);
    const links = getWdsBodyLinks(wdsBodyRecords(data));
    const bodySpans = new Map<string, { lane: number; width: number }>();
    const rebind = new Set<string>();
    for (const position of positions) {
        const owningBeat = Math.floor(fractionValue(position.head));
        let note = typeof update === "function" ? update(cloneNote(position.note)) : { ...position.note, ...update };
        if (note.wds) {
            const old = position.note.wds!, next = note.wds;
            const bodyWidthChanged = isWdsHoldType(note.type) && next.width !== old.width &&
                next.gimmickType === old.gimmickType && next.gimmickValue === old.gimmickValue;
            const tail = bodyWidthChanged ? withWdsBodySpan(old, next.lane, next.width) : normalizeWdsJumpScratch(next);
            note = { ...note, wds: { ...next, gimmickType: tail.gimmickType, gimmickValue: tail.gimmickValue } };
        }
        const error = validateNoteShape(note, "wds");
        if (error) throw new Error(error);
        if (!note.wds) throw new Error("更新后必须仍为 WDS note");
        if (isWdsBodyNoteType(note.type)) {
            const body = links.get(note.id);
            if (body && !selected.has(body) && fractionKey(note.head) === fractionKey(position.note.head) &&
                (note.wds.lane !== position.note.wds!.lane || note.wds.width !== position.note.wds!.width)) {
                bodySpans.set(body, { lane: note.wds.lane, width: note.wds.width });
            } else if (fractionKey(note.head) !== fractionKey(position.note.head)) rebind.add(note.id);
        }
        placeWdsNote(cloned, {
            note: { ...note, id: position.note.id }, head: shiftFraction(note.head!, owningBeat),
            tail: note.tail ? shiftFraction(note.tail, owningBeat) : undefined,
            body: note.body?.map((f) => shiftFraction(f, owningBeat)),
        }, defaultBpm);
    }
    for (const segment of cloned) for (const measure of segment.measures) {
        measure.notes = measure.notes.map((note) => {
            const span = bodySpans.get(note.id);
            return span ? { ...note, wds: withWdsBodySpan(note.wds!, span.lane, span.width) } : note;
        });
    }
    return finishWdsMutation(cloned, data, rebind);
}

/** Removing the last note retains all explicit beats/tempos for subsequent edits. */
export function removeWdsNotes(data: ChartSegment[], ids: readonly string[]): ChartSegment[] {
    assertWdsData(data);
    const selected = new Set(ids);
    const cloned = cloneSegments(data);
    for (const seg of cloned) {
        for (const measure of seg.measures) measure.notes = measure.notes.filter((n) => !n.wds || !selected.has(n.id));
    }
    return cloned;
}

/** Clipboard head/tail/body are relative to the earliest selected GLOBAL beat;
 * clipboard heads may exceed one. IDs are regenerated only on paste. */
export function copyWdsNotes(data: ChartSegment[], ids: readonly string[]): ChartNote[] {
    const selected = new Set(ids);
    const positions = wdsPositions(data).filter((p) => selected.has(p.note.id));
    positions.sort((a, b) => compareFractions(a.head, b.head));
    if (!positions.length) return [];
    const first = positions[0].head;
    const minusFirst = { a: -first.a, b: first.b };
    return positions.map((p) => ({
        ...p.note, head: addBeatFractions(p.head, minusFirst),
        tail: p.tail ? addBeatFractions(p.tail, minusFirst) : undefined,
        body: p.body?.map((f) => addBeatFractions(f, minusFirst)),
    }));
}

function moveWdsLane(note: ChartNote, laneDelta: number): ChartNote {
    if (!Number.isInteger(laneDelta)) throw new Error("列偏移必须是整数");
    if (!note.wds) throw new Error("缺少 WDS 属性");
    const wds = { ...note.wds, lane: note.wds.lane + laneDelta };
    if (!getWdsScratchSpan(wds)) throw new Error("移动后的音符或 Scratch 尾部超出 1..12 列");
    return { ...note, wds };
}

export function pasteWdsNotes(data: ChartSegment[], clipboard: readonly ChartNote[], targetBeat: number, laneDelta: number, defaultBpm: number): ChartSegment[] {
    assertWdsData(data);
    assertBpm(defaultBpm);
    if (targetBeat < 0) throw new Error("粘贴目标不能早于第 0 拍");
    const target = beatFraction(targetBeat);
    const cloned = cloneSegments(data);
    for (const original of clipboard) {
        if (!original || !normalizeWdsFraction(original.head) || fractionValue(original.head!) < 0) throw new Error("WDS 剪贴板 head 非法");
        if (!isWdsNoteType(original.type)) throw new Error("剪贴板包含不支持的 WDS 编码");
        const note = moveWdsLane(cloneNote(original), laneDelta);
        note.id = generateNoteId();
        placeWdsNote(cloned, {
            note, head: addBeatFractions(original.head!, target),
            tail: original.tail ? addBeatFractions(original.tail, target) : undefined,
            body: original.body?.map((f) => addBeatFractions(f, target)),
        }, defaultBpm);
    }
    return finishWdsMutation(cloned);
}

export function moveWdsNotes(data: ChartSegment[], ids: readonly string[], deltaBeat: number, laneDelta: number, defaultBpm: number): ChartSegment[] {
    assertBpm(defaultBpm);
    const delta = beatFraction(deltaBeat);
    const records = wdsBodyRecords(data);
    const selected = new Set(expandWdsBodySelection(records, ids));
    const positions = wdsPositions(data).filter((p) => selected.has(p.note.id));
    const cloned = removeWdsNotes(data, [...selected]);
    for (const p of positions) {
        placeWdsNote(cloned, {
            note: moveWdsLane(p.note, laneDelta), head: addBeatFractions(p.head, delta),
            tail: p.tail ? addBeatFractions(p.tail, delta) : undefined,
            body: p.body?.map((f) => addBeatFractions(f, delta)),
        }, defaultBpm);
    }
    const rebind = new Set([...getWdsBodyLinks(records)].filter(([id, body]) => selected.has(id) && !selected.has(body)).map(([id]) => id));
    return finishWdsMutation(cloned, data, rebind);
}

/** Inserting stretches only holds crossing the cut. Deleting clips holds,
 * rebases surviving heads to the cut, and removes collapsed holds/inside points.
 * Body anchors inside the removed beat are removed; surviving head settings stay. */
function editWdsBeat(data: ChartSegment[], cut: number, deleting: boolean, defaultBpm: number): ChartSegment[] {
    assertBpm(defaultBpm);
    const positions = wdsPositions(data);
    const chunks: MeasureChunk[] = [];
    let beat = 0;
    for (const seg of data) {
        const measures: ChartMeasure[] = [];
        for (const measure of seg.measures) {
            if (!deleting || beat !== cut) measures.push({ notes: measure.notes.filter((n) => !n.wds).map(cloneNote) });
            beat++;
            // Inherit the tempo of the beat immediately BEFORE the cut.
            if (!deleting && beat === cut) measures.push({ notes: [] });
        }
        chunks.push({ tempo: seg.tempo, measures });
    }
    const rebuilt = rebuildChartSegments(chunks, 0);
    const collapse = (f: Fraction) => {
        const value = fractionValue(f);
        return value >= cut + 1 ? shiftFraction(f, -1) : value >= cut ? beatFraction(cut) : f;
    };
    for (const p of positions) {
        const head = fractionValue(p.head);
        if (deleting) {
            if (!p.tail && head >= cut && head < cut + 1) continue;
            p.head = collapse(p.head);
            p.tail = p.tail ? collapse(p.tail) : undefined;
            if (p.tail && compareFractions(p.head, p.tail) >= 0) continue;
            p.body = p.body?.filter((f) => fractionValue(f) < cut || fractionValue(f) >= cut + 1)
                .map(collapse).filter((f) => compareFractions(f, p.head) > 0 && (!p.tail || compareFractions(f, p.tail) < 0));
        } else {
            p.head = shiftFraction(p.head, head >= cut ? 1 : 0);
            p.tail = p.tail ? shiftFraction(p.tail, head >= cut || fractionValue(p.tail) > cut ? 1 : 0) : undefined;
            p.body = p.body?.map((f) => shiftFraction(f, fractionValue(f) >= cut ? 1 : 0));
        }
        placeWdsNote(rebuilt, p, defaultBpm);
    }
    return finishWdsMutation(rebuilt);
}

// ---- migration ----

/** Recover grouped heads as independent points and canonicalize tail spans.
 * This runs only at the storage/import boundary, not in the runtime model.
 * Preserve explicit records, IDs and source data; repeated loads are idempotent. */
function normalizeStoredWdsRecords(raw: unknown): unknown {
    if (!Array.isArray(raw)) return raw;
    const ids = new Set<string>();
    for (const segment of raw) {
        const measures = isRecord(segment) ? segment.measures ?? segment.beats : null;
        if (!Array.isArray(measures)) continue;
        for (const measure of measures) {
            if (!isRecord(measure) || !Array.isArray(measure.notes)) continue;
            for (const note of measure.notes) {
                if (isRecord(note) && typeof note.id === "string") ids.add(note.id);
            }
        }
    }
    const splitMeasures = (value: unknown) => {
        if (!Array.isArray(value)) return value;
        return value.map((measure) => {
            if (!isRecord(measure) || !Array.isArray(measure.notes)) return measure;
            const notes = [...measure.notes];
            const independent: ChartNote[] = [];
            const cleaned = notes.map((note) => {
                if (!isRecord(note) || !isRecord(note.wds)) return note;
                const stored = note.wds as unknown as WdsNoteProperties;
                const canonical = normalizeWdsJumpScratch(stored);
                if (!("holdHeadType" in note.wds)) return canonical === stored ? note : { ...note, wds: canonical };
                const { holdHeadType, ...properties } = canonical as unknown as Record<string, unknown>;
                if (holdHeadType !== null) {
                    if (![80, 81, 82, 83].includes(holdHeadType as number) || !isWdsHoldType(Number(note.type))) {
                        throw new Error("存储的长条头记录非法");
                    }
                    const present = [...notes, ...independent].some((other) => (
                        isRecord(other) && other.type === holdHeadType && isRecord(other.wds) &&
                        other.wds.lane === properties.lane && other.wds.width === properties.width &&
                        fractionKey(other.head as Fraction) === fractionKey(note.head as Fraction)
                    ));
                    if (!present) {
                        const base = `${typeof note.id === "string" ? note.id : generateNoteId()}-head`;
                        let id = base;
                        for (let suffix = 2; ids.has(id); suffix++) id = `${base}-${suffix}`;
                        ids.add(id);
                        independent.push({
                            id, type: holdHeadType as number, head: note.head as Fraction,
                            wds: { lane: properties.lane as number, width: properties.width as number,
                                gimmickType: "0", gimmickValue: 0, autoTicks: false },
                        });
                    }
                }
                return { ...note, wds: properties };
            });
            return { ...measure, notes: [...cleaned, ...independent] };
        });
    };
    return raw.map((segment) => !isRecord(segment) ? segment : {
        ...segment,
        ...(segment.measures !== undefined ? { measures: splitMeasures(segment.measures) } : {}),
        ...(segment.beats !== undefined ? { beats: splitMeasures(segment.beats) } : {}),
    });
}

/** Stored chart-maker notes used the lane's discriminator as their property key
 * and `${chartKind}Offset` for the export offset. Normalize that layout before
 * validation. The stored discriminator is data, never a runtime alias.
 * Keep IDs, fractions, records and values verbatim; unsupported content still
 * fails validation, leaving the persisted source protected by the load guard. */
function normalizeStoredNoteLane(raw: unknown): unknown {
    // Repair the unapproved marker briefly written during the naming correction.
    // This changes no chart contents and restores the pre-existing storage marker.
    if (isRecord(raw) && raw.chartKind === "wds" && raw.dataVersion === 5) {
        return { ...raw, dataVersion: 4 };
    }
    if (!isRecord(raw) || raw.dataVersion !== 4 ||
        typeof raw.chartKind !== "string" || !raw.chartKind ||
        raw.chartKind === "rhythm" || raw.chartKind === "wds") return raw;

    const propertyKey = raw.chartKind;
    const offsetKey = `${propertyKey}Offset`;
    if (raw.wdsOffset !== undefined) throw new Error("存储的谱面包含冲突的导出偏移字段");
    if (!Array.isArray(raw.chartData)) throw new Error("存储的谱面缺少 chartData 数组");
    const chartData = raw.chartData.map((segment) => {
        if (!isRecord(segment)) throw new Error("存储的节拍段结构非法");
        const upgradeMeasures = (value: unknown) => {
            if (!Array.isArray(value)) throw new Error("存储的节拍段缺少 measures/beats 数组");
            return value.map((measure) => {
                if (!isRecord(measure) || !Array.isArray(measure.notes)) throw new Error("存储的节拍 notes 结构非法");
                return { ...measure, notes: measure.notes.map((note) => {
                    if (!isRecord(note)) throw new Error("存储的 Note 必须是对象");
                    if (note.type === NOTE_BOUNDARY_START || note.type === NOTE_BOUNDARY_END) {
                        if (note[propertyKey] !== undefined) throw new Error("存储的边界标记不能包含音符属性");
                        return { ...note };
                    }
                    if (note.wds !== undefined) throw new Error("存储的 Note 包含冲突的音符属性字段");
                    const { [propertyKey]: properties, ...rest } = note;
                    if (!isRecord(properties)) throw new Error("存储的 Note 缺少与谱面格式对应的音符属性");
                    const { gimmick, scratchLength, ...other } = properties;
                    if (other.gimmickType !== undefined || other.gimmickValue !== undefined) {
                        throw new Error("存储的 Note 包含冲突的 gimmick 字段");
                    }
                    return { ...rest, wds: { ...other, gimmickType: gimmick, gimmickValue: scratchLength } };
                }) };
            });
        };
        return { ...segment,
            ...(segment.measures !== undefined ? { measures: upgradeMeasures(segment.measures) }
                : { measures: upgradeMeasures(segment.beats) }),
            ...(segment.beats !== undefined ? { beats: upgradeMeasures(segment.beats) } : {}),
        };
    });
    const { [offsetKey]: offset, ...metadata } = raw;
    return { ...metadata, chartKind: "wds", wdsOffset: offset ?? 0, chartData };
}

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
            tempo: defaultBpm,
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
        Number.isFinite(seg.tempo) && seg.tempo > 0 ? seg.tempo : defaultBpm;
    const bd = 60 / tempo;
    const rel = Math.max(0, time - seg.time);
    // Legacy startTime/endTime migration is the only time-based measure lookup.
    const rawMeasureIdx = rel / bd;
    const roundedMeasureIdx = Math.round(rawMeasureIdx);
    const measureIdx = Math.max(
        0,
        Math.abs(rawMeasureIdx - roundedMeasureIdx) <= 1e-6
            ? roundedMeasureIdx
            : Math.floor(rawMeasureIdx),
    );

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
    // Normalize old or hand-edited lanes before interpreting derived times.
    // Segment.time is never source data; rebuild it from BPM and list order.
    const candidate = normalizeStoredNoteLane(lane);
    if (!isRecord(candidate)) throw new Error("NoteLane 必须是对象");
    const metadataError = validateLaneMetadata(candidate);
    if (metadataError) throw new Error(metadataError);
    lane = candidate as unknown as NoteLaneData;
    const chartData = normalizeChartSegments(lane.chartData, lane.chartKind);
    const normalized: NoteLaneData = {
        ...lane,
        chartData,
        dataVersion: lane.chartKind === "wds" ? 4 : (lane.dataVersion ?? 3),
    };

    const hasLegacyBoundaryTimes =
        (normalized.startTime !== null && normalized.startTime !== undefined) ||
        (normalized.endTime !== null && normalized.endTime !== undefined);

    if (
        !hasLegacyBoundaryTimes &&
        normalized.dataVersion &&
        normalized.dataVersion >= 2
    ) {
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
    next.dataVersion = next.chartKind === "wds" ? 4 : Math.max(3, next.dataVersion ?? 3);

    return next;
}
