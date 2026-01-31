// PlaySelected.tsx
import React, { useEffect, useRef } from "react";
interface _p {
    setCurrentTime: (_: number) => void;
    refIsPlaying: boolean;
    setIsPlaying: (_: boolean) => void;
}
function PlaySelected(prop: _p) {
    const rafRef = useRef<number | null>(null);
    const startTime = useRef<number | null>(null);
    function stopAll() {
        console.log("stop playing");
    }
    function playAll() {
        console.log("playing");
    }
    // useEffect(() => {
    //     if (all flags) {
    //         stopAll();
    //         if (rafRef.current) cancelAnimationFrame(rafRef.current);
    //         if (startTime.current) startTime.current = null;
    //     }
    // }, [flags]);
    // 当所有音频的播放结束flag都成立时，停止播放。

    // 当点下暂停按钮时，停止播放。
    // 当点下播放按钮时，该快照渲染的仍然是不播放状态，此时不暂停。
    // 所以不能将（IsPlaying）作为停止播放条件，它只应该影响UI
    function tick(timestemp: number) {
        if (!startTime.current) {
            startTime.current = timestemp;
            console.log("started at" + startTime.current);
        }
        prop.setCurrentTime((timestemp - startTime.current) / 1000);
        rafRef.current = requestAnimationFrame((t) => tick(t));
        //这里如果不获得即时的状态，如何打断播放？
    }
    useEffect(() => {
        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            if (startTime.current) startTime.current = null;
            console.log("effect 销毁");
        };
    }, []);
    function onPlay() {
        prop.setIsPlaying(true);
        playAll();
        rafRef.current = requestAnimationFrame(tick);
    }
    return <button onClick={onPlay}>Play</button>;
}
export default PlaySelected;
