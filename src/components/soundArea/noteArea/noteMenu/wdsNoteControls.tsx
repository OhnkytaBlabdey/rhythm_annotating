"use client";

import React from "react";
import classNames from "classnames/bind";
import type { ChartNote } from "../chartTypes";
import {
    getWdsScratchSpan,
    isWdsHoldType,
    isWdsScratchType,
    isWdsJumpScratch,
    isWdsOneDirection,
    normalizeWdsJumpScratch,
    WDS_LANE_COUNT,
    WDS_NOTE_TYPES,
    type WdsNoteProperties,
    type WdsNoteType,
} from "../wdsTypes";
import type { WdsMenuProps } from "./noteMenu";
import style from "./noteMenu.module.css";

const cls = classNames.bind(style);

// Preserve partial numeric input; the adapter validates it on insertion/update.
function NumberField({ value, onChange, ...inputProps }:
    Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
        value: number;
        onChange: (value: number) => void;
    }) {
    const [draft, setDraft] = React.useState({
        value, text: Number.isFinite(value) ? String(value) : "",
    });
    if (!Object.is(value, draft.value)) {
        setDraft({ value, text: Number.isFinite(value) ? String(value) : "" });
    }
    return (
        <input {...inputProps} type="number" step={1} value={draft.text}
            className={cls("control-input")}
            onChange={(event) => {
                const text = event.target.value;
                const next = text.trim() === "" ? Number.NaN : Number(text);
                setDraft({ value: next, text });
                onChange(next);
            }} />
    );
}

function PropertyFields({ type, properties, onChange }: {
    type: number;
    properties: WdsNoteProperties;
    onChange: (properties: WdsNoteProperties) => void;
}) {
    const hold = isWdsHoldType(type);
    const scratch = isWdsScratchType(type) || hold;
    const jump = isWdsJumpScratch(properties);
    const oneDirection = isWdsOneDirection(properties);
    const span = getWdsScratchSpan(properties);
    const change = (patch: Partial<WdsNoteProperties>) => onChange({ ...properties, ...patch });

    return (
        <>
            <div className={cls("property-grid")}>
                <label className={cls("control-field")}>
                    起始轨道
                    <NumberField min={1} max={WDS_LANE_COUNT} value={properties.lane}
                        onChange={(lane) => change({ lane })} />
                </label>
                <label className={cls("control-field")}>
                    宽度（轨）
                    <NumberField min={1} max={WDS_LANE_COUNT} value={properties.width}
                        onChange={(width) => change({ width })} />
                </label>
            </div>
            {scratch && (
                <>
                    <label className={cls("control-field")}>
                        {hold ? "尾部划动" : "划动"} / gimmickType
                        <select className={cls("control-input")}
                            value={jump ? "JumpScratch" : oneDirection ? "OneDirection" : "0"}
                            onChange={(event) => change({
                                gimmickType: event.target.value as WdsNoteProperties["gimmickType"],
                                gimmickValue: event.target.value === "JumpScratch"
                                    ? (properties.lane + properties.width <= WDS_LANE_COUNT ? 1 : -1) * (properties.width + 1) : 0,
                            })}>
                            <option value="0">默认</option>
                            {isWdsScratchType(type) && <option value="OneDirection">OneDirection / 2 · 单向</option>}
                            {hold && <option value="JumpScratch" disabled={properties.width >= WDS_LANE_COUNT}>JumpScratch / 1 · 尾部覆盖范围</option>}
                            {!hold && jump && <option value="JumpScratch" disabled>JumpScratch · 已有原始记录属性</option>}
                        </select>
                    </label>
                    {oneDirection && (
                        <>
                            <label className={cls("control-field")}>
                                方向 / gimmickValue
                                <select className={cls("control-input")}
                                    value={properties.gimmickValue === 0 ? "0" : "1"}
                                    onChange={(event) => change({ gimmickValue: Number(event.target.value) })}>
                                    <option value="0">左（0）</option>
                                    <option value="1">右（非零）</option>
                                </select>
                            </label>
                            <p className={cls("help-text")}>单向只改变箭头方向，保持原轨道与宽度。</p>
                        </>
                    )}
                    {jump && (
                        <>
                            <label className={cls("control-field")}>
                                划动方向
                                <select className={cls("control-input")}
                                    value={properties.gimmickValue < 0 ? "left" : "right"}
                                    onChange={(event) => change({ gimmickValue:
                                        (event.target.value === "left" ? -1 : 1) * (Math.abs(properties.gimmickValue) || properties.width),
                                    })}>
                                    <option value="left">向左</option>
                                    <option value="right">向右</option>
                                </select>
                            </label>
                            <label className={cls("control-field")}>
                                带符号覆盖宽度 / gimmickValue
                                <NumberField min={-WDS_LANE_COUNT} max={WDS_LANE_COUNT}
                                    value={properties.gimmickValue}
                                    onChange={(gimmickValue) => change({ gimmickValue })} />
                            </label>
                            <p className={cls("help-text")}>
                                负数向左，正数向右；绝对值为尾部覆盖宽度。
                                收回身子范围会清除 JumpScratch 和方向；改变身子宽度时保留尾巴的额外延伸格数。
                            </p>
                        </>
                    )}
                </>
            )}
            {!span && <p className={cls("invalid-preview")} role="alert">覆盖范围未完成或超出 1–12 轨。</p>}
            {hold && (
                <>
                    <label className={cls("checkbox-field")}>
                        <input type="checkbox" checked={properties.autoTicks}
                            onChange={(event) => change({ autoTicks: event.target.checked })} />
                        辅助生成 · 每半拍添加 900 记录
                    </label>
                    <p className={cls("help-text")}>
                        长条只有身子和尾巴。起点的键请单独放置，可独立选择、移动和删除。
                        半拍生成是编辑器辅助选项，默认关闭；WDS 判定以实际 900 记录为准。
                    </p>
                </>
            )}
        </>
    );
}

function SelectedNoteForm({ note, readOnly, onUpdate }: {
    note: ChartNote & { wds: WdsNoteProperties };
    readOnly: boolean;
    onUpdate: (note: ChartNote) => void;
}) {
    const [type, setType] = React.useState(note.type);
    const [properties, setProperties] = React.useState({ ...note.wds });
    const [annotation, setAnnotation] = React.useState(note.annotation ?? "");
    const hold = isWdsHoldType(note.type);
    const compatibleTypes = WDS_NOTE_TYPES.filter((entry) => (entry.kind === "hold") === hold);
    return (
        <>
            {!readOnly && (
                <p className={cls("help-text")}>
                    修改保留在表单中，点击应用一次保存全部字段。
                </p>
            )}
            <fieldset className={cls("property-fields")} disabled={readOnly}>
                <div className={cls("control-field")}>
                    <select className={cls("control-input")} value={type}
                        aria-label={hold ? "长条音符类型" : "点音符类型"}
                        onChange={(event) => {
                            const nextType = Number(event.target.value);
                            setType(nextType);
                            if (!isWdsScratchType(nextType) && !(isWdsHoldType(nextType) && isWdsJumpScratch(properties))) {
                                setProperties((previous) => ({
                                    ...previous, gimmickType: "0", gimmickValue: 0,
                                }));
                            }
                        }}>
                        {compatibleTypes.map(({ code, label }) => (
                            <option key={code} value={code}>{code} · {label}</option>
                        ))}
                    </select>
                </div>
                <PropertyFields type={type} properties={properties} onChange={setProperties} />
                <label className={cls("control-field")}>
                    标注
                    <textarea className={cls("control-input", "annotation-input")} value={annotation}
                        onChange={(event) => setAnnotation(event.target.value)} rows={2} />
                </label>
            </fieldset>
            <button type="button" className={cls("button")} disabled={readOnly}
                onClick={() => {
                    if (!readOnly) {
                        const resizingBody = hold && properties.width !== note.wds.width &&
                            properties.gimmickType === note.wds.gimmickType && properties.gimmickValue === note.wds.gimmickValue;
                        // The adapter derives a resized tail from the saved body.
                        // Only an explicit tail edit can clear this form early.
                        if (!resizingBody) setProperties(normalizeWdsJumpScratch(properties));
                        onUpdate({ ...note, type, wds: { ...properties }, annotation });
                    }
                }}>应用到选中音符</button>
        </>
    );
}

export default function WdsNoteControls({ wds, drawing, readOnly, onDraw }: {
    wds: WdsMenuProps;
    drawing: boolean;
    readOnly: boolean;
    onDraw: () => void;
}) {
    const selectType = (type: number) => {
        wds.onTypeChange(type);
        onDraw();
    };
    const typeButton = ({ code, label, color }: WdsNoteType) => (
        <button key={code} type="button"
            className={cls("button", "type-button", drawing && wds.type === code && "button-active")}
            style={{ borderLeftColor: color }} title={`${code} · ${label}`}
            aria-pressed={drawing && wds.type === code} onClick={() => selectType(code)}>
            <strong>{code}</strong><span>{label}</span>
        </button>
    );
    const selectedNote = wds.selectedNote;
    return (
        <section className={cls("wds-controls")} aria-label="WDS 音符控件"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
            onKeyUp={(event) => event.stopPropagation()}
            onWheel={(event) => event.stopPropagation()}>
            <div className={cls("section-label")}>WDS 绘制类型</div>
            <div className={cls("type-grid")}>
                {WDS_NOTE_TYPES.filter(({ uncommon }) => !uncommon).map(typeButton)}
            </div>
            <details className={cls("advanced-types")}>
                <summary>少用键种</summary>
                <div className={cls("type-grid")}>
                    {WDS_NOTE_TYPES.filter(({ uncommon }) => uncommon).map(typeButton)}
                </div>
            </details>
            {!drawing && selectedNote?.wds ? (
                <>
                    <div className={cls("section-label", "selected-heading")}>选中音符属性</div>
                    <SelectedNoteForm key={`${JSON.stringify(selectedNote)}:${readOnly}`}
                        note={{ ...selectedNote, wds: selectedNote.wds }} readOnly={readOnly}
                        onUpdate={wds.onUpdateSelected} />
                </>
            ) : null}
        </section>
    );
}
