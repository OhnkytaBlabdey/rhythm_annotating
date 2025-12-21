export interface spectrumlane {
    paletteSchema: string;
    isFolded: boolean;
}
export function defaultSpectrumLane() {
    return {
        isFolded: false,
        paletteSchema: "default",
    } as spectrumlane;
}
