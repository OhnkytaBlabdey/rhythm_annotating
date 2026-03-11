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
        <div>
            <div className="flex">
                <button
                    onClick={handleResolutionUp}
                    title="Resolution Up"
                    className={`flex items-center gap-2 ${cls("button")}`}
                >
                    <Image
                        src="/assets/icons/timeAdd.png"
                        alt="提高分辨率"
                        width={24}
                        height={24}
                    />
                    <span>提高分辨率</span>
                </button>
            </div>
        </div>
    );
}

export default ResolutionUp;
