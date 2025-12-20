import { notelane } from "./noteLane/notelane";
import { spectrumlane } from "./spectrumLane/spectrumlane";
import { wavelane } from "./waveLane/wavelane";

export interface soundlane {
    mediaFilePath: string;
    isActive: boolean;
    isPlayComplete: boolean; //多个音频不一样长，记录本轨道是否播放完成。
    offset: number; //逻辑上时刻加offset得到本音频文件中的时刻。
    noteLanes: notelane[];
    waveLane: wavelane;
    spectrumLane: spectrumlane;
}
