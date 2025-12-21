export interface wavelane {
    mediaFilePath: string;
    timeMultiplier: number;
    amplitudeMultiplier: number;
    isFolded: boolean;
}
export function defaultWaveLane(file: string) {
    return {
        amplitudeMultiplier: 1,
        isFolded: false,
        mediaFilePath: file,
        timeMultiplier: 1,
    } as wavelane;
}
