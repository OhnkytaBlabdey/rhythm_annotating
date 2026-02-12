interface WorkerInitMessage {
    type: "init";
    audio: Float32Array;
    sampleRate: number;
    windowSize: number;
    hopSize: number;
}

interface WorkerResultMessage {
    type: "result";
    frameData: Float32Array[];
    maxMagnitude: number;
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

self.onmessage = (e: MessageEvent<WorkerInitMessage>) => {
    if (e.data.type !== "init") return;

    const { audio, windowSize, hopSize } = e.data;

    const totalFrames = Math.floor((audio.length - windowSize) / hopSize);

    const frameData: Float32Array[] = [];
    let maxMagnitude = 0;

    for (let t = 0; t < totalFrames; t++) {
        const start = t * hopSize;
        const segment = audio.slice(start, start + windowSize);
        applyHannWindow(segment);
        const spectrum = fftMagnitude(segment);
        frameData.push(spectrum);

        for (let i = 0; i < spectrum.length; i++) {
            if (spectrum[i] > maxMagnitude) maxMagnitude = spectrum[i];
        }
    }

    const result: WorkerResultMessage = {
        type: "result",
        frameData,
        maxMagnitude: Math.max(maxMagnitude, 1),
    };

    self.postMessage(result);
};
