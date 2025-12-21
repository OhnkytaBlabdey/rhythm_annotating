import { defaultSoundLane, soundlane } from "./soundLane/soundlane";

export interface project {
    currentTime: number;
    duration: number; //逻辑上持续的时间，对谱子可见的时间范围。
    isPlaying: boolean;
    playSpeed: number; //播放倍速
    soundLanes: soundlane[];
}
export function defaultProject() {
    return {
        currentTime: 0,
        duration: 0,
        isPlaying: false,
        playSpeed: 1,
        soundLanes: [defaultSoundLane("example.mp3")],
    } as project;
}
