"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { defaultProject, project } from "@/interface/project";
import SoundLane from "./soundArea/soundLane";
import WorkMenu from "./menuArea/workMenu";
import styles from "./workArea.module.css";
import {
    SoundLaneState,
    SoundLaneStateUpdate,
    defaultSoundLaneState,
    AudioData,
} from "@/interface/audioData";
import { AudioDataCtx } from "./audioContext";
import {
    SpectrumViewSettings,
    TimeViewSettings,
    useAppSettings,
} from "./appSettingsContext";
import {
    clamp,
    getNextTimeMultiplierByWheel,
    getVisibleSpan,
} from "./timeViewUtils";
import {
    hydrateProjectSnapshot,
    hydrateImportedSnapshot,
    saveProjectSnapshot,
    stripProjectChartTimes,
} from "@/lib/persistence/projectSnapshot";
import { clearPersistence, toAudioRefs } from "@/lib/persistence/indexedDb";
import { exportProjectBlob, importProjectBlob } from "@/lib/persistence/projectExport";
import {
    applyPersistSliceStates,
    collectPersistSliceStates,
    registerPersistSlice,
} from "@/lib/persistence/sliceRegistry";
import {
    collectWdsNotes,
    wdsBeatToTime,
    wdsTimeToBeat,
} from "./soundArea/noteArea/chartAdapter";


const WHEEL_PAN_RATIO = 0.05;
const LIMITED_PLAYBACK_FPS = 15;
const LIMITED_PLAYBACK_INTERVAL_MS = 1000 / LIMITED_PLAYBACK_FPS;
const FROZEN_TIME_RANGE: [number, number] = [0, 0];
const CHART_TRAILING_BEATS = 16;

function formatLocalExportTimestamp(date: Date): string {
    const pad = (value: number) => String(value).padStart(2, "0");

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}

type LaneWheelEvent = Pick<
    WheelEvent,
    "deltaX" | "deltaY" | "altKey" | "ctrlKey" | "metaKey" | "shiftKey" | "target"
> & {
    preventDefault: () => void;
    stopPropagation: () => void;
};

export default function WorkArea() {
    const {
        hasHydratedSettings,
        matchesShortcut,
        resetProjectScopedSettings,
        setSpectrumView,
        setTimeView,
        timeView,
        spectrumView,
    } = useAppSettings();
    const orientation = hasHydratedSettings ? timeView.orientation : "horizontal";
    const isVertical = orientation === "vertical";
    const [objProject, setProject] = useState<project>(() => ({
        ...defaultProject(),
        currentTime: timeView.currentTime,
        timeMultiplier: timeView.timeMultiplier,
    }));
    const [audioDataList, setAudioDataList] = useState<AudioData[]>([]);
    const [, setActiveSoundLaneId] = useState<string | null>(null);
    const [hasHydratedProject, setHasHydratedProject] = useState(false);
    const [hydrationError, setHydrationError] = useState<string | null>(null);
    const [isRecoveringProject, setIsRecoveringProject] = useState(false);
    const [projectImportError, setProjectImportError] = useState<string | null>(null);
    const projectLoadRequestRef = useRef(0);
    const autosaveBlockedRef = useRef(true);
    const [limitedPlaybackTime, setLimitedPlaybackTime] = useState(
        () => objProject.currentTime,
    );
    const workAreaRef = useRef<HTMLDivElement | null>(null);
    const editorLaneCardRef = useRef<HTMLDivElement | null>(null);
    const wheelUpdateGuardRef = useRef(false);
    const matchesShortcutRef = useRef(matchesShortcut);
    matchesShortcutRef.current = matchesShortcut;
    const latestProjectRef = useRef<project>(objProject);
    const latestAudioDataRef = useRef<AudioData[]>(audioDataList);
    const latestTimeViewRef = useRef<TimeViewSettings>(timeView);
    const latestSpectrumViewRef = useRef<SpectrumViewSettings>(spectrumView);
    const latestSetTimeViewRef = useRef(setTimeView);

    const isEditableTarget = useCallback((target: EventTarget | null) => {
        const el = target as HTMLElement | null;
        if (!el) return false;
        return (
            el.tagName === "INPUT" ||
            el.tagName === "TEXTAREA" ||
            el.tagName === "SELECT" ||
            el.isContentEditable
        );
    }, []);

    const isTimelineWheel = useCallback(
        (event: LaneWheelEvent) => {
            const target = event.target;
            if (!(target instanceof Element)) return false;
            if (isEditableTarget(target)) return false;
            if (target.closest('[data-inspector="true"]')) return false;
            if (!target.closest('[data-lane="true"]')) return false;
            if (event.deltaY === 0) return false;
            if (!isVertical) return true;
            if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return false;
            // Configured time shortcuts take priority over Shift+wheel scrolling.
            return (
                !event.shiftKey ||
                matchesShortcutRef.current("timeRange.zoomIn", event) ||
                matchesShortcutRef.current("timeRange.zoomOut", event) ||
                matchesShortcutRef.current("timeRange.panUp", event) ||
                matchesShortcutRef.current("timeRange.panDown", event)
            );
        },
        [isEditableTarget, isVertical],
    );

    useEffect(() => {
        latestProjectRef.current = objProject;
    }, [objProject]);

    useEffect(() => {
        latestAudioDataRef.current = audioDataList;
    }, [audioDataList]);

    useEffect(() => {
        latestTimeViewRef.current = timeView;
    }, [timeView]);

    useEffect(() => {
        latestSpectrumViewRef.current = spectrumView;
    }, [spectrumView]);

    useEffect(() => {
        latestSetTimeViewRef.current = setTimeView;
    }, [setTimeView]);

    useEffect(() => {
        const unregisterTimeView = registerPersistSlice<TimeViewSettings>({
            key: "timeView",
            getState: () => latestTimeViewRef.current,
            applyState: (state) => {
                setTimeView(state);
            },
            deserialize: (raw) => {
                if (!raw || typeof raw !== "object") {
                    return { ...latestTimeViewRef.current, orientation: "horizontal" };
                }
                const candidate = raw as Partial<TimeViewSettings>;
                return {
                    currentTime:
                        typeof candidate.currentTime === "number" &&
                        Number.isFinite(candidate.currentTime) &&
                        candidate.currentTime >= 0
                            ? candidate.currentTime
                            : latestTimeViewRef.current.currentTime,
                    timeMultiplier:
                        typeof candidate.timeMultiplier === "number" &&
                        Number.isFinite(candidate.timeMultiplier) &&
                        candidate.timeMultiplier > 0
                            ? candidate.timeMultiplier
                            : latestTimeViewRef.current.timeMultiplier,
                    orientation:
                        candidate.orientation === "vertical" ? "vertical" : "horizontal",
                };
            },
        });

        const unregisterSpectrumView =
            registerPersistSlice<SpectrumViewSettings>({
                key: "spectrumView",
                getState: () => latestSpectrumViewRef.current,
                applyState: (state) => {
                    setSpectrumView(state);
                },
                deserialize: (raw) => {
                    if (!raw || typeof raw !== "object") {
                        return latestSpectrumViewRef.current;
                    }
                    const candidate = raw as Partial<SpectrumViewSettings>;
                    return {
                        brightnessOffset:
                            typeof candidate.brightnessOffset === "number" &&
                            Number.isFinite(candidate.brightnessOffset)
                                ? candidate.brightnessOffset
                                : latestSpectrumViewRef.current
                                      .brightnessOffset,
                        resolutionScale:
                            typeof candidate.resolutionScale === "number" &&
                            Number.isFinite(candidate.resolutionScale) &&
                            candidate.resolutionScale > 0
                                ? candidate.resolutionScale
                                : latestSpectrumViewRef.current.resolutionScale,
                    };
                },
            });

        return () => {
            unregisterTimeView();
            unregisterSpectrumView();
        };
    }, [setSpectrumView, setTimeView]);

    const beginProjectLoad = useCallback(() => {
        autosaveBlockedRef.current = true;
        return ++projectLoadRequestRef.current;
    }, []);

    const recoverPersistedProject = useCallback(async () => {
        const request = beginProjectLoad();
        setHasHydratedProject(false);
        setIsRecoveringProject(true);
        try {
            const restored = await hydrateProjectSnapshot();
            if (request !== projectLoadRequestRef.current) return;
            if (restored) {
                applyPersistSliceStates({
                    timeView: { orientation: "horizontal" },
                    ...restored.slices,
                });
                setProject(restored.projectState);
                setAudioDataList(restored.audioDataList);
            }
            setHydrationError(null);
            setProjectImportError(null);
            setHasHydratedProject(true);
            autosaveBlockedRef.current = false;
        } catch (error) {
            if (request !== projectLoadRequestRef.current) return;
            console.error("Hydrating persisted project failed", error);
            setHydrationError(`恢复本地项目失败：${error instanceof Error ? error.message : "未知错误"}`);
        } finally {
            if (request === projectLoadRequestRef.current) {
                setIsRecoveringProject(false);
            }
        }
    }, [beginProjectLoad]);

    useEffect(() => {
        void recoverPersistedProject();
        return () => {
            // Ignore hydration results after unmount, reset or explicit import.
            beginProjectLoad();
        };
    }, [recoverPersistedProject, beginProjectLoad]);

    useEffect(() => {
        if (!hasHydratedProject || hydrationError) {
            return;
        }

        const timeoutId = window.setTimeout(() => {
            if (autosaveBlockedRef.current) return;
            void saveProjectSnapshot({
                projectState: {
                    ...latestProjectRef.current,
                    isPlaying: false,
                },
                audioDataList: latestAudioDataRef.current,
                slices: collectPersistSliceStates(),
            }).catch((error) => {
                console.error("Saving project snapshot failed", error);
            });
        }, 350);

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [hasHydratedProject, hydrationError, objProject, audioDataList, timeView, spectrumView]);

    function setIndexSoundLaneState(index: number, update: SoundLaneStateUpdate) {
        setProject((prev) => {
            const currentLane = prev.soundLaneStates[index];
            if (!currentLane) return prev;
            const laneState = typeof update === "function" ? update(currentLane) : update;
            if (laneState === currentLane) return prev;
            const lanes = [...prev.soundLaneStates];
            lanes[index] = laneState;
            return {
                ...prev,
                soundLaneStates: lanes,
            };
        });
    }

    function setSoundLaneStates(newlanes: SoundLaneState[]) {
        setProject((prev) => ({
            ...prev,
            soundLaneStates: newlanes,
        }));
    }

    function removeAudioData(audioId: string) {
        // 删除音频和对应的状态
        setAudioDataList((prev) => prev.filter((a) => a.id !== audioId));
        setProject((prev) => ({
            ...prev,
            soundLaneStates: prev.soundLaneStates.filter(
                (state) => state.audioId !== audioId,
            ),
        }));
    }

    function removeMultipleAudioData(audioIds: string[]) {
        // 删除多个音频和对应的状态
        const idsSet = new Set(audioIds);
        setAudioDataList((prev) => prev.filter((a) => !idsSet.has(a.id)));
        setProject((prev) => ({
            ...prev,
            soundLaneStates: prev.soundLaneStates.filter(
                (state) => !idsSet.has(state.audioId),
            ),
        }));
    }

    function setTimeMultiplier(newm: number) {
        setProject((prev) => {
            if (prev.isPlaying) {
                return { ...prev, timeMultiplier: newm };
            }
            const nextSpan = getVisibleSpan(navigationDuration, newm);
            const nextMaxStart = Math.max(0, navigationDuration - nextSpan);
            return {
                ...prev,
                timeMultiplier: newm,
                currentTime: clamp(prev.currentTime, 0, nextMaxStart),
            };
        });
    }

    function setCurrentTime(newt: number) {
        setProject((prev) => {
            let nextCurrentTime: number;
            if (prev.isPlaying) {
                nextCurrentTime = Math.max(0, newt);
            } else {
                const currentSpan = getVisibleSpan(navigationDuration, prev.timeMultiplier);
                const currentMaxStart = Math.max(0, navigationDuration - currentSpan);
                nextCurrentTime = clamp(newt, 0, currentMaxStart);
            }

            if (prev.currentTime === nextCurrentTime) {
                return prev;
            }

            return {
                ...prev,
                currentTime: nextCurrentTime,
            };
        });
    }

    function setPlayheadOffset(offset: number) {
        setProject((prev) => ({
            ...prev,
            playheadOffset: Math.max(0, offset),
        }));
    }

    function addAudioData(audioData: AudioData) {
        setAudioDataList((prev) => [...prev, audioData]);

        // 同时添加一个新的 SoundLaneState
        const nextLane = defaultSoundLaneState(audioData.id);
        nextLane.spectrumLane = {
            ...nextLane.spectrumLane,
            brightnessOffset: spectrumView.brightnessOffset,
            resolutionScale: spectrumView.resolutionScale,
        };

        setProject((prev) => ({
            ...prev,
            soundLaneStates: [...prev.soundLaneStates, nextLane],
        }));

    }

    function resetEditor() {
        const request = beginProjectLoad();
        setHasHydratedProject(false);
        setHydrationError(null);
        setProjectImportError(null);
        setIsRecoveringProject(false);
        setProject(defaultProject());
        setAudioDataList([]);
        resetProjectScopedSettings();

        void clearPersistence().then(() => {
            if (request !== projectLoadRequestRef.current) return;
            autosaveBlockedRef.current = false;
            setHasHydratedProject(true);
        }).catch((error: unknown) => {
            if (request !== projectLoadRequestRef.current) return;
            console.error("Clearing persisted project failed", error);
            setHydrationError(`重置本地项目失败：${error instanceof Error ? error.message : "未知错误"}`);
        });
    }

    const handleExport = useCallback(() => {
        const snapshot = {
            version: 1 as const,
            key: "current",
            savedAt: Date.now(),
            project: stripProjectChartTimes({
                ...objProject,
                isPlaying: false,
            }),
            audioRefs: toAudioRefs(audioDataList),
            slices: collectPersistSliceStates(),
        };
        const blob = exportProjectBlob({ snapshot, audioDataList });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const ts = formatLocalExportTimestamp(new Date());
        a.download = `explicitize-${ts}.7z`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, [objProject, audioDataList]);

    const handleImport = useCallback(() => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".7z";
        input.onchange = () => {
            const file = input.files?.[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = () => {
                try {
                    if (!(reader.result instanceof ArrayBuffer)) throw new Error("项目文件读取结果无效");
                    const result = importProjectBlob(reader.result);
                    if ("error" in result) throw new Error(result.error);
                    const hydrated = hydrateImportedSnapshot({
                        snapshot: result.snapshot,
                        audioDataList: result.audioDataList,
                    });
                    applyPersistSliceStates({
                        timeView: { orientation: "horizontal" },
                        ...hydrated.slices,
                    });
                    beginProjectLoad();
                    setProject(hydrated.projectState);
                    setAudioDataList(hydrated.audioDataList);
                    setHydrationError(null);
                    setProjectImportError(null);
                    setIsRecoveringProject(false);
                    setHasHydratedProject(true);
                    autosaveBlockedRef.current = false;
                } catch (error) {
                    // Failed imports leave the current project and recovery
                    // lock intact, including malformed WDS migrations.
                    setProjectImportError(`导入项目失败：${error instanceof Error ? error.message : "未知错误"}`);
                }
            };
            reader.onerror = () => {
                setProjectImportError("读取项目文件失败");
            };
            try {
                reader.readAsArrayBuffer(file);
            } catch (error) {
                setProjectImportError(`读取项目文件失败：${error instanceof Error ? error.message : "未知错误"}`);
            }
        };
        input.click();
    }, [beginProjectLoad]);

    // Audio playback still ends at the real audio extent. WorkMenu's Duration
    // prop is used only by its view-range controller, not its audio player.
    const audioDuration = audioDataList.reduce(
        (max, audio) => Math.max(max, audio.duration),
        0,
    );

    const navigationDuration = useMemo(() => {
        let end = audioDuration;
        for (const soundLane of objProject.soundLaneStates) {
            const graphicalOffset = soundLane.noteLaneOffset ?? 0;
            for (const lane of soundLane.noteLanes) {
                if (lane.chartKind !== "wds") continue;
                try {
                    const notes = collectWdsNotes(lane.chartData, lane.defaultBpm);
                    const audioEndBeat = wdsTimeToBeat(
                        lane.chartData, Math.max(0, audioDuration - graphicalOffset), lane.defaultBpm,
                    );
                    let lastBeat = Math.max(
                        Math.ceil(audioEndBeat),
                        lane.chartData.reduce((count, segment) => count + segment.measures.length, 0),
                    );
                    for (const note of notes) {
                        lastBeat = Math.max(lastBeat, note.beat, note.tailBeat ?? note.beat);
                    }
                    const chartEnd = wdsBeatToTime(
                        lane.chartData, Math.ceil(lastBeat) + CHART_TRAILING_BEATS, lane.defaultBpm,
                    ) + graphicalOffset;
                    if (Number.isFinite(chartEnd)) end = Math.max(end, chartEnd);
                } catch {
                    // Invalid charts report their own lane error; valid lanes
                    // and the audio timeline must remain navigable.
                }
            }
        }
        // wdsOffset is export-only and intentionally does not enter the view.
        return end;
    }, [audioDuration, objProject.soundLaneStates]);

    const setIsPlaying = useCallback((playing: boolean) => {
        setProject((prev) => {
            const start = playing && !prev.isPlaying
                ? clamp(prev.currentTime, 0, Math.max(0,
                    navigationDuration - getVisibleSpan(navigationDuration, prev.timeMultiplier),
                ))
                : prev.currentTime;
            if (playing) {
                const selectedIds = new Set(prev.soundLaneStates
                    .filter((lane) => lane.isActive).map((lane) => lane.audioId));
                const playableEnd = audioDataList.reduce((end, audio) => (
                    selectedIds.size === 0 || selectedIds.has(audio.id)
                        ? Math.max(end, audio.duration) : end
                ), 0);
                // Browsing beyond the audio is valid; starting the audio player
                // there would give it no remaining audio and no completion time.
                if (start >= playableEnd) return { ...prev, isPlaying: false };
            }
            return { ...prev, currentTime: start, isPlaying: playing };
        });
    }, [audioDataList, navigationDuration]);

    const visibleSpan = useMemo(
        () => getVisibleSpan(navigationDuration, objProject.timeMultiplier),
        [navigationDuration, objProject.timeMultiplier],
    );
    const maxStart = useMemo(
        () => Math.max(0, navigationDuration - visibleSpan),
        [navigationDuration, visibleSpan],
    );
    const clampedCurrentTime = useMemo(
        () => clamp(objProject.currentTime, 0, maxStart),
        [objProject.currentTime, maxStart],
    );

    const timeRange = useMemo(
        (): [number, number] => [clampedCurrentTime, clampedCurrentTime + visibleSpan],
        [clampedCurrentTime, visibleSpan],
    );

    const laneTimeRange = useMemo((): [number, number] => {
        if (objProject.isPlaying) {
            const laneStart = objProject.currentTime - objProject.playheadOffset;
            return [laneStart, laneStart + visibleSpan];
        }
        return [clampedCurrentTime, clampedCurrentTime + visibleSpan];
    }, [objProject.currentTime, objProject.isPlaying, objProject.playheadOffset, visibleSpan, clampedCurrentTime]);

    const playheadTime = useMemo(
        () => (objProject.isPlaying ? objProject.currentTime : null),
        [objProject.isPlaying, objProject.currentTime],
    );

    const limitedLaneTimeRange = useMemo((): [number, number] => {
        if (objProject.isPlaying) {
            const laneStart = limitedPlaybackTime - objProject.playheadOffset;
            return [laneStart, laneStart + visibleSpan];
        }
        return [clampedCurrentTime, clampedCurrentTime + visibleSpan];
    }, [
        objProject.isPlaying,
        limitedPlaybackTime,
        objProject.playheadOffset,
        visibleSpan,
        clampedCurrentTime,
    ]);

    const limitedPlayheadTime = useMemo(
        () => (objProject.isPlaying ? limitedPlaybackTime : null),
        [objProject.isPlaying, limitedPlaybackTime],
    );

    const sortedLaneEntries = useMemo(() => {
        const entries = audioDataList.map((audio, i) => ({
            audio,
            state: objProject.soundLaneStates[i],
            index: i,
        }));
        const sorted = [...entries].sort((a, b) => {
            const aActive = a.state?.isActive ? 1 : 0;
            const bActive = b.state?.isActive ? 1 : 0;
            return bActive - aActive;
        });
        return sorted;
    }, [audioDataList, objProject.soundLaneStates]);

    const audibleAudioIds = useMemo(() => {
        const activeIds = objProject.soundLaneStates
            .filter((state) => state?.isActive)
            .map((state) => state.audioId);
        if (activeIds.length > 0) {
            return new Set(activeIds);
        }
        return new Set(audioDataList.map((audio) => audio.id));
    }, [audioDataList, objProject.soundLaneStates]);

    const fullRateAudioId = useMemo(() => {
        if (!objProject.isPlaying) return null;
        const topAudible = sortedLaneEntries.find((entry) =>
            audibleAudioIds.has(entry.audio.id),
        );
        return topAudible?.audio.id ?? null;
    }, [audibleAudioIds, objProject.isPlaying, sortedLaneEntries]);

    useEffect(() => {
        if (objProject.isPlaying) return;
        setLimitedPlaybackTime(objProject.currentTime);
    }, [objProject.currentTime, objProject.isPlaying]);

    useEffect(() => {
        if (!objProject.isPlaying) return;

        let rafId: number | null = null;
        let lastCommit = 0;

        const tick = (timestamp: number) => {
            if (
                lastCommit === 0 ||
                timestamp - lastCommit >= LIMITED_PLAYBACK_INTERVAL_MS
            ) {
                lastCommit = timestamp;
                setLimitedPlaybackTime(latestProjectRef.current.currentTime);
            }
            rafId = requestAnimationFrame(tick);
        };

        rafId = requestAnimationFrame(tick);

        return () => {
            if (rafId !== null) {
                cancelAnimationFrame(rafId);
            }
        };
    }, [objProject.isPlaying]);

    useEffect(() => {
        if (!hasHydratedSettings) return;
        if (!hasHydratedProject) return;
        if (objProject.isPlaying) return;
        if (
            timeView.currentTime === objProject.currentTime &&
            timeView.timeMultiplier === objProject.timeMultiplier
        ) {
            return;
        }

        setTimeView({
            currentTime: objProject.currentTime,
            timeMultiplier: objProject.timeMultiplier,
        });
    }, [
        hasHydratedSettings,
        hasHydratedProject,
        objProject.isPlaying,
        objProject.currentTime,
        objProject.timeMultiplier,
        timeView.currentTime,
        timeView.timeMultiplier,
        setTimeView,
    ]);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.code !== "Space" && event.key !== " ") {
                return;
            }

            const target = event.target as HTMLElement | null;
            if (
                target &&
                (target.tagName === "INPUT" ||
                    target.tagName === "TEXTAREA" ||
                    target.tagName === "SELECT" ||
                    target.isContentEditable)
            ) {
                return;
            }

            if (audioDuration <= 0) {
                return;
            }

            event.preventDefault();
            setIsPlaying(!objProject.isPlaying);
        };

        window.addEventListener("keydown", onKeyDown);
        return () => {
            window.removeEventListener("keydown", onKeyDown);
        };
    }, [audioDuration, objProject.isPlaying, setIsPlaying]);

    useEffect(() => {
        const onNativeWheel = (event: WheelEvent) => {
            const card = editorLaneCardRef.current;
            if (!card) return;
            const target = event.target as HTMLElement | null;
            if (!target || !card.contains(target)) return;
            if (!isTimelineWheel(event)) return;
            event.preventDefault();
        };

        const onAltKey = (event: KeyboardEvent) => {
            if (event.key !== "Alt") return;
            if (isEditableTarget(event.target)) return;
            event.preventDefault();
        };

        window.addEventListener("wheel", onNativeWheel, {
            passive: false,
            capture: true,
        });
        window.addEventListener("keydown", onAltKey, true);
        window.addEventListener("keyup", onAltKey, true);

        return () => {
            window.removeEventListener("wheel", onNativeWheel, true);
            window.removeEventListener("keydown", onAltKey, true);
            window.removeEventListener("keyup", onAltKey, true);
        };
    }, [isEditableTarget, isTimelineWheel]);

    const handleLaneWheel = useCallback(
        (event: LaneWheelEvent) => {
            if (navigationDuration <= 0) return;
            if (wheelUpdateGuardRef.current) return;
            if (!isTimelineWheel(event)) return;

            const isZoomIn = matchesShortcutRef.current("timeRange.zoomIn", event);
            const isZoomOut = matchesShortcutRef.current("timeRange.zoomOut", event);
            const isPanUp = matchesShortcutRef.current("timeRange.panUp", event);
            const isPanDown = matchesShortcutRef.current("timeRange.panDown", event);

            if (!isZoomIn && !isZoomOut && !isPanUp && !isPanDown) {
                return;
            }

            event.stopPropagation();
            wheelUpdateGuardRef.current = true;
            requestAnimationFrame(() => {
                wheelUpdateGuardRef.current = false;
            });

            const current = latestProjectRef.current;

            if (isZoomIn || isZoomOut) {
                const nextMultiplier = getNextTimeMultiplierByWheel(
                    navigationDuration,
                    current.timeMultiplier,
                    event.deltaY,
                );
                const nextSpan = getVisibleSpan(navigationDuration, nextMultiplier);
                const maxStart = Math.max(0, navigationDuration - nextSpan);
                const nextCurrentTime = current.isPlaying
                    ? current.currentTime
                    : clamp(current.currentTime, 0, maxStart);

                if (
                    current.timeMultiplier === nextMultiplier &&
                    current.currentTime === nextCurrentTime
                ) {
                    return;
                }

                setProject((prev) => ({
                    ...prev,
                    timeMultiplier: nextMultiplier,
                    currentTime: nextCurrentTime,
                }));
                latestSetTimeViewRef.current({
                    currentTime: nextCurrentTime,
                    timeMultiplier: nextMultiplier,
                });
                return;
            }

            // Pan: skip when playing
            if (current.isPlaying) return;

            const panDirection = (isPanUp ? -1 : 1) * (isVertical ? -1 : 1);
            const visibleSpan = getVisibleSpan(navigationDuration, current.timeMultiplier);
            const maxStart = Math.max(0, navigationDuration - visibleSpan);
            const panStep = visibleSpan * WHEEL_PAN_RATIO;
            const nextCurrentTime = clamp(
                clamp(current.currentTime, 0, maxStart) + panDirection * panStep,
                0,
                maxStart,
            );

            if (nextCurrentTime === current.currentTime) {
                return;
            }

            setProject((prev) => ({
                ...prev,
                currentTime: nextCurrentTime,
            }));
            latestSetTimeViewRef.current({
                currentTime: nextCurrentTime,
                timeMultiplier: current.timeMultiplier,
            });
        },
        [navigationDuration, isTimelineWheel, isVertical],
    );

    useEffect(() => {
        const card = editorLaneCardRef.current;
        if (!card) return;

        const onLaneWheel = (event: WheelEvent) => {
            handleLaneWheel(event);
        };

        card.addEventListener("wheel", onLaneWheel, {
            passive: false,
        });

        return () => {
            card.removeEventListener("wheel", onLaneWheel);
        };
    }, [handleLaneWheel]);

    return (
        <AudioDataCtx.Provider value={audioDataList}>
            <div className="WorkArea" ref={workAreaRef}>
                <div className="editor-shell flex flex-col">
                    {/* Menu */}
                    <div className="relative z-50 flex shrink-0">
                        <div className="editor-toolbar-card">
                            <WorkMenu
                                key={"menu"}
                                setSoundLaneStates={setSoundLaneStates}
                                refSoundLaneStates={objProject.soundLaneStates}
                                refTimeMultiplier={objProject.timeMultiplier}
                                setTimeMultiplier={setTimeMultiplier}
                                refCurrentTime={clampedCurrentTime}
                                setCurrentTime={setCurrentTime}
                                isPlaying={objProject.isPlaying}
                                setIsPlaying={setIsPlaying}
                                Duration={navigationDuration}
                                timeRange={timeRange}
                                addAudioData={addAudioData}
                                removeAudioData={removeAudioData}
                                removeMultipleAudioData={
                                    removeMultipleAudioData
                                }
                                resetEditor={resetEditor}
                                onExport={handleExport}
                                onImport={handleImport}
                                playheadOffset={objProject.playheadOffset}
                                setPlayheadOffset={setPlayheadOffset}
                                orientation={orientation}
                                onOrientationChange={(next) => setTimeView({ orientation: next })}
                            />
                        </div>
                    </div>
                    {hydrationError && (
                        <div role="alert" className="shrink-0 border border-red-300 bg-red-50 p-2 text-sm text-red-900">
                            <p>{hydrationError}</p>
                            <p>原有本地快照已保留，自动保存已暂停。可重试恢复，或使用工具栏导入项目、重置编辑器。</p>
                            <button
                                type="button"
                                className="editor-toolbar-button mt-1"
                                disabled={isRecoveringProject}
                                onClick={() => void recoverPersistedProject()}
                            >
                                {isRecoveringProject ? "正在恢复…" : "重试恢复"}
                            </button>
                        </div>
                    )}
                    {projectImportError && (
                        <div role="alert" className="shrink-0 border border-red-300 bg-red-50 p-2 text-sm text-red-900">
                            {projectImportError}
                        </div>
                    )}
                    {/* Sound Lanes */}
                    <div className={styles.laneViewport}>
                        <div
                            className={`editor-lane-card ${styles.laneCard} ${isVertical ? styles.verticalLaneCard : ""}`}
                            ref={editorLaneCardRef}
                            role={isVertical ? "region" : undefined}
                            aria-label={isVertical ? "音频编辑区，可横向滚动" : undefined}
                            tabIndex={isVertical ? 0 : undefined}
                        >
                            <div className={isVertical ? styles.verticalLaneList : "flex flex-col gap-2"}>
                                {sortedLaneEntries.map((entry) => {
                                    const isAudible = audibleAudioIds.has(
                                        entry.audio.id,
                                    );
                                    const playbackRenderMode = !objProject.isPlaying
                                        ? "idle"
                                        : !isAudible
                                          ? "frozen"
                                          : entry.audio.id === fullRateAudioId
                                            ? "full"
                                            : "limited";
                                    const renderTimeRange =
                                        playbackRenderMode === "frozen"
                                            ? FROZEN_TIME_RANGE
                                            : playbackRenderMode === "limited"
                                              ? limitedLaneTimeRange
                                              : laneTimeRange;
                                    const renderPlayheadTime =
                                        playbackRenderMode === "frozen"
                                            ? null
                                            : playbackRenderMode === "limited"
                                              ? limitedPlayheadTime
                                              : isAudible
                                                ? playheadTime
                                                : null;

                                    return (
                                        <SoundLane
                                            key={`audio-${entry.audio.id}`}
                                            index={entry.index}
                                            audioId={entry.audio.id}
                                            refSoundLaneState={
                                                objProject.soundLaneStates[
                                                    entry.index
                                                ]
                                            }
                                            setSoundLaneState={
                                                setIndexSoundLaneState
                                            }
                                            timeRange={renderTimeRange}
                                            orientation={orientation}
                                            onRequestVertical={() => setTimeView({ orientation: "vertical" })}
                                            playheadTime={renderPlayheadTime}
                                            playbackRenderMode={
                                                playbackRenderMode
                                            }
                                            onActivate={setActiveSoundLaneId}
                                            onDeleteSoundLane={removeAudioData}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                    {/* About */}
                    <footer className={styles.footer}>
                        <p className="font-medium text-stone-600">Explicitize - A rhythm annotating tool</p>
                        <a
                            href="https://github.com/OhnkytaBlabdey/rhythm_annotating"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline hover:text-stone-700 transition-colors"
                        >
                            GitHub Repository
                        </a>
                    </footer>
                </div>
            </div>
        </AudioDataCtx.Provider>
    );
}
