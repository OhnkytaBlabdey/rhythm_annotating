import { AudioData } from "@/interface/audioData";
import Image from "@/components/Image";
import React, { useContext, useRef, useState } from "react";
import { AudioDataCtx } from "../audioContext";

interface _prop {
    addAudioData: (audioData: AudioData) => void;
}

function fallbackHash(buffer: ArrayBuffer): string {
    // FNV-1a 32-bit fallback for environments without Web Crypto subtle.
    let hash = 0x811c9dc5;
    const bytes = new Uint8Array(buffer);
    for (const byte of bytes) {
        hash ^= byte;
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
}

// 计算ArrayBuffer的SHA256值
async function calculateSHA256(buffer: ArrayBuffer): Promise<string> {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) {
        return fallbackHash(buffer);
    }

    const hashBuffer = await subtle.digest("SHA-256", buffer);
    return Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}

function AddSound(prop: _prop) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const audioDataList = useContext(AudioDataCtx);
    const [warning, setWarning] = useState<string | null>(null);
    const warningTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    function showWarning(msg: string) {
        if (warningTimer.current) clearTimeout(warningTimer.current);
        setWarning(msg);
        warningTimer.current = setTimeout(() => setWarning(null), 3000);
    }

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const fileName = file.name;
        const reader = new FileReader();

        reader.onload = async (event) => {
            try {
                const arrayBuffer = event.target?.result as ArrayBuffer;

                // 使用 Web Audio API 解码音频以获取时长
                const audioContext = new AudioContext();
                const audioBuffer = await audioContext.decodeAudioData(
                    arrayBuffer.slice(0),
                );
                const duration = audioBuffer.duration; // 秒

                // 计算音频数据的SHA256值作为ID
                const audioId = await calculateSHA256(arrayBuffer);

                // 检查是否已存在相同hash的音频
                if (audioDataList.some((a) => a.id === audioId)) {
                    showWarning(`音频 "${fileName}" 已存在，无法重复添加`);
                    audioContext.close();
                    return;
                }

                prop.addAudioData({
                    id: audioId,
                    file: fileName,
                    buffer: arrayBuffer,
                    duration: duration,
                    decodedBuffer: audioBuffer,
                });

                audioContext.close();
            } catch (error) {
                console.error("音频解析失败", error);
            }
        };

        reader.onerror = () => {
            console.error("文件读取失败");
        };

        reader.readAsArrayBuffer(file);

        // 允许重复选择同一个文件
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleAddSoundLane = () => {
        fileInputRef.current?.click();
    };

    return (
        <div className="relative">
            <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                onChange={handleFileSelect}
                style={{ display: "none" }}
            />
            <button
                type="button"
                onClick={handleAddSoundLane}
                title="Click to AddSound"
                className="editor-toolbar-button"
            >
                <Image
                    src="/assets/icons/newSoundLane.png"
                    alt="Add Sound Lane"
                    width={36}
                    height={24}
                />
                <span>添加音频</span>
            </button>
            {warning && (
                <div className="absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2 whitespace-nowrap rounded bg-yellow-500 px-3 py-1.5 text-sm text-white shadow">
                    {warning}
                </div>
            )}
        </div>
    );
}

export default AddSound;
