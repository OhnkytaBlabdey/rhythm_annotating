"use client";
import Image from "@/components/Image";
import style from "./addNoteLane.module.css";
import classNames from "classnames/bind";

const cls = classNames.bind(style);

interface _prop {
    audioId: string;
}

function AddNoteLane(prop: _prop) {
    const handleAddNoteLane = () => {
        // TODO: 通过 audioId 添加 NoteLane 到该音频
    };

    return (
        <div>
            <button
                onClick={handleAddNoteLane}
                title="Click to AddNoteLane"
                className={`${cls("icon-button")} flex items-center gap-2`}
            >
                <Image
                    src="/assets/icons/newNoteLane.png"
                    alt="Add Note Lane"
                    width={24}
                    height={24}
                />
                <span>添加记谱</span>
            </button>
        </div>
    );
}

export default AddNoteLane;
