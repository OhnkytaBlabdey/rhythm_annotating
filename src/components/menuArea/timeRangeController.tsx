import React, { useEffect, useMemo, useRef, useState } from "react";
import style from "./timeRangeController.module.css";
import classNames from "classnames/bind";

const cls = classNames.bind(style);

type DragMode = "thumb" | "head" | "tail" | null;

interface _p {
    refTimeMultiplier: number;
    setTimeMultiplier: (_: number) => void;
    refCurrentTime: number;
    Duration: number;
    setCurrentTime: (_: number) => void;
}

const MIN_VISIBLE_SPAN = 0.05;

function clamp(v: number, min: number, max: number) {
    if (!Number.isFinite(v)) return min;
    if (max < min) return min;
    return Math.min(max, Math.max(min, v));
}

function TimeRangeController(p: _p) {
    const {
        refTimeMultiplier,
        refCurrentTime,
        Duration,
        setCurrentTime,
        setTimeMultiplier,
    } = p;
    const trackRef = useRef<HTMLDivElement | null>(null);
    const dragModeRef = useRef<DragMode>(null);
    const dragStartXRef = useRef(0);
    const dragStartCurrentRef = useRef(0);
    const dragStartSpanRef = useRef(0);
    const dragFixedEndRef = useRef(0);
    const [isDragging, setIsDragging] = useState(false);

    const duration = useMemo(() => Math.max(0, Duration), [Duration]);
    const minVisibleSpan = useMemo(() => {
        if (duration <= 0) return 0;
        return Math.min(MIN_VISIBLE_SPAN, duration);
    }, [duration]);

    const visibleSpan = useMemo(() => {
        const rawSpan = Math.max(0, refTimeMultiplier * 2);
        if (duration <= 0) return 0;
        return clamp(rawSpan, minVisibleSpan, duration);
    }, [duration, minVisibleSpan, refTimeMultiplier]);

    const maxStart = useMemo(
        () => Math.max(0, duration - visibleSpan),
        [duration, visibleSpan],
    );
    const start = useMemo(
        () => clamp(refCurrentTime, 0, maxStart),
        [refCurrentTime, maxStart],
    );

    const leftPercent = useMemo(() => {
        if (duration <= 0) return 0;
        return (start / duration) * 100;
    }, [duration, start]);

    const widthPercent = useMemo(() => {
        if (duration <= 0) return 0;
        return (visibleSpan / duration) * 100;
    }, [duration, visibleSpan]);

    useEffect(() => {
        if (!isDragging) return;

        const onPointerMove = (event: PointerEvent) => {
            const track = trackRef.current;
            if (!track || duration <= 0) return;

            const rect = track.getBoundingClientRect();
            if (rect.width <= 0) return;

            const deltaX = event.clientX - dragStartXRef.current;
            const deltaTime = (deltaX / rect.width) * duration;
            const mode = dragModeRef.current;

            if (mode === "thumb") {
                const nextStart = clamp(
                    dragStartCurrentRef.current + deltaTime,
                    0,
                    Math.max(0, duration - dragStartSpanRef.current),
                );
                setCurrentTime(nextStart);
                return;
            }

            if (mode === "tail") {
                const fixedStart = dragStartCurrentRef.current;
                const nextEnd = clamp(
                    fixedStart + dragStartSpanRef.current + deltaTime,
                    fixedStart + minVisibleSpan,
                    duration,
                );
                const nextSpan = nextEnd - fixedStart;
                setTimeMultiplier(nextSpan / 2);
                return;
            }

            if (mode === "head") {
                const fixedEnd = dragFixedEndRef.current;
                const nextStart = clamp(
                    dragStartCurrentRef.current + deltaTime,
                    0,
                    fixedEnd - minVisibleSpan,
                );
                const nextSpan = fixedEnd - nextStart;
                setCurrentTime(nextStart);
                setTimeMultiplier(nextSpan / 2);
            }
        };

        const onPointerUp = () => {
            dragModeRef.current = null;
            setIsDragging(false);
        };

        window.addEventListener("pointermove", onPointerMove);
        window.addEventListener("pointerup", onPointerUp);
        window.addEventListener("pointercancel", onPointerUp);

        return () => {
            window.removeEventListener("pointermove", onPointerMove);
            window.removeEventListener("pointerup", onPointerUp);
            window.removeEventListener("pointercancel", onPointerUp);
        };
    }, [
        duration,
        isDragging,
        minVisibleSpan,
        setCurrentTime,
        setTimeMultiplier,
    ]);

    function startDrag(
        mode: Exclude<DragMode, null>,
        event: React.PointerEvent,
    ) {
        if (duration <= 0) return;
        event.preventDefault();
        event.stopPropagation();

        dragModeRef.current = mode;
        dragStartXRef.current = event.clientX;
        dragStartCurrentRef.current = start;
        dragStartSpanRef.current = visibleSpan;
        dragFixedEndRef.current = start + visibleSpan;
        setIsDragging(true);
    }

    return (
        <div className={cls("wrap", { disabled: duration <= 0 })}>
            <div
                ref={trackRef}
                className={cls("track")}
                title="时间范围"
                aria-label="时间范围"
            >
                {/* TODO: 可替换为完整时长长条图标资源 */}
                <div
                    className={cls("visibleRange")}
                    style={{
                        left: `${leftPercent}%`,
                        width: `${widthPercent}%`,
                    }}
                    onPointerDown={(e) => startDrag("thumb", e)}
                >
                    {/* TODO: 可替换为当前窗口时长长条图标资源 */}
                    <span
                        className={cls("handle", "handleHead")}
                        onPointerDown={(e) => startDrag("head", e)}
                    />
                    {/* TODO: 可替换为头部圆点图标资源 */}
                    <span
                        className={cls("handle", "handleTail")}
                        onPointerDown={(e) => startDrag("tail", e)}
                    />
                    {/* TODO: 可替换为尾部圆点图标资源 */}
                </div>
            </div>
        </div>
    );
}

export default TimeRangeController;
