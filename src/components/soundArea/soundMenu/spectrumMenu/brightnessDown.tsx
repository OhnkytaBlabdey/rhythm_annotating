import Image from "@/components/Image";
import React from "react";
import style from "./spectrumMenu.module.css";
import classNames from "classnames/bind";

const cls = classNames.bind(style);

interface _p {
    audioId: string;
    brightnessOffset: number;
    setBrightnessOffset: (_: number) => void;
}

const MIN_DB = -20;
const STEP_DB = 2;

function BrightnessDown(p: _p) {
    function handleDarken() {
        p.setBrightnessOffset(Math.max(MIN_DB, p.brightnessOffset - STEP_DB));
    }

    return (
        <div>
            <div className="flex">
                <button
                    onClick={handleDarken}
                    title="Brightness Down"
                    className={`flex items-center gap-2 ${cls("button")}`}
                >
                    <Image
                        src="/assets/icons/liangdudown.svg"
                        alt="降低亮度"
                        width={24}
                        height={24}
                    />
                    <span>降低亮度</span>
                </button>
            </div>
        </div>
    );
}

export default BrightnessDown;
