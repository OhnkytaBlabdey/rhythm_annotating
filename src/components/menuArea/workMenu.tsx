import React from "react";
import AddSound from "./addSound";
import { soundlane } from "@/interface/soundLane/soundlane";
import TimeScale from "./adjustTimeScale";
interface _prop {
    refSoundLanes: soundlane[];
    setSoundLanes: (a: soundlane[]) => void;
    refTimeMultiplier: number;
    setTimeMultiplier: (_: number) => void;
}
function WorkMenu(prop: _prop) {
    return (
        <div className="WorkMenu">
            <AddSound
                refSoundLanes={prop.refSoundLanes}
                setSoundLanes={prop.setSoundLanes}
            />
            <TimeScale
                refTimeMultiplier={prop.refTimeMultiplier}
                setTimeMultiplier={prop.setTimeMultiplier}
            />
        </div>
    );
}

export default WorkMenu;
