"use client";

import React, {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";

const STORAGE_KEY = "explicitize.app-settings";

export type ShortcutAction = "timeRange.zoomIn" | "timeRange.zoomOut";

export type ShortcutMap = Record<ShortcutAction, string>;

export interface TimeViewSettings {
    currentTime: number;
    timeMultiplier: number;
}

interface PersistedSettings {
    version: 1;
    shortcuts: ShortcutMap;
    timeView: TimeViewSettings;
}

const DEFAULT_SHORTCUTS: ShortcutMap = {
    "timeRange.zoomIn": "Alt+WheelUp",
    "timeRange.zoomOut": "Alt+WheelDown",
};

const DEFAULT_TIME_VIEW: TimeViewSettings = {
    currentTime: 0,
    timeMultiplier: 1,
};

const DEFAULT_SETTINGS: PersistedSettings = {
    version: 1,
    shortcuts: DEFAULT_SHORTCUTS,
    timeView: DEFAULT_TIME_VIEW,
};

interface AppSettingsContextValue {
    shortcuts: ShortcutMap;
    timeView: TimeViewSettings;
    hasHydratedSettings: boolean;
    setShortcut: (action: ShortcutAction, combo: string) => void;
    setTimeView: (next: Partial<TimeViewSettings>) => void;
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
    hasHydratedSettings: false,
    setShortcut: () => undefined,
    setTimeView: () => undefined,
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

function normalizeSettings(input: unknown): PersistedSettings {
    if (!isObject(input) || Number(input.version) !== 1) {
        return DEFAULT_SETTINGS;
    }

    return {
        version: 1,
        shortcuts: normalizeShortcuts(input.shortcuts),
        timeView: normalizeTimeView(input.timeView),
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

    const value = useMemo<AppSettingsContextValue>(() => {
        const setShortcut = (action: ShortcutAction, combo: string) => {
            setSettings((prev) => ({
                ...prev,
                shortcuts: {
                    ...prev.shortcuts,
                    [action]: combo,
                },
            }));
        };

        const setTimeView = (next: Partial<TimeViewSettings>) => {
            setSettings((prev) => ({
                ...prev,
                timeView: normalizeTimeView({
                    ...prev.timeView,
                    ...next,
                }),
            }));
        };

        const matchesShortcut: AppSettingsContextValue["matchesShortcut"] = (
            action,
            event,
        ) => {
            const config = parseShortcut(settings.shortcuts[action] || "");
            if (config.requireAlt !== !!event.altKey) return false;
            if (config.requireCtrl !== !!event.ctrlKey) return false;
            if (config.requireMeta !== !!event.metaKey) return false;
            if (config.requireShift !== !!event.shiftKey) return false;
            if (config.wheelUp) return event.deltaY < 0;
            if (config.wheelDown) return event.deltaY > 0;
            return false;
        };

        return {
            shortcuts: settings.shortcuts,
            timeView: settings.timeView,
            hasHydratedSettings,
            setShortcut,
            setTimeView,
            matchesShortcut,
        };
    }, [hasHydratedSettings, settings]);

    return (
        <AppSettingsCtx.Provider value={value}>
            {children}
        </AppSettingsCtx.Provider>
    );
}

export function useAppSettings() {
    return useContext(AppSettingsCtx);
}
