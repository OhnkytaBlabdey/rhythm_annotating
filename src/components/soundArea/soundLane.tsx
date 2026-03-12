"use client";
import "./soundLane.module.css";
import SoundFileTitleBar from "./soundFileTitleBar";
import SoundMenu from "./soundMenu/soundMenu";
import WaveLane from "./waveArea/waveLane";
import SpectrumLane from "./spectrumArea/spectrumLane";
import WaveMenu from "./soundMenu/waveMenu/waveMenu";
import SpectrumMenu from "./soundMenu/spectrumMenu/spectrumMenu";
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
    validateChartData,
    validateNoteLaneData,
} from "./noteArea/chartAdapter";

const MAX_UNDO = 50;

interface _prop {
    index: number;
    audioId: string;
    timeRange: [number, number];
    refSoundLaneState: SoundLaneState;
    setSoundLaneState: (i: number, state: SoundLaneState) => void;
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
    const [laneErrorMap, setLaneErrorMap] = useState<Record<string, string>>(
        {},
    );

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
                const base = prev[laneId] ?? defaultNoteEditState();
                return {
                    ...prev,
                    [laneId]: updater(base),
                };
            });
        },
        [],
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

            prop.setSoundLaneState(prop.index, {
                ...prop.refSoundLaneState,
                noteLanes:
                    nextLanes.length > 0 ? nextLanes : [defaultNoteLaneData()],
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

    const retimeChartByBpm = useCallback(
        (data: ChartSegment[], bpm: number) => {
            const safeBpm = Math.max(1, Math.floor(bpm));
            const beatDuration = 60 / safeBpm;
            let cursor = 0;
            const next = data
                .map((seg) => ({
                    ...seg,
                    time: 0,
                    tempo: safeBpm,
                    measures: seg.measures.map((m) => ({
                        notes: [...m.notes],
                    })),
                }))
                .sort((a, b) => a.time - b.time);

            for (const seg of next) {
                seg.time = cursor;
                cursor += seg.measures.length * beatDuration;
            }

            if (next.length === 0) {
                return [
                    {
                        time: 0,
                        tempo: safeBpm,
                        measures: [{ notes: [] }],
                    },
                ];
            }

            return next;
        },
        [],
    );

    if (!audioData) {
        return <div>Audio not found</div>;
    }

    function handleClickToActivate() {
        const updatedState = {
            ...prop.refSoundLaneState,
            isActive: !prop.refSoundLaneState.isActive,
        };
        prop.setSoundLaneState(prop.index, updatedState);
    }

    return (
        <div
            className="SoundLane flex flex-col h-full cursor-pointer"
            onClick={handleClickToActivate}
        >
            <div className="w-auto">
                <SoundFileTitleBar
                    soundFile={audioData.file}
                    isActive={prop.refSoundLaneState.isActive || false}
                />
            </div>
            <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                <SoundMenu
                    audioId={prop.audioId}
                    timeRange={prop.timeRange}
                    onAddNoteLane={handleAddNoteLane}
                />
            </div>
            <div className="flex flex-col flex-1 gap-2 mt-2">
                <div className="flex items-start gap-3">
                    <div
                        className="w-[150px] shrink-0"
                        onClick={(e) => e.stopPropagation()}
                    >
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
                        className="w-[150px] shrink-0"
                        onClick={(e) => e.stopPropagation()}
                    >
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

                {noteLanes.map((lane: NoteLaneData) => {
                    const editState =
                        laneEditStateMap[lane.id] ??
                        defaultNoteEditState(lane.defaultBpm);

                    const pushUndo = (before: ChartSegment[]) => {
                        setLaneEditState(lane.id, (prev) => {
                            const stack = [
                                cloneChart(before),
                                ...prev.undoStack,
                            ].slice(0, MAX_UNDO);
                            return { ...prev, undoStack: stack, redoStack: [] };
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
                            redoStack: [current, ...prev.redoStack].slice(
                                0,
                                MAX_UNDO,
                            ),
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
                            undoStack: [current, ...prev.undoStack].slice(
                                0,
                                MAX_UNDO,
                            ),
                        }));
                    };

                    const handleCopy = () => {
                        setLaneEditState(lane.id, (prev) => {
                            if (prev.selectedIds.size === 0) return prev;
                            const copied = lane.chartData
                                .flatMap((seg: ChartSegment) => seg.measures)
                                .flatMap((m: ChartMeasure) => m.notes)
                                .filter((n: ChartNote) =>
                                    prev.selectedIds.has(n.id),
                                );
                            return { ...prev, clipboard: copied };
                        });
                    };

                    const handleCut = () => {
                        setLaneEditState(lane.id, (prev) => {
                            if (prev.selectedIds.size === 0) return prev;
                            const copied = lane.chartData
                                .flatMap((seg: ChartSegment) => seg.measures)
                                .flatMap((m: ChartMeasure) => m.notes)
                                .filter((n: ChartNote) =>
                                    prev.selectedIds.has(n.id),
                                );
                            const ids = prev.selectedIds;
                            const next = lane.chartData.map((seg) => ({
                                ...seg,
                                measures: seg.measures.map(
                                    (m: ChartMeasure) => ({
                                        notes: m.notes.filter(
                                            (n: ChartNote) => !ids.has(n.id),
                                        ),
                                    }),
                                ),
                            }));
                            const error = validateChartData(next);
                            if (error) {
                                setLaneError(lane.id, error);
                                return prev;
                            }
                            clearLaneError(lane.id);
                            pushUndo(lane.chartData);
                            updateLaneData(lane.id, (prevLane) => ({
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
                        setLaneEditState(lane.id, (prev) => {
                            if (prev.selectedIds.size === 0) return prev;
                            const ids = prev.selectedIds;
                            const next = lane.chartData.map((seg) => ({
                                ...seg,
                                measures: seg.measures.map(
                                    (m: ChartMeasure) => ({
                                        notes: m.notes.filter(
                                            (n: ChartNote) => !ids.has(n.id),
                                        ),
                                    }),
                                ),
                            }));
                            const error = validateChartData(next);
                            if (error) {
                                setLaneError(lane.id, error);
                                return prev;
                            }
                            clearLaneError(lane.id);
                            pushUndo(lane.chartData);
                            updateLaneData(lane.id, (prevLane) => ({
                                ...prevLane,
                                chartData: next,
                            }));
                            return {
                                ...prev,
                                selectedIds: new Set<string>(),
                            };
                        });
                    };

                    const exportError = validateNoteLaneData(lane);
                    const exportPayload = exportError
                        ? {
                              error: exportError,
                              lane,
                          }
                        : lane;

                    return (
                        <div
                            key={lane.id}
                            className="flex items-start gap-3"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="w-[150px] shrink-0 self-stretch border border-slate-300 rounded-md overflow-hidden bg-white">
                                <NoteMenu
                                    mode={editState.mode}
                                    setMode={(m: EditMode) =>
                                        setLaneEditState(lane.id, (prev) => ({
                                            ...prev,
                                            mode: m,
                                            lnHeadTime: null,
                                        }))
                                    }
                                    canUndo={editState.undoStack.length > 0}
                                    canRedo={editState.redoStack.length > 0}
                                    hasSelection={
                                        editState.selectedIds.size > 0
                                    }
                                    hasClipboard={
                                        editState.clipboard.length > 0
                                    }
                                    currentBpm={lane.defaultBpm}
                                    setCurrentBpm={(bpm) => {
                                        const safeBpm = Math.max(
                                            1,
                                            Math.floor(bpm),
                                        );
                                        setLaneEditState(lane.id, (prev) => ({
                                            ...prev,
                                            currentBpm: safeBpm,
                                        }));
                                        updateLaneData(lane.id, (prevLane) => ({
                                            ...prevLane,
                                            defaultBpm: safeBpm,
                                            chartData: retimeChartByBpm(
                                                prevLane.chartData,
                                                safeBpm,
                                            ),
                                        }));
                                    }}
                                    division={lane.division}
                                    setDivision={(division) =>
                                        updateLaneData(lane.id, (prevLane) => ({
                                            ...prevLane,
                                            division: Math.max(
                                                1,
                                                Math.floor(division),
                                            ),
                                        }))
                                    }
                                    onDelete={handleDelete}
                                    onCopy={handleCopy}
                                    onCut={handleCut}
                                    onUndo={handleUndo}
                                    onRedo={handleRedo}
                                    onDeleteLane={() => {
                                        updateLaneData(lane.id, () => null);
                                    }}
                                    onClearLane={() => {
                                        const resetBpm = Math.max(
                                            1,
                                            Math.floor(lane.defaultBpm),
                                        );
                                        updateLaneData(lane.id, (prevLane) => ({
                                            ...prevLane,
                                            chartData: [
                                                {
                                                    time: 0,
                                                    tempo: resetBpm,
                                                    measures: [{ notes: [] }],
                                                },
                                            ],
                                        }));
                                        setLaneEditState(lane.id, (prev) => ({
                                            ...prev,
                                            selectedIds: new Set<string>(),
                                            lnHeadTime: null,
                                        }));
                                        clearLaneError(lane.id);
                                    }}
                                    exportText={JSON.stringify(
                                        exportPayload,
                                        null,
                                        2,
                                    )}
                                    lastError={laneErrorMap[lane.id] ?? null}
                                />
                            </div>
                            <div className="flex-1 min-w-0">
                                <NoteLane
                                    chartData={lane.chartData}
                                    setChartData={setChartData}
                                    timeRange={prop.timeRange}
                                    beatSubdivision={lane.division}
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
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
