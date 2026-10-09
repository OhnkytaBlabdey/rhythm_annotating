import type { Fraction, NoteLaneData, SiriusNoteProperties } from "@/components/soundArea/noteArea/chartTypes";
import {
    collectSiriusNotes,
    normalizeFraction,
    siriusBeatToTime,
    validateNoteLaneData,
} from "@/components/soundArea/noteArea/chartAdapter";
import { isSiriusHoldType } from "@/components/soundArea/noteArea/siriusTypes";

export interface SiriusExportResult {
    text: string;
    error: string | null;
    warnings: string[];
}

interface SiriusRow {
    beat: number;
    beatKey: string;
    endBeat: number | null;
    endBeatKey?: string;
    type: number;
    lane: number;
    width: number;
    gimmick: SiriusNoteProperties["gimmick"];
    scratchLength: number;
}

const LOSS_WARNING = "Sirius TXT 是不可逆的纯秒数导出：不保留 BPM、拍网格、音符 ID、注释及长条分组设置。请同时保存内部 JSON 或项目文件。";
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

function recordKey(row: SiriusRow): string {
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

/** Seven-column, headerless CSV, matching levelData.cpp and music/1/5.txt:
 * https://github.com/SonolusHaniwa/sonolus-sirius-engine/blob/59dc8f5417b06138406597c8841d23189c93e6da/levelData.cpp
 * Boundary markers never crop output. Body anchors are editor-only, not extra
 * ticks. Auto 900s occur at head + n/2 musical beats, strictly inside the hold.
 * Only siriusOffset is applied; callers must check error before downloading. */
export function convertToSirius(lane: NoteLaneData): SiriusExportResult {
    const warnings = [LOSS_WARNING];
    try {
        if (lane?.chartKind !== "sirius") throw new Error("仅 Sirius 谱面可导出 Sirius TXT；不能自动转换强弱拍谱面");
        const error = validateNoteLaneData(lane);
        if (error) throw new Error(error);
        const entries = collectSiriusNotes(lane.chartData, lane.defaultBpm);
        const rows: SiriusRow[] = [];
        const records = new Set<string>();
        const explicitJudges = new Set<string>();
        const addRow = (row: SiriusRow, generated: boolean) => {
            const key = recordKey(row);
            if (records.has(key)) {
                if (generated) return;
                throw new Error("存在重复的 Sirius 导出记录");
            }
            if (rows.length >= MAX_ROWS) throw new Error("Sirius 导出记录超过 100 万行，请缩短长条或关闭自动判定节点");
            rows.push(row);
            records.add(key);
        };

        // Register all explicit rows first, so native heads/judges win over
        // generated counterparts regardless of source order.
        for (const { note, beat, tailBeat, measureIndex } of entries) {
            const p = note.sirius!;
            const beatKey = exactBeatKey(measureIndex, note.head!);
            addRow({ beat, beatKey, endBeat: tailBeat,
                endBeatKey: note.tail ? exactBeatKey(measureIndex, note.tail) : undefined,
                type: note.type, lane: p.lane,
                width: p.width, gimmick: p.gimmick, scratchLength: p.scratchLength }, false);
            if ([900, 30, 31, 40].includes(note.type)) {
                explicitJudges.add(positionKey(beatKey, p.lane, p.width));
            }
        }
        for (const { note, beat, tailBeat, measureIndex } of entries) {
            if (!isSiriusHoldType(note.type) || tailBeat === null) continue;
            const p = note.sirius!;
            if (p.holdHeadType !== null) {
                addRow({ beat, beatKey: exactBeatKey(measureIndex, note.head!),
                    endBeat: null, type: p.holdHeadType, lane: p.lane,
                    width: p.width, gimmick: "0", scratchLength: 0 }, true);
            }
            if (!p.autoTicks) continue;
            const steps = autoTickSteps(note.head!, note.tail!);
            for (let index = 1; index < steps; index++) {
                const tickBeat = beat + index / 2;
                const beatKey = exactBeatKey(measureIndex, note.head!, index);
                if (explicitJudges.has(positionKey(beatKey, p.lane, p.width))) continue;
                addRow({ beat: tickBeat, beatKey, endBeat: null, type: 900, lane: p.lane,
                    width: p.width, gimmick: "0", scratchLength: 0 }, true);
            }
        }

        if (lane.chartData.some((s) => s.measures.some((m) => m.notes.some((n) => n.type === -1 || n.type === -2)))) {
            warnings.push("起止边界标记不导出，也不会裁剪音符范围。");
        }
        if (entries.some(({ note }) => (note.body?.length ?? 0) > 0)) {
            warnings.push("内部 body 锚点不导出；自动判定仅按长条起点每半拍生成，请用独立 900 音符指定额外判定。");
        }
        rows.sort((a, b) => a.beat - b.beat || a.lane - b.lane || a.type - b.type ||
            a.width - b.width || (a.endBeat ?? -1) - (b.endBeat ?? -1) ||
            (a.gimmick < b.gimmick ? -1 : a.gimmick > b.gimmick ? 1 : 0) || a.scratchLength - b.scratchLength);
        const offset = lane.siriusOffset ?? 0;
        const seconds = (beat: number): string => {
            const time = siriusBeatToTime(lane.chartData, beat, lane.defaultBpm) + offset;
            if (!Number.isFinite(time) || Math.abs(time) >= 1e21) throw new Error("Sirius 导出时间超出范围");
            const fixed = time.toFixed(9);
            return fixed === "-0.000000000" ? "0.000000000" : fixed;
        };
        const serializedRecords = new Set<string>();
        const text = rows.map((row) => {
            const start = seconds(row.beat);
            const end = row.endBeat === null ? "-1" : seconds(row.endBeat);
            if (row.endBeat !== null && Number(end) <= Number(start)) throw new Error("长条时长低于导出精度，无法生成有效区间");
            const record = [start, end, row.type, row.lane, row.width, row.gimmick, row.scratchLength].join(",");
            if (serializedRecords.has(record)) throw new Error("不同音符的时间间隔低于导出精度，无法区分记录");
            serializedRecords.add(record);
            return record;
        }).join("\n");
        return { text, error: null, warnings };
    } catch (error) {
        return { text: "", error: error instanceof Error ? error.message : "Sirius 导出失败", warnings };
    }
}
