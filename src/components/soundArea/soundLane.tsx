"use client";
import "./soundLane.module.css";
import SoundFileTitleBar from "./soundFileTitleBar";
import { NoteLane } from "./noteArea/noteLane";
import { notelane } from "@/interface/soundLane/noteLane/notelane";
import SoundMenu from "./menuArea/soundMenu";
import { soundlane } from "@/interface/soundLane/soundlane";
import WaveLane from "./waveArea/waveLane";

interface _prop {
    index: number;
    soundFile: string;
    timeRange: [number, number];
    refSoundLane: soundlane;
    setSoundLane: (i: number, l: soundlane) => void;
}

export default function SoundLane(prop: _prop) {
    function handleClickToActivate() {
        const updatedSoundLane = {
            ...prop.refSoundLane,
            isActive: !prop.refSoundLane.isActive,
        };
        prop.setSoundLane(prop.index, updatedSoundLane);
    }

    function setNoteLanes(newNoteLanes: notelane[]) {
        const updatedSoundLane = {
            ...prop.refSoundLane,
            noteLanes: newNoteLanes,
        };
        prop.setSoundLane(prop.index, updatedSoundLane);
    }

    return (
        <div
            className="SoundLane flex flex-col h-full cursor-pointer"
            onClick={handleClickToActivate}
        >
            <div className="w-auto">
                <SoundFileTitleBar
                    soundFile={prop.soundFile}
                    isActive={prop.refSoundLane.isActive || false}
                />
                <div>
                    {prop.timeRange[0].toFixed(4)} -{" "}
                    {prop.timeRange[1].toFixed(4)} second
                </div>
            </div>
            <div className="flex flex-1">
                <div className="w-auto" onClick={(e) => e.stopPropagation()}>
                    <SoundMenu
                        refNoteLanes={prop.refSoundLane.noteLanes}
                        setNoteLanes={setNoteLanes}
                    ></SoundMenu>
                </div>
                <div className="flex-1 overflow-auto">
                    {/* wave */}
                    <WaveLane
                        mediaFilePath={prop.soundFile}
                        waveLane={prop.refSoundLane.waveLane}
                        arrayBuffer={prop.refSoundLane.audioBuffer}
                        key={`${prop.index}-wave`}
                        timeRange={prop.timeRange}
                    />
                    {/* spectrum */}
                    {/* notes */}
                    {prop.refSoundLane.noteLanes.map((lane, index) => (
                        <NoteLane
                            key={`${prop.index}-${index}`}
                            Key={`${prop.index}-${index}`}
                            index={index}
                            refNoteLane={lane}
                            setNoteLane={(newlane) => {
                                const newlanes = prop.refSoundLane.noteLanes;
                                newlanes[index] = newlane;
                                setNoteLanes(newlanes);
                            }}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
