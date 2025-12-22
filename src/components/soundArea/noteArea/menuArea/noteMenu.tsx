import React from "react";
import AddLinearMeasure from "./addLinearMeasure";
import style from "./noteMenu.module.css";
import classNames from "classnames/bind";
const cls = classNames.bind(style);

function NoteMenu() {
    return (
        <div>
            <div className={`flex-col items-center ${cls("menu")}`}>
                {/* AddLinearMeasure */}
                <AddLinearMeasure />
            </div>
        </div>
    );
}

export default NoteMenu;
