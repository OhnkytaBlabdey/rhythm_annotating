import React from "react";
import FoldSpectrum from "./foldSpectrum";
interface _p {
    refIsFold: boolean;
    setIsFold: (_: boolean) => void;
}
function SpectrumMenu(p: _p) {
    return (
        <div>
            <div className="flex flex-col">
                <div>
                    <FoldSpectrum
                        setIsFold={p.setIsFold}
                        refIsFold={p.refIsFold}
                    />
                </div>
            </div>
        </div>
    );
}

export default SpectrumMenu;
