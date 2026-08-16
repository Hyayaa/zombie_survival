export type NoiseCategory = "walk" | "run" | "melee" | "gunshot" | "glass" | "door" | "craft" | "explosion";

export interface NoiseEvent {
  x: number;
  y: number;
  radius: number;
  intensity: number;
  category: NoiseCategory;
  createdAt: number;
}

export interface HeardNoise extends NoiseEvent {
  distance: number;
  perceivedIntensity: number;
}

export const NOISE_LEVELS: Record<NoiseCategory, number> = {
  walk: 5,
  run: 20,
  melee: 15,
  gunshot: 90,
  glass: 60,
  door: 10,
  craft: 15,
  explosion: 100,
};

export class NoiseSystem {
  private events: NoiseEvent[] = [];

  emit(event: Omit<NoiseEvent, "radius"> & { radius?: number }): NoiseEvent {
    const created: NoiseEvent = { ...event, radius: event.radius ?? event.intensity * 2.5 };
    this.events.push(created);
    return created;
  }

  prune(now: number, lifetimeMs = 4_000): void {
    let writeIndex = 0;
    for (let readIndex = 0; readIndex < this.events.length; readIndex += 1) {
      const event = this.events[readIndex]!;
      if (now - event.createdAt <= lifetimeMs) this.events[writeIndex++] = event;
    }
    this.events.length = writeIndex;
  }

  loudestHeard(x: number, y: number, hearingMultiplier: number, now: number): HeardNoise | undefined {
    this.prune(now);
    let best: HeardNoise | undefined;
    for (const event of this.events) {
      const distance = Math.hypot(event.x - x, event.y - y);
      const radius = event.radius * hearingMultiplier;
      if (distance > radius) continue;
      const perceivedIntensity = event.intensity * (1 - distance / Math.max(1, radius));
      if (!best || perceivedIntensity > best.perceivedIntensity) {
        best = { ...event, distance, perceivedIntensity };
      }
    }
    return best;
  }

  clear(): void {
    this.events = [];
  }
}

