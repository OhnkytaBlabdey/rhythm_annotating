import { SoundLaneState } from "@/interface/audioData";
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
                <span>删除音频</span>
            </button>
        </div>
    );
}

export default DeleteActiveSound;
