import { soundlane } from "@/interface/soundLane/soundlane";

class AudioScheduler {
    ctx: AudioContext | null = null;
    sources: AudioBufferSourceNode[] = [];
    startAt = 0;

    ensureContext() {
        if (!this.ctx) {
            this.ctx = new AudioContext();
        }
    }

    playAll(lanes: soundlane[], projectTime: number) {
        this.ensureContext();
        if (!this.ctx) return;

        this.stopAll();
        this.startAt = this.ctx.currentTime;

        lanes.forEach((lane) => {
            if (!lane.audioBuffer) return;

            const buffer = this.ctx!.decodeAudioData(lane.audioBuffer.slice(0));

            buffer.then((decoded) => {
                const src = this.ctx!.createBufferSource();
                src.buffer = decoded;
                src.connect(this.ctx!.destination);

                const offset = Math.max(0, projectTime + lane.offset);

                src.start(0, offset);
                this.sources.push(src);
            });
        });
    }

    pauseAll() {
        if (!this.ctx) return;
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
        if (!this.ctx) return 0;
        return this.ctx.currentTime - this.startAt;
    }
}

export const audioScheduler = new AudioScheduler();
