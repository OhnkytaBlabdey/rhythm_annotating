'use client'
import { Measure } from "./measureArea/measure";
export function NoteLane() {
    return (
        <div className="NoteLane">
            <Measure flagNoBeat={true} bpm={114} />
            {/* measures */}
        </div>
    )
}