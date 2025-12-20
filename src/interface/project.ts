import { soundlane } from "./soundLane/soundlane";

export interface project {
    currentTime: number;
    duration: number; //逻辑上持续的时间，对谱子可见的时间范围。
    isPlaying: boolean;
    playSpeed: number; //播放倍速
    soundLanes: soundlane[];
}
