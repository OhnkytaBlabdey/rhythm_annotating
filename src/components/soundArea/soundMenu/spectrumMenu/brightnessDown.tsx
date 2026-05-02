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
        <button
            onClick={handleDarken}
            title="降低亮度 (Brightness Down)"
            className={cls("icon-button")}
        >
            <Image
                src="/assets/icons/liangdudown.svg"
                alt="降低亮度"
                width={24}
                height={24}
            />
        </button>
    );
}

export default BrightnessDown;
