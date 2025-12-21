import React from "react";
import FoldWave from "./foldWave";
import AmplitudeScale from "./amplitudeScale";

function WaveMenu() {
    return (
        <div>
            <div className="flex flex-col">
                <FoldWave />
                <AmplitudeScale />
            </div>
        </div>
    );
}

export default WaveMenu;
