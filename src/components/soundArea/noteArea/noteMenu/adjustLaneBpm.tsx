import React, { useRef } from "react";
import style from "./noteMenu.module.css";
import classNames from "classnames/bind";
import Image from "@/components/Image";
const cls = classNames.bind(style);
interface _p {
    refBPM: number;
    setBPM: (_: number) => void;
}
function AdjustBPM(p: _p) {
    function handleChangeBPM(newb: number) {
        p.setBPM(newb);
    }
    const inputRef = useRef<HTMLInputElement>(null);
    return (
        <div>
            <div className="flex gap-2">
                <button
                    onClick={(e) => {
                        let newb = 60;
                        if (inputRef.current != null) {
                            newb = Number(inputRef.current.value);
                        } else {
                            console.warn("未输入新bpm");
                            //TODO 弹出气泡警告信息
                        }
                        if (newb <= 0) {
                            console.warn("bpm不能小于0", newb);
                            newb = 60;
                        }
                        handleChangeBPM(newb);
                        if (inputRef.current != null) {
                            inputRef.current.value = "";
                        }
                    }}
                    title="Set BPM"
                    className={`flex items-center gap-2 ${cls("button")}`}
                >
                    <Image
                        src="/assets/icons/setBPM.png"
                        alt="Set BPM"
                        width={36}
                        height={24}
                    />
                    <span>Set BPM</span>
                </button>
                <input
                    ref={inputRef}
                    className="bpm-input"
                    placeholder={p.refBPM.toFixed(3).toString()}
                    defaultValue={p.refBPM}
                    style={{
                        maxWidth: "20%",
                    }}
                />
            </div>
        </div>
    );
}

export default AdjustBPM;
// 修改当前bpm。
