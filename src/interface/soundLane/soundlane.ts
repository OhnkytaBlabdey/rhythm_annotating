import { defaultNoteLane, notelane } from "./noteLane/notelane";
import { defaultSpectrumLane, spectrumlane } from "./spectrumLane/spectrumlane";
import { defaultWaveLane, wavelane } from "./waveLane/wavelane";

export interface soundlane {
    mediaFilePath: string;
    audioBuffer?: ArrayBuffer;
    decodedBuffer?: AudioBuffer;
    isActive: boolean;
    duration: number;
    isPlayComplete: boolean; //多个音频不一样长，记录本轨道是否播放完成。
    offset: number; //对本soundlane来说的时刻加offset得到本音频文件中的时刻。
    // currentTime: number; //对本soundlane来说的最左侧的时刻（UI可以留白一些）
    noteLanes: notelane[];
    waveLane: wavelane;
    spectrumLane: spectrumlane;
}
export function defaultSoundLane(
    file: string,
    audioBuffer?: ArrayBuffer,
    duration?: number
) {
    return {
        isActive: false,
        isPlayComplete: false,
        mediaFilePath: file,
        audioBuffer: audioBuffer,
        duration: duration,
        noteLanes: [defaultNoteLane()],
        offset: 0,
        spectrumLane: defaultSpectrumLane(),
        waveLane: defaultWaveLane(),
    } as soundlane;
}
