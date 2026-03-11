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
    const WINDOW_SIZE = 4096;
    const HOP_SIZE = Math.floor(WINDOW_SIZE * 0.25);

    const audioDataList = useContext(AudioDataCtx);
    const audioData = audioDataList.find((a) => a.id === p.audioId);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const workerRef = useRef<Worker | null>(null);
    const cacheRef = useRef<SpectrumFrameCache | null>(null);
    const [ready, setReady] = useState(false);

    const contrast =
        (p.spectrumState as unknown as { contrast?: number }).contrast ?? 1;
    const brightnessOffset = p.spectrumState.brightnessOffset ?? 0;

    const logLUTRef = useRef<number[]>([]);
    const logLUTRangeRef = useRef<{ minFreq: number; maxFreq: number } | null>(
        null,
    );
    const colorLUTRef = useRef<[number, number, number][]>([]);

    // ======== 初始化 LUT ========

    useEffect(() => {
        // 颜色 LUT（Inferno 高对比热力图）
        const colorLUT: [number, number, number][] = [];
        const stops: Array<[number, [number, number, number]]> = [
            [0.0, [0, 0, 4]],
            [0.13, [31, 12, 72]],
            [0.25, [85, 15, 109]],
            [0.38, [136, 34, 106]],
            [0.5, [186, 54, 85]],
            [0.63, [227, 89, 51]],
            [0.75, [249, 140, 10]],
            [0.88, [252, 195, 64]],
            [1.0, [252, 255, 164]],
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
        if (frameData.length === 0) return;
        const nyquist = sampleRate / 2;
        const minFreq = 20;
        const maxFreq = Math.min(20000, nyquist);

        const range = logLUTRangeRef.current;
        if (
            logLUTRef.current.length !== CANVAS_HEIGHT ||
            !range ||
            range.minFreq !== minFreq ||
            range.maxFreq !== maxFreq
        ) {
            logLUTRef.current = Array.from(
                { length: CANVAS_HEIGHT },
                (_, y) => {
                    const norm = y / (CANVAS_HEIGHT - 1);
                    return minFreq * Math.pow(maxFreq / minFreq, norm);
                },
            );
            logLUTRangeRef.current = { minFreq, maxFreq };
        }

        const imageData = ctx.createImageData(CANVAS_WIDTH, CANVAS_HEIGHT);
        const data = imageData.data;

        const [tL, tR] = p.timeRange;
        const startFrame = Math.floor((tL * sampleRate) / HOP_SIZE);
        const endFrame = Math.floor((tR * sampleRate) / HOP_SIZE);
        const frameCount = Math.max(1, endFrame - startFrame);

        const safeMaxMagnitude = Math.max(maxMagnitude, 1e-12);
        const minDb = -80;
        const maxDb = 0;
        const gamma = Math.max(0.35, 1.15 - contrast * 0.6);

        for (let x = 0; x < CANVAS_WIDTH; x++) {
            const framePos =
                startFrame + (x / Math.max(1, CANVAS_WIDTH - 1)) * frameCount;
            const frameIdx0 = Math.min(
                frameData.length - 1,
                Math.max(0, Math.floor(framePos)),
            );
            const frameIdx1 = Math.min(frameData.length - 1, frameIdx0 + 1);
            const frameAlpha = Math.min(1, Math.max(0, framePos - frameIdx0));

            const spectrum0 = frameData[frameIdx0];
            const spectrum1 = frameData[frameIdx1];
            const spectrumLen = spectrum0.length;

            for (let y = 0; y < CANVAS_HEIGHT; y++) {
                const freq = logLUTRef.current[y];
                const binPos = Math.min(
                    spectrumLen - 1,
                    Math.max(0, (freq / nyquist) * (spectrumLen - 1)),
                );
                const bin0 = Math.floor(binPos);
                const bin1 = Math.min(spectrumLen - 1, bin0 + 1);
                const binAlpha = binPos - bin0;

                const mag0 =
                    spectrum0[bin0] +
                    (spectrum0[bin1] - spectrum0[bin0]) * binAlpha;
                const mag1 =
                    spectrum1[bin0] +
                    (spectrum1[bin1] - spectrum1[bin0]) * binAlpha;
                const magnitude = mag0 + (mag1 - mag0) * frameAlpha;
                const db =
                    20 *
                    Math.log10(Math.max(magnitude / safeMaxMagnitude, 1e-12));
                const displayedDb = db + brightnessOffset;
                const clamped = Math.max(minDb, Math.min(maxDb, displayedDb));
                const normalized = clamp01((clamped - minDb) / (maxDb - minDb));
                const enhanced = Math.pow(normalized, gamma);
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
    }, [p.timeRange, ready, contrast, brightnessOffset]);

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
