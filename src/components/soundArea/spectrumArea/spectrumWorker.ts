/**
 * Self-contained worker entry point.
 * All logic is inside this single function so it can be serialised via
 * `Function.prototype.toString()` and loaded as an inline Blob Worker,
 * eliminating the need to fetch a separate script from the server.
 */
export function spectrumWorkerMain() {
    const MAX_FRAMES_PER_LAYER = 90000;
    const CHUNK_SIZE = 2048;

    function processChunked(
        audio: Float32Array,
        sampleRate: number,
        profiles: { id: string; windowSize: number; hopSize: number }[],
    ) {
        const sortedProfiles = [...profiles].sort((a, b) => {
            const detailA = a.windowSize / a.hopSize;
            const detailB = b.windowSize / b.hopSize;
            return detailA - detailB;
        });

        let profileIdx = 0;

        function processNextProfile() {
            if (profileIdx >= sortedProfiles.length) {
                self.postMessage({ type: "done" });
                return;
            }

            const profile = sortedProfiles[profileIdx];
            profileIdx++;

            const windowSize = Math.max(256, profile.windowSize | 0);
            const baseHopSize = Math.max(16, profile.hopSize | 0);

            let hopSize = baseHopSize;
            let estimatedFrames =
                audio.length <= windowSize
                    ? 1
                    : Math.floor((audio.length - windowSize) / hopSize) + 1;

            if (estimatedFrames > MAX_FRAMES_PER_LAYER) {
                const stride = Math.ceil(
                    estimatedFrames / MAX_FRAMES_PER_LAYER,
                );
                hopSize *= stride;
                estimatedFrames =
                    audio.length <= windowSize
                        ? 1
                        : Math.floor((audio.length - windowSize) / hopSize) + 1;
            }

            const totalFrames = Math.max(1, estimatedFrames);
            const frameData: Float32Array[] = [];
            let maxMagnitude = 0;
            let frameOffset = 0;

            function processChunk() {
                const end = Math.min(frameOffset + CHUNK_SIZE, totalFrames);
                for (let t = frameOffset; t < end; t++) {
                    const start = t * hopSize;
                    const segment = new Float32Array(windowSize);
                    const src = audio.subarray(
                        start,
                        Math.min(start + windowSize, audio.length),
                    );
                    segment.set(src);

                    applyHannWindow(segment);
                    const spectrum = fftMagnitude(segment);
                    frameData.push(spectrum);

                    for (let i = 0; i < spectrum.length; i++) {
                        if (spectrum[i] > maxMagnitude)
                            maxMagnitude = spectrum[i];
                    }
                }
                frameOffset = end;

                if (frameOffset < totalFrames) {
                    setTimeout(processChunk, 0);
                    return;
                }

                const layerMsg = {
                    type: "layer" as const,
                    layer: {
                        id: profile.id,
                        frameData,
                        maxMagnitude: Math.max(maxMagnitude, 1e-12),
                        sampleRate,
                        windowSize,
                        hopSize,
                        minTimeMs: (hopSize / sampleRate) * 1000,
                        minFreqHz: sampleRate / windowSize,
                    },
                };

                const transferables = frameData.map(
                    (f) => f.buffer as unknown as Transferable,
                );
                (self as unknown as Worker).postMessage(
                    layerMsg,
                    transferables,
                );

                setTimeout(processNextProfile, 0);
            }

            processChunk();
        }

        processNextProfile();
    }

    function applyHannWindow(buf: Float32Array): void {
        const N = buf.length;
        for (let i = 0; i < N; i++) {
            buf[i] *= 0.5 * (1 - Math.cos((2 * Math.PI * i) / (N - 1)));
        }
    }

    function fftMagnitude(input: Float32Array): Float32Array {
        const N = input.length;
        const re = new Float32Array(N);
        const im = new Float32Array(N);

        for (let i = 0; i < N; i++) re[i] = input[i];

        for (let len = 2; len <= N; len <<= 1) {
            const half = len >> 1;
            const step = (Math.PI * 2) / len;

            for (let i = 0; i < N; i += len) {
                for (let j = 0; j < half; j++) {
                    const k = i + j;
                    const l = k + half;

                    const angle = step * j;
                    const cos = Math.cos(angle);
                    const sin = -Math.sin(angle);

                    const tre = re[l] * cos - im[l] * sin;
                    const tim = re[l] * sin + im[l] * cos;

                    re[l] = re[k] - tre;
                    im[l] = im[k] - tim;
                    re[k] += tre;
                    im[k] += tim;
                }
            }
        }

        const mag = new Float32Array(N / 2);
        const norm = (2 / N) * 1.5;

        for (let i = 0; i < mag.length; i++) {
            mag[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i]) * norm;
        }

        return mag;
    }

    self.onmessage = (e: MessageEvent) => {
        if (e.data.type !== "init") return;

        const { audio, sampleRate, profiles } = e.data;
        processChunked(audio, sampleRate, profiles);
    };
}

export {};
