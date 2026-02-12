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
    frameData: Array<Float32Array>;
    maxMagnitude: number;
    windowSize: number;
    hopSize: number;
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
    const norm = (2 / N) * 1.5;

    for (let i = 0; i < mag.length; i++) {
        mag[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i]) * norm;
    }

    return mag;
}

function applyHannWindow(buf: Float32Array): void {
    const N = buf.length;
    for (let i = 0; i < N; i++) {
        buf[i] *= 0.5 * (1 - Math.cos((2 * Math.PI * i) / (N - 1)));
    }
}

function magnitudeToDb(mag: number): number {
    return 20 * Math.log10(Math.max(mag, 1e-10));
}

function dbToRGB(db: number): [number, number, number] {
    const minDb = -100;
    const maxDb = 0;

    const x = Math.min(1, Math.max(0, (db - minDb) / (maxDb - minDb)));

    const r = Math.floor(255 * Math.min(1, Math.max(0, (x - 0.5) * 2)));
    const g = Math.floor(255 * Math.min(1, Math.max(0, (x - 0.25) * 2)));
    const b = Math.floor(255 * (1 - x));

    return [r, g, b];
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
    const [ready, setReady] = useState(false);

    const contrast =
        (p.spectrumState as unknown as { contrast?: number }).contrast ?? 0.2;

    function drawSpectrum() {
        if (!canvasRef.current) return;
        const cache = spectrumFrameCacheRef.current;
        if (!cache) return;

        const ctx = canvasRef.current.getContext("2d");
        if (!ctx) return;

        const { frameData, maxMagnitude, hopSize, sampleRate } = cache;
        if (frameData.length === 0) return;

        const [tL, tR] = p.timeRange;

        const startSample = Math.max(0, Math.floor(tL * sampleRate));
        const endSample = Math.min(
            sampleRate * (tR - tL) + startSample,
            frameData.length * hopSize,
        );

        const startFrameIdx = Math.floor(startSample / hopSize);
        const endFrameIdx = Math.ceil(endSample / hopSize);
        const displayFrameCount = endFrameIdx - startFrameIdx;
        if (displayFrameCount <= 0) return;

        const binCount = frameData[0].length;
        const gamma = 1 - contrast * 0.8;

        const imageData = ctx.createImageData(CANVAS_WIDTH, CANVAS_HEIGHT);
        const data = imageData.data;

        for (let x = 0; x < CANVAS_WIDTH; x++) {
            let frameStart: number;
            let frameEnd: number;

            if (displayFrameCount <= CANVAS_WIDTH) {
                // 放大模式（保证铺满）
                const ratio = displayFrameCount / CANVAS_WIDTH;
                frameStart = Math.floor(startFrameIdx + x * ratio);
                frameEnd = frameStart + 1;
            } else {
                // 下采样模式
                const framesPerPixel = displayFrameCount / CANVAS_WIDTH;
                frameStart = Math.floor(startFrameIdx + x * framesPerPixel);
                frameEnd = Math.floor(frameStart + framesPerPixel);
            }

            for (let y = 0; y < CANVAS_HEIGHT; y++) {
                const binIdx = Math.floor((y / CANVAS_HEIGHT) * binCount);

                let maxVal = 0;

                for (let f = frameStart; f < frameEnd; f++) {
                    if (f >= frameData.length) break;
                    const spectrum = frameData[f];
                    const val = spectrum[binIdx];
                    if (val > maxVal) maxVal = val;
                }

                const normalized = maxVal / maxMagnitude;
                const enhanced = Math.pow(normalized, gamma);
                const db = magnitudeToDb(enhanced);
                const [r, g, b] = dbToRGB(db);

                const row = CANVAS_HEIGHT - y - 1;
                const idx = (row * CANVAS_WIDTH + x) * 4;

                data[idx] = r;
                data[idx + 1] = g;
                data[idx + 2] = b;
                data[idx + 3] = 255;
            }
        }

        ctx.putImageData(imageData, 0, 0);
    }

    useEffect(() => {
        if (!audioData?.buffer) return;

        if (!audioContextRef.current) {
            audioContextRef.current = new AudioContext();
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
        );
    }, [audioData]);

    useEffect(() => {
        if (!ready || spectrumFrameCacheRef.current) return;
        if (!cacheRef.current) return;

        const { mixedData, sampleRate } = cacheRef.current;

        const totalFrames = Math.floor(
            (mixedData.length - WINDOW_SIZE) / HOP_SIZE,
        );

        const frameData: Float32Array[] = [];
        let maxMagnitude = 0;

        for (let t = 0; t < totalFrames; t++) {
            const start = t * HOP_SIZE;
            const segment = mixedData.slice(start, start + WINDOW_SIZE);
            applyHannWindow(segment);
            const spectrum = fftMagnitude(segment);
            frameData.push(spectrum);

            for (let i = 0; i < spectrum.length; i++) {
                if (spectrum[i] > maxMagnitude) maxMagnitude = spectrum[i];
            }
        }

        spectrumFrameCacheRef.current = {
            frameData,
            maxMagnitude: Math.max(maxMagnitude, 1),
            windowSize: WINDOW_SIZE,
            hopSize: HOP_SIZE,
            sampleRate,
        };

        drawSpectrum();
    }, [ready]);

    useEffect(() => {
        drawSpectrum();
    }, [p.timeRange, contrast]);

    return (
        <div>
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
        </div>
    );
}

export default SpectrumLane;
