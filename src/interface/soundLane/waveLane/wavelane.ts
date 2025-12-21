export interface wavelane {
    amplitudeMultiplier: number;
    isFolded: boolean;
}
export function defaultWaveLane() {
    return {
        amplitudeMultiplier: 1,
        isFolded: false,
    } as wavelane;
}
