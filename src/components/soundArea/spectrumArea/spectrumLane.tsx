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
    const eps = 1e-10;
    return 20 * Math.log10(Math.max(mag, eps));
}

function dbToColor(db: number): string {
    const minDb = -100;
    const maxDb = 0;

    const x = Math.min(1, Math.max(0, (db - minDb) / (maxDb - minDb)));

    const r = Math.floor(255 * Math.min(1, Math.max(0, (x - 0.5) * 2)));
    const g = Math.floor(255 * Math.min(1, Math.max(0, (x - 0.25) * 2)));
    const b = Math.floor(255 * (1 - x));

    return `rgb(${r},${g},${b})`;
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

        const allFrameData = cache.frameData;
        const maxMagnitude = cache.maxMagnitude;
        const hopSize = cache.hopSize;
        const sampleRate = cache.sampleRate;

        if (allFrameData.length === 0) return;

        const [tL, tR] = p.timeRange;

        const startSample = Math.max(0, Math.floor(tL * sampleRate));
        const endSample = Math.min(
            sampleRate * (tR - tL) + startSample,
            allFrameData.length * hopSize,
        );

        const startFrameIdx = Math.max(0, Math.floor(startSample / hopSize));
        const endFrameIdx = Math.min(
            allFrameData.length,
            Math.ceil(endSample / hopSize),
        );

        const displayFrameCount = endFrameIdx - startFrameIdx;
        if (displayFrameCount <= 0) return;

        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        const binCount = allFrameData[0].length;

        const frameStep = Math.max(
            1,
            Math.floor(displayFrameCount / CANVAS_WIDTH),
        );

        const binStep = Math.max(1, Math.floor(binCount / CANVAS_HEIGHT));

        const gamma = 1 - contrast * 0.8;

        for (let x = 0; x < CANVAS_WIDTH; x++) {
            const frameIdx = startFrameIdx + x * frameStep;
            if (frameIdx >= endFrameIdx) break;

            for (let y = 0; y < CANVAS_HEIGHT; y++) {
                const binIdx = y * binStep;
                if (binIdx >= binCount) break;

                let maxVal = 0;

                for (let fi = 0; fi < frameStep; fi++) {
                    const fIdx = frameIdx + fi;
                    if (fIdx >= endFrameIdx) break;

                    const spectrum = allFrameData[fIdx];
                    for (let bi = 0; bi < binStep; bi++) {
                        const bIdx = binIdx + bi;
                        if (bIdx >= binCount) break;
                        const val = spectrum[bIdx];
                        if (val > maxVal) maxVal = val;
                    }
                }

                const normalized = maxVal / maxMagnitude;
                const enhanced = Math.pow(normalized, gamma);
                const db = magnitudeToDb(enhanced);
                ctx.fillStyle = dbToColor(db);

                ctx.fillRect(x, CANVAS_HEIGHT - y - 1, 1, 1);
            }
        }
    }

    useEffect(() => {
        if (p.spectrumState.isFolded) return;
        if (!audioData?.buffer) return;

        if (!audioContextRef.current) {
            const Ctor =
                window.AudioContext ||
                (
                    window as unknown as {
                        webkitAudioContext: typeof AudioContext;
                    }
                ).webkitAudioContext;
            audioContextRef.current = new Ctor();
        }

        if (audioData.decodedBuffer) {
            cacheRef.current = {
                mixedData: mixDownToMono(audioData.decodedBuffer),
                sampleRate: audioData.decodedBuffer.sampleRate,
            };
            setReady(true);
            return;
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
            () => {
                setReady(false);
            },
        );
    }, [audioData, p.spectrumState.isFolded]);

    useEffect(() => {
        if (!ready || spectrumFrameCacheRef.current) return;
        if (!cacheRef.current) return;

        const { mixedData, sampleRate } = cacheRef.current;

        const totalFrames = Math.max(
            1,
            Math.floor((mixedData.length - WINDOW_SIZE) / HOP_SIZE) + 1,
        );

        const frameData: Array<Float32Array> = new Array(totalFrames);
        let maxMagnitude = 0;

        for (let t = 0; t < totalFrames; t++) {
            const frameStart = t * HOP_SIZE;
            if (frameStart + WINDOW_SIZE > mixedData.length) break;

            const segment = mixedData.slice(
                frameStart,
                frameStart + WINDOW_SIZE,
            );

            applyHannWindow(segment);
            const spectrum = fftMagnitude(segment);
            frameData[t] = spectrum;

            for (let f = 0; f < spectrum.length; f++) {
                if (spectrum[f] > maxMagnitude) maxMagnitude = spectrum[f];
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
        if (p.spectrumState.isFolded) return;
        drawSpectrum();
    }, [p.timeRange, ready, p.spectrumState.isFolded, contrast]);

    return (
        <div>
            {!p.spectrumState.isFolded && (
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
            )}
        </div>
    );
}

export default SpectrumLane;
