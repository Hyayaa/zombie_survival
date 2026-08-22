export const MAX_HIT_STOP_MS = 65;

export class HitStopSystem {
  private remainingMs = 0;
  request(durationMs: number): void { this.remainingMs = Math.max(this.remainingMs, Math.min(MAX_HIT_STOP_MS, Math.max(0, durationMs))); }
  consume(deltaMs: number): number {
    const safeDelta = Math.max(0, deltaMs);
    const stopped = Math.min(this.remainingMs, safeDelta);
    this.remainingMs -= stopped;
    return safeDelta - stopped;
  }
  clear(): void { this.remainingMs = 0; }
  get active(): boolean { return this.remainingMs > 0; }
}
