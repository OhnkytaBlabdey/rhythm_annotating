import React from "react";
import style from "./spectrumMenu.module.css";
import classNames from "classnames/bind";
import Image from "@/components/Image";

const cls = classNames.bind(style);

interface _p {
    audioId: string;
    isFolded: boolean;
    setIsFolded: (folded: boolean) => void;
}

function FoldSpectrum(p: _p) {
    const handleFold = () => {
        p.setIsFolded(!p.isFolded);
    };

    return (
        <button
            onClick={handleFold}
            title={p.isFolded ? "展开频域 (Unfold)" : "折叠频域 (Fold)"}
            className={cls("fold-button")}
        >
            <Image
                src={
                    p.isFolded
                        ? "/assets/icons/unfold.png"
                        : "/assets/icons/fold.png"
                }
                alt={p.isFolded ? "展开频域" : "折叠频域"}
                width={24}
                height={24}
            />
        </button>
    );
}

export default FoldSpectrum;
