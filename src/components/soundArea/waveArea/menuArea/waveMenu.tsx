import React from "react";
import FoldWave from "./foldWave";
import AmplitudeScale from "./amplitudeScale";
import style from "./waveMenu.module.css";
import classNames from "classnames/bind";
const cls = classNames.bind(style);
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
                <div className={cls("button")}>
                    <FoldWave refIsFold={p.refIsFold} setIsFold={p.setIsFold} />
                </div>

                <AmplitudeScale
                    refAmplitudeMultiplier={p.refAmplitudeMultiplier}
                    setAmplitudeMultiplier={p.setAmplitudeMultiplier}
                />
            </div>
        </div>
    );
}

export default WaveMenu;
