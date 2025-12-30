// PlaySelected.tsx
import { audioScheduler } from "@/audio/audioScheduler";
import { soundlane } from "@/interface/soundLane/soundlane";
import React, { useEffect, useRef } from "react";
interface _p {
    refSoundLanes: soundlane[];
    refCurrentTime: number;
    setCurrentTime: (_: number) => void;
    refIsPlaying: boolean;
    setIsPlaying: (_: boolean) => void;
}
function PlaySelected(prop: _p) {
    const rafRef = useRef<number | null>(null);
    const isPlayingRef = useRef(false);
    const lastCurrentTime = useRef(prop.refCurrentTime);
    useEffect(() => {
        lastCurrentTime.current = prop.refCurrentTime;
        // 如果外部 currentTime 改变，停止播放
        if (
            isPlayingRef.current &&
            prop.refCurrentTime !== audioScheduler.getPlayedTime()
        ) {
            audioScheduler.pauseAll();
            prop.setIsPlaying(false);
            isPlayingRef.current = false;
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        }
    }, [prop.refCurrentTime]);
    function tick() {
        if (!isPlayingRef.current) return;
        const played = audioScheduler.getPlayedTime();
        prop.setCurrentTime(played);
        rafRef.current = requestAnimationFrame(tick);
    }
    async function onPlay() {
        if (isPlayingRef.current) return;
        await audioScheduler.playAll(prop.refSoundLanes, prop.refCurrentTime);
        isPlayingRef.current = true;
        prop.setIsPlaying(true);
        rafRef.current = requestAnimationFrame(tick);
    }
    useEffect(() => {
        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            isPlayingRef.current = false;
        };
    }, []);
    return <button onClick={onPlay}>Play</button>;
}
export default PlaySelected;
