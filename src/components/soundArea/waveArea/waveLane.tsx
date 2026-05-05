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
    channelData: Float32Array[];
    sampleRate: number;
    channelCount: number;
    length: number;
}

/**
 * 使用缓存的波形点数据绘制到canvas
 */
function renderWaveToCanvas(
    ctx: CanvasRenderingContext2D,
    channelData: Float32Array[],
    channelCount: number,
    timeRange: [number, number],
    sampleRate: number,
    length: number,
    rowHeight: number,
    amplitudeMultiplier: number,
) {
    const canvas = ctx.canvas;
    const width = canvas.width;
    const height = canvas.height;
    const [t_left, t_right] = timeRange;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    const startSample = Math.max(0, Math.floor(t_left * sampleRate));
    const endSample = Math.min(length, Math.ceil(t_right * sampleRate));
    const rangeLength = endSample - startSample;
    if (rangeLength <= 1) return;
    const step = Math.max(1, Math.floor(rangeLength / width));

    for (let c = 0; c < channelCount; c++) {
        const channel = channelData[c];
        const rowTop = c * rowHeight;
        const centerY = rowTop + rowHeight / 2;
        const scale = (rowHeight / 2) * amplitudeMultiplier;

        ctx.strokeStyle = "#0066cc";
        ctx.lineWidth = 1;
        ctx.beginPath();
        // 降采样优化：每像素只取极值（包络线）
        for (let x = 0; x < width; x++) {
            const sampleStart = startSample + x * step;
            const sampleEnd = Math.min(startSample + (x + 1) * step, endSample);
            let min = 1;
            let max = -1;
            const startIdx = Math.floor(sampleStart);
            const endIdx = Math.floor(sampleEnd);
            for (let idx = startIdx; idx < endIdx; idx++) {
                if (idx < 0 || idx >= channel.length) continue;
                const v = channel[idx];
                if (v < min) min = v;
                if (v > max) max = v;
            }
            if (startIdx >= endIdx) {
                min = 0;
                max = 0;
            }
            const yMax = centerY - max * scale;
            const yMin = centerY - min * scale;
            const xPos = x + 0.5;
            ctx.moveTo(xPos, yMax);
            ctx.lineTo(xPos, yMin);
        }
        ctx.stroke();

        ctx.strokeStyle = "#cccccc";
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        ctx.lineTo(width, centerY);
        ctx.stroke();
    }
}

const WAVELANE_TOTAL_HEIGHT = 110;

function WaveLane(p: _p) {
    const CANVAS_PHYSICAL_WIDTH = 1200;

    const audioDataList = useContext(AudioDataCtx);
    const audioData = audioDataList.find((a) => a.id === p.audioId);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const waveformCacheRef = useRef<WaveformCache | null>(null);
    const [isCacheReady, setIsCacheReady] = useState(false);
    // 波形缓存后无需异步setState，直接重绘即可

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
            const decodedBuffer = audioData.decodedBuffer;
            const channelCount = decodedBuffer.numberOfChannels;
            const channelData = Array.from({ length: channelCount }, (_, i) =>
                decodedBuffer.getChannelData(i).slice(),
            );
            waveformCacheRef.current = {
                audioBuffer: decodedBuffer,
                channelData,
                sampleRate: decodedBuffer.sampleRate,
                channelCount,
                length: decodedBuffer.length,
            };
            Promise.resolve().then(() => setIsCacheReady(true));
            return;
        }

        const arrayBufferCopy = audioData.buffer.slice(0);

        audioContextRef.current.decodeAudioData(
            arrayBufferCopy,
            (audioBuffer) => {
                const channelCount = audioBuffer.numberOfChannels;
                const channelData = Array.from(
                    { length: channelCount },
                    (_, i) => audioBuffer.getChannelData(i).slice(),
                );

                waveformCacheRef.current = {
                    audioBuffer,
                    channelData,
                    sampleRate: audioBuffer.sampleRate,
                    channelCount,
                    length: audioBuffer.length,
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
        if (!waveformCacheRef.current) return;
        canvasRef.current.width = CANVAS_PHYSICAL_WIDTH;
        canvasRef.current.height = WAVELANE_TOTAL_HEIGHT;
    }, [isCacheReady]);

    /**
     * 幅度倍数变化时，触发缓存更新
     */
    useEffect(() => {
        if (!isCacheReady) return;
        // 只要依赖变化就强制重绘
        if (canvasRef.current && waveformCacheRef.current) {
            const ctx = canvasRef.current.getContext("2d");
            if (ctx) {
                renderWaveToCanvas(
                    ctx,
                    waveformCacheRef.current.channelData,
                    waveformCacheRef.current.channelCount,
                    p.timeRange,
                    waveformCacheRef.current.sampleRate,
                    waveformCacheRef.current.length,
                    WAVELANE_TOTAL_HEIGHT /
                        waveformCacheRef.current.channelCount,
                    p.waveState.amplitudeMultiplier,
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
                        height={WAVELANE_TOTAL_HEIGHT}
                        style={{
                            border: "1px solid #ccc",
                            width: "100%",
                            height: `${WAVELANE_TOTAL_HEIGHT}px`,
                        }}
                    />
                )}
            </div>
        </div>
    );
}

export default WaveLane;
