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
        if (file) {
            const fileName = file.name;
            const reader = new FileReader();

            reader.onload = (event) => {
                const arrayBuffer = event.target?.result as ArrayBuffer;
                prop.setSoundLanes([
                    ...prop.refSoundLanes,
                    defaultSoundLane(fileName, arrayBuffer),
                ]);
            };

            reader.onerror = () => {
                console.error("文件读取失败");
            };

            // 读取为 ArrayBuffer（适合音频处理）
            reader.readAsArrayBuffer(file);
        }

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
                    width={24}
                    height={24}
                />
                <span>添加音频</span>
            </button>
        </div>
    );
}

export default AddSound;
