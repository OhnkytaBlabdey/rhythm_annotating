"use client";
import { notelane } from "@/interface/soundLane/noteLane/notelane";
import { Measure } from "./measureArea/measure";
import { measure } from "@/interface/soundLane/noteLane/measure/measure";
import NoteMenu from "./noteMenu/noteMenu";
interface _prop {
    index: number;
    Key: string;
    refNoteLane: notelane;
    setNoteLane: (_: notelane) => void;
}
export function NoteLane(prop: _prop) {
    // function handleActivate() {
    //     prop.setNoteLane({
    //         ...prop.refNoteLane,
    //         isActive: true,
    //     });
    // }
    return (
        // <div className="NoteLane" onClick={handleActivate}>
        <div className="NoteLane">
            <div className="flex-col">
                {/* <NoteMenu /> */}
                <div className="flex-1" onClick={(e) => e.stopPropagation()}>
                    <NoteMenu
                        refMeasures={prop.refNoteLane.measures}
                        setMeasures={(newmss: measure[]) => {
                            prop.setNoteLane({
                                ...prop.refNoteLane,
                                measures: newmss,
                            });
                        }}
                    />
                </div>
                {/* measures */}
                <div className="flex items-center">
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
        </div>
    );
}
