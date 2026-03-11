import React from "react";
import FoldSpectrum from "./foldSpectrum";
import BrightnessUp from "./brightnessUp";
import BrightnessDown from "./brightnessDown";
import { SpectrumLaneState } from "@/interface/audioData";

interface _p {
    audioId: string;
    spectrumState: SpectrumLaneState;
    setSpectrumState: (state: SpectrumLaneState) => void;
}

function SpectrumMenu(p: _p) {
    return (
        <div>
            <div className="flex flex-col">
                <div>
                    <FoldSpectrum
                        audioId={p.audioId}
                        isFolded={p.spectrumState.isFolded}
                        setIsFolded={(isFolded) => {
                            p.setSpectrumState({
                                ...p.spectrumState,
                                isFolded,
                            });
                        }}
                    />
                </div>
                <BrightnessUp
                    audioId={p.audioId}
                    brightnessOffset={p.spectrumState.brightnessOffset}
                    setBrightnessOffset={(brightnessOffset) => {
                        p.setSpectrumState({
                            ...p.spectrumState,
                            brightnessOffset,
                        });
                    }}
                />
                <BrightnessDown
                    audioId={p.audioId}
                    brightnessOffset={p.spectrumState.brightnessOffset}
                    setBrightnessOffset={(brightnessOffset) => {
                        p.setSpectrumState({
                            ...p.spectrumState,
                            brightnessOffset,
                        });
                    }}
                />
            </div>
        </div>
    );
}

export default SpectrumMenu;
