import React from "react";
import FoldSpectrum from "./foldSpectrum";

interface _p {
    audioId: string;
    setIsFold: (_: boolean) => void;
}

function SpectrumMenu(p: _p) {
    return (
        <div>
            <div className="flex flex-col">
                <div>
                    <FoldSpectrum audioId={p.audioId} setIsFold={p.setIsFold} />
                </div>
            </div>
        </div>
    );
}

export default SpectrumMenu;
