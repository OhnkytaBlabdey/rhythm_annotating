import { soundlane } from "@/interface/soundLane/soundlane";
import React from "react";
interface _p {
    refSoundLanes: soundlane[];
    refCurrentTime: number;
    setCurrentTime: (_: number) => void;
    refIsPlaying: boolean;
    setIsPlaying: (_: boolean) => void;
}
function PlaySelected(p: _p) {
    return <div>PlaySelected</div>;
}

export default PlaySelected;
