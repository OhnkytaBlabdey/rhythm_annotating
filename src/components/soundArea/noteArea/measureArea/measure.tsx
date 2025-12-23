"use client";
import { useState } from "react";
import style from "./measure.module.css";
import classNames from "classnames/bind";
import { measure } from "@/interface/soundLane/noteLane/measure/measure";
import Image from "next/image";
const cls = classNames.bind(style);

interface _prop {
    refMeasure: measure;
    i: number;
    setMeasure: (_: measure) => void;
}
export function Measure(prop: _prop) {
    return (
        <div className="w-full h-full">
            <div
                className={cls("border")}
                style={{ width: "100%", height: "100%" }}
            >
                {/* 状态 */}
                <div className={`flex gap-4 ${cls("meta-border")}`}>
                    <div className="flex items-center">
                        <span>#{prop.i}</span>
                        <Image
                            src="/assets/icons/bpm.png"
                            alt="BPM"
                            width={24}
                            height={24}
                        />
                        <span>
                            {prop.refMeasure.noBeat
                                ? "无节拍"
                                : prop.refMeasure.bpm}
                        </span>
                    </div>
                    <div className="flex items-center">
                        <span>/{prop.refMeasure.currentDivide}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
