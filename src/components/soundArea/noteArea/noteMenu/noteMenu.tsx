import React from "react";
import AddLinearMeasure from "./addLinearMeasure";
import style from "./noteMenu.module.css";
import classNames from "classnames/bind";
import { measure } from "@/interface/soundLane/noteLane/measure/measure";
const cls = classNames.bind(style);
interface _p {
    refMeasures: measure[];
    setMeasures: (_: measure[]) => void;
}
function NoteMenu(p: _p) {
    return (
        <div>
            <div className={`flex-col items-center ${cls("menu")}`}>
                {/* AddLinearMeasure */}
                <AddLinearMeasure
                    refMeasures={p.refMeasures}
                    setMeasures={p.setMeasures}
                />
            </div>
        </div>
    );
}

export default NoteMenu;
