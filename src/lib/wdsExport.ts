import type { Fraction, NoteLaneData, WdsNoteProperties } from "@/components/soundArea/noteArea/chartTypes";
import {
    collectWdsNotes,
    normalizeFraction,
    wdsBeatToTime,
    validateNoteLaneData,
} from "@/components/soundArea/noteArea/chartAdapter";
import { isWdsHoldType, normalizeWdsJumpScratch } from "@/components/soundArea/noteArea/wdsTypes";

export interface WdsExportResult {
    text: string;
    error: string | null;
    warnings: string[];
}

interface WdsRow {
    beat: number;
    beatKey: string;
    endBeat: number | null;
    endBeatKey?: string;
    type: number;
    lane: number;
    width: number;
    gimmickType: WdsNoteProperties["gimmickType"];
    gimmickValue: number;
}

const LOSS_WARNING = "WDS TXT 是不可逆的纯秒数导出：不保留 BPM、拍网格、音符 ID、注释及编辑器辅助设置。请同时保存内部 JSON 或项目文件。";
const MAX_ROWS = 1_000_000;

// Rational identity avoids losing triplet ticks to floating-point rounding,
// or conflating distinct beats before their tempo-dependent conversion.
function exactBeatKey(owningBeat: number, offset: Fraction, halfSteps = 0): string {
    const f = normalizeFraction(offset)!;
    let numerator = 2n * (BigInt(owningBeat) * BigInt(f.b) + BigInt(f.a)) + BigInt(halfSteps) * BigInt(f.b);
    let denominator = 2n * BigInt(f.b);
    let a = numerator < 0n ? -numerator : numerator;
    let b = denominator;
    while (b !== 0n) [a, b] = [b, a % b];
    numerator /= a;
    denominator /= a;
    return `${numerator}/${denominator}`;
}

function positionKey(beatKey: string, lane: number, width: number): string {
    return `${beatKey}:${lane}:${width}`;
}

function recordKey(row: WdsRow): string {
    return `${row.type}:${positionKey(row.beatKey, row.lane, row.width)}:${row.endBeatKey ?? "point"}`;
}

function autoTickSteps(head: Fraction, tail: Fraction): number {
    const h = normalizeFraction(head)!;
    const t = normalizeFraction(tail)!;
    const numerator = 2n * (BigInt(t.a) * BigInt(h.b) - BigInt(h.a) * BigInt(t.b));
    const denominator = BigInt(t.b) * BigInt(h.b);
    const ceiling = (numerator + denominator - 1n) / denominator;
    if (ceiling > BigInt(MAX_ROWS + 1)) throw new Error("长条自动判定节点过多，请缩短长条或关闭 autoTicks");
    return Number(ceiling);
}

/** Seven-column, headerless CSV: start,end,type,lane,width,gimmickType,gimmickValue.
 * Reference: OhnkytaBlabdey/wdschart-render @ 4e90935,
 * render_chart_beat_count.py (read_csv, holdNotes, scratchNotes).
 * Boundary markers never crop output. Body anchors are editor-only, not extra
 * ticks. Optional auto 900s are an explicit editor convenience, not a WDS rule.
 * Only wdsOffset is applied; callers must check error before downloading. */
export function convertToWds(lane: NoteLaneData): WdsExportResult {
    const warnings = [LOSS_WARNING];
    try {
        if (lane?.chartKind !== "wds") throw new Error("仅 WDS 谱面可导出 WDS TXT；不能自动转换强弱拍谱面");
        const error = validateNoteLaneData(lane);
        if (error) throw new Error(error);
        const entries = collectWdsNotes(lane.chartData, lane.defaultBpm);
        const rows: WdsRow[] = [];
        const records = new Set<string>();
        const explicitJudges = new Set<string>();
        const addRow = (row: WdsRow, generated: boolean) => {
            const key = recordKey(row);
            if (records.has(key)) {
                if (generated) return;
                throw new Error("存在重复的 WDS 导出记录");
            }
            if (rows.length >= MAX_ROWS) throw new Error("WDS 导出记录超过 100 万行，请缩短长条或关闭自动判定节点");
            rows.push(row);
            records.add(key);
        };

        // Holds and start keys are independent explicit rows. Only optional
        // judge assistance can generate records; never synthesize a head key.
        for (const { note, beat, tailBeat, measureIndex } of entries) {
            const p = normalizeWdsJumpScratch(note.wds!);
            const beatKey = exactBeatKey(measureIndex, note.head!);
            addRow({ beat, beatKey, endBeat: tailBeat,
                endBeatKey: note.tail ? exactBeatKey(measureIndex, note.tail) : undefined,
                type: note.type, lane: p.lane,
                width: p.width, gimmickType: p.gimmickType, gimmickValue: p.gimmickValue }, false);
            if (note.type === 900) {
                explicitJudges.add(positionKey(beatKey, p.lane, p.width));
            }
        }
        for (const { note, beat, tailBeat, measureIndex } of entries) {
            if (!isWdsHoldType(note.type) || tailBeat === null) continue;
            const p = note.wds!;
            if (!p.autoTicks) continue;
            const steps = autoTickSteps(note.head!, note.tail!);
            for (let index = 1; index < steps; index++) {
                const tickBeat = beat + index / 2;
                const beatKey = exactBeatKey(measureIndex, note.head!, index);
                if (explicitJudges.has(positionKey(beatKey, p.lane, p.width))) continue;
                addRow({ beat: tickBeat, beatKey, endBeat: null, type: 900, lane: p.lane,
                    width: p.width, gimmickType: "0", gimmickValue: 0 }, true);
            }
        }

        if (lane.chartData.some((s) => s.measures.some((m) => m.notes.some((n) => n.type === -1 || n.type === -2)))) {
            warnings.push("起止边界标记不导出，也不会裁剪音符范围。");
        }
        if (entries.some(({ note }) => (note.body?.length ?? 0) > 0)) {
            warnings.push("内部 body 锚点不导出；自动判定仅按长条起点每半拍生成，请用独立 900 音符指定额外判定。");
        }
        if (entries.some(({ note }) => note.wds?.autoTicks)) {
            warnings.push("已启用编辑器辅助生成：按长条起点每半拍添加 900 记录。这是显式选项，并非由 WDS 格式自动推导的判定规则。");
        }
        rows.sort((a, b) => a.beat - b.beat || a.lane - b.lane || a.type - b.type ||
            a.width - b.width || (a.endBeat ?? -1) - (b.endBeat ?? -1) ||
            (a.gimmickType < b.gimmickType ? -1 : a.gimmickType > b.gimmickType ? 1 : 0) || a.gimmickValue - b.gimmickValue);
        const offset = lane.wdsOffset ?? 0;
        const seconds = (beat: number): string => {
            const time = wdsBeatToTime(lane.chartData, beat, lane.defaultBpm) + offset;
            if (!Number.isFinite(time) || Math.abs(time) >= 1e21) throw new Error("WDS 导出时间超出范围");
            const fixed = time.toFixed(9);
            return fixed === "-0.000000000" ? "0.000000000" : fixed;
        };
        const serializedRecords = new Set<string>();
        const text = rows.map((row) => {
            const start = seconds(row.beat);
            const end = row.endBeat === null ? "-1" : seconds(row.endBeat);
            if (row.endBeat !== null && Number(end) <= Number(start)) throw new Error("长条时长低于导出精度，无法生成有效区间");
            const record = [start, end, row.type, row.lane, row.width, row.gimmickType, row.gimmickValue].join(",");
            if (serializedRecords.has(record)) throw new Error("不同音符的时间间隔低于导出精度，无法区分记录");
            serializedRecords.add(record);
            return record;
        }).join("\n");
        return { text, error: null, warnings };
    } catch (error) {
        return { text: "", error: error instanceof Error ? error.message : "WDS 导出失败", warnings };
    }
}
