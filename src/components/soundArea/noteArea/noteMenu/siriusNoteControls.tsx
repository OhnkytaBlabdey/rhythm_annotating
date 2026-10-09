"use client";

import React from "react";
import classNames from "classnames/bind";
import type { ChartNote } from "../chartTypes";
import {
    defaultSiriusProperties,
    getSiriusTailSpan,
    isSiriusHoldType,
    isSiriusScratchType,
    SIRIUS_LANE_COUNT,
    SIRIUS_NOTE_TYPES,
    type SiriusNoteProperties,
    type SiriusNoteType,
} from "../siriusTypes";
import type { SiriusMenuProps } from "./noteMenu";
import style from "./noteMenu.module.css";

const cls = classNames.bind(style);
const HEAD_TYPES = [80, 81, 82, 83] as const;
const isStandaloneHead = (type: number) => HEAD_TYPES.some((head) => head === type);

// Keep partial numeric input local (including an empty field). The insertion /
// update adapter validates the numeric properties, rather than coercing to 0.
function NumberField({
    value,
    onChange,
    ...inputProps
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
    value: number;
    onChange: (value: number) => void;
}) {
    const [draft, setDraft] = React.useState({
        value,
        text: Number.isFinite(value) ? String(value) : "",
    });
    if (!Object.is(value, draft.value)) {
        setDraft({ value, text: Number.isFinite(value) ? String(value) : "" });
    }
    return (
        <input
            {...inputProps}
            type="number"
            step={1}
            value={draft.text}
            className={cls("control-input")}
            onChange={(event) => {
                const text = event.target.value;
                const next = text.trim() === "" ? Number.NaN : Number(text);
                setDraft({ value: next, text });
                onChange(next);
            }}
        />
    );
}

function PropertyFields({
    type,
    properties,
    onChange,
    defaults = false,
}: {
    type: number;
    properties: SiriusNoteProperties;
    onChange: (properties: SiriusNoteProperties) => void;
    defaults?: boolean;
}) {
    const hold = isSiriusHoldType(type);
    const scratch = isSiriusScratchType(type);
    const span = getSiriusTailSpan(properties);
    const change = (patch: Partial<SiriusNoteProperties>) => {
        onChange({ ...properties, ...patch });
    };

    return (
        <>
            <div className={cls("property-grid")}>
                <label className={cls("control-field")}>
                    {defaults ? "预览轨道" : "起始轨道"}
                    <NumberField
                        min={1}
                        max={SIRIUS_LANE_COUNT}
                        value={properties.lane}
                        onChange={(lane) => change({ lane })}
                    />
                </label>
                <label className={cls("control-field")}>
                    宽度（轨）
                    <NumberField
                        min={1}
                        max={SIRIUS_LANE_COUNT}
                        value={properties.width}
                        onChange={(width) => change({ width })}
                    />
                </label>
            </div>
            {defaults && (
                <p className={cls("help-text")}>
                    轨道 1–12；落点由指针决定，预览轨道仅用于默认值与尾部预览。
                </p>
            )}
            {scratch && (
                <>
                    <label className={cls("control-field")}>
                        方向 / gimmick
                        <select
                            className={cls("control-input")}
                            value={properties.gimmick}
                            onChange={(event) => change({
                                gimmick: event.target.value as SiriusNoteProperties["gimmick"],
                            })}
                        >
                            <option value="0">0 · 普通</option>
                            <option value="OneDirection">OneDirection · 单向</option>
                            {hold && <option value="JumpScratch">JumpScratch · 跳划</option>}
                        </select>
                    </label>
                    <label className={cls("control-field")}>
                        scratchLength（带符号）
                        <NumberField
                            min={-SIRIUS_LANE_COUNT}
                            max={SIRIUS_LANE_COUNT}
                            value={properties.scratchLength}
                            onChange={(scratchLength) => change({ scratchLength })}
                        />
                    </label>
                    <p className={cls("help-text")}>
                        尾部覆盖宽度，不是位移；负左正右。0 表示与本体同宽。
                    </p>
                </>
            )}
            <p className={cls("span-preview", !span && "invalid-preview")} aria-live="polite">
                {span
                    ? `${scratch ? "尾部" : "本体"}覆盖：${span.lane}–${span.lane + span.width - 1} 轨（宽 ${span.width}）`
                    : "范围未完成或超出 1–12 轨，请检查轨道、宽度及尾部宽度。"}
            </p>
            {hold && (
                <>
                    <label className={cls("control-field")}>
                        Hold 头（独立于区间类型）
                        <select
                            className={cls("control-input")}
                            value={properties.holdHeadType ?? "none"}
                            onChange={(event) => change({
                                holdHeadType: event.target.value === "none"
                                    ? null
                                    : Number(event.target.value) as SiriusNoteProperties["holdHeadType"],
                            })}
                        >
                            <option value="none">无 · 延续段</option>
                            {HEAD_TYPES.map((head) => (
                                <option key={head} value={head}>
                                    {head} · {SIRIUS_NOTE_TYPES.find(({ code }) => code === head)?.label}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className={cls("checkbox-field")}>
                        <input
                            type="checkbox"
                            checked={properties.autoTicks}
                            onChange={(event) => change({ autoTicks: event.target.checked })}
                        />
                        autoTicks · 每半拍自动判定
                    </label>
                    <p className={cls("help-text")}>
                        110 默认头为 82，可独立改为 83 或无头；更改头不会更改区间类型。
                    </p>
                </>
            )}
        </>
    );
}

function SelectedNoteForm({
    note,
    readOnly,
    onUpdate,
}: {
    note: ChartNote & { sirius: SiriusNoteProperties };
    readOnly: boolean;
    onUpdate: (note: ChartNote) => void;
}) {
    const [type, setType] = React.useState(note.type);
    const [properties, setProperties] = React.useState({ ...note.sirius });
    const [annotation, setAnnotation] = React.useState(note.annotation ?? "");
    const hold = isSiriusHoldType(note.type);
    const compatibleTypes = SIRIUS_NOTE_TYPES.filter((entry) => (entry.kind === "hold") === hold);

    return (
        <>
            <p className={cls("help-text")}>
                {readOnly ? "浏览只读：可查看属性；切换选中模式后编辑。" : "修改保留在表单中，点击应用一次保存全部字段。"}
            </p>
            <fieldset className={cls("property-fields")} disabled={readOnly}>
                <label className={cls("control-field")}>
                    类型（仅限同类{hold ? "长条" : "点音符"}）
                    <select
                        className={cls("control-input")}
                        value={type}
                        onChange={(event) => {
                            const nextType = Number(event.target.value);
                            setType(nextType);
                            if (!isSiriusScratchType(nextType)) {
                                setProperties((previous) => ({
                                    ...previous, gimmick: "0", scratchLength: 0,
                                }));
                            }
                        }}
                    >
                        {compatibleTypes.map(({ code, label }) => (
                            <option key={code} value={code}>
                                {code} · {label}{isStandaloneHead(code) ? "（独立头）" : ""}
                            </option>
                        ))}
                    </select>
                </label>
                <PropertyFields type={type} properties={properties} onChange={setProperties} />
                <label className={cls("control-field")}>
                    标注
                    <textarea
                        className={cls("control-input", "annotation-input")}
                        value={annotation}
                        onChange={(event) => setAnnotation(event.target.value)}
                        rows={2}
                    />
                </label>
            </fieldset>
            <button
                type="button"
                className={cls("button")}
                disabled={readOnly}
                onClick={() => {
                    if (readOnly) return;
                    onUpdate({ ...note, type, sirius: { ...properties }, annotation });
                }}
            >
                应用到选中音符
            </button>
        </>
    );
}

export default function SiriusNoteControls({
    sirius,
    drawing,
    readOnly,
    onDraw,
}: {
    sirius: SiriusMenuProps;
    drawing: boolean;
    readOnly: boolean;
    onDraw: () => void;
}) {
    const selectType = (type: number) => {
        if (type !== sirius.type) {
            const defaults = defaultSiriusProperties(type);
            const scratch = isSiriusScratchType(type);
            const hold = isSiriusHoldType(type);
            sirius.onTypeChange(type);
            sirius.onPropertiesChange({
                ...sirius.properties,
                holdHeadType: defaults.holdHeadType,
                autoTicks: hold && (isSiriusHoldType(sirius.type) ? sirius.properties.autoTicks : defaults.autoTicks),
                gimmick: scratch && (hold || sirius.properties.gimmick !== "JumpScratch")
                    ? sirius.properties.gimmick : "0",
                scratchLength: scratch ? sirius.properties.scratchLength : 0,
            });
        }
        onDraw();
    };
    const typeButton = ({ code, label, color }: SiriusNoteType) => (
        <button
            key={code}
            type="button"
            className={cls("button", "type-button", drawing && sirius.type === code && "button-active")}
            style={{ borderLeftColor: color }}
            title={`${code} · ${label}${isStandaloneHead(code) ? "（专家：独立点音符头，不包含长条区间）" : ""}`}
            aria-pressed={drawing && sirius.type === code}
            onClick={() => selectType(code)}
        >
            <strong>{code}</strong>
            <span>{label}</span>
        </button>
    );
    const selectedNote = sirius.selectedNote;

    return (
        <section
            className={cls("sirius-controls")}
            aria-label="Sirius 音符控件"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
            onKeyUp={(event) => event.stopPropagation()}
            onWheel={(event) => event.stopPropagation()}
        >
            <div className={cls("section-label")}>绘制类型</div>
            <div className={cls("type-grid")}>
                {SIRIUS_NOTE_TYPES.filter(({ code, advanced }) => !advanced && !isStandaloneHead(code)).map(typeButton)}
            </div>
            <details className={cls("advanced-types")}>
                <summary>高级类型 / 专家头</summary>
                <div className={cls("type-grid")}>
                    {SIRIUS_NOTE_TYPES.filter(({ advanced }) => advanced).map(typeButton)}
                </div>
                <p className={cls("help-text")}>
                    专家：80–83 为独立头音符；通常在长条属性中设置 Hold 头即可。
                </p>
                <div className={cls("type-grid")}>
                    {SIRIUS_NOTE_TYPES.filter(({ code }) => isStandaloneHead(code)).map(typeButton)}
                </div>
            </details>
            <div className={cls("section-label")}>
                绘制默认值 · {sirius.type}
            </div>
            <PropertyFields
                type={sirius.type}
                properties={sirius.properties}
                onChange={sirius.onPropertiesChange}
                defaults
            />
            <div className={cls("section-label", "selected-heading")}>选中音符</div>
            {selectedNote?.sirius ? (
                <SelectedNoteForm
                    key={`${JSON.stringify(selectedNote)}:${readOnly}`}
                    note={{ ...selectedNote, sirius: selectedNote.sirius }}
                    readOnly={readOnly}
                    onUpdate={sirius.onUpdateSelected}
                />
            ) : (
                <p className={cls("help-text")}>选择单个 Sirius 音符以查看或编辑属性。</p>
            )}
        </section>
    );
}
