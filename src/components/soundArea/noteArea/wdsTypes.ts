export const WDS_LANE_COUNT = 12;

export interface WdsNoteProperties {
    lane: number;
    width: number;
    gimmickType: "0" | "1" | "JumpScratch" | "2" | "OneDirection";
    /** JumpScratch: signed coverage width. OneDirection: 0=left, nonzero=right. */
    gimmickValue: number;
    autoTicks: boolean;
}

export interface WdsNoteType {
    code: number;
    label: string;
    kind: "point" | "hold";
    color: string;
    uncommon?: boolean;
}

// Verified against wdschart-render @ 4e90935, render_chart_beat_count.py:
// classification 567–576, head appearances 818–827, hold ends 719–735,
// gimmick interpretation 889–908. Codes sharing a glyph are not new key kinds.
export const WDS_NOTE_TYPES: readonly WdsNoteType[] = [
    { code: 10, label: "普通键", kind: "point", color: "#fd62a3" },
    { code: 20, label: "重击键", kind: "point", color: "#fea62b" },
    { code: 50, label: "Flick", kind: "point", color: "#813bec" },
    { code: 100, label: "蓝色长条（身尾）", kind: "hold", color: "#129bfa" },
    { code: 110, label: "紫色长条（身尾）", kind: "hold", color: "#813bec" },
    { code: 30, label: "蓝色 Sound", kind: "point", color: "#93f3fc" },
    { code: 31, label: "紫色 Sound", kind: "point", color: "#c592fd" },
    { code: 40, label: "Scratch", kind: "point", color: "#813bec" },
    { code: 101, label: "蓝色长条（101）", kind: "hold", color: "#129bfa", uncommon: true },
    { code: 111, label: "紫色长条（111）", kind: "hold", color: "#813bec", uncommon: true },
    // Independent point records, present alongside holds in music/1/5.txt
    // at lines 25/85/20/1 respectively; never infer one from a hold code.
    { code: 80, label: "蓝色头键", kind: "point", color: "#129bfa", uncommon: true },
    { code: 81, label: "重击头键（81）", kind: "point", color: "#fea62b", uncommon: true },
    { code: 82, label: "普通头键", kind: "point", color: "#fd62a3", uncommon: true },
    { code: 83, label: "重击头键（83）", kind: "point", color: "#fea62b", uncommon: true },
    { code: 200, label: "蓝键", kind: "point", color: "#129bfa" },
    { code: 900, label: "长条判定", kind: "point", color: "#fd62a3" },
];

export function isWdsNoteType(type: number): boolean {
    return WDS_NOTE_TYPES.some(({ code }) => code === type);
}

export function isWdsHoldType(type: number): boolean {
    return [100, 101, 110, 111].includes(type);
}

export function isWdsScratchType(type: number): boolean {
    return [40, 50, 110, 111].includes(type);
}

export function isWdsBodyNoteType(type: number): boolean {
    return type === 30 || type === 31 || type === 40;
}

export function isWdsJumpScratch(p: WdsNoteProperties): boolean {
    return p.gimmickType === "1" || p.gimmickType === "JumpScratch";
}

/** JumpScratch describes extension beyond the body. At or inside its span the
 * canonical tail is the ordinary, directionless tail (0,0), never a narrow jump. */
export function normalizeWdsJumpScratch(p: WdsNoteProperties): WdsNoteProperties {
    if (isWdsJumpScratch(p) && Number.isSafeInteger(p.width) && p.width > 0 &&
        Number.isSafeInteger(p.gimmickValue) && Math.abs(p.gimmickValue) <= p.width) {
        return { ...p, gimmickType: "0", gimmickValue: 0 };
    }
    return p;
}

export function isWdsOneDirection(p: WdsNoteProperties): boolean {
    return p.gimmickType === "2" || p.gimmickType === "OneDirection";
}

export function getWdsScratchDirection(p: WdsNoteProperties): "left" | "right" | "both" {
    if (isWdsJumpScratch(p)) return p.gimmickValue < 0 ? "left" : "right";
    if (isWdsOneDirection(p)) return p.gimmickValue === 0 ? "left" : "right";
    return "both";
}

/** Holds contain only the body and tail. Start keys are independent notes.
 * The reference renders explicit 900 records; it does not infer half-beat ticks. */
export function defaultWdsProperties(type: number): WdsNoteProperties {
    if (!isWdsNoteType(type)) throw new Error(`不支持的 WDS note 类型: ${type}`);
    return {
        lane: 1,
        width: 1,
        gimmickType: "0",
        gimmickValue: 0,
        autoTicks: false,
    };
}

/** JumpScratch only: V>0 covers [L,L+V-1], V<0 covers [L+W+V,L+W-1].
 * Other gimmicks preserve the body span. */
export function getWdsScratchSpan(
    properties: WdsNoteProperties,
): { lane: number; width: number } | null {
    if (!properties) return null;
    const { lane, width, gimmickValue } = properties;
    if (
        !Number.isInteger(lane) || !Number.isInteger(width) ||
        lane < 1 || width < 1 || lane + width > WDS_LANE_COUNT + 1 ||
        !Number.isSafeInteger(gimmickValue)
    ) return null;
    // OneDirection changes only the arrow; ordinary records ignore the value.
    if (!isWdsJumpScratch(properties)) return { lane, width };
    const tailLane = gimmickValue < 0 ? lane + width + gimmickValue : lane;
    const tailWidth = Math.abs(gimmickValue);
    if (tailWidth < width || tailLane < 1 || tailLane + tailWidth > WDS_LANE_COUNT + 1) return null;
    return { lane: tailLane, width: tailWidth };
}
