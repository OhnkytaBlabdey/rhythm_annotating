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

const MAX_DB = 20;
const STEP_DB = 2;

function BrightnessUp(p: _p) {
    function handleBrighten() {
        p.setBrightnessOffset(Math.min(MAX_DB, p.brightnessOffset + STEP_DB));
    }

    return (
        <button
            onClick={handleBrighten}
            title="提高亮度 (Brightness Up)"
            className={cls("icon-button")}
        >
            <Image
                src="/assets/icons/liangduup.svg"
                alt="提高亮度"
                width={24}
                height={24}
            />
        </button>
    );
}

export default BrightnessUp;
