"use client";
import React from "react";
import style from "./noteMenu.module.css";
import classNames from "classnames/bind";
import { EditMode } from "../noteState";
import { useAppSettings } from "@/components/appSettingsContext";

const cls = classNames.bind(style);

interface _p {
    mode: EditMode;
    setMode: (m: EditMode) => void;
    canUndo: boolean;
    canRedo: boolean;
    hasSelection: boolean;
    hasClipboard: boolean;
    currentBpm: number;
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
    exportText: string;
    lastError: string | null;
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
            onClick={onClick}
            title={title ?? label}
            className={cls("button", active ? "button-active" : "")}
        >
            {label}
        </button>
    );
}

interface ActionButtonProps {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    title?: string;
}

function ActionButton({ label, onClick, disabled, title }: ActionButtonProps) {
    return (
        <button
            onClick={onClick}
            title={title ?? label}
            disabled={disabled}
            className={cls("button", disabled ? "button-disabled" : "")}
        >
            {label}
        </button>
    );
}

export default function NoteMenu(p: _p) {
    const { getKeyboardShortcutLabel } = useAppSettings();
    const [isExportOpen, setIsExportOpen] = React.useState(false);
    const [measureBpmInput, setMeasureBpmInput] = React.useState<string>("");

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
        { mode: "paste", label: "粘贴", title: "粘贴模式" },
    ];

    const modeShortcutMap: Record<EditMode, string> = {
        browse: getKeyboardShortcutLabel("note.mode.browse"),
        "insert-strong": getKeyboardShortcutLabel("note.mode.insertStrong"),
        "insert-weak": getKeyboardShortcutLabel("note.mode.insertWeak"),
        "insert-ln": getKeyboardShortcutLabel("note.mode.insertLn"),
        select: getKeyboardShortcutLabel("note.mode.select"),
        paste: getKeyboardShortcutLabel("note.mode.paste"),
    };

    return (
        <div className={cls("menu")}>
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
                    title="删除选中 Note (Del)"
                    disabled={!p.hasSelection}
                    onClick={p.onDelete}
                />
                <ActionButton
                    label="复制"
                    title="复制选中 Note (Ctrl+C)"
                    disabled={!p.hasSelection}
                    onClick={p.onCopy}
                />
                <ActionButton
                    label="剪切"
                    title="剪切选中 Note (Ctrl+X)"
                    disabled={!p.hasSelection}
                    onClick={p.onCut}
                />
            </div>

            {/* History */}
            <div className={cls("section-label")}>历史</div>
            <div className={cls("button-group")}>
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

            {/* BPM */}
            <div className={cls("section-label")}>BPM</div>
            <div className={cls("bpm-row")}>
                <input
                    type="number"
                    min={1}
                    max={999}
                    step={1}
                    value={p.currentBpm}
                    onWheel={(e) => e.stopPropagation()}
                    onChange={(e) => {
                        const v = Number(e.target.value);
                        if (v > 0 && Number.isFinite(v)) p.setCurrentBpm(v);
                    }}
                    className={cls("bpm-input")}
                    title="当前轨道 BPM"
                />
                <span className={cls("bpm-unit")}>bpm</span>
            </div>

            <div className={cls("bpm-row")}>
                <input
                    type="number"
                    min={1}
                    max={999}
                    step={1}
                    value={measureBpmInput}
                    disabled={!p.canEditCurrentMeasureBpm}
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
                    className={cls("bpm-input")}
                    title="当前选中小节 BPM"
                />
                <span className={cls("bpm-unit")}>bpm</span>
            </div>

            <div className={cls("section-label")}>等分</div>
            <div className={cls("bpm-row")}>
                <input
                    type="number"
                    min={1}
                    max={64}
                    step={1}
                    value={p.division}
                    onWheel={(e) => e.stopPropagation()}
                    onChange={(e) => {
                        const v = Number(e.target.value);
                        if (v >= 1 && Number.isFinite(v)) p.setDivision(v);
                    }}
                    className={cls("bpm-input")}
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
                <span className={cls("bpm-unit")}>n</span>
            </div>

            <div className={cls("section-label")}>Lane</div>
            <div className={cls("button-group")}>
                <ActionButton
                    label="清空本Lane"
                    title="清空当前 NoteLane 数据"
                    onClick={p.onClearLane}
                />
                <ActionButton
                    label="导出文本"
                    title="导出当前 NoteLane 的 JSON"
                    onClick={() => setIsExportOpen(true)}
                />
                <ActionButton
                    label="删除本Lane"
                    title="删除当前 NoteLane"
                    onClick={p.onDeleteLane}
                />
            </div>

            {p.lastError && <div className={cls("error")}>{p.lastError}</div>}

            {isExportOpen && (
                <div className={cls("modal-backdrop")}>
                    <div className={cls("modal")}>
                        <div className={cls("modal-title")}>
                            导出 NoteLane JSON
                        </div>
                        <textarea
                            readOnly
                            className={cls("modal-text")}
                            value={p.exportText}
                            onWheel={(e) => e.stopPropagation()}
                        />
                        <div className={cls("modal-actions")}>
                            <button
                                className={cls("button")}
                                onClick={() => {
                                    void navigator.clipboard.writeText(
                                        p.exportText,
                                    );
                                }}
                            >
                                复制
                            </button>
                            <button
                                className={cls("button")}
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
