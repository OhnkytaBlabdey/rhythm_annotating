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
        <div className="px-2 pb-1">
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
            <div className="flex items-center gap-1 pt-0.5">
                <span className="text-[10px] opacity-55">图形偏移</span>
                <input
                    type="number"
                    min={0}
                    step={1}
                    value={Math.round((p.waveState.offset ?? 0) * 1000)}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                    onWheel={(e) => e.stopPropagation()}
                    onChange={(e) => {
                        const v = Number(e.target.value);
                        if (v >= 0 && Number.isFinite(v)) {
                            p.setWaveState({ ...p.waveState, offset: v / 1000 });
                        }
                    }}
                    className="w-[60px] min-h-[24px] rounded-lg border border-solid border-[rgba(141,111,74,0.24)] bg-[rgba(255,255,255,0.94)] px-2 text-[11px] text-right text-[#241f19]"
                    title="波形图形偏移(毫秒)，仅canvas像素位移"
                />
                <span className="text-[10px] opacity-55">ms</span>
            </div>
        </div>
    );
}

export default WaveMenu;
