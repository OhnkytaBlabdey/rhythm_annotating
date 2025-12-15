'use client'
import style from './soundFileTitleBar.module.css'
interface _prop {
    soundFile: string
}
export default function SoundFileTitleBar(prop: _prop) {
    return (
        <div>
            <span>{prop.soundFile}</span>
        </div>
    )
}