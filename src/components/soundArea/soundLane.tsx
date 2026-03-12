"use client";
import "./soundLane.module.css";
import SoundFileTitleBar from "./soundFileTitleBar";
import SoundMenu from "./soundMenu/soundMenu";
import WaveLane from "./waveArea/waveLane";
import SpectrumLane from "./spectrumArea/spectrumLane";
import WaveMenu from "./soundMenu/waveMenu/waveMenu";
import SpectrumMenu from "./soundMenu/spectrumMenu/spectrumMenu";
import NoteMenu from "./noteArea/noteMenu/noteMenu";
import { useContext, useMemo, useCallback, useState } from "react";
import { AudioDataCtx } from "../audioContext";
import { SoundLaneState } from "@/interface/audioData";
import NoteLane from "./noteArea/noteLane";
import testChartRaw from "../../../test/test_chart.json";
import { normalizeChartSegments } from "./noteArea/chartAdapter";
import { RawChartSegment, ChartSegment } from "./noteArea/chartTypes";
import {
    defaultNoteEditState,
    EditMode,
    NoteEditState,
} from "./noteArea/noteState";

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

    const initialChartData = useMemo(
        () => normalizeChartSegments(testChartRaw as RawChartSegment[]),
        [],
    );
    const [chartData, setChartDataRaw] =
        useState<ChartSegment[]>(initialChartData);
    const [editState, setEditState] =
        useState<NoteEditState>(defaultNoteEditState);

    /** Deep-clone chartData for undo snapshot */
    const cloneChart = useCallback(
        (data: ChartSegment[]): ChartSegment[] =>
            data.map((seg) => ({
                ...seg,
                measures: seg.measures.map((m) => ({ notes: [...m.notes] })),
            })),
        [],
    );

    const pushUndo = useCallback(
        (before: ChartSegment[]) => {
            setEditState((prev) => {
                const stack = [cloneChart(before), ...prev.undoStack].slice(
                    0,
                    MAX_UNDO,
                );
                return { ...prev, undoStack: stack, redoStack: [] };
            });
        },
        [cloneChart],
    );

    const setChartData = useCallback(
        (next: ChartSegment[], saveUndo = true) => {
            if (saveUndo) {
                setChartDataRaw((prev) => {
                    pushUndo(prev);
                    return next;
                });
            } else {
                setChartDataRaw(next);
            }
        },
        [pushUndo],
    );

    const handleUndo = useCallback(() => {
        if (editState.undoStack.length === 0) return;
        const [top, ...rest] = editState.undoStack;
        const current = cloneChart(chartData);
        setChartDataRaw(top);
        setEditState((prev) => ({
            ...prev,
            undoStack: rest,
            redoStack: [current, ...prev.redoStack].slice(0, MAX_UNDO),
        }));
    }, [chartData, cloneChart, editState.undoStack]);

    const handleRedo = useCallback(() => {
        if (editState.redoStack.length === 0) return;
        const [top, ...rest] = editState.redoStack;
        const current = cloneChart(chartData);
        setChartDataRaw(top);
        setEditState((prev) => ({
            ...prev,
            redoStack: rest,
            undoStack: [current, ...prev.undoStack].slice(0, MAX_UNDO),
        }));
    }, [chartData, cloneChart, editState.redoStack]);

    const handleCopy = useCallback(() => {
        setEditState((prev) => {
            if (prev.selectedIds.size === 0) return prev;
            const copied = chartData
                .flatMap((seg) => seg.measures)
                .flatMap((m) => m.notes)
                .filter((n) => prev.selectedIds.has(n.id));
            return { ...prev, clipboard: copied };
        });
    }, [chartData]);

    const handleCut = useCallback(() => {
        setEditState((prev) => {
            if (prev.selectedIds.size === 0) return prev;
            const copied = chartData
                .flatMap((seg) => seg.measures)
                .flatMap((m) => m.notes)
                .filter((n) => prev.selectedIds.has(n.id));
            const ids = prev.selectedIds;
            const next = chartData.map((seg) => ({
                ...seg,
                measures: seg.measures.map((m) => ({
                    notes: m.notes.filter((n) => !ids.has(n.id)),
                })),
            }));
            pushUndo(chartData);
            setChartDataRaw(next);
            return {
                ...prev,
                clipboard: copied,
                selectedIds: new Set<string>(),
            };
        });
    }, [chartData, pushUndo]);

    const handleDelete = useCallback(() => {
        setEditState((prev) => {
            if (prev.selectedIds.size === 0) return prev;
            const ids = prev.selectedIds;
            const next = chartData.map((seg) => ({
                ...seg,
                measures: seg.measures.map((m) => ({
                    notes: m.notes.filter((n) => !ids.has(n.id)),
                })),
            }));
            pushUndo(chartData);
            setChartDataRaw(next);
            return { ...prev, selectedIds: new Set<string>() };
        });
    }, [chartData, pushUndo]);

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
                <SoundMenu audioId={prop.audioId} timeRange={prop.timeRange} />
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

                <div
                    className="flex items-start gap-3"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="w-[150px] shrink-0 self-stretch border border-slate-700 rounded-md overflow-hidden bg-slate-900">
                        <NoteMenu
                            mode={editState.mode}
                            setMode={(m: EditMode) =>
                                setEditState((prev) => ({
                                    ...prev,
                                    mode: m,
                                    lnHeadTime: null,
                                }))
                            }
                            canUndo={editState.undoStack.length > 0}
                            canRedo={editState.redoStack.length > 0}
                            hasSelection={editState.selectedIds.size > 0}
                            hasClipboard={editState.clipboard.length > 0}
                            currentBpm={editState.currentBpm}
                            setCurrentBpm={(bpm) =>
                                setEditState((prev) => ({
                                    ...prev,
                                    currentBpm: bpm,
                                }))
                            }
                            onDelete={handleDelete}
                            onCopy={handleCopy}
                            onCut={handleCut}
                            onUndo={handleUndo}
                            onRedo={handleRedo}
                        />
                    </div>
                    <div className="flex-1 min-w-0">
                        <NoteLane
                            chartData={chartData}
                            setChartData={setChartData}
                            timeRange={prop.timeRange}
                            beatSubdivision={4}
                            height={120}
                            editState={editState}
                            setEditState={setEditState}
                            songDuration={audioData.duration ?? 0}
                            onPushUndo={() => pushUndo(chartData)}
                            onUndo={handleUndo}
                            onRedo={handleRedo}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
