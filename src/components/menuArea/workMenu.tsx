import React from "react";
import AddSound from "./addSound";
import { AudioData, SoundLaneState } from "@/interface/audioData";
import TimeRangeController from "./timeRangeController";
import DeleteActiveSound from "./removeActiveSound";
import PlaySelected from "./playSelectedSound";
import ResetEditor from "./resetEditor";
import ShortcutSettingsModal from "./shortcutSettingsModal";
import type { TimelineOrientation } from "../timelineGeometry";
import styles from "./workMenu.module.css";
import { focusEditorLane, getFocusedEditorLane, isVisibleFocusTarget } from "../editorFocus";

interface _prop {
    editorScopeRef: React.RefObject<HTMLDivElement | null>;
    refSoundLaneStates: SoundLaneState[];
    setSoundLaneStates: (a: SoundLaneState[]) => void;
    refTimeMultiplier: number;
    setTimeMultiplier: (_: number) => void;
    refCurrentTime: number;
    setCurrentTime: (_: number) => void;
    isPlaying: boolean;
    setIsPlaying: (_: boolean) => void;
    Duration: number;
    timeRange?: [number, number];
    addAudioData: (audioData: AudioData) => void;
    removeAudioData: (audioId: string) => void;
    removeMultipleAudioData: (audioIds: string[]) => void;
    resetEditor: () => void;
    onExport: () => void;
    onImport: () => void;
    playheadOffset: number;
    setPlayheadOffset: (v: number) => void;
    orientation: TimelineOrientation;
    onOrientationChange: (orientation: TimelineOrientation) => void;
}

function WorkMenu(prop: _prop) {
    const [isShortcutModalOpen, setIsShortcutModalOpen] = React.useState(false);
    const shortcutButtonRef = React.useRef<HTMLButtonElement>(null);
    const lastFocusedLaneRef = React.useRef<HTMLElement | null>(null);
    const pendingRestoreRef = React.useRef<{
        lane: HTMLElement | null;
        fallback: HTMLButtonElement | null;
        active: Element | null;
    } | null>(null);
    const restoreCleanupRef = React.useRef<(() => void) | null>(null);
    const cancelRestore = React.useCallback(() => {
        pendingRestoreRef.current = null;
        restoreCleanupRef.current?.();
        restoreCleanupRef.current = null;
    }, []);

    React.useEffect(() => {
        const scope = prop.editorScopeRef.current;
        if (!scope) return;
        const rememberLane = (event: FocusEvent) => {
            const lane = getFocusedEditorLane(event.target);
            if (lane && scope.contains(lane)) lastFocusedLaneRef.current = lane;
        };
        const lane = getFocusedEditorLane(document.activeElement);
        if (lane && scope.contains(lane)) lastFocusedLaneRef.current = lane;
        scope.addEventListener("focusin", rememberLane);
        return () => scope.removeEventListener("focusin", rememberLane);
    }, [prop.editorScopeRef]);

    React.useLayoutEffect(() => {
        const pending = pendingRestoreRef.current;
        if (!pending || isShortcutModalOpen) return;
        pendingRestoreRef.current = null;
        // A new dialog or an intentional focus move takes precedence over restoration.
        const onFocusIn = () => cancelRestore();
        document.addEventListener("focusin", onFocusIn);
        const frame = requestAnimationFrame(() => {
            cancelRestore();
            const active = document.activeElement;
            if (active !== document.body && active !== pending.active && active !== null) return;
            if (Array.from(document.querySelectorAll<HTMLElement>("[role='dialog'], dialog[open]"))
                .some(isVisibleFocusTarget)) return;
            if (!focusEditorLane(pending.lane, prop.editorScopeRef.current) &&
                isVisibleFocusTarget(pending.fallback) && !pending.fallback.disabled) {
                pending.fallback.focus({ preventScroll: true });
            }
        });
        restoreCleanupRef.current = () => {
            cancelAnimationFrame(frame);
            document.removeEventListener("focusin", onFocusIn);
        };
    });

    React.useLayoutEffect(() => cancelRestore, [cancelRestore]);

    const requestRestore = (fallback: HTMLButtonElement | null) => {
        cancelRestore();
        pendingRestoreRef.current = {
            lane: lastFocusedLaneRef.current,
            fallback,
            active: document.activeElement,
        };
    };
    const closeShortcutModal = () => {
        requestRestore(shortcutButtonRef.current);
        setIsShortcutModalOpen(false);
    };
    const isVertical = prop.orientation === "vertical";
    const orientationLabel = isVertical ? "纵向" : "横向";
    const nextOrientationLabel = isVertical ? "横向" : "纵向";

    return (
        <div className="WorkMenu">
            <div className={`editor-toolbar-actions ${styles.actions}`}>
                <AddSound key={"add sound"} addAudioData={prop.addAudioData} />
                <DeleteActiveSound
                    key={"delete sound"}
                    refSoundLaneStates={prop.refSoundLaneStates}
                    removeMultipleAudioData={prop.removeMultipleAudioData}
                />
                {prop.timeRange && (
                    <span
                        className="editor-meta-text whitespace-nowrap"
                        style={{
                            fontFamily:
                                "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                            display: "inline-block",
                            minWidth: "170px",
                            fontSize: "14px",
                            textAlign: "left",
                        }}
                    >
                        {prop.timeRange[0].toFixed(4)} -{" "}
                        {prop.timeRange[1].toFixed(4)} |{" "}
                        {(prop.timeRange[1] - prop.timeRange[0]).toFixed(4)}s
                    </span>
                )}
                <span style={{ margin: "0 -2px" }}>
                    <TimeRangeController
                        key={"time scale"}
                        refTimeMultiplier={prop.refTimeMultiplier}
                        setTimeMultiplier={prop.setTimeMultiplier}
                        refCurrentTime={prop.refCurrentTime}
                        setCurrentTime={prop.setCurrentTime}
                        Duration={prop.Duration}
                        isPlaying={prop.isPlaying}
                    />
                </span>
                <div
                    style={{
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        gap: "4px",
                    }}
                >
                    <PlaySelected
                        key={"play selected"}
                        refCurrentTime={prop.refCurrentTime}
                        refIsPlaying={prop.isPlaying}
                        setCurrentTime={prop.setCurrentTime}
                        setIsPlaying={prop.setIsPlaying}
                        refSoundLaneStates={prop.refSoundLaneStates}
                    />
                    <ResetEditor
                        key={"reset editor"}
                        resetEditor={prop.resetEditor}
                    />
                    <span
                        className="editor-meta-text"
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "3px",
                            marginLeft: "4px",
                        }}
                    >
                        <span style={{ fontSize: "12px" }}> </span>
                        <input
                            type="number"
                            step={1}
                            min={0}
                            value={prop.playheadOffset * 1000}
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                            onWheel={(e) => e.stopPropagation()}
                            onChange={(e) => {
                                const v = Number(e.target.value) / 1000;
                                if (Number.isFinite(v) && v >= 0) {
                                    prop.setPlayheadOffset(v);
                                }
                            }}
                            style={{
                                minWidth: "44px",
                                maxWidth: "60px",
                                fontFamily:
                                    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                                fontSize: "12px",
                                textAlign: "right",
                                border: "1px solid #d4d4d8",
                                borderRadius: 0,
                                padding: "1px 4px",
                            }}
                            title="播放时刻辅助确认"
                        />
                        <span style={{ fontSize: "12px" }}>ms</span>
                    </span>
                    <button
                        type="button"
                        className="editor-toolbar-button"
                        onClick={prop.onExport}
                        title="导出项目文件 (.7z)"
                    >
                        <span>导出工程</span>
                    </button>
                    <button
                        type="button"
                        className="editor-toolbar-button"
                        onClick={prop.onImport}
                        title="导入项目文件 (.7z)"
                    >
                        <span>导入工程</span>
                    </button>
                    <div className={styles.viewActions}>
                        <button
                            type="button"
                            className="editor-toolbar-button"
                            ref={shortcutButtonRef}
                            onClick={() => {
                                cancelRestore();
                                setIsShortcutModalOpen(true);
                            }}
                            onKeyDown={(event) => event.stopPropagation()}
                        >
                            <span>快捷键</span>
                        </button>
                        <button
                            type="button"
                            className={`editor-toolbar-button ${styles.orientationToggle}`}
                            aria-label={`时间轴：${orientationLabel}，点击切换为${nextOrientationLabel}`}
                            onClick={(event) => {
                                requestRestore(event.currentTarget);
                                prop.onOrientationChange(isVertical ? "horizontal" : "vertical");
                            }}
                            onKeyDown={(event) => event.stopPropagation()}
                            title={`点击切换为${nextOrientationLabel}时间轴；纵向模式下 Shift+滚轮横向浏览音频`}
                        >
                            时间轴：{orientationLabel}
                        </button>
                    </div>
                </div>
            </div>
            {isShortcutModalOpen && (
                <ShortcutSettingsModal
                    onClose={closeShortcutModal}
                />
            )}
        </div>
    );
}

export default WorkMenu;
