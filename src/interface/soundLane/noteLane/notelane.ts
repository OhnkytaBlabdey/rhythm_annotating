import { defaultMeasure, measure } from "./measure/measure";

export interface notelane {
    isActive: boolean;
    measures: Array<measure>;
    startTime: number;
}
export function defaultNoteLane() {
    return {
        isActive: false,
        measures: [defaultMeasure()],
        startTime: 0,
    } as notelane;
}
