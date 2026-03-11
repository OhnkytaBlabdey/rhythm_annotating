"use client";
import { useEffect, useMemo, useState } from "react";
import { defaultProject, project } from "@/interface/project";
import SoundLane from "./soundArea/soundLane";
import WorkMenu from "./menuArea/workMenu";
import {
    SoundLaneState,
    defaultSoundLaneState,
    AudioData,
} from "@/interface/audioData";
import { AudioDataCtx } from "./audioContext";
import { useAppSettings } from "./appSettingsContext";
import {
    clamp,
    getNextTimeMultiplierByWheel,
    getVisibleSpan,
} from "./timeViewUtils";

const WHEEL_PAN_RATIO = 0.05;

export default function WorkArea() {
    const {
        hasHydratedSettings,
        matchesShortcut,
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
        setAudioDataList(audioDataList.filter((a) => a.id !== audioId));
        setSoundLaneStates(
            objProject.soundLaneStates.filter(
                (state) => state.audioId !== audioId,
            ),
        );
    }

    function removeMultipleAudioData(audioIds: string[]) {
        // 删除多个音频和对应的状态
        const idsSet = new Set(audioIds);
        setAudioDataList(audioDataList.filter((a) => !idsSet.has(a.id)));
        setSoundLaneStates(
            objProject.soundLaneStates.filter(
                (state) => !idsSet.has(state.audioId),
            ),
        );
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
        setAudioDataList([...audioDataList, audioData]);
        // 同时添加一个新的 SoundLaneState
        const nextLane = defaultSoundLaneState(audioData.id);
        nextLane.spectrumLane = {
            ...nextLane.spectrumLane,
            brightnessOffset: spectrumView.brightnessOffset,
            resolutionScale: spectrumView.resolutionScale,
        };
        setSoundLaneStates([...objProject.soundLaneStates, nextLane]);
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

    useEffect(() => {
        if (!hasHydratedSettings) return;
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

    function handleLaneWheel(event: React.WheelEvent<HTMLDivElement>) {
        if (duration <= 0) return;

        const isZoomIn = matchesShortcut("timeRange.zoomIn", event);
        const isZoomOut = matchesShortcut("timeRange.zoomOut", event);
        const isPanUp = matchesShortcut("timeRange.panUp", event);
        const isPanDown = matchesShortcut("timeRange.panDown", event);

        if (!isZoomIn && !isZoomOut && !isPanUp && !isPanDown) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        if (isZoomIn || isZoomOut) {
            setProject((prev) => {
                const nextMultiplier = getNextTimeMultiplierByWheel(
                    duration,
                    prev.timeMultiplier,
                    event.deltaY,
                );
                const nextSpan = getVisibleSpan(duration, nextMultiplier);
                const maxStart = Math.max(0, duration - nextSpan);

                return {
                    ...prev,
                    timeMultiplier: nextMultiplier,
                    currentTime: clamp(prev.currentTime, 0, maxStart),
                };
            });
            return;
        }

        const panDirection = isPanUp ? -1 : 1;
        setProject((prev) => {
            const visibleSpan = getVisibleSpan(duration, prev.timeMultiplier);
            const maxStart = Math.max(0, duration - visibleSpan);
            const panStep = visibleSpan * WHEEL_PAN_RATIO;

            return {
                ...prev,
                currentTime: clamp(
                    prev.currentTime + panDirection * panStep,
                    0,
                    maxStart,
                ),
            };
        });
    }

    return (
        <AudioDataCtx.Provider value={audioDataList}>
            <div className="WorkArea">
                <div className="flex flex-col">
                    {/* Menu */}
                    <div className="flex px-12 py-2 ">
                        <div className="rounded-lg border border-gray-300 p-4 w-7/8 mx-auto">
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
                            />
                        </div>
                    </div>
                    {/* Sound Lanes */}
                    <div
                        className="flex flex-col gap-4 px-10 py-2"
                        onWheel={handleLaneWheel}
                    >
                        <div className="rounded-lg border border-gray-300 p-4">
                            <div className="w-7/8 mx-auto">
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
                                        timeRange={[
                                            clampedCurrentTime,
                                            clampedCurrentTime + visibleSpan,
                                        ]}
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
