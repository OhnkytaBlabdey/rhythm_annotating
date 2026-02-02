// PlaySelected.tsx
import React, { useEffect, useRef, useCallback, useContext } from "react";
import { AudioDataCtx } from "../audioContext";
interface _p {
    //TODO 哪些音频被激活，需要播放
    //当选中状态变化时，web audio播放的状态也跟着变
    refCurrentTime: number;
    setCurrentTime: (_: number) => void;
    refIsPlaying: boolean;
    setIsPlaying: (_: boolean) => void;
}
function PlaySelected(prop: _p) {
    const rafRef = useRef<number | null>(null);
    const startTime = useRef<number | null>(null);
    const isPlayingRef = useRef(prop.refIsPlaying);
    const audios = useContext(AudioDataCtx);

    // 同步 refIsPlaying 到 ref，使 tick 能获得最新值
    useEffect(() => {
        isPlayingRef.current = prop.refIsPlaying;
    }, [prop.refIsPlaying]);

    function stopAll() {
        console.log("stop playing");
    }
    function playAll() {
        console.log("playing");
    }

    const tick = useCallback(
        (timestamp: number) => {
            // 检查当前播放状态，如果停止则退出
            if (!isPlayingRef.current) {
                startTime.current = null;
                return;
            }

            if (!startTime.current) {
                startTime.current = timestamp;
                console.log("started at " + startTime.current);
            }
            prop.setCurrentTime(
                prop.refCurrentTime + (timestamp - startTime.current) / 1000,
            );
            rafRef.current = requestAnimationFrame(tick);
        },
        [prop],
    );

    // 监听播放状态变化
    useEffect(() => {
        if (prop.refIsPlaying && !rafRef.current) {
            // 开始播放
            playAll();
            rafRef.current = requestAnimationFrame(tick);
        } else if (!prop.refIsPlaying && rafRef.current) {
            // 停止播放
            stopAll();
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
            startTime.current = null;
        }
    }, [prop.refIsPlaying, tick]);

    // 组件卸载时清理资源
    useEffect(() => {
        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            startTime.current = null;
            console.log("component unmounted");
        };
    }, []);

    function onPlay() {
        prop.setIsPlaying(true);
    }

    function onPause() {
        prop.setIsPlaying(false);
    }

    function onStop() {
        prop.setIsPlaying(false);
        prop.setCurrentTime(0);
    }

    return (
        <>
            <button onClick={onPlay}>Play</button>
            <button onClick={onPause}>Pause</button>
            <button onClick={onStop}>Stop</button>
        </>
    );
}
export default PlaySelected;
