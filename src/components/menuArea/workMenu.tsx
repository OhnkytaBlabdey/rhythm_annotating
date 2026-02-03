import React from "react";
import AddSound from "./addSound";
import { soundlane } from "@/interface/soundLane/soundlane";
import TimeScale from "./adjustTimeScale";
import DeleteActiveSound from "./removeActiveSound";
import PlaySelected from "./playSelectedSound";
// import PauseSelected from "./pauseSelectedSound";
interface _prop {
    refSoundLanes: soundlane[];
    setSoundLanes: (a: soundlane[]) => void;
    refTimeMultiplier: number;
    setTimeMultiplier: (_: number) => void;
    refCurrentTime: number;
    setCurrentTime: (_: number) => void;
    isPlaying: boolean;
    setIsPlaying: (_: boolean) => void;
    Duration: number;
}
function WorkMenu(prop: _prop) {
    return (
        <div className="WorkMenu">
            <div className="flex">
                <AddSound
                    key={"add sound"}
                    refSoundLanes={prop.refSoundLanes}
                    setSoundLanes={prop.setSoundLanes}
                />
                <DeleteActiveSound
                    key={"delete sound"}
                    refSoundLanes={prop.refSoundLanes}
                    setSoundLanes={prop.setSoundLanes}
                />
                <TimeScale
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
                />
            </div>
        </div>
    );
}

export default WorkMenu;
