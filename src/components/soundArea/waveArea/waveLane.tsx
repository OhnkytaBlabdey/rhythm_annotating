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
    fullWavePoints: Array<{ y: number }>;
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
 * 计算全分辨率波形点（每采样点一个y值，缩放/移动时仅重绘）
 */
function computeFullWavePoints(
    mixedData: Float32Array,
    canvasHeight: number,
    amplitudeMultiplier: number,
): { y: number }[] {
    const centerY = canvasHeight / 2;
    const scale = (canvasHeight / 2) * amplitudeMultiplier;
    return Array.from(mixedData, (v) => ({ y: centerY - v * scale }));
}

/**
 * 使用缓存的波形点数据绘制到canvas
 */
function renderWaveToCanvas(
    ctx: CanvasRenderingContext2D,
    fullWavePoints: { y: number }[],
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
    if (rangeLength <= 1) return;

    ctx.strokeStyle = "#0066cc";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let canvasI = 0; canvasI < width; canvasI++) {
        // 计算canvas像素对应的采样点
        const samplePos = startSample + (canvasI / width) * rangeLength;
        const idx = Math.floor(samplePos);
        if (idx < 0 || idx >= fullWavePoints.length) continue;
        const y = fullWavePoints[idx].y;
        if (canvasI === 0) {
            ctx.moveTo(canvasI, y);
        } else {
            ctx.lineTo(canvasI, y);
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
    // 已不再需要 updateTaskRef
    const [isCacheReady, setIsCacheReady] = useState(false);
    // 波形缓存后无需异步setState，直接重绘即可

    /**
     * 只在amplitudeMultiplier变化时重算全分辨率波形，缩放/移动仅重绘
     */
    const updateFullWaveCache = (amplitudeMultiplier: number) => {
        if (!waveformCacheRef.current) return;
        const { mixedData } = waveformCacheRef.current;
        renderedWaveCacheRef.current = {
            amplitudeMultiplier,
            fullWavePoints: computeFullWavePoints(
                mixedData,
                CANVAS_HEIGHT,
                amplitudeMultiplier,
            ),
        };
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
            Promise.resolve().then(() => setIsCacheReady(true));
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
        if (
            !renderedWaveCacheRef.current ||
            renderedWaveCacheRef.current.amplitudeMultiplier !==
                p.waveState.amplitudeMultiplier
        ) {
            updateFullWaveCache(p.waveState.amplitudeMultiplier);
        }
        // 只要依赖变化就强制重绘
        if (
            canvasRef.current &&
            renderedWaveCacheRef.current?.fullWavePoints &&
            waveformCacheRef.current
        ) {
            const ctx = canvasRef.current.getContext("2d");
            if (ctx) {
                renderWaveToCanvas(
                    ctx,
                    renderedWaveCacheRef.current.fullWavePoints,
                    p.timeRange,
                    waveformCacheRef.current.sampleRate,
                    waveformCacheRef.current.mixedData.length,
                );
            }
        }
    }, [isCacheReady, p.waveState.amplitudeMultiplier, p.timeRange]);

    /**
     * 时间范围/缓存就绪时实时重绘（仅使用缓存，不涉及计算）
     */
    // 移除冗余的 isRenderReady 相关 effect

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
