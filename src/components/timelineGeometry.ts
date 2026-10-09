export type TimelineOrientation = "horizontal" | "vertical";

// Logical time always increases; only its projection onto the screen changes.
export function projectTimelinePoint(
    timeAxis: number,
    crossAxis: number,
    timeExtent: number,
    orientation: TimelineOrientation,
): [number, number] {
    return orientation === "vertical"
        ? [crossAxis, timeExtent - timeAxis]
        : [timeAxis, crossAxis];
}

export function unprojectTimelinePoint(
    x: number,
    y: number,
    timeExtent: number,
    orientation: TimelineOrientation,
): [number, number] {
    return orientation === "vertical" ? [timeExtent - y, x] : [x, y];
}
