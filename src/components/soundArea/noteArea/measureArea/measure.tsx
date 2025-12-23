"use client";
import { useRef, useState } from "react";
import style from "./measure.module.css";
import classNames from "classnames/bind";
import { measure } from "@/interface/soundLane/noteLane/measure/measure";
import Image from "next/image";
const cls = classNames.bind(style);

interface _prop {
    refMeasure: measure;
    i: number;
    setMeasure: (_: measure) => void;
    delMeasure: (id: string) => void;
}
export function Measure(prop: _prop) {
    const inputRefDivide = useRef<HTMLInputElement>(null);
    const inputRefBPM = useRef<HTMLInputElement>(null);
    function setBPM(newb: number) {
        prop.setMeasure({
            ...prop.refMeasure,
            bpm: newb,
        });
    }
    function updateDivide() {
        inputRefDivide.current?.blur();
        if (inputRefDivide.current != null) {
            const val = Number(inputRefDivide.current.value);
            if (val >= 1) {
                prop.setMeasure({
                    ...prop.refMeasure,
                    currentDivide: val,
                    currentNum: 0,
                });
            } else {
                inputRefDivide.current.innerHTML = "1";
            }
        }
    }
    return (
        <div className="w-full h-full">
            <div
                className={cls("border")}
                style={{ width: "100%", height: "100%" }}
            >
                {/* 状态 */}
                <div
                    className={`flex gap-1 ${cls("meta-border")}`}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex items-center">
                        <span>#{prop.i}</span>
                        <Image
                            src="/assets/icons/bpm.png"
                            alt="BPM"
                            width={24}
                            height={24}
                        />
                        <div>
                            {!prop.refMeasure.noBeat && (
                                <input
                                    ref={inputRefBPM}
                                    onClick={() => {
                                        if (inputRefBPM.current != null) {
                                            const val = Number(
                                                inputRefBPM.current.value
                                            );
                                            if (val >= 1) {
                                                setBPM(val);
                                            } else {
                                                inputRefBPM.current.innerHTML =
                                                    "1";
                                            }
                                            inputRefBPM.current?.blur();
                                        }
                                    }}
                                    onKeyDown={(e) => {
                                        if (
                                            inputRefBPM.current != null &&
                                            e.key === "Enter"
                                        ) {
                                            setBPM(
                                                Number(
                                                    inputRefBPM.current.value
                                                )
                                            );
                                            inputRefBPM.current?.blur();
                                        }
                                    }}
                                    defaultValue={prop.refMeasure.bpm}
                                    style={{
                                        width: "65px",
                                    }}
                                    type="number"
                                />
                            )}
                            {prop.refMeasure.noBeat && <span>无节拍</span>}
                        </div>
                        {/* divide */}
                        <div onClick={updateDivide}>
                            /
                            <input
                                ref={inputRefDivide}
                                type="number"
                                defaultValue={prop.refMeasure.currentDivide}
                                style={{
                                    width: "35px",
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        updateDivide();
                                    }
                                }}
                            />
                        </div>
                        {/* delete */}
                        <div>
                            <Image
                                src="/assets/icons/deleteMeasure.png"
                                alt="Delete"
                                width={24}
                                height={24}
                                onClick={() => {
                                    prop.delMeasure(prop.refMeasure.id);
                                }}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
