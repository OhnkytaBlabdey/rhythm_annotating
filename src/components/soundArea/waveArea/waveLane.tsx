import { wavelane } from "@/interface/soundLane/waveLane/wavelane";
import { useEffect, useRef, useState } from "react";

interface _p {
    timeRange: [number, number];
    mediaFilePath: string;
    waveLane: wavelane;
    setWaveLane: (_: wavelane) => void;
    arrayBuffer?: ArrayBuffer;
}

interface WaveformCache {
    audioBuffer: AudioBuffer;
    mixedData: Float32Array; // 已混合的单通道数据
    sampleRate: number;
}

/**
 * 多通道混合为单通道（初始化阶段一次性执行）
 */
function mixDownToMono(audioBuffer: AudioBuffer): Float32Array {
    const channelCount = audioBuffer.numberOfChannels;
    const length = audioBuffer.length;

    if (channelCount === 1) {
        // 拷贝，避免直接引用 AudioBuffer 内部数据
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

function WaveLane(p: _p) {
    const [t_left, t_right] = p.timeRange;
    const CANVAS_PHYSICAL_WIDTH = 800;
    const CANVAS_HEIGHT = 100;

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const waveformCacheRef = useRef<WaveformCache | null>(null);
    const [isCacheReady, setIsCacheReady] = useState(false);

    /**
     * 使用缓存的单通道数据实时绘制波形
     */
    const drawWaveform = (
        ctx: CanvasRenderingContext2D,
        mixedData: Float32Array,
        sampleRate: number,
        timeRange: [number, number],
        amplitudeMultiplier: number
    ) => {
        const canvas = ctx.canvas;
        const width = canvas.width;
        const height = canvas.height;
        const [t_left, t_right] = timeRange;

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);

        const startSample = Math.max(0, Math.floor(t_left * sampleRate));
        const endSample = Math.min(
            mixedData.length,
            Math.ceil(t_right * sampleRate)
        );

        const rangeLength = endSample - startSample;
        if (rangeLength <= 0) return;

        const samplesPerPixel = Math.max(1, Math.floor(rangeLength / width));
        const centerY = height / 2;

        ctx.strokeStyle = "#0066cc";
        ctx.lineWidth = 1;
        ctx.beginPath();

        for (let i = 0; i < width; i++) {
            const sampleIndex = startSample + i * samplesPerPixel;
            if (sampleIndex >= endSample) break;

            let minVal = 0;
            let maxVal = 0;

            for (
                let j = 0;
                j < samplesPerPixel && sampleIndex + j < endSample;
                j++
            ) {
                const v = mixedData[sampleIndex + j];
                if (v < minVal) minVal = v;
                if (v > maxVal) maxVal = v;
            }

            const y1 = centerY - maxVal * (height / 2) * amplitudeMultiplier;
            const y2 = centerY - minVal * (height / 2) * amplitudeMultiplier;

            if (i === 0) {
                ctx.moveTo(i, y1);
            } else {
                ctx.lineTo(i, y1);
                ctx.lineTo(i, y2);
            }
        }

        ctx.stroke();

        ctx.strokeStyle = "#cccccc";
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        ctx.lineTo(width, centerY);
        ctx.stroke();
    };

    /**
     * 解码音频并初始化缓存（只做一次重计算）
     */
    useEffect(() => {
        if (!p.arrayBuffer) return;

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

        const arrayBufferCopy = p.arrayBuffer.slice(0);

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
            }
        );
    }, [p.arrayBuffer]);

    /**
     * 初始化 canvas 物理尺寸
     */
    useEffect(() => {
        if (!canvasRef.current) return;
        canvasRef.current.width = CANVAS_PHYSICAL_WIDTH;
        canvasRef.current.height = CANVAS_HEIGHT;
    }, []);

    /**
     * 时间范围 / 幅度变化时实时重绘
     */
    useEffect(() => {
        if (!canvasRef.current || !waveformCacheRef.current || !isCacheReady)
            return;

        const ctx = canvasRef.current.getContext("2d");
        if (!ctx) return;

        drawWaveform(
            ctx,
            waveformCacheRef.current.mixedData,
            waveformCacheRef.current.sampleRate,
            p.timeRange,
            p.waveLane.amplitudeMultiplier
        );
    }, [p.timeRange, p.waveLane.amplitudeMultiplier, isCacheReady]);

    return (
        <div>
            <div className="flex gap-2">
                {!p.waveLane.isFolded && (
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
