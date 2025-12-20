"use client";
import "./soundLane.module.css";
import { useState } from "react";
import SoundFileTitleBar from "./soundFileTitleBar";
import { NoteLane } from "./noteArea/noteLane";
import { notelane } from "@/interface/soundLane/noteLane/notelane";
import SoundMenu from "./menuArea/soundMenu";

interface _prop {
    soundFile: string;
    a?: string;
    isSelected?: boolean;
    onSelect?: () => void;
}

export default function SoundLane(prop: _prop) {
    const [objNoteLanes, setNoteLanes] = useState<Array<notelane>>([
        {
            startTime: 0,
            measures: [
                {
                    bpm: 60,
                    noBeat: false,
                    notes: [],
                },
            ],
        },
    ]);

    return (
        <div
            className="SoundLane flex flex-col h-full cursor-pointer"
            onClick={prop.onSelect}
        >
            <div>
                <SoundFileTitleBar
                    soundFile={prop.soundFile}
                    isSelected={prop.isSelected || false}
                />
            </div>
            <div className="flex flex-1">
                <div className="w-auto">
                    <SoundMenu
                        refNoteLanes={objNoteLanes}
                        setNoteLanes={setNoteLanes}
                    ></SoundMenu>
                </div>
                <div className="flex-1 overflow-auto">
                    {objNoteLanes.map((_, index) => (
                        <NoteLane key={index} />
                    ))}
                </div>
            </div>
        </div>
    );
}
