"use client";
import style from "./soundFileTitleBar.module.css";
import classNames from "classnames/bind";

const cls = classNames.bind(style);

interface _prop {
    soundFile: string;
    isActive?: boolean;
    offset: number;
    setOffset: (v: number) => void;
}

export default function SoundFileTitleBar(prop: _prop) {
    const stopInteraction = (e: React.SyntheticEvent) => {
        e.stopPropagation();
    };

    return (
        <div className={cls("box", prop.isActive ? "on-focus" : "off-focus")}>
            <div className={cls("offset-row")}>
                <input
                    type="number"
                    step={1}
                    value={Math.round(prop.offset * 1000)}
                    onMouseDown={stopInteraction}
                    onClick={stopInteraction}
                    onKeyDown={stopInteraction}
                    onWheel={(e) => e.stopPropagation()}
                    onChange={(e) => {
                        const v = Number(e.target.value);
                        if (Number.isFinite(v)) prop.setOffset(v / 1000);
                    }}
                    className={cls("offset-input")}
                    title="音频偏移 (毫秒)，正=音频延后，负=图像延后"
                />
                <span className={cls("offset-unit")}>ms</span>
            </div>
            <span className={cls("title-text")}>{prop.soundFile}</span>
        </div>
    );
}
