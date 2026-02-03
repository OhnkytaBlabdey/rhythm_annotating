import Image from "next/image";
import React, { useState } from "react";
import style from "./waveMenu.module.css";
import classNames from "classnames/bind";

const cls = classNames.bind(style);

interface _p {
    audioId: string;
    setAmplitudeMultiplier: (_: number) => void;
}

function AmplitudeScale(p: _p) {
    const [amplitudeMultiplier, setAmplitudeMultiplier] = useState(5);

    function handleAmpUp() {
        const newValue = amplitudeMultiplier * (6 / 5);
        setAmplitudeMultiplier(newValue);
        p.setAmplitudeMultiplier(newValue);
    }

    function handleAmpDown() {
        const newValue = amplitudeMultiplier * (5 / 6);
        setAmplitudeMultiplier(newValue);
        p.setAmplitudeMultiplier(newValue);
    }

    return (
        <div>
            <div className="flex-col">
                <button
                    onClick={handleAmpUp}
                    title="Amplitude Up"
                    className={`flex items-center gap-2 ${cls("button")}`}
                >
                    <Image
                        src="/assets/icons/ampUp.png"
                        alt="放大振幅"
                        width={24}
                        height={24}
                    />
                    <span>放大振幅</span>
                </button>
                <button
                    onClick={handleAmpDown}
                    title="Amplitude Down"
                    className={`flex items-center gap-2 ${cls("button")}`}
                >
                    <Image
                        src="/assets/icons/ampDown.png"
                        alt="缩小振幅"
                        width={24}
                        height={24}
                    />
                    <span>缩小振幅</span>
                </button>
            </div>
        </div>
    );
}

export default AmplitudeScale;
