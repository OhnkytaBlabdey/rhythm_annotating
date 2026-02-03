import React from "react";
import FoldWave from "./foldWave";
import AmplitudeScale from "./amplitudeScale";
import { WaveLaneState } from "@/interface/audioData";

interface _p {
    audioId: string;
    waveState: WaveLaneState;
    setWaveState: (state: WaveLaneState) => void;
}

function WaveMenu(p: _p) {
    return (
        <div>
            <div className="flex flex-col">
                <FoldWave
                    audioId={p.audioId}
                    isFolded={p.waveState.isFolded}
                    setIsFolded={(isFolded) => {
                        p.setWaveState({
                            ...p.waveState,
                            isFolded,
                        });
                    }}
                />
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
        </div>
    );
}

export default WaveMenu;
