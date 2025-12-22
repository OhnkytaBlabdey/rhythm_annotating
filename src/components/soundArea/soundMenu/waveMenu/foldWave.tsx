import Image from "next/image";
import React from "react";
import style from "./waveMenu.module.css";
import classNames from "classnames/bind";
const cls = classNames.bind(style);
interface _p {
    refIsFold: boolean;
    setIsFold: (_: boolean) => void;
}
function FoldWave(p: _p) {
    const handleFold = () => {
        p.setIsFold(!p.refIsFold);
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
                            p.refIsFold
                                ? "/assets/icons/unfold.png"
                                : "/assets/icons/fold.png"
                        }
                        alt="放大振幅"
                        width={24}
                        height={24}
                    />
                    <span>{!p.refIsFold ? "折叠幅值" : "展开幅值"}</span>
                </button>
            </div>
        </div>
    );
}

export default FoldWave;
