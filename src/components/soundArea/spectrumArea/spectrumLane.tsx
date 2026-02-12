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

        // 颜色 LUT
        const colorLUT: [number, number, number][] = [];
        for (let i = 0; i < 1024; i++) {
            const x = i / 1023;
            const r = Math.floor(255 * Math.max(0, (x - 0.5) * 2));
            const g = Math.floor(255 * Math.max(0, (x - 0.25) * 2));
            const b = Math.floor(255 * (1 - x));
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

        const gamma = 1 - contrast * 0.8;

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

                const val = spectrum[bin] / maxMagnitude;
                const enhanced = Math.pow(val, gamma);

                const lutIndex = Math.floor(enhanced * 1023);

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
