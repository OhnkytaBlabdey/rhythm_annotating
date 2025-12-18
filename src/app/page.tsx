"use client";
import { useState } from "react";
import SoundLane from "@/components/soundArea/soundLane";
export default function Home() {
    const [selectedSoundLaneIndex, setSelectedSoundLaneIndex] = useState<
        number | null
    >(null);
    return (
        <div className="flex flex-col gap-4 px-8 py-6">
            <div className="rounded-lg border border-gray-300 p-4">
                <div className="w-4/5 mx-auto">
                    <SoundLane
                        soundFile={"filename"}
                        a={"123sgh"}
                        isSelected={selectedSoundLaneIndex === 0}
                        onSelect={() => setSelectedSoundLaneIndex(0)}
                    />
                </div>
            </div>
        </div>
    );
}
