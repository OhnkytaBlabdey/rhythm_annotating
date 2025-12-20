"use client";
import style from "./soundFileTitleBar.module.css";
import classNames from "classnames/bind";

const cls = classNames.bind(style);

interface _prop {
    soundFile: string;
    isActive?: boolean;
}

export default function SoundFileTitleBar(prop: _prop) {
    return (
        <div className={cls("box", prop.isActive ? "on-focus" : "off-focus")}>
            <span className={cls("title-text")}>{prop.soundFile}</span>
        </div>
    );
}
