import { soundlane } from "@/interface/soundLane/soundlane";
import Image from "next/image";
import React from "react";
interface _prop {
    refSoundLanes: soundlane[];
    setSoundLanes: (a: soundlane[]) => void;
}
function DeleteActiveSound(prop: _prop) {
    const handleDeleteSoundLane = () => {
        prop.setSoundLanes(
            prop.refSoundLanes.filter((lane: soundlane) => {
                return !lane.isActive;
            })
        );
    };
    return (
        <div>
            <button
                onClick={handleDeleteSoundLane}
                title="delete sound lane"
                className="flex items-center gap-2"
            >
                <Image
                    src="/assets/icons/deleteSoundLane.png"
                    alt="Delete Sound Lane"
                    width={36}
                    height={24}
                />
                <span>删除音频</span>
            </button>
        </div>
    );
}

export default DeleteActiveSound;
// 从工程中删除关于该音频文件的引用
