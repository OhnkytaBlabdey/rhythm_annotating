"use client";
import AddNoteLane from "./addNoteLane";
import React from "react";

interface _prop {
    audioId: string;
    timeRange: [number, number];
    onAddNoteLane: () => void;
}

function SoundMenu(prop: _prop) {
    const duration = prop.timeRange[1] - prop.timeRange[0];
    return (
        <div>
            <div className="flex items-center gap-4">
                <span className="editor-meta-text whitespace-nowrap">
                    {prop.timeRange[0].toFixed(4)} -{" "}
                    {prop.timeRange[1].toFixed(4)} | {duration.toFixed(4)}s
                </span>
                <AddNoteLane
                    audioId={prop.audioId}
                    onAdd={prop.onAddNoteLane}
                />
            </div>
        </div>
    );
}

export default SoundMenu;
