import Image from "@/components/Image";
import React from "react";
import style from "./waveMenu.module.css";
import classNames from "classnames/bind";

const cls = classNames.bind(style);

interface _p {
    audioId: string;
    amplitudeMultiplier: number;
    setAmplitudeMultiplier: (_: number) => void;
}

function AmplitudeScale(p: _p) {
    function handleAmpUp() {
        p.setAmplitudeMultiplier(p.amplitudeMultiplier * (6 / 5));
    }

    function handleAmpDown() {
        p.setAmplitudeMultiplier(p.amplitudeMultiplier * (5 / 6));
    }

    return (
        <div className="flex gap-2">
            <button
                onClick={handleAmpUp}
                title="放大振幅 (Amplitude Up)"
                className={cls("icon-button")}
            >
                <Image
                    src="/assets/icons/ampUp.png"
                    alt="放大振幅"
                    width={24}
                    height={24}
                />
            </button>
            <button
                onClick={handleAmpDown}
                title="缩小振幅 (Amplitude Down)"
                className={cls("icon-button")}
            >
                <Image
                    src="/assets/icons/ampDown.png"
                    alt="缩小振幅"
                    width={24}
                    height={24}
                />
            </button>
        </div>
    );
}

export default AmplitudeScale;
