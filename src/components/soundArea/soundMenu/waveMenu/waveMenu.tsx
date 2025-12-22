import React from "react";
import FoldWave from "./foldWave";
import AmplitudeScale from "./amplitudeScale";

interface _p {
    refAmplitudeMultiplier: number;
    setAmplitudeMultiplier: (_: number) => void;
    refIsFold: boolean;
    setIsFold: (_: boolean) => void;
}
function WaveMenu(p: _p) {
    return (
        <div>
            <div className="flex flex-col">
                <FoldWave refIsFold={p.refIsFold} setIsFold={p.setIsFold} />

                <AmplitudeScale
                    refAmplitudeMultiplier={p.refAmplitudeMultiplier}
                    setAmplitudeMultiplier={p.setAmplitudeMultiplier}
                />
            </div>
        </div>
    );
}

export default WaveMenu;
