"use client";
import AddNoteLane from "./addNoteLane";
import style from "./soundMenu.module.css";
import React from "react";

interface _prop {
    audioId: string;
}

function SoundMenu(prop: _prop) {
    return (
        <div>
            <div className="flex flex-col">
                <AddNoteLane audioId={prop.audioId} />
            </div>
        </div>
    );
}

export default SoundMenu;
