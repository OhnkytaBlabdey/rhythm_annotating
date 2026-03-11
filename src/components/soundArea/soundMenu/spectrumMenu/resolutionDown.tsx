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
        <div>
            <div className="flex">
                <button
                    onClick={handleResolutionDown}
                    title="Decrease time+frequency analysis resolution"
                    className={`flex items-center gap-2 ${cls("button")}`}
                >
                    <Image
                        src="/assets/icons/timeSub.png"
                        alt="降低分辨率"
                        width={24}
                        height={24}
                    />
                    <span>降低分辨率</span>
                </button>
            </div>
        </div>
    );
}

export default ResolutionDown;
