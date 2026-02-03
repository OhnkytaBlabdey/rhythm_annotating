import React, { useState } from "react";
import style from "./spectrumMenu.module.css";
import classNames from "classnames/bind";
import Image from "next/image";

const cls = classNames.bind(style);

interface _p {
    audioId: string;
    setIsFold: (_: boolean) => void;
}

function FoldSpectrum(p: _p) {
    const [isFold, setIsFold] = useState(false);

    const handleFold = () => {
        const newValue = !isFold;
        setIsFold(newValue);
        p.setIsFold(newValue);
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
                            isFold
                                ? "/assets/icons/unfold.png"
                                : "/assets/icons/fold.png"
                        }
                        alt="折叠频域"
                        width={24}
                        height={24}
                    />
                    <span>{!isFold ? "折叠频域" : "展开频域"}</span>
                </button>
            </div>
        </div>
    );
}

export default FoldSpectrum;
