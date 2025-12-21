import React from "react";
import FoldWave from "./foldWave";
import AmplitudeScale from "./amplitudeScale";
interface _p {
    refAmplitudeMultiplier: number;
    setAmplitudeMultiplier: (_: number) => void;
}
function WaveMenu(p: _p) {
    return (
        <div>
            <div className="flex flex-col">
                <FoldWave />
                <AmplitudeScale
                    refAmplitudeMultiplier={p.refAmplitudeMultiplier}
                    setAmplitudeMultiplier={p.setAmplitudeMultiplier}
                />
            </div>
        </div>
    );
}

export default WaveMenu;
