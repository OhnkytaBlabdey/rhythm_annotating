import { useContext, useEffect, useRef, useState } from "react";
import { AudioDataCtx } from "../../audioContext";
import { WaveLaneState } from "@/interface/audioData";

interface _p {
    timeRange: [number, number];
    audioId: string;
    waveState: WaveLaneState;
    setWaveState: (state: WaveLaneState) => void;
}

interface WaveformCache {
    audioBuffer: AudioBuffer;
    mixedData: Float32Array;
    sampleRate: number;
}

interface RenderedWaveCache {
    amplitudeMultiplier: number;
    wavePoints: Array<{ y1: number; y2: number }>;
}

interface UpdateTask {
    abortController: AbortController;
    amplitudeMultiplier: number;
}

/**
 * 多通道混合为单通道（初始化阶段一次性执行）
 */
function mixDownToMono(audioBuffer: AudioBuffer): Float32Array {
    const channelCount = audioBuffer.numberOfChannels;
    const length = audioBuffer.length;

    if (channelCount === 1) {
        return audioBuffer.getChannelData(0).slice();
    }

    const mixed = new Float32Array(length);

    for (let c = 0; c < channelCount; c++) {
        const channelData = audioBuffer.getChannelData(c);
        for (let i = 0; i < length; i++) {
            mixed[i] += channelData[i];
        }
    }

    const inv = 1 / channelCount;
    for (let i = 0; i < length; i++) {
        mixed[i] *= inv;
    }

    return mixed;
}

/**
 * 计算波形点数据，支持中断
 * @param mixedData 单通道混合数据
 * @param canvasWidth canvas宽度（像素）
 * @param canvasHeight canvas高度（像素）
 * @param amplitudeMultiplier 幅度倍数
 * @param signal 中止信号
 */
function computeWavePoints(
    mixedData: Float32Array,
    canvasWidth: number,
    canvasHeight: number,
    amplitudeMultiplier: number,
    signal: AbortSignal,
): { y1: number; y2: number }[] | null {
    if (signal.aborted) return null;

    const wavePoints: { y1: number; y2: number }[] = new Array(canvasWidth);
    const centerY = canvasHeight / 2;
    const samplesPerPixel = Math.max(
        1,
        Math.floor(mixedData.length / canvasWidth),
    );

    for (let i = 0; i < canvasWidth; i++) {
        // 频繁检查中止信号
        if (signal.aborted) {
            return null;
        }

        const sampleIndex = Math.floor((i / canvasWidth) * mixedData.length);

        let minVal = mixedData[sampleIndex];
        let maxVal = mixedData[sampleIndex];

        for (
            let j = 1;
            j < samplesPerPixel && sampleIndex + j < mixedData.length;
            j++
        ) {
            const v = mixedData[sampleIndex + j];
            if (v < minVal) minVal = v;
            if (v > maxVal) maxVal = v;
        }

        const y1 = centerY - maxVal * (canvasHeight / 2) * amplitudeMultiplier;
        const y2 = centerY - minVal * (canvasHeight / 2) * amplitudeMultiplier;

        wavePoints[i] = { y1, y2 };
    }

    return wavePoints;
}

/**
 * 使用缓存的波形点数据绘制到canvas
 */
function renderWaveToCanvas(
    ctx: CanvasRenderingContext2D,
    wavePoints: { y1: number; y2: number }[],
    timeRange: [number, number],
    sampleRate: number,
    mixedDataLength: number,
) {
    const canvas = ctx.canvas;
    const width = canvas.width;
    const height = canvas.height;
    const [t_left, t_right] = timeRange;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    const startSample = Math.max(0, Math.floor(t_left * sampleRate));
    const endSample = Math.min(
        mixedDataLength,
        Math.ceil(t_right * sampleRate),
    );

    const rangeLength = endSample - startSample;
    if (rangeLength <= 0) return;

    // 计算时间范围对应的全局像素范围
    const startPixel = (startSample / mixedDataLength) * wavePoints.length;
    const endPixel = (endSample / mixedDataLength) * wavePoints.length;
    const pixelRange = endPixel - startPixel;

    ctx.strokeStyle = "#0066cc";
    ctx.lineWidth = 1;
    ctx.beginPath();

    for (let canvasI = 0; canvasI < width; canvasI++) {
        // 计算canvas上第canvasI个像素对应的全局像素位置
        const globalPixelPos = startPixel + (canvasI / width) * pixelRange;
        const globalPixelIdx = Math.floor(globalPixelPos);

        // 越界保护
        if (globalPixelIdx < 0 || globalPixelIdx >= wavePoints.length) {
            continue;
        }

        const { y1, y2 } = wavePoints[globalPixelIdx];
        if (canvasI === 0) {
            ctx.moveTo(canvasI, y1);
        } else {
            ctx.lineTo(canvasI, y1);
            ctx.lineTo(canvasI, y2);
        }
    }

    ctx.stroke();

    // 绘制中线
    const centerY = height / 2;
    ctx.strokeStyle = "#cccccc";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();
}

function WaveLane(p: _p) {
    const CANVAS_PHYSICAL_WIDTH = 1200;
    const CANVAS_HEIGHT = 100;

    const audioDataList = useContext(AudioDataCtx);
    const audioData = audioDataList.find((a) => a.id === p.audioId);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const waveformCacheRef = useRef<WaveformCache | null>(null);
    const renderedWaveCacheRef = useRef<RenderedWaveCache | null>(null);
    const updateTaskRef = useRef<UpdateTask | null>(null);
    const [isCacheReady, setIsCacheReady] = useState(false);
    const [isRenderReady, setIsRenderReady] = useState(false);

    /**
     * 开启缓存计算任务
     */
    const startWavePointsComputeTask = (amplitudeMultiplier: number) => {
        // 中止旧任务
        if (updateTaskRef.current) {
            updateTaskRef.current.abortController.abort();
        }

        if (!waveformCacheRef.current) return;

        const abortController = new AbortController();
        updateTaskRef.current = {
            abortController,
            amplitudeMultiplier,
        };

        const { mixedData } = waveformCacheRef.current;

        // 使用 requestAnimationFrame 异步计算，避免阻塞主线程
        const compute = () => {
            if (abortController.signal.aborted) {
                updateTaskRef.current = null;
                return;
            }

            const wavePoints = computeWavePoints(
                mixedData,
                CANVAS_PHYSICAL_WIDTH,
                CANVAS_HEIGHT,
                amplitudeMultiplier,
                abortController.signal,
            );

            // 如果被中止或计算失败，不更新缓存
            if (wavePoints === null || abortController.signal.aborted) {
                updateTaskRef.current = null;
                return;
            }

            // 成功计算，更新缓存
            renderedWaveCacheRef.current = {
                amplitudeMultiplier,
                wavePoints,
            };

            setIsRenderReady(true);
            updateTaskRef.current = null;
        };

        requestAnimationFrame(compute);
    };

    /**
     * 解码音频并初始化缓存（只做一次重计算）
     */
    useEffect(() => {
        if (!audioData?.buffer) return;

        if (!audioContextRef.current) {
            const AudioContextConstructor =
                window.AudioContext ||
                (
                    window as unknown as {
                        webkitAudioContext: typeof AudioContext;
                    }
                ).webkitAudioContext;
            audioContextRef.current = new AudioContextConstructor();
        }

        // 如果已有 decodedBuffer，直接使用
        if (audioData.decodedBuffer) {
            const mixedData = mixDownToMono(audioData.decodedBuffer);
            waveformCacheRef.current = {
                audioBuffer: audioData.decodedBuffer,
                mixedData,
                sampleRate: audioData.decodedBuffer.sampleRate,
            };
            setIsCacheReady(true);
            return;
        }

        const arrayBufferCopy = audioData.buffer.slice(0);

        audioContextRef.current.decodeAudioData(
            arrayBufferCopy,
            (audioBuffer) => {
                const mixedData = mixDownToMono(audioBuffer);

                waveformCacheRef.current = {
                    audioBuffer,
                    mixedData,
                    sampleRate: audioBuffer.sampleRate,
                };

                setIsCacheReady(true);
            },
            (error) => {
                console.error("音频解码失败:", error);
                setIsCacheReady(false);
            },
        );
    }, [audioData]);

    /**
     * 初始化 canvas 物理尺寸
     */
    useEffect(() => {
        if (!canvasRef.current) return;
        canvasRef.current.width = CANVAS_PHYSICAL_WIDTH;
        canvasRef.current.height = CANVAS_HEIGHT;
    }, []);

    /**
     * 幅度倍数变化时，触发缓存更新
     */
    useEffect(() => {
        if (!isCacheReady) return;

        // 检查是否需要重新计算缓存
        if (
            !renderedWaveCacheRef.current ||
            renderedWaveCacheRef.current.amplitudeMultiplier !==
                p.waveState.amplitudeMultiplier
        ) {
            setIsRenderReady(false);
            startWavePointsComputeTask(p.waveState.amplitudeMultiplier);
        }
    }, [isCacheReady, p.waveState.amplitudeMultiplier]);

    /**
     * 时间范围/缓存就绪时实时重绘（仅使用缓存，不涉及计算）
     */
    useEffect(() => {
        if (
            !canvasRef.current ||
            !renderedWaveCacheRef.current?.wavePoints ||
            !waveformCacheRef.current ||
            !isRenderReady
        )
            return;

        const ctx = canvasRef.current.getContext("2d");
        if (!ctx) return;

        renderWaveToCanvas(
            ctx,
            renderedWaveCacheRef.current.wavePoints,
            p.timeRange,
            waveformCacheRef.current.sampleRate,
            waveformCacheRef.current.mixedData.length,
        );
    }, [p.timeRange, isRenderReady]);

    return (
        <div>
            <div className="flex gap-2">
                {!p.waveState.isFolded && (
                    <canvas
                        ref={canvasRef}
                        width={CANVAS_PHYSICAL_WIDTH}
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

export default WaveLane;
