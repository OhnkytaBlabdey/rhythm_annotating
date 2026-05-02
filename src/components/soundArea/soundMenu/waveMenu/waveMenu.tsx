import React from "react";
import AmplitudeScale from "./amplitudeScale";
import { WaveLaneState } from "@/interface/audioData";

interface _p {
    audioId: string;
    waveState: WaveLaneState;
    setWaveState: (state: WaveLaneState) => void;
}

function WaveMenu(p: _p) {
    return (
        <div className="px-2 pb-2">
            <AmplitudeScale
                audioId={p.audioId}
                amplitudeMultiplier={p.waveState.amplitudeMultiplier}
                setAmplitudeMultiplier={(amplitudeMultiplier) => {
                    p.setWaveState({
                        ...p.waveState,
                        amplitudeMultiplier,
                    });
                }}
            />
        </div>
    );
}

export default WaveMenu;
