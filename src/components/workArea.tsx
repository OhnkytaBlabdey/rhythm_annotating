"use client";
import { useState } from "react";
import style from "./workArea.module.css";
import { project } from "@/interface/project";
import SoundLane from "./soundArea/soundLane";
import WorkMenu from "./menuArea/workMenu";
import { soundlane } from "@/interface/soundLane/soundlane";

export default function WorkArea() {
    const [objProject, setProject] = useState<project>({
        currentTime: 0,
        duration: 0,
        isPlaying: false,
        playSpeed: 1,
        soundLanes: [
            {
                isActive: false,
                isPlayComplete: false,
                mediaFilePath: "example.mp3",
                noteLanes: [],
                offset: 0,
                spectrumLane: {
                    isFolded: false,
                    mediaFilePath: "example.mp3",
                    paletteSchema: "default",
                    timeMultiplier: 1,
                },
                waveLane: {
                    isFolded: false,
                    amplitudeMultiplier: 1,
                    mediaFilePath: "example.mp3",
                    timeMultiplier: 1,
                },
            },
        ],
    });
    function setSoundLane(index: number, lane: soundlane) {
        const lanes = [...objProject.soundLanes];
        lanes[index] = lane;
        setProject({
            ...objProject,
            soundLanes: lanes,
        });
    }
    return (
        <div className="WorkArea">
            <div className="flex flex-col">
                {/* Menu */}
                <div className="w-auto">
                    <WorkMenu />
                </div>
                {/* Sound Lanes */}
                <div className="flex flex-col gap-4 px-8 py-6">
                    <div className="rounded-lg border border-gray-300 p-4">
                        <div className="w-4/5 mx-auto">
                            {objProject.soundLanes.map((lane, index) => (
                                <SoundLane
                                    key={index}
                                    index={index}
                                    soundFile={lane.mediaFilePath}
                                    soundLaneData={lane}
                                    setSoundLane={setSoundLane}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
