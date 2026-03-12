"use client";
import React from "react";
import style from "./noteMenu.module.css";
import classNames from "classnames/bind";
import { EditMode } from "../noteState";

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
    division: number;
    setDivision: (division: number) => void;
    onDelete: () => void;
    onCopy: () => void;
    onCut: () => void;
    onUndo: () => void;
    onRedo: () => void;
    onDeleteLane: () => void;
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
    const [isExportOpen, setIsExportOpen] = React.useState(false);

    const MODES: { mode: EditMode; label: string; title: string }[] = [
        { mode: "browse", label: "浏览", title: "浏览模式 (只读)" },
        { mode: "insert-strong", label: "强拍", title: "插入强拍 (type 0)" },
        { mode: "insert-weak", label: "弱拍", title: "插入弱拍 (type 1)" },
        { mode: "insert-ln", label: "长键", title: "插入长键 (两步点击)" },
        { mode: "select", label: "选中", title: "选中模式" },
        { mode: "paste", label: "粘贴", title: "粘贴模式" },
    ];

    return (
        <div className={cls("menu")}>
            {/* Mode group */}
            <div className={cls("section-label")}>模式</div>
            <div className={cls("button-group")}>
                {MODES.map(({ mode, label, title }) => (
                    <ModeButton
                        key={mode}
                        label={label}
                        title={title}
                        active={p.mode === mode}
                        onClick={() => p.setMode(mode)}
                    />
                ))}
            </div>

            {/* Edit actions */}
            <div className={cls("section-label")}>编辑</div>
            <div className={cls("button-group")}>
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
                    onChange={(e) => {
                        const v = Number(e.target.value);
                        if (v > 0 && Number.isFinite(v)) p.setCurrentBpm(v);
                    }}
                    className={cls("bpm-input")}
                    title="当前轨道 BPM"
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
                    onChange={(e) => {
                        const v = Number(e.target.value);
                        if (v >= 1 && Number.isFinite(v)) p.setDivision(v);
                    }}
                    className={cls("bpm-input")}
                    title="当前 NoteLane 的单拍等分"
                />
                <span className={cls("bpm-unit")}>n</span>
            </div>

            <div className={cls("section-label")}>Lane</div>
            <div className={cls("button-group")}>
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
