"use client";
import React from "react";
import style from "./noteMenu.module.css";
import classNames from "classnames/bind";
import { EditMode } from "../noteState";
import { useAppSettings } from "@/components/appSettingsContext";
import Image from "@/components/Image";

const cls = classNames.bind(style);

interface _p {
    mode: EditMode;
    setMode: (m: EditMode) => void;
    canUndo: boolean;
    canRedo: boolean;
    hasSelection: boolean;
    hasClipboard: boolean;
    currentBpm: number;
    bpmLocked?: boolean;
    setCurrentBpm: (bpm: number) => void;
    currentMeasureBpm: number | null;
    canEditCurrentMeasureBpm: boolean;
    setCurrentMeasureBpm: (bpm: number) => void;
    division: number;
    setDivision: (division: number) => void;
    onDelete: () => void;
    onCopy: () => void;
    onCut: () => void;
    onUndo: () => void;
    onRedo: () => void;
    onDeleteLane: () => void;
    onClearLane: () => void;
    onImportText: (text: string) => string | null;
    exportText: string;
    malodyExportText: string;
    lastError: string | null;
    noteLaneOffset: number;
    setNoteLaneOffset: (v: number) => void;
    onInsertMeasure: (time?: number) => void;
    onDeleteMeasure: (time?: number) => void;
    onEditSave: (text: string) => string | null;
    getEditText: () => string;
}

interface ModeButtonProps {
    label: string;
    active: boolean;
    onClick: () => void;
    title?: string;
}

function ModeButton({ label, active, onClick, title }: ModeButtonProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            onMouseDown={(event) => event.stopPropagation()}
            title={title ?? label}
            className={cls("button", active ? "button-active" : "")}
        >
            {label}
        </button>
    );
}

interface ActionButtonProps {
    label?: string;
    onClick: () => void;
    disabled?: boolean;
    title?: string;
    children?: React.ReactNode;
}

function ActionButton({ label, onClick, disabled, title, children }: ActionButtonProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            onMouseDown={(event) => event.stopPropagation()}
            title={title ?? label}
            disabled={disabled}
            className={cls("button", disabled ? "button-disabled" : "")}
        >
            {children ?? label}
        </button>
    );
}

export default function NoteMenu(p: _p) {
    const { getKeyboardShortcutLabel } = useAppSettings();
    const [isImportOpen, setIsImportOpen] = React.useState(false);
    const [isExportOpen, setIsExportOpen] = React.useState(false);
    const [exportFormat, setExportFormat] = React.useState<"internal" | "malody">("internal");
    const [importText, setImportText] = React.useState("");
    const [importError, setImportError] = React.useState<string | null>(null);
    const [measureBpmInput, setMeasureBpmInput] = React.useState<string>("");
    const [isEditOpen, setIsEditOpen] = React.useState(false);
    const [editText, setEditText] = React.useState("");
    const [editError, setEditError] = React.useState<string | null>(null);
    const [editOriginalText, setEditOriginalText] = React.useState("");

    const stopInteraction = (event: React.SyntheticEvent) => {
        event.stopPropagation();
    };

    React.useEffect(() => {
        if (p.currentMeasureBpm === null) {
            setMeasureBpmInput("");
            return;
        }
        setMeasureBpmInput(String(p.currentMeasureBpm));
    }, [p.currentMeasureBpm]);

    const MODES: { mode: EditMode; label: string; title: string }[] = [
        { mode: "browse", label: "浏览", title: "浏览模式 (只读)" },
        { mode: "insert-strong", label: "强拍", title: "插入强拍 (type 0)" },
        { mode: "insert-weak", label: "弱拍", title: "插入弱拍 (type 1)" },
        { mode: "insert-ln", label: "长键", title: "插入长键 (两步点击)" },
        { mode: "select", label: "选中", title: "选中模式" },
        { mode: "paste", label: "粘贴", title: `粘贴模式 (${getKeyboardShortcutLabel("note.paste") || "Ctrl+V"} 直接粘贴)` },
        { mode: "insert-start", label: "起始", title: "设置起始标记" },
        { mode: "insert-end", label: "结束", title: "设置结束标记" },
        { mode: "annotate", label: "标注", title: "标注模式" },
    ];

    const modeShortcutMap: Record<EditMode, string> = {
        browse: getKeyboardShortcutLabel("note.mode.browse"),
        "insert-strong": getKeyboardShortcutLabel("note.mode.insertStrong"),
        "insert-weak": getKeyboardShortcutLabel("note.mode.insertWeak"),
        "insert-ln": getKeyboardShortcutLabel("note.mode.insertLn"),
        select: getKeyboardShortcutLabel("note.mode.select"),
        paste: getKeyboardShortcutLabel("note.mode.paste"),
        "insert-start": getKeyboardShortcutLabel("note.mode.insertStart"),
        "insert-end": getKeyboardShortcutLabel("note.mode.insertEnd"),
        annotate: getKeyboardShortcutLabel("note.mode.annotate"),
    };

    return (
        <div className={cls("menu")}>
            {/* Offset */}
            <div className={cls("section-label")}>图形偏移</div>
            <div className={cls("bpm-row")}>
                <input
                    type="number"
                    min={0}
                    step={1}
                    value={Math.round(p.noteLaneOffset * 1000)}
                    onMouseDown={stopInteraction}
                    onClick={stopInteraction}
                    onKeyDown={stopInteraction}
                    onWheel={(e) => e.stopPropagation()}
                    onChange={(e) => {
                        const v = Number(e.target.value);
                        if (v >= 0 && Number.isFinite(v)) p.setNoteLaneOffset(v / 1000);
                    }}
                    className={cls("bpm-input")}
                    title="记谱图形偏移(毫秒)，仅canvas像素位移"
                />
                <span className={cls("bpm-unit")}>ms</span>
            </div>

            {/* Mode group */}
            <div className={cls("section-label")}>模式</div>
            <div className={cls("button-group", "mode-grid")}>
                {MODES.map(({ mode, label, title }) => (
                    <ModeButton
                        key={mode}
                        label={label}
                        title={
                            modeShortcutMap[mode]
                                ? `${title} (${modeShortcutMap[mode]})`
                                : title
                        }
                        active={p.mode === mode}
                        onClick={() => p.setMode(mode)}
                    />
                ))}
            </div>

            {/* Edit actions */}
            <div className={cls("section-label")}>编辑</div>
            <div className={cls("button-group", "edit-grid")}>
                <ActionButton
                    label="删除"
                    title={`删除选中 Note (${getKeyboardShortcutLabel("note.delete") || "Del"})`}
                    disabled={!p.hasSelection}
                    onClick={p.onDelete}
                />
                <ActionButton
                    label="复制"
                    title={`复制选中 Note (${getKeyboardShortcutLabel("note.copy") || "Ctrl+C"})`}
                    disabled={!p.hasSelection}
                    onClick={p.onCopy}
                />
                <ActionButton
                    label="剪切"
                    title={`剪切选中 Note (${getKeyboardShortcutLabel("note.cut") || "Ctrl+X"})`}
                    disabled={!p.hasSelection}
                    onClick={p.onCut}
                />
            </div>

            {/* History */}
            <div className={cls("compact-row")}>
                <span className={cls("inline-label")}>历史</span>
                <ActionButton
                    label="撤回"
                    title="撤回 (Ctrl+Z)"
                    disabled={!p.canUndo}
                    onClick={p.onUndo}
                />
                <ActionButton
                    label="重做"
                    title="重做 (Ctrl+Y)"
                    disabled={!p.canRedo}
                    onClick={p.onRedo}
                />
            </div>

            {/* 拍 */}
            <div className={cls("compact-row")}>
                <Image src="/assets/icons/setBPM.png" alt="BPM" width={16} height={16} title="BPM" />
                <input
                    type="number"
                    min={1}
                    max={64}
                    step={1}
                    value={p.division}
                    onMouseDown={stopInteraction}
                    onClick={stopInteraction}
                    onKeyDown={stopInteraction}
                    onWheel={(e) => e.stopPropagation()}
                    onChange={(e) => {
                        const v = Number(e.target.value);
                        if (v >= 1 && Number.isFinite(v)) p.setDivision(v);
                    }}
                    className={cls("bpm-input-compact")}
                    title={`当前 NoteLane 的单拍等分${
                        getKeyboardShortcutLabel("note.division.increment")
                            ? `，增加: ${getKeyboardShortcutLabel(
                                  "note.division.increment",
                              )}`
                            : ""
                    }${
                        getKeyboardShortcutLabel("note.division.decrement")
                            ? `，减少: ${getKeyboardShortcutLabel(
                                  "note.division.decrement",
                              )}`
                            : ""
                    }`}
                />
                <span className={cls("bpm-unit")}>等分</span>
            </div>
            <div className={cls("compact-row")}>
                <span className={cls("bpm-unit")}>默认</span>
                <input
                    type="number"
                    min={1}
                    max={999}
                    step={1}
                    value={p.currentBpm}
                    disabled={p.bpmLocked ?? false}
                    onMouseDown={stopInteraction}
                    onClick={stopInteraction}
                    onKeyDown={stopInteraction}
                    onWheel={(e) => e.stopPropagation()}
                    onChange={(e) => {
                        const v = Number(e.target.value);
                        if (v > 0 && Number.isFinite(v)) p.setCurrentBpm(v);
                    }}
                    className={cls("bpm-input-compact")}
                    title={
                        p.bpmLocked
                            ? "BPM 估测中，请稍候..."
                            : "当前轨道默认 BPM，修改后将重设后续空拍"
                    }
                />
                <span className={cls("bpm-unit")}>选中</span>
                <input
                    type="number"
                    min={1}
                    max={999}
                    step={1}
                    value={measureBpmInput}
                    disabled={!p.canEditCurrentMeasureBpm}
                    onMouseDown={stopInteraction}
                    onClick={stopInteraction}
                    onKeyDown={stopInteraction}
                    onWheel={(e) => e.stopPropagation()}
                    onChange={(e) => {
                        const nextValue = e.target.value;
                        setMeasureBpmInput(nextValue);
                        const v = Number(nextValue);
                        if (
                            p.canEditCurrentMeasureBpm &&
                            Number.isFinite(v) &&
                            v >= 1
                        ) {
                            p.setCurrentMeasureBpm(v);
                        }
                    }}
                    className={cls("bpm-input-compact")}
                    title="当前选中拍 BPM，仅修改该拍"
                />
            </div>

            <div className={cls("compact-row")} style={{ gap: "4px" }}>
                <span className={cls("inline-label")}>拍</span>
                <button
                    type="button"
                    onClick={() => p.onInsertMeasure()}
                    onMouseDown={(event) => event.stopPropagation()}
                    title={
                        getKeyboardShortcutLabel("note.measure.insert")
                            ? `在光标处后插一拍 (${getKeyboardShortcutLabel("note.measure.insert")})`
                            : "在光标处后插一拍"
                    }
                    className={cls("button", "measure-btn")}
                >
                    <Image src="/assets/icons/addMeasure.png" alt="添加拍" width={14} height={14} />
                </button>
                <button
                    type="button"
                    onClick={() => p.onDeleteMeasure()}
                    onMouseDown={(event) => event.stopPropagation()}
                    title={
                        getKeyboardShortcutLabel("note.measure.delete")
                            ? `删除光标处拍 (${getKeyboardShortcutLabel("note.measure.delete")})`
                            : "删除光标处拍"
                    }
                    className={cls("button", "measure-btn")}
                >
                    <Image src="/assets/icons/deleteMeasure.png" alt="删除拍" width={14} height={14} />
                </button>
            </div>

            <div className={cls("section-label")}>Lane</div>
            <div className={cls("button-group", "lane-grid")}>
                <ActionButton
                    title="清空当前 NoteLane 数据"
                    onClick={p.onClearLane}
                >
                    <Image src="/assets/icons/emptyNoteLane.svg" alt="清空" width={16} height={16} />
                </ActionButton>
                <ActionButton
                    title="从内部 JSON 文本覆盖当前 NoteLane"
                    onClick={() => {
                        setImportError(null);
                        setImportText("");
                        setIsImportOpen(true);
                    }}
                >
                    <Image src="/assets/icons/importNoteLane.svg" alt="导入" width={16} height={16} />
                </ActionButton>
                <ActionButton
                    title="导出当前 NoteLane 的 JSON"
                    onClick={() => {
                        setExportFormat("internal");
                        setIsExportOpen(true);
                    }}
                >
                    <Image src="/assets/icons/exportNoteLane.svg" alt="导出" width={16} height={16} />
                </ActionButton>
                <ActionButton
                    title="编辑当前 NoteLane JSON"
                    onClick={() => {
                        const text = p.getEditText();
                        setEditOriginalText(text);
                        setEditText(text);
                        setEditError(null);
                        setIsEditOpen(true);
                    }}
                >
                    <Image src="/assets/icons/editNoteLane.svg" alt="编辑" width={16} height={16} />
                </ActionButton>
                <ActionButton
                    title="删除当前 NoteLane"
                    onClick={p.onDeleteLane}
                >
                    <Image src="/assets/icons/deleteNoteLane.svg" alt="删除" width={16} height={16} />
                </ActionButton>
            </div>

            {p.lastError && <div className={cls("error")}>{p.lastError}</div>}

            {isEditOpen && (
                <div
                    className={cls("modal-backdrop")}
                    onClick={() => { setIsEditOpen(false); setEditError(null); }}
                    onMouseDown={() => { setIsEditOpen(false); setEditError(null); }}
                >
                    <div
                        className={cls("modal")}
                        onClick={stopInteraction}
                        onMouseDown={stopInteraction}
                    >
                        <div className={cls("modal-title")}>
                            编辑 NoteLane JSON
                        </div>
                        <textarea
                            className={cls("modal-text")}
                            value={editText}
                            onMouseDown={stopInteraction}
                            onClick={stopInteraction}
                            onKeyDown={stopInteraction}
                            onWheel={(event) => event.stopPropagation()}
                            onChange={(event) => {
                                setEditText(event.target.value);
                                if (editError) setEditError(null);
                            }}
                            placeholder="编辑当前 NoteLane 的内部 JSON"
                        />
                        {editError && (
                            <div className={cls("error")}>{editError}</div>
                        )}
                        <div className={cls("modal-actions")}>
                            <button
                                type="button"
                                className={cls("button")}
                                onMouseDown={stopInteraction}
                                onClick={() => {
                                    const err = p.onEditSave(editText);
                                    if (err) setEditError(err);
                                    else setIsEditOpen(false);
                                }}
                            >
                                保存
                            </button>
                            <button
                                type="button"
                                className={cls("button")}
                                onMouseDown={stopInteraction}
                                onClick={() => {
                                    setEditText(editOriginalText);
                                    setEditError(null);
                                }}
                            >
                                恢复
                            </button>
                            <button
                                type="button"
                                className={cls("button")}
                                onMouseDown={stopInteraction}
                                onClick={() => { setIsEditOpen(false); setEditError(null); }}
                            >
                                取消
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isImportOpen && (
                <div
                    className={cls("modal-backdrop")}
                    onClick={() => setIsImportOpen(false)}
                    onMouseDown={() => setIsImportOpen(false)}
                >
                    <div
                        className={cls("modal")}
                        onClick={stopInteraction}
                        onMouseDown={stopInteraction}
                    >
                        <div className={cls("modal-title")}>
                            导入 NoteLane JSON
                        </div>
                        <textarea
                            className={cls("modal-text")}
                            value={importText}
                            onMouseDown={stopInteraction}
                            onClick={stopInteraction}
                            onKeyDown={stopInteraction}
                            onWheel={(event) => event.stopPropagation()}
                            onChange={(event) => {
                                setImportText(event.target.value);
                                if (importError) {
                                    setImportError(null);
                                }
                            }}
                            placeholder="粘贴内部导出的 NoteLane JSON 或 chartData JSON，导入后会覆盖当前 Lane。"
                        />
                        {importError && (
                            <div className={cls("error")}>{importError}</div>
                        )}
                        <div className={cls("modal-actions")}>
                            <button
                                type="button"
                                className={cls("button")}
                                onMouseDown={stopInteraction}
                                onClick={() => {
                                    const error = p.onImportText(importText);
                                    if (error) {
                                        setImportError(error);
                                        return;
                                    }
                                    setIsImportOpen(false);
                                    setImportText("");
                                    setImportError(null);
                                }}
                            >
                                覆盖当前 Lane
                            </button>
                            <button
                                type="button"
                                className={cls("button")}
                                onMouseDown={stopInteraction}
                                onClick={() => {
                                    setIsImportOpen(false);
                                    setImportError(null);
                                }}
                            >
                                取消
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isExportOpen && (
                <div
                    className={cls("modal-backdrop")}
                    onClick={() => setIsExportOpen(false)}
                    onMouseDown={() => setIsExportOpen(false)}
                >
                    <div
                        className={cls("modal")}
                        onClick={stopInteraction}
                        onMouseDown={stopInteraction}
                    >
                        <div className={cls("modal-title")}>
                            导出 NoteLane
                        </div>
                        <div className={cls("format-bar")}>
                            <button
                                type="button"
                                className={cls(
                                    "button",
                                    exportFormat === "internal"
                                        ? "button-active"
                                        : "",
                                )}
                                onMouseDown={stopInteraction}
                                onClick={() =>
                                    setExportFormat("internal")
                                }
                            >
                                内部
                            </button>
                            <button
                                type="button"
                                className={cls(
                                    "button",
                                    exportFormat === "malody"
                                        ? "button-active"
                                        : "",
                                )}
                                onMouseDown={stopInteraction}
                                onClick={() =>
                                    setExportFormat("malody")
                                }
                            >
                                malody
                            </button>
                        </div>
                        <textarea
                            readOnly
                            className={cls("modal-text")}
                            value={
                                exportFormat === "malody"
                                    ? p.malodyExportText
                                    : p.exportText
                            }
                            onMouseDown={stopInteraction}
                            onClick={stopInteraction}
                            onKeyDown={stopInteraction}
                            onWheel={(e) => e.stopPropagation()}
                        />
                        <div className={cls("modal-actions")}>
                            <button
                                type="button"
                                className={cls("button")}
                                onMouseDown={stopInteraction}
                                onClick={() => {
                                    void navigator.clipboard.writeText(
                                        exportFormat === "malody"
                                            ? p.malodyExportText
                                            : p.exportText,
                                    );
                                }}
                            >
                                复制
                            </button>
                            <button
                                type="button"
                                className={cls("button")}
                                onMouseDown={stopInteraction}
                                onClick={() => setIsExportOpen(false)}
                            >
                                关闭
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
