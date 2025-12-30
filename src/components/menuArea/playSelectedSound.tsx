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
    const rafRef = useRef<number>(0);

    function tick() {
        const dt = audioScheduler.getPlayedTime();
        prop.setCurrentTime(prop.refCurrentTime + dt);
        rafRef.current = requestAnimationFrame(tick);
    }

    function onPlay() {
        if (prop.refIsPlaying) return;

        audioScheduler.playAll(prop.refSoundLanes, prop.refCurrentTime);

        prop.setIsPlaying(true);
        rafRef.current = requestAnimationFrame(tick);
    }

    useEffect(() => {
        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, []);

    return (
        <div>
            <button onClick={onPlay}>Play</button>
        </div>
    );
}

export default PlaySelected;
