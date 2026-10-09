// Focus stays local to the editor that was actually used; never select a lane
// from another audio as a fallback.
export function isVisibleFocusTarget(target: HTMLElement | null): target is HTMLElement {
    return !!target?.isConnected && target.getClientRects().length > 0 &&
        !target.closest("[hidden], [inert]") &&
        !["hidden", "collapse"].includes(getComputedStyle(target).visibility);
}

export function getFocusedEditorLane(target: EventTarget | null): HTMLElement | null {
    if (!(target instanceof Element) || target.closest(
        "input, textarea, select, button, [contenteditable]:not([contenteditable='false'])",
    )) return null;
    return target.closest<HTMLElement>('[data-lane="true"][data-chart-kind]');
}

export function focusEditorLane(lane: HTMLElement | null, scope: HTMLElement | null): boolean {
    if (!scope || !lane || !scope.contains(lane) || lane.dataset.frozen === "true") return false;
    const kind = lane.dataset.chartKind;
    if (kind !== "rhythm" && kind !== "wds") return false;
    if (kind === "wds" && lane.dataset.orientation !== "vertical") return false;
    const target = kind === "wds" ? lane : lane.querySelector<HTMLCanvasElement>("canvas[tabindex]");
    if (!isVisibleFocusTarget(target)) return false;
    target.focus({ preventScroll: true });
    return document.activeElement === target;
}
