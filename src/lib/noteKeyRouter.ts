type NoteKeyHandler = (event: KeyboardEvent) => void;

const handlers = new Map<string, NoteKeyHandler>();

export function registerNoteKeyHandler(laneId: string, handler: NoteKeyHandler): () => void {
    handlers.set(laneId, handler);
    return () => {
        if (handlers.get(laneId) === handler) handlers.delete(laneId);
    };
}

export function dispatchNoteKey(laneId: string, event: KeyboardEvent): boolean {
    const handler = handlers.get(laneId);
    if (!handler) return false;
    handler(event);
    return true;
}
