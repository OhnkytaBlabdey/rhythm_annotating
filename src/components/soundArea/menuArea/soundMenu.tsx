"use client";
import { notelane } from "@/interface/soundLane/noteLane/notelane";
import AddNoteLane from "./addNoteLane";
import style from "./soundMenu.module.css";
import React from "react";
interface _prop {
    refNoteLanes: notelane[];
    setNoteLanes: (a: notelane[]) => void;
}
function SoundMenu(prop: _prop) {
    return (
        <div>
            <AddNoteLane
                refNoteLanes={prop.refNoteLanes}
                setNoteLanes={prop.setNoteLanes}
            ></AddNoteLane>
        </div>
    );
}

export default SoundMenu;
