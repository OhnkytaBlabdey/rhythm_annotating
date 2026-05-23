import {
    ChartNote,
    Fraction,
    isNoteBoundary,
    NoteLaneData,
    NOTE_LN,
    NOTE_STRONG,
    NOTE_WEAK,
} from "@/components/soundArea/noteArea/chartTypes";

const BASE36_DIGITS = "0123456789abcdefghijklmnopqrstuvwxyz";
const SUS_LANE = "0";
const SUS_WIDTH = "1";

interface SusDataLine {
    measure: number;
    suffix: string;
    data: string;
}

interface SusPairLine {
    measure: number;
    suffix: string;
    pairs: string[];
}

function escapeSusString(value: string): string {
    return value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
}

function stripExtension(fileName: string): string {
    return fileName.replace(/\.[^./\\]+$/, "");
}

function formatBpm(value: number): string {
    const safeValue = Number.isFinite(value) && value > 0 ? value : 120;
    if (Number.isInteger(safeValue)) {
        return String(safeValue);
    }
    return safeValue.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
}

function toBase36(value: number, width: number): string {
    let n = Math.max(0, Math.floor(value));
    let out = "";
    do {
        out = BASE36_DIGITS[n % 36] + out;
        n = Math.floor(n / 36);
    } while (n > 0);
    return out.padStart(width, "0").slice(-width);
}

function getFirstBpm(noteLaneData: NoteLaneData): number {
    for (const segment of noteLaneData.chartData) {
        if (Number.isFinite(segment.tempo) && segment.tempo > 0) {
            return segment.tempo;
        }
    }
    return Number.isFinite(noteLaneData.defaultBpm) && noteLaneData.defaultBpm > 0
        ? noteLaneData.defaultBpm
        : 120;
}

function measureNumber(measure: number, base: number): string {
    return String(measure - base).padStart(3, "0");
}

function fractionToMeasurePosition(
    fraction: Fraction | undefined,
    baseMeasure: number,
    division: number,
): { measure: number; index: number } | null {
    if (
        !fraction ||
        !Number.isFinite(fraction.a) ||
        !Number.isFinite(fraction.b) ||
        fraction.b === 0
    ) {
        return null;
    }

    const denominator = Math.abs(Math.trunc(fraction.b));
    if (denominator <= 0) {
        return null;
    }

    const numerator = Math.max(0, Math.trunc(fraction.a));
    let measureOffset = Math.floor(numerator / denominator);
    const remainder = numerator - measureOffset * denominator;
    let index = Math.round((remainder / denominator) * division);

    if (index >= division) {
        measureOffset += Math.floor(index / division);
        index %= division;
    }

    return {
        measure: baseMeasure + measureOffset,
        index: Math.max(0, Math.min(division - 1, index)),
    };
}

function convertTapPair(note: ChartNote): string | null {
    if (note.type === NOTE_STRONG) return `1${SUS_WIDTH}`;
    if (note.type === NOTE_WEAK) return `2${SUS_WIDTH}`;
    return null;
}

export function convertToSus(
    noteLaneData: NoteLaneData,
    audioFilename: string,
): string {
    const safeAudioFilename = audioFilename || "unknown";
    const title = stripExtension(safeAudioFilename) || safeAudioFilename;
    const division = Math.max(1, Math.floor(noteLaneData.division || 1));
    const firstBpm = getFirstBpm(noteLaneData);
    const bpmCodes = new Map<string, string>();
    const simpleLines: SusDataLine[] = [];
    const pairLines = new Map<string, SusPairLine>();
    let globalMeasure = 0;
    let holdChannelIndex = 0;
    let maxReferencedMeasure = -1;

    function markMeasure(measure: number): void {
        maxReferencedMeasure = Math.max(maxReferencedMeasure, measure);
    }

    function getBpmCode(bpm: number): string {
        const bpmText = formatBpm(bpm);
        const existing = bpmCodes.get(bpmText);
        if (existing) {
            return existing;
        }
        const code = toBase36(Math.min(bpmCodes.size + 1, 36 * 36 - 1), 2);
        bpmCodes.set(bpmText, code);
        return code;
    }

    function setPair(
        measure: number,
        suffix: string,
        index: number,
        pair: string,
    ): void {
        markMeasure(measure);
        const key = `${measure}|${suffix}`;
        let line = pairLines.get(key);
        if (!line) {
            line = {
                measure,
                suffix,
                pairs: Array.from({ length: division }, () => "00"),
            };
            pairLines.set(key, line);
        }
        line.pairs[index] = pair;
    }

    for (const segment of noteLaneData.chartData) {
        const tempo = Number.isFinite(segment.tempo) && segment.tempo > 0
            ? segment.tempo
            : firstBpm;
        const bpmCode = getBpmCode(tempo);

        if (segment.measures.length > 0) {
            simpleLines.push({
                measure: globalMeasure,
                suffix: "08",
                data: bpmCode,
            });
        }

        for (const measure of segment.measures) {
            markMeasure(globalMeasure);

            for (const note of measure.notes) {
                if (isNoteBoundary(note)) continue;

                if (note.type === NOTE_LN && note.tail) {
                    const channel = toBase36(holdChannelIndex % 36, 1);
                    holdChannelIndex++;
                    const suffix = `2${SUS_LANE}${channel}`;
                    const head = fractionToMeasurePosition(
                        note.head,
                        globalMeasure,
                        division,
                    );
                    const tail = fractionToMeasurePosition(
                        note.tail,
                        globalMeasure,
                        division,
                    );

                    if (head) {
                        setPair(head.measure, suffix, head.index, `1${SUS_WIDTH}`);
                    }
                    for (const bodyPoint of note.body ?? []) {
                        const body = fractionToMeasurePosition(
                            bodyPoint,
                            globalMeasure,
                            division,
                        );
                        if (body) {
                            setPair(body.measure, suffix, body.index, `3${SUS_WIDTH}`);
                        }
                    }
                    if (tail) {
                        setPair(tail.measure, suffix, tail.index, `2${SUS_WIDTH}`);
                    }
                    continue;
                }

                const tapPair = convertTapPair(note);
                if (!tapPair) continue;
                const position = fractionToMeasurePosition(
                    note.head,
                    globalMeasure,
                    division,
                );
                if (!position) continue;
                setPair(position.measure, `1${SUS_LANE}`, position.index, tapPair);
            }

            globalMeasure++;
        }
    }

    const measureLengthLines: SusDataLine[] = Array.from(
        { length: maxReferencedMeasure + 1 },
        (_, measure) => ({
            measure,
            suffix: "02",
            data: "1",
        }),
    );

    const dataLines: SusDataLine[] = [
        ...measureLengthLines,
        ...simpleLines,
        ...Array.from(pairLines.values()).map((line) => ({
            measure: line.measure,
            suffix: line.suffix,
            data: line.pairs.join(""),
        })),
    ].sort((a, b) => a.measure - b.measure || a.suffix.localeCompare(b.suffix));

    const lines = [
        "#TITLE \"" + escapeSusString(title) + "\"",
        "#ARTIST \"unknown\"",
        "#DESIGNER \"Explicitize\"",
        "#WAVE \"" + escapeSusString(safeAudioFilename) + "\"",
        `#BASEBPM ${formatBpm(firstBpm)}`,
        "#REQUEST \"ticks_per_beat 480\"",
        "",
        ...Array.from(bpmCodes.entries()).map(
            ([bpm, code]) => `#BPM${code}: ${bpm}`,
        ),
        "",
    ];

    let currentBase = 0;
    for (const line of dataLines) {
        const nextBase = Math.floor(line.measure / 1000) * 1000;
        if (nextBase !== currentBase) {
            currentBase = nextBase;
            lines.push(`#MEASUREBS ${currentBase}`);
        }
        lines.push(
            `#${measureNumber(line.measure, currentBase)}${line.suffix}:${line.data}`,
        );
    }

    return `${lines.join("\n")}\n`;
}
