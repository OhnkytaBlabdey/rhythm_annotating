import { note } from "./note";
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
export const generateId = (): string => {
    const timestamp = Date.now(); // 13位时间戳
    const random = Math.floor(Math.random() * 1000000); // 0-999999随机数
    return `${timestamp}${random}`;
};
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
