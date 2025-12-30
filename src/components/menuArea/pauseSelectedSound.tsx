// PauseSelected.tsx
import { audioScheduler } from "@/audio/audioScheduler";
import React from "react";
interface _p {
    refIsPlaying: boolean;
    setIsPlaying: (_: boolean) => void;
}
function PauseSelected(p: _p) {
    function onPause() {
        if (!p.refIsPlaying) return;
        audioScheduler.pauseAll();
        p.setIsPlaying(false);
    }
    return <button onClick={onPause}>Pause</button>;
}
export default PauseSelected;
