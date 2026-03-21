// PlaySelected.tsx
import React, { useEffect, useMemo, useRef, useContext } from "react";
import { AudioDataCtx } from "../audioContext";
import { SoundLaneState } from "@/interface/audioData";

const UI_UPDATE_INTERVAL_MS = 33;
const PLAY_ALL_KEY = "__PLAY_ALL__";

interface _p {
    refCurrentTime: number;
    setCurrentTime: (_: number) => void;
    refIsPlaying: boolean;
    setIsPlaying: (_: boolean) => void;
    refSoundLaneStates: SoundLaneState[];
}

function getSelectionKey(soundLaneStates: SoundLaneState[]): string {
    const selectedIds = soundLaneStates
        .filter((state) => state.isActive)
        .map((state) => state.audioId)
        .sort();

    if (selectedIds.length === 0) return PLAY_ALL_KEY;
    return selectedIds.join("|");
}

function PlaySelected(prop: _p) {
    const rafRef = useRef<number | null>(null);
    const startTime = useRef<number | null>(null);
    const isPlayingRef = useRef(prop.refIsPlaying);
    const audios = useContext(AudioDataCtx);
    const ctxRef = useRef<AudioContext | null>(null);
    const sourcesRef = useRef<AudioBufferSourceNode[]>([]);
    const maxDurationRef = useRef<number>(0);
    const onCompleteRef = useRef<(() => void) | null>(null);
    const initialTimeRef = useRef<number>(0);
    const lastUiUpdateRef = useRef<number>(0);
    const tickRef = useRef<((timestamp: number) => void) | null>(null);
    const propRef = useRef(prop);
    const playingSelectionKeyRef = useRef<string>("");
    const selectionKey = useMemo(
        () => getSelectionKey(prop.refSoundLaneStates),
        [prop.refSoundLaneStates],
    );

    // 保持 propRef 同步
    useEffect(() => {
        propRef.current = prop;
    }, [prop]);

    // 同步 refIsPlaying 到 ref
    useEffect(() => {
        isPlayingRef.current = prop.refIsPlaying;
    }, [prop.refIsPlaying]);

    function ensureContext() {
        if (!ctxRef.current) {
            ctxRef.current = new AudioContext();
        }
    }

    function stopAll() {
        sourcesRef.current.forEach((source) => {
            try {
                source.stop();
            } catch {
                // 忽略已停止的源
            }
        });
        sourcesRef.current = [];
        maxDurationRef.current = 0;
    }

    function stopPlaybackRuntime() {
        stopAll();
        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
        startTime.current = null;
        lastUiUpdateRef.current = 0;
        playingSelectionKeyRef.current = "";
    }

    async function playAll(
        audioBuffers: ArrayBuffer[],
        currentTime: number = 0,
        onComplete?: () => void,
    ) {
        ensureContext();
        if (!ctxRef.current) return;

        if (ctxRef.current.state === "suspended") {
            await ctxRef.current.resume();
        }

        stopAll();
        onCompleteRef.current = onComplete || null;
        initialTimeRef.current = currentTime;

        const decodedSources: {
            source: AudioBufferSourceNode;
            decoded: AudioBuffer;
        }[] = [];

        const decodePromises = audioBuffers.map(async (buffer) => {
            try {
                const decoded = await ctxRef.current!.decodeAudioData(
                    buffer.slice(0),
                );

                const source = ctxRef.current!.createBufferSource();
                source.buffer = decoded;
                source.connect(ctxRef.current!.destination);

                decodedSources.push({ source, decoded });
            } catch (error) {
                console.error("音频解码失败", error);
            }
        });

        await Promise.all(decodePromises);

        let maxDuration = 0;
        for (const { source, decoded } of decodedSources) {
            source.start(ctxRef.current.currentTime, currentTime);

            const duration = decoded.duration - currentTime;
            maxDuration = Math.max(maxDuration, duration);

            sourcesRef.current.push(source);
        }

        maxDurationRef.current = maxDuration;
    }

    // 定义 tick 函数
    useEffect(() => {
        const tick = (timestamp: number) => {
            if (!isPlayingRef.current) {
                startTime.current = null;
                return;
            }

            if (!startTime.current) {
                startTime.current = timestamp;
                lastUiUpdateRef.current = timestamp - UI_UPDATE_INTERVAL_MS;
                console.log("started at " + startTime.current);
            }

            const elapsedTime = (timestamp - startTime.current) / 1000;
            const nextCurrentTime = initialTimeRef.current + elapsedTime;
            if (timestamp - lastUiUpdateRef.current >= UI_UPDATE_INTERVAL_MS) {
                propRef.current.setCurrentTime(nextCurrentTime);
                lastUiUpdateRef.current = timestamp;
            }

            if (
                maxDurationRef.current > 0 &&
                elapsedTime >= maxDurationRef.current
            ) {
                propRef.current.setIsPlaying(false);
                startTime.current = null;
                if (onCompleteRef.current) {
                    onCompleteRef.current();
                }
                return;
            }

            rafRef.current = requestAnimationFrame(tick);
        };

        tickRef.current = tick;
    }, []);

    // 监听播放状态变化
    useEffect(() => {
        if (
            prop.refIsPlaying &&
            rafRef.current &&
            playingSelectionKeyRef.current &&
            playingSelectionKeyRef.current !== selectionKey
        ) {
            stopPlaybackRuntime();
            prop.setIsPlaying(false);
            return;
        }

        if (prop.refIsPlaying && !rafRef.current) {
            const selectedSet =
                selectionKey === PLAY_ALL_KEY
                    ? null
                    : new Set(selectionKey.split("|"));
            const targetAudios =
                selectedSet === null
                    ? audios
                    : audios.filter((audio) => selectedSet.has(audio.id));

            if (targetAudios.length === 0) {
                prop.setIsPlaying(false);
                return;
            }

            playingSelectionKeyRef.current = selectionKey;
            const audioBuffers = targetAudios.map((audio) => audio.buffer);

            void playAll(audioBuffers, prop.refCurrentTime, () => {
                console.log("All audios completed");
            }).then(() => {
                if (
                    isPlayingRef.current &&
                    !rafRef.current &&
                    tickRef.current
                ) {
                    rafRef.current = requestAnimationFrame(tickRef.current);
                }
            });
        } else if (!prop.refIsPlaying && rafRef.current) {
            stopPlaybackRuntime();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [prop.refIsPlaying, audios, selectionKey]);

    // 组件卸载时清理资源
    useEffect(() => {
        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            startTime.current = null;
            stopAll();
            if (ctxRef.current) {
                ctxRef.current.close();
                ctxRef.current = null;
            }
            console.log("component unmounted");
        };
    }, []);

    function onPlay() {
        prop.setIsPlaying(true);
    }

    function onPause() {
        prop.setIsPlaying(false);
    }

    function onStop() {
        prop.setIsPlaying(false);
        prop.setCurrentTime(0);
        lastUiUpdateRef.current = 0;
    }

    return (
        <div className="flex items-center gap-2">
            <button
                type="button"
                className="editor-toolbar-button"
                onClick={onPlay}
            >
                播放
            </button>
            <button
                type="button"
                className="editor-toolbar-button"
                onClick={onPause}
            >
                暂停
            </button>
            <button
                type="button"
                className="editor-toolbar-button"
                onClick={onStop}
            >
                停止
            </button>
        </div>
    );
}

export default PlaySelected;
