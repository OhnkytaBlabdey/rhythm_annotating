export const MIN_VISIBLE_SPAN = 0.05;
const EXPAND_FACTOR = 10 / 9;
const SHRINK_FACTOR = 9 / 10;

export function clamp(v: number, min: number, max: number) {
    if (!Number.isFinite(v)) return min;
    if (max < min) return min;
    return Math.min(max, Math.max(min, v));
}

export function getVisibleSpan(duration: number, timeMultiplier: number) {
    if (duration <= 0) return 0;
    const minSpan = Math.min(MIN_VISIBLE_SPAN, duration);
    return clamp(Math.max(0, timeMultiplier * 2), minSpan, duration);
}

export function getNextTimeMultiplierByWheel(
    duration: number,
    timeMultiplier: number,
    deltaY: number,
) {
    if (duration <= 0) return timeMultiplier;

    const minSpan = Math.min(MIN_VISIBLE_SPAN, duration);
    const visibleSpan = getVisibleSpan(duration, timeMultiplier);
    const factor = deltaY < 0 ? SHRINK_FACTOR : EXPAND_FACTOR;
    const nextSpan = clamp(visibleSpan * factor, minSpan, duration);
    return nextSpan / 2;
}
