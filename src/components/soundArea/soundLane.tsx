'use client'
import style from './soundLane.module.css'
import { useState } from 'react'
import SoundFileTitleBar from './soundFileTitleBar'
interface _prop {
    soundFile: string,
    a?: string
}
export default function SoundLane(prop: _prop) {
    return (
        <div>
            {/* title for sound file path */}
            <SoundFileTitleBar soundFile={prop.soundFile} />
            <div>
                <h2>{prop.a}</h2>
            </div>
        </div>
    )
}