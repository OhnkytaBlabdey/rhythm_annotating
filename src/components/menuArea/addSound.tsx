import { defaultSoundLane, soundlane } from "@/interface/soundLane/soundlane";
import Image from "next/image";
import React from "react";
interface _prop {
    refSoundLanes: soundlane[];
    setSoundLanes: (a: soundlane[]) => void;
}
function AddSound(prop: _prop) {
    const handleAddSoundLane = () => {
        prop.setSoundLanes([
            ...prop.refSoundLanes,
            defaultSoundLane("example.mp3"),
        ]);
    };
    return (
        <div>
            <button
                onClick={handleAddSoundLane}
                title="Click to AddSound"
                className="flex items-center gap-2"
            >
                <Image
                    src="/assets/icons/newSoundLane.png"
                    alt="Add Sound Lane"
                    width={24}
                    height={24}
                />
                <span>添加音频</span>
            </button>
        </div>
    );
}

export default AddSound;
