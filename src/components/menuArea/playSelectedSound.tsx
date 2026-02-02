// PlaySelected.tsx
import React, { useEffect, useRef, useCallback, useContext } from "react";
import { AudioDataCtx } from "../audioContext";
interface _p {
    //TODO 哪些音频被激活，需要播放
    //当选中状态变化时，web audio播放的状态也跟着变
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

    // 同步 refIsPlaying 到 ref，使 tick 能获得最新值
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
            } catch (e) {
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

        // 先创建所有的解码 Promise
        const decodedSources: {
            source: AudioBufferSourceNode;
            decoded: AudioBuffer;
            offset: number;
        }[] = [];

        const decodePromises = audioBuffers.map(async (buffer, i) => {
            const offset = offsets[i] || 0;
            try {
                // 解码音频数据
                const decoded = await ctxRef.current!.decodeAudioData(
                    buffer.slice(0),
                );

                // 创建播放源
                const source = ctxRef.current!.createBufferSource();
                source.buffer = decoded;
                source.connect(ctxRef.current!.destination);

                decodedSources.push({ source, decoded, offset });
            } catch (error) {
                console.error("音频解码失败", error);
            }
        });

        // 等待所有音频都解码完成
        await Promise.all(decodePromises);

        // 同时启动所有的音源
        let maxDuration = 0;
        for (const { source, decoded, offset } of decodedSources) {
            // 从 currentTime 开始播放
            source.start(ctxRef.current.currentTime, currentTime);

            // 计算音频总时长（从 currentTime 到结束）
            const duration = decoded.duration - currentTime;
            maxDuration = Math.max(maxDuration, duration);

            sourcesRef.current.push(source);
        }

        maxDurationRef.current = maxDuration;
    }

    const tick = useCallback(
        (timestamp: number) => {
            // 检查当前播放状态，如果停止则退出
            if (!isPlayingRef.current) {
                startTime.current = null;
                return;
            }

            if (!startTime.current) {
                startTime.current = timestamp;
                console.log("started at " + startTime.current);
            }

            const elapsedTime = (timestamp - startTime.current) / 1000;
            prop.setCurrentTime(initialTimeRef.current + elapsedTime);

            // 检查是否所有音频都播放完成
            if (
                maxDurationRef.current > 0 &&
                elapsedTime >= maxDurationRef.current
            ) {
                // 所有音频播放结束
                prop.setIsPlaying(false);
                startTime.current = null;
                if (onCompleteRef.current) {
                    onCompleteRef.current();
                }
                return;
            }

            rafRef.current = requestAnimationFrame(tick);
        },
        [prop],
    );

    // 监听播放状态变化
    useEffect(() => {
        if (prop.refIsPlaying && !rafRef.current) {
            // 开始播放：从 audios context 中提取音频数据和 offset
            const audioBuffers = audios.map((audio) => audio.buffer);
            const offsets = audios.map(() => 0);
            playAll(audioBuffers, offsets, prop.refCurrentTime, () => {
                console.log("All audios completed");
            }).then(() => {
                // 等待 playAll 完成后，再启动 tick
                if (isPlayingRef.current && !rafRef.current) {
                    rafRef.current = requestAnimationFrame(tick);
                }
            });
        } else if (!prop.refIsPlaying && rafRef.current) {
            // 停止播放
            stopAll();
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
            startTime.current = null;
        }
    }, [prop.refIsPlaying, tick]);

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
