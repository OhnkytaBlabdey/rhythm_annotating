import { AudioData } from "@/interface/audioData";
import { PersistedProjectSnapshotV1 } from "./indexedDb";

const MAGIC = new Uint8Array([0x45, 0x58, 0x50, 0x52]); // "EXPR"
const VERSION = 1;

// ---------- encoder helpers ----------

interface Section {
    tag: string; // 4 bytes
    payload: Uint8Array;
}

function encodeHeader(sectionCount: number): ArrayBuffer {
    const buf = new ArrayBuffer(16);
    const dv = new DataView(buf);
    MAGIC.forEach((b, i) => dv.setUint8(i, b));
    dv.setUint32(4, VERSION, true);
    dv.setBigUint64(8, BigInt(sectionCount), true);
    return buf;
}

function encodeSection(tag: string, payload: Uint8Array): Uint8Array {
    const header = new ArrayBuffer(12);
    const dv = new DataView(header);
    for (let i = 0; i < 4; i++) dv.setUint8(i, tag.charCodeAt(i));
    dv.setBigUint64(4, BigInt(payload.byteLength), true);
    const result = new Uint8Array(12 + payload.byteLength);
    result.set(new Uint8Array(header), 0);
    result.set(payload, 12);
    return result;
}

function encodeJsonSection(snapshot: PersistedProjectSnapshotV1): Section {
    const json = JSON.stringify(snapshot);
    return { tag: "JSON", payload: new TextEncoder().encode(json) };
}

function encodeAudiSection(audioDataList: AudioData[]): Section {
    const parts: ArrayBuffer[] = [];

    // record count (uint32)
    const countBuf = new ArrayBuffer(4);
    new DataView(countBuf).setUint32(0, audioDataList.length, true);
    parts.push(countBuf);

    for (const audio of audioDataList) {
        const idBytes = new TextEncoder().encode(audio.id);
        const fileBytes = new TextEncoder().encode(audio.file);

        // id length + id + filename length + filename + duration + blob size + blob
        const metaBuf = new ArrayBuffer(4 + 4 + 8 + 8);
        const dv = new DataView(metaBuf);
        let offset = 0;
        dv.setUint32(offset, idBytes.byteLength, true); offset += 4;
        dv.setUint32(offset, fileBytes.byteLength, true); offset += 4;
        dv.setFloat64(offset, audio.duration, true); offset += 8;
        dv.setBigUint64(offset, BigInt(audio.buffer.byteLength), true);

        for (const piece of [metaBuf, idBytes, fileBytes, new Uint8Array(audio.buffer)]) {
            parts.push(piece instanceof Uint8Array ? piece.buffer.slice(piece.byteOffset, piece.byteOffset + piece.byteLength) : piece);
        }
    }

    // concatenate into single ArrayBuffer
    const total = parts.reduce((s, p) => s + p.byteLength, 0);
    const result = new Uint8Array(total);
    let offset = 0;
    for (const p of parts) {
        result.set(new Uint8Array(p), offset);
        offset += p.byteLength;
    }

    return { tag: "AUDI", payload: result };
}

export function exportProjectBlob(params: {
    snapshot: PersistedProjectSnapshotV1;
    audioDataList: AudioData[];
}): Blob {
    const jsonSection = encodeJsonSection(params.snapshot);
    const audiSection = encodeAudiSection(params.audioDataList);

    const jsonBytes = encodeSection(jsonSection.tag, jsonSection.payload);
    const audiBytes = encodeSection(audiSection.tag, audiSection.payload);

    const header = encodeHeader(2);
    const total = header.byteLength + jsonBytes.byteLength + audiBytes.byteLength;
    const out = new Uint8Array(total);
    let offset = 0;
    out.set(new Uint8Array(header), offset); offset += header.byteLength;
    out.set(jsonBytes, offset); offset += jsonBytes.byteLength;
    out.set(audiBytes, offset);

    return new Blob([out], { type: "application/octet-stream" });
}

// ---------- decoder helpers ----------

class ReadError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ReadError";
    }
}

function readSectionHeader(dv: DataView, offset: number): { tag: string; payloadLen: number; nextOffset: number } {
    if (offset + 12 > dv.byteLength) throw new ReadError("文件已损坏或截断");
    let tag = "";
    for (let i = 0; i < 4; i++) tag += String.fromCharCode(dv.getUint8(offset + i));
    const payloadLen = Number(dv.getBigUint64(offset + 4, true));
    const nextOffset = offset + 12 + payloadLen;
    if (nextOffset > dv.byteLength) throw new ReadError("文件已损坏或截断");
    return { tag, payloadLen, nextOffset };
}

function parseAudiSection(dv: DataView, offset: number, payloadLen: number): Map<string, { file: string; duration: number; buffer: ArrayBuffer }> {
    const end = offset + payloadLen;
    let cursor = offset;

    if (cursor + 4 > end) throw new ReadError("损坏的 AUDI 段");
    const count = dv.getUint32(cursor, true); cursor += 4;

    const map = new Map<string, { file: string; duration: number; buffer: ArrayBuffer }>();

    for (let i = 0; i < count; i++) {
        if (cursor + 4 > end) throw new ReadError("损坏的 AUDI 段");
        const idLen = dv.getUint32(cursor, true); cursor += 4;
        if (cursor + idLen > end) throw new ReadError("损坏的 AUDI 段");
        const id = new TextDecoder().decode(dv.buffer.slice(cursor, cursor + idLen)); cursor += idLen;

        if (cursor + 4 > end) throw new ReadError("损坏的 AUDI 段");
        const fileLen = dv.getUint32(cursor, true); cursor += 4;
        if (cursor + fileLen > end) throw new ReadError("损坏的 AUDI 段");
        const file = new TextDecoder().decode(dv.buffer.slice(cursor, cursor + fileLen)); cursor += fileLen;

        if (cursor + 16 > end) throw new ReadError("损坏的 AUDI 段");
        const duration = dv.getFloat64(cursor, true); cursor += 8;
        const blobSize = Number(dv.getBigUint64(cursor, true)); cursor += 8;

        if (cursor + blobSize > end) throw new ReadError("损坏的 AUDI 段");
        const buffer = dv.buffer.slice(cursor, cursor + blobSize) as ArrayBuffer; cursor += blobSize;

        map.set(id, { file, duration, buffer });
    }

    return map;
}

export function importProjectBlob(raw: ArrayBuffer): { snapshot: PersistedProjectSnapshotV1; audioDataList: AudioData[] } | { error: string } {
    try {
        const dv = new DataView(raw);

        // magic
        if (
            raw.byteLength < 16 ||
            dv.getUint8(0) !== MAGIC[0] ||
            dv.getUint8(1) !== MAGIC[1] ||
            dv.getUint8(2) !== MAGIC[2] ||
            dv.getUint8(3) !== MAGIC[3]
        ) {
            return { error: "无效的文件格式（缺少 EXPR 魔数）" };
        }

        const version = dv.getUint32(4, true);
        if (version > VERSION) {
            return { error: `此项目文件由更高版本的 Explicitize 创建（文件版本 ${version}，当前支持版本 ${VERSION}）。请更新应用。` };
        }
        if (version < 1) {
            return { error: "文件已损坏或不是有效的 Explicitize 项目。" };
        }

        const sectionCount = Number(dv.getBigUint64(8, true));
        let cursor = 16;

        let jsonSnapshot: PersistedProjectSnapshotV1 | null = null;
        let audioMap: Map<string, { file: string; duration: number; buffer: ArrayBuffer }> | null = null;

        for (let i = 0; i < sectionCount; i++) {
            const { tag, payloadLen, nextOffset } = readSectionHeader(dv, cursor);
            const payloadStart = cursor + 12;

            if (tag === "JSON") {
                const jsonBytes = dv.buffer.slice(payloadStart, payloadStart + payloadLen);
                const text = new TextDecoder().decode(jsonBytes);
                const parsed = JSON.parse(text);
                if (!parsed || typeof parsed !== "object" || parsed.version !== 1 || !parsed.project) {
                    return { error: "无法解析项目数据（JSON 结构无效）" };
                }
                jsonSnapshot = parsed as PersistedProjectSnapshotV1;
            } else if (tag === "AUDI") {
                audioMap = parseAudiSection(dv, payloadStart, payloadLen);
            }
            // skip unknown sections

            cursor = nextOffset;
        }

        if (!jsonSnapshot) {
            return { error: "项目文件中缺少 JSON 数据段" };
        }

        // build AudioData list
        const audioDataList: AudioData[] = [];
        if (audioMap) {
            for (const [id, rec] of audioMap) {
                audioDataList.push({
                    id,
                    file: rec.file,
                    duration: rec.duration,
                    buffer: rec.buffer,
                });
            }
        }

        // cross-reference: check every audioRef has corresponding audio data
        const missing: string[] = [];
        for (const ref of jsonSnapshot.audioRefs ?? []) {
            if (!audioMap || !audioMap.has(ref.id)) {
                missing.push(ref.file);
            }
        }
        if (missing.length > 0) {
            return { error: `缺少音频数据: ${missing.join(", ")}` };
        }

        return { snapshot: jsonSnapshot, audioDataList };
    } catch (e) {
        if (e instanceof ReadError) {
            return { error: e.message };
        }
        if (e instanceof SyntaxError) {
            return { error: `无法解析项目数据: ${e.message}` };
        }
        return { error: `导入失败: ${e instanceof Error ? e.message : String(e)}` };
    }
}
