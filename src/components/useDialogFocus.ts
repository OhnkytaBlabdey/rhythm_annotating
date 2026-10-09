"use client";

import { useLayoutEffect, useRef, type KeyboardEvent } from "react";
import { isVisibleFocusTarget } from "./editorFocus";

export function useDialogFocus(isOpen: boolean, onClose: () => void) {
    const dialogRef = useRef<HTMLDivElement>(null);
    const wasOpenRef = useRef(false);

    // Run after every commit, including removal of a focused conditional control.
    useLayoutEffect(() => {
        const dialog = dialogRef.current;
        if (isOpen && dialog &&
            (!wasOpenRef.current || !dialog.contains(document.activeElement))) {
            dialog.focus({ preventScroll: true });
        }
        wasOpenRef.current = isOpen;
    });

    const onDialogKeyDownCapture = (event: KeyboardEvent<HTMLDivElement>) => {
        if (!isOpen || event.nativeEvent.isComposing || event.keyCode === 229) {
            return;
        }
        if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            onClose();
            return;
        }
        if (event.key !== "Tab") return;

        const dialog = dialogRef.current;
        if (!dialog) return;
        const candidates = Array.from(dialog.querySelectorAll<HTMLElement>(
            "a[href], area[href], button, input, select, textarea, [tabindex], [contenteditable], audio[controls], video[controls], summary",
        )).filter((target) => target.tabIndex >= 0 &&
            !target.matches(":disabled, [aria-disabled='true']") &&
            isVisibleFocusTarget(target));
        // Positive tabindex values precede the normal DOM-order tab stops.
        candidates.sort((a, b) => (a.tabIndex || Infinity) - (b.tabIndex || Infinity));
        const first = candidates[0];
        const last = candidates[candidates.length - 1];
        const active = document.activeElement;
        if (!first || !candidates.some((target) => target === active)) {
            event.preventDefault();
            (event.shiftKey ? last : first)?.focus({ preventScroll: true });
            if (!first) dialog.focus({ preventScroll: true });
        } else if (event.shiftKey ? active === first : active === last) {
            event.preventDefault();
            (event.shiftKey ? last : first).focus({ preventScroll: true });
        }
    };

    const onDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        event.stopPropagation();
    };

    return { dialogRef, onDialogKeyDownCapture, onDialogKeyDown };
}
