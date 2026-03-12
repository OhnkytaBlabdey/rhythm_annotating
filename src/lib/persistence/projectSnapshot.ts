import { AudioData } from "@/interface/audioData";
import { defaultProject, project } from "@/interface/project";
import {
    DEFAULT_SNAPSHOT_KEY,
    PersistedProjectSnapshotV1,
    getAudioRecordById,
    getSnapshot,
    putSnapshot,
    sanitizeLaneStatesByAudioRefs,
    toAudioRefs,
    upsertAudioRecord,
} from "./indexedDb";

function normalizeProject(input: unknown): project {
    if (!input || typeof input !== "object") {
        return defaultProject();
    }

    const candidate = input as Partial<project>;
    const base = defaultProject();

    return {
        currentTime:
            typeof candidate.currentTime === "number" &&
            Number.isFinite(candidate.currentTime) &&
            candidate.currentTime >= 0
                ? candidate.currentTime
                : base.currentTime,
        timeMultiplier:
            typeof candidate.timeMultiplier === "number" &&
            Number.isFinite(candidate.timeMultiplier) &&
            candidate.timeMultiplier > 0
                ? candidate.timeMultiplier
                : base.timeMultiplier,
        isPlaying: false,
        playSpeed:
            typeof candidate.playSpeed === "number" &&
            Number.isFinite(candidate.playSpeed) &&
            candidate.playSpeed > 0
                ? candidate.playSpeed
                : base.playSpeed,
        soundLaneStates: Array.isArray(candidate.soundLaneStates)
            ? candidate.soundLaneStates
            : base.soundLaneStates,
    };
}

export async function saveProjectSnapshot(params: {
    projectState: project;
    audioDataList: AudioData[];
    slices: Record<string, unknown>;
}): Promise<void> {
    await Promise.all(
        params.audioDataList.map((audio) => upsertAudioRecord(audio)),
    );

    const snapshot: PersistedProjectSnapshotV1 = {
        version: 1,
        key: DEFAULT_SNAPSHOT_KEY,
        savedAt: Date.now(),
        project: {
            ...params.projectState,
            isPlaying: false,
        },
        audioRefs: toAudioRefs(params.audioDataList),
        slices: params.slices,
    };

    await putSnapshot(snapshot);
}

export async function hydrateProjectSnapshot(): Promise<{
    projectState: project;
    audioDataList: AudioData[];
    slices: Record<string, unknown>;
} | null> {
    const snapshot = await getSnapshot();
    if (!snapshot || snapshot.version !== 1) {
        return null;
    }

    const audioRecords = await Promise.all(
        snapshot.audioRefs.map(async (ref) => {
            const record = await getAudioRecordById(ref.id);
            if (!record) {
                return null;
            }

            const buffer = await record.blob.arrayBuffer();
            const audio: AudioData = {
                id: record.id,
                file: record.file,
                duration: record.duration,
                buffer,
            };

            return audio;
        }),
    );

    const availableAudioData = audioRecords.filter(
        (audio): audio is AudioData => audio !== null,
    );
    const availableRefs = toAudioRefs(availableAudioData);
    const normalizedProject = normalizeProject(snapshot.project);

    return {
        projectState: {
            ...normalizedProject,
            soundLaneStates: sanitizeLaneStatesByAudioRefs(
                normalizedProject.soundLaneStates,
                availableRefs,
            ),
            isPlaying: false,
        },
        audioDataList: availableAudioData,
        slices: snapshot.slices,
    };
}
