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
        <div className="px-2 pb-2">
            <div className="flex gap-2">
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
            <div className="flex items-center gap-1 pt-1">
                <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={p.spectrumState.offset ?? 0}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                    onWheel={(e) => e.stopPropagation()}
                    onChange={(e) => {
                        const v = Number(e.target.value);
                        if (v >= 0 && Number.isFinite(v)) {
                            p.setSpectrumState({ ...p.spectrumState, offset: v });
                        }
                    }}
                    className="w-[60px] min-h-[30px] rounded-lg border border-solid border-[rgba(141,111,74,0.24)] bg-[rgba(255,255,255,0.94)] px-2 text-[11px] text-right text-[#241f19]"
                    title="SpectrumLane 图形偏移 (秒)"
                />
                <span className="text-[10px] opacity-55">偏移(s)</span>
            </div>
        </div>
    );
}

export default SpectrumMenu;
