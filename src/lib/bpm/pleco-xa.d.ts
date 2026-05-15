declare module "pleco-xa" {
    interface DetectBpmOptions {
        minBPM?: number;
        maxBPM?: number;
        hopLength?: number;
        windowSize?: number;
        useOnsetStrength?: boolean;
        threshold?: number;
    }

    interface DetectBpmResult {
        bpm: number;
        confidence: number;
        onsets: number[];
        beats: number[];
        analysis: {
            onsetStrength: Float32Array;
            autocorrelation: Float32Array;
            sampleRate: number;
        };
    }

    export function detectBPM(
        audioBuffer: AudioBufferLike,
        options?: DetectBpmOptions,
        startSample?: number,
        endSample?: number | null,
    ): Promise<DetectBpmResult>;

    export function detectBPMWindow(
        audioBuffer: AudioBufferLike,
        centerSample: number,
        windowDuration: number,
        options?: DetectBpmOptions,
    ): Promise<DetectBpmResult>;

    interface AudioBufferLike {
        sampleRate: number;
        numberOfChannels: number;
        length: number;
        getChannelData(channel: number): Float32Array;
        duration?: number;
        copyFromChannel?(destination: Float32Array, channelNumber: number, bufferOffset?: number): void;
    }
}
