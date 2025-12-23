import Image from "next/image";
import style from "./adjustTimeScale.module.css";
import classNames from "classnames/bind";
import React from "react";

const cls = classNames.bind(style);
interface _p {
    refTimeMultiplier: number;
    setTimeMultiplier: (_: number) => void;
    refCurrentTime: number;
    Duration: number;
    //音频绘制需要对比本音频的duration，但整体时间需要用整体的持续时长。这里是整体时间。
    setCurrentTime: (_: number) => void;
}
function TimeScale(p: _p) {
    function handleZoomIn() {
        p.setTimeMultiplier(p.refTimeMultiplier * (9 / 10));
    }
    function handleZoomOut() {
        p.setTimeMultiplier(p.refTimeMultiplier * (10 / 9));
    }
    function handleTimeSub() {
        const res = p.refCurrentTime - p.refTimeMultiplier * (5 / 4);
        p.setCurrentTime(res >= 0 ? res : 0);
    }
    function handleTimeAdd() {
        let res = p.refCurrentTime + p.refTimeMultiplier * (5 / 4);
        if (res > p.Duration - p.refTimeMultiplier) {
            if (p.Duration - p.refTimeMultiplier > 0) {
                res = p.Duration - p.refTimeMultiplier;
            }
        }
        p.setCurrentTime(res);
        // 超过持续时间？
        // 不满一个屏
    }
    return (
        <div>
            <div className="flex">
                <button
                    onClick={handleZoomIn}
                    title="Zoom In"
                    className={`flex items-center gap-2 ${cls("button")}`}
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
                    className={`flex items-center gap-2 ${cls("button")}`}
                >
                    <Image
                        src="/assets/icons/zoomOut.png"
                        alt="缩小时间视图"
                        width={48}
                        height={24}
                    />
                </button>
                <button
                    onClick={handleTimeSub}
                    title="时间向前"
                    className={`flex items-center gap-2 ${cls("button")}`}
                >
                    <Image
                        src="/assets/icons/timeSub.png"
                        alt="时间向前"
                        width={48}
                        height={24}
                    />
                </button>
                <button
                    onClick={handleTimeAdd}
                    title="时间向后"
                    className={`flex items-center gap-2 ${cls("button")}`}
                >
                    <Image
                        src="/assets/icons/timeAdd.png"
                        alt="时间向后"
                        width={48}
                        height={24}
                    />
                </button>
            </div>
        </div>
    );
}

export default TimeScale;
