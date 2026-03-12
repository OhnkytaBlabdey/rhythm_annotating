import { AudioData, SoundLaneState } from "@/interface/audioData";
import { project } from "@/interface/project";

const DB_NAME = "explicitize-editor";
const DB_VERSION = 1;
const AUDIO_STORE = "audios";
const SNAPSHOT_STORE = "snapshots";

export const DEFAULT_SNAPSHOT_KEY = "current";

export interface PersistedAudioRecord {
    id: string;
    file: string;
    duration: number;
    blob: Blob;
    updatedAt: number;
}

export interface PersistedAudioRef {
    id: string;
    file: string;
    duration: number;
}

export interface PersistedProjectSnapshotV1 {
    version: 1;
    key: string;
    savedAt: number;
    project: project;
    audioRefs: PersistedAudioRef[];
    slices: Record<string, unknown>;
}

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(AUDIO_STORE)) {
                db.createObjectStore(AUDIO_STORE, { keyPath: "id" });
            }
            if (!db.objectStoreNames.contains(SNAPSHOT_STORE)) {
                db.createObjectStore(SNAPSHOT_STORE, { keyPath: "key" });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function runRequest<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function withStore<T>(
    storeName: string,
    mode: IDBTransactionMode,
    action: (store: IDBObjectStore) => Promise<T>,
): Promise<T> {
    const db = await openDb();

    try {
        const transaction = db.transaction(storeName, mode);
        const store = transaction.objectStore(storeName);
        const result = await action(store);

        await new Promise<void>((resolve, reject) => {
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
            transaction.onabort = () => reject(transaction.error);
        });

        return result;
    } finally {
        db.close();
    }
}

export async function upsertAudioRecord(audio: AudioData): Promise<void> {
    const blob = new Blob([audio.buffer], {
        type: "application/octet-stream",
    });

    const record: PersistedAudioRecord = {
        id: audio.id,
        file: audio.file,
        duration: audio.duration,
        blob,
        updatedAt: Date.now(),
    };

    await withStore(AUDIO_STORE, "readwrite", async (store) => {
        await runRequest(store.put(record));
    });
}

export async function getAudioRecordById(
    audioId: string,
): Promise<PersistedAudioRecord | undefined> {
    return withStore(AUDIO_STORE, "readonly", async (store) => {
        const result = (await runRequest(store.get(audioId))) as
            | PersistedAudioRecord
            | undefined;
        return result;
    });
}

export async function deleteAudioRecord(audioId: string): Promise<void> {
    await withStore(AUDIO_STORE, "readwrite", async (store) => {
        await runRequest(store.delete(audioId));
    });
}

export async function putSnapshot(
    snapshot: PersistedProjectSnapshotV1,
): Promise<void> {
    await withStore(SNAPSHOT_STORE, "readwrite", async (store) => {
        await runRequest(store.put(snapshot));
    });
}

export async function getSnapshot(
    key = DEFAULT_SNAPSHOT_KEY,
): Promise<PersistedProjectSnapshotV1 | undefined> {
    return withStore(SNAPSHOT_STORE, "readonly", async (store) => {
        const result = (await runRequest(store.get(key))) as
            | PersistedProjectSnapshotV1
            | undefined;
        return result;
    });
}

export async function clearPersistence(): Promise<void> {
    const db = await openDb();

    try {
        await new Promise<void>((resolve, reject) => {
            const transaction = db.transaction(
                [AUDIO_STORE, SNAPSHOT_STORE],
                "readwrite",
            );
            transaction.objectStore(AUDIO_STORE).clear();
            transaction.objectStore(SNAPSHOT_STORE).clear();

            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
            transaction.onabort = () => reject(transaction.error);
        });
    } finally {
        db.close();
    }
}

export function toAudioRefs(audioDataList: AudioData[]): PersistedAudioRef[] {
    return audioDataList.map((audio) => ({
        id: audio.id,
        file: audio.file,
        duration: audio.duration,
    }));
}

export function sanitizeLaneStatesByAudioRefs(
    lanes: SoundLaneState[],
    refs: PersistedAudioRef[],
): SoundLaneState[] {
    const refIds = new Set(refs.map((ref) => ref.id));
    return lanes.filter((lane) => refIds.has(lane.audioId));
}
