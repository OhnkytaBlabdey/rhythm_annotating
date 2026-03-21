import React from "react";
import FoldSpectrum from "./foldSpectrum";
import BrightnessUp from "./brightnessUp";
import BrightnessDown from "./brightnessDown";
import ResolutionUp from "./resolutionUp";
import ResolutionDown from "./resolutionDown";
import { SpectrumLaneState } from "@/interface/audioData";
import { useAppSettings } from "@/components/appSettingsContext";

interface _p {
    audioId: string;
    spectrumState: SpectrumLaneState;
    setSpectrumState: (state: SpectrumLaneState) => void;
}

function SpectrumMenu(p: _p) {
    const { setSpectrumBrightnessOffset, setSpectrumResolutionScale } =
        useAppSettings();
    const brightnessOffset = p.spectrumState.brightnessOffset ?? 0;
    const resolutionScale = p.spectrumState.resolutionScale ?? 1;

    return (
        <div className="p-3">
            <div className="flex flex-col gap-2">
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
                    brightnessOffset={brightnessOffset}
                    setBrightnessOffset={(brightnessOffset) => {
                        setSpectrumBrightnessOffset(brightnessOffset);
                        p.setSpectrumState({
                            ...p.spectrumState,
                            brightnessOffset,
                        });
                    }}
                />
                <BrightnessDown
                    audioId={p.audioId}
                    brightnessOffset={brightnessOffset}
                    setBrightnessOffset={(brightnessOffset) => {
                        setSpectrumBrightnessOffset(brightnessOffset);
                        p.setSpectrumState({
                            ...p.spectrumState,
                            brightnessOffset,
                        });
                    }}
                />
                <ResolutionUp
                    audioId={p.audioId}
                    resolutionScale={resolutionScale}
                    setResolutionScale={(resolutionScale) => {
                        setSpectrumResolutionScale(resolutionScale);
                        p.setSpectrumState({
                            ...p.spectrumState,
                            resolutionScale,
                        });
                    }}
                />
                <ResolutionDown
                    audioId={p.audioId}
                    resolutionScale={resolutionScale}
                    setResolutionScale={(resolutionScale) => {
                        setSpectrumResolutionScale(resolutionScale);
                        p.setSpectrumState({
                            ...p.spectrumState,
                            resolutionScale,
                        });
                    }}
                />
            </div>
        </div>
    );
}

export default SpectrumMenu;
