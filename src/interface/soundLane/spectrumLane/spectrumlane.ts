export interface spectrumlane {
    paletteSchema: string;
    isFolded: boolean;
    brightnessOffset: number;
    resolutionScale: number;
}
export function defaultSpectrumLane() {
    return {
        isFolded: false,
        paletteSchema: "default",
        brightnessOffset: 0,
        resolutionScale: 1,
    } as spectrumlane;
}
