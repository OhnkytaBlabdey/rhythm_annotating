import { note } from "./note";
import { generateId } from "@/interface/audioData";
// 实际上是1beat
export interface measure {
    id: string;
    noBeat: boolean;
    bpm?: number;
    lasted?: number;
    notes: Array<note>;
    currentDivide?: number; //n等分 分母
    currentNum?: number; //光标 分子
}
export function defaultMeasure() {
    return {
        id: generateId(),
        noBeat: false,
        bpm: 60,
        notes: [],
        currentDivide: 4,
        currentNum: 0,
    } as measure;
}
