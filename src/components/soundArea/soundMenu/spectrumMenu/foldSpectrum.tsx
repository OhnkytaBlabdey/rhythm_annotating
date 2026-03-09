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
        <div>
            <div className="flex">
                <button
                    onClick={handleFold}
                    title="Spectrum Fold"
                    className={`flex items-center gap-2 ${cls("button")}`}
                >
                    <Image
                        src={
                            p.isFolded
                                ? "/assets/icons/unfold.png"
                                : "/assets/icons/fold.png"
                        }
                        alt="折叠频域"
                        width={24}
                        height={24}
                    />
                    <span>{!p.isFolded ? "折叠频域" : "展开频域"}</span>
                </button>
            </div>
        </div>
    );
}

export default FoldSpectrum;
