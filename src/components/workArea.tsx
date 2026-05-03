"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { defaultProject, project } from "@/interface/project";
import SoundLane from "./soundArea/soundLane";
import WorkMenu from "./menuArea/workMenu";
import {
    SoundLaneState,
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
    saveProjectSnapshot,
} from "@/lib/persistence/projectSnapshot";
import { clearPersistence } from "@/lib/persistence/indexedDb";
import {
    applyPersistSliceStates,
    collectPersistSliceStates,
    registerPersistSlice,
} from "@/lib/persistence/sliceRegistry";

const WHEEL_PAN_RATIO = 0.05;

type LaneWheelEvent = Pick<
    WheelEvent,
    "deltaY" | "altKey" | "ctrlKey" | "metaKey" | "shiftKey" | "target"
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
    const [objProject, setProject] = useState<project>(() => ({
        ...defaultProject(),
        currentTime: timeView.currentTime,
        timeMultiplier: timeView.timeMultiplier,
    }));
    const [audioDataList, setAudioDataList] = useState<AudioData[]>([]);
    const [hasHydratedProject, setHasHydratedProject] = useState(false);
    const workAreaRef = useRef<HTMLDivElement | null>(null);
    const editorLaneCardRef = useRef<HTMLDivElement | null>(null);
    const wheelUpdateGuardRef = useRef(false);
    const matchesShortcutRef = useRef(matchesShortcut);
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

    useEffect(() => {
        latestProjectRef.current = objProject;
    }, [objProject]);

    useEffect(() => {
        matchesShortcutRef.current = matchesShortcut;
    }, [matchesShortcut]);

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
                    return latestTimeViewRef.current;
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

    useEffect(() => {
        let isCancelled = false;

        const hydrate = async () => {
            try {
                const restored = await hydrateProjectSnapshot();
                if (!restored || isCancelled) {
                    return;
                }

                setProject(restored.projectState);
                setAudioDataList(restored.audioDataList);
                applyPersistSliceStates(restored.slices);
            } catch (error) {
                console.error("Hydrating persisted project failed", error);
            } finally {
                if (!isCancelled) {
                    setHasHydratedProject(true);
                }
            }
        };

        void hydrate();

        return () => {
            isCancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!hasHydratedProject) {
            return;
        }

        const timeoutId = window.setTimeout(() => {
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
    }, [hasHydratedProject, objProject, audioDataList, timeView, spectrumView]);

    function setIndexSoundLaneState(index: number, laneState: SoundLaneState) {
        setProject((prev) => {
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
            const nextSpan = getVisibleSpan(duration, newm);
            const nextMaxStart = Math.max(0, duration - nextSpan);
            return {
                ...prev,
                timeMultiplier: newm,
                currentTime: clamp(prev.currentTime, 0, nextMaxStart),
            };
        });
    }

    function setCurrentTime(newt: number) {
        setProject((prev) => {
            const currentSpan = getVisibleSpan(duration, prev.timeMultiplier);
            const currentMaxStart = Math.max(0, duration - currentSpan);
            const nextCurrentTime = clamp(newt, 0, currentMaxStart);

            if (prev.currentTime === nextCurrentTime) {
                return prev;
            }

            return {
                ...prev,
                currentTime: nextCurrentTime,
            };
        });
    }

    function setIsPlaying(p: boolean) {
        setProject((prev) => ({
            ...prev,
            isPlaying: p,
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
        setProject(defaultProject());
        setAudioDataList([]);
        resetProjectScopedSettings();

        void clearPersistence().catch((error: unknown) => {
            console.error("Clearing persisted project failed", error);
        });
    }

    // 计算总时长
    const duration = audioDataList.reduce(
        (max, audio) => Math.max(max, audio.duration),
        0,
    );

    const visibleSpan = useMemo(
        () => getVisibleSpan(duration, objProject.timeMultiplier),
        [duration, objProject.timeMultiplier],
    );
    const maxStart = useMemo(
        () => Math.max(0, duration - visibleSpan),
        [duration, visibleSpan],
    );
    const clampedCurrentTime = useMemo(
        () => clamp(objProject.currentTime, 0, maxStart),
        [objProject.currentTime, maxStart],
    );

    const timeRange = useMemo(
        (): [number, number] => [clampedCurrentTime, clampedCurrentTime + visibleSpan],
        [clampedCurrentTime, visibleSpan],
    );

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

            if (duration <= 0) {
                return;
            }

            event.preventDefault();
            setProject((prev) => ({
                ...prev,
                isPlaying: !prev.isPlaying,
            }));
        };

        window.addEventListener("keydown", onKeyDown);
        return () => {
            window.removeEventListener("keydown", onKeyDown);
        };
    }, [duration]);

    useEffect(() => {
        const onNativeWheel = (event: WheelEvent) => {
            const card = editorLaneCardRef.current;
            if (!card) return;
            const target = event.target as Node | null;
            if (!target || !card.contains(target)) return;
            if (isEditableTarget(event.target)) return;
            event.preventDefault();
        };

        const onAltKey = (event: KeyboardEvent) => {
            if (event.key !== "Alt") return;
            const card = editorLaneCardRef.current;
            if (!card) return;
            const target = event.target as Node | null;
            if (!target || !card.contains(target)) return;
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
    }, [isEditableTarget]);

    const handleLaneWheel = useCallback(
        (event: LaneWheelEvent) => {
            if (duration <= 0) return;
            if (wheelUpdateGuardRef.current) return;
            if (isEditableTarget(event.target)) return;

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
                    duration,
                    current.timeMultiplier,
                    event.deltaY,
                );
                const nextSpan = getVisibleSpan(duration, nextMultiplier);
                const maxStart = Math.max(0, duration - nextSpan);
                const nextCurrentTime = clamp(current.currentTime, 0, maxStart);

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

            const panDirection = isPanUp ? -1 : 1;
            const visibleSpan = getVisibleSpan(duration, current.timeMultiplier);
            const maxStart = Math.max(0, duration - visibleSpan);
            const panStep = visibleSpan * WHEEL_PAN_RATIO;
            const nextCurrentTime = clamp(
                current.currentTime + panDirection * panStep,
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
        [duration, isEditableTarget],
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
                    <div className="sticky top-0 z-50 flex">
                        <div className="editor-toolbar-card mb-2">
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
                                Duration={duration}
                                addAudioData={addAudioData}
                                removeAudioData={removeAudioData}
                                removeMultipleAudioData={
                                    removeMultipleAudioData
                                }
                                resetEditor={resetEditor}
                            />
                        </div>
                    </div>
                    {/* Sound Lanes */}
                    <div
                        className="flex flex-col gap-4 py-2"
                    >
                        <div className="editor-lane-card" ref={editorLaneCardRef}>
                            <div className="flex flex-col gap-4">
                                {audioDataList.map((audio, index) => (
                                    <SoundLane
                                        key={`audio-${audio.id}`}
                                        index={index}
                                        audioId={audio.id}
                                        refSoundLaneState={
                                            objProject.soundLaneStates[index]
                                        }
                                        setSoundLaneState={
                                            setIndexSoundLaneState
                                        }
                                        timeRange={timeRange}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AudioDataCtx.Provider>
    );
}
