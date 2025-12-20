"use client";
import { notelane } from "@/interface/soundLane/noteLane/notelane";
import Image from "next/image";
import style from "./addNoteLane.module.css";
import classNames from "classnames/bind";
const cls = classNames.bind(style);
interface _prop {
    refNoteLanes: notelane[];
    setNoteLanes: (a: notelane[]) => void;
}

function AddNoteLane(prop: _prop) {
    const handleAddNoteLane = () => {
        prop.setNoteLanes([
            ...prop.refNoteLanes,
            {
                measures: [],
                startTime: 0,
            },
        ]);
    };

    return (
        <div>
            <button
                onClick={handleAddNoteLane}
                title="Click to AddNoteLane"
                className={cls("icon-button")}
            >
                <Image
                    src="/assets/icons/newNoteLane.png"
                    alt="Add Note Lane"
                    width={24}
                    height={24}
                />
            </button>
        </div>
    );
}

export default AddNoteLane;
