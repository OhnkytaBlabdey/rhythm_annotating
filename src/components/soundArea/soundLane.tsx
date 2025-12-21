"use client";
import "./soundLane.module.css";
import SoundFileTitleBar from "./soundFileTitleBar";
import { NoteLane } from "./noteArea/noteLane";
import { notelane } from "@/interface/soundLane/noteLane/notelane";
import SoundMenu from "./menuArea/soundMenu";
import { soundlane } from "@/interface/soundLane/soundlane";

interface _prop {
    index: number;
    soundFile: string;
    refSoundLane: soundlane;
    setSoundLane: (i: number, l: soundlane) => void;
}

export default function SoundLane(prop: _prop) {
    //TODO 只有点在其他地方才更新选中状态，否则不更新
    //看情况，如果其他轨激活，这个轨有可能要取消激活
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
            <div>
                <SoundFileTitleBar
                    soundFile={prop.soundFile}
                    isActive={prop.refSoundLane.isActive || false}
                />
            </div>
            <div className="flex flex-1">
                <div className="w-auto" onClick={(e) => e.stopPropagation()}>
                    <SoundMenu
                        refNoteLanes={prop.refSoundLane.noteLanes}
                        setNoteLanes={setNoteLanes}
                    ></SoundMenu>
                </div>
                <div className="flex-1 overflow-auto">
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
