"use client";

import {
    useCallback,
    useEffect,
    useId,
    useMemo,
    useRef,
    useState,
    type Dispatch,
    type KeyboardEvent,
    type PointerEvent,
    type SetStateAction,
} from "react";
import { useAppSettings } from "@/components/appSettingsContext";
import type { TimelineOrientation } from "@/components/timelineGeometry";
import type { ShortcutAction } from "@/lib/shortcuts";
import {
    collectWdsNotes,
    alignWdsBodyRecords,
    copyWdsNotes,
    expandWdsBodySelection,
    findWdsNoteBody,
    generateNoteId,
    getWdsBodyLinks,
    insertWdsNote,
    moveWdsNotes,
    normalizeFraction,
    pasteWdsNotes,
    removeWdsNotes,
    resizeWdsNoteWidth,
    wdsBeatToTime,
    wdsTimeToBeat,
    updateWdsNotes,
    type CollectedWdsNote,
} from "./chartAdapter";
import type { ChartMeasureRef, ChartNote, ChartSegment } from "./chartTypes";
import type { EditMode, NoteEditState } from "./noteState";
import {
    defaultWdsProperties,
    getWdsScratchSpan,
    getWdsScratchDirection,
    isWdsHoldType,
    isWdsJumpScratch,
    isWdsScratchType,
    WDS_LANE_COUNT,
    WDS_NOTE_TYPES,
} from "./wdsTypes";
import style from "./wdsLane.module.css";

export interface WdsLaneProps {
    chartData: ChartSegment[];
    setChartData: (
        next: ChartSegment[],
        saveUndo?: boolean,
        undoBase?: ChartSegment[],
    ) => boolean;
    timeRange: [number, number];
    beatSubdivision?: number;
    setBeatSubdivision: (next: number) => void;
    height?: number;
    orientation?: TimelineOrientation;
    timelineHeight?: number;
    editState: NoteEditState;
    setEditState: Dispatch<SetStateAction<NoteEditState>>;
    songDuration: number;
    onUndo: () => void;
    onRedo: () => void;
    onSnapTimeChange?: (time: number | null) => void;
    selectedMeasureRef?: ChartMeasureRef | null;
    onSelectMeasure?: (ref: ChartMeasureRef | null) => void;
    onActivate?: () => void;
    laneId: string;
    graphicalOffset?: number;
    playheadTime?: number | null;
    isPlaybackFrozen?: boolean;
    onInsertMeasure?: (ref?: ChartMeasureRef) => void;
    onDeleteMeasure?: (ref?: ChartMeasureRef) => void;
    onError?: (message: string) => void;
    onRequestVertical?: () => void;
}

const GUTTER = 48;
const COLUMN = 32;
const WIDTH = GUTTER + WDS_LANE_COUNT * COLUMN;
const NOTE_RADIUS = 8;
const REGISTRY = new Map(WDS_NOTE_TYPES.map((type) => [type.code, type]));
const MODE_SHORTCUTS: { action: ShortcutAction; mode: EditMode; type?: number }[] = [
    { action: "note.mode.browse", mode: "browse" },
    { action: "note.mode.insertStrong", mode: "insert-wds", type: 10 },
    { action: "note.mode.insertWeak", mode: "insert-wds", type: 20 },
    { action: "note.mode.insertLn", mode: "insert-wds", type: 100 },
    { action: "note.mode.insertWds", mode: "insert-wds" },
    { action: "note.mode.select", mode: "select" },
    { action: "note.mode.paste", mode: "paste" },
    { action: "note.mode.annotate", mode: "annotate" },
];

interface Cursor {
    beat: number;
    time: number;
    lane: number;
    x: number;
    y: number;
}

interface PendingPlacement {
    note: ChartNote;
    beat: number;
    propertiesKey: string;
}

interface Drag {
    pointerId: number;
    base: ChartSegment[];
    ids: string[];
    kind: "move" | "tail" | "width";
    start: Cursor;
    startClientX: number;
    startClientY: number;
    /** Freeze the pointer-down projection so layout changes cannot move notes. */
    startTime: number;
    timePerPixel: number;
    xPerPixel: number;
    defaultBpm: number;
    subdivision: number;
    deltaBeat: number;
    laneDelta: number;
    resizeEdge: "left" | "right";
    resizePart: "note" | "tail";
    widthDelta: number;
    moved: boolean;
}

interface PaintedNote {
    record: CollectedWdsNote;
    x: number;
    width: number;
    headY: number;
    tailY: number | null;
    tailX: number;
    tailWidth: number;
    invalid: boolean;
}

type WidthHandlePart = "width-left" | "width-right" | "tail-width-left" | "tail-width-right";

interface NoteHit {
    note: PaintedNote;
    part: "head" | "body" | "tail" | WidthHandlePart;
    distance: number;
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function describeNote(note: ChartNote): string {
    const p = note.wds!;
    const type = REGISTRY.get(note.type);
    const body = isWdsHoldType(note.type)
        ? `，身子和尾巴，自动 Tick ${p.autoTicks ? "开" : "关"}`
        : "";
    const span = isWdsJumpScratch(p) ? getWdsScratchSpan(p) : null;
    return `${note.type} ${type?.label ?? "WDS"} · 列 ${p.lane}–${p.lane + p.width - 1}${body}${p.gimmickType !== "0" ? `，${p.gimmickType} ${p.gimmickValue}` : ""}${span ? `（划动 ${span.lane}–${span.lane + span.width - 1} 列）` : ""}${note.annotation ? ` · ${note.annotation}` : ""}`;
}

function paintNote(
    record: CollectedWdsNote,
    timeToY: (time: number) => number,
    invalid = false,
): PaintedNote {
    const p = record.note.wds!;
    const tail = getWdsScratchSpan(p);
    const pointSpan = !isWdsHoldType(record.note.type) && isWdsScratchType(record.note.type) ? tail : null;
    return {
        record,
        x: GUTTER + ((pointSpan?.lane ?? p.lane) - 1) * COLUMN + 2,
        width: Math.max(1, (pointSpan?.width ?? p.width) * COLUMN - 4),
        headY: timeToY(record.time),
        tailY: record.endTime === null ? null : timeToY(record.endTime),
        tailX: GUTTER + ((tail?.lane ?? p.lane) - 1) * COLUMN + 2,
        tailWidth: Math.max(1, (tail?.width ?? p.width) * COLUMN - 4),
        invalid: invalid || !tail,
    };
}

function isWidthHandle(part: NoteHit["part"]): part is WidthHandlePart {
    return part === "width-left" || part === "width-right" || part === "tail-width-left" || part === "tail-width-right";
}

/** The same handle geometry drives rendering and hit testing. A hold's body
 * handles stay away from the independent start key and the tail handles. */
function widthHandles(note: PaintedNote, viewportHeight: number): { part: WidthHandlePart; x: number; y: number }[] {
    const handles: { part: WidthHandlePart; x: number; y: number }[] = [];
    const { x, width, headY, tailY, tailX, tailWidth } = note;
    const pair = (left: number, span: number, y: number, tail = false) => {
        if (y < 0 || y > viewportHeight) return;
        handles.push({ part: tail ? "tail-width-left" : "width-left", x: left, y },
            { part: tail ? "tail-width-right" : "width-right", x: left + span, y });
    };
    if (tailY === null) pair(x, width, headY);
    else {
        const top = Math.max(0, tailY + 18), bottom = Math.min(viewportHeight, headY - 18);
        if (bottom >= top) pair(x, width, (top + bottom) / 2);
        pair(tailX, tailWidth, tailY, true);
    }
    return handles;
}

/** Each hold stays one SVG group, including its expanded signed tail span. */
function NoteGlyph({
    painted,
    selected,
    hovered,
    preview = false,
    resizable = false,
    viewportHeight,
}: {
    painted: PaintedNote;
    selected: boolean;
    hovered: boolean;
    preview?: boolean;
    resizable?: boolean;
    viewportHeight: number;
}) {
    const { record, x, width, headY, tailY, tailX, tailWidth, invalid } = painted;
    const { note } = record;
    const p = note.wds!;
    const type = REGISTRY.get(note.type);
    const color = invalid ? "#ef4444" : type?.color ?? "#94a3b8";
    const hold = isWdsHoldType(note.type);
    const stroke = selected ? "#f8fafc" : hovered ? "#cbd5e1" : "#1e293b";
    const label = width > 95 ? `${note.type} ${type?.label ?? ""}` : String(note.type);
    const sound = note.type === 30 || note.type === 31;
    const judge = note.type === 900;
    const headVisible = headY >= -NOTE_RADIUS && headY <= viewportHeight + NOTE_RADIUS;
    const tailVisible = tailY !== null && tailY >= -NOTE_RADIUS && tailY <= viewportHeight + NOTE_RADIUS;
    const bodyTop = Math.max(-NOTE_RADIUS, Math.min(headY, tailY ?? headY));
    const bodyBottom = Math.min(viewportHeight + NOTE_RADIUS, Math.max(headY, tailY ?? headY));
    const scratch = isWdsScratchType(note.type) || (hold && isWdsJumpScratch(p));
    const scratchDirection = getWdsScratchDirection(p);
    const jump = scratch && isWdsJumpScratch(p);
    const directed = scratch && (!hold || p.gimmickType !== "0");
    const direction = scratchDirection === "left" ? "←" : scratchDirection === "right" ? "→" : "↔";
    return (
        <g
            className={style.note}
            data-note-id={preview ? undefined : note.id}
            data-note-type={note.type}
            data-scratch-direction={directed ? scratchDirection : undefined}
            data-jump-scratch={jump || undefined}
            data-selected={selected || undefined}
            role={preview ? undefined : "button"}
            tabIndex={preview ? undefined : 0}
            aria-label={preview ? undefined : describeNote(note)}
            aria-pressed={preview ? undefined : selected}
            aria-hidden={preview || undefined}
            opacity={preview ? 0.65 : 1}
            pointerEvents={preview ? "none" : undefined}
        >
            <title>{describeNote(note)} · 第 {(record.beat + 1).toFixed(3)} 拍</title>
            {tailY !== null && bodyBottom >= bodyTop && (
                <rect
                    data-note-part="body"
                    x={x + 2} y={bodyTop} width={Math.max(1, width - 4)} height={bodyBottom - bodyTop}
                    fill={color} fillOpacity={0.27} stroke={selected ? stroke : color}
                    strokeWidth={selected ? 2 : 1} strokeDasharray={preview ? "4 3" : undefined}
                />
            )}
            {tailVisible && tailY !== null && (
                <g data-note-part="tail">
                    <rect
                        x={tailX} y={tailY - 6} width={tailWidth} height={12} rx={2}
                        fill={color} stroke={stroke} strokeWidth={selected ? 2 : 1}
                    />
                    <text x={tailX + tailWidth / 2} y={tailY + 4} className={style.noteText}>
                        {directed ? direction : "━"}
                    </text>
                </g>
            )}
            {hold && headVisible && (selected || hovered || preview) && (
                <line data-note-part="start" x1={x + 2} x2={x + width - 2} y1={headY} y2={headY}
                    stroke={stroke} strokeDasharray="3 2" pointerEvents="none" />
            )}
            {!hold && headVisible && (
                <g data-note-part="head">
                    {sound && resizable && (selected || hovered) && (
                        <rect x={x} y={headY - 9} width={width} height={18}
                            fill="none" stroke={stroke} strokeDasharray="3 2" />
                    )}
                    {sound ? (
                        <path
                            d={`M ${x + width / 2} ${headY - 10} l 3 7 l 7 3 l -7 3 l -3 7 l -3 -7 l -7 -3 l 7 -3 Z`}
                            fill={color} stroke={stroke} strokeWidth={selected ? 2 : 1}
                        />
                    ) : (
                        <rect
                            x={x} y={headY - 7} width={width} height={14}
                            rx={2}
                            fill={judge ? "transparent" : color}
                            stroke={judge && !selected && !hovered ? color : stroke}
                            strokeWidth={selected ? 2 : 1}
                        />
                    )}
                    {note.type === 50 && (
                        <line x1={x + width * 0.25} x2={x + width * 0.75} y1={headY} y2={headY}
                            stroke="#ffe168" strokeWidth={2} />
                    )}
                    {scratch && !hold && (
                        <text x={x + width / 2} y={headY - 11} className={style.scratchArrow}>{direction}</text>
                    )}
                    {!sound && !judge && !scratch && (
                        <text
                            x={x + width / 2} y={headY + 3.5} className={style.noteText}
                            textLength={label.length * 5.5 > width - 6 ? width - 6 : undefined}
                            lengthAdjust="spacingAndGlyphs"
                        >{label}</text>
                    )}
                </g>
            )}
            {resizable && (selected || hovered) && widthHandles(painted, viewportHeight).map(({ part, x, y }) => (
                <g key={part} data-note-part={part}>
                    <rect x={x - 7} y={y - 12} width={14} height={24} fill="transparent" />
                    <rect x={x - 3} y={y - 9} width={6} height={18} rx={2} fill="#f8fafc" stroke={color} />
                    <title>{part.startsWith("tail-") ? "拖动调整尾部 JumpScratch 属性" : "拖动调整音符宽度"} · {part.endsWith("left") ? "左边缘" : "右边缘"}</title>
                </g>
            ))}
            {headVisible && note.annotation && (
                <text x={x + 2} y={headY - 12} className={style.annotation}>
                    {note.annotation.length > 48 ? `${note.annotation.slice(0, 48)}…` : note.annotation}
                </text>
            )}
        </g>
    );
}

export default function WdsLane({
    chartData,
    setChartData,
    timeRange,
    beatSubdivision = 4,
    setBeatSubdivision,
    height = 120,
    orientation = "horizontal",
    timelineHeight = 640,
    editState,
    setEditState,
    songDuration,
    onUndo,
    onRedo,
    onSnapTimeChange,
    selectedMeasureRef,
    onSelectMeasure,
    onActivate,
    laneId,
    graphicalOffset = 0,
    playheadTime,
    isPlaybackFrozen = false,
    onInsertMeasure,
    onDeleteMeasure,
    onError,
    onRequestVertical,
}: WdsLaneProps) {
    const { matchesKeyShortcut } = useAppSettings();
    const rootRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    const dragRef = useRef<Drag | null>(null);
    const cycleRef = useRef({ key: "", index: -1 });
    const helpId = useId();
    const [cursor, setCursor] = useState<Cursor | null>(null);
    const [hoverId, setHoverId] = useState<string | null>(null);
    const [pendingDraft, setPending] = useState<PendingPlacement | null>(null);
    const [drag, setDrag] = useState<Drag | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [clickedBeat, setClickedBeat] = useState<number | null>(null);
    const propertiesKey = [editState.wdsProperties.lane, editState.wdsProperties.width,
        editState.wdsProperties.gimmickType, editState.wdsProperties.gimmickValue,
        editState.wdsProperties.autoTicks].join(":");
    // Ignore a previous tool's draft immediately, before the cleanup effect runs.
    const pending = editState.mode === "insert-wds" && pendingDraft?.note.type === editState.wdsType &&
        pendingDraft.propertiesKey === propertiesKey
        ? pendingDraft : null;
    const isVertical = orientation === "vertical";
    const canEdit = isVertical && !isPlaybackFrozen && editState.mode !== "browse";
    const canResize = canEdit && !pending;
    const defaultBpm = editState.currentBpm;
    const subdivision = Number.isFinite(beatSubdivision) ? Math.max(1, Math.min(64, Math.floor(beatSubdivision))) : 4;
    const viewHeight = Math.max(1, timelineHeight);
    const [rangeStart, rangeEnd] = timeRange;
    const span = Math.max(1e-6, rangeEnd - rangeStart);

    const reportError = useCallback((reason: unknown) => {
        const message = errorMessage(reason);
        setError(message);
        onError?.(message);
    }, [onError]);

    const timeToY = useCallback((time: number) => (
        viewHeight * (1 - (time + graphicalOffset - rangeStart) / span)
    ), [viewHeight, graphicalOffset, rangeStart, span]);

    // All read adapters are protected too: invalid imported data is an inline error.
    const collected = useMemo(() => {
        try {
            return { notes: collectWdsNotes(chartData, defaultBpm), error: null };
        } catch (reason) {
            return { notes: [] as CollectedWdsNote[], error: errorMessage(reason) };
        }
    }, [chartData, defaultBpm]);
    const bodyLinks = useMemo(() => getWdsBodyLinks(collected.notes), [collected.notes]);

    const tempoSegments = useMemo(() => {
        if (collected.error) return [];
        let beat = 0;
        return chartData.map((segment, segmentIndex) => {
            const start = beat;
            beat += segment.measures.length;
            return { start, end: beat, tempo: segment.tempo, segmentIndex };
        });
    }, [chartData, collected.error]);

    function measureAt(beat: number): ChartMeasureRef | null {
        const index = Math.floor(beat + 1e-9);
        const segment = tempoSegments.find((item) => index >= item.start && index < item.end);
        return segment ? {
            globalIndex: index,
            segmentIndex: segment.segmentIndex,
            measureIndex: index - segment.start,
        } : null;
    }

    function bpmAt(beat: number): number {
        return tempoSegments.find((item) => beat >= item.start && beat < item.end)?.tempo ?? defaultBpm;
    }

    function cancelDrag() {
        const active = dragRef.current;
        dragRef.current = null;
        setDrag(null);
        if (active && svgRef.current?.hasPointerCapture(active.pointerId)) {
            svgRef.current.releasePointerCapture(active.pointerId);
        }
    }

    // Changing WDS type is also a tool change, even inside insert-wds mode.
    useEffect(() => {
        let cancelled = false;
        queueMicrotask(() => {
            if (cancelled) return;
            const active = dragRef.current;
            dragRef.current = null;
            setDrag(null);
            setPending(null);
            setCursor(null);
            setHoverId(null);
            if (active && svgRef.current?.hasPointerCapture(active.pointerId)) {
                svgRef.current.releasePointerCapture(active.pointerId);
            }
        });
        return () => { cancelled = true; };
    }, [editState.mode, editState.wdsType, propertiesKey, isPlaybackFrozen, orientation, laneId]);

    const snapTime = !isPlaybackFrozen && isVertical ? cursor?.time ?? null : null;
    useEffect(() => {
        onSnapTimeChange?.(snapTime === null ? null : snapTime + graphicalOffset);
        return () => onSnapTimeChange?.(null);
    }, [onSnapTimeChange, snapTime, graphicalOffset]);

    const paintedNotes = useMemo(() => {
        const notes: PaintedNote[] = [];
        if (isPlaybackFrozen || !isVertical || collected.error) {
            return { notes, error: collected.error };
        }
        try {
            const beatToTime = (beat: number) => wdsBeatToTime(chartData, beat, defaultBpm);
            const activeDrag = drag?.moved && drag.base === chartData ? drag : null;
            const movingIds = new Set(activeDrag?.ids);
            const previousLinks = new Map(bodyLinks);
            if (activeDrag?.kind === "move") {
                for (const [id, body] of previousLinks) {
                    if (movingIds.has(id) && !movingIds.has(body)) previousLinks.delete(id);
                }
            }
            const projected = collected.notes.map((source) => {
                let record = source;
                if (activeDrag && movingIds.has(source.note.id)) {
                    const tailBeat = source.tailBeat === null ? null : source.tailBeat + activeDrag.deltaBeat;
                    const beat = source.beat + (activeDrag.kind === "move" ? activeDrag.deltaBeat : 0);
                    record = {
                        ...source, beat, tailBeat,
                        time: beatToTime(beat), endTime: tailBeat === null ? null : beatToTime(tailBeat),
                        note: activeDrag.kind === "width"
                            ? resizeWdsNoteWidth(source.note, activeDrag.resizeEdge, activeDrag.widthDelta, activeDrag.resizePart)
                            : { ...source.note, wds: { ...source.note.wds!, lane: source.note.wds!.lane + activeDrag.laneDelta } },
                    };
                }
                return record;
            });
            for (const record of alignWdsBodyRecords(projected, previousLinks)) {
                const painted = paintNote(record, timeToY, record.beat < 0 || (record.tailBeat !== null && record.tailBeat <= record.beat));
                if (Math.max(painted.headY, painted.tailY ?? painted.headY) < -20 ||
                    Math.min(painted.headY, painted.tailY ?? painted.headY) > viewHeight + 20) continue;
                notes.push(painted);
            }
            // Independent keys stay above every hold body, including at its start.
            notes.sort((a, b) => Number(isWdsHoldType(b.record.note.type)) - Number(isWdsHoldType(a.record.note.type)));
            return { notes, error: null };
        } catch (reason) {
            return { notes: [], error: errorMessage(reason) };
        }
    }, [chartData, collected, bodyLinks, defaultBpm, drag, timeToY, viewHeight, isPlaybackFrozen, isVertical]);

    const scene = useMemo(() => {
        const ticks: { beat: number; y: number; major: boolean; bpm: number | null }[] = [];
        let selectedBand: { top: number; bottom: number } | null = null;
        if (isPlaybackFrozen || !isVertical || paintedNotes.error) {
            return { ticks, notes: paintedNotes.notes, selectedBand, error: paintedNotes.error };
        }
        try {
            const beatToTime = (beat: number) => wdsBeatToTime(chartData, beat, defaultBpm);
            const low = Math.max(0, Math.floor(wdsTimeToBeat(chartData, rangeStart - graphicalOffset, defaultBpm)));
            const high = Math.max(0, Math.ceil(wdsTimeToBeat(chartData, rangeEnd - graphicalOffset, defaultBpm)));
            if (!Number.isSafeInteger(low) || !Number.isSafeInteger(high)) throw new Error("时间轴拍数超出可表示范围。");
            // Bound SVG work by the viewport, including at very wide zoom levels.
            const majorStride = Math.max(1, Math.ceil((high - low) / Math.max(1, viewHeight / 18)));
            const minorStride = Math.max(1, Math.ceil((high - low) * subdivision / Math.max(1, viewHeight / 4)));
            const virtualStart = tempoSegments.at(-1)?.end ?? 0;
            for (let beat = Math.ceil(low / majorStride) * majorStride; beat <= high; beat += majorStride) {
                const segment = tempoSegments.find((item) => beat === item.start && item.end > item.start);
                ticks.push({ beat, y: timeToY(beatToTime(beat)), major: true, bpm: segment?.tempo ?? (beat === virtualStart ? defaultBpm : null) });
                if (majorStride !== 1) continue;
                for (let part = minorStride; part < subdivision; part += minorStride) {
                    const position = beat + part / subdivision;
                    ticks.push({ beat: position, y: timeToY(beatToTime(position)), major: false, bpm: null });
                }
            }
            const selectedBeat = selectedMeasureRef?.globalIndex ?? clickedBeat;
            if (selectedBeat !== null) {
                selectedBand = {
                    top: Math.max(0, timeToY(beatToTime(Math.floor(selectedBeat) + 1))),
                    bottom: Math.min(viewHeight, timeToY(beatToTime(Math.floor(selectedBeat)))),
                };
            }
            return { ticks, notes: paintedNotes.notes, selectedBand, error: null };
        } catch (reason) {
            return { ticks: [], notes: [], selectedBand: null, error: errorMessage(reason) };
        }
    }, [chartData, paintedNotes, defaultBpm, rangeStart, rangeEnd, graphicalOffset, viewHeight, subdivision,
        tempoSegments, timeToY, selectedMeasureRef, clickedBeat, isPlaybackFrozen, isVertical]);

    // Cursor previews do not rebuild the grid or walk the complete chart on hover.
    const previewResult = useMemo(() => {
        let preview: PaintedNote | null = null;
        if (isPlaybackFrozen || !isVertical || scene.error) return { preview, error: null };
        try {
            const beatToTime = (beat: number) => wdsBeatToTime(chartData, beat, defaultBpm);
            const activePending = editState.mode === "insert-wds" ? pending : null;
            if (activePending) {
                const tailBeat = cursor?.beat ?? activePending.beat + 1 / subdivision;
                preview = paintNote({
                    note: activePending.note, beat: activePending.beat, tailBeat,
                    time: beatToTime(activePending.beat), endTime: beatToTime(tailBeat),
                    measureIndex: Math.floor(activePending.beat), segmentIndex: -1, localMeasureIndex: -1,
                }, timeToY, tailBeat <= activePending.beat);
            } else if (editState.mode === "insert-wds" && cursor && cursor.lane >= 1 && cursor.lane <= WDS_LANE_COUNT) {
                let note: ChartNote = { id: "preview", type: editState.wdsType, wds: { ...editState.wdsProperties, lane: cursor.lane } };
                const body = findWdsNoteBody(collected.notes, note, cursor.beat)?.note.wds;
                if (body) note = { ...note, wds: { ...note.wds!, lane: body.lane, width: body.width } };
                preview = paintNote({
                    note,
                    beat: cursor.beat, tailBeat: null, time: cursor.time, endTime: null,
                    measureIndex: Math.floor(cursor.beat), segmentIndex: -1, localMeasureIndex: -1,
                }, timeToY, cursor.beat < 0);
            }
            return { preview, error: null };
        } catch (reason) {
            return { preview: null, error: errorMessage(reason) };
        }
    }, [chartData, collected.notes, defaultBpm, scene.error, subdivision, timeToY, pending, cursor, editState.mode,
        editState.wdsType, editState.wdsProperties, isPlaybackFrozen, isVertical]);

    function pointerAt(clientX: number, clientY: number, divisions = subdivision): Cursor {
        const rect = svgRef.current?.getBoundingClientRect();
        if (!rect || !rect.width || !rect.height) throw new Error("WDS 画布尺寸不可用");
        const x = (clientX - rect.left) * WIDTH / rect.width;
        const y = (clientY - rect.top) * viewHeight / rect.height;
        const time = rangeStart + (1 - y / viewHeight) * span - graphicalOffset;
        const beat = Math.round(wdsTimeToBeat(chartData, time, defaultBpm) * divisions) / divisions;
        return { x, y, beat, time: wdsBeatToTime(chartData, beat, defaultBpm), lane: Math.floor((x - GUTTER) / COLUMN) + 1 };
    }

    function hitsAt(point: Cursor): NoteHit[] {
        const hits: NoteHit[] = [];
        for (const note of scene.notes) {
            const record = note.record.note;
            const hold = isWdsHoldType(record.type);
            const inHeadSpan = point.x >= note.x && point.x <= note.x + note.width;
            const headDistance = Math.abs(point.y - note.headY);
            const tailDistance = note.tailY === null ? Infinity : Math.abs(point.y - note.tailY);
            const inTailSpan = point.x >= note.tailX && point.x <= note.tailX + note.tailWidth;
            const handle = canResize && (editState.selectedIds.has(record.id) || hoverId === record.id)
                ? widthHandles(note, viewHeight).find(({ x, y }) => Math.abs(point.x - x) <= 7 && Math.abs(point.y - y) <= 12)
                : null;
            if (handle) {
                hits.push({ note, part: handle.part, distance: -1 });
            } else if (inTailSpan && tailDistance <= NOTE_RADIUS && (!inHeadSpan || tailDistance < headDistance)) {
                hits.push({ note, part: "tail", distance: tailDistance });
            } else if (inHeadSpan && headDistance <= NOTE_RADIUS) {
                // A hold start is body geometry, not a key occupying this beat.
                hits.push({ note, part: hold ? "body" : "head", distance: hold ? NOTE_RADIUS + 1 : headDistance });
            } else if (inTailSpan && tailDistance <= NOTE_RADIUS) {
                hits.push({ note, part: "tail", distance: tailDistance });
            } else if (inHeadSpan && note.tailY !== null && point.y > note.tailY && point.y < note.headY) {
                hits.push({ note, part: "body", distance: NOTE_RADIUS + 1 });
            }
        }
        return hits.sort((a, b) => a.distance - b.distance || b.note.record.note.type - a.note.record.note.type);
    }

    function pickHit(point: Cursor, cycle = false): NoteHit | null {
        const hits = hitsAt(point);
        if (!hits.length) return null;
        const key = hits.map((hit) => `${hit.note.record.note.id}:${hit.part}`).join("|");
        if (cycle) {
            const index = cycleRef.current.key === key ? (cycleRef.current.index + 1) % hits.length : 0;
            cycleRef.current = { key, index };
            return hits[index];
        }
        const previous = cycleRef.current;
        const index = previous.key === key ? Math.max(0, previous.index) : 0;
        cycleRef.current = { key, index };
        return hits[index] ?? hits[0];
    }

    /** The only write gateway; a rejected parent commit retains selection/pending. */
    function commit(
        build: () => ChartSegment[],
        onSuccess?: (next: ChartSegment[]) => void,
        undoBase = chartData,
    ): boolean {
        if (!canEdit) return false;
        try {
            const next = build();
            if (!setChartData(next, true, undoBase)) {
                reportError("修改未保存，请检查谱面或撤销状态后重试。");
                return false;
            }
            setError(null);
            onSuccess?.(next);
            return true;
        } catch (reason) {
            reportError(reason);
            return false;
        }
    }

    function selectBeat(beat: number) {
        if (beat < 0) return;
        setClickedBeat(Math.floor(beat));
        onSelectMeasure?.(measureAt(beat));
    }

    function insertAt(point: Cursor) {
        if (!canEdit) return;
        if (pending) {
            if (point.beat <= pending.beat) {
                reportError("长条尾部必须晚于身子起点；请点击更晚的拍，或按 Esc 取消。");
                return;
            }
            commit(
                () => insertWdsNote(chartData, pending.note, pending.beat, point.beat, defaultBpm),
                () => {
                    setEditState((previous) => ({ ...previous, selectedIds: new Set([pending.note.id]) }));
                    setPending(null);
                },
            );
            return;
        }
        let note: ChartNote = {
            id: generateNoteId(), type: editState.wdsType,
            wds: { ...editState.wdsProperties, lane: point.lane },
        };
        const body = findWdsNoteBody(collected.notes, note, point.beat)?.note.wds;
        if (body) note = { ...note, wds: { ...note.wds!, lane: body.lane, width: body.width } };
        if (!getWdsScratchSpan(note.wds!)) {
            reportError("音符宽度或 Scratch 尾部超出 1–12 列；请更换位置或调整属性。");
            return;
        }
        if (isWdsHoldType(note.type)) {
            try {
                // Validate the entire captured draft through the adapter before arming it.
                insertWdsNote(chartData, note, point.beat, point.beat + 1 / subdivision, defaultBpm);
                setPending({ note, beat: point.beat, propertiesKey });
                setError(null);
            } catch (reason) { reportError(reason); }
        } else {
            commit(
                () => insertWdsNote(chartData, note, point.beat, null, defaultBpm),
                () => setEditState((previous) => ({ ...previous, selectedIds: new Set([note.id]) })),
            );
        }
    }

    function deleteIds(ids: string[]) {
        if (!ids.length) return;
        commit(() => removeWdsNotes(chartData, ids), () => {
            const removed = new Set(ids);
            setEditState((previous) => ({ ...previous, selectedIds: new Set([...previous.selectedIds].filter((id) => !removed.has(id))) }));
            if (hoverId && removed.has(hoverId)) setHoverId(null);
        });
    }

    function pasteAt(point: Cursor) {
        if (!editState.clipboard.length) return;
        let insertedIds: string[] = [];
        commit(() => {
            if (editState.clipboard.some((note) => !note.wds)) throw new Error("剪贴板包含非 WDS 音符。");
            const originLane = editState.clipboard.reduce((minimum, note) => Math.min(minimum, note.wds!.lane), Infinity);
            const next = pasteWdsNotes(chartData, editState.clipboard, point.beat, point.lane - originLane, defaultBpm);
            const previousIds = new Set(collected.notes.map(({ note }) => note.id));
            insertedIds = collectWdsNotes(next, defaultBpm).filter(({ note }) => !previousIds.has(note.id)).map(({ note }) => note.id);
            return next;
        }, () => {
            setEditState((previous) => ({ ...previous, selectedIds: new Set(insertedIds) }));
            setPending(null);
        });
    }

    function annotate(note: ChartNote) {
        if (!canEdit) return;
        const annotation = window.prompt("音符标注（留空可清除）", note.annotation ?? "");
        if (annotation === null || annotation === (note.annotation ?? "")) return;
        commit(() => updateWdsNotes(chartData, [note.id], { annotation: annotation || undefined }, defaultBpm));
    }

    function selectNote(hit: NoteHit, additive: boolean) {
        const id = hit.note.record.note.id;
        const next = additive ? new Set(editState.selectedIds) : editState.selectedIds.has(id)
            ? new Set(editState.selectedIds) : new Set<string>();
        if (additive && next.has(id)) next.delete(id);
        else next.add(id);
        setEditState((previous) => ({ ...previous, selectedIds: next }));
        return [...next];
    }

    function handlePointerDown(event: PointerEvent<SVGSVGElement>) {
        if (event.button !== 0 || isPlaybackFrozen || scene.error) return;
        event.preventDefault();
        rootRef.current?.focus({ preventScroll: true });
        try {
            const point = pointerAt(event.clientX, event.clientY);
            const rect = event.currentTarget.getBoundingClientRect();
            const hit = pickHit(point, event.altKey);
            setCursor(point);
            setHoverId(hit?.note.record.note.id ?? null);
            selectBeat(point.beat);
            if (editState.mode === "select" || editState.mode === "browse" || (hit && canResize && isWidthHandle(hit.part))) {
                if (!hit) {
                    if (!event.shiftKey && !event.ctrlKey && !event.metaKey) {
                        setEditState((previous) => ({ ...previous, selectedIds: new Set() }));
                    }
                    return;
                }
                const additive = event.shiftKey || event.ctrlKey || event.metaKey;
                const ids = selectNote(hit, additive);
                if (!canEdit || additive || event.altKey) return;
                const kind = isWidthHandle(hit.part) ? "width" : hit.part === "tail" ? "tail" : "move";
                const hitId = hit.note.record.note.id;
                const widthTarget = kind === "width" && !hit.part.startsWith("tail-") ? bodyLinks.get(hitId) ?? hitId : hitId;
                const next: Drag = {
                    pointerId: event.pointerId, base: chartData,
                    ids: kind === "move" ? expandWdsBodySelection(collected.notes, ids) : [widthTarget], kind,
                    start: point, subdivision, deltaBeat: 0, laneDelta: 0, moved: false,
                    resizeEdge: hit.part.endsWith("left") ? "left" : "right",
                    resizePart: hit.part.startsWith("tail-width-") ? "tail" : "note", widthDelta: 0,
                    startClientX: event.clientX, startClientY: event.clientY,
                    startTime: rangeStart + (1 - point.y / viewHeight) * span - graphicalOffset,
                    timePerPixel: span / rect.height, xPerPixel: WIDTH / rect.width, defaultBpm,
                };
                dragRef.current = next;
                setDrag(next);
                event.currentTarget.setPointerCapture(event.pointerId);
                return;
            }
            if (!canEdit) return;
            if (editState.mode === "annotate") {
                if (hit) { selectNote(hit, false); annotate(hit.note.record.note); }
            } else if (editState.mode === "insert-wds") {
                // The second click sets only the end time. JumpScratch belongs
                // to the tail properties, edited through its edge handles/form.
                if (pending || point.x >= GUTTER) insertAt(point);
            } else if (editState.mode === "paste" && point.x >= GUTTER) {
                pasteAt(point);
            }
        } catch (reason) { reportError(reason); }
    }

    function updateDrag(clientX: number, clientY: number): Drag | null {
        const active = dragRef.current;
        if (!active) return null;
        const dx = clientX - active.startClientX;
        const dy = clientY - active.startClientY;
        const moved = active.moved || Math.hypot(dx, dy) >= 3;
        if (!moved) return active;
        const beat = Math.round(wdsTimeToBeat(active.base,
            active.startTime - dy * active.timePerPixel, active.defaultBpm) * active.subdivision) / active.subdivision;
        const lane = Math.floor((active.start.x + dx * active.xPerPixel - GUTTER) / COLUMN) + 1;
        const next = {
            ...active, moved,
            deltaBeat: active.kind === "width" ? 0
                : Math.round((beat - active.start.beat) * active.subdivision) / active.subdivision,
            laneDelta: active.kind === "move" ? lane - active.start.lane : 0,
            widthDelta: active.kind === "width" ? Math.round(dx * active.xPerPixel / COLUMN) : 0,
        };
        if (next.moved === active.moved && next.deltaBeat === active.deltaBeat && next.laneDelta === active.laneDelta &&
            next.widthDelta === active.widthDelta) return active;
        dragRef.current = next;
        setDrag(next);
        return next;
    }

    function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
        if (isPlaybackFrozen || scene.error) return;
        if (dragRef.current && event.pointerId !== dragRef.current.pointerId) return;
        try {
            const point = pointerAt(event.clientX, event.clientY, dragRef.current?.subdivision);
            setCursor(point);
            if (dragRef.current) updateDrag(event.clientX, event.clientY);
            else setHoverId(pickHit(point)?.note.record.note.id ?? null);
        } catch (reason) { reportError(reason); }
    }

    function handlePointerUp(event: PointerEvent<SVGSVGElement>) {
        const active = dragRef.current;
        if (!active || event.pointerId !== active.pointerId) return;
        try {
            if (!canEdit) { cancelDrag(); return; }
            if (active.base !== chartData) throw new Error("谱面已发生变化，已取消本次拖动，请重新选择音符。");
            const next = updateDrag(event.clientX, event.clientY);
            const widthChanged = next?.kind === "width" && collected.notes.some(({ note }) => next.ids.includes(note.id) &&
                resizeWdsNoteWidth(note, next.resizeEdge, next.widthDelta, next.resizePart) !== note);
            if (next?.moved && (next.deltaBeat !== 0 || next.laneDelta !== 0 || widthChanged)) {
                commit(() => next.kind === "move"
                    ? moveWdsNotes(next.base, next.ids, next.deltaBeat, next.laneDelta, defaultBpm)
                    : updateWdsNotes(next.base, next.ids, (note) => {
                        if (next.kind === "width") return resizeWdsNoteWidth(note, next.resizeEdge, next.widthDelta, next.resizePart);
                        if (!note.tail) throw new Error("该音符没有可调整的尾部。");
                        const tail = normalizeFraction({
                            a: note.tail.a * next.subdivision + Math.round(next.deltaBeat * next.subdivision) * note.tail.b,
                            b: note.tail.b * next.subdivision,
                        });
                        if (!tail) throw new Error("尾部拍数超出可表示范围。");
                        return { ...note, tail };
                    }, defaultBpm), undefined, next.base);
            }
        } catch (reason) { reportError(reason); }
        // A rejected drag rolls back its local preview; saved selection is retained.
        cancelDrag();
    }

    function keyboardTarget(): Cursor {
        if (cursor && cursor.lane >= 1 && cursor.lane <= WDS_LANE_COUNT) return cursor;
        const beat = Math.max(0, clickedBeat ?? Math.round(wdsTimeToBeat(chartData,
            (rangeStart + rangeEnd) / 2 - graphicalOffset, defaultBpm) * subdivision) / subdivision);
        const time = wdsBeatToTime(chartData, beat, defaultBpm);
        return { beat, time, lane: editState.wdsProperties.lane, x: GUTTER, y: timeToY(time) };
    }

    function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
        if (event.target instanceof Element && event.target.closest("input, textarea, select, button, [contenteditable]:not([contenteditable='false'])")) return;
        if (event.nativeEvent.isComposing || isPlaybackFrozen || !isVertical) return;
        const consume = () => { event.preventDefault(); event.stopPropagation(); };
        try {
            if (event.key === "Escape") {
                consume(); cancelDrag(); setPending(null); setError(null);
                setEditState((previous) => ({ ...previous, selectedIds: new Set(), lnHeadTime: null }));
                return;
            }
            for (const item of MODE_SHORTCUTS) {
                if (!matchesKeyShortcut(item.action, event.nativeEvent)) continue;
                consume(); cancelDrag(); setPending(null);
                const properties = item.type === undefined ? null : defaultWdsProperties(item.type);
                setEditState((previous) => ({
                    ...previous, mode: item.mode, lnHeadTime: null,
                    ...(properties && item.type !== undefined ? {
                        wdsType: item.type,
                        wdsProperties: { ...properties, lane: previous.wdsProperties.lane, width: previous.wdsProperties.width },
                    } : {}),
                }));
                return;
            }
            const focusedId = event.target instanceof Element ? event.target.closest("[data-note-id]")?.getAttribute("data-note-id") : null;
            if (focusedId && (event.key === "Enter" || event.key === " ")) {
                consume();
                const note = collected.notes.find((record) => record.note.id === focusedId);
                if (note) {
                    selectBeat(note.beat);
                    setEditState((previous) => ({ ...previous, selectedIds: new Set([focusedId]) }));
                    if (editState.mode === "annotate") annotate(note.note);
                }
                return;
            }
            if ((event.ctrlKey || event.metaKey) && event.code === "KeyA") {
                consume();
                setEditState((previous) => ({ ...previous, selectedIds: new Set(collected.notes.map(({ note }) => note.id)) }));
                return;
            }
            if (matchesKeyShortcut("note.division.increment", event.nativeEvent) || matchesKeyShortcut("note.division.decrement", event.nativeEvent)) {
                consume(); cancelDrag();
                setBeatSubdivision(Math.min(64, Math.max(1, subdivision + (matchesKeyShortcut("note.division.increment", event.nativeEvent) ? 1 : -1))));
                return;
            }
            const ids = editState.selectedIds.size ? [...editState.selectedIds] : hoverId ? [hoverId] : [];
            if (matchesKeyShortcut("note.copy", event.nativeEvent)) {
                consume();
                if (ids.length) {
                    const clipboard = copyWdsNotes(chartData, ids);
                    setEditState((previous) => ({ ...previous, clipboard }));
                }
                return;
            }
            const cut = matchesKeyShortcut("note.cut", event.nativeEvent);
            const paste = matchesKeyShortcut("note.paste", event.nativeEvent);
            const remove = matchesKeyShortcut("note.delete", event.nativeEvent);
            const insertMeasure = matchesKeyShortcut("note.measure.insert", event.nativeEvent);
            const deleteMeasure = matchesKeyShortcut("note.measure.delete", event.nativeEvent);
            const undo = (event.ctrlKey || event.metaKey) && (event.code === "KeyZ" || event.key.toLowerCase() === "z");
            const redo = (event.ctrlKey || event.metaKey) && (event.code === "KeyY" || event.key.toLowerCase() === "y");
            if (!(cut || paste || remove || insertMeasure || deleteMeasure || undo || redo)) return;
            consume();
            // Browse blocks ALL mutation paths, including undo/redo and measure callbacks.
            if (!canEdit || scene.error) return;
            cancelDrag();
            if (undo || redo) {
                if (redo || event.shiftKey) onRedo(); else onUndo();
            } else if (insertMeasure || deleteMeasure) {
                const ref = cursor ? measureAt(cursor.beat) : selectedMeasureRef;
                if (cursor && !ref) {
                    reportError("光标所在位置是虚拟拍或谱面外位置，无法插入或删除小节；请将光标移到已有的拍。");
                    return;
                }
                if (insertMeasure) onInsertMeasure?.(ref ?? undefined);
                else onDeleteMeasure?.(ref ?? undefined);
            } else if (cut && ids.length) {
                const clipboard = copyWdsNotes(chartData, ids);
                commit(() => removeWdsNotes(chartData, ids), () => {
                    setEditState((previous) => ({ ...previous, clipboard, selectedIds: new Set() }));
                    setHoverId(null);
                });
            } else if (paste) pasteAt(keyboardTarget());
            else if (remove) deleteIds(ids);
        } catch (reason) { reportError(reason); }
    }

    const selectedBeat = selectedMeasureRef?.globalIndex ?? clickedBeat;
    const focusedNote = scene.notes.find(({ record }) => record.note.id === hoverId)?.record ??
        scene.notes.find(({ record }) => editState.selectedIds.has(record.note.id))?.record;
    const visibleError = error ?? scene.error ?? previewResult.error;
    const playheadY = playheadTime == null ? null : timeToY(playheadTime - graphicalOffset);
    const audioEndY = songDuration > 0 ? timeToY(songDuration - graphicalOffset) : null;

    return (
        <div
            ref={rootRef}
            className={style.root}
            style={{ width: isVertical ? WIDTH : undefined, height: isVertical ? viewHeight : height }}
            data-lane="true"
            data-chart-kind="wds"
            data-lane-id={laneId}
            data-orientation={orientation}
            data-frozen={isPlaybackFrozen || undefined}
            data-mode={editState.mode}
            role="group"
            aria-label="WDS 十二列制谱画布"
            aria-describedby={helpId}
            tabIndex={0}
            onKeyDown={handleKeyDown}
            onFocusCapture={() => onActivate?.()}
            onPointerDownCapture={() => onActivate?.()}
            onClick={(event) => event.stopPropagation()}
        >
            <span id={helpId} className={style.srOnly}>
                时间向上增加。1 Tap，2 Critical，3 Hold，4 选择，5 粘贴，8 标注，B 只读浏览。
                Shift 或 Ctrl 点击多选，Alt 点击轮换重叠音符。拖动长条尾部调整长度。Esc 取消。
                长条不包含头键，起点可独立放键。悬停时显示左右宽度柄；尾巴的宽度柄编辑 JumpScratch 属性。
                Tab 聚焦音符，Enter 选择。音频结束后仍可编辑。
            </span>
            {!isPlaybackFrozen && !isVertical && (
                <div className={style.horizontalMessage}>
                    <strong>WDS · 十二列制谱</strong>
                    <span>请切换到纵向时间轴，以编辑列位置、宽度与长条。</span>
                    <button type="button" onClick={onRequestVertical} disabled={!onRequestVertical}>切换纵向制谱</button>
                </div>
            )}
            {!isPlaybackFrozen && isVertical && (
                <>
                    <svg
                        ref={svgRef}
                        className={style.canvas}
                        width={WIDTH} height={viewHeight} viewBox={`0 0 ${WIDTH} ${viewHeight}`}
                        role="group" aria-label="WDS 音符和节拍网格"
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={cancelDrag}
                        onLostPointerCapture={() => { dragRef.current = null; setDrag(null); }}
                        onPointerLeave={() => {
                            if (!dragRef.current) { setCursor(null); setHoverId(null); }
                        }}
                        onContextMenu={(event) => {
                            event.preventDefault(); event.stopPropagation();
                            if (!canEdit || scene.error) return;
                            try {
                                const hit = pickHit(pointerAt(event.clientX, event.clientY), event.altKey);
                                if (hit) deleteIds([hit.note.record.note.id]);
                            } catch (reason) { reportError(reason); }
                        }}
                    >
                        <rect width={WIDTH} height={viewHeight} fill="#0f172a" />
                        <rect width={GUTTER} height={viewHeight} fill="#172033" />
                        {Array.from({ length: WDS_LANE_COUNT }, (_, index) => (
                            <g key={index} aria-hidden="true">
                                {index % 2 === 1 && <rect x={GUTTER + index * COLUMN} width={COLUMN} height={viewHeight} fill="#162035" />}
                                <line x1={GUTTER + index * COLUMN} x2={GUTTER + index * COLUMN} y1={0} y2={viewHeight} stroke={index % 3 === 0 ? "#475569" : "#273449"} />
                            </g>
                        ))}
                        {scene.selectedBand && scene.selectedBand.bottom > scene.selectedBand.top && (
                            <rect x={0} y={scene.selectedBand.top} width={WIDTH} height={scene.selectedBand.bottom - scene.selectedBand.top} fill="#38bdf8" fillOpacity={0.09} />
                        )}
                        {scene.ticks.map((tick) => (
                            <g key={tick.beat} aria-hidden="true">
                                <line x1={tick.major ? 0 : GUTTER} x2={WIDTH} y1={tick.y} y2={tick.y} stroke={tick.major ? "#64748b" : "#334155"} strokeOpacity={tick.major ? 0.65 : 0.5} />
                                {tick.major && <text x={GUTTER - 5} y={tick.y - 4} className={style.rulerText}>{tick.beat + 1}</text>}
                                {tick.bpm !== null && <text x={GUTTER + 4} y={tick.y - 4} className={style.bpmText}>♩ {tick.bpm}</text>}
                            </g>
                        ))}
                        {audioEndY !== null && audioEndY >= 0 && audioEndY <= viewHeight && (
                            <g aria-hidden="true">
                                <line x1={GUTTER} x2={WIDTH} y1={audioEndY} y2={audioEndY} stroke="#94a3b8" strokeDasharray="2 5" />
                                <text x={WIDTH - 4} y={audioEndY - 4} className={style.rulerText}>音频结束</text>
                            </g>
                        )}
                        {scene.notes.map((note) => (
                            <NoteGlyph
                                key={note.record.note.id} painted={note} viewportHeight={viewHeight}
                                selected={editState.selectedIds.has(note.record.note.id)} hovered={hoverId === note.record.note.id}
                                resizable={canResize}
                            />
                        ))}
                        {previewResult.preview && <NoteGlyph painted={previewResult.preview} viewportHeight={viewHeight} selected preview hovered={false} />}
                        {cursor && (
                            <g pointerEvents="none" aria-hidden="true">
                                <line x1={0} x2={WIDTH} y1={timeToY(cursor.time)} y2={timeToY(cursor.time)} stroke="#38bdf8" strokeDasharray="4 3" />
                                {cursor.lane >= 1 && cursor.lane <= WDS_LANE_COUNT && <rect x={GUTTER + (cursor.lane - 1) * COLUMN} y={timeToY(cursor.time) - 10} width={COLUMN} height={20} fill="none" stroke="#38bdf8" />}
                            </g>
                        )}
                        {playheadY !== null && playheadY >= 0 && playheadY <= viewHeight && (
                            <line x1={0} x2={WIDTH} y1={playheadY} y2={playheadY} stroke="#f43f5e" strokeWidth={2} pointerEvents="none" aria-label="播放位置" />
                        )}
                    </svg>
                    <div className={style.columnLabels} aria-hidden="true">
                        <span>拍 / BPM</span>
                        {Array.from({ length: WDS_LANE_COUNT }, (_, index) => <span key={index}>{index + 1}</span>)}
                    </div>
                    <div className={style.status} aria-live="polite">
                        <div>
                            <strong>{editState.mode === "browse" ? "只读浏览" : pending ? "选择长条结束拍 · Esc 取消"
                                : drag?.kind === "width" ? "拖动宽度 · Esc 取消" : "WDS"}</strong>
                            <span>1/{subdivision} 拍</span>
                            {selectedBeat !== null && <span>选中第 {selectedBeat + 1} 拍 · {bpmAt(selectedBeat)} BPM</span>}
                            {cursor && <span>光标 {(cursor.beat + 1).toFixed(3)} 拍 · 列 {cursor.lane >= 1 && cursor.lane <= 12 ? cursor.lane : "—"}</span>}
                        </div>
                        <div className={style.noteDescription}>
                            {pending ? describeNote(previewResult.preview?.record.note ?? pending.note)
                                : focusedNote ? describeNote(focusedNote.note) : "悬停显示左右宽度柄 · Alt 点击轮换重叠音符"}
                        </div>
                    </div>
                </>
            )}
            {!isPlaybackFrozen && visibleError && (
                <div className={style.error} role="alert">
                    <span>{visibleError}</span>
                    {error && <button type="button" aria-label="关闭错误提示" onClick={() => setError(null)}>×</button>}
                </div>
            )}
        </div>
    );
}
