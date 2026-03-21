"use client";

import React, { useEffect, useMemo, useState } from "react";
import style from "./shortcutSettingsModal.module.css";
import {
    DEFAULT_SHORTCUTS,
    SHORTCUT_DEFINITIONS,
    ShortcutAction,
    ShortcutMap,
    createShortcutComboFromKeyboardEvent,
    createShortcutComboFromWheelEvent,
    findShortcutConflicts,
    getShortcutConflictActions,
} from "@/lib/shortcuts";
import { useAppSettings } from "@/components/appSettingsContext";

interface ShortcutSettingsModalProps {
    onClose: () => void;
}

export default function ShortcutSettingsModal({
    onClose,
}: ShortcutSettingsModalProps) {
    const { shortcuts, saveShortcuts } = useAppSettings();
    const [draft, setDraft] = useState<ShortcutMap>(shortcuts);
    const [captureAction, setCaptureAction] = useState<ShortcutAction | null>(
        null,
    );
    const [saveError, setSaveError] = useState<string | null>(null);

    useEffect(() => {
        if (!captureAction) {
            return;
        }

        const definition = SHORTCUT_DEFINITIONS.find(
            (item) => item.action === captureAction,
        );
        if (!definition) {
            return;
        }

        const onKeyDown = (event: KeyboardEvent) => {
            if (definition.inputType !== "keyboard") {
                return;
            }

            event.preventDefault();
            event.stopPropagation();

            if (event.key === "Escape") {
                setCaptureAction(null);
                return;
            }

            const nextCombo = createShortcutComboFromKeyboardEvent(event);
            if (!nextCombo) {
                return;
            }

            setDraft((prev) => ({
                ...prev,
                [captureAction]: nextCombo,
            }));
            setCaptureAction(null);
        };

        const onWheel = (event: WheelEvent) => {
            if (definition.inputType !== "wheel") {
                return;
            }

            event.preventDefault();
            event.stopPropagation();

            const nextCombo = createShortcutComboFromWheelEvent(event);
            setDraft((prev) => ({
                ...prev,
                [captureAction]: nextCombo,
            }));
            setCaptureAction(null);
        };

        window.addEventListener("keydown", onKeyDown, true);
        window.addEventListener("wheel", onWheel, {
            passive: false,
            capture: true,
        });

        return () => {
            window.removeEventListener("keydown", onKeyDown, true);
            window.removeEventListener("wheel", onWheel, true);
        };
    }, [captureAction]);

    const sections = useMemo(() => {
        const orderedSections: string[] = [];
        const sectionMap = new Map<string, typeof SHORTCUT_DEFINITIONS>();

        for (const definition of SHORTCUT_DEFINITIONS) {
            if (!sectionMap.has(definition.section)) {
                orderedSections.push(definition.section);
                sectionMap.set(definition.section, []);
            }
            sectionMap.get(definition.section)!.push(definition);
        }

        return orderedSections.map((section) => ({
            section,
            definitions: sectionMap.get(section) ?? [],
        }));
    }, []);

    const conflicts = useMemo(() => findShortcutConflicts(draft), [draft]);
    const conflictActions = useMemo(
        () => getShortcutConflictActions(draft),
        [draft],
    );

    const handleSave = () => {
        const result = saveShortcuts(draft);
        if (!result.ok) {
            setSaveError("存在冲突快捷键，保存前需要先处理。");
            return;
        }
        onClose();
    };

    return (
        <div
            className={style.backdrop}
            onClick={onClose}
            onMouseDown={onClose}
        >
            <div
                className={style.modal}
                role="dialog"
                aria-modal="true"
                aria-label="快捷键设置"
                onClick={(event) => event.stopPropagation()}
                onMouseDown={(event) => event.stopPropagation()}
            >
                <div className={style.header}>
                    <div>
                        <h2 className={style.title}>快捷键设置</h2>
                        <p className={style.subtitle}>
                            允许临时冲突，但保存时会阻止重复绑定。空值表示禁用。
                        </p>
                    </div>
                    <button className={style.button} onClick={onClose}>
                        关闭
                    </button>
                </div>

                <div className={style.body}>
                    {captureAction && (
                        <div className={style.capture}>
                            <div>
                                <div className={style.captureTitle}>
                                    {
                                        SHORTCUT_DEFINITIONS.find(
                                            (item) =>
                                                item.action === captureAction,
                                        )?.label
                                    }
                                </div>
                                <div className={style.captureText}>
                                    {SHORTCUT_DEFINITIONS.find(
                                        (item) => item.action === captureAction,
                                    )?.inputType === "wheel"
                                        ? "滚动鼠标滚轮完成录制，Esc 取消。"
                                        : "按下新的键盘组合完成录制，Esc 取消。"}
                                </div>
                            </div>
                            <button
                                className={style.button}
                                onClick={() => setCaptureAction(null)}
                            >
                                取消录制
                            </button>
                        </div>
                    )}

                    {conflicts.length > 0 && (
                        <div className={style.conflictBox}>
                            {conflicts.map((conflict) => (
                                <div key={conflict.combo}>
                                    <strong>{conflict.combo}</strong>
                                    {" 被重复绑定到 "}
                                    {conflict.actions
                                        .map(
                                            (action) =>
                                                SHORTCUT_DEFINITIONS.find(
                                                    (item) =>
                                                        item.action === action,
                                                )?.label ?? action,
                                        )
                                        .join("、")}
                                </div>
                            ))}
                        </div>
                    )}

                    {saveError && (
                        <div className={style.conflictBox}>{saveError}</div>
                    )}

                    {sections.map(({ section, definitions }) => (
                        <section className={style.section} key={section}>
                            <h3 className={style.sectionTitle}>{section}</h3>
                            <div className={style.rows}>
                                {definitions.map((definition) => {
                                    const currentValue =
                                        draft[definition.action] ?? "";
                                    const isConflict = conflictActions.has(
                                        definition.action,
                                    );
                                    return (
                                        <div
                                            key={definition.action}
                                            className={`${style.row} ${isConflict ? style.rowConflict : ""}`}
                                        >
                                            <div className={style.labelBlock}>
                                                <span className={style.label}>
                                                    {definition.label}
                                                </span>
                                                <span
                                                    className={
                                                        style.description
                                                    }
                                                >
                                                    {definition.description}
                                                </span>
                                            </div>
                                            <div
                                                className={`${style.value} ${currentValue ? "" : style.valueEmpty}`}
                                            >
                                                {currentValue || "未设置"}
                                            </div>
                                            <div className={style.actions}>
                                                <button
                                                    className={`${style.button} ${captureAction === definition.action ? style.buttonPrimary : ""}`}
                                                    onClick={() =>
                                                        setCaptureAction(
                                                            definition.action,
                                                        )
                                                    }
                                                >
                                                    {captureAction ===
                                                    definition.action
                                                        ? "录制中"
                                                        : "录制"}
                                                </button>
                                                <button
                                                    className={style.button}
                                                    onClick={() =>
                                                        setDraft((prev) => ({
                                                            ...prev,
                                                            [definition.action]:
                                                                definition.defaultCombo,
                                                        }))
                                                    }
                                                >
                                                    默认
                                                </button>
                                                <button
                                                    className={`${style.button} ${style.buttonDanger}`}
                                                    onClick={() =>
                                                        setDraft((prev) => ({
                                                            ...prev,
                                                            [definition.action]:
                                                                "",
                                                        }))
                                                    }
                                                >
                                                    清空
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    ))}

                    <div className={style.footer}>
                        <div className={style.hint}>
                            保存会直接写入本地设置。关闭不会覆盖当前已保存的快捷键。
                        </div>
                        <div className={style.actions}>
                            <button
                                className={style.button}
                                onClick={() => {
                                    setDraft(DEFAULT_SHORTCUTS);
                                    setSaveError(null);
                                }}
                            >
                                恢复全部默认
                            </button>
                            <button className={style.button} onClick={onClose}>
                                取消
                            </button>
                            <button
                                className={`${style.button} ${style.buttonPrimary}`}
                                disabled={conflicts.length > 0}
                                onClick={handleSave}
                            >
                                保存
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
