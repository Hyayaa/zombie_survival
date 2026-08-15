import Phaser from "phaser";

const SAMPLE_COUNT = 180;

export class PerformanceMonitor {
  private readonly enabled = (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV === true;
  private readonly frameTimes = new Float32Array(SAMPLE_COUNT);
  private overlay?: HTMLPreElement;
  private toggleKey?: Phaser.Input.Keyboard.Key;
  private frameIndex = 0;
  private frameCount = 0;
  private lastOverlayAt = 0;
  private fogCalculationMs = 0;
  private fogTextureMs = 0;
  private fogRecomputeCount = 0;
  private pathfindingWork = 0;
  private separationCandidates = 0;

  constructor(scene: Phaser.Scene, parent: HTMLElement) {
    if (!this.enabled) return;
    this.overlay = document.createElement("pre");
    this.overlay.hidden = true;
    Object.assign(this.overlay.style, {
      position: "absolute",
      top: "8px",
      right: "8px",
      zIndex: "1000",
      margin: "0",
      padding: "7px 9px",
      color: "#d7ece4",
      background: "rgba(4, 10, 12, 0.86)",
      border: "1px solid #45625a",
      font: "10px/1.35 monospace",
      pointerEvents: "none",
    });
    parent.append(this.overlay);
    this.toggleKey = scene.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.F2);
  }

  beginFrame(frameTimeMs: number): void {
    if (!this.enabled) return;
    this.frameTimes[this.frameIndex] = frameTimeMs;
    this.frameIndex = (this.frameIndex + 1) % SAMPLE_COUNT;
    this.frameCount = Math.min(SAMPLE_COUNT, this.frameCount + 1);
    this.pathfindingWork = 0;
    this.separationCandidates = 0;
  }

  recordFog(calculationMs: number, textureMs: number): void {
    if (!this.enabled) return;
    this.fogCalculationMs = calculationMs;
    this.fogTextureMs = textureMs;
    this.fogRecomputeCount += 1;
  }

  recordPathfinding(): void {
    if (this.enabled) this.pathfindingWork += 1;
  }

  recordSeparationCandidates(count: number): void {
    if (this.enabled) this.separationCandidates = count;
  }

  update(now: number, activeZombies: number): void {
    if (!this.enabled || !this.overlay) return;
    if (this.toggleKey && Phaser.Input.Keyboard.JustDown(this.toggleKey)) this.overlay.hidden = !this.overlay.hidden;
    if (this.overlay.hidden || now < this.lastOverlayAt + 250 || this.frameCount === 0) return;
    this.lastOverlayAt = now;

    const samples = Array.from(this.frameTimes.subarray(0, this.frameCount)).sort((a, b) => a - b);
    const average = samples.reduce((sum, value) => sum + value, 0) / samples.length;
    const p95 = samples[Math.max(0, Math.ceil(samples.length * 0.95) - 1)] ?? 0;
    this.overlay.textContent = [
      `FPS ${(1_000 / Math.max(0.01, average)).toFixed(1)}`,
      `frame avg ${average.toFixed(2)} ms`,
      `frame p95 ${p95.toFixed(2)} ms`,
      `fog calc ${this.fogCalculationMs.toFixed(2)} ms`,
      `fog texture ${this.fogTextureMs.toFixed(2)} ms`,
      `fog recomputes ${this.fogRecomputeCount}`,
      `active zombies ${activeZombies}`,
      `pathfinding/frame ${this.pathfindingWork}`,
      `separation candidates ${this.separationCandidates}`,
    ].join("\n");
  }

  destroy(): void {
    this.overlay?.remove();
    this.overlay = undefined;
  }
}
