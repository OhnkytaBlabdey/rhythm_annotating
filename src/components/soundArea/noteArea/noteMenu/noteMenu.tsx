import React, { useState } from "react";
import AddLinearMeasure from "./addLinearMeasure";
import style from "./noteMenu.module.css";
import classNames from "classnames/bind";
import { measure } from "@/interface/soundLane/noteLane/measure/measure";
import AdjustBPM from "./adjustLaneBpm";
const cls = classNames.bind(style);
interface _p {
    refMeasures: measure[];
    setMeasures: (_: measure[]) => void;
}
function NoteMenu(p: _p) {
    const [refBPM, setBPM] = useState(60);
    return (
        <div>
            <div className={`flex items-center ${cls("menu")}`}>
                {/* AddLinearMeasure */}
                <AddLinearMeasure
                    refMeasures={p.refMeasures}
                    setMeasures={p.setMeasures}
                    refBPM={refBPM}
                />
                <AdjustBPM refBPM={refBPM} setBPM={setBPM} />
            </div>
        </div>
    );
}

export default NoteMenu;
