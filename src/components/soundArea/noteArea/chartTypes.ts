export interface Fraction {
    a: number;
    b: number;
}

export interface ChartNote {
    id: string;
    type: number;
    head?: Fraction;
    body?: Fraction[];
    tail?: Fraction;
}

export interface ChartMeasure {
    notes: ChartNote[];
}

export interface ChartSegment {
    time: number;
    tempo: number;
    measures: ChartMeasure[];
}

export interface RawChartSegment {
    time: number;
    tempo: number;
    measures?: ChartMeasure[];
    beats?: ChartMeasure[];
}
