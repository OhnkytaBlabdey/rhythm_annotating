import React from "react";
import FoldWave from "./foldWave";
import AmplitudeScale from "./amplitudeScale";

interface _p {
    audioId: string;
    setAmplitudeMultiplier: (_: number) => void;
}

function WaveMenu(p: _p) {
    return (
        <div>
            <div className="flex flex-col">
                <FoldWave audioId={p.audioId} />
                <AmplitudeScale
                    audioId={p.audioId}
                    setAmplitudeMultiplier={p.setAmplitudeMultiplier}
                />
            </div>
        </div>
    );
}

export default WaveMenu;
