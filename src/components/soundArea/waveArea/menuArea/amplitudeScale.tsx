import Image from "next/image";
import React from "react";
interface _p {
    refAmplitudeMultiplier: number;
    setAmplitudeMultiplier: (_: number) => void;
}
function AmplitudeScale(p: _p) {
    function handleAmpUp() {
        p.setAmplitudeMultiplier(p.refAmplitudeMultiplier * (6 / 5));
    }
    function handleAmpDown() {
        p.setAmplitudeMultiplier(p.refAmplitudeMultiplier * (5 / 6));
    }
    return (
        <div>
            <div className="flex-col">
                <button
                    onClick={handleAmpUp}
                    title="Amplitude Up"
                    className={`flex items-center gap-2`}
                >
                    <Image
                        src="/assets/icons/ampUp.png"
                        alt="放大振幅"
                        width={24}
                        height={24}
                    />
                </button>
                <button
                    onClick={handleAmpDown}
                    title="Amplitude Down"
                    className={`flex items-center gap-2`}
                >
                    <Image
                        src="/assets/icons/ampDown.png"
                        alt="缩小振幅"
                        width={24}
                        height={24}
                    />
                </button>
            </div>
        </div>
    );
}

export default AmplitudeScale;
