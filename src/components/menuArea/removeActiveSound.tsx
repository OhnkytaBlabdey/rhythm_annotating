import { SoundLaneState } from "@/interface/audioData";
import Image from "next/image";
import React from "react";

interface _prop {
    refSoundLaneStates: SoundLaneState[];
    setSoundLaneStates: (a: SoundLaneState[]) => void;
}

function DeleteActiveSound(prop: _prop) {
    const handleDeleteSoundLane = () => {
        prop.setSoundLaneStates(
            prop.refSoundLaneStates.filter((state: SoundLaneState) => {
                return !state.isActive;
            }),
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
