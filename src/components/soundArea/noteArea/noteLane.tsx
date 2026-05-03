"use client";

import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type Dispatch,
    type KeyboardEvent,
    type MouseEvent,
    type SetStateAction,
} from "react";
import style from "./noteLane.module.css";
import { ChartNote, ChartSegment, Fraction } from "./chartTypes";
import {
    generateNoteId,
    normalizeFraction,
    validateChartData,
} from "./chartAdapter";
import { NoteEditState } from "./noteState";
import { useAppSettings } from "@/components/appSettingsContext";

interface NoteLaneProps {
    chartData: ChartSegment[];
    setChartData: (next: ChartSegment[], saveUndo?: boolean) => boolean;
    timeRange: [number, number];
    beatSubdivision?: number;
    setBeatSubdivision: (next: number) => void;
    height?: number;
    editState: NoteEditState;
    setEditState: Dispatch<SetStateAction<NoteEditState>>;
    songDuration: number;
    onUndo: () => void;
    onRedo: () => void;
    onSnapTimeChange?: (time: number | null) => void;
    selectedMeasureTime?: number | null;
    onSelectMeasure?: (time: number | null) => void;
    onActivate?: () => void;
}

interface NoteAnchor {
    kind: "head" | "body" | "tail";
    time: number;
}

interface GridTick {
    time: number;
    major: boolean;
}

interface NoteHit {
    id: string;
    time: number;
}

interface DragState {
    startSnapTime: number;
    baseChartData: ChartSegment[];
}

const TYPE_COLORS = [
    "#4f46e5",
    "#16a34a",
    "#ea580c",
    "#dc2626",
    "#0ea5e9",
    "#a855f7",
];

function toBeatValue(input: Fraction | undefined): number | null {
    if (
        !input ||
        !Number.isFinite(input.a) ||
        !Number.isFinite(input.b) ||
        input.b === 0
    ) {
        return null;
    }
    return input.a / input.b;
}

function toAnchors(
    note: ChartNote,
    measureStart: number,
    beatDuration: number,
): NoteAnchor[] {
    const anchors: NoteAnchor[] = [];
    const headBeat = toBeatValue(note.head);
    if (headBeat !== null) {
        anchors.push({
            kind: "head",
            time: measureStart + headBeat * beatDuration,
        });
    }

    if (note.body) {
        for (const point of note.body) {
            const beat = toBeatValue(point);
            if (beat !== null) {
                anchors.push({
                    kind: "body",
                    time: measureStart + beat * beatDuration,
                });
            }
        }
    }

    const tailBeat = toBeatValue(note.tail);
    if (tailBeat !== null) {
        anchors.push({
            kind: "tail",
            time: measureStart + tailBeat * beatDuration,
        });
    }

    return anchors.sort((a, b) => a.time - b.time);
}

function colorByType(type: number): string {
    const idx = Math.abs(type) % TYPE_COLORS.length;
    return TYPE_COLORS[idx];
}

function fractionKey(input: Fraction | undefined): string | null {
    const f = normalizeFraction(input);
    if (!f) return null;
    return `${f.a}/${f.b}`;
}

function getAbsoluteMeasureIndex(
    time: number,
    segments: ChartSegment[],
    fallbackBpm: number,
): number {
    let cumulative = 0;
    for (const segment of segments) {
        if (!Number.isFinite(segment.tempo) || segment.tempo <= 0) continue;
        if (segment.measures.length === 0) {
            if (time >= segment.time - 1e-6) return cumulative;
            continue;
        }
        const beatDuration = 60 / segment.tempo;
        const segEnd = segment.time + segment.measures.length * beatDuration;
        if (time >= segment.time - 1e-6 && time < segEnd - 1e-6) {
            const relIndex = Math.floor((time - segment.time) / beatDuration);
            return cumulative + Math.max(0, relIndex);
        }
        cumulative += segment.measures.length;
    }
    const last = segments.at(-1);
    const virtualTempo =
        last && Number.isFinite(last.tempo) && last.tempo > 0
            ? last.tempo
            : fallbackBpm;
    const vb = 60 / virtualTempo;
    const virtualStart = last
        ? last.time + last.measures.length * vb
        : 0;
    const relIndex = Math.floor((time - virtualStart) / vb);
    return cumulative + Math.max(0, relIndex);
}

export default function NoteLane({
    chartData,
    setChartData,
    timeRange,
    beatSubdivision = 4,
    setBeatSubdivision,
    height = 120,
    editState,
    setEditState,
    songDuration,
    onUndo,
    onRedo,
    onSnapTimeChange,
    selectedMeasureTime,
    onSelectMeasure,
    onActivate,
}: NoteLaneProps) {
    const { matchesKeyShortcut } = useAppSettings();
    const wrapperRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [width, setWidth] = useState(1200);
    const [snapTime, setSnapTime] = useState<number | null>(null);
    const [hoverNoteId, setHoverNoteId] = useState<string | null>(null);
    const [lastPastedGhostTimes, setLastPastedGhostTimes] = useState<number[]>(
        [],
    );
    const [anchorSelectionId, setAnchorSelectionId] = useState<string | null>(
        null,
    );
    const [dragState, setDragState] = useState<DragState | null>(null);

    const segments = useMemo(
        () => [...chartData].sort((a, b) => a.time - b.time),
        [chartData],
    );
    const renderValidationError = useMemo(
        () => validateChartData(segments),
        [segments],
    );
    const safeSubdivision = Math.max(1, Math.floor(beatSubdivision));

    const [rangeStart, rangeEnd] = timeRange;
    const span = Math.max(1e-6, rangeEnd - rangeStart);

    const mapTimeToX = useCallback(
        (time: number) => ((time - rangeStart) / span) * width,
        [rangeStart, span, width],
    );
    const mapXToTime = useCallback(
        (x: number) => rangeStart + (x / Math.max(1, width)) * span,
        [rangeStart, span, width],
    );

    const buildGridTicks = useCallback((): GridTick[] => {
        const ticks: GridTick[] = [];
        const maxTime = Math.max(songDuration, rangeEnd);

        for (const segment of segments) {
            if (!Number.isFinite(segment.tempo) || segment.tempo <= 0) continue;
            const beatDuration = 60 / segment.tempo;
            for (let i = 0; i < segment.measures.length; i++) {
                const measureStart = segment.time + i * beatDuration;
                if (
                    measureStart >= rangeStart - beatDuration &&
                    measureStart <= rangeEnd + beatDuration
                ) {
                    ticks.push({ time: measureStart, major: true });
                }
                for (let step = 1; step < safeSubdivision; step++) {
                    const t =
                        measureStart + (step * beatDuration) / safeSubdivision;
                    if (
                        t >= rangeStart - beatDuration &&
                        t <= rangeEnd + beatDuration
                    ) {
                        ticks.push({ time: t, major: false });
                    }
                }
            }
        }

        const last = segments.at(-1);
        const virtualTempo =
            last && Number.isFinite(last.tempo) && last.tempo > 0
                ? last.tempo
                : Math.max(1, editState.currentBpm);
        const beatDuration = 60 / virtualTempo;
        const virtualStart =
            last && Number.isFinite(last.tempo) && last.tempo > 0
                ? last.time + last.measures.length * beatDuration
                : 0;

        for (
            let measureStart = virtualStart;
            measureStart <= maxTime + beatDuration;
            measureStart += beatDuration
        ) {
            if (
                measureStart >= rangeStart - beatDuration &&
                measureStart <= rangeEnd + beatDuration
            ) {
                ticks.push({ time: measureStart, major: true });
            }
            for (let step = 1; step < safeSubdivision; step++) {
                const t =
                    measureStart + (step * beatDuration) / safeSubdivision;
                if (
                    t >= rangeStart - beatDuration &&
                    t <= rangeEnd + beatDuration
                ) {
                    ticks.push({ time: t, major: false });
                }
            }
        }

        ticks.sort((a, b) => a.time - b.time);
        return ticks;
    }, [
        editState.currentBpm,
        rangeEnd,
        rangeStart,
        safeSubdivision,
        segments,
        songDuration,
    ]);

    const gridTicks = useMemo(() => buildGridTicks(), [buildGridTicks]);

    const majorTicks = useMemo(() => {
        const unique: number[] = [];
        for (const tick of gridTicks) {
            if (!tick.major) continue;
            const isDuplicate = unique.some(
                (t) => Math.abs(t - tick.time) <= 1e-6,
            );
            if (!isDuplicate) {
                unique.push(tick.time);
            }
        }
        return unique;
    }, [gridTicks]);

    const selectedMeasureRange = (() => {
        if (selectedMeasureTime === null || selectedMeasureTime === undefined) {
            return null;
        }
        for (const segment of segments) {
            if (!Number.isFinite(segment.tempo) || segment.tempo <= 0) {
                continue;
            }
            const beatDuration = 60 / segment.tempo;
            for (
                let measureIndex = 0;
                measureIndex < segment.measures.length;
                measureIndex++
            ) {
                const measureStart = segment.time + measureIndex * beatDuration;
                const measureEnd = measureStart + beatDuration;
                const isLastMeasure =
                    segment === segments[segments.length - 1] &&
                    measureIndex === segment.measures.length - 1;
                if (
                    selectedMeasureTime >= measureStart - 1e-6 &&
                    (selectedMeasureTime < measureEnd - 1e-6 ||
                        (isLastMeasure &&
                            selectedMeasureTime <= measureEnd + 1e-6))
                ) {
                    return {
                        start: measureStart,
                        end: measureEnd,
                    };
                }
            }
        }
        return null;
    })();

    const getTempoAtTime = useCallback(
        (time: number): number => {
            const sorted = [...segments].sort((a, b) => a.time - b.time);
            for (let i = 0; i < sorted.length; i++) {
                const seg = sorted[i];
                if (!Number.isFinite(seg.tempo) || seg.tempo <= 0) continue;
                if (seg.measures.length === 0) {
                    if (time >= seg.time - 1e-6) return seg.tempo;
                    continue;
                }
                const beatDuration = 60 / seg.tempo;
                const end = seg.time + seg.measures.length * beatDuration;
                if (time >= seg.time - 1e-6 && time < end - 1e-6) {
                    return seg.tempo;
                }
            }
            return Math.max(1, editState.currentBpm);
        },
        [editState.currentBpm, segments],
    );

    const commitChart = useCallback(
        (next: ChartSegment[], saveUndo = true): boolean => {
            return setChartData(next, saveUndo);
        },
        [setChartData],
    );

    const noteHits = useMemo<NoteHit[]>(() => {
        const out: NoteHit[] = [];
        for (
            let segmentIndex = 0;
            segmentIndex < segments.length;
            segmentIndex++
        ) {
            const segment = segments[segmentIndex];
            if (!Number.isFinite(segment.tempo) || segment.tempo <= 0) continue;
            const beatDuration = 60 / segment.tempo;
            for (
                let measureIndex = 0;
                measureIndex < segment.measures.length;
                measureIndex++
            ) {
                const measureStart = segment.time + measureIndex * beatDuration;
                const measure = segment.measures[measureIndex];
                for (
                    let noteIndex = 0;
                    noteIndex < measure.notes.length;
                    noteIndex++
                ) {
                    const note = measure.notes[noteIndex];
                    const anchors = toAnchors(note, measureStart, beatDuration);
                    if (anchors.length === 0) continue;
                    out.push({
                        id: note.id,
                        time: anchors[0].time,
                    });
                }
            }
        }
        return out;
    }, [segments]);

    const findNearestSnapTime = useCallback(
        (time: number): number | null => {
            if (gridTicks.length === 0) return null;
            let best = gridTicks[0].time;
            let bestDist = Math.abs(best - time);
            for (let i = 1; i < gridTicks.length; i++) {
                const t = gridTicks[i].time;
                const dist = Math.abs(t - time);
                if (dist < bestDist) {
                    bestDist = dist;
                    best = t;
                }
            }
            return best;
        },
        [gridTicks],
    );

    const findNearestNote = useCallback(
        (time: number): NoteHit | null => {
            if (noteHits.length === 0) return null;
            let best: NoteHit | null = null;
            let bestDist = Number.POSITIVE_INFINITY;
            for (const hit of noteHits) {
                const dist = Math.abs(hit.time - time);
                if (dist < bestDist) {
                    bestDist = dist;
                    best = hit;
                }
            }
            const pxDist = (bestDist / span) * width;
            return pxDist <= 18 ? best : null;
        },
        [noteHits, span, width],
    );

    const cloneChart = useCallback(
        (data: ChartSegment[]): ChartSegment[] =>
            data.map((segment) => ({
                ...segment,
                measures: segment.measures.map((measure) => ({
                    notes: measure.notes.map((note) => ({
                        ...note,
                        body: note.body ? [...note.body] : undefined,
                    })),
                })),
            })),
        [],
    );

    const resolveInsertTarget = useCallback(
        (baseData: ChartSegment[], absoluteTime: number) => {
            const next = cloneChart(baseData);
            if (next.length === 0) {
                next.push({
                    time: 0,
                    tempo: Math.max(1, editState.currentBpm),
                    measures: [{ notes: [] }],
                });
            }

            if (next[0].time > 0) {
                next[0].time = 0;
            }

            const tailSegment = next[next.length - 1];
            const tailBeatDuration = 60 / Math.max(1, tailSegment.tempo);
            const tailEndTime =
                tailSegment.time +
                tailSegment.measures.length * tailBeatDuration;
            const desiredTempo = Math.max(1, editState.currentBpm);
            if (
                absoluteTime >= tailEndTime &&
                Math.abs(tailSegment.tempo - desiredTempo) > 1e-6
            ) {
                next.push({
                    time: tailEndTime,
                    tempo: desiredTempo,
                    measures: [{ notes: [] }],
                });
            }

            const segmentIndex = next.length - 1;
            const segment = next[segmentIndex];
            const tempo =
                Number.isFinite(segment.tempo) && segment.tempo > 0
                    ? segment.tempo
                    : Math.max(1, editState.currentBpm);
            const beatDuration = 60 / tempo;
            const relative = Math.max(0, absoluteTime - segment.time);
            const measureIndex = Math.floor(relative / beatDuration);
            while (segment.measures.length <= measureIndex) {
                segment.measures.push({ notes: [] });
            }
            const measureStart = segment.time + measureIndex * beatDuration;
            const beat = (absoluteTime - measureStart) / beatDuration;
            return {
                chart: next,
                segmentIndex,
                measureIndex,
                beat,
                beatDuration,
                measureStart,
            };
        },
        [cloneChart, editState.currentBpm],
    );

    const deleteById = useCallback(
        (ids: Set<string>) => {
            if (ids.size === 0) return;
            const next = segments.map((segment) => ({
                ...segment,
                measures: segment.measures.map((measure) => ({
                    notes: measure.notes.filter((note) => !ids.has(note.id)),
                })),
            }));
            if (commitChart(next, true)) {
                setEditState((prev) => ({
                    ...prev,
                    selectedIds: new Set<string>(),
                }));
            }
        },
        [commitChart, segments, setEditState],
    );

    useEffect(() => {
        const target = wrapperRef.current;
        if (!target) {
            return;
        }

        const resize = () => {
            const next = Math.floor(target.clientWidth);
            if (next > 0) {
                setWidth(next);
            }
        };

        resize();
        const observer = new ResizeObserver(resize);
        observer.observe(target);

        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) {
            return;
        }

        const ratio = window.devicePixelRatio || 1;

        canvas.width = Math.max(1, Math.floor(width * ratio));
        canvas.height = Math.max(1, Math.floor(height * ratio));
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
            return;
        }

        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        ctx.clearRect(0, 0, width, height);

        if (renderValidationError) {
            ctx.fillStyle = "#1f1720";
            ctx.fillRect(0, 0, width, height);
            ctx.fillStyle = "#fecaca";
            ctx.font = "13px sans-serif";
            ctx.textAlign = "left";
            ctx.fillText("谱面格式错误，已停止渲染。", 16, 28);
            ctx.fillStyle = "#fca5a5";
            ctx.font = "12px sans-serif";
            ctx.fillText(renderValidationError, 16, 48);
            return;
        }

        ctx.fillStyle = "#0f172a";
        ctx.fillRect(0, 0, width, height);

        if (selectedMeasureRange) {
            const x1 = mapTimeToX(selectedMeasureRange.start);
            const x2 = mapTimeToX(selectedMeasureRange.end);
            ctx.fillStyle = "#1f2937";
            ctx.fillRect(Math.min(x1, x2), 0, Math.abs(x2 - x1), height);
        }

        ctx.strokeStyle = "#1e293b";
        ctx.lineWidth = 1;
        ctx.strokeRect(0.5, 0.5, width - 1, height - 1);

        for (const tick of gridTicks) {
            if (tick.time < rangeStart || tick.time > rangeEnd) continue;
            const x = mapTimeToX(tick.time);
            ctx.strokeStyle = tick.major ? "#94a3b8" : "#334155";
            ctx.lineWidth = tick.major ? 2 : 1;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }

        if (
            snapTime !== null &&
            snapTime >= rangeStart &&
            snapTime <= rangeEnd
        ) {
            const x = mapTimeToX(snapTime);
            ctx.setLineDash([4, 4]);
            ctx.strokeStyle = "#facc15";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        if (
            (editState.mode === "insert-strong" ||
                editState.mode === "insert-weak" ||
                editState.mode === "insert-ln") &&
            snapTime !== null
        ) {
            const x = mapTimeToX(snapTime);
            const y = height / 2;
            ctx.fillStyle =
                editState.mode === "insert-strong"
                    ? "#4f46e566"
                    : editState.mode === "insert-weak"
                      ? "#16a34a66"
                      : "#ea580c66";
            ctx.fillRect(x - 6, y - 8, 12, 16);

            if (
                editState.mode === "insert-ln" &&
                editState.lnHeadTime !== null
            ) {
                const x1 = mapTimeToX(editState.lnHeadTime);
                const x2 = x;
                ctx.fillStyle = "#ea580c55";
                ctx.fillRect(Math.min(x1, x2), y - 2, Math.abs(x2 - x1), 4);
            }
        }

        if (editState.mode === "paste" && snapTime !== null) {
            const y = height / 2;
            const baseTime =
                editState.clipboard.length > 0
                    ? editState.clipboard
                          .map((note) => toBeatValue(note.head) ?? 0)
                          .reduce(
                              (a, b) => Math.min(a, b),
                              Number.POSITIVE_INFINITY,
                          )
                    : 0;
            for (const note of editState.clipboard) {
                const rel = (toBeatValue(note.head) ?? 0) - baseTime;
                const x = mapTimeToX(
                    snapTime + rel * (60 / Math.max(1, editState.currentBpm)),
                );
                ctx.fillStyle = "#38bdf866";
                ctx.fillRect(x - 6, y - 8, 12, 16);
            }
        }

        const centerY = height / 2;

        for (let i = 0; i < majorTicks.length; i++) {
            const beatStart = majorTicks[i];
            if (beatStart < rangeStart || beatStart > rangeEnd) continue;
            const x = mapTimeToX(beatStart);
            const bpm = Math.round(getTempoAtTime(beatStart));
            ctx.fillStyle = "#cbd5e1";
            ctx.font = "10px sans-serif";
            ctx.textAlign = "left";
            ctx.fillText(
                `#${getAbsoluteMeasureIndex(beatStart, segments, editState.currentBpm)}`,
                x + 2,
                11,
            );
            ctx.fillStyle = "#94a3b8";
            ctx.fillText(`♪${bpm}`, x + 2, height - 4);
        }

        for (const segment of segments) {
            if (!Number.isFinite(segment.tempo) || segment.tempo <= 0) {
                continue;
            }

            const beatDuration = 60 / segment.tempo;
            for (
                let measureIndex = 0;
                measureIndex < segment.measures.length;
                measureIndex++
            ) {
                const measureStart = segment.time + measureIndex * beatDuration;
                const measure = segment.measures[measureIndex];

                for (const note of measure.notes) {
                    const anchors = toAnchors(note, measureStart, beatDuration);
                    if (anchors.length === 0) {
                        continue;
                    }

                    const color = colorByType(note.type);
                    const y = centerY;
                    const isSelected = editState.selectedIds.has(note.id);
                    const isHovered =
                        hoverNoteId === note.id && editState.mode === "select";
                    const noteW = isHovered ? 14 : 10;
                    const noteH = 14;

                    if (anchors.length > 1) {
                        const start = anchors[0].time;
                        const end = anchors[anchors.length - 1].time;
                        if (end >= rangeStart && start <= rangeEnd) {
                            const x1 = mapTimeToX(start);
                            const x2 = mapTimeToX(end);
                            ctx.fillStyle = `${color}88`;
                            ctx.fillRect(
                                Math.min(x1, x2),
                                y - 2,
                                Math.abs(x2 - x1),
                                4,
                            );
                        }
                    }

                    for (const anchor of anchors) {
                        if (
                            anchor.time < rangeStart ||
                            anchor.time > rangeEnd
                        ) {
                            continue;
                        }

                        const x = mapTimeToX(anchor.time);
                        const selectedColor = isSelected ? `${color}aa` : color;
                        ctx.fillStyle =
                            anchor.kind === "body"
                                ? `${selectedColor}cc`
                                : anchor.kind === "tail"
                                  ? "#f8fafc"
                                  : selectedColor;
                        if (anchor.kind !== "body") {
                            ctx.fillRect(
                                x - noteW / 2,
                                y - noteH / 2,
                                noteW,
                                noteH,
                            );
                        }
                    }
                }
            }
        }

        if (lastPastedGhostTimes.length > 0) {
            ctx.fillStyle = "#38bdf855";
            for (const t of lastPastedGhostTimes) {
                if (t < rangeStart || t > rangeEnd) continue;
                const x = mapTimeToX(t);
                ctx.fillRect(x - 6, centerY - 8, 12, 16);
            }
        }
    }, [
        majorTicks,
        editState.clipboard,
        editState.currentBpm,
        editState.lnHeadTime,
        editState.mode,
        editState.selectedIds,
        getTempoAtTime,
        gridTicks,
        height,
        hoverNoteId,
        lastPastedGhostTimes,
        mapTimeToX,
        rangeEnd,
        rangeStart,
        selectedMeasureRange,
        safeSubdivision,
        segments,
        renderValidationError,
        snapTime,
        width,
    ]);

    const updatePointer = useCallback(
        (clientX: number) => {
            const rect = canvasRef.current?.getBoundingClientRect();
            if (!rect)
                return {
                    time: null as number | null,
                    note: null as NoteHit | null,
                };
            const x = clientX - rect.left;
            const time = mapXToTime(Math.max(0, Math.min(rect.width, x)));
            const snapped = findNearestSnapTime(time);
            const nearest = findNearestNote(time);
            setSnapTime((prev) => (prev === snapped ? prev : snapped));
            const nextHoverId = nearest?.id ?? null;
            setHoverNoteId((prev) =>
                prev === nextHoverId ? prev : nextHoverId,
            );
            return { time: snapped, note: nearest };
        },
        [findNearestNote, findNearestSnapTime, mapXToTime],
    );

    const moveSelectedNotes = useCallback(
        (baseData: ChartSegment[], deltaTime: number): ChartSegment[] => {
            const ids = editState.selectedIds;
            if (ids.size === 0) return baseData;
            const moved = cloneChart(baseData);

            for (const segment of moved) {
                const beatDuration = 60 / Math.max(1, segment.tempo);
                for (
                    let measureIndex = 0;
                    measureIndex < segment.measures.length;
                    measureIndex++
                ) {
                    const measureStart =
                        segment.time + measureIndex * beatDuration;
                    const measure = segment.measures[measureIndex];
                    for (const note of measure.notes) {
                        if (!ids.has(note.id)) continue;
                        const head = toBeatValue(note.head);
                        if (head !== null) {
                            const abs =
                                measureStart + head * beatDuration + deltaTime;
                            const newBeat = Math.max(
                                0,
                                (abs - measureStart) / beatDuration,
                            );
                            note.head = {
                                a: Math.round(newBeat * 10000),
                                b: 10000,
                            };
                        }
                        const tail = toBeatValue(note.tail);
                        if (tail !== null) {
                            const absTail =
                                measureStart + tail * beatDuration + deltaTime;
                            const newTail = Math.max(
                                0,
                                (absTail - measureStart) / beatDuration,
                            );
                            note.tail = {
                                a: Math.round(newTail * 10000),
                                b: 10000,
                            };
                        }
                    }
                }
            }

            return moved;
        },
        [cloneChart, editState.selectedIds],
    );

    const handleLeftClickAtSnap = useCallback(
        (time: number) => {
            if (editState.mode === "browse") return;
            if (time < 0) return;

            if (
                editState.mode === "insert-strong" ||
                editState.mode === "insert-weak"
            ) {
                const target = resolveInsertTarget(segments, time);
                const note: ChartNote = {
                    id: generateNoteId(),
                    type: editState.mode === "insert-strong" ? 0 : 1,
                    head: { a: Math.round(target.beat * 10000), b: 10000 },
                };
                const insertKey = fractionKey(note.head);
                const occupied = new Set(
                    target.chart[target.segmentIndex].measures[
                        target.measureIndex
                    ].notes
                        .map((n) => fractionKey(n.head))
                        .filter((k): k is string => k !== null),
                );
                if (insertKey && occupied.has(insertKey)) {
                    return;
                }
                target.chart[target.segmentIndex].measures[
                    target.measureIndex
                ].notes.push(note);
                commitChart(target.chart, true);
                return;
            }

            if (editState.mode === "insert-ln") {
                if (editState.lnHeadTime === null) {
                    setEditState((prev) => ({ ...prev, lnHeadTime: time }));
                    return;
                }
                const start = Math.min(editState.lnHeadTime, time);
                const end = Math.max(editState.lnHeadTime, time);
                const target = resolveInsertTarget(segments, start);
                const startBeat = target.beat;
                const endBeat =
                    (end - target.measureStart) / target.beatDuration;
                const note: ChartNote = {
                    id: generateNoteId(),
                    type: 2,
                    head: { a: Math.round(startBeat * 10000), b: 10000 },
                    tail: {
                        a: Math.round(Math.max(startBeat, endBeat) * 10000),
                        b: 10000,
                    },
                };
                const insertKey = fractionKey(note.head);
                const occupied = new Set(
                    target.chart[target.segmentIndex].measures[
                        target.measureIndex
                    ].notes
                        .map((n) => fractionKey(n.head))
                        .filter((k): k is string => k !== null),
                );
                if (insertKey && occupied.has(insertKey)) {
                    setEditState((prev) => ({ ...prev, lnHeadTime: null }));
                    return;
                }
                target.chart[target.segmentIndex].measures[
                    target.measureIndex
                ].notes.push(note);
                if (commitChart(target.chart, true)) {
                    setEditState((prev) => ({ ...prev, lnHeadTime: null }));
                }
                return;
            }

            if (editState.mode === "paste") {
                if (editState.clipboard.length === 0) return;
                const target = resolveInsertTarget(segments, time);
                const pastedTimes: number[] = [];
                const stepBeat = 1 / Math.max(1, safeSubdivision);
                for (let i = 0; i < editState.clipboard.length; i++) {
                    const copy = editState.clipboard[i];
                    const headBeat = target.beat + i * stepBeat;
                    const tailBeat =
                        copy.tail && copy.head
                            ? headBeat +
                              ((toBeatValue(copy.tail) ?? 0) -
                                  (toBeatValue(copy.head) ?? 0))
                            : undefined;
                    const note: ChartNote = {
                        ...copy,
                        id: generateNoteId(),
                        head: { a: Math.round(headBeat * 10000), b: 10000 },
                        tail:
                            tailBeat !== undefined
                                ? {
                                      a: Math.round(
                                          Math.max(headBeat, tailBeat) * 10000,
                                      ),
                                      b: 10000,
                                  }
                                : undefined,
                    };
                    target.chart[target.segmentIndex].measures[
                        target.measureIndex
                    ].notes.push(note);
                    pastedTimes.push(
                        target.measureStart + headBeat * target.beatDuration,
                    );
                }
                if (commitChart(target.chart, true)) {
                    setLastPastedGhostTimes(pastedTimes);
                }
                return;
            }
        },
        [
            commitChart,
            editState.clipboard,
            editState.lnHeadTime,
            editState.mode,
            resolveInsertTarget,
            safeSubdivision,
            segments,
            setEditState,
        ],
    );

    const handleMouseMove = useCallback(
        (e: MouseEvent<HTMLCanvasElement>) => {
            if (renderValidationError) {
                return;
            }
            const { time } = updatePointer(e.clientX);
            if (dragState && time !== null) {
                const delta = time - dragState.startSnapTime;
                const moved = moveSelectedNotes(dragState.baseChartData, delta);
                commitChart(moved, false);
            }
        },
        [
            commitChart,
            dragState,
            moveSelectedNotes,
            renderValidationError,
            updatePointer,
        ],
    );

    const handleMouseDown = useCallback(
        (e: MouseEvent<HTMLCanvasElement>) => {
            if (renderValidationError) {
                return;
            }
            if (e.button !== 0) return;
            onActivate?.();
            canvasRef.current?.focus();
            const { time, note } = updatePointer(e.clientX);
            if (time === null) return;
            onSelectMeasure?.(time);

            if (editState.mode === "select") {
                if (note) {
                    if (e.shiftKey && anchorSelectionId) {
                        const sorted = [...noteHits].sort(
                            (a, b) => a.time - b.time,
                        );
                        const a = sorted.findIndex(
                            (h) => h.id === anchorSelectionId,
                        );
                        const b = sorted.findIndex((h) => h.id === note.id);
                        if (a >= 0 && b >= 0) {
                            const [start, end] = a < b ? [a, b] : [b, a];
                            const rangeSet = new Set(
                                sorted.slice(start, end + 1).map((h) => h.id),
                            );
                            setEditState((prev) => ({
                                ...prev,
                                selectedIds: rangeSet,
                            }));
                        }
                    } else if (e.ctrlKey) {
                        setEditState((prev) => {
                            const next = new Set(prev.selectedIds);
                            if (next.has(note.id)) next.delete(note.id);
                            else next.add(note.id);
                            return { ...prev, selectedIds: next };
                        });
                        setAnchorSelectionId(note.id);
                    } else {
                        setEditState((prev) => {
                            const alreadyOnlyThis =
                                prev.selectedIds.size === 1 &&
                                prev.selectedIds.has(note.id);
                            return {
                                ...prev,
                                selectedIds: alreadyOnlyThis
                                    ? new Set<string>()
                                    : new Set<string>([note.id]),
                            };
                        });
                        setAnchorSelectionId(note.id);
                    }

                    if (editState.selectedIds.has(note.id)) {
                        setDragState({
                            startSnapTime: time,
                            baseChartData: cloneChart(segments),
                        });
                    }
                } else if (!e.ctrlKey && !e.shiftKey) {
                    setEditState((prev) => ({
                        ...prev,
                        selectedIds: new Set<string>(),
                    }));
                }
                return;
            }

            handleLeftClickAtSnap(time);
        },
        [
            anchorSelectionId,
            cloneChart,
            editState.mode,
            editState.selectedIds,
            handleLeftClickAtSnap,
            noteHits,
            onActivate,
            segments,
            setEditState,
            updatePointer,
            onSelectMeasure,
            renderValidationError,
        ],
    );

    const handleMouseUp = useCallback(() => {
        if (dragState) {
            const moved = moveSelectedNotes(
                dragState.baseChartData,
                (snapTime ?? dragState.startSnapTime) - dragState.startSnapTime,
            );
            commitChart(moved, true);
            setDragState(null);
        }
    }, [commitChart, dragState, moveSelectedNotes, snapTime]);

    const handleContextMenu = useCallback(
        (e: MouseEvent<HTMLCanvasElement>) => {
            if (renderValidationError) {
                return;
            }
            e.preventDefault();
            const { note } = updatePointer(e.clientX);
            if (note) {
                deleteById(new Set<string>([note.id]));
            }
        },
        [deleteById, renderValidationError, updatePointer],
    );

    const handleKeyDown = useCallback(
        (e: KeyboardEvent<HTMLCanvasElement>) => {
            const modeActions: Array<{
                action:
                    | "note.mode.browse"
                    | "note.mode.insertStrong"
                    | "note.mode.insertWeak"
                    | "note.mode.insertLn"
                    | "note.mode.select"
                    | "note.mode.paste";
                mode: NoteEditState["mode"];
            }> = [
                { action: "note.mode.browse", mode: "browse" },
                { action: "note.mode.insertStrong", mode: "insert-strong" },
                { action: "note.mode.insertWeak", mode: "insert-weak" },
                { action: "note.mode.insertLn", mode: "insert-ln" },
                { action: "note.mode.select", mode: "select" },
                { action: "note.mode.paste", mode: "paste" },
            ];

            for (const item of modeActions) {
                if (!matchesKeyShortcut(item.action, e.nativeEvent)) {
                    continue;
                }

                e.preventDefault();
                setEditState((prev) => ({
                    ...prev,
                    mode: item.mode,
                    lnHeadTime: null,
                }));
                return;
            }

            if (
                matchesKeyShortcut("note.division.increment", e.nativeEvent)
            ) {
                e.preventDefault();
                setBeatSubdivision(Math.min(64, safeSubdivision + 1));
                return;
            }

            if (
                matchesKeyShortcut("note.division.decrement", e.nativeEvent)
            ) {
                e.preventDefault();
                setBeatSubdivision(Math.max(1, safeSubdivision - 1));
                return;
            }

            if (e.ctrlKey && (e.key === "z" || e.key === "Z")) {
                e.preventDefault();
                onUndo();
                return;
            }
            if (e.ctrlKey && (e.key === "y" || e.key === "Y")) {
                e.preventDefault();
                onRedo();
                return;
            }
            if (e.key === "Delete") {
                if (editState.selectedIds.size > 0) {
                    e.preventDefault();
                    deleteById(new Set(editState.selectedIds));
                    return;
                }
                if (hoverNoteId) {
                    e.preventDefault();
                    deleteById(new Set<string>([hoverNoteId]));
                }
            }
        },
        [
            deleteById,
            editState.selectedIds,
            hoverNoteId,
            matchesKeyShortcut,
            onRedo,
            onUndo,
            safeSubdivision,
            setBeatSubdivision,
            setEditState,
        ],
    );

    useEffect(() => {
        onSnapTimeChange?.(snapTime);
    }, [onSnapTimeChange, snapTime]);

    return (
        <div
            className={style.noteLaneRoot}
            onClick={(e) => e.stopPropagation()}
        >
            <div className={style.noteLaneCanvasWrap} ref={wrapperRef}>
                <canvas
                    ref={canvasRef}
                    className={style.noteLaneCanvas}
                    onMouseMove={handleMouseMove}
                    onMouseDown={handleMouseDown}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onContextMenu={handleContextMenu}
                    onKeyDown={handleKeyDown}
                    tabIndex={0}
                />
                {renderValidationError && (
                    <div className={style.noteLaneOverlay}>
                        <div className={style.noteLaneOverlayTitle}>
                            渲染已暂停
                        </div>
                        <div className={style.noteLaneOverlayText}>
                            {renderValidationError}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
