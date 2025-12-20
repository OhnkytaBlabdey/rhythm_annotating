import { note } from "./note";
export interface measure {
    noBeat: boolean;
    bpm?: number;
    notes: Array<note>;
    currentDivide?: number; //n等分 分母
    currentNum?: number; //光标 分子
}
