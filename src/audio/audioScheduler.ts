// audioScheduler.ts
import { soundlane } from "@/interface/soundLane/soundlane";
class AudioScheduler {
    ctx: AudioContext | null = null;
    sources: AudioBufferSourceNode[] = [];
    startAt = 0;
    playedTime = 0;
    ensureContext() {
        if (!this.ctx) this.ctx = new AudioContext();
    }
    async playAll(lanes: soundlane[], projectTime: number) {
        this.ensureContext();
        if (!this.ctx) return;
        if (this.ctx.state === "suspended") await this.ctx.resume();
        this.stopAll();
        this.startAt = this.ctx.currentTime;
        this.playedTime = projectTime;
        for (const lane of lanes) {
            if (!lane.audioBuffer) continue;
            let decoded: AudioBuffer;
            if (lane.decodedBuffer) {
                decoded = lane.decodedBuffer;
            } else {
                decoded = await this.ctx.decodeAudioData(
                    lane.audioBuffer.slice(0)
                );
                lane.decodedBuffer = decoded;
            }
            const src = this.ctx.createBufferSource();
            src.buffer = decoded;
            src.connect(this.ctx.destination);
            const offset = Math.max(0, projectTime + lane.offset);
            src.start(0, offset);
            this.sources.push(src);
        }
    }
    pauseAll() {
        if (!this.ctx) return;
        // 记录已播放时间
        this.playedTime += this.ctx.currentTime - this.startAt;
        this.stopAll();
    }
    stopAll() {
        this.sources.forEach((s) => {
            try {
                s.stop();
            } catch {}
        });
        this.sources = [];
    }
    getPlayedTime() {
        if (!this.ctx) return this.playedTime;
        if (this.sources.length > 0) {
            return this.playedTime + (this.ctx.currentTime - this.startAt);
        }
        return this.playedTime;
    }
}
export const audioScheduler = new AudioScheduler();
