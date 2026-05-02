import Image from "@/components/Image";
import React from "react";
import style from "./waveMenu.module.css";
import classNames from "classnames/bind";

const cls = classNames.bind(style);

interface _p {
    audioId: string;
    isFolded: boolean;
    setIsFolded: (folded: boolean) => void;
}

function FoldWave(p: _p) {
    const handleFold = () => {
        p.setIsFolded(!p.isFolded);
    };

    return (
        <button
            onClick={handleFold}
            title={p.isFolded ? "展开幅值 (Unfold)" : "折叠幅值 (Fold)"}
            className={cls("fold-button")}
        >
            <Image
                src={
                    p.isFolded
                        ? "/assets/icons/unfold.png"
                        : "/assets/icons/fold.png"
                }
                alt={p.isFolded ? "展开幅值" : "折叠幅值"}
                width={24}
                height={24}
            />
        </button>
    );
}

export default FoldWave;
