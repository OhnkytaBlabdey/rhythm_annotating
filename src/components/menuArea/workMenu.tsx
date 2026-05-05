import React from "react";
import AddSound from "./addSound";
import { AudioData, SoundLaneState } from "@/interface/audioData";
import TimeRangeController from "./timeRangeController";
import DeleteActiveSound from "./removeActiveSound";
import PlaySelected from "./playSelectedSound";
import ResetEditor from "./resetEditor";
import ShortcutSettingsModal from "./shortcutSettingsModal";

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
    timeRange?: [number, number];
    addAudioData: (audioData: AudioData) => void;
    removeAudioData: (audioId: string) => void;
    removeMultipleAudioData: (audioIds: string[]) => void;
    resetEditor: () => void;
}

function WorkMenu(prop: _prop) {
    const [isShortcutModalOpen, setIsShortcutModalOpen] = React.useState(false);

    return (
        <div className="WorkMenu">
            <div className="editor-toolbar-actions">
                {prop.timeRange && (
                    <span className="editor-meta-text whitespace-nowrap">
                        {prop.timeRange[0].toFixed(4)} -{" "}
                        {prop.timeRange[1].toFixed(4)} |{" "}
                        {(prop.timeRange[1] - prop.timeRange[0]).toFixed(4)}s
                    </span>
                )}
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
                    isPlaying={prop.isPlaying}
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
                <button
                    type="button"
                    className="editor-toolbar-button"
                    onClick={() => setIsShortcutModalOpen(true)}
                >
                    <span>快捷键</span>
                </button>
            </div>
            {isShortcutModalOpen && (
                <ShortcutSettingsModal
                    onClose={() => setIsShortcutModalOpen(false)}
                />
            )}
        </div>
    );
}

export default WorkMenu;
