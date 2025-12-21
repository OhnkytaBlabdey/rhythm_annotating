import { wavelane } from "@/interface/soundLane/waveLane/wavelane";
import React from "react";
interface _p {
    timeMultiplier: number;
    currentTime: number;
    mediaFilePath: string;
    waveLane: wavelane;
}
function WaveLane(p: _p) {
    return <div>WaveLane{p.timeMultiplier}</div>;
}

export default WaveLane;
