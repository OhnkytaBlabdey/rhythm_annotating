import React from "react";
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
        <div className="px-2 pb-2 flex gap-2">
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
    );
}

export default SpectrumMenu;
