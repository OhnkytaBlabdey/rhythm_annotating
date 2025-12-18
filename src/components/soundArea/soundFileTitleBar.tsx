"use client";
import style from "./soundFileTitleBar.module.css";
import classNames from "classnames/bind";

const cls = classNames.bind(style);

interface _prop {
    soundFile: string;
    isSelected?: boolean;
}

export default function SoundFileTitleBar(prop: _prop) {
    return (
        <div className={cls("box", prop.isSelected ? "on-focus" : "off-focus")}>
            <span className={cls("title-text")}>{prop.soundFile}</span>
        </div>
    );
}
