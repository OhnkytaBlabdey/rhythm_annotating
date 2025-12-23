import { soundlane } from "./soundLane/soundlane";

export interface project {
    currentTime: number;
    timeMultiplier: number;
    // duration: number; //从项目文件看持续的时间，对谱子可见的时间范围。是属性不是状态
    isPlaying: boolean;
    playSpeed: number; //播放倍速
    soundLanes: soundlane[];
}
export function defaultProject() {
    return {
        currentTime: 0,
        // duration: 0,
        timeMultiplier: 1,
        isPlaying: false,
        playSpeed: 1,
        // soundLanes: [defaultSoundLane("example.mp3")],
        soundLanes: [],
    } as project;
}
