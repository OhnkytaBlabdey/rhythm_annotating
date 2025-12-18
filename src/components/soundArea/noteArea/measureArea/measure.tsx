'use client'
import { useState } from 'react'
import style from './measure.module.css'
import classNames from 'classnames/bind'
import { measure } from '@/interface/measure'
const cls = classNames.bind(style)

interface _prop {
    bpm: number,
    flagNoBeat: boolean,
}
export function Measure(prop: _prop) {
    const [objmeasure, setmeasure] = useState<measure>(
        { noBeat: prop.flagNoBeat, bpm: prop.flagNoBeat ? 0 : prop.bpm, notes: [] })
    return (
        <div className='Measure'>
            <div className={cls('inactive')}>
                <span>{objmeasure.noBeat ? '无节拍' : objmeasure.bpm}</span>
            </div>
        </div>
    )
}