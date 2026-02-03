"use client";
import "./soundLane.module.css";
import SoundFileTitleBar from "./soundFileTitleBar";
import SoundMenu from "./soundMenu/soundMenu";
import WaveLane from "./waveArea/waveLane";
import SpectrumLane from "./spectrumArea/spectrumLane";
import WaveMenu from "./soundMenu/waveMenu/waveMenu";
import SpectrumMenu from "./soundMenu/spectrumMenu/spectrumMenu";
import { useContext } from "react";
import { AudioDataCtx } from "../audioContext";
import { SoundLaneState } from "@/interface/audioData";

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
                <div className="w-auto" onClick={(e) => e.stopPropagation()}>
                    <SoundMenu audioId={prop.audioId} />
                    <WaveMenu
                        audioId={prop.audioId}
                        setAmplitudeMultiplier={() => {}}
                    />
                    <SpectrumMenu audioId={prop.audioId} setIsFold={() => {}} />
                </div>
                <div className="">
                    <WaveLane
                        audioId={prop.audioId}
                        timeRange={prop.timeRange}
                    />
                    <SpectrumLane
                        audioId={prop.audioId}
                        timeRange={prop.timeRange}
                    />
                    {/* TODO: NoteLane 列表 */}
                </div>
            </div>
        </div>
    );
}
