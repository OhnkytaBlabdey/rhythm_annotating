import { useEffect, useRef, useState } from "react";
import { spectrumlane } from "@/interface/soundLane/spectrumLane/spectrumlane";
import SpectrumMenu from "./menuArea/spectrumMenu";

interface _p {
    timeRange: [number, number];
    mediaFilePath: string;
    spectrumLane: spectrumlane;
    setSpectrumLane: (_: spectrumlane) => void;
    arrayBuffer?: ArrayBuffer;
}

interface SpectrumCache {
    mixedData: Float32Array;
    sampleRate: number;
}

/**
 * 多通道混合为单通道（初始化一次）
 */
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

/**
 * FFT 幅度谱（实数输入）
 */
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
    for (let i = 0; i < mag.length; i++) {
        mag[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i]);
    }
    return mag;
}

/**
 * Hann 窗
 */
function applyHannWindow(buf: Float32Array): void {
    const N = buf.length;
    for (let i = 0; i < N; i++) {
        buf[i] *= 0.5 * (1 - Math.cos((2 * Math.PI * i) / (N - 1)));
    }
}

/**
 * 幅度转 dB
 */
function magnitudeToDb(mag: number): number {
    const eps = 1e-10;
    return 20 * Math.log10(Math.max(mag, eps));
}

/**
 * dB → 颜色映射（固定动态范围）
 */
function dbToColor(db: number): string {
    const minDb = -80;
    const maxDb = 0;

    const x = Math.min(1, Math.max(0, (db - minDb) / (maxDb - minDb)));

    const r = Math.floor(255 * Math.min(1, Math.max(0, (x - 0.5) * 2)));
    const g = Math.floor(255 * Math.min(1, Math.max(0, (x - 0.25) * 2)));
    const b = Math.floor(255 * (1 - x));

    return `rgb(${r},${g},${b})`;
}

function SpectrumLane(p: _p) {
    const CANVAS_WIDTH = 800;
    const CANVAS_HEIGHT = 100;

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const cacheRef = useRef<SpectrumCache | null>(null);
    const [ready, setReady] = useState(false);

    /**
     * 初始化音频缓存
     */
    useEffect(() => {
        if (!p.arrayBuffer) return;

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

        audioContextRef.current.decodeAudioData(
            p.arrayBuffer.slice(0),
            (audioBuffer) => {
                cacheRef.current = {
                    mixedData: mixDownToMono(audioBuffer),
                    sampleRate: audioBuffer.sampleRate,
                };
                setReady(true);
            },
            (err) => {
                console.error("音频解码失败:", err);
                setReady(false);
            }
        );
    }, [p.arrayBuffer]);

    /**
     * 初始化 canvas 尺寸
     */
    useEffect(() => {
        if (!canvasRef.current) return;
        canvasRef.current.width = CANVAS_WIDTH;
        canvasRef.current.height = CANVAS_HEIGHT;
    }, []);

    /**
     * 绘制指定时间范围的频谱热图（Spectrogram）
     */
    useEffect(() => {
        if (!ready || !cacheRef.current || !canvasRef.current) return;

        const ctx = canvasRef.current.getContext("2d");
        if (!ctx) return;

        const { mixedData, sampleRate } = cacheRef.current;
        const [tL, tR] = p.timeRange;

        const startSample = Math.max(0, Math.floor(tL * sampleRate));
        const endSample = Math.min(
            mixedData.length,
            Math.floor(tR * sampleRate)
        );

        const windowSize = 1024;
        const hopSize = 256;

        const frameCount = Math.floor(
            (endSample - startSample - windowSize) / hopSize
        );
        if (frameCount <= 0) return;

        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        const binCount = windowSize / 2;
        const pxPerFrame = CANVAS_WIDTH / frameCount;
        const pxPerBin = CANVAS_HEIGHT / binCount;

        for (let t = 0; t < frameCount; t++) {
            const frameStart = startSample + t * hopSize;
            const segment = mixedData.slice(
                frameStart,
                frameStart + windowSize
            );

            applyHannWindow(segment);

            const spectrum = fftMagnitude(segment);

            for (let f = 0; f < spectrum.length; f++) {
                const db = magnitudeToDb(spectrum[f]);
                ctx.fillStyle = dbToColor(db);

                const x = t * pxPerFrame;
                const y = CANVAS_HEIGHT - (f + 1) * pxPerBin;

                ctx.fillRect(x, y, pxPerFrame + 1, pxPerBin + 1);
            }
        }
    }, [p.timeRange, ready]);

    return (
        <div>
            <div className="flex gap-2">
                {/* <div className="flex" onClick={(e) => e.stopPropagation()}>
                    <SpectrumMenu />
                </div> */}
                {/* <div className="text-sm text-gray-600">
                    Spectrogram {p.timeRange[0].toFixed(4)} –{" "}
                    {p.timeRange[1].toFixed(4)} s
                </div> */}
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
        </div>
    );
}

export default SpectrumLane;
