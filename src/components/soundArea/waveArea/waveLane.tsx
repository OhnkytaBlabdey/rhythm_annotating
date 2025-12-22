import { wavelane } from "@/interface/soundLane/waveLane/wavelane";
import React, { useEffect, useRef, useMemo, useState } from "react";
import WaveMenu from "./menuArea/waveMenu";

interface _p {
    timeRange: [number, number];
    mediaFilePath: string;
    waveLane: wavelane;
    setWaveLane: (_: wavelane) => void;
    arrayBuffer?: ArrayBuffer;
}

interface WaveformCache {
    audioBuffer: AudioBuffer;
}

function WaveLane(p: _p) {
    const [t_left, t_right] = p.timeRange;
    const CANVAS_PHYSICAL_WIDTH = 800; // 固定canvas物理宽度
    const CANVAS_HEIGHT = 100;
    const TARGET_PIXELS_PER_SECOND = 1000; // 目标分辨率：每秒1000像素
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const audioBufferRef = useRef<AudioBuffer | null>(null);
    const waveformCacheRef = useRef<WaveformCache | null>(null);
    const [isCacheReady, setIsCacheReady] = useState(false);

    // 根据显示范围从AudioBuffer实时采样并绘制波形
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

        // 清空画布
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);

        const sampleRate = audioBuffer.sampleRate;
        const channelCount = audioBuffer.numberOfChannels;
        let audioData = audioBuffer.getChannelData(0);

        // 混合多通道
        if (channelCount > 1) {
            audioData = new Float32Array(audioBuffer.length);
            for (let c = 0; c < channelCount; c++) {
                const channelData = audioBuffer.getChannelData(c);
                for (let i = 0; i < audioBuffer.length; i++) {
                    audioData[i] += channelData[i];
                }
            }
            for (let i = 0; i < audioData.length; i++) {
                audioData[i] /= channelCount;
            }
        }

        // 计算采样范围
        const startSample = Math.max(0, Math.floor(t_left * sampleRate));
        const endSample = Math.min(
            audioBuffer.length,
            Math.ceil(t_right * sampleRate)
        );
        const rangeLength = endSample - startSample;

        if (rangeLength <= 0) return;

        // 计算每个像素对应的采样数
        const samplesPerPixel = Math.max(1, Math.floor(rangeLength / width));
        const centerY = height / 2;

        // 绘制波形
        ctx.strokeStyle = "#0066cc";
        ctx.lineWidth = 1;
        ctx.beginPath();

        for (let i = 0; i < width; i++) {
            const sampleIndex = startSample + i * samplesPerPixel;
            if (sampleIndex >= endSample) break;

            let minVal = 0;
            let maxVal = 0;

            // 采样范围内的最大/最小值
            for (
                let j = 0;
                j < samplesPerPixel && sampleIndex + j < endSample;
                j++
            ) {
                const sample = audioData[sampleIndex + j];
                minVal = Math.min(minVal, sample);
                maxVal = Math.max(maxVal, sample);
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

        // 绘制中线
        ctx.strokeStyle = "#cccccc";
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        ctx.lineTo(width, centerY);
        ctx.stroke();
    };

    // 解码音频并保存引用
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

        setIsCacheReady(false);
        const arrayBufferCopy = p.arrayBuffer.slice(0);

        audioContextRef.current.decodeAudioData(
            arrayBufferCopy,
            (audioBuffer) => {
                audioBufferRef.current = audioBuffer;
                waveformCacheRef.current = {
                    audioBuffer: audioBuffer,
                };
                setIsCacheReady(true);
            },
            (error) => {
                console.error("音频解码失败:", error);
            }
        );
    }, [p.arrayBuffer]);

    // 初始化canvas物理尺寸（仅执行一次）
    useEffect(() => {
        if (!canvasRef.current) return;
        canvasRef.current.width = CANVAS_PHYSICAL_WIDTH;
        canvasRef.current.height = CANVAS_HEIGHT;
    }, []);

    // 根据时间范围和幅度实时绘制波形
    useEffect(() => {
        if (
            !canvasRef.current ||
            !audioBufferRef.current ||
            !waveformCacheRef.current ||
            !isCacheReady
        )
            return;

        const ctx = canvasRef.current.getContext("2d");
        if (!ctx) return;

        drawWaveform(
            ctx,
            waveformCacheRef.current.audioBuffer,
            p.timeRange,
            p.waveLane.amplitudeMultiplier
        );
    }, [p.timeRange, p.waveLane.amplitudeMultiplier, isCacheReady]);
    function setAmplitudeMultiplier(newampmulti: number) {
        p.setWaveLane({
            ...p.waveLane,
            amplitudeMultiplier: newampmulti,
        });
    }

    return (
        <div>
            <div className="flex gap-2">
                <div className="flex" onClick={(e) => e.stopPropagation()}>
                    <WaveMenu
                        refAmplitudeMultiplier={p.waveLane.amplitudeMultiplier}
                        setAmplitudeMultiplier={setAmplitudeMultiplier}
                    />
                </div>
                <div className="text-sm text-gray-600">
                    WaveLane {t_left.toFixed(4)} - {t_right.toFixed(4)} s
                </div>
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
            </div>
        </div>
    );
}

export default WaveLane;
