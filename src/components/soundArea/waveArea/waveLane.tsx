import { useContext, useEffect, useRef, useState } from "react";
import { AudioDataCtx } from "../../audioContext";
import { WaveLaneState } from "@/interface/audioData";
import {
    projectTimelinePoint,
    type TimelineOrientation,
} from "../../timelineGeometry";

interface _p {
    timeRange: [number, number];
    audioId: string;
    waveState: WaveLaneState;
    setWaveState: (state: WaveLaneState) => void;
    cursorTime?: number | null;
    playheadTime?: number | null;
    isPlaybackFrozen?: boolean;
    orientation?: TimelineOrientation;
    timelineHeight?: number;
}

interface WaveformCache {
    audioBuffer: AudioBuffer;
    channelData: Float32Array[];
    sampleRate: number;
    channelCount: number;
    length: number;
}

/**
 * 使用缓存的波形点数据绘制到canvas
 */
function renderWaveToCanvas(
    ctx: CanvasRenderingContext2D,
    channelData: Float32Array[],
    channelCount: number,
    timeRange: [number, number],
    sampleRate: number,
    length: number,
    rowHeight: number,
    amplitudeMultiplier: number,
    offset: number,
    orientation: TimelineOrientation,
) {
    const canvas = ctx.canvas;
    const width = canvas.width;
    const height = canvas.height;
    const timeExtent = orientation === "vertical" ? height : width;
    const [t_left, t_right] = timeRange;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    const dt = (t_right - t_left) / Math.max(1, timeExtent);

    for (let c = 0; c < channelCount; c++) {
        const channel = channelData[c];
        const rowTop = c * rowHeight;
        const centerY = rowTop + rowHeight / 2;
        const scale = (rowHeight / 2) * amplitudeMultiplier;

        ctx.strokeStyle = "#0066cc";
        ctx.lineWidth = 1;
        ctx.beginPath();
        // 降采样优化：每像素只取极值（包络线）
        for (let x = 0; x < timeExtent; x++) {
            const t =
                t_left +
                (x / Math.max(1, timeExtent - 1)) * (t_right - t_left);
            const sampleTime = t - offset;
            const sStart = Math.floor(sampleTime * sampleRate);
            const sEnd = Math.floor((sampleTime + dt) * sampleRate);

            if (sEnd < 0 || sStart >= length) {
                // Outside audio bounds — draw silence
                const zeroY = centerY - 0 * scale;
                const xPos = x + 0.5;
                const point = projectTimelinePoint(
                    xPos,
                    zeroY,
                    timeExtent,
                    orientation,
                );
                ctx.moveTo(...point);
                ctx.lineTo(...point);
                continue;
            }

            const s0 = Math.max(0, sStart);
            const s1 = Math.min(length, sEnd);
            let min = 1;
            let max = -1;
            for (let idx = s0; idx < s1; idx++) {
                const v = channel[idx];
                if (v < min) min = v;
                if (v > max) max = v;
            }
            if (s0 >= s1) {
                min = 0;
                max = 0;
            }
            const yMax = centerY - max * scale;
            const yMin = centerY - min * scale;
            const xPos = x + 0.5;
            ctx.moveTo(
                ...projectTimelinePoint(xPos, yMax, timeExtent, orientation),
            );
            ctx.lineTo(
                ...projectTimelinePoint(xPos, yMin, timeExtent, orientation),
            );
        }
        ctx.stroke();

        ctx.strokeStyle = "#cccccc";
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(...projectTimelinePoint(0, centerY, timeExtent, orientation));
        ctx.lineTo(
            ...projectTimelinePoint(timeExtent, centerY, timeExtent, orientation),
        );
        ctx.stroke();
    }
}

const WAVELANE_TOTAL_HEIGHT = 110;
const FROZEN_BACKGROUND = "#e2e8f0";

function renderFrozenBackground(ctx: CanvasRenderingContext2D) {
    const canvas = ctx.canvas;
    ctx.fillStyle = FROZEN_BACKGROUND;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function WaveLane(p: _p) {
    const CANVAS_PHYSICAL_WIDTH = 1200;
    const orientation = p.orientation ?? "horizontal";
    const timelineHeight = p.timelineHeight ?? 640;
    const isVertical = orientation === "vertical";
    const canvasWidth = isVertical
        ? WAVELANE_TOTAL_HEIGHT
        : CANVAS_PHYSICAL_WIDTH;
    const canvasHeight = isVertical
        ? Math.max(1, Math.round(timelineHeight))
        : WAVELANE_TOTAL_HEIGHT;

    const audioDataList = useContext(AudioDataCtx);
    const audioData = audioDataList.find((a) => a.id === p.audioId);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const waveformCacheRef = useRef<WaveformCache | null>(null);
    const [isCacheReady, setIsCacheReady] = useState(false);
    // 波形缓存后无需异步setState，直接重绘即可

    /**
     * 解码音频并初始化缓存（只做一次重计算）
     */
    useEffect(() => {
        if (!audioData?.buffer) return;

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

        // 如果已有 decodedBuffer，直接使用
        if (audioData.decodedBuffer) {
            const decodedBuffer = audioData.decodedBuffer;
            const channelCount = decodedBuffer.numberOfChannels;
            const channelData = Array.from({ length: channelCount }, (_, i) =>
                decodedBuffer.getChannelData(i).slice(),
            );
            waveformCacheRef.current = {
                audioBuffer: decodedBuffer,
                channelData,
                sampleRate: decodedBuffer.sampleRate,
                channelCount,
                length: decodedBuffer.length,
            };
            Promise.resolve().then(() => setIsCacheReady(true));
            return;
        }

        const arrayBufferCopy = audioData.buffer.slice(0);

        audioContextRef.current.decodeAudioData(
            arrayBufferCopy,
            (audioBuffer) => {
                const channelCount = audioBuffer.numberOfChannels;
                const channelData = Array.from(
                    { length: channelCount },
                    (_, i) => audioBuffer.getChannelData(i).slice(),
                );

                waveformCacheRef.current = {
                    audioBuffer,
                    channelData,
                    sampleRate: audioBuffer.sampleRate,
                    channelCount,
                    length: audioBuffer.length,
                };

                setIsCacheReady(true);
            },
            (error) => {
                console.error("音频解码失败:", error);
                setIsCacheReady(false);
            },
        );
    }, [audioData]);

    /**
     * 幅度倍数变化时，触发缓存更新
     */
    useEffect(() => {
        if (p.isPlaybackFrozen || !(p.timeRange[1] > p.timeRange[0])) {
            const ctx = canvasRef.current?.getContext("2d");
            if (ctx) {
                renderFrozenBackground(ctx);
            }
            return;
        }

        if (!isCacheReady) return;
        // 只要依赖变化就强制重绘
        if (canvasRef.current && waveformCacheRef.current) {
            const ctx = canvasRef.current.getContext("2d");
            if (ctx) {
                const offset = p.waveState.offset ?? 0;
                renderWaveToCanvas(
                    ctx,
                    waveformCacheRef.current.channelData,
                    waveformCacheRef.current.channelCount,
                    p.timeRange,
                    waveformCacheRef.current.sampleRate,
                    waveformCacheRef.current.length,
                    WAVELANE_TOTAL_HEIGHT /
                        waveformCacheRef.current.channelCount,
                    p.waveState.amplitudeMultiplier,
                    offset,
                    orientation,
                );
                const timeExtent = isVertical ? canvasHeight : canvasWidth;
                const crossExtent = isVertical ? canvasWidth : canvasHeight;
                if (p.cursorTime != null) {
                    const tL = p.timeRange[0];
                    const tR = p.timeRange[1];
                    const span = tR - tL;
                    if (span > 0) {
                        const timeAxis =
                            ((p.cursorTime - tL) / span) * timeExtent;
                        if (timeAxis >= 0 && timeAxis <= timeExtent) {
                            ctx.setLineDash([4, 4]);
                            ctx.strokeStyle = "#facc15";
                            ctx.lineWidth = 1;
                            ctx.beginPath();
                            ctx.moveTo(
                                ...projectTimelinePoint(
                                    timeAxis,
                                    0,
                                    timeExtent,
                                    orientation,
                                ),
                            );
                            ctx.lineTo(
                                ...projectTimelinePoint(
                                    timeAxis,
                                    crossExtent,
                                    timeExtent,
                                    orientation,
                                ),
                            );
                            ctx.stroke();
                            ctx.setLineDash([]);
                        }
                    }
                }
                if (p.playheadTime != null) {
                    const tL = p.timeRange[0];
                    const tR = p.timeRange[1];
                    const span = tR - tL;
                    if (span > 0) {
                        const timeAxis =
                            ((p.playheadTime - tL) / span) * timeExtent;
                        if (timeAxis >= 0 && timeAxis <= timeExtent) {
                            ctx.strokeStyle = "#22c55e";
                            ctx.lineWidth = 1.5;
                            ctx.beginPath();
                            ctx.moveTo(
                                ...projectTimelinePoint(
                                    timeAxis,
                                    0,
                                    timeExtent,
                                    orientation,
                                ),
                            );
                            ctx.lineTo(
                                ...projectTimelinePoint(
                                    timeAxis,
                                    crossExtent,
                                    timeExtent,
                                    orientation,
                                ),
                            );
                            ctx.stroke();
                        }
                    }
                }
            }
        }
    }, [
        isCacheReady,
        p.waveState.amplitudeMultiplier,
        p.waveState.offset,
        p.waveState.isFolded,
        p.timeRange,
        p.cursorTime,
        p.playheadTime,
        p.isPlaybackFrozen,
        orientation,
        isVertical,
        canvasWidth,
        canvasHeight,
    ]);

    /**
     * 时间范围/缓存就绪时实时重绘（仅使用缓存，不涉及计算）
     */
    // 移除冗余的 isRenderReady 相关 effect

    return (
        <div style={{ width: isVertical ? WAVELANE_TOTAL_HEIGHT : undefined }}>
            <div className="flex gap-2">
                {!p.waveState.isFolded && (
                    <canvas
                        ref={canvasRef}
                        width={canvasWidth}
                        height={canvasHeight}
                        data-lane="true"
                        style={{
                            border: "1px solid var(--editor-border-strong)",
                            width: isVertical
                                ? `${WAVELANE_TOTAL_HEIGHT}px`
                                : "100%",
                            height: `${isVertical ? timelineHeight : WAVELANE_TOTAL_HEIGHT}px`,
                            flexShrink: 0,
                        }}
                    />
                )}
            </div>
        </div>
    );
}

export default WaveLane;
