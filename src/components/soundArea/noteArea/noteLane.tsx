"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import style from "./noteLane.module.css";
import { ChartNote, ChartSegment, Fraction } from "./chartTypes";

interface NoteLaneProps {
    chartData: ChartSegment[];
    timeRange: [number, number];
    beatSubdivision?: number;
    height?: number;
}

interface NoteAnchor {
    kind: "head" | "body" | "tail";
    time: number;
}

const TYPE_COLORS = ["#4f46e5", "#16a34a", "#ea580c", "#dc2626", "#0ea5e9", "#a855f7"];

function toBeatValue(input: Fraction | undefined): number | null {
    if (!input || !Number.isFinite(input.a) || !Number.isFinite(input.b) || input.b === 0) {
        return null;
    }
    return input.a / input.b;
}

function toAnchors(note: ChartNote, measureStart: number, beatDuration: number): NoteAnchor[] {
    const anchors: NoteAnchor[] = [];
    const headBeat = toBeatValue(note.head);
    if (headBeat !== null) {
        anchors.push({ kind: "head", time: measureStart + headBeat * beatDuration });
    }

    if (note.body) {
        for (const point of note.body) {
            const beat = toBeatValue(point);
            if (beat !== null) {
                anchors.push({ kind: "body", time: measureStart + beat * beatDuration });
            }
        }
    }

    const tailBeat = toBeatValue(note.tail);
    if (tailBeat !== null) {
        anchors.push({ kind: "tail", time: measureStart + tailBeat * beatDuration });
    }

    return anchors.sort((a, b) => a.time - b.time);
}

function colorByType(type: number): string {
    const idx = Math.abs(type) % TYPE_COLORS.length;
    return TYPE_COLORS[idx];
}

export default function NoteLane({
    chartData,
    timeRange,
    beatSubdivision = 4,
    height = 120,
}: NoteLaneProps) {
    const wrapperRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [width, setWidth] = useState(1200);

    const segments = useMemo(() => [...chartData].sort((a, b) => a.time - b.time), [chartData]);
    const safeSubdivision = Math.max(1, Math.floor(beatSubdivision));

    useEffect(() => {
        const target = wrapperRef.current;
        if (!target) {
            return;
        }

        const resize = () => {
            const next = Math.floor(target.clientWidth);
            if (next > 0) {
                setWidth(next);
            }
        };

        resize();
        const observer = new ResizeObserver(resize);
        observer.observe(target);

        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) {
            return;
        }

        const [rangeStart, rangeEnd] = timeRange;
        const span = Math.max(1e-6, rangeEnd - rangeStart);
        const pixelPerSecond = width / span;
        const ratio = window.devicePixelRatio || 1;

        canvas.width = Math.max(1, Math.floor(width * ratio));
        canvas.height = Math.max(1, Math.floor(height * ratio));
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
            return;
        }

        const mapTimeToX = (time: number) => (time - rangeStart) * pixelPerSecond;

        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        ctx.clearRect(0, 0, width, height);

        ctx.fillStyle = "#0f172a";
        ctx.fillRect(0, 0, width, height);

        ctx.strokeStyle = "#1e293b";
        ctx.lineWidth = 1;
        ctx.strokeRect(0.5, 0.5, width - 1, height - 1);

        for (const segment of segments) {
            if (!Number.isFinite(segment.tempo) || segment.tempo <= 0) {
                continue;
            }

            const beatDuration = 60 / segment.tempo;
            const measureCount = segment.measures.length;

            for (let measureIndex = 0; measureIndex < measureCount; measureIndex++) {
                const measureStart = segment.time + measureIndex * beatDuration;
                const measureEnd = measureStart + beatDuration;
                if (measureEnd < rangeStart || measureStart > rangeEnd) {
                    continue;
                }

                const measureX = mapTimeToX(measureStart);
                ctx.strokeStyle = "#94a3b8";
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(measureX, 0);
                ctx.lineTo(measureX, height);
                ctx.stroke();

                ctx.strokeStyle = "#334155";
                ctx.lineWidth = 1;
                for (let step = 1; step < safeSubdivision; step++) {
                    const tickTime = measureStart + (beatDuration * step) / safeSubdivision;
                    if (tickTime < rangeStart || tickTime > rangeEnd) {
                        continue;
                    }
                    const tickX = mapTimeToX(tickTime);
                    ctx.beginPath();
                    ctx.moveTo(tickX, 0);
                    ctx.lineTo(tickX, height);
                    ctx.stroke();
                }
            }
        }

        const centerY = height / 2;
        for (const segment of segments) {
            if (!Number.isFinite(segment.tempo) || segment.tempo <= 0) {
                continue;
            }

            const beatDuration = 60 / segment.tempo;
            for (let measureIndex = 0; measureIndex < segment.measures.length; measureIndex++) {
                const measureStart = segment.time + measureIndex * beatDuration;
                const measure = segment.measures[measureIndex];

                for (const note of measure.notes) {
                    const anchors = toAnchors(note, measureStart, beatDuration);
                    if (anchors.length === 0) {
                        continue;
                    }

                    const color = colorByType(note.type);
                    const y = centerY + ((note.type % 5) - 2) * 8;
                    const noteW = 10;
                    const noteH = 14;

                    if (anchors.length > 1) {
                        const start = anchors[0].time;
                        const end = anchors[anchors.length - 1].time;
                        if (end >= rangeStart && start <= rangeEnd) {
                            const x1 = mapTimeToX(start);
                            const x2 = mapTimeToX(end);
                            ctx.fillStyle = `${color}88`;
                            ctx.fillRect(Math.min(x1, x2), y - 2, Math.abs(x2 - x1), 4);
                        }
                    }

                    for (const anchor of anchors) {
                        if (anchor.time < rangeStart || anchor.time > rangeEnd) {
                            continue;
                        }

                        const x = mapTimeToX(anchor.time);
                        ctx.fillStyle =
                            anchor.kind === "body"
                                ? `${color}cc`
                                : anchor.kind === "tail"
                                  ? "#f8fafc"
                                  : color;
                        ctx.fillRect(x - noteW / 2, y - noteH / 2, noteW, noteH);
                    }
                }
            }
        }
    }, [segments, timeRange, width, height, safeSubdivision]);

    return (
        <div className={style.noteLaneRoot} onClick={(e) => e.stopPropagation()}>
            <div className={style.noteLaneCanvasWrap} ref={wrapperRef}>
                <canvas ref={canvasRef} className={style.noteLaneCanvas} />
            </div>
        </div>
    );
}
