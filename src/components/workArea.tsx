"use client";
import { useState } from "react";
import { defaultProject, project } from "@/interface/project";
import SoundLane from "./soundArea/soundLane";
import WorkMenu from "./menuArea/workMenu";
import {
    SoundLaneState,
    defaultSoundLaneState,
    AudioData,
} from "@/interface/audioData";
import { AudioDataCtx } from "./audioContext";

export default function WorkArea() {
    const [objProject, setProject] = useState<project>(defaultProject());
    const [audioDataList, setAudioDataList] = useState<AudioData[]>([]);

    function setIndexSoundLaneState(index: number, laneState: SoundLaneState) {
        const lanes = [...objProject.soundLaneStates];
        lanes[index] = laneState;
        setProject({
            ...objProject,
            soundLaneStates: lanes,
        });
    }

    function setSoundLaneStates(newlanes: SoundLaneState[]) {
        setProject({
            ...objProject,
            soundLaneStates: newlanes,
        });
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

    function setTimeMultiplier(newm: number) {
        setProject({
            ...objProject,
            timeMultiplier: newm,
        });
    }

    function setCurrentTime(newt: number) {
        setProject({
            ...objProject,
            currentTime: newt,
        });
    }

    function setIsPlaying(p: boolean) {
        setProject({
            ...objProject,
            isPlaying: p,
        });
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
    const getDuration = () => {
        return audioDataList.reduce(
            (max, audio) => Math.max(max, audio.duration),
            0,
        );
    };

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
                                Duration={getDuration()}
                                addAudioData={addAudioData}
                                removeAudioData={removeAudioData}
                            />
                        </div>
                    </div>
                    {/* Sound Lanes */}
                    <div className="flex flex-col gap-4 px-10 py-2">
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
