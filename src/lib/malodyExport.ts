import { NoteLaneData } from "@/components/soundArea/noteArea/chartTypes";

interface Fraction {
    a: number;
    b: number;
}

interface MalodyChart {
    meta: {
        $ver: number;
        creator: string;
        background: string;
        version: string;
        preview: number;
        id: number;
        mode: number;
        time: number;
        song: {
            title: string;
            artist: string;
            id: number;
            titleorg: string;
            artistorg: string;
        };
        mode_ext: {
            column: number;
            bar_begin: number;
        };
    };
    time: Array<{ beat: [number, number, number]; bpm: number }>;
    effect: never[];
    note: Array<{
        beat: [number, number, number];
        endbeat?: [number, number, number];
        column: number;
    }>;
    extra: {
        test: {
            divide: number;
            speed: number;
            save: number;
            lock: number;
            edit_mode: number;
        };
    };
}

function fractionToBeat(
    globalMeasureIndex: number,
    fraction: Fraction | undefined,
    division: number,
): [number, number, number] {
    if (
        !fraction ||
        !Number.isFinite(fraction.a) ||
        !Number.isFinite(fraction.b) ||
        fraction.b === 0
    ) {
        return [globalMeasureIndex, 0, division];
    }
    const beatValue = fraction.a / fraction.b;
    const measureOffset = Math.floor(beatValue);
    const positionInMeasure = beatValue - measureOffset;
    const bar = globalMeasureIndex + measureOffset;
    const numerator = Math.round(positionInMeasure * division);
    return [bar, numerator, division];
}

function beatSortKey(beat: [number, number, number]): number {
    return beat[0] * beat[2] + beat[1];
}

export function convertToMalody(
    noteLaneData: NoteLaneData,
    audioFilename: string,
): string {
    const division = noteLaneData.division;
    const notes: MalodyChart["note"] = [];
    const timeEntries: MalodyChart["time"] = [];
    let globalMeasureIndex = 0;

    for (const segment of noteLaneData.chartData) {
        timeEntries.push({
            beat: [globalMeasureIndex, 0, division],
            bpm: segment.tempo,
        });

        for (const measure of segment.measures) {
            for (const note of measure.notes) {
                const beat = fractionToBeat(
                    globalMeasureIndex,
                    note.head,
                    division,
                );

                if (note.type === 2 && note.tail) {
                    const endbeat = fractionToBeat(
                        globalMeasureIndex,
                        note.tail,
                        division,
                    );
                    notes.push({ beat, endbeat, column: 0 });
                } else {
                    notes.push({ beat, column: 0 });
                }
            }
            globalMeasureIndex++;
        }
    }

    notes.sort((a, b) => beatSortKey(a.beat) - beatSortKey(b.beat));

    const chart: MalodyChart = {
        meta: {
            $ver: 0,
            creator: "",
            background: audioFilename,
            version: "",
            preview: 0,
            id: 0,
            mode: 0,
            time: 0,
            song: {
                title: audioFilename,
                artist: audioFilename,
                id: 0,
                titleorg: audioFilename,
                artistorg: audioFilename,
            },
            mode_ext: {
                column: 0,
                bar_begin: 0,
            },
        },
        time: timeEntries,
        effect: [],
        note: notes,
        extra: {
            test: {
                divide: division,
                speed: 100,
                save: 0,
                lock: 0,
                edit_mode: 0,
            },
        },
    };

    return JSON.stringify(chart, null, 2);
}
