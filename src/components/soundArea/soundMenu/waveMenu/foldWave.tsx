import Image from "next/image";
import React, { useState } from "react";
import style from "./waveMenu.module.css";
import classNames from "classnames/bind";

const cls = classNames.bind(style);

interface _p {
    audioId: string;
}

function FoldWave(p: _p) {
    const [isFold, setIsFold] = useState(false);

    const handleFold = () => {
        setIsFold(!isFold);
    };

    return (
        <div>
            <div className="flex">
                <button
                    onClick={handleFold}
                    title="Amplitude Fold"
                    className={`flex items-center gap-2 ${cls("button")}`}
                >
                    <Image
                        src={
                            isFold
                                ? "/assets/icons/unfold.png"
                                : "/assets/icons/fold.png"
                        }
                        alt="放大振幅"
                        width={24}
                        height={24}
                    />
                    <span>{!isFold ? "折叠幅值" : "展开幅值"}</span>
                </button>
            </div>
        </div>
    );
}

export default FoldWave;
