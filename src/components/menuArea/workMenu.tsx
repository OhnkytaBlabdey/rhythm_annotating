import React from "react";
import AddSound from "./addSound";
import { soundlane } from "@/interface/soundLane/soundlane";
interface _prop {
    refSoundLanes: soundlane[];
    setSoundLanes: (a: soundlane[]) => void;
}
function WorkMenu(prop: _prop) {
    return (
        <div className="WorkMenu">
            <AddSound
                refSoundLanes={prop.refSoundLanes}
                setSoundLanes={prop.setSoundLanes}
            />
        </div>
    );
}

export default WorkMenu;
