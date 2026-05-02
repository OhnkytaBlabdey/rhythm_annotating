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

const MAX_SCALE = 2;
const STEP = 0.2;

function ResolutionUp(p: _p) {
    function handleResolutionUp() {
        p.setResolutionScale(Math.min(MAX_SCALE, p.resolutionScale + STEP));
    }

    return (
        <button
            onClick={handleResolutionUp}
            title="提高分辨率 (Increase resolution)"
            className={cls("icon-button")}
        >
            <Image
                src="/assets/icons/zoomIn.png"
                alt="提高分辨率"
                width={24}
                height={24}
            />
        </button>
    );
}

export default ResolutionUp;
