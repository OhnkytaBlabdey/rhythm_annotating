import Image from "next/image";
import React from "react";
interface _p {
    refTimeMultiplier: number;
    setTimeMultiplier: (_: number) => void;
}
function TimeScale(p: _p) {
    function handleZoomIn() {
        p.setTimeMultiplier(p.refTimeMultiplier * (9 / 10));
    }
    function handleZoomOut() {
        p.setTimeMultiplier(p.refTimeMultiplier * (10 / 9));
    }
    return (
        <div>
            <div className="flex">
                <button
                    onClick={handleZoomIn}
                    title="Zoom In"
                    className={`flex items-center gap-2`}
                >
                    <Image
                        src="/assets/icons/zoomIn.png"
                        alt="放大时间视图"
                        width={48}
                        height={24}
                    />
                </button>
                <button
                    onClick={handleZoomOut}
                    title="Zoom Out"
                    className={`flex items-center gap-2`}
                >
                    <Image
                        src="/assets/icons/zoomOut.png"
                        alt="缩小时间视图"
                        width={48}
                        height={24}
                    />
                </button>
            </div>
        </div>
    );
}

export default TimeScale;
