"use client";
import "./soundLane.module.css";
import SoundFileTitleBar from "./soundFileTitleBar";
import SoundMenu from "./soundMenu/soundMenu";
import WaveLane from "./waveArea/waveLane";
import SpectrumLane from "./spectrumArea/spectrumLane";
import WaveMenu from "./soundMenu/waveMenu/waveMenu";
import SpectrumMenu from "./soundMenu/spectrumMenu/spectrumMenu";
import { useContext, useMemo } from "react";
import { AudioDataCtx } from "../audioContext";
import { SoundLaneState } from "@/interface/audioData";
import NoteLane from "./noteArea/noteLane";
import testChartRaw from "../../../test/test_chart.json";
import { normalizeChartSegments } from "./noteArea/chartAdapter";
import { RawChartSegment } from "./noteArea/chartTypes";

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
    const demoChartData = useMemo(
        () => normalizeChartSegments(testChartRaw as RawChartSegment[]),
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
                <div>
                    {prop.timeRange[0].toFixed(4)} -{" "}
                    {prop.timeRange[1].toFixed(4)} second
                </div>
            </div>
            <div className="flex flex-1">
                <div
                    className="w-[300px] shrink-0 pr-3"
                    onClick={(e) => e.stopPropagation()}
                >
                    <SoundMenu audioId={prop.audioId} />
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
                    <SpectrumLane
                        audioId={prop.audioId}
                        timeRange={prop.timeRange}
                        spectrumState={prop.refSoundLaneState.spectrumLane}
                        setSpectrumState={(spectrumLane) => {
                            prop.setSoundLaneState(prop.index, {
                                ...prop.refSoundLaneState,
                                spectrumLane,
                            });
                        }}
                    />
                    <NoteLane
                        chartData={demoChartData}
                        timeRange={prop.timeRange}
                        beatSubdivision={4}
                        height={120}
                    />
                </div>
            </div>
        </div>
    );
}
