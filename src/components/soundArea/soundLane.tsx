"use client";
import styles from "./soundLane.module.css";
import SoundFileTitleBar from "./soundFileTitleBar";

import WaveLane from "./waveArea/waveLane";
import SpectrumLane from "./spectrumArea/spectrumLane";
import WaveMenu from "./soundMenu/waveMenu/waveMenu";
import FoldWave from "./soundMenu/waveMenu/foldWave";
import SpectrumMenu from "./soundMenu/spectrumMenu/spectrumMenu";
import FoldSpectrum from "./soundMenu/spectrumMenu/foldSpectrum";
import NoteMenu from "./noteArea/noteMenu/noteMenu";
import Image from "@/components/Image";
import { useContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AudioDataCtx } from "../audioContext";
import {
    SoundLaneState,
    SoundLaneStateUpdate,
    defaultNoteLaneData,
    resolveActiveNoteLaneId,
    resolveNoteEditorKind,
} from "@/interface/audioData";
import NoteLane from "./noteArea/noteLane";
import WdsLane from "./noteArea/wdsLane";
import {
    ChartNote,
    ChartSegment,
    ChartMeasure,
    ChartMeasureRef,
    NoteLaneData,
    WdsNoteProperties,
} from "./noteArea/chartTypes";
import {
    defaultNoteEditState,
    EditMode,
    NoteEditState,
} from "./noteArea/noteState";
import {
    parseImportedNoteLaneText,
    validateNoteLaneData,
    removeTrailingEmptyMeasures,
    collectMeasureTimesAndBpms,
    buildSegmentsFromMeasureList,
    insertMeasureAtRef,
    deleteMeasureAtRef,
    locateMeasureByRef,
    stripChartDataTimes,
    copyWdsNotes,
    removeWdsNotes,
    updateWdsNotes,
} from "./noteArea/chartAdapter";
import {
    defaultWdsProperties,
    WDS_LANE_COUNT,
} from "./noteArea/wdsTypes";
import { convertToWds } from "@/lib/wdsExport";
import { convertToWdsChart } from "@/lib/wdsChartExport";
import { convertToMalody } from "@/lib/malodyExport";
import { convertToSus } from "@/lib/susExport";
import type { CSSProperties, SetStateAction } from "react";
import type { TimelineOrientation } from "../timelineGeometry";

const MAX_UNDO = 50;
const WDS_READONLY_MESSAGE = "制谱器当前为浏览模式，请先切换到编辑模式";
type PlaybackRenderMode = "idle" | "full" | "limited" | "frozen";

interface _prop {
    index: number;
    audioId: string;
    timeRange: [number, number];
    orientation?: TimelineOrientation;
    playheadTime?: number | null;
    playbackRenderMode: PlaybackRenderMode;
    refSoundLaneState: SoundLaneState;
    setSoundLaneState: (i: number, state: SoundLaneStateUpdate) => void;
    onActivate?: (audioId: string) => void;
    onDeleteSoundLane?: (audioId: string) => void;
    onRequestVertical?: () => void;
}

function omitNoteLaneId(lane: NoteLaneData): Omit<NoteLaneData, "id"> {
    const { id, ...laneWithoutId } = lane;
    void id;
    return laneWithoutId;
}

function activateNoteLane(state: SoundLaneState, laneId: string, unfold = false): SoundLaneState {
    const lane = state.noteLanes.find((item) => item.id === laneId);
    if (!lane) return state;
    const shouldUnfold = unfold && lane.isFolded;
    const noteEditorKind = lane.chartKind ?? "rhythm";
    if (state.activeNoteLaneId === laneId && state.noteEditorKind === noteEditorKind && !shouldUnfold) return state;
    const activeId = resolveActiveNoteLaneId(state.noteLanes, state.activeNoteLaneId);
    const previousKind = resolveNoteEditorKind(state.noteLanes, activeId, state.noteEditorKind);
    return {
        ...state,
        activeNoteLaneId: laneId,
        previousNoteLaneId: previousKind !== noteEditorKind ? activeId : state.previousNoteLaneId,
        noteEditorKind,
        noteLanes: shouldUnfold
            ? state.noteLanes.map((item) => item.id === laneId ? { ...item, isFolded: false } : item)
            : state.noteLanes,
    };
}

function comparableJson(value: unknown): string {
    return JSON.stringify(value, (_key, item: unknown) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return item;
        return Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)));
    });
}

function laneMetadataJson(lane: NoteLaneData): string {
    const { chartData, ...metadata } = omitNoteLaneId(lane);
    void chartData;
    return comparableJson({
        ...metadata,
        chartKind: lane.chartKind ?? "rhythm",
        wdsOffset: lane.wdsOffset ?? 0,
        isFolded: lane.isFolded ?? false,
        dataVersion: lane.dataVersion ?? (lane.chartKind === "wds" ? 4 : 3),
        startTime: lane.startTime ?? null,
        endTime: lane.endTime ?? null,
    });
}

function normalizeLaneEditState(
    lane: NoteLaneData,
    state = defaultNoteEditState(lane.defaultBpm),
): NoteEditState {
    if (lane.chartKind === "wds") {
        const mode = ["browse", "select", "paste", "annotate", "insert-wds"].includes(state.mode)
            ? state.mode
            : "insert-wds";
        return {
            ...state,
            mode,
            currentBpm: lane.defaultBpm,
            lnHeadTime: mode === state.mode ? state.lnHeadTime : null,
        };
    }
    return state.mode === "insert-wds"
        ? { ...state, mode: "insert-strong", lnHeadTime: null }
        : state;
}

export default function SoundLane(prop: _prop) {
    const orientation = prop.orientation ?? "horizontal";
    const isVertical = orientation === "vertical";
    const [timelineHeight, setTimelineHeight] = useState(640);
    const editingRegionRef = useRef<HTMLDivElement | null>(null);
    const audioDataList = useContext(AudioDataCtx);
    const audioData = audioDataList.find((a) => a.id === prop.audioId);
    const isPlaybackFrozen = prop.playbackRenderMode === "frozen";

    useEffect(() => {
        const region = editingRegionRef.current;
        if (!isVertical || !region) return;

        // Measure the space left after the toolbar, footer, lane header, and scrollbar.
        const observer = new ResizeObserver(([entry]) => {
            setTimelineHeight(Math.max(1, Math.floor(entry.contentRect.height)));
        });
        observer.observe(region);
        return () => observer.disconnect();
    }, [isVertical, audioData]);

    const noteLanes = useMemo(
        () =>
            Array.isArray(prop.refSoundLaneState.noteLanes)
                ? prop.refSoundLaneState.noteLanes
                : [],
        [prop.refSoundLaneState.noteLanes],
    );

    const [laneEditStateMap, setLaneEditStateMap] = useState<
        Record<string, NoteEditState>
    >({});
    const [laneCursorTimeMap, setLaneCursorTimeMap] = useState<Record<string, number | null>>(
        {},
    );

    const [laneSelectedMeasureRefMap, setLaneSelectedMeasureRefMap] =
        useState<Record<string, ChartMeasureRef | null>>({});
    const [laneErrorMap, setLaneErrorMap] = useState<Record<string, string>>(
        {},
    );
    const resolvedActiveLaneId = resolveActiveNoteLaneId(noteLanes, prop.refSoundLaneState.activeNoteLaneId);
    const noteEditorKind = resolveNoteEditorKind(noteLanes, resolvedActiveLaneId, prop.refSoundLaneState.noteEditorKind);
    const selectNoteLane = useCallback((laneId: string, unfold = false) => {
        prop.setSoundLaneState(prop.index, (prev) => activateNoteLane(prev, laneId, unfold));
    }, [prop]);

    const visibleNoteLanes = useMemo(
        () => noteLanes.filter((lane) => (lane.chartKind ?? "rhythm") === noteEditorKind),
        [noteLanes, noteEditorKind],
    );
    const allVisibleNoteLanesFolded = visibleNoteLanes.every((lane) => lane.isFolded);

    const cursorTime = useMemo(() => {
        if (resolvedActiveLaneId) {
            const t = laneCursorTimeMap[resolvedActiveLaneId];
            if (t !== null && t !== undefined) return t;
        }
        for (const lane of visibleNoteLanes) {
            const t = laneCursorTimeMap[lane.id];
            if (t !== null && t !== undefined) return t;
        }
        return null;
    }, [laneCursorTimeMap, resolvedActiveLaneId, visibleNoteLanes]);

    const renderCursorTime = isPlaybackFrozen ? null : cursorTime;
    const renderPlayheadTime = isPlaybackFrozen ? null : prop.playheadTime;

    const laneSnapHandlers = useMemo(() => {
        const handlers: Record<string, (time: number | null) => void> = {};
        for (const lane of noteLanes) {
            const laneId = lane.id;
            handlers[laneId] = (time: number | null) => {
                setLaneCursorTimeMap((prev) => {
                    const prevTime = prev[laneId] ?? null;
                    if (prevTime === time) {
                        return prev;
                    }
                    return {
                        ...prev,
                        [laneId]: time,
                    };
                });
            };
        }
        return handlers;
    }, [noteLanes]);

    const laneMeasureSelectHandlers = useMemo(() => {
        const handlers: Record<string, (ref: ChartMeasureRef | null) => void> = {};
        for (const lane of noteLanes) {
            const laneId = lane.id;
            handlers[laneId] = (ref: ChartMeasureRef | null) => {
                setLaneSelectedMeasureRefMap((prev) => {
                    const prevRef = prev[laneId] ?? null;
                    if (
                        prevRef?.globalIndex === ref?.globalIndex &&
                        prevRef?.segmentIndex === ref?.segmentIndex &&
                        prevRef?.measureIndex === ref?.measureIndex
                    ) {
                        return prev;
                    }
                    return {
                        ...prev,
                        [laneId]: ref,
                    };
                });
            };
        }
        return handlers;
    }, [noteLanes]);

    const setLaneError = useCallback((laneId: string, message: string) => {
        setLaneErrorMap((prev) => ({
            ...prev,
            [laneId]: message,
        }));
    }, []);

    const clearLaneError = useCallback((laneId: string) => {
        setLaneErrorMap((prev) => {
            if (!prev[laneId]) return prev;
            const next = { ...prev };
            delete next[laneId];
            return next;
        });
    }, []);

    const setLaneEditState = useCallback(
        (laneId: string, updater: (prev: NoteEditState) => NoteEditState) => {
            setLaneEditStateMap((prev) => {
                const lane = noteLanes.find(
                    (l: NoteLaneData) => l.id === laneId,
                );
                if (!lane) return prev;
                const base = normalizeLaneEditState(lane, prev[laneId]);
                return {
                    ...prev,
                    [laneId]: normalizeLaneEditState(lane, updater(base)),
                };
            });
        },
        [noteLanes],
    );

    const updateLaneData = useCallback(
        (
            laneId: string,
            updater: (lane: NoteLaneData) => NoteLaneData,
        ) => {
            prop.setSoundLaneState(prop.index, (prev) => {
                if (!prev.noteLanes.some((lane) => lane.id === laneId)) return prev;
                const nextLanes = prev.noteLanes.map((lane) => lane.id === laneId ? updater(lane) : lane);
                const activeNoteLaneId = resolveActiveNoteLaneId(nextLanes, prev.activeNoteLaneId);
                return {
                    ...prev,
                    noteLanes: nextLanes,
                    activeNoteLaneId,
                    noteEditorKind: resolveNoteEditorKind(nextLanes, activeNoteLaneId, prev.noteEditorKind),
                };
            });
        },
        [prop],
    );

    const deleteNoteLane = useCallback((laneId: string) => {
        if (!noteLanes.some((lane) => lane.id === laneId)) return;
        prop.setSoundLaneState(prop.index, (prev) => {
            const removed = prev.noteLanes.find((lane) => lane.id === laneId);
            if (!removed) return prev;
            const remaining = prev.noteLanes.filter((lane) => lane.id !== laneId);
            const currentId = resolveActiveNoteLaneId(prev.noteLanes, prev.activeNoteLaneId);
            const nextId = currentId === laneId
                ? (remaining.find((lane) => (lane.chartKind ?? "rhythm") === (removed.chartKind ?? "rhythm")) ?? remaining[0])?.id ?? null
                : resolveActiveNoteLaneId(remaining, currentId);
            return {
                ...prev,
                noteLanes: remaining,
                activeNoteLaneId: nextId,
                previousNoteLaneId: prev.previousNoteLaneId === laneId ? null : prev.previousNoteLaneId,
                noteEditorKind: resolveNoteEditorKind(remaining, nextId,
                    resolveNoteEditorKind(prev.noteLanes, currentId, prev.noteEditorKind)),
            };
        });
        // Local editor cleanup is separate from the project updater: React may
        // replay updaters, but must never replay state/ref side effects in them.
        setLaneEditStateMap((prev) => {
            const next = { ...prev };
            delete next[laneId];
            return next;
        });
        setLaneErrorMap((prev) => {
            const next = { ...prev };
            delete next[laneId];
            return next;
        });
        setLaneSelectedMeasureRefMap((prev) => {
            const next = { ...prev };
            delete next[laneId];
            return next;
        });
        setLaneCursorTimeMap((prev) => {
            const next = { ...prev };
            delete next[laneId];
            return next;
        });
    }, [noteLanes, prop]);

    const handleAddNoteLane = useCallback((kind: "rhythm" | "wds", reuseExisting = false) => {
        try {
            const nextLane = defaultNoteLaneData(undefined, kind);
            const activeLane = noteLanes.find((lane) => lane.id === resolvedActiveLaneId);
            // New charts inherit only the selected source's empty beat grid.
            const measureTimes = collectMeasureTimesAndBpms(activeLane ? [activeLane] : []);
            nextLane.chartData = buildSegmentsFromMeasureList(measureTimes);
            if (activeLane) {
                nextLane.defaultBpm = activeLane.defaultBpm;
                nextLane.division = activeLane.division;
            }
            const error = validateNoteLaneData(nextLane);
            if (error) throw new Error(error);
            const nextEditState: NoteEditState = {
                ...defaultNoteEditState(nextLane.defaultBpm),
                mode: kind === "wds" ? "insert-wds" : "browse",
            };
            prop.setSoundLaneState(prop.index, (prev) => {
                if (reuseExisting) {
                    const activeId = resolveActiveNoteLaneId(prev.noteLanes, prev.activeNoteLaneId);
                    const candidates = prev.noteLanes.filter((lane) => (lane.chartKind ?? "rhythm") === kind);
                    const existing = candidates.find((lane) => lane.id === activeId)
                        ?? candidates.find((lane) => lane.id === prev.previousNoteLaneId)
                        ?? candidates[0];
                    if (existing) return activateNoteLane(prev, existing.id, true);
                }
                if (prev.noteLanes.some((lane) => lane.id === nextLane.id)) return prev;
                return activateNoteLane({ ...prev, noteLanes: [...prev.noteLanes, nextLane] }, nextLane.id);
            });
            setLaneEditStateMap((prev) => ({
                ...prev,
                [nextLane.id]: nextEditState,
            }));
            if (kind === "wds") prop.onRequestVertical?.();
        } catch (error) {
            if (resolvedActiveLaneId) {
                setLaneError(resolvedActiveLaneId, error instanceof Error ? error.message : "创建谱面失败");
            }
        }
    }, [noteLanes, prop, resolvedActiveLaneId, setLaneError]);

    const handleToggleNoteEditor = useCallback(() => {
        const kind = noteEditorKind === "wds" ? "rhythm" : "wds";
        const candidates = noteLanes.filter((lane) => (lane.chartKind ?? "rhythm") === kind);
        const existing = candidates.find((lane) => lane.id === prop.refSoundLaneState.previousNoteLaneId)
            ?? candidates[0];
        if (existing) {
            selectNoteLane(existing.id, true);
            if (kind === "wds") prop.onRequestVertical?.();
        } else {
            // Recheck in the updater so queued creations reuse the same chart.
            handleAddNoteLane(kind, true);
        }
    }, [noteLanes, noteEditorKind, selectNoteLane, prop, handleAddNoteLane]);

    const handleToggleNoteFold = useCallback(() => {
        const visibleIds = new Set(visibleNoteLanes.map((lane) => lane.id));
        if (!visibleIds.size) return;
        prop.setSoundLaneState(prop.index, (prev) => ({
            ...prev,
            noteLanes: prev.noteLanes.map((lane) => visibleIds.has(lane.id)
                ? { ...lane, isFolded: !allVisibleNoteLanesFolded }
                : lane),
        }));
    }, [visibleNoteLanes, allVisibleNoteLanesFolded, prop]);

    /** Deep-clone chartData for undo snapshot */
    const cloneChart = useCallback(
        (data: ChartSegment[]): ChartSegment[] => structuredClone(data),
        [],
    );

    const locateMeasure = useCallback(
        (data: ChartSegment[], ref: ChartMeasureRef | null) =>
            locateMeasureByRef(data, ref),
        [],
    );

    const retimeSingleMeasureByBpm = useCallback(
        (data: ChartSegment[], ref: ChartMeasureRef | null, bpm: number) => {
            const located = locateMeasure(data, ref);
            if (!located) {
                return null;
            }

            const safeBpm = bpm;
            const sorted = cloneChart(data);
            const { segmentIndex, measureIndex } = located;
            const tailVirtualTempo = (() => {
                const last = sorted[sorted.length - 1];
                if (!last || last.measures.length > 0) {
                    return null;
                }
                return Number.isFinite(last.tempo) && last.tempo > 0
                    ? last.tempo
                    : null;
            })();
            const chunks: Array<{ tempo: number; measures: ChartMeasure[] }> =
                [];

            for (let s = 0; s < sorted.length; s++) {
                const seg = sorted[s];
                const segTempo = seg.tempo;
                if (seg.measures.length === 0) {
                    continue;
                }

                if (s !== segmentIndex) {
                    chunks.push({
                        tempo: segTempo,
                        measures: seg.measures,
                    });
                    continue;
                }

                const before = seg.measures.slice(0, measureIndex);
                const current = seg.measures[measureIndex];
                const after = seg.measures.slice(measureIndex + 1);

                if (before.length > 0) {
                    chunks.push({ tempo: segTempo, measures: before });
                }
                chunks.push({ tempo: safeBpm, measures: [current] });
                if (after.length > 0) {
                    chunks.push({ tempo: segTempo, measures: after });
                }
            }

            const rebuilt: ChartSegment[] = [];
            let nextTime = sorted[0]?.time ?? 0;
            for (const chunk of chunks) {
                if (chunk.measures.length === 0) {
                    continue;
                }
                const safeTempo = chunk.tempo;
                const tail = rebuilt[rebuilt.length - 1];
                if (tail && Math.abs(tail.tempo - safeTempo) < 1e-6) {
                    tail.measures.push(...chunk.measures);
                } else {
                    rebuilt.push({
                        time: nextTime,
                        tempo: safeTempo,
                        measures: chunk.measures,
                    });
                }
                nextTime += chunk.measures.length * (60 / safeTempo);
            }

            if (tailVirtualTempo !== null) {
                const tail = rebuilt[rebuilt.length - 1];
                if (!tail || Math.abs(tail.tempo - tailVirtualTempo) > 1e-6) {
                    rebuilt.push({
                        time: nextTime,
                        tempo: tailVirtualTempo,
                        measures: [{ notes: [] }],
                    });
                }
            }

            return rebuilt;
        },
        [cloneChart, locateMeasure],
    );

    // Menu actions and canvas shortcuts share the same validation, history and
    // read-only boundary, including callbacks invoked without a visible button.
    const createLaneActions = useCallback((lane: NoteLaneData) => {
        const editState = normalizeLaneEditState(lane, laneEditStateMap[lane.id]);
        const isReadOnly = lane.chartKind === "wds" && editState.mode === "browse";
        const reportError = (error: unknown): string => {
            const message = error instanceof Error ? error.message : "谱面操作失败";
            setLaneError(lane.id, message);
            return message;
        };
        const ensureEditable = () => {
            if (!isReadOnly) return true;
            setLaneError(lane.id, WDS_READONLY_MESSAGE);
            return false;
        };
        const pushUndo = (before: ChartSegment[]) => {
            const snapshot = cloneChart(before);
            setLaneEditState(lane.id, (prev) => ({
                ...prev,
                undoStack: [snapshot, ...prev.undoStack].slice(0, MAX_UNDO),
                redoStack: [],
            }));
        };
        const setChartData = (
            next: ChartSegment[],
            saveUndo = true,
            undoBase?: ChartSegment[],
        ): boolean => {
            if (!ensureEditable()) return false;
            try {
                const error = validateNoteLaneData({ ...lane, chartData: next });
                if (error) throw new Error(error);
                if (saveUndo) pushUndo(undoBase ?? lane.chartData);
                updateLaneData(lane.id, (prev) => ({ ...prev, chartData: next }));
                clearLaneError(lane.id);
                return true;
            } catch (error) {
                reportError(error);
                return false;
            }
        };
        const setLaneMetadata = (
            changes: Partial<Pick<NoteLaneData, "defaultBpm" | "division" | "wdsOffset">>,
        ) => {
            if (!ensureEditable()) return false;
            try {
                const error = validateNoteLaneData({ ...lane, ...changes });
                if (error) throw new Error(error);
                updateLaneData(lane.id, (prev) => ({ ...prev, ...changes }));
                clearLaneError(lane.id);
                return true;
            } catch (error) {
                reportError(error);
                return false;
            }
        };
        const changeHistory = (direction: "undo" | "redo") => {
            if (!ensureEditable()) return;
            const stack = direction === "undo" ? editState.undoStack : editState.redoStack;
            if (!stack.length) return;
            try {
                const [top, ...rest] = stack;
                const current = cloneChart(lane.chartData);
                if (!setChartData(cloneChart(top), false)) return;
                setLaneEditState(lane.id, (prev) => ({
                    ...prev,
                    undoStack: direction === "undo" ? rest : [current, ...prev.undoStack].slice(0, MAX_UNDO),
                    redoStack: direction === "redo" ? rest : [current, ...prev.redoStack].slice(0, MAX_UNDO),
                    selectedIds: new Set<string>(),
                    lnHeadTime: null,
                }));
            } catch (error) {
                reportError(error);
            }
        };
        const editMeasure = (remove: boolean, ref?: ChartMeasureRef) => {
            if (!ensureEditable()) return;
            const target = ref ?? laneSelectedMeasureRefMap[lane.id];
            if (!target) return;
            try {
                const next = (remove ? deleteMeasureAtRef : insertMeasureAtRef)(
                    lane.chartData, target, lane.defaultBpm, lane.chartKind,
                );
                if (next) setChartData(next);
            } catch (error) {
                reportError(error);
            }
        };
        return {
            editState,
            isReadOnly,
            ensureEditable,
            reportError,
            pushUndo,
            setChartData,
            setLaneMetadata,
            onUndo: () => changeHistory("undo"),
            onRedo: () => changeHistory("redo"),
            onInsertMeasure: (ref?: ChartMeasureRef) => editMeasure(false, ref),
            onDeleteMeasure: (ref?: ChartMeasureRef) => editMeasure(true, ref),
        };
    }, [
        laneEditStateMap, laneSelectedMeasureRefMap, cloneChart,
        setLaneEditState, updateLaneData, setLaneError, clearLaneError,
    ]);

    const activeNoteMenuProps = useMemo(() => {
        if (!resolvedActiveLaneId) return null;
        const activeLane = noteLanes.find(
            (l) => l.id === resolvedActiveLaneId,
        );
        if (!activeLane) return null;

        const isWds = activeLane.chartKind === "wds";
        const {
            editState, isReadOnly, ensureEditable, reportError, pushUndo,
            setChartData, setLaneMetadata, onUndo, onRedo,
            onInsertMeasure, onDeleteMeasure,
        } = createLaneActions(activeLane);
        const selectedMeasureRef =
            laneSelectedMeasureRefMap[activeLane.id] ?? null;
        const selectedMeasure = locateMeasure(
            activeLane.chartData,
            selectedMeasureRef,
        );
        const currentLaneError =
            laneErrorMap[activeLane.id] ??
            validateNoteLaneData(activeLane) ??
            null;

        const selectedNotes = activeLane.chartData
            .flatMap((seg) => seg.measures)
            .flatMap((measure) => measure.notes)
            .filter((note) => editState.selectedIds.has(note.id));
        const selectedNote = editState.selectedIds.size === 1 && selectedNotes.length === 1
            ? selectedNotes[0]
            : null;
        const copySelection = () => isWds
            ? copyWdsNotes(activeLane.chartData, [...editState.selectedIds])
            : structuredClone(selectedNotes);
        const handleCopy = () => {
            if (!editState.selectedIds.size) return;
            try {
                const clipboard = copySelection();
                setLaneEditState(activeLane.id, (prev) => ({ ...prev, clipboard }));
            } catch (error) {
                reportError(error);
            }
        };
        const deleteSelection = (cut: boolean) => {
            if (!ensureEditable() || !editState.selectedIds.size) return;
            try {
                const clipboard = cut ? copySelection() : editState.clipboard;
                const next = isWds
                    ? removeWdsNotes(activeLane.chartData, [...editState.selectedIds])
                    : removeTrailingEmptyMeasures(activeLane.chartData.map((seg) => ({
                        ...seg,
                        measures: seg.measures.map((measure) => ({
                            notes: measure.notes.filter((note) => !editState.selectedIds.has(note.id)),
                        })),
                    })));
                if (!setChartData(next)) return;
                setLaneEditState(activeLane.id, (prev) => ({
                    ...prev,
                    clipboard,
                    selectedIds: new Set<string>(),
                    lnHeadTime: null,
                }));
            } catch (error) {
                reportError(error);
            }
        };

        const handleImportText = (text: string): string | null => {
            const currentJson = JSON.stringify({
                ...omitNoteLaneId(activeLane),
                chartData: stripChartDataTimes(activeLane.chartData),
            }, null, 2);
            if (text.trim() === currentJson) return null;
            if (!ensureEditable()) return WDS_READONLY_MESSAGE;
            try {
                const result = parseImportedNoteLaneText(text, activeLane);
                if ("error" in result) throw new Error(result.error);
                if (laneMetadataJson(activeLane) === laneMetadataJson(result.lane)) {
                    if (comparableJson(stripChartDataTimes(activeLane.chartData)) ===
                        comparableJson(stripChartDataTimes(result.lane.chartData))) return null;
                    if (!setChartData(result.lane.chartData)) return "保存谱面失败，请查看谱面错误";
                    setLaneEditState(activeLane.id, (prev) => ({
                        ...prev,
                        selectedIds: new Set<string>(),
                        lnHeadTime: null,
                    }));
                } else {
                    updateLaneData(activeLane.id, () => result.lane);
                    // Chart-only history cannot restore changed kind/BPM/offset
                    // metadata. Only those imports need a fresh history.
                    setLaneEditStateMap((prev) => ({
                        ...prev,
                        [activeLane.id]: {
                            ...defaultNoteEditState(result.lane.defaultBpm),
                            mode: result.lane.chartKind === "wds" ? "insert-wds" : "browse",
                        },
                    }));
                }
                setLaneSelectedMeasureRefMap((prev) => ({ ...prev, [activeLane.id]: null }));
                setLaneCursorTimeMap((prev) => ({ ...prev, [activeLane.id]: null }));
                clearLaneError(activeLane.id);
                return null;
            } catch (error) {
                return reportError(error);
            }
        };

        const exportPayload = validateNoteLaneData(activeLane)
            ? { error: validateNoteLaneData(activeLane)!, lane: activeLane }
            : activeLane;

        const laneWithoutId = omitNoteLaneId(activeLane);
        const strippedLane = {
            ...laneWithoutId,
            chartData: stripChartDataTimes(activeLane.chartData),
        };
        const exportTextPayload =
            exportPayload === activeLane
                ? strippedLane
                : { error: (exportPayload as { error: string }).error, lane: strippedLane };

        return {
            mode: editState.mode,
            setMode: (m: EditMode) =>
                setLaneEditState(activeLane.id, (prev) => ({
                    ...prev,
                    mode: m,
                    lnHeadTime: null,
                })),
            canUndo: !isReadOnly && editState.undoStack.length > 0,
            canRedo: !isReadOnly && editState.redoStack.length > 0,
            hasSelection: editState.selectedIds.size > 0,
            hasClipboard: editState.clipboard.length > 0,
            currentBpm: activeLane.defaultBpm,
            bpmLocked: isReadOnly,
            setCurrentBpm: (bpm: number) => {
                const safeBpm = isWds ? bpm : Math.max(1, Math.floor(bpm));
                if (!setLaneMetadata({ defaultBpm: safeBpm })) return;
                setLaneEditState(activeLane.id, (prev) => ({
                    ...prev,
                    currentBpm: safeBpm,
                }));
            },
            currentMeasureBpm: selectedMeasure?.tempo ?? null,
            canEditCurrentMeasureBpm: !isReadOnly && selectedMeasure !== null,
            setCurrentMeasureBpm: (bpm: number) => {
                if (!ensureEditable()) return;
                try {
                    if (!Number.isFinite(bpm) || bpm <= 0) throw new Error("BPM 必须是正有限数");
                    const safeBpm = isWds ? bpm : Math.max(1, Math.floor(bpm));
                    const activeNext = retimeSingleMeasureByBpm(
                        activeLane.chartData, selectedMeasureRef, safeBpm,
                    );
                    if (!activeNext) return;
                    if (isWds) {
                        setChartData(activeNext);
                        return;
                    }
                    // Preserve rhythm-grid synchronization, without touching
                    // any independent (potentially read-only) WDS chart.
                    const nextLanes = noteLanes.map((lane) => {
                        if (lane.chartKind === "wds") return lane;
                        const next = lane.id === activeLane.id ? activeNext : retimeSingleMeasureByBpm(
                            lane.chartData, selectedMeasureRef, safeBpm,
                        );
                        if (!next) return lane;
                        const nextLane = { ...lane, chartData: next };
                        const error = validateNoteLaneData(nextLane);
                        if (error) throw new Error(error);
                        return nextLane;
                    });
                    pushUndo(activeLane.chartData);
                    const charts = new Map(nextLanes.filter((lane, index) => lane !== noteLanes[index])
                        .map((lane) => [lane.id, lane.chartData]));
                    prop.setSoundLaneState(prop.index, (prev) => ({
                        ...prev,
                        noteLanes: prev.noteLanes.map((lane) => charts.has(lane.id)
                            ? { ...lane, chartData: charts.get(lane.id)! } : lane),
                    }));
                    clearLaneError(activeLane.id);
                } catch (error) {
                    reportError(error);
                }
            },
            division: activeLane.division,
            setDivision: (division: number) =>
                setLaneMetadata({
                    division: Math.max(1, Math.floor(division)),
                }),
            onDelete: () => deleteSelection(false),
            onCopy: handleCopy,
            onCut: () => deleteSelection(true),
            onUndo,
            onRedo,
            onClearLane: () => {
                if (!ensureEditable()) return;
                if (isWds) {
                    if (!setChartData([])) return;
                } else {
                    updateLaneData(activeLane.id, (prevLane) => ({
                        ...prevLane,
                        chartData: [],
                    }));
                }
                setLaneEditState(activeLane.id, (prev) => ({
                    ...prev,
                    selectedIds: new Set<string>(),
                    lnHeadTime: null,
                }));
                clearLaneError(activeLane.id);
            },
            onImportText: handleImportText,
            exportText: JSON.stringify(exportTextPayload, null, 2),
            malodyExportText: isWds ? "" : convertToMalody(
                activeLane,
                audioData?.file ?? "unknown",
            ),
            susExportText: isWds ? "" : convertToSus(
                activeLane,
                audioData?.file ?? "unknown",
            ),
            exportFileBaseName: audioData?.file ?? "notelane",
            lastError: currentLaneError,
            noteLaneOffset: prop.refSoundLaneState.noteLaneOffset ?? 0,
            setNoteLaneOffset: (offset: number) => {
                if (!Number.isFinite(offset)) {
                    reportError(new Error("图形偏移必须是有限秒数"));
                    return;
                }
                prop.setSoundLaneState(prop.index, (prev) => ({
                    ...prev,
                    noteLaneOffset: offset,
                }));
            },
            onInsertMeasure,
            onDeleteMeasure,
            getEditText: () => {
                return JSON.stringify(strippedLane, null, 2);
            },
            onEditSave: handleImportText,
            wds: isWds ? {
                type: editState.wdsType,
                properties: editState.wdsProperties,
                onTypeChange: (type: number) => {
                    try {
                        const defaults = defaultWdsProperties(type);
                        setLaneEditState(activeLane.id, (prev) => {
                            const lane = Number.isInteger(prev.wdsProperties.lane)
                                ? Math.max(1, Math.min(WDS_LANE_COUNT, prev.wdsProperties.lane)) : 1;
                            const width = Number.isInteger(prev.wdsProperties.width)
                                ? Math.max(1, Math.min(WDS_LANE_COUNT + 1 - lane, prev.wdsProperties.width)) : 1;
                            return {
                                ...prev,
                                mode: "insert-wds",
                                wdsType: type,
                                wdsProperties: { ...defaults, lane, width },
                                lnHeadTime: null,
                            };
                        });
                    } catch (error) {
                        reportError(error);
                    }
                },
                onPropertiesChange: (properties: WdsNoteProperties) => {
                    setLaneEditState(activeLane.id, (prev) => ({
                        ...prev, wdsProperties: { ...properties },
                    }));
                },
                selectedNote,
                onUpdateSelected: (note: ChartNote) => {
                    if (!ensureEditable()) return;
                    try {
                        if (!selectedNote || selectedNote.id !== note.id || !selectedNote.wds) {
                            throw new Error("请先选中一个 WDS 音符");
                        }
                        const merged = {
                            ...selectedNote,
                            ...note,
                            wds: { ...selectedNote.wds, ...note.wds },
                        };
                        setChartData(updateWdsNotes(
                            activeLane.chartData, [note.id], merged, activeLane.defaultBpm,
                        ));
                    } catch (error) {
                        reportError(error);
                    }
                },
                exportResult: convertToWds(activeLane),
                chartExportResult: convertToWdsChart(activeLane),
                offset: activeLane.wdsOffset ?? 0,
                setOffset: (seconds: number) => {
                    setLaneMetadata({ wdsOffset: seconds });
                },
            } : undefined,
        };
    }, [
        resolvedActiveLaneId,
        noteLanes,
        createLaneActions,
        laneSelectedMeasureRefMap,
        laneErrorMap,
        locateMeasure,
        retimeSingleMeasureByBpm,
        setLaneEditState,
        updateLaneData,
        clearLaneError,
        audioData,
        prop,
    ]);

    if (!audioData) {
        return <div>Audio not found</div>;
    }

    function handleClickToActivate() {
        prop.setSoundLaneState(prop.index, (prev) => ({
            ...prev,
            isActive: !prev.isActive,
        }));
        prop.onActivate?.(prop.audioId);
    }

    return (
        <div
            className={`SoundLane flex flex-col gap-1 border border-[var(--editor-border)] bg-[var(--editor-surface-strong)] p-1 shadow-[0_10px_24px_rgba(53,36,19,0.05)] cursor-pointer ${isVertical ? styles.vertical : ""}`}
            onClick={handleClickToActivate}
            style={{
                "--timeline-height": `${timelineHeight}px`,
                background: isPlaybackFrozen ? "rgba(226, 232, 240, 0.9)" : undefined,
            } as CSSProperties}
        >
            <div className={`w-auto ${styles.header}`} title={audioData.file}>
                <SoundFileTitleBar
                    soundFile={audioData.file}
                    isActive={prop.refSoundLaneState.isActive || false}
                    offset={prop.refSoundLaneState.offset ?? 0}
                    setOffset={(v) => {
                        prop.setSoundLaneState(prop.index, (prev) => ({
                            ...prev,
                            offset: v,
                        }));
                    }}
                    onDelete={prop.onDeleteSoundLane ? () => prop.onDeleteSoundLane?.(prop.audioId) : undefined}
                />
            </div>

            <div
                ref={editingRegionRef}
                className={`flex flex-col flex-1 gap-1 ${styles.editingRegion}`}
            >
                <div className={`flex items-start gap-1 ${styles.waveSection}`}>
                    <div
                        className={`editor-inspector-panel w-[176px] shrink-0 ${styles.inspector}`}
                        data-inspector="true"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-1">
                            <div className="editor-pane-caption">Wave</div>
                            <FoldWave
                                audioId={prop.audioId}
                                isFolded={prop.refSoundLaneState.waveLane.isFolded}
                                setIsFolded={(isFolded) => {
                                    prop.setSoundLaneState(prop.index, (prev) => ({
                                        ...prev,
                                        waveLane: {
                                            ...prev.waveLane,
                                            isFolded,
                                        },
                                    }));
                                }}
                            />
                        </div>
                        {!prop.refSoundLaneState.waveLane.isFolded && (
                            <WaveMenu
                                audioId={prop.audioId}
                                waveState={prop.refSoundLaneState.waveLane}
                                setWaveState={(waveLane) => {
                                    prop.setSoundLaneState(prop.index, (prev) => ({
                                        ...prev,
                                        waveLane,
                                    }));
                                }}
                            />
                        )}
                    </div>
                    <div
                        className={`flex-1 min-w-0 ${styles.waveCanvas}`}
                        data-folded={prop.refSoundLaneState.waveLane.isFolded}
                    >
                        {!prop.refSoundLaneState.waveLane.isFolded && (
                            <WaveLane
                                audioId={prop.audioId}
                                timeRange={prop.timeRange}
                                orientation={orientation}
                                timelineHeight={timelineHeight}
                                waveState={prop.refSoundLaneState.waveLane}
                                setWaveState={(waveLane) => {
                                    prop.setSoundLaneState(prop.index, (prev) => ({
                                        ...prev,
                                        waveLane,
                                    }));
                                }}
                                cursorTime={renderCursorTime}
                                playheadTime={renderPlayheadTime}
                                isPlaybackFrozen={isPlaybackFrozen}
                            />
                        )}
                    </div>
                </div>

                <div className={`flex items-start gap-1 ${styles.spectrumSection}`}>
                    <div
                        className={`editor-inspector-panel w-[176px] shrink-0 ${styles.inspector}`}
                        data-inspector="true"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-1">
                            <div className="editor-pane-caption">Spectrum</div>
                            <FoldSpectrum
                                audioId={prop.audioId}
                                isFolded={prop.refSoundLaneState.spectrumLane.isFolded}
                                setIsFolded={(isFolded) => {
                                    prop.setSoundLaneState(prop.index, (prev) => ({
                                        ...prev,
                                        spectrumLane: {
                                            ...prev.spectrumLane,
                                            isFolded,
                                        },
                                    }));
                                }}
                            />
                        </div>
                        {!prop.refSoundLaneState.spectrumLane.isFolded && (
                            <SpectrumMenu
                                audioId={prop.audioId}
                                spectrumState={prop.refSoundLaneState.spectrumLane}
                                setSpectrumState={(spectrumLane) => {
                                    prop.setSoundLaneState(prop.index, (prev) => ({
                                        ...prev,
                                        spectrumLane,
                                    }));
                                }}
                            />
                        )}
                    </div>
                    <div
                        className={`flex-1 min-w-0 ${styles.spectrumCanvas}`}
                        data-folded={prop.refSoundLaneState.spectrumLane.isFolded}
                    >
                        <div className={prop.refSoundLaneState.spectrumLane.isFolded ? 'hidden' : ''}>
                            <SpectrumLane
                                audioId={prop.audioId}
                                timeRange={prop.timeRange}
                                orientation={orientation}
                                timelineHeight={timelineHeight}
                                spectrumState={
                                    prop.refSoundLaneState.spectrumLane
                                }
                                setSpectrumState={(spectrumLane) => {
                                    prop.setSoundLaneState(prop.index, (prev) => ({
                                        ...prev,
                                        spectrumLane,
                                    }));
                                }}
                                cursorTime={renderCursorTime}
                                playheadTime={renderPlayheadTime}
                                isPlaybackFrozen={isPlaybackFrozen}
                            />
                        </div>
                    </div>
                </div>

                {/* Note area: shared NoteMenu + stacked NoteLanes */}
                <div
                    className={`flex items-start gap-1 ${styles.noteSection}`}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div
                        className={`editor-inspector-panel w-[176px] shrink-0 self-stretch ${styles.inspector}`}
                        data-inspector="true"
                    >
                        <div className="flex flex-wrap items-center gap-1">
                            <div className="editor-pane-caption">谱面</div>
                            <button
                                type="button"
                                onClick={handleToggleNoteFold}
                                disabled={visibleNoteLanes.length === 0}
                                title={allVisibleNoteLanesFolded ? "展开记谱" : "折叠记谱"}
                                className="inline-flex items-center justify-center w-5 h-5 border-0 bg-transparent cursor-pointer rounded-md p-0 opacity-55 hover:opacity-100 hover:bg-[rgba(15,118,110,0.12)] transition-[opacity,background-color] duration-200"
                            >
                                <Image
                                    src={allVisibleNoteLanesFolded ? "/assets/icons/unfold.png" : "/assets/icons/fold.png"}
                                    alt={allVisibleNoteLanesFolded ? "展开记谱" : "折叠记谱"}
                                    width={14}
                                    height={14}
                                />
                            </button>
                            <button
                                type="button"
                                className="inline-flex items-center justify-center w-5 h-5 border-0 bg-transparent cursor-pointer rounded-md p-0 opacity-55 hover:opacity-100 hover:bg-[rgba(15,118,110,0.12)] transition-[opacity,background-color] duration-200"
                                onClick={() => handleAddNoteLane(noteEditorKind)}
                                onMouseDown={(e) => e.stopPropagation()}
                                title="新建记谱"
                                aria-label="新建记谱"
                            >
                                <Image
                                    src="/assets/icons/newNoteLane.svg"
                                    alt="新建记谱"
                                    width={14}
                                    height={14}
                                />
                            </button>
                            <button
                                type="button"
                                className={styles.noteEditorToggle}
                                onClick={handleToggleNoteEditor}
                                onMouseDown={(e) => e.stopPropagation()}
                                aria-pressed={noteEditorKind === "wds"}
                                title={noteEditorKind === "wds" ? "返回节奏记谱" : "切换到 WDS 制谱器"}
                            >
                                制谱器
                            </button>
                        </div>
                        {noteLanes.length === 0 && (
                            <p className={styles.emptyNoteLane}>暂无记谱，点击新建记谱</p>
                        )}
                        {activeNoteMenuProps && !allVisibleNoteLanesFolded && (
                            <NoteMenu
                                key={`${resolvedActiveLaneId}:${!!activeNoteMenuProps.wds}`}
                                {...activeNoteMenuProps}
                                onDeleteLane={() => {
                                    if (resolvedActiveLaneId) deleteNoteLane(resolvedActiveLaneId);
                                }}
                            />
                        )}
                    </div>
                    <div className={`flex-1 min-w-0 flex flex-col gap-1 ${styles.noteCanvases}`}>
                        {visibleNoteLanes.map((lane: NoteLaneData) => {
                            if (lane.isFolded) return null;
                            const {
                                editState, setChartData, setLaneMetadata,
                                onUndo, onRedo, onInsertMeasure, onDeleteMeasure,
                            } = createLaneActions(lane);
                            const LaneCanvas = lane.chartKind === "wds" ? WdsLane : NoteLane;
                            const selectedMeasureRef =
                                laneSelectedMeasureRefMap[lane.id] ?? null;
                            const handleSnapTimeChange =
                                laneSnapHandlers[lane.id];
                            const handleSelectMeasure =
                                laneMeasureSelectHandlers[lane.id];

                            return (
                                <div
                                    key={lane.id}
                                    className={styles.noteCanvas}
                                    data-chart-kind={lane.chartKind ?? "rhythm"}
                                    data-active={lane.id === resolvedActiveLaneId}
                                >
                                    <LaneCanvas
                                        chartData={lane.chartData}
                                        setChartData={setChartData}
                                        timeRange={prop.timeRange}
                                        orientation={orientation}
                                        timelineHeight={timelineHeight}
                                        graphicalOffset={prop.refSoundLaneState.noteLaneOffset ?? 0}
                                        playheadTime={renderPlayheadTime}
                                        isPlaybackFrozen={isPlaybackFrozen}
                                        beatSubdivision={lane.division}
                                        setBeatSubdivision={(division: number) =>
                                            setLaneMetadata({ division: Math.max(1, Math.floor(division)) })
                                        }
                                        height={isVertical ? lane.chartKind === "wds" ? 432 : 220 : 120}
                                        editState={editState}
                                        setEditState={(updater: SetStateAction<NoteEditState>) => {
                                            setLaneEditState(lane.id, (prev) =>
                                                typeof updater === "function"
                                                    ? updater(prev)
                                                    : updater,
                                            );
                                        }}
                                        songDuration={audioData.duration ?? 0}
                                        onUndo={onUndo}
                                        onRedo={onRedo}
                                        onSnapTimeChange={handleSnapTimeChange}
                                        selectedMeasureRef={selectedMeasureRef}
                                        onSelectMeasure={handleSelectMeasure}
                                        onActivate={() =>
                                            selectNoteLane(lane.id)
                                        }
                                        laneId={lane.id}
                                        onInsertMeasure={onInsertMeasure}
                                        onDeleteMeasure={onDeleteMeasure}
                                        onError={(message: string) => setLaneError(lane.id, message)}
                                        onRequestVertical={() => {
                                            selectNoteLane(lane.id);
                                            prop.onRequestVertical?.();
                                        }}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
