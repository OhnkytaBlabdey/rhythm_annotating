import { NoteLaneData } from "@/components/soundArea/noteArea/chartTypes";

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
    offset: number;
    isPlayComplete: boolean;
    noteLanes: NoteLaneData[];
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
}

/**
 * 简化的 spectrumLane UI 状态
 */
export interface SpectrumLaneState {
    paletteSchema: string;
    isFolded: boolean;
    brightnessOffset: number;
    resolutionScale: number;
}

export function defaultSoundLaneState(audioId: string): SoundLaneState {
    return {
        audioId,
        isActive: false,
        offset: 0,
        isPlayComplete: false,
        noteLanes: [defaultNoteLaneData()],
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

export function defaultNoteLaneData(): NoteLaneData {
    const lane = defaultNoteLaneState();
    return {
        id: lane.id,
        defaultBpm: lane.defaultBpm,
        division: lane.division,
        chartData: [
            {
                time: 0,
                tempo: lane.defaultBpm,
                measures: [{ notes: [] }],
            },
        ],
    };
}

export function defaultWaveLaneState(): WaveLaneState {
    return {
        amplitudeMultiplier: 5,
        isFolded: false,
    };
}

export function defaultSpectrumLaneState(): SpectrumLaneState {
    return {
        paletteSchema: "default",
        isFolded: false,
        brightnessOffset: 0,
        resolutionScale: 1,
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
        noteLanes:
            Array.isArray(raw.noteLanes) && raw.noteLanes.length > 0
                ? raw.noteLanes
                : [defaultNoteLaneData()],
    };
}
