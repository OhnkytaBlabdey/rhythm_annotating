"use client";
import "./soundLane.module.css";
import SoundFileTitleBar from "./soundFileTitleBar";

import WaveLane from "./waveArea/waveLane";
import SpectrumLane from "./spectrumArea/spectrumLane";
import WaveMenu from "./soundMenu/waveMenu/waveMenu";
import FoldWave from "./soundMenu/waveMenu/foldWave";
import SpectrumMenu from "./soundMenu/spectrumMenu/spectrumMenu";
import FoldSpectrum from "./soundMenu/spectrumMenu/foldSpectrum";
import NoteMenu from "./noteArea/noteMenu/noteMenu";
import { useContext, useCallback, useMemo, useState } from "react";
import { AudioDataCtx } from "../audioContext";
import { SoundLaneState, defaultNoteLaneData } from "@/interface/audioData";
import NoteLane from "./noteArea/noteLane";
import {
    ChartSegment,
    ChartMeasure,
    ChartNote,
    NoteLaneData,
} from "./noteArea/chartTypes";
import {
    defaultNoteEditState,
    EditMode,
    NoteEditState,
} from "./noteArea/noteState";
import {
    parseImportedNoteLaneText,
    validateChartData,
    validateNoteLaneData,
    normalizeFraction,
} from "./noteArea/chartAdapter";

const MAX_UNDO = 50;

interface _prop {
    index: number;
    audioId: string;
    timeRange: [number, number];
    refSoundLaneState: SoundLaneState;
    setSoundLaneState: (i: number, state: SoundLaneState) => void;
    onActivate?: (audioId: string) => void;
}

export default function SoundLane(prop: _prop) {
    const audioDataList = useContext(AudioDataCtx);
    const audioData = audioDataList.find((a) => a.id === prop.audioId);
    const noteLanes = useMemo(
        () =>
            Array.isArray(prop.refSoundLaneState.noteLanes) &&
            prop.refSoundLaneState.noteLanes.length > 0
                ? prop.refSoundLaneState.noteLanes
                : [defaultNoteLaneData()],
        [prop.refSoundLaneState.noteLanes],
    );

    const [laneEditStateMap, setLaneEditStateMap] = useState<
        Record<string, NoteEditState>
    >({});
    const [, setLaneCursorTimeMap] = useState<Record<string, number | null>>(
        {},
    );
    const [laneSelectedMeasureTimeMap, setLaneSelectedMeasureTimeMap] =
        useState<Record<string, number | null>>({});
    const [laneErrorMap, setLaneErrorMap] = useState<Record<string, string>>(
        {},
    );
    const [activeNoteLaneId, setActiveNoteLaneId] = useState<string | null>(
        null,
    );

    const resolvedActiveLaneId = useMemo(() => {
        if (activeNoteLaneId && noteLanes.some((l) => l.id === activeNoteLaneId)) {
            return activeNoteLaneId;
        }
        return noteLanes[0]?.id ?? null;
    }, [activeNoteLaneId, noteLanes]);

    const sortedNoteLanes = useMemo(() => {
        const active = noteLanes.find((l) => l.id === resolvedActiveLaneId);
        const others = noteLanes.filter((l) => l.id !== resolvedActiveLaneId);
        return active ? [active, ...others] : [...noteLanes];
    }, [noteLanes, resolvedActiveLaneId]);

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
        const handlers: Record<string, (time: number | null) => void> = {};
        for (const lane of noteLanes) {
            const laneId = lane.id;
            handlers[laneId] = (time: number | null) => {
                setLaneSelectedMeasureTimeMap((prev) => {
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
                const base =
                    prev[laneId] ??
                    defaultNoteEditState(
                        lane?.defaultBpm !== undefined
                            ? Math.max(1, Math.floor(lane.defaultBpm))
                            : 120,
                    );
                return {
                    ...prev,
                    [laneId]: updater(base),
                };
            });
        },
        [noteLanes],
    );

    const updateLaneData = useCallback(
        (
            laneId: string,
            updater: (lane: NoteLaneData) => NoteLaneData | null,
        ) => {
            const nextLanes = noteLanes
                .map((lane: NoteLaneData) => {
                    if (lane.id !== laneId) return lane;
                    return updater(lane);
                })
                .filter(
                    (lane: NoteLaneData | null): lane is NoteLaneData =>
                        lane !== null,
                );
            const finalLanes =
                nextLanes.length > 0 ? nextLanes : [defaultNoteLaneData()];

            prop.setSoundLaneState(prop.index, {
                ...prop.refSoundLaneState,
                noteLanes: finalLanes,
            });

            const activeIds = new Set(
                finalLanes.map((lane: NoteLaneData) => lane.id),
            );
            setLaneEditStateMap((prev) => {
                const next: Record<string, NoteEditState> = {};
                for (const id of Object.keys(prev)) {
                    if (activeIds.has(id)) {
                        next[id] = prev[id];
                    }
                }
                return next;
            });
            setLaneErrorMap((prev) => {
                const next: Record<string, string> = {};
                for (const id of Object.keys(prev)) {
                    if (activeIds.has(id)) {
                        next[id] = prev[id];
                    }
                }
                return next;
            });
            setLaneSelectedMeasureTimeMap((prev) => {
                const next: Record<string, number | null> = {};
                for (const id of Object.keys(prev)) {
                    if (activeIds.has(id)) {
                        next[id] = prev[id];
                    }
                }
                return next;
            });
        },
        [noteLanes, prop],
    );

    const handleAddNoteLane = useCallback(() => {
        const nextLane = defaultNoteLaneData();
        prop.setSoundLaneState(prop.index, {
            ...prop.refSoundLaneState,
            noteLanes: [...noteLanes, nextLane],
        });
        setLaneEditStateMap((prev) => ({
            ...prev,
            [nextLane.id]: defaultNoteEditState(nextLane.defaultBpm),
        }));
    }, [noteLanes, prop]);

    /** Deep-clone chartData for undo snapshot */
    const cloneChart = useCallback(
        (data: ChartSegment[]): ChartSegment[] =>
            data.map((seg) => ({
                ...seg,
                measures: seg.measures.map((m) => ({ notes: [...m.notes] })),
            })),
        [],
    );

    const locateMeasureAtTime = useCallback(
        (data: ChartSegment[], time: number | null) => {
            if (time === null || !Number.isFinite(time)) {
                return null;
            }

            const sorted = cloneChart(data).sort((a, b) => a.time - b.time);
            for (let s = 0; s < sorted.length; s++) {
                const seg = sorted[s];
                const segTempo =
                    Number.isFinite(seg.tempo) && seg.tempo > 0
                        ? seg.tempo
                        : 120;
                const beatDuration = 60 / segTempo;
                for (let m = 0; m < seg.measures.length; m++) {
                    const start = seg.time + m * beatDuration;
                    const end = start + beatDuration;
                    const isLastMeasure =
                        s === sorted.length - 1 &&
                        m === seg.measures.length - 1;
                    if (
                        time >= start - 1e-6 &&
                        (time < end - 1e-6 ||
                            (isLastMeasure && time <= end + 1e-6))
                    ) {
                        return {
                            sorted,
                            segmentIndex: s,
                            measureIndex: m,
                            tempo: segTempo,
                            measureStart: start,
                        };
                    }
                }
            }

            return null;
        },
        [cloneChart],
    );

    const retimeSingleMeasureByBpm = useCallback(
        (data: ChartSegment[], time: number | null, bpm: number) => {
            const located = locateMeasureAtTime(data, time);
            if (!located) {
                return null;
            }

            const safeBpm = Math.max(1, Math.floor(bpm));
            const { sorted, segmentIndex, measureIndex } = located;
            const tailVirtualTempo = (() => {
                const last = sorted[sorted.length - 1];
                if (!last || last.measures.length > 0) {
                    return null;
                }
                return Number.isFinite(last.tempo) && last.tempo > 0
                    ? Math.max(1, Math.floor(last.tempo))
                    : null;
            })();
            const chunks: Array<{ tempo: number; measures: ChartMeasure[] }> =
                [];

            for (let s = 0; s < sorted.length; s++) {
                const seg = sorted[s];
                const segTempo = Math.max(1, Math.floor(seg.tempo));
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
                const safeTempo = Math.max(1, Math.floor(chunk.tempo));
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
                        measures: [],
                    });
                }
            }

            return rebuilt;
        },
        [locateMeasureAtTime],
    );

    const retimeChartByBpm = useCallback(
        (data: ChartSegment[], bpm: number) => {
            const safeBpm = Math.max(1, Math.floor(bpm));
            const sorted = data
                .map((seg) => ({
                    ...seg,
                    measures: seg.measures.map((m) => ({
                        notes: [...m.notes],
                    })),
                }))
                .sort((a, b) => a.time - b.time);

            if (sorted.length === 0) {
                return [
                    {
                        time: 0,
                        tempo: safeBpm,
                        measures: [{ notes: [] }],
                    },
                ];
            }

            const isEditableMeasure = (measure: { notes: ChartNote[] }) => {
                if (measure.notes.length === 0) {
                    return true;
                }
                return measure.notes.every((note) => {
                    const head = normalizeFraction(note.head);
                    if (!head) return false;
                    const isZeroHead = head.a === 0;
                    const hasTail = note.tail !== undefined;
                    const hasBody =
                        Array.isArray(note.body) && note.body.length > 0;
                    return isZeroHead && !hasTail && !hasBody;
                });
            };

            let boundarySeg = 0;
            let boundaryMeasure = 0;
            let foundBoundary = false;

            for (let s = sorted.length - 1; s >= 0; s--) {
                const seg = sorted[s];
                for (let m = seg.measures.length - 1; m >= 0; m--) {
                    if (isEditableMeasure(seg.measures[m])) {
                        continue;
                    }
                    boundarySeg = s;
                    boundaryMeasure = m + 1;
                    foundBoundary = true;
                    break;
                }
                if (foundBoundary) {
                    break;
                }
            }

            if (!foundBoundary) {
                boundarySeg = 0;
                boundaryMeasure = 0;
            }

            const prefix: ChartSegment[] = [];
            const suffixMeasures: Array<{ notes: ChartNote[] }> = [];

            for (let s = 0; s < sorted.length; s++) {
                const seg = sorted[s];
                if (s < boundarySeg) {
                    prefix.push(seg);
                    continue;
                }

                if (s === boundarySeg) {
                    const keep = seg.measures.slice(0, boundaryMeasure);
                    const rest = seg.measures.slice(boundaryMeasure);
                    if (keep.length > 0) {
                        prefix.push({
                            ...seg,
                            measures: keep,
                        });
                    }
                    suffixMeasures.push(...rest);
                    continue;
                }

                suffixMeasures.push(...seg.measures);
            }

            let suffixStart = 0;
            if (prefix.length > 0) {
                const tail = prefix[prefix.length - 1];
                const tailBeatDuration = 60 / Math.max(1, tail.tempo);
                suffixStart =
                    tail.time + tail.measures.length * tailBeatDuration;
            }

            if (suffixMeasures.length === 0) {
                if (
                    prefix.length > 0 &&
                    Math.abs(prefix[prefix.length - 1].tempo - safeBpm) < 1e-6
                ) {
                    return prefix;
                }
                return [
                    ...prefix,
                    {
                        time: suffixStart,
                        tempo: safeBpm,
                        measures: [],
                    },
                ];
            }

            if (
                prefix.length > 0 &&
                Math.abs(prefix[prefix.length - 1].tempo - safeBpm) < 1e-6
            ) {
                const merged = [...prefix];
                merged[merged.length - 1] = {
                    ...merged[merged.length - 1],
                    measures: [
                        ...merged[merged.length - 1].measures,
                        ...suffixMeasures,
                    ],
                };
                return merged;
            }

            return [
                ...prefix,
                {
                    time: suffixStart,
                    tempo: safeBpm,
                    measures: suffixMeasures,
                },
            ];
        },
        [],
    );

    const activeNoteMenuProps = useMemo(() => {
        if (!resolvedActiveLaneId) return null;
        const activeLane = noteLanes.find(
            (l) => l.id === resolvedActiveLaneId,
        );
        if (!activeLane) return null;

        const editState =
            laneEditStateMap[activeLane.id] ??
            defaultNoteEditState(activeLane.defaultBpm);
        const selectedMeasureTime =
            laneSelectedMeasureTimeMap[activeLane.id] ?? null;
        const selectedMeasure = locateMeasureAtTime(
            activeLane.chartData,
            selectedMeasureTime,
        );
        const currentLaneError =
            laneErrorMap[activeLane.id] ??
            validateNoteLaneData(activeLane) ??
            null;

        const pushUndo = (before: ChartSegment[]) => {
            setLaneEditState(activeLane.id, (prev) => {
                const stack = [cloneChart(before), ...prev.undoStack].slice(
                    0,
                    MAX_UNDO,
                );
                return { ...prev, undoStack: stack, redoStack: [] };
            });
        };

        const setChartData = (
            next: ChartSegment[],
            saveUndo = true,
        ): boolean => {
            const error = validateChartData(next);
            if (error) {
                setLaneError(activeLane.id, error);
                return false;
            }
            clearLaneError(activeLane.id);
            if (saveUndo) {
                pushUndo(activeLane.chartData);
            }
            updateLaneData(activeLane.id, (prevLane) => ({
                ...prevLane,
                chartData: next,
            }));
            return true;
        };

        const handleUndo = () => {
            if (editState.undoStack.length === 0) return;
            const [top, ...rest] = editState.undoStack;
            const current = cloneChart(activeLane.chartData);
            updateLaneData(activeLane.id, (prevLane) => ({
                ...prevLane,
                chartData: top,
            }));
            setLaneEditState(activeLane.id, (prev) => ({
                ...prev,
                undoStack: rest,
                redoStack: [current, ...prev.redoStack].slice(0, MAX_UNDO),
            }));
        };

        const handleRedo = () => {
            if (editState.redoStack.length === 0) return;
            const [top, ...rest] = editState.redoStack;
            const current = cloneChart(activeLane.chartData);
            updateLaneData(activeLane.id, (prevLane) => ({
                ...prevLane,
                chartData: top,
            }));
            setLaneEditState(activeLane.id, (prev) => ({
                ...prev,
                redoStack: rest,
                undoStack: [current, ...prev.undoStack].slice(0, MAX_UNDO),
            }));
        };

        const handleCopy = () => {
            setLaneEditState(activeLane.id, (prev) => {
                if (prev.selectedIds.size === 0) return prev;
                const copied = activeLane.chartData
                    .flatMap((seg) => seg.measures)
                    .flatMap((m) => m.notes)
                    .filter((n) => prev.selectedIds.has(n.id));
                return { ...prev, clipboard: copied };
            });
        };

        const handleCut = () => {
            setLaneEditState(activeLane.id, (prev) => {
                if (prev.selectedIds.size === 0) return prev;
                const copied = activeLane.chartData
                    .flatMap((seg) => seg.measures)
                    .flatMap((m) => m.notes)
                    .filter((n) => prev.selectedIds.has(n.id));
                const ids = prev.selectedIds;
                const next = activeLane.chartData.map((seg) => ({
                    ...seg,
                    measures: seg.measures.map((m) => ({
                        notes: m.notes.filter((n) => !ids.has(n.id)),
                    })),
                }));
                const error = validateChartData(next);
                if (error) {
                    setLaneError(activeLane.id, error);
                    return prev;
                }
                clearLaneError(activeLane.id);
                pushUndo(activeLane.chartData);
                updateLaneData(activeLane.id, (prevLane) => ({
                    ...prevLane,
                    chartData: next,
                }));
                return {
                    ...prev,
                    clipboard: copied,
                    selectedIds: new Set<string>(),
                };
            });
        };

        const handleDelete = () => {
            setLaneEditState(activeLane.id, (prev) => {
                if (prev.selectedIds.size === 0) return prev;
                const ids = prev.selectedIds;
                const next = activeLane.chartData.map((seg) => ({
                    ...seg,
                    measures: seg.measures.map((m) => ({
                        notes: m.notes.filter((n) => !ids.has(n.id)),
                    })),
                }));
                const error = validateChartData(next);
                if (error) {
                    setLaneError(activeLane.id, error);
                    return prev;
                }
                clearLaneError(activeLane.id);
                pushUndo(activeLane.chartData);
                updateLaneData(activeLane.id, (prevLane) => ({
                    ...prevLane,
                    chartData: next,
                }));
                return {
                    ...prev,
                    selectedIds: new Set<string>(),
                };
            });
        };

        const handleImportText = (text: string): string | null => {
            const result = parseImportedNoteLaneText(text, activeLane);
            if ("error" in result) {
                setLaneError(activeLane.id, result.error);
                return result.error;
            }
            clearLaneError(activeLane.id);
            pushUndo(activeLane.chartData);
            updateLaneData(activeLane.id, () => result.lane);
            setLaneEditState(activeLane.id, (prev) => ({
                ...prev,
                selectedIds: new Set<string>(),
                lnHeadTime: null,
                undoStack: prev.undoStack,
                redoStack: [],
                currentBpm: result.lane.defaultBpm,
            }));
            return null;
        };

        const exportPayload = validateNoteLaneData(activeLane)
            ? { error: validateNoteLaneData(activeLane)!, lane: activeLane }
            : activeLane;

        return {
            mode: editState.mode,
            setMode: (m: EditMode) =>
                setLaneEditState(activeLane.id, (prev) => ({
                    ...prev,
                    mode: m,
                    lnHeadTime: null,
                })),
            canUndo: editState.undoStack.length > 0,
            canRedo: editState.redoStack.length > 0,
            hasSelection: editState.selectedIds.size > 0,
            hasClipboard: editState.clipboard.length > 0,
            currentBpm: activeLane.defaultBpm,
            setCurrentBpm: (bpm: number) => {
                const safeBpm = Math.max(1, Math.floor(bpm));
                setLaneEditState(activeLane.id, (prev) => ({
                    ...prev,
                    currentBpm: safeBpm,
                }));
                updateLaneData(activeLane.id, (prevLane) => ({
                    ...prevLane,
                    defaultBpm: safeBpm,
                }));
            },
            currentMeasureBpm: selectedMeasure?.tempo ?? null,
            canEditCurrentMeasureBpm: selectedMeasure !== null,
            setCurrentMeasureBpm: (bpm: number) => {
                const safeBpm = Math.max(1, Math.floor(bpm));
                const next = retimeSingleMeasureByBpm(
                    activeLane.chartData,
                    selectedMeasureTime,
                    safeBpm,
                );
                if (!next) return;
                const error = validateChartData(next);
                if (error) {
                    setLaneError(activeLane.id, error);
                    return;
                }
                clearLaneError(activeLane.id);
                pushUndo(activeLane.chartData);
                updateLaneData(activeLane.id, (prevLane) => ({
                    ...prevLane,
                    chartData: next,
                }));
            },
            division: activeLane.division,
            setDivision: (division: number) =>
                updateLaneData(activeLane.id, (prevLane) => ({
                    ...prevLane,
                    division: Math.max(1, Math.floor(division)),
                })),
            onDelete: handleDelete,
            onCopy: handleCopy,
            onCut: handleCut,
            onUndo: handleUndo,
            onRedo: handleRedo,
            onDeleteLane: () => {
                updateLaneData(activeLane.id, () => null);
            },
            onClearLane: () => {
                const resetBpm = Math.max(
                    1,
                    Math.floor(activeLane.defaultBpm),
                );
                updateLaneData(activeLane.id, (prevLane) => ({
                    ...prevLane,
                    chartData: [
                        {
                            time: 0,
                            tempo: resetBpm,
                            measures: [{ notes: [] }],
                        },
                    ],
                }));
                setLaneEditState(activeLane.id, (prev) => ({
                    ...prev,
                    selectedIds: new Set<string>(),
                    lnHeadTime: null,
                }));
                clearLaneError(activeLane.id);
            },
            onImportText: handleImportText,
            exportText: JSON.stringify(exportPayload, null, 2),
            lastError: currentLaneError,
            onAddNoteLane: handleAddNoteLane,
        };
    }, [
        resolvedActiveLaneId,
        noteLanes,
        laneEditStateMap,
        laneSelectedMeasureTimeMap,
        laneErrorMap,
        locateMeasureAtTime,
        cloneChart,
        retimeSingleMeasureByBpm,
        setLaneEditState,
        updateLaneData,
        setLaneError,
        clearLaneError,
        handleAddNoteLane,
    ]);

    if (!audioData) {
        return <div>Audio not found</div>;
    }

    function handleClickToActivate() {
        const updatedState = {
            ...prop.refSoundLaneState,
            isActive: !prop.refSoundLaneState.isActive,
        };
        prop.setSoundLaneState(prop.index, updatedState);
        prop.onActivate?.(prop.audioId);
    }

    return (
        <div
            className="SoundLane flex flex-col gap-3 rounded-[26px] border border-[var(--editor-border)] bg-[var(--editor-surface)] p-4 shadow-[0_12px_34px_rgba(53,36,19,0.06)] cursor-pointer"
            onClick={handleClickToActivate}
        >
            <div className="w-auto">
                <SoundFileTitleBar
                    soundFile={audioData.file}
                    isActive={prop.refSoundLaneState.isActive || false}
                />
            </div>

            <div className="flex flex-col flex-1 gap-2 mt-2">
                <div className="flex items-start gap-3">
                    <div
                        className="editor-inspector-panel w-[176px] shrink-0"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-2 px-2 pt-2">
                            <div className="editor-pane-caption">Wave</div>
                            <FoldWave
                                audioId={prop.audioId}
                                isFolded={prop.refSoundLaneState.waveLane.isFolded}
                                setIsFolded={(isFolded) => {
                                    prop.setSoundLaneState(prop.index, {
                                        ...prop.refSoundLaneState,
                                        waveLane: {
                                            ...prop.refSoundLaneState.waveLane,
                                            isFolded,
                                        },
                                    });
                                }}
                            />
                        </div>
                        <WaveMenu
                            audioId={prop.audioId}
                            waveState={prop.refSoundLaneState.waveLane}
                            setWaveState={(waveLane) => {
                                prop.setSoundLaneState(prop.index, {
                                    ...prop.refSoundLaneState,
                                    waveLane,
                                });
                            }}
                        />
                    </div>
                    <div className="flex-1 min-w-0">
                        {!prop.refSoundLaneState.waveLane.isFolded && (
                            <WaveLane
                                audioId={prop.audioId}
                                timeRange={prop.timeRange}
                                waveState={prop.refSoundLaneState.waveLane}
                                setWaveState={(waveLane) => {
                                    prop.setSoundLaneState(prop.index, {
                                        ...prop.refSoundLaneState,
                                        waveLane,
                                    });
                                }}
                            />
                        )}
                    </div>
                </div>

                <div className="flex items-start gap-3">
                    <div
                        className="editor-inspector-panel w-[176px] shrink-0"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-2 px-2 pt-2">
                            <div className="editor-pane-caption">Spectrum</div>
                            <FoldSpectrum
                                audioId={prop.audioId}
                                isFolded={prop.refSoundLaneState.spectrumLane.isFolded}
                                setIsFolded={(isFolded) => {
                                    prop.setSoundLaneState(prop.index, {
                                        ...prop.refSoundLaneState,
                                        spectrumLane: {
                                            ...prop.refSoundLaneState.spectrumLane,
                                            isFolded,
                                        },
                                    });
                                }}
                            />
                        </div>
                        <SpectrumMenu
                            audioId={prop.audioId}
                            spectrumState={prop.refSoundLaneState.spectrumLane}
                            setSpectrumState={(spectrumLane) => {
                                prop.setSoundLaneState(prop.index, {
                                    ...prop.refSoundLaneState,
                                    spectrumLane,
                                });
                            }}
                        />
                    </div>
                    <div className="flex-1 min-w-0">
                        {!prop.refSoundLaneState.spectrumLane.isFolded && (
                            <SpectrumLane
                                audioId={prop.audioId}
                                timeRange={prop.timeRange}
                                spectrumState={
                                    prop.refSoundLaneState.spectrumLane
                                }
                                setSpectrumState={(spectrumLane) => {
                                    prop.setSoundLaneState(prop.index, {
                                        ...prop.refSoundLaneState,
                                        spectrumLane,
                                    });
                                }}
                            />
                        )}
                    </div>
                </div>

                {/* Note area: shared NoteMenu + stacked NoteLanes */}
                <div
                    className="flex items-start gap-3"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="editor-inspector-panel w-[176px] shrink-0 self-stretch">
                        <div className="editor-pane-caption">Note Lane</div>
                        {activeNoteMenuProps && (
                            <NoteMenu {...activeNoteMenuProps} />
                        )}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col gap-2">
                        {sortedNoteLanes.map((lane: NoteLaneData) => {
                            const editState =
                                laneEditStateMap[lane.id] ??
                                defaultNoteEditState(lane.defaultBpm);
                            const selectedMeasureTime =
                                laneSelectedMeasureTimeMap[lane.id] ?? null;
                            const handleSnapTimeChange =
                                laneSnapHandlers[lane.id];
                            const handleSelectMeasure =
                                laneMeasureSelectHandlers[lane.id];

                            const pushUndo = (before: ChartSegment[]) => {
                                setLaneEditState(lane.id, (prev) => {
                                    const stack = [
                                        cloneChart(before),
                                        ...prev.undoStack,
                                    ].slice(0, MAX_UNDO);
                                    return {
                                        ...prev,
                                        undoStack: stack,
                                        redoStack: [],
                                    };
                                });
                            };

                            const setChartData = (
                                next: ChartSegment[],
                                saveUndo = true,
                            ): boolean => {
                                const error = validateChartData(next);
                                if (error) {
                                    setLaneError(lane.id, error);
                                    return false;
                                }

                                clearLaneError(lane.id);
                                if (saveUndo) {
                                    pushUndo(lane.chartData);
                                }
                                updateLaneData(lane.id, (prevLane) => ({
                                    ...prevLane,
                                    chartData: next,
                                }));
                                return true;
                            };

                            const handleUndo = () => {
                                if (editState.undoStack.length === 0) return;
                                const [top, ...rest] = editState.undoStack;
                                const current = cloneChart(lane.chartData);
                                updateLaneData(lane.id, (prevLane) => ({
                                    ...prevLane,
                                    chartData: top,
                                }));
                                setLaneEditState(lane.id, (prev) => ({
                                    ...prev,
                                    undoStack: rest,
                                    redoStack: [
                                        current,
                                        ...prev.redoStack,
                                    ].slice(0, MAX_UNDO),
                                }));
                            };

                            const handleRedo = () => {
                                if (editState.redoStack.length === 0) return;
                                const [top, ...rest] = editState.redoStack;
                                const current = cloneChart(lane.chartData);
                                updateLaneData(lane.id, (prevLane) => ({
                                    ...prevLane,
                                    chartData: top,
                                }));
                                setLaneEditState(lane.id, (prev) => ({
                                    ...prev,
                                    redoStack: rest,
                                    undoStack: [
                                        current,
                                        ...prev.undoStack,
                                    ].slice(0, MAX_UNDO),
                                }));
                            };

                            return (
                                <NoteLane
                                    key={lane.id}
                                    chartData={lane.chartData}
                                    setChartData={setChartData}
                                    timeRange={prop.timeRange}
                                    beatSubdivision={lane.division}
                                    setBeatSubdivision={(division) =>
                                        updateLaneData(
                                            lane.id,
                                            (prevLane) => ({
                                                ...prevLane,
                                                division: Math.max(
                                                    1,
                                                    Math.floor(division),
                                                ),
                                            }),
                                        )
                                    }
                                    height={120}
                                    editState={editState}
                                    setEditState={(updater) => {
                                        setLaneEditState(lane.id, (prev) =>
                                            typeof updater === "function"
                                                ? updater(prev)
                                                : updater,
                                        );
                                    }}
                                    songDuration={audioData.duration ?? 0}
                                    onUndo={handleUndo}
                                    onRedo={handleRedo}
                                    onSnapTimeChange={handleSnapTimeChange}
                                    selectedMeasureTime={selectedMeasureTime}
                                    onSelectMeasure={handleSelectMeasure}
                                    onActivate={() =>
                                        setActiveNoteLaneId(lane.id)
                                    }
                                    startTime={lane.startTime ?? null}
                                    endTime={lane.endTime ?? null}
                                    setStartTime={(time) =>
                                        updateLaneData(lane.id, (prevLane) => ({
                                            ...prevLane,
                                            startTime: time,
                                        }))
                                    }
                                    setEndTime={(time) =>
                                        updateLaneData(lane.id, (prevLane) => ({
                                            ...prevLane,
                                            endTime: time,
                                        }))
                                    }
                                    laneId={lane.id}
                                />
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
