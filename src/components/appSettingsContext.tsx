"use client";

import React, {
    useCallback,
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";

const STORAGE_KEY = "explicitize.app-settings";

export type ShortcutAction =
    | "timeRange.zoomIn"
    | "timeRange.zoomOut"
    | "timeRange.panUp"
    | "timeRange.panDown";

export type ShortcutMap = Record<ShortcutAction, string>;

export interface TimeViewSettings {
    currentTime: number;
    timeMultiplier: number;
}

export interface SpectrumViewSettings {
    brightnessOffset: number;
    resolutionScale: number;
}

interface PersistedSettings {
    version: 1;
    shortcuts: ShortcutMap;
    timeView: TimeViewSettings;
    spectrumView: SpectrumViewSettings;
}

const DEFAULT_SHORTCUTS: ShortcutMap = {
    "timeRange.zoomIn": "Alt+WheelUp",
    "timeRange.zoomOut": "Alt+WheelDown",
    "timeRange.panUp": "WheelUp",
    "timeRange.panDown": "WheelDown",
};

const DEFAULT_TIME_VIEW: TimeViewSettings = {
    currentTime: 0,
    timeMultiplier: 1,
};

const DEFAULT_SPECTRUM_VIEW: SpectrumViewSettings = {
    brightnessOffset: 0,
    resolutionScale: 1,
};

const DEFAULT_SETTINGS: PersistedSettings = {
    version: 1,
    shortcuts: DEFAULT_SHORTCUTS,
    timeView: DEFAULT_TIME_VIEW,
    spectrumView: DEFAULT_SPECTRUM_VIEW,
};

interface AppSettingsContextValue {
    shortcuts: ShortcutMap;
    timeView: TimeViewSettings;
    spectrumView: SpectrumViewSettings;
    hasHydratedSettings: boolean;
    setShortcut: (action: ShortcutAction, combo: string) => void;
    setTimeView: (next: Partial<TimeViewSettings>) => void;
    setSpectrumBrightnessOffset: (offset: number) => void;
    setSpectrumResolutionScale: (scale: number) => void;
    matchesShortcut: (
        action: ShortcutAction,
        event: Pick<
            WheelEvent,
            "altKey" | "ctrlKey" | "metaKey" | "shiftKey" | "deltaY"
        >,
    ) => boolean;
}

const AppSettingsCtx = createContext<AppSettingsContextValue>({
    shortcuts: DEFAULT_SHORTCUTS,
    timeView: DEFAULT_TIME_VIEW,
    spectrumView: DEFAULT_SPECTRUM_VIEW,
    hasHydratedSettings: false,
    setShortcut: () => undefined,
    setTimeView: () => undefined,
    setSpectrumBrightnessOffset: () => undefined,
    setSpectrumResolutionScale: () => undefined,
    matchesShortcut: () => false,
});

function isObject(v: unknown): v is Record<string, unknown> {
    return !!v && typeof v === "object";
}

function normalizeShortcuts(input: unknown): ShortcutMap {
    if (!isObject(input)) return DEFAULT_SHORTCUTS;

    return {
        "timeRange.zoomIn":
            typeof input["timeRange.zoomIn"] === "string" &&
            input["timeRange.zoomIn"].trim()
                ? (input["timeRange.zoomIn"] as string)
                : DEFAULT_SHORTCUTS["timeRange.zoomIn"],
        "timeRange.zoomOut":
            typeof input["timeRange.zoomOut"] === "string" &&
            input["timeRange.zoomOut"].trim()
                ? (input["timeRange.zoomOut"] as string)
                : DEFAULT_SHORTCUTS["timeRange.zoomOut"],
        "timeRange.panUp":
            typeof input["timeRange.panUp"] === "string" &&
            input["timeRange.panUp"].trim()
                ? (input["timeRange.panUp"] as string)
                : DEFAULT_SHORTCUTS["timeRange.panUp"],
        "timeRange.panDown":
            typeof input["timeRange.panDown"] === "string" &&
            input["timeRange.panDown"].trim()
                ? (input["timeRange.panDown"] as string)
                : DEFAULT_SHORTCUTS["timeRange.panDown"],
    };
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
    if (!isObject(input) || Number(input.version) !== 1) {
        return DEFAULT_SETTINGS;
    }

    return {
        version: 1,
        shortcuts: normalizeShortcuts(input.shortcuts),
        timeView: normalizeTimeView(input.timeView),
        spectrumView: normalizeSpectrumView(input.spectrumView),
    };
}

function parseShortcut(combo: string) {
    const tokens = combo
        .split("+")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);

    const requireAlt = tokens.includes("alt");
    const requireCtrl = tokens.includes("ctrl");
    const requireMeta = tokens.includes("meta");
    const requireShift = tokens.includes("shift");
    const wheelUp = tokens.includes("wheelup");
    const wheelDown = tokens.includes("wheeldown");

    return {
        requireAlt,
        requireCtrl,
        requireMeta,
        requireShift,
        wheelUp,
        wheelDown,
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
    const hasHydratedSettings = true;

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    }, [settings]);

    const setShortcut = useCallback((action: ShortcutAction, combo: string) => {
        setSettings((prev) => {
            if (prev.shortcuts[action] === combo) {
                return prev;
            }

            return {
                ...prev,
                shortcuts: {
                    ...prev.shortcuts,
                    [action]: combo,
                },
            };
        });
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

    const value = useMemo<AppSettingsContextValue>(() => {
        const effectiveShortcuts = normalizeShortcuts(settings.shortcuts);

        const matchesShortcut: AppSettingsContextValue["matchesShortcut"] = (
            action,
            event,
        ) => {
            const config = parseShortcut(
                effectiveShortcuts[action] || DEFAULT_SHORTCUTS[action] || "",
            );
            if (config.requireAlt !== !!event.altKey) return false;
            if (config.requireCtrl !== !!event.ctrlKey) return false;
            if (config.requireMeta !== !!event.metaKey) return false;
            if (config.requireShift !== !!event.shiftKey) return false;
            if (config.wheelUp) return event.deltaY < 0;
            if (config.wheelDown) return event.deltaY > 0;
            return false;
        };

        const effectiveSpectrumView = normalizeSpectrumView(
            settings.spectrumView,
        );

        return {
            shortcuts: effectiveShortcuts,
            timeView: settings.timeView,
            spectrumView: effectiveSpectrumView,
            hasHydratedSettings,
            setShortcut,
            setTimeView,
            setSpectrumBrightnessOffset,
            setSpectrumResolutionScale,
            matchesShortcut,
        };
    }, [
        hasHydratedSettings,
        setShortcut,
        setTimeView,
        setSpectrumBrightnessOffset,
        setSpectrumResolutionScale,
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
