export const SIRIUS_LANE_COUNT = 12;

export interface SiriusNoteProperties {
    lane: number;
    width: number;
    gimmick: "0" | "JumpScratch" | "OneDirection";
    /** Signed tail coverage width, NOT a lane displacement. */
    scratchLength: number;
    /** Generated head; null represents a continuation without a head. */
    holdHeadType: 80 | 81 | 82 | 83 | null;
    autoTicks: boolean;
}

export interface SiriusNoteType {
    code: number;
    label: string;
    kind: "point" | "hold";
    color: string;
    advanced?: boolean;
}

// Converter reference (including advanced no-tail holds):
// https://github.com/SonolusHaniwa/sonolus-sirius-engine/blob/59dc8f5417b06138406597c8841d23189c93e6da/levelData.cpp
export const SIRIUS_NOTE_TYPES: readonly SiriusNoteType[] = [
    { code: 10, label: "Tap", kind: "point", color: "#53c8ff" },
    { code: 20, label: "Critical", kind: "point", color: "#ffd65a" },
    { code: 50, label: "Flick", kind: "point", color: "#ff76b5" },
    { code: 100, label: "Hold", kind: "hold", color: "#53c8ff" },
    { code: 101, label: "Critical Hold", kind: "hold", color: "#ffd65a" },
    { code: 110, label: "Scratch Hold", kind: "hold", color: "#ff76b5" },
    { code: 111, label: "Critical Scratch Hold", kind: "hold", color: "#ffae54" },
    { code: 900, label: "Eighth Judge", kind: "point", color: "#b8dcff" },
    { code: 30, label: "Sound", kind: "point", color: "#9eecc2" },
    { code: 31, label: "Scratch Sound", kind: "point", color: "#e9a4e5" },
    { code: 40, label: "Purple Flick", kind: "point", color: "#bd8bff" },
    { code: 80, label: "Hold Head", kind: "point", color: "#53c8ff" },
    { code: 81, label: "Critical Hold Head", kind: "point", color: "#ffd65a" },
    { code: 82, label: "Scratch Hold Head", kind: "point", color: "#ff76b5" },
    { code: 83, label: "Critical Scratch Head", kind: "point", color: "#ffae54" },
    { code: 200, label: "Blue Tap", kind: "point", color: "#658bff", advanced: true },
    { code: 1100, label: "Hold (No Tail)", kind: "hold", color: "#53c8ff", advanced: true },
    { code: 1101, label: "Critical Hold (No Tail)", kind: "hold", color: "#ffd65a", advanced: true },
    { code: 1110, label: "Scratch Hold (No Tail)", kind: "hold", color: "#ff76b5", advanced: true },
    { code: 1111, label: "Critical Scratch Hold (No Tail)", kind: "hold", color: "#ffae54", advanced: true },
];

export function isSiriusNoteType(type: number): boolean {
    return SIRIUS_NOTE_TYPES.some(({ code }) => code === type);
}

export function isSiriusHoldType(type: number): boolean {
    return SIRIUS_NOTE_TYPES.some(({ code, kind }) => code === type && kind === "hold");
}

export function isSiriusScratchType(type: number): boolean {
    return [40, 50, 110, 111, 1110, 1111].includes(type);
}

/** New ordinary holds have a head and half-beat ticks. Advanced no-tail
 * intervals default to headless continuations with ticks; heads remain editable. */
export function defaultSiriusProperties(type: number): SiriusNoteProperties {
    if (!isSiriusNoteType(type)) throw new Error(`不支持的 Sirius note 类型: ${type}`);
    const heads: Record<number, 80 | 81 | 82 | 83> = {
        100: 80, 101: 81, 110: 82, 111: 83,
    };
    return {
        lane: 1,
        width: 1,
        gimmick: "0",
        scratchLength: 0,
        holdHeadType: heads[type] ?? null,
        autoTicks: isSiriusHoldType(type),
    };
}

/** S>0: [L,L+S-1]; S<0: [L+W+S,L+W-1]; S=0: body span.
 * E.g. L=4,W=3,S=-6 covers lanes 1..6 (music/1/5.txt). */
export function getSiriusTailSpan(
    properties: SiriusNoteProperties,
): { lane: number; width: number } | null {
    if (!properties) return null;
    const { lane, width, scratchLength } = properties;
    if (
        !Number.isInteger(lane) || !Number.isInteger(width) ||
        lane < 1 || width < 1 || lane + width > SIRIUS_LANE_COUNT + 1 ||
        !Number.isInteger(scratchLength) || Math.abs(scratchLength) > SIRIUS_LANE_COUNT
    ) return null;
    const tailLane = scratchLength < 0 ? lane + width + scratchLength : lane;
    const tailWidth = scratchLength === 0 ? width : Math.abs(scratchLength);
    if (tailLane < 1 || tailLane + tailWidth > SIRIUS_LANE_COUNT + 1) return null;
    return { lane: tailLane, width: tailWidth };
}
