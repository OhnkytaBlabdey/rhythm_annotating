import Image from "@/components/Image";
import React from "react";
import style from "./spectrumMenu.module.css";
import classNames from "classnames/bind";

const cls = classNames.bind(style);

interface _p {
    audioId: string;
    resolutionScale: number;
    setResolutionScale: (_: number) => void;
}

const MIN_SCALE = 0.5;
const STEP = 0.2;

function ResolutionDown(p: _p) {
    function handleResolutionDown() {
        p.setResolutionScale(Math.max(MIN_SCALE, p.resolutionScale - STEP));
    }

    return (
        <button
            onClick={handleResolutionDown}
            title="降低分辨率 (Decrease resolution)"
            className={cls("icon-button")}
        >
            <Image
                src="/assets/icons/zoomOut.png"
                alt="降低分辨率"
                width={24}
                height={24}
            />
        </button>
    );
}

export default ResolutionDown;
