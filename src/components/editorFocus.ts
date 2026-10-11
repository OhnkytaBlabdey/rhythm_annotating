export function isVisibleFocusTarget(target: HTMLElement | null): target is HTMLElement {
    return !!target?.isConnected && target.getClientRects().length > 0 &&
        !target.closest("[hidden], [inert]") &&
        !["hidden", "collapse"].includes(getComputedStyle(target).visibility);
}
