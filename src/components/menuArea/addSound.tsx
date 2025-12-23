import { defaultSoundLane, soundlane } from "@/interface/soundLane/soundlane";
import Image from "next/image";
import React, { useRef } from "react";

interface _prop {
    refSoundLanes: soundlane[];
    setSoundLanes: (a: soundlane[]) => void;
}

function AddSound(prop: _prop) {
    const fileInputRef = useRef<HTMLInputElement>(null);

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
                    arrayBuffer.slice(0)
                );

                const duration = audioBuffer.duration; // 秒

                prop.setSoundLanes([
                    ...prop.refSoundLanes,
                    defaultSoundLane(fileName, arrayBuffer, duration),
                ]);

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
        <div>
            <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                onChange={handleFileSelect}
                style={{ display: "none" }}
            />
            <button
                onClick={handleAddSoundLane}
                title="Click to AddSound"
                className="flex items-center gap-2"
            >
                <Image
                    src="/assets/icons/newSoundLane.png"
                    alt="Add Sound Lane"
                    width={36}
                    height={24}
                />
                <span>添加音频</span>
            </button>
        </div>
    );
}

export default AddSound;
