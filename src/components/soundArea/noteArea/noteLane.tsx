"use client";
import { notelane } from "@/interface/soundLane/noteLane/notelane";
import { Measure } from "./measureArea/measure";
import { measure } from "@/interface/soundLane/noteLane/measure/measure";
import NoteMenu from "./menuArea/noteMenu";
interface _prop {
    index: number;
    Key: string;
    refNoteLane: notelane;
    setNoteLane: (_: notelane) => void;
}
export function NoteLane(prop: _prop) {
    return (
        <div className="NoteLane">
            <div className="flex">
                {/* <NoteMenu /> */}
                {/* measures */}
                {prop.refNoteLane.measures.map((m, index) => (
                    <Measure
                        refMeasure={m}
                        key={`${prop.Key}-${index}`}
                        setMeasure={(newm: measure) => {
                            const newms = prop.refNoteLane.measures;
                            newms[index] = newm;
                            prop.setNoteLane({
                                ...prop.refNoteLane,
                                measures: newms,
                            });
                        }}
                        i={index}
                    />
                ))}
            </div>
        </div>
    );
}
