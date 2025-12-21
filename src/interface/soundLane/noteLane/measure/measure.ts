import { note } from "./note";
export interface measure {
    noBeat: boolean;
    bpm?: number;
    notes: Array<note>;
    currentDivide?: number; //n等分 分母
    currentNum?: number; //光标 分子
}
export function defaultMeasure() {
    return {
        noBeat: false,
        bpm: 60,
        notes: [],
        currentDivide: 1,
        currentNum: 0,
    } as measure;
}
