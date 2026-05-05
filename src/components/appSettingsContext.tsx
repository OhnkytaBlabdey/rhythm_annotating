"use client";

import React, {
    useCallback,
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";
import {
    DEFAULT_SHORTCUTS,
    SHORTCUT_DEFINITIONS,
    ShortcutAction,
    ShortcutMap,
    findShortcutConflicts,
    matchesKeyboardShortcut,
    matchesWheelShortcut,
    normalizeShortcutCombo,
} from "@/lib/shortcuts";

const STORAGE_KEY = "explicitize.app-settings";

export interface TimeViewSettings {
    currentTime: number;
    timeMultiplier: number;
}

export interface SpectrumViewSettings {
    brightnessOffset: number;
    resolutionScale: number;
}

interface PersistedSettings {
    version: 2;
    shortcuts: ShortcutMap;
    timeView: TimeViewSettings;
    spectrumView: SpectrumViewSettings;
}

const DEFAULT_TIME_VIEW: TimeViewSettings = {
    currentTime: 0,
    timeMultiplier: 1,
};

const DEFAULT_SPECTRUM_VIEW: SpectrumViewSettings = {
    brightnessOffset: 0,
    resolutionScale: 1,
};

const DEFAULT_SETTINGS: PersistedSettings = {
    version: 2,
    shortcuts: DEFAULT_SHORTCUTS,
    timeView: DEFAULT_TIME_VIEW,
    spectrumView: DEFAULT_SPECTRUM_VIEW,
};

interface AppSettingsContextValue {
    shortcuts: ShortcutMap;
    timeView: TimeViewSettings;
    spectrumView: SpectrumViewSettings;
    hasHydratedSettings: boolean;
    saveShortcuts: (
        next: ShortcutMap,
    ) => { ok: true } | { ok: false; conflicts: ReturnType<typeof findShortcutConflicts> };
    setTimeView: (next: Partial<TimeViewSettings>) => void;
    setSpectrumView: (next: Partial<SpectrumViewSettings>) => void;
    setSpectrumBrightnessOffset: (offset: number) => void;
    setSpectrumResolutionScale: (scale: number) => void;
    resetProjectScopedSettings: () => void;
    matchesKeyShortcut: (
        action: ShortcutAction,
        event: Pick<
            KeyboardEvent,
            "key" | "code" | "altKey" | "ctrlKey" | "metaKey" | "shiftKey"
        >,
    ) => boolean;
    matchesShortcut: (
        action: ShortcutAction,
        event: Pick<
            WheelEvent,
            "altKey" | "ctrlKey" | "metaKey" | "shiftKey" | "deltaY"
        >,
    ) => boolean;
    getKeyboardShortcutLabel: (action: ShortcutAction) => string;
}

const AppSettingsCtx = createContext<AppSettingsContextValue>({
    shortcuts: DEFAULT_SHORTCUTS,
    timeView: DEFAULT_TIME_VIEW,
    spectrumView: DEFAULT_SPECTRUM_VIEW,
    hasHydratedSettings: false,
    saveShortcuts: () => ({ ok: true }),
    setTimeView: () => undefined,
    setSpectrumView: () => undefined,
    setSpectrumBrightnessOffset: () => undefined,
    setSpectrumResolutionScale: () => undefined,
    resetProjectScopedSettings: () => undefined,
    matchesKeyShortcut: () => false,
    matchesShortcut: () => false,
    getKeyboardShortcutLabel: () => "",
});

function isObject(v: unknown): v is Record<string, unknown> {
    return !!v && typeof v === "object";
}

function normalizeShortcuts(input: unknown): ShortcutMap {
    const next: ShortcutMap = { ...DEFAULT_SHORTCUTS };
    if (!isObject(input)) {
        return next;
    }

    for (const definition of SHORTCUT_DEFINITIONS) {
        if (!Object.prototype.hasOwnProperty.call(input, definition.action)) {
            continue;
        }

        const rawValue = input[definition.action];
        if (typeof rawValue !== "string") {
            continue;
        }

        next[definition.action] = normalizeShortcutCombo(rawValue);
    }

    return next;
}

function normalizeTimeView(input: unknown): TimeViewSettings {
    if (!isObject(input)) return DEFAULT_TIME_VIEW;

    const rawCurrent = Number(input.currentTime);
    const rawMultiplier = Number(input.timeMultiplier);

    return {
        currentTime:
            Number.isFinite(rawCurrent) && rawCurrent >= 0
                ? rawCurrent
                : DEFAULT_TIME_VIEW.currentTime,
        timeMultiplier:
            Number.isFinite(rawMultiplier) && rawMultiplier > 0
                ? rawMultiplier
                : DEFAULT_TIME_VIEW.timeMultiplier,
    };
}

function clampNumber(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function normalizeSpectrumView(input: unknown): SpectrumViewSettings {
    if (!isObject(input)) return DEFAULT_SPECTRUM_VIEW;

    const rawBrightness = Number(input.brightnessOffset);
    const rawResolution = Number(input.resolutionScale);

    return {
        brightnessOffset: Number.isFinite(rawBrightness)
            ? clampNumber(rawBrightness, -20, 20)
            : DEFAULT_SPECTRUM_VIEW.brightnessOffset,
        resolutionScale: Number.isFinite(rawResolution)
            ? clampNumber(rawResolution, 0.5, 2)
            : DEFAULT_SPECTRUM_VIEW.resolutionScale,
    };
}

function normalizeSettings(input: unknown): PersistedSettings {
    if (!isObject(input)) {
        return DEFAULT_SETTINGS;
    }

    const version = Number(input.version);
    if (version !== 1 && version !== 2) {
        return DEFAULT_SETTINGS;
    }

    return {
        version: 2,
        shortcuts: normalizeShortcuts(input.shortcuts),
        timeView: normalizeTimeView(input.timeView),
        spectrumView: normalizeSpectrumView(input.spectrumView),
    };
}

export function AppSettingsProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const [settings, setSettings] = useState<PersistedSettings>(() => {
        if (typeof window === "undefined") {
            return DEFAULT_SETTINGS;
        }

        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return DEFAULT_SETTINGS;
            const parsed: unknown = JSON.parse(raw);
            return normalizeSettings(parsed);
        } catch {
            return DEFAULT_SETTINGS;
        }
    });
    const [hasHydratedSettings, setHasHydratedSettings] = useState(false);

    useEffect(() => {
        setHasHydratedSettings(true);
    }, []);

    useEffect(() => {
        if (!hasHydratedSettings) return;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    }, [settings, hasHydratedSettings]);

    const saveShortcuts = useCallback((next: ShortcutMap) => {
        const normalized = normalizeShortcuts(next);
        const conflicts = findShortcutConflicts(normalized);
        if (conflicts.length > 0) {
            return {
                ok: false as const,
                conflicts,
            };
        }

        setSettings((prev) => {
            const changed = SHORTCUT_DEFINITIONS.some(
                (definition) =>
                    prev.shortcuts[definition.action] !==
                    normalized[definition.action],
            );
            if (!changed) {
                return prev;
            }

            return {
                ...prev,
                shortcuts: normalized,
            };
        });

        return { ok: true as const };
    }, []);

    const setTimeView = useCallback((next: Partial<TimeViewSettings>) => {
        setSettings((prev) => {
            const normalized = normalizeTimeView({
                ...prev.timeView,
                ...next,
            });

            if (
                prev.timeView.currentTime === normalized.currentTime &&
                prev.timeView.timeMultiplier === normalized.timeMultiplier
            ) {
                return prev;
            }

            return {
                ...prev,
                timeView: normalized,
            };
        });
    }, []);

    const setSpectrumBrightnessOffset = useCallback((offset: number) => {
        setSettings((prev) => {
            const normalized = normalizeSpectrumView({
                ...prev.spectrumView,
                brightnessOffset: offset,
            });

            if (
                prev.spectrumView.brightnessOffset ===
                normalized.brightnessOffset
            ) {
                return prev;
            }

            return {
                ...prev,
                spectrumView: normalized,
            };
        });
    }, []);

    const setSpectrumView = useCallback(
        (next: Partial<SpectrumViewSettings>) => {
            setSettings((prev) => {
                const normalized = normalizeSpectrumView({
                    ...prev.spectrumView,
                    ...next,
                });

                if (
                    prev.spectrumView.brightnessOffset ===
                        normalized.brightnessOffset &&
                    prev.spectrumView.resolutionScale ===
                        normalized.resolutionScale
                ) {
                    return prev;
                }

                return {
                    ...prev,
                    spectrumView: normalized,
                };
            });
        },
        [],
    );

    const setSpectrumResolutionScale = useCallback((scale: number) => {
        setSettings((prev) => {
            const normalized = normalizeSpectrumView({
                ...prev.spectrumView,
                resolutionScale: scale,
            });

            if (
                prev.spectrumView.resolutionScale === normalized.resolutionScale
            ) {
                return prev;
            }

            return {
                ...prev,
                spectrumView: normalized,
            };
        });
    }, []);

    const resetProjectScopedSettings = useCallback(() => {
        setSettings((prev) => {
            const next = {
                ...prev,
                timeView: DEFAULT_TIME_VIEW,
                spectrumView: DEFAULT_SPECTRUM_VIEW,
            };

            if (
                prev.timeView.currentTime === next.timeView.currentTime &&
                prev.timeView.timeMultiplier === next.timeView.timeMultiplier &&
                prev.spectrumView.brightnessOffset ===
                    next.spectrumView.brightnessOffset &&
                prev.spectrumView.resolutionScale ===
                    next.spectrumView.resolutionScale
            ) {
                return prev;
            }

            return next;
        });
    }, []);

    const value = useMemo<AppSettingsContextValue>(() => {
        const effectiveShortcuts = normalizeShortcuts(settings.shortcuts);

        const getKeyboardShortcutLabel: AppSettingsContextValue["getKeyboardShortcutLabel"] =
            (action) => {
                const combo = effectiveShortcuts[action] ?? "";
                if (!combo) {
                    return "";
                }
                if (combo.includes("Wheel")) {
                    return "";
                }
                return combo;
            };

        return {
            shortcuts: effectiveShortcuts,
            timeView: settings.timeView,
            spectrumView: normalizeSpectrumView(settings.spectrumView),
            hasHydratedSettings,
            saveShortcuts,
            setTimeView,
            setSpectrumView,
            setSpectrumBrightnessOffset,
            setSpectrumResolutionScale,
            resetProjectScopedSettings,
            matchesKeyShortcut: (action, event) =>
                matchesKeyboardShortcut(effectiveShortcuts[action] || "", event),
            matchesShortcut: (action, event) =>
                matchesWheelShortcut(effectiveShortcuts[action] || "", event),
            getKeyboardShortcutLabel,
        };
    }, [
        hasHydratedSettings,
        saveShortcuts,
        setTimeView,
        setSpectrumView,
        setSpectrumBrightnessOffset,
        setSpectrumResolutionScale,
        resetProjectScopedSettings,
        settings.shortcuts,
        settings.timeView,
        settings.spectrumView,
    ]);

    return (
        <AppSettingsCtx.Provider value={value}>
            {children}
        </AppSettingsCtx.Provider>
    );
}

export function useAppSettings() {
    return useContext(AppSettingsCtx);
}
