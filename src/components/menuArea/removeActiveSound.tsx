import { SoundLaneState } from "@/interface/audioData";
import React from "react";
import Image from "@/components/Image";

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
                <Image src="/assets/icons/deleteSoundLane.png" alt="删除音频" width={20} height={20} />
            </button>
        </div>
    );
}

export default DeleteActiveSound;
