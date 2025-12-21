import { wavelane } from "@/interface/soundLane/waveLane/wavelane";
import React, { useEffect, useRef } from "react";
import WaveMenu from "./menuArea/waveMenu";

interface _p {
    timeRange: [number, number];
    mediaFilePath: string;
    waveLane: wavelane;
    arrayBuffer?: ArrayBuffer;
}
//TODO 如果新的更新事件来了，丢弃未算完的，直接更新到最新
function WaveLane(p: _p) {
    const [t_left, t_right] = p.timeRange;
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const audioBufferRef = useRef<AudioBuffer | null>(null);

    const drawWaveform = (
        ctx: CanvasRenderingContext2D,
        audioBuffer: AudioBuffer,
        timeRange: [number, number],
        amplitudeMultiplier: number
    ) => {
        const canvas = ctx.canvas;
        const width = canvas.width;
        const height = canvas.height;
        const [t_left, t_right] = timeRange;
        const sampleRate = audioBuffer.sampleRate;

        // 清空画布
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);

        // 获取单声道数据（如果是立体声，混合左右声道）
        const channelCount = audioBuffer.numberOfChannels;
        let audioData = audioBuffer.getChannelData(0);

        if (channelCount > 1) {
            // 如果是立体声，混合所有声道
            audioData = new Float32Array(audioBuffer.length);
            for (let c = 0; c < channelCount; c++) {
                const channelData = audioBuffer.getChannelData(c);
                for (let i = 0; i < audioBuffer.length; i++) {
                    audioData[i] += channelData[i];
                }
            }
            // 归一化
            for (let i = 0; i < audioData.length; i++) {
                audioData[i] /= channelCount;
            }
        }

        // 计算起始和结束样本索引
        const startSample = Math.max(0, Math.floor(t_left * sampleRate));
        const endSample = Math.min(
            audioBuffer.length,
            Math.floor(t_right * sampleRate)
        );
        const totalSamples = endSample - startSample;

        if (totalSamples <= 0) return;

        // 绘制波形
        ctx.strokeStyle = "#0066cc";
        ctx.lineWidth = 1;
        ctx.beginPath();

        const centerY = height / 2;

        // 为了性能，可能需要跳过一些样本进行绘制
        const samplesPerPixel = Math.max(1, Math.floor(totalSamples / width));

        for (let i = 0; i < width; i++) {
            const sampleIndex = startSample + i * samplesPerPixel;

            if (sampleIndex >= audioBuffer.length) break;

            // 计算该像素对应的最大和最小幅度
            let minVal = 0;
            let maxVal = 0;

            for (
                let j = 0;
                j < samplesPerPixel && sampleIndex + j < endSample;
                j++
            ) {
                const sample = audioData[sampleIndex + j];
                minVal = Math.min(minVal, sample);
                maxVal = Math.max(maxVal, sample);
            }

            // 应用幅度系数
            minVal *= amplitudeMultiplier;
            maxVal *= amplitudeMultiplier;

            // 绘制垂直线
            const y1 = centerY - maxVal * (height / 2);
            const y2 = centerY - minVal * (height / 2);

            if (i === 0) {
                ctx.moveTo(i, y1);
            } else {
                ctx.lineTo(i, y1);
                ctx.lineTo(i, y2);
            }
        }

        ctx.stroke();

        // 绘制中线
        ctx.strokeStyle = "#cccccc";
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        ctx.lineTo(width, centerY);
        ctx.stroke();
    };

    // 解码音频
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

        // Clone the ArrayBuffer to avoid detached buffer issues
        const arrayBufferCopy = p.arrayBuffer.slice(0);

        audioContextRef.current.decodeAudioData(
            arrayBufferCopy,
            (audioBuffer) => {
                audioBufferRef.current = audioBuffer;
                // 解码完成后立即绘制
                if (canvasRef.current) {
                    const ctx = canvasRef.current.getContext("2d");
                    if (ctx) {
                        drawWaveform(
                            ctx,
                            audioBuffer,
                            p.timeRange,
                            p.waveLane.amplitudeMultiplier
                        );
                    }
                }
            },
            (error) => {
                console.error("音频解码失败:", error);
            }
        );
    }, [p.arrayBuffer, p.timeRange, p.waveLane.amplitudeMultiplier]);

    // 当时间范围或幅度改变时重新绘制
    const amplitudeMultiplier = p.waveLane.amplitudeMultiplier;

    useEffect(() => {
        if (!canvasRef.current || !audioBufferRef.current) return;

        const ctx = canvasRef.current.getContext("2d");
        if (!ctx) return;

        drawWaveform(
            ctx,
            audioBufferRef.current,
            p.timeRange,
            amplitudeMultiplier
        );
    }, [p.timeRange, amplitudeMultiplier]);

    return (
        <div>
            <div className="flex gap-2">
                <WaveMenu />
                <div className="text-sm text-gray-600">
                    WaveLane {t_left.toFixed(4)} - {t_right.toFixed(4)} s
                </div>
                <canvas
                    ref={canvasRef}
                    width={800}
                    height={100}
                    style={{
                        border: "1px solid #ccc",
                        width: "100%",
                        height: "auto",
                    }}
                />
            </div>
        </div>
    );
}

export default WaveLane;
