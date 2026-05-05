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
    annotation?: string;
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

export interface NoteLaneData {
    id: string;
    division: number;
    defaultBpm: number;
    chartData: ChartSegment[];
    startTime?: number | null;
    endTime?: number | null;
}
