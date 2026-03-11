export interface spectrumlane {
    paletteSchema: string;
    isFolded: boolean;
    brightnessOffset: number;
}
export function defaultSpectrumLane() {
    return {
        isFolded: false,
        paletteSchema: "default",
        brightnessOffset: 0,
    } as spectrumlane;
}
