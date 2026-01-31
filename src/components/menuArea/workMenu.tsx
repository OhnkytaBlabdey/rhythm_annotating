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
                    refSoundLanes={prop.refSoundLanes}
                    setSoundLanes={prop.setSoundLanes}
                />
                <DeleteActiveSound
                    refSoundLanes={prop.refSoundLanes}
                    setSoundLanes={prop.setSoundLanes}
                />
                <TimeScale
                    refTimeMultiplier={prop.refTimeMultiplier}
                    setTimeMultiplier={prop.setTimeMultiplier}
                    refCurrentTime={prop.refCurrentTime}
                    setCurrentTime={prop.setCurrentTime}
                    Duration={prop.Duration}
                />
                <PlaySelected
                    refCurrentTime={prop.refCurrentTime}
                    refIsPlaying={prop.isPlaying}
                    // refSoundLanes={prop.refSoundLanes}
                    setCurrentTime={prop.setCurrentTime}
                    setIsPlaying={prop.setIsPlaying}
                    // key={}
                />
                {/* <PauseSelected
                    refIsPlaying={prop.isPlaying}
                    setIsPlaying={prop.setIsPlaying}
                    // key={}
                /> */}
            </div>
        </div>
    );
}

export default WorkMenu;
