export interface wavelane {
    amplitudeMultiplier: number;
    isFolded: boolean;
}
export function defaultWaveLane() {
    return {
        amplitudeMultiplier: 5,
        isFolded: false,
    } as wavelane;
}
