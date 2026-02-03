import { SoundLaneState, defaultSoundLaneState } from "./audioData";

export interface project {
    currentTime: number;
    timeMultiplier: number;
    isPlaying: boolean;
    playSpeed: number;
    soundLaneStates: SoundLaneState[];
}

export function defaultProject() {
    return {
        currentTime: 0,
        timeMultiplier: 1,
        isPlaying: false,
        playSpeed: 1,
        soundLaneStates: [],
    } as project;
}
