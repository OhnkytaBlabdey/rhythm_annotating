"use client";

import React from "react";
import classNames from "classnames/bind";
import type { ChartNote } from "../chartTypes";
import {
    defaultWdsProperties,
    getWdsScratchSpan,
    isWdsHoldType,
    isWdsScratchType,
    isWdsJumpScratch,
    isWdsOneDirection,
    WDS_LANE_COUNT,
    WDS_NOTE_TYPES,
    type WdsNoteProperties,
    type WdsNoteType,
} from "../wdsTypes";
import type { WdsMenuProps } from "./noteMenu";
import style from "./noteMenu.module.css";

const cls = classNames.bind(style);
const HEAD_TYPES = [80, 81, 82, 83] as const;

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

function PropertyFields({ type, properties, onChange, defaults = false }: {
    type: number;
    properties: WdsNoteProperties;
    onChange: (properties: WdsNoteProperties) => void;
    defaults?: boolean;
}) {
    const hold = isWdsHoldType(type);
    const scratch = isWdsScratchType(type);
    const jump = isWdsJumpScratch(properties);
    const oneDirection = isWdsOneDirection(properties);
    const span = getWdsScratchSpan(properties);
    // Insertion takes its lane from the pointer, not an unused default lane.
    const startLanes = defaults ? Array.from({ length: WDS_LANE_COUNT }, (_, index) => index + 1)
        .filter((lane) => getWdsScratchSpan({ ...properties, lane }) !== null) : [];
    const validRange = defaults ? startLanes.length > 0 : span !== null;
    const rangeText = defaults
        ? (validRange
            ? `可放置的起始轨道：${startLanes[0]}${startLanes.length > 1 ? `–${startLanes[startLanes.length - 1]}` : ""}`
            : "当前覆盖范围无法放入 12 轨，请检查宽度与 gimmickValue。")
        : (span
            ? `${scratch ? hold ? "尾部" : "划键" : "本体"}覆盖：${span.lane}–${span.lane + span.width - 1} 轨（宽 ${span.width}）`
            : "覆盖范围未完成或超出 1–12 轨，请检查宽度与 gimmickValue。");
    const change = (patch: Partial<WdsNoteProperties>) => onChange({ ...properties, ...patch });

    return (
        <>
            <div className={cls(!defaults && "property-grid")}>
                {!defaults && (
                    <label className={cls("control-field")}>
                        起始轨道
                        <NumberField min={1} max={WDS_LANE_COUNT} value={properties.lane}
                            onChange={(lane) => change({ lane })} />
                    </label>
                )}
                <label className={cls("control-field")}>
                    宽度（轨）
                    <NumberField min={1} max={WDS_LANE_COUNT} value={properties.width}
                        onChange={(width) => change({ width })} />
                </label>
            </div>
            {defaults && (
                <p className={cls("help-text")}>宽度为音符占用的连续轨道数；在画布上点击确定起始轨道。</p>
            )}
            {scratch && (
                <>
                    <label className={cls("control-field")}>
                        {hold ? "尾部划动" : "划动"} / gimmickType
                        <select className={cls("control-input")}
                            value={jump ? "JumpScratch" : oneDirection ? "OneDirection" : "0"}
                            onChange={(event) => change({
                                gimmickType: event.target.value as WdsNoteProperties["gimmickType"],
                                gimmickValue: event.target.value === "JumpScratch" ? properties.width : 0,
                            })}>
                            <option value="0">0 · 双向</option>
                            <option value="OneDirection">OneDirection / 2 · 单向</option>
                            <option value="JumpScratch">JumpScratch / 1 · 改变覆盖范围</option>
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
                                带符号覆盖宽度 / gimmickValue
                                <NumberField min={-WDS_LANE_COUNT} max={WDS_LANE_COUNT}
                                    value={properties.gimmickValue}
                                    onChange={(gimmickValue) => change({ gimmickValue })} />
                            </label>
                            <p className={cls("help-text")}>
                                负数向左并对齐本体右缘，正数向右并对齐本体左缘；绝对值为覆盖宽度，不能为 0。
                            </p>
                        </>
                    )}
                </>
            )}
            <p className={cls("span-preview", !validRange && "invalid-preview")} aria-live="polite">{rangeText}</p>
            {hold && (
                <>
                    <label className={cls("control-field")}>
                        起点的头记录
                        <select className={cls("control-input")} value={properties.holdHeadType ?? "none"}
                            onChange={(event) => change({
                                holdHeadType: event.target.value === "none" ? null
                                    : Number(event.target.value) as WdsNoteProperties["holdHeadType"],
                            })}>
                            <option value="none">无 · 延续段</option>
                            {HEAD_TYPES.map((head) => (
                                <option key={head} value={head}>
                                    {WDS_NOTE_TYPES.find(({ code }) => code === head)?.label}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className={cls("checkbox-field")}>
                        <input type="checkbox" checked={properties.autoTicks}
                            onChange={(event) => change({ autoTicks: event.target.checked })} />
                        辅助生成 · 每半拍添加 900 记录
                    </label>
                    <p className={cls("help-text")}>
                        头记录与长条区间分开保存。半拍生成是编辑器辅助选项，默认关闭；WDS 判定以实际 900 记录为准。
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
            <p className={cls("help-text")}>
                {readOnly ? "浏览只读：可查看属性；切换选中模式后编辑。" : "修改保留在表单中，点击应用一次保存全部字段。"}
            </p>
            <fieldset className={cls("property-fields")} disabled={readOnly}>
                <label className={cls("control-field")}>
                    记录编码（仅限同类{hold ? "长条" : "点音符"}）
                    <select className={cls("control-input")} value={type}
                        onChange={(event) => {
                            const nextType = Number(event.target.value);
                            setType(nextType);
                            if (!isWdsScratchType(nextType)) {
                                setProperties((previous) => ({
                                    ...previous, gimmickType: "0", gimmickValue: 0,
                                }));
                            }
                        }}>
                        {compatibleTypes.map(({ code, label }) => (
                            <option key={code} value={code}>{code} · {label}</option>
                        ))}
                    </select>
                </label>
                <PropertyFields type={type} properties={properties} onChange={setProperties} />
                <label className={cls("control-field")}>
                    标注
                    <textarea className={cls("control-input", "annotation-input")} value={annotation}
                        onChange={(event) => setAnnotation(event.target.value)} rows={2} />
                </label>
            </fieldset>
            <button type="button" className={cls("button")} disabled={readOnly}
                onClick={() => {
                    if (!readOnly) onUpdate({ ...note, type, wds: { ...properties }, annotation });
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
        if (type !== wds.type) {
            const defaults = defaultWdsProperties(type);
            const scratch = isWdsScratchType(type);
            const hold = isWdsHoldType(type);
            wds.onTypeChange(type);
            wds.onPropertiesChange({
                ...wds.properties,
                holdHeadType: defaults.holdHeadType,
                autoTicks: hold && (isWdsHoldType(wds.type) ? wds.properties.autoTicks : defaults.autoTicks),
                gimmickType: scratch ? wds.properties.gimmickType : "0",
                gimmickValue: scratch ? wds.properties.gimmickValue : 0,
            });
        }
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
                {WDS_NOTE_TYPES.filter(({ recordOnly }) => !recordOnly).map(typeButton)}
            </div>
            <details className={cls("advanced-types")}>
                <summary>原始记录编码</summary>
                <p className={cls("help-text")}>
                    用于编辑底层记录，不代表额外键种。100/101 共用蓝色长条，110/111 共用紫色长条；80–83 通常在长条属性中设置。
                </p>
                <div className={cls("type-grid")}>
                    {WDS_NOTE_TYPES.filter(({ recordOnly }) => recordOnly).map(typeButton)}
                </div>
            </details>
            {drawing ? (
                <>
                    <div className={cls("section-label")}>新音符属性 · {wds.type}</div>
                    <p className={cls("help-text")}>在绘制前设置，作用于接下来新建的音符。长条依次点击起点和终点。</p>
                    <PropertyFields type={wds.type} properties={wds.properties}
                        onChange={wds.onPropertiesChange} defaults />
                </>
            ) : selectedNote?.wds ? (
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
