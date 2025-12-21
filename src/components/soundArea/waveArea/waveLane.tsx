import { wavelane } from "@/interface/soundLane/waveLane/wavelane";
import React from "react";
interface _p {
    timeRange: [number, number];
    mediaFilePath: string;
    waveLane: wavelane;
}
function WaveLane(p: _p) {
    const [t_left, t_right] = p.timeRange;
    return (
        <div>
            WaveLane {t_left.toFixed(4)} - {t_right.toFixed(4)}
            <div>{/* 绘制波形 */}</div>
        </div>
    );
}

export default WaveLane;
