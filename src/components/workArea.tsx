"use client";
import { useContext, useState } from "react";
import style from "./workArea.module.css";
import { defaultProject, project } from "@/interface/project";
import SoundLane from "./soundArea/soundLane";
import WorkMenu from "./menuArea/workMenu";
import { soundlane } from "@/interface/soundLane/soundlane";
import { AudioDataCtx } from "./audioContext";

export default function WorkArea() {
    const [objProject, setProject] = useState<project>(defaultProject());
    const audios = useContext(AudioDataCtx);
    function setIndexSoundLane(index: number, lane: soundlane) {
        const lanes = [...objProject.soundLanes];
        lanes[index] = lane;
        setProject({
            ...objProject,
            soundLanes: lanes,
        });
    }
    function setSoundLanes(newlanes: soundlane[]) {
        setProject({
            ...objProject,
            soundLanes: newlanes,
        });
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

    return (
        <div className="WorkArea">
            <AudioDataCtx value={[]}>
                <div className="flex flex-col">
                    {/* Menu */}
                    <div className="flex px-12 py-2 ">
                        <div className="rounded-lg border border-gray-300 p-4 w-7/8 mx-auto">
                            <WorkMenu
                                setSoundLanes={setSoundLanes}
                                refSoundLanes={objProject.soundLanes}
                                refTimeMultiplier={objProject.timeMultiplier}
                                setTimeMultiplier={setTimeMultiplier}
                                refCurrentTime={objProject.currentTime}
                                setCurrentTime={setCurrentTime}
                                isPlaying={objProject.isPlaying}
                                setIsPlaying={setIsPlaying}
                                Duration={objProject.soundLanes.reduce(
                                    (max, lane) => Math.max(max, lane.duration),
                                    0,
                                )}
                            />
                        </div>
                    </div>
                    {/* Sound Lanes */}
                    <div className="flex flex-col gap-4 px-10 py-2">
                        <div className="rounded-lg border border-gray-300 p-4">
                            <div className="w-7/8 mx-auto">
                                {objProject.soundLanes.map((lane, index) => (
                                    <SoundLane
                                        key={index}
                                        index={index}
                                        soundFile={lane.mediaFilePath}
                                        refSoundLane={lane}
                                        setSoundLane={setIndexSoundLane}
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
            </AudioDataCtx>
        </div>
    );
}
