import { useContext, useEffect, useRef, useState } from "react";
import { AudioDataCtx } from "../../audioContext";
import { SpectrumLaneState } from "@/interface/audioData";

interface _p {
    timeRange: [number, number];
    audioId: string;
    spectrumState: SpectrumLaneState;
    setSpectrumState: (state: SpectrumLaneState) => void;
}

interface SpectrumCache {
    mixedData: Float32Array;
    sampleRate: number;
}

interface SpectrumFrameCache {
    frameData: Array<Float32Array>; // 每帧的频谱幅度数据
    maxMagnitude: number; // 缓存最大值，避免每次渲染都扫描
    windowSize: number;
    hopSize: number;
    sampleRate: number;
}

/**
 * 多通道混合为单通道（初始化一次）
 */
function mixDownToMono(audioBuffer: AudioBuffer): Float32Array {
    const channelCount = audioBuffer.numberOfChannels;
    const length = audioBuffer.length;

    if (channelCount === 1) {
        return audioBuffer.getChannelData(0).slice();
    }

    const mixed = new Float32Array(length);
    for (let c = 0; c < channelCount; c++) {
        const ch = audioBuffer.getChannelData(c);
        for (let i = 0; i < length; i++) {
            mixed[i] += ch[i];
        }
    }

    const inv = 1 / channelCount;
    for (let i = 0; i < length; i++) {
        mixed[i] *= inv;
    }

    return mixed;
}

/**
 * FFT 幅度谱（实数输入，带正规化）
 */
function fftMagnitude(input: Float32Array): Float32Array {
    const N = input.length;
    const re = new Float32Array(N);
    const im = new Float32Array(N);

    for (let i = 0; i < N; i++) re[i] = input[i];

    for (let len = 2; len <= N; len <<= 1) {
        const half = len >> 1;
        const step = (Math.PI * 2) / len;

        for (let i = 0; i < N; i += len) {
            for (let j = 0; j < half; j++) {
                const k = i + j;
                const l = k + half;

                const angle = step * j;
                const cos = Math.cos(angle);
                const sin = -Math.sin(angle);

                const tre = re[l] * cos - im[l] * sin;
                const tim = re[l] * sin + im[l] * cos;

                re[l] = re[k] - tre;
                im[l] = im[k] - tim;
                re[k] += tre;
                im[k] += tim;
            }
        }
    }

    const mag = new Float32Array(N / 2);
    const norm = (2 / N) * 1.5; // 正规化因子 + Hann窗补偿
    for (let i = 0; i < mag.length; i++) {
        const amplitude = Math.sqrt(re[i] * re[i] + im[i] * im[i]) * norm;
        mag[i] = amplitude;
    }
    return mag;
}

/**
 * Hann 窗
 */
function applyHannWindow(buf: Float32Array): void {
    const N = buf.length;
    for (let i = 0; i < N; i++) {
        buf[i] *= 0.5 * (1 - Math.cos((2 * Math.PI * i) / (N - 1)));
    }
}

/**
 * 幅度转 dB，带增益调整
 * 增益用于调整频谱的显示亮度
 */
function magnitudeToDb(mag: number, gain: number = 100): number {
    const eps = 1e-10;
    const adjusted = Math.max(mag * gain, eps);
    return 20 * Math.log10(adjusted);
}

/**
 * dB → 颜色映射（固定动态范围）
 */
function dbToColor(db: number): string {
    // 对于正规化后的输入（0-1），db范围大约是-200到+20
    // 重新映射到更合理的动态范围
    const minDb = -100;
    const maxDb = 0;

    const x = Math.min(1, Math.max(0, (db - minDb) / (maxDb - minDb)));

    const r = Math.floor(255 * Math.min(1, Math.max(0, (x - 0.5) * 2)));
    const g = Math.floor(255 * Math.min(1, Math.max(0, (x - 0.25) * 2)));
    const b = Math.floor(255 * (1 - x));

    return `rgb(${r},${g},${b})`;
}

function SpectrumLane(p: _p) {
    const CANVAS_WIDTH = 1200;
    const CANVAS_HEIGHT = 100;
    const WINDOW_SIZE = 1024;
    const HOP_SIZE = 256;

    const audioDataList = useContext(AudioDataCtx);
    const audioData = audioDataList.find((a) => a.id === p.audioId);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const cacheRef = useRef<SpectrumCache | null>(null);
    const spectrumFrameCacheRef = useRef<SpectrumFrameCache | null>(null);
    const computeTaskRef = useRef<AbortController | null>(null);
    const [ready, setReady] = useState(false);
    // 频谱缓存后无需异步setState，直接重绘即可

    /**
     * 初始化音频缓存
     */
    useEffect(() => {
        if (p.spectrumState.isFolded) return;
        if (!audioData?.buffer) return;

        if (!audioContextRef.current) {
            const Ctor =
                window.AudioContext ||
                (
                    window as unknown as {
                        webkitAudioContext: typeof AudioContext;
                    }
                ).webkitAudioContext;
            audioContextRef.current = new Ctor();
        }

        // 如果已有 decodedBuffer，直接使用
        if (audioData.decodedBuffer) {
            cacheRef.current = {
                mixedData: mixDownToMono(audioData.decodedBuffer),
                sampleRate: audioData.decodedBuffer.sampleRate,
            };
            setReady(true);
            return;
        }

        audioContextRef.current.decodeAudioData(
            audioData.buffer.slice(0),
            (audioBuffer) => {
                cacheRef.current = {
                    mixedData: mixDownToMono(audioBuffer),
                    sampleRate: audioBuffer.sampleRate,
                };
                setReady(true);
            },
            (err) => {
                console.error("音频解码失败:", err);
                setReady(false);
            },
        );
    }, [audioData, p.spectrumState.isFolded]);

    /**
     * 初始化 canvas 尺寸
     */
    useEffect(() => {
        if (!canvasRef.current) return;
        canvasRef.current.width = CANVAS_WIDTH;
        canvasRef.current.height = CANVAS_HEIGHT;
    }, []);

    /**
     * 音频缓存就绪后，异步优先计算显示窗口两侧的频谱帧，直到覆盖整个音频
     */
    useEffect(() => {
        if (p.spectrumState.isFolded) return;
        if (!ready || !cacheRef.current) return;
        // 只计算一次全音频所有帧
        if (spectrumFrameCacheRef.current) return;
        const { mixedData, sampleRate } = cacheRef.current;
        const totalFrames = Math.max(
            1,
            Math.floor((mixedData.length - WINDOW_SIZE) / HOP_SIZE) + 1,
        );
        const frameData: Array<Float32Array> = new Array(totalFrames);
        let maxMagnitude = 0;
        for (let t = 0; t < totalFrames; t++) {
            const frameStart = t * HOP_SIZE;
            if (frameStart + WINDOW_SIZE > mixedData.length) break;
            const segment = mixedData.slice(
                frameStart,
                frameStart + WINDOW_SIZE,
            );
            applyHannWindow(segment);
            const spectrum = fftMagnitude(segment);
            frameData[t] = spectrum;
            for (let f = 0; f < spectrum.length; f++) {
                if (spectrum[f] > maxMagnitude) maxMagnitude = spectrum[f];
            }
        }
        spectrumFrameCacheRef.current = {
            frameData,
            maxMagnitude: Math.max(maxMagnitude, 1),
            windowSize: WINDOW_SIZE,
            hopSize: HOP_SIZE,
            sampleRate,
        };
        // 计算完立即重绘
        if (canvasRef.current) {
            const ctx = canvasRef.current.getContext("2d");
            if (ctx) {
                const cache = spectrumFrameCacheRef.current;
                const allFrameData = cache.frameData;
                const maxMagnitude = cache.maxMagnitude;
                const hopSize = cache.hopSize;
                const sampleRate = cache.sampleRate;
                const [tL, tR] = p.timeRange;
                const startSample = Math.max(0, Math.floor(tL * sampleRate));
                const endSample = Math.min(
                    sampleRate * (tR - tL) + startSample,
                    allFrameData.length * hopSize,
                );
                const startFrameIdx = Math.max(
                    0,
                    Math.floor(startSample / hopSize),
                );
                const endFrameIdx = Math.min(
                    allFrameData.length,
                    Math.ceil(endSample / hopSize),
                );
                const displayFrameCount = endFrameIdx - startFrameIdx;
                ctx.fillStyle = "#000000";
                ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
                const binCount = allFrameData[0].length;
                const pxPerFrame = CANVAS_WIDTH / displayFrameCount;
                const pxPerBin = CANVAS_HEIGHT / binCount;
                for (let canvasI = 0; canvasI < displayFrameCount; canvasI++) {
                    const frameIdx = startFrameIdx + canvasI;
                    if (frameIdx >= allFrameData.length) break;
                    const spectrum = allFrameData[frameIdx];
                    if (!spectrum) continue;
                    for (let f = 0; f < spectrum.length; f++) {
                        const normalized = spectrum[f] / maxMagnitude;
                        const db = magnitudeToDb(normalized);
                        ctx.fillStyle = dbToColor(db);
                        const x = canvasI * pxPerFrame;
                        const y = CANVAS_HEIGHT - (f + 1) * pxPerBin;
                        ctx.fillRect(x, y, pxPerFrame + 1, pxPerBin + 1);
                    }
                }
            }
        }
    }, [ready, p.spectrumState.isFolded]);

    /**
     * 绘制频谱热图（使用缓存的频谱数据）
     * 根据时间范围截取对应的帧并渲染
     */
    useEffect(() => {
        if (p.spectrumState.isFolded) return;
        // 只要依赖变化就强制重绘
        if (!canvasRef.current) return;
        const cache = spectrumFrameCacheRef.current;
        if (!cache || !cache.frameData) return;
        const ctx = canvasRef.current.getContext("2d");
        if (!ctx) return;
        const allFrameData = cache.frameData;
        const maxMagnitude = cache.maxMagnitude;
        const hopSize = cache.hopSize;
        const sampleRate = cache.sampleRate;
        if (allFrameData.length === 0) return;
        // 根据时间范围计算对应的帧索引范围
        const [tL, tR] = p.timeRange;
        const startSample = Math.max(0, Math.floor(tL * sampleRate));
        const endSample = Math.min(
            sampleRate * (tR - tL) + startSample,
            allFrameData.length * hopSize,
        );
        const startFrameIdx = Math.max(0, Math.floor(startSample / hopSize));
        const endFrameIdx = Math.min(
            allFrameData.length,
            Math.ceil(endSample / hopSize),
        );
        const displayFrameCount = endFrameIdx - startFrameIdx;
        if (displayFrameCount <= 0) return;
        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        const binCount = allFrameData[0].length;
        const pxPerFrame = CANVAS_WIDTH / displayFrameCount;
        const pxPerBin = CANVAS_HEIGHT / binCount;
        for (let canvasI = 0; canvasI < displayFrameCount; canvasI++) {
            const frameIdx = startFrameIdx + canvasI;
            if (frameIdx >= allFrameData.length) break;
            const spectrum = allFrameData[frameIdx];
            if (!spectrum) continue;
            for (let f = 0; f < spectrum.length; f++) {
                const normalized = spectrum[f] / maxMagnitude;
                const db = magnitudeToDb(normalized);
                ctx.fillStyle = dbToColor(db);
                const x = canvasI * pxPerFrame;
                const y = CANVAS_HEIGHT - (f + 1) * pxPerBin;
                ctx.fillRect(x, y, pxPerFrame + 1, pxPerBin + 1);
            }
        }
    }, [p.timeRange, ready, p.spectrumState.isFolded]);

    return (
        <div>
            <div className="flex gap-2">
                {!p.spectrumState.isFolded && (
                    <canvas
                        ref={canvasRef}
                        width={CANVAS_WIDTH}
                        height={CANVAS_HEIGHT}
                        style={{
                            border: "1px solid #ccc",
                            width: "100%",
                            height: "auto",
                        }}
                    />
                )}
            </div>
        </div>
    );
}

export default SpectrumLane;
