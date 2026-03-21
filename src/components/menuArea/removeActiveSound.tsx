import { SoundLaneState } from "@/interface/audioData";
import Image from "@/components/Image";
import React from "react";

interface _prop {
    refSoundLaneStates: SoundLaneState[];
    removeMultipleAudioData: (audioIds: string[]) => void;
}

function DeleteActiveSound(prop: _prop) {
    const handleDeleteSoundLane = () => {
        const activeAudioIds = prop.refSoundLaneStates
            .filter((state: SoundLaneState) => state.isActive)
            .map((state) => state.audioId);
        if (activeAudioIds.length > 0) {
            prop.removeMultipleAudioData(activeAudioIds);
        }
    };

    return (
        <div>
            <button
                type="button"
                onClick={handleDeleteSoundLane}
                title="delete sound lane"
                className="editor-toolbar-button"
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
