import type Phaser from "phaser";
import { DEPTH } from "../config/game-config";
import type { AttackEffectSink } from "./attack-effect-controller";
import { PIXEL_EFFECT_PRIORITY, type AttackEffectEvent, type AttackEffectWeapon } from "./pixel-effect-definitions";
import { effectRandom, effectSeed, getMuzzlePosition, getTracerSegment, getTracerSegmentCount, sampleSwingPixel } from "./pixel-effect-math";
import { PixelSlotPool } from "./pixel-effect-pool";

const PARTICLE_CAPACITY = 192;
const SWING_CAPACITY = 64;
const MUZZLE_CAPACITY = 24;
const TRACER_CAPACITY = 32;
const KNIFE_COLORS = [0xe8e3cf, 0xbcc4bf, 0x6e7774] as const;
const BAT_COLORS = [0xb5976d, 0x80664c, 0x54473c] as const;
const BLOOD_COLORS = [0x7d342f, 0x612824, 0xa7473e] as const;
const SMOKE_COLORS = [0x555c59, 0x424846, 0x343a39] as const;
const DUST_COLORS = [0x706759, 0x5c554b, 0x827665] as const;

interface RuntimePool {
  slots: PixelSlotPool;
  views: Phaser.GameObjects.Rectangle[];
  x: Float32Array;
  y: Float32Array;
  velocityX: Float32Array;
  velocityY: Float32Array;
  gravity: Float32Array;
  drag: Float32Array;
  startsAt: Float64Array;
  expiresAt: Float64Array;
  baseAlpha: Float32Array;
  fade: Uint8Array;
}

export interface PixelEffectStats {
  particles: number;
  swings: number;
  muzzle: number;
  tracers: number;
  capacity: number;
}

export class PixelEffectSystem implements AttackEffectSink {
  private readonly particles: RuntimePool;
  private readonly swings: RuntimePool;
  private readonly muzzle: RuntimePool;
  private readonly tracers: RuntimePool;

  constructor(private readonly scene: Phaser.Scene, private readonly isVisible: (x: number, y: number) => boolean) {
    this.particles = this.createPool(PARTICLE_CAPACITY);
    this.swings = this.createPool(SWING_CAPACITY);
    this.muzzle = this.createPool(MUZZLE_CAPACITY);
    this.tracers = this.createPool(TRACER_CAPACITY);
  }

  playAttack(event: AttackEffectEvent): void {
    const seed = effectSeed(event.sequence, event.weapon, event.originX, event.originY);
    const showCore = event.alwaysShowCore === true || this.isVisible(event.originX, event.originY);
    if (event.weapon === "knife" || event.weapon === "bat") {
      if (showCore) this.emitSwing(event, seed);
    } else if (showCore) {
      this.emitPistol(event, seed);
    }
    for (let index = 0; index < event.impacts.length; index += 1) {
      const impact = event.impacts[index];
      if (!impact || !this.isVisible(impact.x, impact.y)) continue;
      if (impact.kind === "zombie") this.emitBloodImpact(impact.x, impact.y, event.angle, event.weapon, event.sequence, event.startedAt);
      else this.emitWallImpact(impact.x, impact.y, event.angle, event.sequence, event.startedAt);
    }
  }

  emitBloodImpact(x: number, y: number, angle: number, weapon: AttackEffectWeapon, sequence: number, now: number): void {
    if (!this.isVisible(x, y)) return;
    const seed = effectSeed(sequence, weapon, x, y);
    const count = weapon === "knife" ? 5 : weapon === "bat" ? 7 : 4;
    const spread = weapon === "bat" ? 1.1 : weapon === "knife" ? 0.52 : 0.4;
    const baseSpeed = weapon === "pistol" ? 36 : weapon === "bat" ? 25 : 22;
    for (let index = 0; index < count; index += 1) {
      const particleAngle = angle + (effectRandom(seed, index * 3) - 0.5) * spread;
      const speed = baseSpeed * (0.65 + effectRandom(seed, index * 3 + 1) * 0.7);
      const lifetime = 180 + effectRandom(seed, index * 3 + 2) * 220;
      this.spawn(this.particles, x, y, Math.cos(particleAngle) * speed, Math.sin(particleAngle) * speed, 18, 1.5,
        BLOOD_COLORS[index % BLOOD_COLORS.length] as number, index % 3 === 0 ? 2 : 1, index % 4 === 0 ? 2 : 1,
        now, now + lifetime, 1, true, PIXEL_EFFECT_PRIORITY.impact, DEPTH.effectWorld, false);
    }
  }

  emitWallImpact(x: number, y: number, shotAngle: number, sequence: number, now: number): void {
    if (!this.isVisible(x, y)) return;
    const seed = effectSeed(sequence, "pistol", x, y);
    for (let index = 0; index < 6; index += 1) {
      const angle = shotAngle + Math.PI + (effectRandom(seed, index * 3) - 0.5) * 1.25;
      const speed = 14 + effectRandom(seed, index * 3 + 1) * 24;
      const bright = index < 2;
      this.spawn(this.particles, x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, 12, 2.2,
        bright ? 0xc0b99f : DUST_COLORS[index % DUST_COLORS.length] as number, bright ? 1 : 2, 1,
        now, now + 130 + effectRandom(seed, index * 3 + 2) * 170, bright ? 1 : 0.85, true,
        PIXEL_EFFECT_PRIORITY.wall, DEPTH.effectWorld, false);
    }
  }

  emitFireBurst(x: number, y: number, sequence: number, now: number): void {
    if (!this.isVisible(x, y)) return;
    const seed = effectSeed(sequence, "bat", x, y);
    for (let index = 0; index < 12; index += 1) {
      const angle = effectRandom(seed, index * 2) * Math.PI * 2;
      const speed = 18 + effectRandom(seed, index * 2 + 1) * 32;
      this.spawn(this.particles, x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, -8, 1.2,
        index % 3 === 0 ? 0xffcf58 : index % 2 === 0 ? 0xe88742 : 0xa84524, index % 4 === 0 ? 2 : 1, index % 5 === 0 ? 2 : 1,
        now, now + 220 + index * 8, 1, true, PIXEL_EFFECT_PRIORITY.impact, DEPTH.effectEmissive, index % 3 === 0);
    }
  }

  update(now: number, deltaSeconds: number): void {
    this.updatePool(this.particles, now, deltaSeconds);
    this.updatePool(this.swings, now, deltaSeconds);
    this.updatePool(this.muzzle, now, deltaSeconds);
    this.updatePool(this.tracers, now, deltaSeconds);
  }

  clear(): void {
    this.clearPool(this.particles);
    this.clearPool(this.swings);
    this.clearPool(this.muzzle);
    this.clearPool(this.tracers);
  }

  destroy(): void {
    this.destroyPool(this.particles);
    this.destroyPool(this.swings);
    this.destroyPool(this.muzzle);
    this.destroyPool(this.tracers);
  }

  getStats(): PixelEffectStats {
    return {
      particles: this.particles.slots.activeCount,
      swings: this.swings.slots.activeCount,
      muzzle: this.muzzle.slots.activeCount,
      tracers: this.tracers.slots.activeCount,
      capacity: PARTICLE_CAPACITY + SWING_CAPACITY + MUZZLE_CAPACITY + TRACER_CAPACITY,
    };
  }

  private emitSwing(event: AttackEffectEvent, seed: number): void {
    const weapon = event.weapon as "knife" | "bat";
    const count = weapon === "knife" ? 11 : 15;
    const trailDuration = weapon === "knife" ? 72 : 132;
    const lifetime = weapon === "knife" ? 44 : 68;
    const colors = weapon === "knife" ? KNIFE_COLORS : BAT_COLORS;
    for (let index = 0; index < count; index += 1) {
      const progress = index / Math.max(1, count - 1);
      const point = sampleSwingPixel(weapon, event.originX, event.originY, event.angle, progress, seed, index);
      const startsAt = event.startedAt + progress * trailDuration;
      const thickness = weapon === "bat" ? index % 3 === 0 ? 3 : 2 : index % 4 === 0 ? 2 : 1;
      this.spawn(this.swings, point.x, point.y, 0, 0, 0, 0, colors[index % colors.length] as number,
        thickness, weapon === "bat" ? 2 : 1, startsAt, startsAt + lifetime, 1, false,
        PIXEL_EFFECT_PRIORITY.swing, weapon === "knife" ? DEPTH.effectEmissive : DEPTH.effectWorld, false);
    }
    if (weapon === "bat") this.emitDust(event.originX, event.originY + 5, event.angle + Math.PI, seed, 4, event.startedAt + 30);
  }

  private emitPistol(event: AttackEffectEvent, seed: number): void {
    const muzzle = getMuzzlePosition(event.originX, event.originY, event.angle, 12);
    const directionX = Math.cos(event.angle);
    const directionY = Math.sin(event.angle);
    const perpendicularX = -directionY;
    const perpendicularY = directionX;
    this.spawn(this.muzzle, muzzle.x, muzzle.y, 0, 0, 0, 0, 0xfff4c2, 2, 2,
      event.startedAt, event.startedAt + 54, 1, false, PIXEL_EFFECT_PRIORITY.muzzle, DEPTH.effectEmissive, true);
    for (let index = 1; index <= 4; index += 1) {
      const phase = index >= 3 ? 16 : 0;
      const distance = 1 + index * 1.45;
      this.spawn(this.muzzle, muzzle.x + directionX * distance, muzzle.y + directionY * distance, 0, 0, 0, 0,
        index === 1 ? 0xfff4c2 : index < 4 ? 0xffcf58 : 0xe77a32, index < 3 ? 2 : 1, index % 2 === 0 ? 2 : 1,
        event.startedAt + phase, event.startedAt + phase + 38, 1, false, PIXEL_EFFECT_PRIORITY.muzzle, DEPTH.effectEmissive, true);
    }
    for (let sideIndex = 0; sideIndex < 2; sideIndex += 1) {
      const side = sideIndex === 0 ? -1 : 1;
      for (let index = 1; index <= 2; index += 1) {
        const forward = 1 + index * 1.2;
        const sideways = side * (1 + index);
        this.spawn(this.muzzle, muzzle.x + directionX * forward + perpendicularX * sideways, muzzle.y + directionY * forward + perpendicularY * sideways,
          0, 0, 0, 0, index === 1 ? 0xffcf58 : 0xa84524, index === 1 ? 2 : 1, 1,
          event.startedAt + (index - 1) * 14, event.startedAt + 42 + index * 6, 1, false,
          PIXEL_EFFECT_PRIORITY.muzzle, DEPTH.effectEmissive, true);
      }
    }
    this.emitMuzzleSmoke(muzzle.x, muzzle.y, event.angle, seed, event.startedAt + 28);
    this.emitDust(event.originX - directionX * 3, event.originY - directionY * 3 + 5, event.angle + Math.PI, seed ^ 0x3f6a, 2, event.startedAt);
    if (event.endpointX !== undefined && event.endpointY !== undefined) {
      this.emitTracer(muzzle.x, muzzle.y, event.endpointX, event.endpointY, event.startedAt + 5);
    }
  }

  private emitTracer(startX: number, startY: number, endX: number, endY: number, now: number): void {
    const count = getTracerSegmentCount(startX, startY, endX, endY);
    for (let index = 0; index < count; index += 1) {
      const segment = getTracerSegment(startX, startY, endX, endY, index, count);
      const horizontal = Math.abs(segment.end.x - segment.start.x) >= Math.abs(segment.end.y - segment.start.y);
      const startsAt = now + index * 2;
      this.spawn(this.tracers, segment.start.x, segment.start.y, 0, 0, 0, 0, index % 2 === 0 ? 0xf3e6af : 0xd8ca8f,
        horizontal ? 3 : 1, horizontal ? 1 : 3, startsAt, startsAt + 55, 0.95, false,
        PIXEL_EFFECT_PRIORITY.tracer, DEPTH.effectEmissive, false);
      this.spawn(this.tracers, segment.end.x, segment.end.y, 0, 0, 0, 0, 0xd8ca8f,
        horizontal ? 2 : 1, horizontal ? 1 : 2, startsAt, startsAt + 48, 0.8, false,
        PIXEL_EFFECT_PRIORITY.tracer, DEPTH.effectEmissive, false);
    }
  }

  private emitMuzzleSmoke(x: number, y: number, angle: number, seed: number, now: number): void {
    const perpendicular = angle + Math.PI / 2;
    for (let index = 0; index < 4; index += 1) {
      const forwardSpeed = 5 + effectRandom(seed, index * 3) * 8;
      const sideSpeed = (effectRandom(seed, index * 3 + 1) - 0.5) * 14;
      const velocityX = Math.cos(angle) * forwardSpeed + Math.cos(perpendicular) * sideSpeed;
      const velocityY = Math.sin(angle) * forwardSpeed + Math.sin(perpendicular) * sideSpeed;
      const lifetime = 180 + effectRandom(seed, index * 3 + 2) * 140;
      this.spawn(this.particles, x, y, velocityX, velocityY, -3, 1.1, SMOKE_COLORS[index % SMOKE_COLORS.length] as number,
        index % 3 === 0 ? 2 : 1, index % 3 === 0 ? 2 : 1, now + index * 12, now + index * 12 + lifetime,
        0.72, true, PIXEL_EFFECT_PRIORITY.smoke, DEPTH.effectWorld, false);
    }
  }

  private emitDust(x: number, y: number, angle: number, seed: number, count: number, now: number): void {
    for (let index = 0; index < count; index += 1) {
      const particleAngle = angle + (effectRandom(seed, 40 + index * 2) - 0.5) * 1.4;
      const speed = 5 + effectRandom(seed, 41 + index * 2) * 10;
      this.spawn(this.particles, x, y, Math.cos(particleAngle) * speed, Math.sin(particleAngle) * speed, 5, 2.5,
        DUST_COLORS[index % DUST_COLORS.length] as number, index % 2 === 0 ? 2 : 1, 1,
        now, now + 120 + index * 28, 0.72, true, PIXEL_EFFECT_PRIORITY.dust, DEPTH.effectWorld, false);
    }
  }

  private createPool(capacity: number): RuntimePool {
    const views: Phaser.GameObjects.Rectangle[] = [];
    for (let index = 0; index < capacity; index += 1) {
      views.push(this.scene.add.rectangle(0, 0, 1, 1, 0xffffff).setOrigin(0.5).setVisible(false).setDepth(DEPTH.effectWorld));
    }
    return {
      slots: new PixelSlotPool(capacity),
      views,
      x: new Float32Array(capacity),
      y: new Float32Array(capacity),
      velocityX: new Float32Array(capacity),
      velocityY: new Float32Array(capacity),
      gravity: new Float32Array(capacity),
      drag: new Float32Array(capacity),
      startsAt: new Float64Array(capacity),
      expiresAt: new Float64Array(capacity),
      baseAlpha: new Float32Array(capacity),
      fade: new Uint8Array(capacity),
    };
  }

  private spawn(
    pool: RuntimePool,
    x: number,
    y: number,
    velocityX: number,
    velocityY: number,
    gravity: number,
    drag: number,
    color: number,
    width: number,
    height: number,
    startsAt: number,
    expiresAt: number,
    alpha: number,
    fade: boolean,
    priority: number,
    depth: number,
    additive: boolean,
  ): void {
    const index = pool.slots.acquire(priority, startsAt);
    if (index < 0) return;
    pool.x[index] = x;
    pool.y[index] = y;
    pool.velocityX[index] = velocityX;
    pool.velocityY[index] = velocityY;
    pool.gravity[index] = gravity;
    pool.drag[index] = drag;
    pool.startsAt[index] = startsAt;
    pool.expiresAt[index] = expiresAt;
    pool.baseAlpha[index] = alpha;
    pool.fade[index] = fade ? 1 : 0;
    pool.views[index]
      ?.setPosition(Math.round(x), Math.round(y))
      .setDisplaySize(Math.max(1, Math.round(width)), Math.max(1, Math.round(height)))
      .setFillStyle(color, 1)
      .setDepth(depth)
      .setBlendMode(additive ? "ADD" : "NORMAL")
      .setAlpha(alpha)
      .setVisible(false);
  }

  private updatePool(pool: RuntimePool, now: number, deltaSeconds: number): void {
    for (let index = 0; index < pool.slots.capacity; index += 1) {
      if (!pool.slots.isActive(index)) continue;
      const view = pool.views[index];
      if (!view) continue;
      if (now >= (pool.expiresAt[index] as number)) {
        view.setVisible(false);
        pool.slots.release(index);
        continue;
      }
      if (now < (pool.startsAt[index] as number)) {
        if (view.visible) view.setVisible(false);
        continue;
      }
      if (!view.visible) view.setVisible(true);
      const damping = Math.max(0, 1 - (pool.drag[index] as number) * deltaSeconds);
      pool.velocityX[index] = (pool.velocityX[index] as number) * damping;
      pool.velocityY[index] = ((pool.velocityY[index] as number) + (pool.gravity[index] as number) * deltaSeconds) * damping;
      pool.x[index] = (pool.x[index] as number) + (pool.velocityX[index] as number) * deltaSeconds;
      pool.y[index] = (pool.y[index] as number) + (pool.velocityY[index] as number) * deltaSeconds;
      const roundedX = Math.round(pool.x[index] as number);
      const roundedY = Math.round(pool.y[index] as number);
      if (view.x !== roundedX || view.y !== roundedY) view.setPosition(roundedX, roundedY);
      if (pool.fade[index]) {
        const duration = Math.max(1, (pool.expiresAt[index] as number) - (pool.startsAt[index] as number));
        const remaining = ((pool.expiresAt[index] as number) - now) / duration;
        const stepAlpha = remaining > 0.66 ? 1 : remaining > 0.33 ? 0.62 : 0.28;
        view.setAlpha((pool.baseAlpha[index] as number) * stepAlpha);
      }
    }
  }

  private clearPool(pool: RuntimePool): void {
    pool.slots.clear();
    for (let index = 0; index < pool.views.length; index += 1) pool.views[index]?.setVisible(false);
  }

  private destroyPool(pool: RuntimePool): void {
    pool.slots.destroy();
    for (let index = 0; index < pool.views.length; index += 1) pool.views[index]?.destroy();
  }
}
