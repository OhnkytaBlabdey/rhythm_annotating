import {
    defaultMeasure,
    measure,
} from "@/interface/soundLane/noteLane/measure/measure";
import Image from "next/image";
import React from "react";
import style from "./noteMenu.module.css";
import classNames from "classnames/bind";
const cls = classNames.bind(style);
interface _p {
    refMeasures: measure[];
    setMeasures: (_: measure[]) => void;
    refBPM: number;
}
function AddLinearMeasure(p: _p) {
    function handleAddMeasure() {
        const last = p.refMeasures.length > 0 ? p.refMeasures.at(-1) : null;
        const newm =
            last == null
                ? defaultMeasure()
                : ({
                      noBeat: last.noBeat,
                      notes: [],
                      bpm: p.refBPM,
                      currentDivide: 4,
                      currentNum: 0,
                  } as measure);
        p.setMeasures([...p.refMeasures, newm]);
    }
    return (
        <div>
            <button
                onClick={handleAddMeasure}
                title="Add Measure"
                className={`flex items-center gap-2 ${cls("button")}`}
            >
                <Image
                    src="/assets/icons/addMeasure.png"
                    alt="Add Measure"
                    width={36}
                    height={24}
                />
                <span>添加小节</span>
            </button>
        </div>
    );
}

export default AddLinearMeasure;
// 线性添加一个和上一个bpm相同的1/4小节。
