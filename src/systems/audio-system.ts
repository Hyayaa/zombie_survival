export class AudioSystem {
  private context?: AudioContext;

  play(kind: "hit" | "shot" | "pickup" | "door" | "hurt" | "craft"): void {
    if (typeof window === "undefined" || typeof AudioContext === "undefined") return;
    try {
      this.context ??= new AudioContext();
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      const settings = {
        hit: [90, 0.035], shot: [58, 0.07], pickup: [480, 0.04], door: [120, 0.05], hurt: [75, 0.08], craft: [230, 0.045],
      } as const;
      const [frequency, duration] = settings[kind];
      oscillator.type = kind === "pickup" ? "sine" : "square";
      oscillator.frequency.setValueAtTime(frequency, this.context.currentTime);
      gain.gain.setValueAtTime(0.035, this.context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + duration);
      oscillator.connect(gain).connect(this.context.destination);
      oscillator.start();
      oscillator.stop(this.context.currentTime + duration);
    } catch {
      // Audio feedback is optional when browser autoplay policies reject it.
    }
  }
}

