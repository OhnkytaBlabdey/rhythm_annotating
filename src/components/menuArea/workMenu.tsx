import React from "react";
import AddSound from "./addSound";
import { soundlane } from "@/interface/soundLane/soundlane";
import TimeScale from "./adjustTimeScale";
import DeleteActiveSound from "./removeActiveSound";
interface _prop {
    refSoundLanes: soundlane[];
    setSoundLanes: (a: soundlane[]) => void;
    refTimeMultiplier: number;
    setTimeMultiplier: (_: number) => void;
    refCurrentTime: number;
    setCurrentTime: (_: number) => void;
    refDuration: number;
    setDuration: (_: number) => void;
}
function WorkMenu(prop: _prop) {
    return (
        <div className="WorkMenu">
            <div className="flex">
                <AddSound
                    refSoundLanes={prop.refSoundLanes}
                    setSoundLanes={prop.setSoundLanes}
                    refDuration={prop.refDuration}
                    setDuration={prop.setDuration}
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
                    refDuration={prop.refDuration}
                />
            </div>
        </div>
    );
}

export default WorkMenu;
