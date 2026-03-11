import { useContext, useEffect, useRef, useState } from "react";
import { AudioDataCtx } from "../../audioContext";
import { SpectrumLaneState } from "@/interface/audioData";

interface _p {
    timeRange: [number, number];
    audioId: string;
    spectrumState: SpectrumLaneState;
    setSpectrumState: (state: SpectrumLaneState) => void;
}

interface SpectrumFrameCache {
    frameData: Float32Array[];
    maxMagnitude: number;
    sampleRate: number;
}

function clamp01(v: number): number {
    return Math.min(1, Math.max(0, v));
}

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

function SpectrumLane(p: _p) {
    const CANVAS_WIDTH = 1200;
    const CANVAS_HEIGHT = 100;
    const WINDOW_SIZE = 1024;
    const HOP_SIZE = 256;

    const audioDataList = useContext(AudioDataCtx);
    const audioData = audioDataList.find((a) => a.id === p.audioId);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const workerRef = useRef<Worker | null>(null);
    const cacheRef = useRef<SpectrumFrameCache | null>(null);
    const [ready, setReady] = useState(false);

    const contrast =
        (p.spectrumState as unknown as { contrast?: number }).contrast ?? 1;

    const logLUTRef = useRef<number[]>([]);
    const colorLUTRef = useRef<[number, number, number][]>([]);

    // ======== 初始化 LUT ========

    useEffect(() => {
        // 频率对数映射 LUT
        const lut: number[] = [];
        const minFreq = 20;
        const maxFreq = 20000;

        for (let y = 0; y < CANVAS_HEIGHT; y++) {
            const norm = y / CANVAS_HEIGHT;
            const freq = minFreq * Math.pow(maxFreq / minFreq, norm);
            lut.push(freq);
        }

        logLUTRef.current = lut;

        // 颜色 LUT（增强亮部和中间层次）
        const colorLUT: [number, number, number][] = [];
        const stops: Array<[number, [number, number, number]]> = [
            [0.0, [0, 0, 0]],
            [0.14, [20, 32, 96]],
            [0.32, [40, 140, 220]],
            [0.52, [90, 230, 150]],
            [0.72, [245, 222, 90]],
            [0.88, [255, 126, 40]],
            [1.0, [255, 245, 220]],
        ];

        for (let i = 0; i < 1024; i++) {
            const x = i / 1023;

            let left = stops[0];
            let right = stops[stops.length - 1];

            for (let j = 0; j < stops.length - 1; j++) {
                if (x >= stops[j][0] && x <= stops[j + 1][0]) {
                    left = stops[j];
                    right = stops[j + 1];
                    break;
                }
            }

            const [lp, lc] = left;
            const [rp, rc] = right;
            const t = rp === lp ? 0 : (x - lp) / (rp - lp);

            const r = Math.floor(lc[0] + (rc[0] - lc[0]) * t);
            const g = Math.floor(lc[1] + (rc[1] - lc[1]) * t);
            const b = Math.floor(lc[2] + (rc[2] - lc[2]) * t);
            colorLUT.push([r, g, b]);
        }
        colorLUTRef.current = colorLUT;
    }, []);

    // ======== 启动 Worker FFT ========

    useEffect(() => {
        if (!audioData?.buffer) return;

        const ctx = new AudioContext();
        ctx.decodeAudioData(audioData.buffer.slice(0), (decoded) => {
            const mono = mixDownToMono(decoded);

            workerRef.current = new Worker(
                new URL("./spectrumWorker.ts", import.meta.url),
            );

            workerRef.current.onmessage = (e) => {
                if (e.data.type === "result") {
                    cacheRef.current = {
                        frameData: e.data.frameData,
                        maxMagnitude: e.data.maxMagnitude,
                        sampleRate: decoded.sampleRate,
                    };
                    setReady(true);
                }
            };

            workerRef.current.postMessage({
                type: "init",
                audio: mono,
                sampleRate: decoded.sampleRate,
                windowSize: WINDOW_SIZE,
                hopSize: HOP_SIZE,
            });
        });
    }, [audioData]);

    // ======== 绘制 ========

    useEffect(() => {
        if (!ready) return;
        if (!canvasRef.current) return;
        if (!cacheRef.current) return;

        const ctx = canvasRef.current.getContext("2d");
        if (!ctx) return;

        const { frameData, maxMagnitude, sampleRate } = cacheRef.current;

        const imageData = ctx.createImageData(CANVAS_WIDTH, CANVAS_HEIGHT);
        const data = imageData.data;

        const [tL, tR] = p.timeRange;
        const startFrame = Math.floor((tL * sampleRate) / HOP_SIZE);
        const endFrame = Math.floor((tR * sampleRate) / HOP_SIZE);
        const frameCount = endFrame - startFrame;

        const safeMaxMagnitude = Math.max(maxMagnitude, 1e-8);
        const minDb = -95;
        const gamma = Math.max(0.35, 1.15 - contrast * 0.6);

        for (let x = 0; x < CANVAS_WIDTH; x++) {
            const frameIdx =
                startFrame + Math.floor((x / CANVAS_WIDTH) * frameCount);

            if (frameIdx >= frameData.length) continue;

            const spectrum = frameData[frameIdx];

            for (let y = 0; y < CANVAS_HEIGHT; y++) {
                const freq = logLUTRef.current[y];
                const bin = Math.floor(
                    (freq / (sampleRate / 2)) * spectrum.length,
                );

                if (bin >= spectrum.length) continue;

                const linear = spectrum[bin] / safeMaxMagnitude;
                const db = 20 * Math.log10(Math.max(linear, 1e-8));
                const normalized = clamp01((db - minDb) / -minDb);
                const smoothed = normalized * normalized * (3 - 2 * normalized);
                const enhanced = Math.pow(smoothed, gamma);
                const lutIndex = Math.max(
                    0,
                    Math.min(1023, Math.floor(enhanced * 1023)),
                );

                const [r, g, b] = colorLUTRef.current[lutIndex];

                const row = CANVAS_HEIGHT - y - 1;
                const idx = (row * CANVAS_WIDTH + x) * 4;

                data[idx] = r;
                data[idx + 1] = g;
                data[idx + 2] = b;
                data[idx + 3] = 255;
            }
        }

        ctx.putImageData(imageData, 0, 0);
    }, [p.timeRange, ready, contrast]);

    return (
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
    );
}

export default SpectrumLane;
