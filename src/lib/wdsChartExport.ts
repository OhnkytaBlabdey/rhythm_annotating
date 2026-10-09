import type { ChartNote, Fraction, NoteLaneData } from "@/components/soundArea/noteArea/chartTypes";
import { isNoteBoundary } from "@/components/soundArea/noteArea/chartTypes";
import { collectWdsNotes, validateNoteLaneData } from "@/components/soundArea/noteArea/chartAdapter";
import {
    isWdsHoldType,
    isWdsJumpScratch,
    isWdsOneDirection,
    normalizeWdsJumpScratch,
} from "@/components/soundArea/noteArea/wdsTypes";

export interface WdsChartExportResult {
    text: string;
    error: string | null;
    warnings: string[];
}

// TeamOpenSirius/wds-editor @ a3bfa45b907682722a5334270bd1e09f143e6fad.
// See docs/wdschart-format.md for source permalinks and interoperability limits.
const MAX_TPQ = 16_777_215n;
const MAX_TICK = 2_147_483_647n;
const MAX_RECORDS = 1_000_000;
const MAX_BPM = 10_000;
// INT64_MAX itself rounds up to 2^63 as a JS Number (and a C++ double).
// Use that exactly representable, exclusive boundary before any integer cast.
const INT64_MS_EXCLUSIVE = 2 ** 63;

interface Rational {
    numerator: bigint;
    denominator: bigint;
}

interface PreparedNote {
    note: ChartNote;
    start: Rational;
    end: Rational | null;
}

interface NativeNote {
    sourceId: string;
    part: number;
    id: number;
    start: number;
    end: number;
    type: number;
    lane: number;
    width: number;
    gimmick: number;
    scratch: number;
    parent: number;
}

type Warn = (message: string) => void;

function gcd(a: bigint, b: bigint): bigint {
    a = a < 0n ? -a : a;
    while (b !== 0n) [a, b] = [b, a % b];
    return a;
}

function absoluteBeat(owningBeat: number, offset: Fraction): Rational {
    // validateNoteLaneData has checked safe integer inputs. Do not pass through
    // collectWdsNotes' floating beat/time or the UI's division grid.
    let numerator = BigInt(offset.a);
    let denominator = BigInt(offset.b);
    if (denominator < 0n) {
        numerator = -numerator;
        denominator = -denominator;
    }
    numerator += BigInt(owningBeat) * denominator;
    const divisor = gcd(numerator, denominator);
    return { numerator: numerator / divisor, denominator: denominator / divisor };
}

function chooseTpq(notes: PreparedNote[], lastTimingBeat: bigint, warn: Warn): bigint {
    let minimum = 1n;
    let limit = MAX_TPQ;
    for (const { note, start, end } of notes) {
        for (const position of end ? [start, end] : [start]) {
            minimum = minimum / gcd(minimum, position.denominator) * position.denominator;
            if (minimum > MAX_TPQ) {
                throw new Error(`音符 ${note.id} 的拍分数需要最小 TPQ=${minimum}，超过目标上限 ${MAX_TPQ}；无法无损导出，不会按 division 量化。`);
            }
            if (position.numerator > 0n) {
                const tickLimit = MAX_TICK * position.denominator / position.numerator;
                if (tickLimit < limit) limit = tickLimit;
            }
        }
    }
    if (lastTimingBeat > 0n) {
        const tickLimit = MAX_TICK / lastTimingBeat;
        if (tickLimit < limit) limit = tickLimit;
    }
    if (minimum > limit) {
        throw new Error(`拍位所需最小 TPQ=${minimum} 会使音符或 BPM 变化点 tick 超出目标 int32 范围 0..${MAX_TICK}；无法无损导出。`);
    }
    // 480 is a preference, not a factor required by the format. A smaller
    // exact multiple can also rescue long charts from the int32 tick limit.
    const preferred = minimum / gcd(minimum, 480n) * 480n;
    if (preferred <= limit) return preferred;
    const even = minimum % 2n === 0n ? minimum : minimum * 2n;
    if (even <= limit) return even;
    warn(`TPQ=${minimum} 为奇数，已有音符拍位仍精确；目标按 max(1, floor(TPQ/2)) 个 tick 生成“半拍”判定，整数除法取整会使其偏离半拍。`);
    return minimum;
}

function checkedTick(tick: bigint, label: string): number {
    if (tick < 0n || tick > MAX_TICK) {
        throw new Error(`${label} 的 tick 超出目标 int32 范围 0..${MAX_TICK}；无法无损导出。`);
    }
    return Number(tick);
}

function toTick(position: Rational, tpq: bigint, label: string): number {
    const numerator = position.numerator * tpq;
    if (numerator % position.denominator !== 0n) {
        throw new Error(`${label} 无法精确表示为整数 tick。`);
    }
    return checkedTick(numerator / position.denominator, label);
}

function checkBpm(bpm: number, label: string): void {
    if (bpm > MAX_BPM) {
        throw new Error(`${label}=${bpm} 超过目标 BPM 上限 ${MAX_BPM}；目标会截断 BPM，无法保留原时间映射。`);
    }
}

function timingPointsInBeats(lane: NoteLaneData): Array<{ beat: bigint; bpm: number }> {
    const points: Array<{ beat: bigint; bpm: number }> = [];
    const append = (beat: bigint, bpm: number) => {
        if (points.length && points[points.length - 1].bpm === bpm) return;
        if (points.length >= MAX_RECORDS) throw new Error("WDSCHART TIMING 记录超过 100 万条。");
        points.push({ beat, bpm });
    };
    let beat = 0n;
    for (const segment of lane.chartData) {
        // Empty segments consume no beats and have no effective tempo interval.
        if (segment.measures.length === 0) continue;
        append(beat, segment.tempo);
        beat += BigInt(segment.measures.length);
    }
    // The local model extends beyond stored beats with defaultBpm, not the last
    // segment tempo. Preserve that complete map even if no note reaches it yet.
    append(beat, lane.defaultBpm);
    return points;
}

function checkTargetMilliseconds(
    points: Array<{ tick: number; bpm: number }>,
    tpq: bigint,
    notes: NativeNote[],
): void {
    // Positive BPM makes time monotone. Cover all serialized timing points,
    // even those after the last note, then the latest note endpoint. This is
    // O(N + S), not one full tempo-map integration per note.
    let lastTick = points[points.length - 1].tick;
    for (const note of notes) lastTick = Math.max(lastTick, note.start, note.end);
    let milliseconds = 0;
    for (let index = 0; index < points.length; index++) {
        const point = points[index];
        const endTick = points[index + 1]?.tick ?? lastTick;
        // Match timing_map.cpp's prefix accumulation and notation.cpp's
        // double arithmetic. Even 0 * an overflowing rate is non-finite.
        const rate = 60000 / (point.bpm * Number(tpq));
        milliseconds += (endTick - point.tick) * rate;
        if (!Number.isFinite(milliseconds) || milliseconds >= INT64_MS_EXCLUSIVE) {
            throw new Error(`tick ${endTick} 的累计时间超出目标 int64 毫秒可表示范围或为非有限值；目标时间会饱和，无法导出。`);
        }
    }
}

function isScratchHold(note: NativeNote): boolean {
    return note.type === 110 || note.type === 111;
}

function spanKey(note: NativeNote): string {
    return `${Number(isScratchHold(note))}:${note.lane}:${note.width}`;
}

/** Monotone point queries over open hold intervals. At most 156 span/family
 * buckets keep ambiguous overlaps from turning star binding into an N² scan. */
class HoldLookup {
    private starts: NativeNote[];
    private ends: NativeNote[];
    private startIndex = 0;
    private endIndex = 0;
    private active = new Map<string, Set<NativeNote>>();

    constructor(notes: NativeNote[]) {
        const holds = notes.filter((note) => isWdsHoldType(note.type));
        this.starts = holds.slice().sort((a, b) => a.start - b.start);
        this.ends = holds.slice().sort((a, b) => a.end - b.end);
    }

    find(point: NativeNote, scratchFamily: boolean, exactSpan: boolean): NativeNote[] {
        while (this.startIndex < this.starts.length && this.starts[this.startIndex].start < point.start) {
            const hold = this.starts[this.startIndex++];
            const key = spanKey(hold);
            let bucket = this.active.get(key);
            if (!bucket) this.active.set(key, bucket = new Set());
            bucket.add(hold);
        }
        while (this.endIndex < this.ends.length && this.ends[this.endIndex].end <= point.start) {
            const hold = this.ends[this.endIndex++];
            this.active.get(spanKey(hold))?.delete(hold);
        }
        const matches: NativeNote[] = [];
        for (const bucket of this.active.values()) {
            const representative = bucket.values().next().value;
            if (!representative || isScratchHold(representative) !== scratchFamily) continue;
            const sameSpan = representative.lane === point.lane && representative.width === point.width;
            const overlaps = representative.lane < point.lane + point.width && point.lane < representative.lane + representative.width;
            if (exactSpan ? !sameSpan : !overlaps) continue;
            for (const hold of bucket) {
                matches.push(hold);
                if (matches.length === 2) return matches;
            }
        }
        return matches;
    }
}

function nativeNote(entry: PreparedNote, tpq: bigint, warn: Warn): NativeNote {
    const note = entry.note;
    const original = note.wds!;
    const p = normalizeWdsJumpScratch(original);
    if (p !== original) {
        warn("等宽 JumpScratch 已按本地模型规范化为无方向的普通尾巴（gimmick=0）。");
    }
    let gimmick = 0;
    let scratch = 0;
    if (isWdsJumpScratch(p)) {
        gimmick = 1;
        scratch = p.gimmickValue;
    } else if (isWdsOneDirection(p)) {
        // Local OneDirection uses 0=left, ANY nonzero=right. Native hold
        // geometry and arrows use signed spans, even when gimmick remains 2.
        scratch = p.gimmickValue === 0 ? -p.width : p.width;
        gimmick = isWdsHoldType(note.type) ? 2 : 0;
    } else if (p.gimmickValue !== 0) {
        warn("无 gimmick 的非零 gimmickValue 已清为 0，避免目标将其误解为划动方向或长条尾部跨度。");
    }
    const start = toTick(entry.start, tpq, `音符 ${note.id} 起点`);
    const end = entry.end ? toTick(entry.end, tpq, `音符 ${note.id} 终点`) : 0;
    if (entry.end && end <= start) throw new Error(`长条 ${note.id} 必须具有严格为正的整数 tick 区间。`);
    return { sourceId: note.id, part: 0, id: -1, start, end, type: note.type,
        lane: p.lane - 1, width: p.width, gimmick, scratch, parent: -1 };
}

function convertScratchCuts(notes: NativeNote[], warn: Warn): NativeNote[] {
    // official_chart.cpp:156–199: type 40 cuts an overlapping purple hold's
    // open interval; otherwise it becomes Flick. Refuse the source importer's
    // first-match guess and any cut that would silently acquire another span.
    const lookup = new HoldLookup(notes);
    const cuts = new Map<NativeNote, NativeNote[]>();
    const orphans: NativeNote[] = [];
    const scratchNotes = notes.filter((note) => note.type === 40).sort(compareNotes);
    for (const cut of scratchNotes) {
        const matches = lookup.find(cut, true, false);
        if (matches.length > 1) throw new Error(`Scratch 40（${cut.sourceId}）同时位于多个紫色长条内部，无法无歧义分段。`);
        const hold = matches[0];
        if (!hold) {
            if (cut.gimmick === 1) {
                throw new Error(`孤立 Scratch 40（${cut.sourceId}）的 JumpScratch 扩展范围无法按目标官方导入规则无损转成 Flick。`);
            }
            orphans.push({ ...cut, type: 50 });
            warn("孤立 Scratch（40）已按目标官方导入规则转为 Flick（50）；目标原生格式没有 40，外观会有差异。");
            continue;
        }
        if (cut.lane !== hold.lane || cut.width !== hold.width) {
            throw new Error(`Scratch 40（${cut.sourceId}）与候选紫色长条的 lane/width 不一致，无法无损分段。`);
        }
        const list = cuts.get(hold) ?? [];
        if (list.length && list[list.length - 1].start === cut.start) {
            throw new Error(`长条 ${hold.sourceId} 同一时刻存在多个 Scratch 40，无法无歧义分段。`);
        }
        list.push(cut);
        cuts.set(hold, list);
    }
    const result = [...orphans];
    for (const note of notes) {
        if (note.type === 40) continue;
        let start = note.start;
        let part = 0;
        for (const cut of cuts.get(note) ?? []) {
            result.push({ ...note, start, end: cut.start, part: part++,
                gimmick: cut.scratch === 0 ? 0 : 1, scratch: cut.scratch });
            start = cut.start;
        }
        result.push({ ...note, start, part });
    }
    if (cuts.size) {
        warn("紫色长条内部的 Scratch（40）已转为长条分段端点及有符号划动跨度；原尾属性保留在最后一段，不生成或更改独立头键。目标会按各段重新推导判定点。");
    }
    return result;
}

function compareNotes(a: NativeNote, b: NativeNote): number {
    return a.start - b.start || a.end - b.end || a.lane - b.lane || a.width - b.width ||
        a.type - b.type || a.gimmick - b.gimmick || a.scratch - b.scratch ||
        (a.sourceId < b.sourceId ? -1 : a.sourceId > b.sourceId ? 1 : 0) || a.part - b.part;
}

function assignIdsAndParents(notes: NativeNote[], warn: Warn): void {
    notes.sort(compareNotes);
    const records = new Set<string>();
    notes.forEach((note, index) => {
        note.id = index;
        const key = [note.start, note.end, note.type, note.lane, note.width, note.gimmick, note.scratch].join(":");
        if (records.has(key)) throw new Error(`音符 ${note.sourceId} 转换后产生重复原生记录，无法保留其独立语义。`);
        records.add(key);
    });
    const lookup = new HoldLookup(notes);
    for (const star of notes) {
        if (star.type !== 30 && star.type !== 31) continue;
        const matches = lookup.find(star, star.type === 31, true);
        if (matches.length > 1) throw new Error(`Sound ${star.type}（${star.sourceId}）匹配多个同范围、同家族的长条开放区间，无法确定 parent_hold_id。`);
        star.parent = matches[0]?.id ?? -1;
        if (star.parent === -1) {
            warn("部分 Sound（30/31）没有唯一匹配的长条开放区间，保留为 parent_hold_id=-1 的独立记录。目标会保留这些记录，但预览判定还可能按重叠轨道吸收它们。");
        }
    }
    const scratchStarts = new Set(notes.filter(isScratchHold).map((note) => `${note.start}:${note.lane}:${note.width}`));
    if (notes.some((note) => [10, 20, 200].includes(note.type) && scratchStarts.has(`${note.start}:${note.lane}:${note.width}`))) {
        warn("独立点记录已原样导出；目标可编辑加载器会把与紫色长条同起点、同范围的 10/20/200 重解释为 82/83。该目标端修复行为可能改变头键外观。");
    }
    if (notes.some((note) => note.type === 50 && note.gimmick === 1)) {
        warn("Flick 的 JumpScratch 有符号覆盖值已保留；目标编辑视图按原 lane/width 绘制 Flick，可能不显示扩展覆盖范围。");
    }
}

/** Native WDSCHART 5 text, with exact musical positions and no audio offset.
 * Heads remain independent records; this function never mutates the lane. */
export function convertToWdsChart(lane: NoteLaneData): WdsChartExportResult {
    const warnings = new Set<string>();
    const warn: Warn = (message) => { warnings.add(message); };
    try {
        const error = validateNoteLaneData(lane);
        if (error) throw new Error(error);
        if (lane.chartKind !== "wds") throw new Error("仅 WDS 谱面可导出 WDSCHART；不能自动转换强弱拍谱面。");
        checkBpm(lane.defaultBpm, "defaultBpm");
        lane.chartData.forEach((segment, index) => checkBpm(segment.tempo, `第 ${index + 1} 段 BPM`));

        warn("WDSCHART 不是内部项目备份：音符 ID 将重新编号，不保存音频、元信息、division 和编辑器辅助设置。请保留内部 JSON 或项目文件。");
        warn("内部没有拍号信息；每个 measure 按一拍处理，导出采用 4/4（每四拍一小节），BPM 变化点保留原拍位。");
        if ((lane.wdsOffset ?? 0) !== 0) warn(`TXT 导出偏移 wdsOffset=${lane.wdsOffset} 秒未应用；WDSCHART 仅存谱面本地拍位，不写 OFFSET_MS。`);
        for (const segment of lane.chartData) {
            for (const measure of segment.measures) {
                for (const note of measure.notes) {
                    if (isNoteBoundary(note)) warn("起止边界标记不导出，也不会裁剪音符或 BPM 范围。");
                    if (note.annotation) warn("音符注释不写入 WDSCHART。");
                    if (note.body?.length) warn("内部 body 锚点不写入 WDSCHART，也不会转换成额外音符或判定点。");
                }
            }
        }
        if (lane.startTime != null || lane.endTime != null) warn("旧版 startTime/endTime 边界不导出，也不会裁剪音符范围。");
        const entries = collectWdsNotes(lane.chartData, lane.defaultBpm);
        const prepared: PreparedNote[] = [];
        for (const { note, measureIndex } of entries) {
            if (note.type === 900) {
                warn("显式 900 判定记录不导出：目标原生保存器会丢弃 900，并在可编辑加载时重新生成；手工判定时刻可能丢失。");
                continue;
            }
            if (prepared.length >= MAX_RECORDS) throw new Error("WDSCHART NOTES 记录超过 100 万条。");
            if (isWdsHoldType(note.type)) {
                warn("目标会对所有普通及紫色长条按各段起点自行生成 900 判定点（偶数 TPQ 时每半拍，已有星星占据的点除外），即使本地 autoTicks 关闭也一样；判定点及连击可能不同。");
            }
            if (note.wds!.autoTicks) warn("autoTicks 辅助开关不写入 WDSCHART，本导出器不生成 900；改由目标自己的长条判定规则处理。");
            prepared.push({ note, start: absoluteBeat(measureIndex, note.head!),
                end: note.tail ? absoluteBeat(measureIndex, note.tail) : null });
        }
        const beatTiming = timingPointsInBeats(lane);
        const tpq = chooseTpq(prepared, beatTiming[beatTiming.length - 1].beat, warn);
        const timing = beatTiming.map((point) => ({
            tick: checkedTick(point.beat * tpq, "BPM 变化点"), bpm: point.bpm,
        }));
        const notes = convertScratchCuts(prepared.map((entry) => nativeNote(entry, tpq, warn)), warn);
        if (notes.length > MAX_RECORDS) throw new Error("WDSCHART NOTES 记录超过 100 万条。");
        checkTargetMilliseconds(timing, tpq, notes);
        assignIdsAndParents(notes, warn);
        const lines = ["WDSCHART 5", `BPM ${timing[0].bpm}`, `TPQ ${tpq}`, `TIMING ${timing.length}`];
        timing.forEach((point, index) => lines.push(`T ${point.tick} ${point.bpm} 4 4 ${index === 0 ? 3 : 1}`));
        lines.push(`NOTES ${notes.length}`);
        for (const note of notes) {
            lines.push(`N ${note.id} ${note.start} ${note.end} ${note.type} ${note.lane} ${note.width} ${note.gimmick} ${note.scratch} ${note.parent}`);
        }
        lines.push("CONCURRENT 0", "END", "");
        return { text: lines.join("\n"), error: null, warnings: [...warnings] };
    } catch (error) {
        return { text: "", error: error instanceof Error ? error.message : "WDSCHART 导出失败", warnings: [...warnings] };
    }
}
