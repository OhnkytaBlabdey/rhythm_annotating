"use client";
import style from "./soundFileTitleBar.module.css";
import classNames from "classnames/bind";
import Image from "@/components/Image";

const cls = classNames.bind(style);

interface _prop {
    soundFile: string;
    isActive?: boolean;
    offset: number;
    setOffset: (v: number) => void;
    onDelete?: () => void;
}

export default function SoundFileTitleBar(prop: _prop) {
    const stopInteraction = (e: React.SyntheticEvent) => {
        e.stopPropagation();
    };

    return (
        <div className={cls("box", prop.isActive ? "on-focus" : "off-focus")}>
            <div className={cls("offset-row")}>
                <span className={cls("offset-label")}>音频偏移</span>
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
                    title="音频偏移(毫秒)。正=音频延后播放；负=UI冻结延后"
                />
                <span className={cls("offset-unit")}>ms</span>
            </div>
            <span className={cls("title-text")}>{prop.soundFile}</span>
            {prop.onDelete && (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        prop.onDelete?.();
                    }}
                    title="删除此音频"
                    className="inline-flex items-center justify-center w-5 h-5 border-0 bg-transparent cursor-pointer rounded-md p-0 opacity-55 hover:opacity-100 hover:bg-[rgba(180,35,24,0.12)] transition-[opacity,background-color] duration-200"
                >
                    <Image
                        src="/assets/icons/deleteSoundLane.png"
                        alt="删除音频"
                        width={16}
                        height={16}
                    />
                </button>
            )}
        </div>
    );
}
