import { spectrumWorkerMain } from "./spectrumWorker";

/**
 * Creates a Web Worker from an inline Blob URL instead of fetching a separate
 * script file. This ensures the worker can be instantiated even when the
 * dev-server (or any server) is unreachable, because the entire worker source
 * is already embedded in the main bundle.
 */
export function createSpectrumWorker(): Worker {
    const src = `(${spectrumWorkerMain.toString()})()`;
    const blob = new Blob([src], { type: "text/javascript" });
    const url = URL.createObjectURL(blob);
    const worker = new Worker(url);
    URL.revokeObjectURL(url);
    return worker;
}
