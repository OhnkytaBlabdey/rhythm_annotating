import { useContext, useEffect, useRef, useState } from "react";
import { AudioDataCtx } from "../../audioContext";
import { SpectrumLaneState } from "@/interface/audioData";

const MAX_INTERNAL_CANVAS_WIDTH = 1800;
const MAX_RENDER_HEIGHT = 110;
const MIN_REDRAW_PIXEL_SHIFT = 1;

interface _p {
    timeRange: [number, number];
    audioId: string;
    spectrumState: SpectrumLaneState;
    setSpectrumState: (state: SpectrumLaneState) => void;
}

interface SpectrumFrameCache {
    id: string;
    frameData: Float32Array[];
    maxMagnitude: number;
    sampleRate: number;
    windowSize: number;
    hopSize: number;
    minTimeMs: number;
    minFreqHz: number;
}

interface WorkerLayerProfile {
    id: string;
    windowSize: number;
    hopSize: number;
}

interface ResolutionTargets {
    minTimeMs: number;
    minFreqHz: number;
}

function clamp01(v: number): number {
    return Math.min(1, Math.max(0, v));
}

function clampNumber(v: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, v));
}

function getResolutionTargets(scale: number): ResolutionTargets {
    const normalized = clampNumber(scale, 0.5, 2);
    const t = (normalized - 0.5) / 1.5;

    return {
        minTimeMs: 14 - t * 12,
        minFreqHz: 24 - t * 18,
    };
}

function getSpectrumProfiles(): WorkerLayerProfile[] {
    return [
        { id: "overview", windowSize: 2048, hopSize: 512 },
        { id: "balanced", windowSize: 4096, hopSize: 256 },
        { id: "detail", windowSize: 8192, hopSize: 128 },
        { id: "micro-time", windowSize: 4096, hopSize: 64 },
    ];
}

function chooseLayer(
    layers: SpectrumFrameCache[],
    targets: ResolutionTargets,
    timeRange: [number, number],
    canvasWidth: number,
): SpectrumFrameCache | null {
    if (!layers.length) return null;

    const rangeMs = Math.max(1, (timeRange[1] - timeRange[0]) * 1000);
    const msPerPixel = rangeMs / Math.max(1, canvasWidth);
    const desiredTimeMs = Math.min(
        targets.minTimeMs,
        Math.max(0.6, msPerPixel * 1.5),
    );

    let bestLayer: SpectrumFrameCache | null = null;
    let bestScore = Number.POSITIVE_INFINITY;

    for (const layer of layers) {
        if (!layer.frameData.length) continue;

        const timeScore = Math.abs(Math.log(layer.minTimeMs / desiredTimeMs));
        const freqScore = Math.abs(
            Math.log(layer.minFreqHz / targets.minFreqHz),
        );
        const frameDensity = rangeMs / layer.minTimeMs;
        const sparsePenalty = frameDensity < 32 ? (32 - frameDensity) / 32 : 0;
        const costPenalty = Math.log1p(layer.frameData.length) * 0.015;
        const score =
            timeScore * 1.4 + freqScore + sparsePenalty * 2 + costPenalty;

        if (score < bestScore) {
            bestScore = score;
            bestLayer = layer;
        }
    }

    return bestLayer;
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
    const CANVAS_HEIGHT = 40;

    const audioDataList = useContext(AudioDataCtx);
    const audioData = audioDataList.find((a) => a.id === p.audioId);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const workerRef = useRef<Worker | null>(null);
    const cacheRef = useRef<Record<string, SpectrumFrameCache>>({});
    const [layerVersion, setLayerVersion] = useState(0);
    const [ready, setReady] = useState(false);
    const [workerDone, setWorkerDone] = useState(false);
    const [canvasWidth, setCanvasWidth] = useState(1200);

    const contrast =
        (p.spectrumState as unknown as { contrast?: number }).contrast ?? 1;
    const brightnessOffset = p.spectrumState.brightnessOffset ?? 0;
    const resolutionScale = p.spectrumState.resolutionScale ?? 1;

    const logLUTRef = useRef<number[]>([]);
    const logLUTRangeRef = useRef<{
        minFreq: number;
        maxFreq: number;
        height: number;
    } | null>(null);
    const colorLUTRef = useRef<[number, number, number][]>([]);
    const prevDrawRef = useRef<{
        tL: number;
        tR: number;
        span: number;
        layerId: string;
        canvasWidth: number;
        renderHeight: number;
        contrast: number;
        brightnessOffset: number;
        resolutionScale: number;
    } | null>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const updateCanvasWidth = () => {
            const cssWidth = Math.max(
                320,
                Math.round(canvas.clientWidth || 1200),
            );
            const dpr =
                typeof window === "undefined"
                    ? 1
                    : window.devicePixelRatio || 1;
            const nextWidth = clampNumber(
                Math.round(cssWidth * dpr),
                320,
                MAX_INTERNAL_CANVAS_WIDTH,
            );
            setCanvasWidth((prev) => (prev === nextWidth ? prev : nextWidth));
        };

        updateCanvasWidth();

        if (typeof ResizeObserver !== "undefined") {
            const observer = new ResizeObserver(() => updateCanvasWidth());
            observer.observe(canvas);
            return () => observer.disconnect();
        }

        window.addEventListener("resize", updateCanvasWidth);
        return () => window.removeEventListener("resize", updateCanvasWidth);
    }, []);

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
        if (!audioData?.decodedBuffer) return;

        cacheRef.current = {};
        setLayerVersion(0);
        setReady(false);
        setWorkerDone(false);
        let isCancelled = false;

        const decoded = audioData.decodedBuffer;
        const mono = mixDownToMono(decoded);

        if (workerRef.current) {
            workerRef.current.terminate();
            workerRef.current = null;
        }

        workerRef.current = new Worker(
            new URL("./spectrumWorker.ts", import.meta.url),
        );

        workerRef.current.onmessage = (e) => {
            if (isCancelled) return;
            if (e.data.type === "layer") {
                const layer: SpectrumFrameCache = {
                    id: e.data.layer.id,
                    frameData: e.data.layer.frameData,
                    maxMagnitude: e.data.layer.maxMagnitude,
                    sampleRate: e.data.layer.sampleRate,
                    windowSize: e.data.layer.windowSize,
                    hopSize: e.data.layer.hopSize,
                    minTimeMs: e.data.layer.minTimeMs,
                    minFreqHz: e.data.layer.minFreqHz,
                };

                cacheRef.current[layer.id] = layer;
                setLayerVersion((v) => v + 1);
                setReady(true);
            }
            if (e.data.type === "done") setWorkerDone(true);
        };

        workerRef.current.postMessage({
            type: "init",
            audio: mono,
            sampleRate: decoded.sampleRate,
            profiles: getSpectrumProfiles(),
        });

        return () => {
            isCancelled = true;
            if (workerRef.current) {
                workerRef.current.terminate();
                workerRef.current = null;
            }
        };
    }, [audioData]);

    // ======== 绘制 ========

    useEffect(() => {
        if (!ready) return;
        if (!canvasRef.current) return;
        const layers = Object.values(cacheRef.current);
        if (!layers.length) return;

        const ctx = canvasRef.current.getContext("2d");
        if (!ctx) return;

        const targets = getResolutionTargets(resolutionScale);
        const selectedLayer = chooseLayer(
            layers,
            targets,
            p.timeRange,
            canvasWidth,
        );
        if (!selectedLayer) return;

        const { frameData, maxMagnitude, sampleRate, hopSize, minFreqHz } =
            selectedLayer;
        if (frameData.length === 0) return;
        const nyquist = sampleRate / 2;
        const minFreq = 20;
        const maxFreq = Math.min(20000, nyquist);
        const spectrumLen = frameData[0].length;
        const binsPerPixel = clampNumber(
            targets.minFreqHz / Math.max(minFreqHz, 1e-6),
            1,
            10,
        );
        const desiredHeight = Math.round(spectrumLen / binsPerPixel);
        const renderHeight = clampNumber(desiredHeight, 32, MAX_RENDER_HEIGHT);

        const [tL, tR] = p.timeRange;
        const prevDraw = prevDrawRef.current;
        if (
            prevDraw &&
            prevDraw.layerId === selectedLayer.id &&
            prevDraw.canvasWidth === canvasWidth &&
            prevDraw.renderHeight === renderHeight &&
            prevDraw.contrast === contrast &&
            prevDraw.brightnessOffset === brightnessOffset &&
            prevDraw.resolutionScale === resolutionScale
        ) {
            const prevSpan = Math.max(1e-6, prevDraw.tR - prevDraw.tL);
            const leftPixelShift = Math.abs(
                ((tL - prevDraw.tL) / prevSpan) * canvasWidth,
            );
            const rightPixelShift = Math.abs(
                ((tR - prevDraw.tR) / prevSpan) * canvasWidth,
            );
            const zoomShift = Math.abs(tR - tL - prevDraw.span);

            if (
                leftPixelShift < MIN_REDRAW_PIXEL_SHIFT &&
                rightPixelShift < MIN_REDRAW_PIXEL_SHIFT &&
                zoomShift < 1e-6
            ) {
                return;
            }
        }

        if (canvasRef.current.width !== canvasWidth) {
            canvasRef.current.width = canvasWidth;
        }
        if (canvasRef.current.height !== renderHeight) {
            canvasRef.current.height = renderHeight;
            canvasRef.current.style.height = `${renderHeight}px`;
        }

        const range = logLUTRangeRef.current;
        if (
            logLUTRef.current.length !== renderHeight ||
            !range ||
            range.minFreq !== minFreq ||
            range.maxFreq !== maxFreq ||
            range.height !== renderHeight
        ) {
            logLUTRef.current = Array.from({ length: renderHeight }, (_, y) => {
                const norm = (y + 0.5) / renderHeight;
                return minFreq * Math.pow(maxFreq / minFreq, norm);
            });
            logLUTRangeRef.current = { minFreq, maxFreq, height: renderHeight };
        }

        const imageData = ctx.createImageData(canvasWidth, renderHeight);
        const data = imageData.data;

        const startFrame = Math.floor((tL * sampleRate) / hopSize);
        const endFrame = Math.floor((tR * sampleRate) / hopSize);
        const frameCount = Math.max(1, endFrame - startFrame);

        const safeMaxMagnitude = Math.max(maxMagnitude, 1e-12);
        const minDb = -80;
        const maxDb = 0;
        const gamma = Math.max(0.35, 1.15 - contrast * 0.6);

        for (let x = 0; x < canvasWidth; x++) {
            const framePos =
                startFrame + (x / Math.max(1, canvasWidth - 1)) * frameCount;
            const frameIdx0 = Math.min(
                frameData.length - 1,
                Math.max(0, Math.floor(framePos)),
            );
            const frameIdx1 = Math.min(frameData.length - 1, frameIdx0 + 1);
            const frameAlpha = Math.min(1, Math.max(0, framePos - frameIdx0));

            const spectrum0 = frameData[frameIdx0];
            const spectrum1 = frameData[frameIdx1];
            const spectrumLen = spectrum0.length;

            for (let y = 0; y < renderHeight; y++) {
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

                const row = renderHeight - y - 1;
                const idx = (row * canvasWidth + x) * 4;

                data[idx] = r;
                data[idx + 1] = g;
                data[idx + 2] = b;
                data[idx + 3] = 255;
            }
        }

        ctx.putImageData(imageData, 0, 0);
        prevDrawRef.current = {
            tL,
            tR,
            span: tR - tL,
            layerId: selectedLayer.id,
            canvasWidth,
            renderHeight,
            contrast,
            brightnessOffset,
            resolutionScale,
        };
    }, [
        p.timeRange,
        ready,
        contrast,
        brightnessOffset,
        resolutionScale,
        canvasWidth,
        layerVersion,
    ]);

    return (
        <canvas
            ref={canvasRef}
            width={canvasWidth}
            height={CANVAS_HEIGHT}
            title={
                workerDone || ready
                    ? "Spectrum ready: multi-resolution STFT"
                    : "Computing multi-resolution spectrum"
            }
            style={{
                border: "1px solid #ccc",
                width: "100%",
                height: "auto",
            }}
        />
    );
}

export default SpectrumLane;
