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

export type GunshotSource = "pistol" | "smg" | "shotgun" | "hunting_rifle" | "turret";

export interface GunshotPressureState {
  value: number;
  x: number;
  y: number;
  radius: number;
  lastShotAt: number;
}

export const GUNSHOT_PRESSURE_MAX = 9;
export const GUNSHOT_PRESSURE_DECAY_PER_SECOND = 0.32;
export const GUNSHOT_ATTRACTOR_LIFETIME_MS = 15_000;
export const GUNSHOT_PROFILES: Record<GunshotSource, { radius: number; pressure: number }> = {
  pistol: { radius: 720, pressure: 1 },
  smg: { radius: 620, pressure: 0.36 },
  shotgun: { radius: 1_000, pressure: 2.6 },
  hunting_rifle: { radius: 1_100, pressure: 2.3 },
  turret: { radius: 540, pressure: 0.2 },
};

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
  private gunshotPressure: GunshotPressureState = { value: 0, x: 0, y: 0, radius: 0, lastShotAt: -Infinity };

  emit(event: Omit<NoiseEvent, "radius"> & { radius?: number }): NoiseEvent {
    const created: NoiseEvent = { ...event, radius: event.radius ?? event.intensity * 2.5 };
    this.events.push(created);
    return created;
  }

  emitGunshot(source: GunshotSource, x: number, y: number, intensity: number, createdAt: number): NoiseEvent {
    const profile = GUNSHOT_PROFILES[source];
    const previousValue = this.gunshotPressure.value;
    const value = Math.min(GUNSHOT_PRESSURE_MAX, previousValue + profile.pressure);
    const blend = profile.pressure / Math.max(profile.pressure, previousValue + profile.pressure);
    this.gunshotPressure = {
      value,
      x: previousValue > 0 ? this.gunshotPressure.x + (x - this.gunshotPressure.x) * blend : x,
      y: previousValue > 0 ? this.gunshotPressure.y + (y - this.gunshotPressure.y) * blend : y,
      radius: Math.max(profile.radius, this.gunshotPressure.radius * 0.9),
      lastShotAt: createdAt,
    };
    return this.emit({ x, y, intensity, radius: profile.radius, category: "gunshot", createdAt });
  }

  updateGunshotPressure(deltaSeconds: number): void {
    const delta = Math.max(0, Number.isFinite(deltaSeconds) ? deltaSeconds : 0);
    this.gunshotPressure.value = Math.max(0, this.gunshotPressure.value - GUNSHOT_PRESSURE_DECAY_PER_SECOND * delta);
  }

  getGunshotPressure(): Readonly<GunshotPressureState> {
    return this.gunshotPressure;
  }

  getGunshotAttractor(now: number): Readonly<GunshotPressureState> | undefined {
    return this.gunshotPressure.value > 0 && now - this.gunshotPressure.lastShotAt <= GUNSHOT_ATTRACTOR_LIFETIME_MS
      ? this.gunshotPressure
      : undefined;
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
      const radius = event.category === "gunshot" ? event.radius : event.radius * hearingMultiplier;
      if (distance > radius) continue;
      const perceivedIntensity = event.intensity * (1 - distance / Math.max(1, radius));
      if (!best || perceivedIntensity > best.perceivedIntensity) {
        best = { ...event, distance, perceivedIntensity };
      }
    }
    const attractor = this.getGunshotAttractor(now);
    if (attractor) {
      const distance = Math.hypot(attractor.x - x, attractor.y - y);
      const radius = Math.min(1_150, attractor.radius + attractor.value * 24);
      if (distance <= radius) {
        const perceivedIntensity = (28 + attractor.value * 8) * (1 - distance / Math.max(1, radius));
        if (!best || perceivedIntensity > best.perceivedIntensity) best = {
          x: attractor.x,
          y: attractor.y,
          radius,
          intensity: 28 + attractor.value * 8,
          category: "gunshot",
          createdAt: attractor.lastShotAt,
          distance,
          perceivedIntensity,
        };
      }
    }
    return best;
  }

  clear(): void {
    this.events = [];
    this.gunshotPressure = { value: 0, x: 0, y: 0, radius: 0, lastShotAt: -Infinity };
  }
}

