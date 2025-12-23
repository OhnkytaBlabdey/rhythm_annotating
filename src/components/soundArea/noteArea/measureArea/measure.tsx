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
}
export function Measure(prop: _prop) {
    const inputRef = useRef<HTMLInputElement>(null);
    return (
        <div className="w-full h-full">
            <div
                className={cls("border")}
                style={{ width: "100%", height: "100%" }}
            >
                {/* 状态 */}
                <div
                    className={`flex gap-4 ${cls("meta-border")}`}
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
                        <span>
                            {prop.refMeasure.noBeat
                                ? "无节拍"
                                : prop.refMeasure.bpm}
                        </span>
                    </div>
                    <div
                        className="flex items-center"
                        onClick={() => {
                            inputRef.current?.blur();
                        }}
                    >
                        <span>
                            /
                            <input
                                ref={inputRef}
                                type="number"
                                defaultValue={prop.refMeasure.currentDivide}
                                style={{
                                    maxWidth: "20%",
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        inputRef.current?.blur();
                                    }
                                }}
                            />
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
