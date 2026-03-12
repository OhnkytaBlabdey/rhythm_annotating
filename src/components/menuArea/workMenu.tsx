import React from "react";
import AddSound from "./addSound";
import { AudioData, SoundLaneState } from "@/interface/audioData";
import TimeRangeController from "./timeRangeController";
import DeleteActiveSound from "./removeActiveSound";
import PlaySelected from "./playSelectedSound";
import ResetEditor from "./resetEditor";

interface _prop {
    refSoundLaneStates: SoundLaneState[];
    setSoundLaneStates: (a: SoundLaneState[]) => void;
    refTimeMultiplier: number;
    setTimeMultiplier: (_: number) => void;
    refCurrentTime: number;
    setCurrentTime: (_: number) => void;
    isPlaying: boolean;
    setIsPlaying: (_: boolean) => void;
    Duration: number;
    addAudioData: (audioData: AudioData) => void;
    removeAudioData: (audioId: string) => void;
    removeMultipleAudioData: (audioIds: string[]) => void;
    resetEditor: () => void;
}

function WorkMenu(prop: _prop) {
    return (
        <div className="WorkMenu">
            <div className="flex">
                <AddSound key={"add sound"} addAudioData={prop.addAudioData} />
                <DeleteActiveSound
                    key={"delete sound"}
                    refSoundLaneStates={prop.refSoundLaneStates}
                    removeMultipleAudioData={prop.removeMultipleAudioData}
                />
                <TimeRangeController
                    key={"time scale"}
                    refTimeMultiplier={prop.refTimeMultiplier}
                    setTimeMultiplier={prop.setTimeMultiplier}
                    refCurrentTime={prop.refCurrentTime}
                    setCurrentTime={prop.setCurrentTime}
                    Duration={prop.Duration}
                />
                <PlaySelected
                    key={"play selected"}
                    refCurrentTime={prop.refCurrentTime}
                    refIsPlaying={prop.isPlaying}
                    setCurrentTime={prop.setCurrentTime}
                    setIsPlaying={prop.setIsPlaying}
                    refSoundLaneStates={prop.refSoundLaneStates}
                />
                <ResetEditor
                    key={"reset editor"}
                    resetEditor={prop.resetEditor}
                />
            </div>
        </div>
    );
}

export default WorkMenu;
