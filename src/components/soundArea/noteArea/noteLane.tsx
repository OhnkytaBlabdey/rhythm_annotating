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
    timeRange: [number, number];
}
export function NoteLane(prop: _prop) {
    return (
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
                    {(() => {
                        const res = [];
                        let t = 0;
                        for (
                            let index = 0;
                            index < prop.refNoteLane.measures.length;
                            index++
                        ) {
                            const m = prop.refNoteLane.measures[index];
                            const tPost =
                                t +
                                (m.noBeat
                                    ? (m.lasted as number)
                                    : 60 / (m.bpm as number));
                            if (
                                tPost > prop.timeRange[0] &&
                                t < prop.timeRange[1]
                            ) {
                                if (
                                    t < prop.timeRange[0] &&
                                    tPost <= prop.timeRange[1]
                                ) {
                                    //剪去左侧
                                } else if (
                                    tPost > prop.timeRange[1] &&
                                    t >= prop.timeRange[0]
                                ) {
                                    // 剪去右侧
                                } else if (
                                    t < prop.timeRange[0] &&
                                    tPost > prop.timeRange[1]
                                ) {
                                    // 剪去左右侧
                                } else {
                                    //完全在区间里
                                    res.push(
                                        <Measure
                                            refMeasure={m}
                                            key={`${prop.Key}-${index}`}
                                            setMeasure={(newm: measure) => {
                                                const newms =
                                                    prop.refNoteLane.measures;
                                                newms[index] = newm;
                                                prop.setNoteLane({
                                                    ...prop.refNoteLane,
                                                    measures: newms,
                                                });
                                            }}
                                            i={index}
                                        />
                                    );
                                }
                            }
                            t = tPost;
                        }
                        return res;
                    })()}
                </div>
            </div>
        </div>
    );
}
