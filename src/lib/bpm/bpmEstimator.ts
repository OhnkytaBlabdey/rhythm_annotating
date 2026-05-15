import type {
    BpmEstimation,
    BpmEstimationSegment,
} from "@/interface/audioData";
import type { ChartSegment } from "@/components/soundArea/noteArea/chartTypes";

export async function runBpmEstimation(
    channelData: Float32Array[],
    sampleRate: number,
): Promise<BpmEstimation> {
    const { detectBPM } = await import("pleco-xa");
    try {
        const mono = mixDownToMono(channelData);
        if (mono.length === 0) {
            return { segments: [], status: "error", error: "Empty audio signal" };
        }

        const fakeBuffer = {
            sampleRate,
            numberOfChannels: 1,
            length: mono.length,
            getChannelData: () => mono,
        };

        const result = await detectBPM(fakeBuffer);
        const bpm = Math.round(Math.max(1, Math.min(999, result.bpm)));

        const duration = mono.length / sampleRate;
        const segments: BpmEstimationSegment[] = [
            { startTime: 0, endTime: duration, bpm, source: "computed" },
        ];

        return { segments, status: "ready" };
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { segments: [], status: "error", error: message };
    }
}

function mixDownToMono(channelData: Float32Array[]): Float32Array {
    if (channelData.length === 0) return new Float32Array(0);
    if (channelData.length === 1) return channelData[0];
    const length = channelData[0].length;
    const mono = new Float32Array(length);
    for (const ch of channelData) {
        for (let i = 0; i < Math.min(length, ch.length); i++) {
            mono[i] += ch[i];
        }
    }
    const invChannels = 1 / channelData.length;
    for (let i = 0; i < length; i++) {
        mono[i] *= invChannels;
    }
    return mono;
}

export function resolveDefaultBpmFromEstimation(
    estimation: BpmEstimation | undefined,
    chartData: ChartSegment[],
): number | null {
    if (!estimation || estimation.segments.length === 0) return null;

    let targetTime = 0;
    for (let s = chartData.length - 1; s >= 0; s--) {
        const seg = chartData[s];
        for (let m = seg.measures.length - 1; m >= 0; m--) {
            if (seg.measures[m].notes.length > 0) {
                const beatDuration = 60 / Math.max(1, seg.tempo);
                targetTime = seg.time + (m + 1) * beatDuration;
                break;
            }
        }
        if (targetTime > 0) break;
    }

    const computed = estimation.segments.filter(
        (s) => s.source === "computed",
    );
    const seg = computed.find(
        (s) => targetTime >= s.startTime && targetTime < s.endTime,
    );
    return seg?.bpm ?? computed[0]?.bpm ?? null;
}
