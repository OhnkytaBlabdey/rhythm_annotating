import { defaultMeasure, measure } from "./measure/measure";

export interface notelane {
    measures: Array<measure>;
    startTime: number;
}
export function defaultNoteLane() {
    return {
        measures: [defaultMeasure()],
        startTime: 0,
    } as notelane;
}
