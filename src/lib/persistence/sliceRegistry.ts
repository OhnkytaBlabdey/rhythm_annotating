export interface PersistSlice<T = unknown> {
    key: string;
    getState: () => T;
    applyState: (state: T) => void;
    serialize?: (state: T) => unknown;
    deserialize?: (raw: unknown) => T;
}

const slices = new Map<string, PersistSlice>();

export function registerPersistSlice<T>(slice: PersistSlice<T>): () => void {
    slices.set(slice.key, slice as PersistSlice);
    return () => {
        const current = slices.get(slice.key);
        if (current === slice) {
            slices.delete(slice.key);
        }
    };
}

export function collectPersistSliceStates(): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, slice] of slices.entries()) {
        const state = slice.getState();
        result[key] = slice.serialize ? slice.serialize(state) : state;
    }

    return result;
}

export function applyPersistSliceStates(raw: Record<string, unknown>): void {
    for (const [key, value] of Object.entries(raw)) {
        const slice = slices.get(key);
        if (!slice) {
            continue;
        }

        const nextState = slice.deserialize ? slice.deserialize(value) : value;
        slice.applyState(nextState);
    }
}
