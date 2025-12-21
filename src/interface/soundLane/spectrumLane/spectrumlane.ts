export interface spectrumlane {
    mediaFilePath: string;
    timeMultiplier: number;
    paletteSchema: string;
    isFolded: boolean;
}
export function defaultSpectrumLane(file: string) {
    return {
        isFolded: false,
        mediaFilePath: file,
        paletteSchema: "default",
        timeMultiplier: 1,
    } as spectrumlane;
}
