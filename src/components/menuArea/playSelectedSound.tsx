// PlaySelected.tsx
import React, { useEffect, useRef, useContext } from "react";
import { AudioDataCtx } from "../audioContext";

const UI_UPDATE_INTERVAL_MS = 33;

interface _p {
    refCurrentTime: number;
    setCurrentTime: (_: number) => void;
    refIsPlaying: boolean;
    setIsPlaying: (_: boolean) => void;
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

    async function playAll(
        audioBuffers: ArrayBuffer[],
        offsets: number[],
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
        if (prop.refIsPlaying && !rafRef.current) {
            const audioBuffers = audios.map((audio) => audio.buffer);
            const offsets = audios.map(() => 0);
            void playAll(audioBuffers, offsets, prop.refCurrentTime, () => {
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
            stopAll();
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
            startTime.current = null;
            lastUiUpdateRef.current = 0;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [prop.refIsPlaying, audios]);

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
        <>
            <button onClick={onPlay}>Play</button>
            <button onClick={onPause}>Pause</button>
            <button onClick={onStop}>Stop</button>
        </>
    );
}

export default PlaySelected;
