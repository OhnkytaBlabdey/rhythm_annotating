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
    soundLaneData: soundlane;
    setSoundLane: (i: number, l: soundlane) => void;
}

export default function SoundLane(prop: _prop) {
    //TODO 只有点在其他地方才更新选中状态，否则不更新
    //看情况，如果其他轨激活，这个轨有可能要取消激活
    function handleClickToActivate() {
        const updatedSoundLane = {
            ...prop.soundLaneData,
            isActive: true,
        };
        prop.setSoundLane(prop.index, updatedSoundLane);
    }

    function setNoteLanes(newNoteLanes: notelane[]) {
        const updatedSoundLane = {
            ...prop.soundLaneData,
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
                    isActive={prop.soundLaneData.isActive || false}
                />
            </div>
            <div className="flex flex-1">
                <div className="w-auto" onClick={(e) => e.stopPropagation()}>
                    <SoundMenu
                        refNoteLanes={prop.soundLaneData.noteLanes}
                        setNoteLanes={setNoteLanes}
                    ></SoundMenu>
                </div>
                <div className="flex-1 overflow-auto">
                    {prop.soundLaneData.noteLanes.map((lane, index) => (
                        <NoteLane key={`${prop.index}-${index}`} />
                    ))}
                </div>
            </div>
        </div>
    );
}
