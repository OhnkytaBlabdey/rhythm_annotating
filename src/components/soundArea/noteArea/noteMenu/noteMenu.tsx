"use client";
import React from "react";
import style from "./noteMenu.module.css";
import classNames from "classnames/bind";
import { EditMode } from "../noteState";
import { useAppSettings } from "@/components/appSettingsContext";
import Image from "@/components/Image";
import type { ChartNote } from "../chartTypes";
import type { WdsNoteProperties } from "../wdsTypes";
import type { WdsExportResult } from "@/lib/wdsExport";
import type { WdsChartExportResult } from "@/lib/wdsChartExport";
import WdsNoteControls from "./wdsNoteControls";

const cls = classNames.bind(style);

type ExportFormat = "internal" | "malody" | "sus" | "wds" | "wdschart";

export interface WdsMenuProps {
    type: number;
    properties: WdsNoteProperties;
    onTypeChange: (type: number) => void;
    onPropertiesChange: (properties: WdsNoteProperties) => void;
    selectedNote: ChartNote | null;
    onUpdateSelected: (note: ChartNote) => void;
    exportResult: WdsExportResult;
    chartExportResult: WdsChartExportResult;
    offset: number;
    setOffset: (seconds: number) => void;
}

function getExportFileStem(fileName: string): string {
    const cleaned = (fileName || "notelane")
        .replace(/[\\/]/g, "_")
        .replace(/\.[^./\\]+$/, "")
        .replace(/[<>:"|?*\x00-\x1f]/g, "_")
        .trim();
    return cleaned || "notelane";
}

function downloadTextFile(text: string, fileName: string, type: string) {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

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
    onClearLane: () => void;
    onDeleteLane: () => void;
    onImportText: (text: string) => string | null;
    exportText: string;
    malodyExportText: string;
    susExportText: string;
    exportFileBaseName: string;
    lastError: string | null;
    noteLaneOffset: number;
    setNoteLaneOffset: (v: number) => void;
    onInsertMeasure: () => void;
    onDeleteMeasure: () => void;
    onEditSave: (text: string) => string | null;
    getEditText: () => string;
    wds?: WdsMenuProps;
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
            onClick={() => {
                if (!disabled) onClick();
            }}
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
    const [exportFormat, setExportFormat] = React.useState<ExportFormat>("internal");
    const [importText, setImportText] = React.useState("");
    const [importError, setImportError] = React.useState<string | null>(null);
    const [measureBpmInput, setMeasureBpmInput] = React.useState<string>("");
    const [isEditOpen, setIsEditOpen] = React.useState(false);
    const [editText, setEditText] = React.useState("");
    const [editError, setEditError] = React.useState<string | null>(null);
    const [editOriginalText, setEditOriginalText] = React.useState("");
    const [copyStatus, setCopyStatus] = React.useState<{
        format: ExportFormat;
        text: string;
        message: string;
    } | null>(null);
    const copyRequestRef = React.useRef(0);
    const offset = p.wds?.offset ?? 0;
    const [offsetDraft, setOffsetDraft] = React.useState({ value: offset, text: String(offset) });
    if (!Object.is(offsetDraft.value, offset)) {
        setOffsetDraft({ value: offset, text: String(offset) });
    }
    const exportPreviewRef = React.useRef<HTMLTextAreaElement>(null);
    const readOnly = !!p.wds && p.mode === "browse";

    const mutate = (action: () => void) => {
        if (!readOnly) action();
    };

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

    const MODES: { mode: EditMode; label: string; title: string }[] = p.wds ? [
        { mode: "browse", label: "浏览", title: "浏览模式（只读）" },
        { mode: "insert-wds", label: "绘制", title: "绘制当前 WDS 类型；长条两次点击起点和终点" },
        { mode: "select", label: "选中", title: "选中模式（可编辑及导入 JSON）" },
        { mode: "paste", label: "粘贴", title: `粘贴模式 (${getKeyboardShortcutLabel("note.paste") || "Ctrl+V"} 直接粘贴)` },
        { mode: "annotate", label: "标注", title: "标注模式" },
    ] : [
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

    const modeShortcutMap: Partial<Record<EditMode, string>> = {
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

    const activeExportFormat = p.wds
        ? (exportFormat === "internal" || exportFormat === "wdschart" ? exportFormat : "wds")
        : (exportFormat === "wds" || exportFormat === "wdschart" ? "internal" : exportFormat);
    const offsetInvalid = !!p.wds && (
        offsetDraft.text.trim() === "" || !Number.isFinite(Number(offsetDraft.text))
    );
    const exportError = activeExportFormat === "wds"
        ? p.wds?.exportResult.error ?? (offsetInvalid ? "请输入有限的导出偏移秒数。" : null)
        : activeExportFormat === "wdschart"
        ? p.wds?.chartExportResult.error ?? null
        : null;
    const currentExportText =
        activeExportFormat === "wdschart"
            ? p.wds?.chartExportResult.text ?? ""
            : activeExportFormat === "wds"
            ? (exportError ? "" : p.wds?.exportResult.text ?? "")
            : activeExportFormat === "malody"
            ? p.malodyExportText
            : activeExportFormat === "sus"
              ? p.susExportText
              : p.exportText;
    const exportFileStem = React.useMemo(
        () => getExportFileStem(p.exportFileBaseName),
        [p.exportFileBaseName],
    );
    const exportExtension = activeExportFormat === "internal" ? "json"
        : activeExportFormat === "malody" ? "mc"
        : activeExportFormat === "wdschart" ? "wdschart"
        : activeExportFormat === "wds" ? "txt" : "sus";

    React.useEffect(() => {
        return () => {
            // Ignore clipboard completions after the export target changes or closes.
            copyRequestRef.current += 1;
        };
    }, [activeExportFormat, currentExportText, exportError, isExportOpen]);

    const copyExport = async () => {
        if (exportError) return;
        const request = ++copyRequestRef.current;
        setCopyStatus(null);
        try {
            if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
            await navigator.clipboard.writeText(currentExportText);
            if (request !== copyRequestRef.current) return;
            setCopyStatus({
                format: activeExportFormat,
                text: currentExportText,
                message: "已复制当前导出文本。",
            });
        } catch {
            if (request !== copyRequestRef.current) return;
            exportPreviewRef.current?.focus();
            exportPreviewRef.current?.select();
            setCopyStatus({
                format: activeExportFormat,
                text: currentExportText,
                message: "无法访问剪贴板。已选中预览文本，请按 Ctrl+C / ⌘C 手动复制，或下载文件。",
            });
        }
    };

    return (
        <div className={cls("menu")}>
            {/* Offset */}
            <div className={cls("section-label")}>图形偏移</div>
            <div className={cls("bpm-row")}>
                <input
                    type="number"
                    step={1}
                    value={Math.round(p.noteLaneOffset * 1000)}
                    onMouseDown={stopInteraction}
                    onClick={stopInteraction}
                    onKeyDown={stopInteraction}
                    onWheel={(e) => e.stopPropagation()}
                    onChange={(e) => {
                        const v = Number(e.target.value);
                        if (Number.isFinite(v)) p.setNoteLaneOffset(v / 1000);
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

            {p.wds && (
                <WdsNoteControls
                    wds={p.wds}
                    drawing={p.mode === "insert-wds"}
                    readOnly={readOnly}
                    onDraw={() => p.setMode("insert-wds")}
                />
            )}

            {/* Edit actions */}
            <div className={cls("section-label")}>编辑</div>
            <div className={cls("button-group", "edit-grid")}>
                <ActionButton
                    label="删除"
                    title={`删除选中 Note (${getKeyboardShortcutLabel("note.delete") || "Del"})`}
                    disabled={readOnly || !p.hasSelection}
                    onClick={() => mutate(p.onDelete)}
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
                    disabled={readOnly || !p.hasSelection}
                    onClick={() => mutate(p.onCut)}
                />
            </div>

            {/* History */}
            <div className={cls("compact-row")}>
                <span className={cls("inline-label")}>历史</span>
                <ActionButton
                    label="撤回"
                    title="撤回 (Ctrl+Z)"
                    disabled={readOnly || !p.canUndo}
                    onClick={() => mutate(p.onUndo)}
                />
                <ActionButton
                    label="重做"
                    title="重做 (Ctrl+Y)"
                    disabled={readOnly || !p.canRedo}
                    onClick={() => mutate(p.onRedo)}
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
                    disabled={readOnly || (p.bpmLocked ?? false)}
                    onMouseDown={stopInteraction}
                    onClick={stopInteraction}
                    onKeyDown={stopInteraction}
                    onWheel={(e) => e.stopPropagation()}
                    onChange={(e) => {
                        const v = Number(e.target.value);
                        if (!readOnly && !p.bpmLocked && v > 0 && Number.isFinite(v)) p.setCurrentBpm(v);
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
                    disabled={readOnly || !p.canEditCurrentMeasureBpm}
                    onMouseDown={stopInteraction}
                    onClick={stopInteraction}
                    onKeyDown={stopInteraction}
                    onWheel={(e) => e.stopPropagation()}
                    onChange={(e) => {
                        const nextValue = e.target.value;
                        setMeasureBpmInput(nextValue);
                        const v = Number(nextValue);
                        if (
                            !readOnly &&
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
                    disabled={readOnly}
                    onClick={() => mutate(p.onInsertMeasure)}
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
                    disabled={readOnly}
                    onClick={() => mutate(p.onDeleteMeasure)}
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
                    disabled={readOnly}
                    onClick={() => mutate(p.onClearLane)}
                >
                    <Image src="/assets/icons/emptyNoteLane.svg" alt="清空" width={16} height={16} />
                </ActionButton>
                <ActionButton
                    title="从内部 JSON 文本覆盖当前 NoteLane"
                    disabled={readOnly}
                    onClick={() => {
                        if (readOnly) return;
                        setImportError(null);
                        setImportText("");
                        setIsImportOpen(true);
                    }}
                >
                    <Image src="/assets/icons/importNoteLane.svg" alt="导入" width={16} height={16} />
                </ActionButton>
                <ActionButton
                    title={p.wds ? "导出 WDS TXT、WDSCHART 或无损内部 JSON" : "导出当前 NoteLane 的 JSON"}
                    onClick={() => {
                        setExportFormat(p.wds ? "wds" : "internal");
                        setOffsetDraft({ value: offset, text: String(offset) });
                        setCopyStatus(null);
                        setIsExportOpen(true);
                    }}
                >
                    <Image src="/assets/icons/exportNoteLane.svg" alt="导出" width={16} height={16} />
                </ActionButton>
                <ActionButton
                    title="编辑当前 NoteLane JSON"
                    disabled={readOnly}
                    onClick={() => {
                        if (readOnly) return;
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
                    title="删除当前轨道"
                    onClick={p.onDeleteLane}
                >
                    <Image src="/assets/icons/deleteNoteLane.svg" alt="删除当前轨道" width={16} height={16} />
                </ActionButton>
            </div>

            {p.lastError && <div className={cls("error")} role="alert">{p.lastError}</div>}

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
                            readOnly={readOnly}
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
                                disabled={readOnly}
                                onMouseDown={stopInteraction}
                                onClick={() => {
                                    if (readOnly) return;
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
                                disabled={readOnly}
                                onMouseDown={stopInteraction}
                                onClick={() => {
                                    if (readOnly) return;
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
                            {p.wds ? "导出 WDS 谱面" : "导出 NoteLane"}
                        </div>
                        <div className={cls("format-bar")}>
                            {(p.wds ? [
                                { format: "internal" as const, label: "内部 JSON（无损）" },
                                { format: "wds" as const, label: "WDS TXT" },
                                { format: "wdschart" as const, label: "WDSCHART (.wdschart)" },
                            ] : [
                                { format: "internal" as const, label: "内部 JSON" },
                                { format: "malody" as const, label: "malody" },
                                { format: "sus" as const, label: "sus" },
                            ]).map(({ format, label }) => (
                                <button
                                    key={format}
                                    type="button"
                                    className={cls("button", activeExportFormat === format && "button-active")}
                                    aria-pressed={activeExportFormat === format}
                                    onMouseDown={stopInteraction}
                                    onClick={() => {
                                        setExportFormat(format);
                                        setCopyStatus(null);
                                    }}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                        {activeExportFormat === "wds" && p.wds && (
                            <>
                                <div className={cls("export-warning")}>
                                    <strong>不可逆、有损，不能从 TXT 恢复 BPM、拍点及编辑信息；请保留工程/内部 JSON。</strong>
                                    {p.wds.exportResult.warnings.length > 0 && (
                                        <ul>
                                            {p.wds.exportResult.warnings.map((warning, index) => (
                                                <li key={index}>{warning}</li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                                <label className={cls("export-offset")}>
                                    导出时间偏移（秒）
                                    <input
                                        type="number"
                                        step="any"
                                        className={cls("control-input")}
                                        value={offsetDraft.text}
                                        disabled={readOnly}
                                        aria-invalid={offsetInvalid}
                                        onKeyDown={stopInteraction}
                                        onWheel={stopInteraction}
                                        onChange={(event) => {
                                            if (readOnly) return;
                                            const value = event.target.value;
                                            setCopyStatus(null);
                                            const seconds = Number(value);
                                            const valid = value.trim() !== "" && Number.isFinite(seconds);
                                            setOffsetDraft({ value: valid ? seconds : offset, text: value });
                                            if (valid) {
                                                p.wds?.setOffset(seconds);
                                            }
                                        }}
                                    />
                                </label>
                                <p className={cls("export-help")}>
                                    此工程设置由你显式指定，仅向导出的实际时间加一次；不会自动叠加图形偏移或音频偏移。输出为无表头纯文本。
                                    {readOnly && " 浏览模式只读；请切换选中模式后修改偏移。"}
                                </p>
                            </>
                        )}
                        {activeExportFormat === "wdschart" && p.wds && (
                            <>
                                <p className={cls("export-help")}>
                                    .wdschart 保留拍位与 BPM；音频绑定和偏移需在目标编辑器的工程中设置，TXT 导出偏移不写入此文件。
                                </p>
                                {p.wds.chartExportResult.warnings.length > 0 && (
                                    <div className={cls("export-warning")}>
                                        <ul>
                                            {p.wds.chartExportResult.warnings.map((warning, index) => (
                                                <li key={index}>{warning}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </>
                        )}
                        {exportError && (
                            <div className={cls("error")} role="alert">导出失败：{exportError}</div>
                        )}
                        <textarea
                            ref={exportPreviewRef}
                            readOnly
                            className={cls("modal-text")}
                            aria-label="导出文本预览"
                            value={currentExportText}
                            onMouseDown={stopInteraction}
                            onClick={stopInteraction}
                            onKeyDown={stopInteraction}
                            onWheel={(e) => e.stopPropagation()}
                        />
                        {copyStatus?.format === activeExportFormat && copyStatus.text === currentExportText && !exportError && (
                            <p className={cls("export-help")} role="status">{copyStatus.message}</p>
                        )}
                        <div className={cls("modal-actions")}>
                            <button
                                type="button"
                                className={cls("button")}
                                disabled={!!exportError}
                                onMouseDown={stopInteraction}
                                onClick={() => {
                                    if (exportError) return;
                                    downloadTextFile(
                                        currentExportText,
                                        `${exportFileStem}.${exportExtension}`,
                                        activeExportFormat === "internal" || activeExportFormat === "malody"
                                            ? "application/json;charset=utf-8"
                                            : "text/plain;charset=utf-8",
                                    );
                                }}
                            >
                                下载 .{exportExtension}
                            </button>
                            <button
                                type="button"
                                className={cls("button")}
                                disabled={!!exportError}
                                onMouseDown={stopInteraction}
                                onClick={() => { void copyExport(); }}
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
