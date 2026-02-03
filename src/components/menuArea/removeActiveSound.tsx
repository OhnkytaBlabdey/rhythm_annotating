import { SoundLaneState } from "@/interface/audioData";
import Image from "next/image";
import React from "react";

interface _prop {
    refSoundLaneStates: SoundLaneState[];
    removeAudioData: (audioId: string) => void;
}

function DeleteActiveSound(prop: _prop) {
    const handleDeleteSoundLane = () => {
        const activeState = prop.refSoundLaneStates.find(
            (state: SoundLaneState) => state.isActive,
        );
        if (activeState) {
            prop.removeAudioData(activeState.audioId);
        }
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
