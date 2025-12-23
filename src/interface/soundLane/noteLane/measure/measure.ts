import { note } from "./note";
// 实际上是1beat
export interface measure {
    noBeat: boolean;
    bpm?: number;
    lasted?: number;
    notes: Array<note>;
    currentDivide?: number; //n等分 分母
    currentNum?: number; //光标 分子
}
export function defaultMeasure() {
    return {
        noBeat: false,
        bpm: 60,
        notes: [],
        currentDivide: 4,
        currentNum: 0,
    } as measure;
}
