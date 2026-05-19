import { NoteLaneData } from "@/components/soundArea/noteArea/chartTypes";
import { migrateNoteLaneData } from "@/components/soundArea/noteArea/chartAdapter";

/**
 * 完整的音频文件数据，存储在全局 context 中
 */
export interface AudioData {
    id: string;
    file: string;
    buffer: ArrayBuffer;
    duration: number;
    decodedBuffer?: AudioBuffer;
}

/**
 * 简化的 soundLane UI 状态，只存储必要的UI相关信息
 */
export interface SoundLaneState {
    audioId: string;
    isActive: boolean;
    offset: number;            // 音频偏移(秒)。正=音频延后播放；负=统一UI冻结|minOffset|后开始走时
    isPlayComplete: boolean;
    noteLanes: NoteLaneData[];
    noteLaneOffset: number;    // 记谱图形偏移(秒)，仅canvas像素位移
    waveLane: WaveLaneState;
    spectrumLane: SpectrumLaneState;

}

/**
 * 简化的 noteLane UI 状态
 */
export interface NoteLaneState {
    id: string;
    defaultBpm: number;
    division: number;
}

/**
 * 简化的 waveLane UI 状态
 */
export interface WaveLaneState {
    amplitudeMultiplier: number;
    isFolded: boolean;
    offset: number;            // 波形图形偏移(秒)，仅canvas像素位移
}

/**
 * 简化的 spectrumLane UI 状态
 */
export interface SpectrumLaneState {
    paletteSchema: string;
    isFolded: boolean;
    brightnessOffset: number;
    resolutionScale: number;
    offset: number;            // 频谱图形偏移(秒)，仅canvas像素位移
}

export function defaultSoundLaneState(audioId: string): SoundLaneState {
    return {
        audioId,
        isActive: false,
        offset: 0,
        isPlayComplete: false,
        noteLanes: [defaultNoteLaneData()],
        noteLaneOffset: 0,
        waveLane: defaultWaveLaneState(),
        spectrumLane: defaultSpectrumLaneState(),

    };
}

export function defaultNoteLaneState(): NoteLaneState {
    return {
        id: generateId(),
        defaultBpm: 120,
        division: 4,
    };
}

export function defaultNoteLaneData(
    defaultBpm?: number,
): NoteLaneData {
    const lane = defaultNoteLaneState();
    const bpm = defaultBpm ?? lane.defaultBpm;
    return {
        id: lane.id,
        defaultBpm: bpm,
        division: lane.division,
        chartData: [],
        isFolded: false,
        dataVersion: 2,
    };
}

export function defaultWaveLaneState(): WaveLaneState {
    return {
        amplitudeMultiplier: 5,
        isFolded: false,
        offset: 0,
    };
}

export function defaultSpectrumLaneState(): SpectrumLaneState {
    return {
        paletteSchema: "default",
        isFolded: false,
        brightnessOffset: 0,
        resolutionScale: 1,
        offset: 0,
    };
}

export const generateId = (): string => {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000000);
    return `${timestamp}${random}`;
};

export function normalizeSoundLaneState(raw: SoundLaneState): SoundLaneState {
    return {
        ...raw,
        offset: raw.offset ?? 0,
        noteLaneOffset: raw.noteLaneOffset ?? 0,
        waveLane: {
            ...defaultWaveLaneState(),
            ...raw.waveLane,
            offset: raw.waveLane?.offset ?? 0,
        },
        spectrumLane: {
            ...defaultSpectrumLaneState(),
            ...raw.spectrumLane,
            offset: raw.spectrumLane?.offset ?? 0,
        },
        noteLanes:
            Array.isArray(raw.noteLanes) && raw.noteLanes.length > 0
                ? raw.noteLanes.map((lane: NoteLaneData) => migrateNoteLaneData({
                    ...lane,
                    isFolded: lane.isFolded ?? false,
                  }))
                : [defaultNoteLaneData()],

    };
}
