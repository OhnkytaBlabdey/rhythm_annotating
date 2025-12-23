"use client";
import { notelane } from "@/interface/soundLane/noteLane/notelane";
import { Measure } from "./measureArea/measure";
import { measure } from "@/interface/soundLane/noteLane/measure/measure";
import NoteMenu from "./noteMenu/noteMenu";
import { JSX } from "react";
interface _prop {
    index: number;
    Key: string;
    refNoteLane: notelane;
    setNoteLane: (_: notelane) => void;
    timeRange: [number, number];
}
export function NoteLane(prop: _prop) {
    function delMeasure(id: string) {
        const newms = prop.refNoteLane.measures.filter((m) => m.id !== id);
        prop.setNoteLane({
            ...prop.refNoteLane,
            measures: newms,
        });
    }
    return (
        <div className="NoteLane">
            <div className="flex flex-col">
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
                <div
                    className="relative overflow-hidden"
                    style={{ width: 1200, height: 60 }} // 父级宽度 1200px，高度 60px（按需调整）
                >
                    {(() => {
                        const res: JSX.Element[] = [];
                        let t = 0;
                        const [rangeStart, rangeEnd] = prop.timeRange;
                        const RANGE_WIDTH = 1200;
                        const totalRange = Math.max(
                            1e-6,
                            rangeEnd - rangeStart
                        ); // 防止除以 0
                        const pixelsPerSecond = RANGE_WIDTH / totalRange;
                        for (
                            let index = 0;
                            index < prop.refNoteLane.measures.length;
                            index++
                        ) {
                            const m = prop.refNoteLane.measures[index];
                            // 每个 measure = 1 拍 的时长（秒）
                            const beatDuration = m.noBeat
                                ? (m.lasted as number)
                                : 60 / (m.bpm as number);
                            const tPost = t + beatDuration;
                            // 判断与 timeRange 是否有交集（用于决定是否渲染）
                            const visibleStart = Math.max(t, rangeStart);
                            const visibleEnd = Math.min(tPost, rangeEnd);
                            if (visibleStart < visibleEnd) {
                                // 计算该 measure 在时间轴上的绝对位置与宽度（基于 timeRange -> 1200px 映射）
                                const measureStartRelative = t - rangeStart; // 可能为负
                                const leftPx =
                                    measureStartRelative * pixelsPerSecond;
                                const beatWidthPx =
                                    beatDuration * pixelsPerSecond;
                                // outer wrapper：绝对定位，宽度等于完整拍宽（这样左右部分会被父容器裁掉）
                                res.push(
                                    <div
                                        key={`${prop.Key}-${m.id}`}
                                        className="absolute top-0 left-0"
                                        style={{
                                            left: leftPx, // 可以为负或超出 1200，父容器 overflow:hidden 会裁掉
                                            width: beatWidthPx,
                                            height: "100%",
                                            boxSizing: "border-box",
                                        }}
                                    >
                                        {/* 强制 Measure 填满父容器 */}
                                        <div
                                            style={{
                                                width: "100%",
                                                height: "100%",
                                            }}
                                        >
                                            <Measure
                                                refMeasure={m}
                                                i={index}
                                                setMeasure={(newm: measure) => {
                                                    const newms = [
                                                        ...prop.refNoteLane
                                                            .measures,
                                                    ];
                                                    newms[index] = newm;
                                                    prop.setNoteLane({
                                                        ...prop.refNoteLane,
                                                        measures: newms,
                                                    });
                                                }}
                                                delMeasure={delMeasure}
                                            />
                                        </div>
                                    </div>
                                );
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
