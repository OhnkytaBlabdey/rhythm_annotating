import React from "react";
import AddSound from "./addSound";
import { AudioData, SoundLaneState } from "@/interface/audioData";
import TimeRangeController from "./timeRangeController";
import DeleteActiveSound from "./removeActiveSound";
import PlaySelected from "./playSelectedSound";
import ResetEditor from "./resetEditor";
import ShortcutSettingsModal from "./shortcutSettingsModal";

interface _prop {
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
}

function WorkMenu(prop: _prop) {
    const [isShortcutModalOpen, setIsShortcutModalOpen] = React.useState(false);

    return (
        <div className="WorkMenu">
            <div className="editor-toolbar-actions">
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
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
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
                        style={{ display: "inline-flex", alignItems: "center", gap: "3px", marginLeft: "4px" }}
                    >
                        <span style={{ fontSize: "12px" }}>图形偏移</span>
                        <input
                            type="number"
                            step={0.1}
                            min={0}
                            value={prop.playheadOffset}
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                            onWheel={(e) => e.stopPropagation()}
                            onChange={(e) => {
                                const v = Number(e.target.value);
                                if (Number.isFinite(v) && v >= 0) {
                                    prop.setPlayheadOffset(v);
                                }
                            }}
                            style={{
                                width: "56px",
                                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                                fontSize: "12px",
                                textAlign: "right",
                                border: "1px solid #d4d4d8",
                                borderRadius: "4px",
                                padding: "1px 4px",
                            }}
                            title="播放参考线图形偏移(秒)"
                        />
                        <span style={{ fontSize: "12px" }}>s</span>
                    </span>
                    <button
                        type="button"
                        className="editor-toolbar-button"
                        onClick={prop.onExport}
                        title="导出项目文件 (.7z)"
                    >
                        <span>导出</span>
                    </button>
                    <button
                        type="button"
                        className="editor-toolbar-button"
                        onClick={prop.onImport}
                        title="导入项目文件 (.7z)"
                    >
                        <span>导入</span>
                    </button>
                    <button
                        type="button"
                        className="editor-toolbar-button"
                        onClick={() => setIsShortcutModalOpen(true)}
                    >
                        <span>快捷键</span>
                    </button>
                </div>
            </div>
            {isShortcutModalOpen && (
                <ShortcutSettingsModal
                    onClose={() => setIsShortcutModalOpen(false)}
                />
            )}
        </div>
    );
}

export default WorkMenu;
