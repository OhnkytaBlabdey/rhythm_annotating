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
import { getNextTimeMultiplierByWheel, getVisibleSpan } from "./timeViewUtils";

export default function WorkArea() {
    const { hasHydratedSettings, matchesShortcut, setTimeView, timeView } =
        useAppSettings();
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
        setProject((prev) => ({
            ...prev,
            timeMultiplier: newm,
        }));
    }

    function setCurrentTime(newt: number) {
        setProject((prev) => ({
            ...prev,
            currentTime: newt,
        }));
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
        setSoundLaneStates([
            ...objProject.soundLaneStates,
            defaultSoundLaneState(audioData.id),
        ]);
    }

    // 计算总时长
    const duration = useMemo(
        () =>
            audioDataList.reduce(
                (max, audio) => Math.max(max, audio.duration),
                0,
            ),
        [audioDataList],
    );

    useEffect(() => {
        if (!hasHydratedSettings) return;
        setTimeView({
            currentTime: objProject.currentTime,
            timeMultiplier: objProject.timeMultiplier,
        });
    }, [
        hasHydratedSettings,
        objProject.currentTime,
        objProject.timeMultiplier,
        setTimeView,
    ]);

    function handleLaneWheel(event: React.WheelEvent<HTMLDivElement>) {
        if (duration <= 0) return;
        if (
            !matchesShortcut("timeRange.zoomIn", event) &&
            !matchesShortcut("timeRange.zoomOut", event)
        ) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        const nextMultiplier = getNextTimeMultiplierByWheel(
            duration,
            objProject.timeMultiplier,
            event.deltaY,
        );
        const nextSpan = getVisibleSpan(duration, nextMultiplier);
        const maxStart = Math.max(0, duration - nextSpan);

        setProject((prev) => ({
            ...prev,
            timeMultiplier: nextMultiplier,
            currentTime: Math.min(Math.max(0, prev.currentTime), maxStart),
        }));
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
                                refCurrentTime={objProject.currentTime}
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
                                            objProject.currentTime,
                                            objProject.currentTime +
                                                objProject.timeMultiplier * 2.0,
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
