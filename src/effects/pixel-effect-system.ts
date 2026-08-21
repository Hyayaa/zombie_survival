import type Phaser from "phaser";
import { DEPTH } from "../config/game-config";
import type { AttackEffectSink } from "./attack-effect-controller";
import { PIXEL_EFFECT_PRIORITY, type AttackEffectEvent } from "./pixel-effect-definitions";
import { effectRandom, effectSeed, getMuzzlePosition, getTracerSegment, getTracerSegmentCount, MUZZLE_FLASH_PROFILES } from "./pixel-effect-math";
import { PixelSlotPool } from "./pixel-effect-pool";
import { createBloodEffectPlan, type DamageImpactContext } from "./blood-effect-math";
import { BloodDecalLayer } from "./blood-decal-layer";
import { createChargePixelPlan, createMeleeTrailPlan, createPostureShatterPlan } from "./melee-pixel-effect-math";
import { createFootstepDustPlan, type FootstepDustTerrain } from "./footstep-dust";
import { MeleeTrailSystem } from "./melee-trail-system";

const PARTICLE_CAPACITY = 192;
const SWING_CAPACITY = 64;
const MUZZLE_CAPACITY = 24;
const TRACER_CAPACITY = 32;
export const FOOTSTEP_DUST_CAPACITY = 96;
export const BLOOD_PARTICLE_CAPACITY = 224;
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

interface RuntimeBloodPool{slots:PixelSlotPool;graphics:Phaser.GameObjects.Graphics;x:Float32Array;y:Float32Array;previousX:Float32Array;previousY:Float32Array;velocityX:Float32Array;velocityY:Float32Array;gravity:Float32Array;drag:Float32Array;startsAt:Float64Array;expiresAt:Float64Array;color:Uint32Array;size:Uint8Array;tailLength:Uint8Array}

export interface PixelEffectStats {
  particles: number;
  swings: number;
  muzzle: number;
  tracers: number;
  blood: number;
  meleeTrails: number;
  capacity: number;
}

export class PixelEffectSystem implements AttackEffectSink {
  private readonly particles: RuntimePool;
  private readonly swings: RuntimePool;
  private readonly muzzle: RuntimePool;
  private readonly tracers: RuntimePool;
  private readonly footstepDust: RuntimePool;
  private readonly blood:RuntimeBloodPool;
  private readonly bloodDecals:BloodDecalLayer;
  private readonly meleeTrails: MeleeTrailSystem;

  constructor(private readonly scene: Phaser.Scene, private readonly isVisible: (x: number, y: number) => boolean) {
    this.particles = this.createPool(PARTICLE_CAPACITY);
    this.swings = this.createPool(SWING_CAPACITY);
    this.muzzle = this.createPool(MUZZLE_CAPACITY);
    this.tracers = this.createPool(TRACER_CAPACITY);
    this.footstepDust = this.createPool(FOOTSTEP_DUST_CAPACITY);
    this.blood=this.createBloodPool();this.bloodDecals=new BloodDecalLayer(scene);
    this.meleeTrails = new MeleeTrailSystem(scene, isVisible);
  }

  playAttack(event: AttackEffectEvent): void {
    const seed = effectSeed(event.sequence, event.weapon, event.originX, event.originY);
    const showCore = event.alwaysShowCore === true || this.isVisible(event.originX, event.originY);
    if (event.weapon === "knife" || event.weapon === "bat") {
      if (showCore) { this.meleeTrails.play(event); this.emitSwing(event, seed); }
    } else if (showCore) {
      this.emitFirearm(event, seed);
    }
    for (let index = 0; index < event.impacts.length; index += 1) {
      const impact = event.impacts[index];
      if (!impact || !this.isVisible(impact.x, impact.y)) continue;
      if (impact.kind === "wall") this.emitWallImpact(impact.x, impact.y, event.angle, event.sequence, event.startedAt);
    }
  }

  emitDirectionalBlood(context:DamageImpactContext,now:number):void{const plan=createBloodEffectPlan(context);this.bloodDecals.add(plan.decal,now);if(!this.isVisible(context.hitX,context.hitY))return;for(let index=0;index<plan.particles.length;index++){const particle=plan.particles[index]!;const color=particle.role==="impact"&&index<2?0xce5a4e:BLOOD_COLORS[index%BLOOD_COLORS.length]!;this.spawnBlood(particle.x,particle.y,particle.velocityX,particle.velocityY,particle.role==="droplet"?25:particle.role==="impact"?16:10,particle.role==="streak"?1.15:2.1,color,particle.size,particle.tailLength,now,now+particle.lifetimeMs);}}

  emitMeleeCharge(x: number, y: number, angle: number, charge: number, sequence: number, now: number): void {
    if (!this.isVisible(x, y)) return;
    for (const pixel of createChargePixelPlan(sequence, x, y, angle, charge)) this.spawn(this.particles, pixel.x, pixel.y, 0, 0, 0, 0, 0xd8a84e, pixel.size, pixel.size, now + pixel.delayMs, now + pixel.delayMs + pixel.lifetimeMs, 0.75, true, PIXEL_EFFECT_PRIORITY.swing, DEPTH.effectEmissive, false);
  }

  emitPostureBreak(x: number, y: number, angle: number, sequence: number, now: number): void {
    if (!this.isVisible(x, y)) return;
    const colors = [0xf0e5b0, 0xd8a84e, 0x8f6139] as const;
    for (const pixel of createPostureShatterPlan(sequence, x, y, angle)) this.spawn(this.particles, pixel.x, pixel.y, Math.cos(angle + Math.PI) * 5, Math.sin(angle + Math.PI) * 5, 8, 2, colors[pixel.colorIndex]!, pixel.size, pixel.size, now + pixel.delayMs, now + pixel.delayMs + pixel.lifetimeMs, 1, true, PIXEL_EFFECT_PRIORITY.impact, DEPTH.effectEmissive, false);
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

  emitObstacleImpact(x: number, y: number, shotAngle: number, sequence: number, now: number, destroyed: boolean): void {
    if (!this.isVisible(x, y)) return;
    const seed = effectSeed(sequence, "bat", x, y);
    const count = destroyed ? 12 : 5;
    for (let index = 0; index < count; index += 1) {
      const angle = shotAngle + Math.PI + (effectRandom(seed, index * 3) - 0.5) * 1.6;
      const speed = 10 + effectRandom(seed, index * 3 + 1) * (destroyed ? 32 : 18);
      this.spawn(this.particles, x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, 16, 2,
        index % 3 === 0 ? 0x9a7952 : index % 2 === 0 ? 0x65513c : 0x7b6650,
        index % 4 === 0 ? 2 : 1, 1, now, now + 150 + effectRandom(seed, index * 3 + 2) * 210,
        0.9, true, PIXEL_EFFECT_PRIORITY.wall, DEPTH.effectWorld, false);
    }
    this.emitDust(x, y + 4, shotAngle + Math.PI, seed ^ 0x6a09e667, destroyed ? 7 : 3, now);
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

  emitFootstepDust(x: number, y: number, movementAngle: number, running: boolean, terrain: FootstepDustTerrain, sequence: number, now: number): void {
    if (!this.isVisible(x, y)) return;
    const plans = createFootstepDustPlan(sequence, movementAngle, running, terrain);
    for (const plan of plans) this.spawn(this.footstepDust, x, y + 4, plan.velocityX, plan.velocityY, -2, 2.6, plan.color, plan.size, Math.min(2, plan.size), now, now + plan.lifetimeMs, .78, true, PIXEL_EFFECT_PRIORITY.dust, DEPTH.actor - 1, false);
  }

  update(now: number, deltaSeconds: number): void {
    this.meleeTrails.update(now);
    this.updatePool(this.particles, now, deltaSeconds);
    this.updatePool(this.swings, now, deltaSeconds);
    this.updatePool(this.muzzle, now, deltaSeconds);
    this.updatePool(this.tracers, now, deltaSeconds);
    this.updatePool(this.footstepDust, now, deltaSeconds);
    this.updateBlood(now,deltaSeconds);
  }

  clear(): void {
    this.meleeTrails.clear();
    this.clearPool(this.particles);
    this.clearPool(this.swings);
    this.clearPool(this.muzzle);
    this.clearPool(this.tracers);
    this.clearPool(this.footstepDust);
    this.blood.slots.clear();this.blood.graphics.clear();
  }

  destroy(): void {
    this.meleeTrails.destroy();
    this.destroyPool(this.particles);
    this.destroyPool(this.swings);
    this.destroyPool(this.muzzle);
    this.destroyPool(this.tracers);
    this.destroyPool(this.footstepDust);
    this.blood.slots.destroy();this.blood.graphics.destroy();this.bloodDecals.destroy();
  }

  getStats(): PixelEffectStats {
    return {
      particles: this.particles.slots.activeCount,
      swings: this.swings.slots.activeCount,
      muzzle: this.muzzle.slots.activeCount,
      tracers: this.tracers.slots.activeCount,
      blood:this.blood.slots.activeCount,
      meleeTrails: this.meleeTrails.activeCount,
      capacity: PARTICLE_CAPACITY + SWING_CAPACITY + MUZZLE_CAPACITY + TRACER_CAPACITY + FOOTSTEP_DUST_CAPACITY+BLOOD_PARTICLE_CAPACITY,
    };
  }

  private emitSwing(event: AttackEffectEvent, seed: number): void {
    const weapon = event.weapon as "knife" | "bat";
    const colors = weapon === "knife" ? KNIFE_COLORS : BAT_COLORS;
    const plan = createMeleeTrailPlan(event.sequence, weapon, event.meleeMode ?? "swing", event.originX, event.originY, event.angle, event.charge);
    for (let index = 0; index < plan.length; index += 1) {
      const pixel = plan[index]!;
      const startsAt = event.startedAt + pixel.delayMs;
      this.spawn(this.swings, pixel.x, pixel.y, 0, 0, 0, 0, colors[pixel.colorIndex] as number,
        pixel.size, weapon === "bat" ? 2 : 1, startsAt, startsAt + pixel.lifetimeMs, 1, false,
        PIXEL_EFFECT_PRIORITY.swing, weapon === "knife" ? DEPTH.effectEmissive : DEPTH.effectWorld, false);
    }
    if (weapon === "bat") this.emitDust(event.originX, event.originY + 5, event.angle + Math.PI, seed, 4, event.startedAt + 30);
  }

  private emitFirearm(event: AttackEffectEvent, seed: number): void {
    const profile = MUZZLE_FLASH_PROFILES[event.weapon as keyof typeof MUZZLE_FLASH_PROFILES]!;
    const muzzle = getMuzzlePosition(event.originX, event.originY, event.angle, profile.muzzleOffset);
    const directionX = Math.cos(event.angle);
    const directionY = Math.sin(event.angle);
    const perpendicularX = -directionY;
    const perpendicularY = directionX;
    this.spawn(this.muzzle, muzzle.x, muzzle.y, 0, 0, 0, 0, 0xfff4c2, 2, 2,
      event.startedAt, event.startedAt + profile.lifetimeMs, 1, false, PIXEL_EFFECT_PRIORITY.muzzle, DEPTH.effectEmissive, true);
    for (let index = 1; index <= profile.branches; index += 1) {
      const phase = index > profile.branches / 2 ? 12 : 0;
      const distance = 2 + profile.length * (index / profile.branches) * (.72 + effectRandom(seed, index) * .28);
      const side = (effectRandom(seed, 30 + index) - .5) * Math.min(6, profile.length * .28);
      this.spawn(this.muzzle, muzzle.x + directionX * distance + perpendicularX * side, muzzle.y + directionY * distance + perpendicularY * side, 0, 0, 0, 0,
        index === 1 ? 0xfff4c2 : index < profile.branches - 1 ? 0xffcf58 : 0xe77a32, index < 3 ? 2 : 1, index % 3 === 0 ? 2 : 1,
        event.startedAt + phase, event.startedAt + profile.lifetimeMs, 1, false, PIXEL_EFFECT_PRIORITY.muzzle, DEPTH.effectEmissive, true);
    }
    for (let sideIndex = 0; sideIndex < Math.min(2, profile.branches - 1); sideIndex += 1) {
      const side = sideIndex === 0 ? -1 : 1;
      for (let index = 1; index <= 2; index += 1) {
        const forward = 1 + index * 1.2;
        const sideways = side * (1 + index);
        this.spawn(this.muzzle, muzzle.x + directionX * forward + perpendicularX * sideways, muzzle.y + directionY * forward + perpendicularY * sideways,
          0, 0, 0, 0, index === 1 ? 0xffcf58 : 0xa84524, index === 1 ? 2 : 1, 1,
          event.startedAt + (index - 1) * 10, event.startedAt + profile.lifetimeMs, 1, false,
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

  private createBloodPool():RuntimeBloodPool{return{slots:new PixelSlotPool(BLOOD_PARTICLE_CAPACITY),graphics:this.scene.add.graphics().setDepth(DEPTH.effectWorld),x:new Float32Array(BLOOD_PARTICLE_CAPACITY),y:new Float32Array(BLOOD_PARTICLE_CAPACITY),previousX:new Float32Array(BLOOD_PARTICLE_CAPACITY),previousY:new Float32Array(BLOOD_PARTICLE_CAPACITY),velocityX:new Float32Array(BLOOD_PARTICLE_CAPACITY),velocityY:new Float32Array(BLOOD_PARTICLE_CAPACITY),gravity:new Float32Array(BLOOD_PARTICLE_CAPACITY),drag:new Float32Array(BLOOD_PARTICLE_CAPACITY),startsAt:new Float64Array(BLOOD_PARTICLE_CAPACITY),expiresAt:new Float64Array(BLOOD_PARTICLE_CAPACITY),color:new Uint32Array(BLOOD_PARTICLE_CAPACITY),size:new Uint8Array(BLOOD_PARTICLE_CAPACITY),tailLength:new Uint8Array(BLOOD_PARTICLE_CAPACITY)};}

  private spawnBlood(x:number,y:number,velocityX:number,velocityY:number,gravity:number,drag:number,color:number,size:number,tailLength:number,startsAt:number,expiresAt:number):void{const index=this.blood.slots.acquire(PIXEL_EFFECT_PRIORITY.impact,startsAt);if(index<0)return;this.blood.x[index]=x;this.blood.y[index]=y;this.blood.previousX[index]=x;this.blood.previousY[index]=y;this.blood.velocityX[index]=velocityX;this.blood.velocityY[index]=velocityY;this.blood.gravity[index]=gravity;this.blood.drag[index]=drag;this.blood.color[index]=color;this.blood.size[index]=size;this.blood.tailLength[index]=tailLength;this.blood.startsAt[index]=startsAt;this.blood.expiresAt[index]=expiresAt;}

  private updateBlood(now:number,deltaSeconds:number):void{const pool=this.blood;pool.graphics.clear();for(let index=0;index<pool.slots.capacity;index++){if(!pool.slots.isActive(index))continue;if(now>=pool.expiresAt[index]!){pool.slots.release(index);continue;}if(now<pool.startsAt[index]!)continue;pool.previousX[index]=pool.x[index]!;pool.previousY[index]=pool.y[index]!;const damping=Math.max(0,1-pool.drag[index]!*deltaSeconds);pool.velocityX[index]=pool.velocityX[index]!*damping;pool.velocityY[index]=(pool.velocityY[index]!+pool.gravity[index]!*deltaSeconds)*damping;pool.x[index]=pool.x[index]!+pool.velocityX[index]!*deltaSeconds;pool.y[index]=pool.y[index]!+pool.velocityY[index]!*deltaSeconds;const duration=Math.max(1,pool.expiresAt[index]!-pool.startsAt[index]!);const remaining=(pool.expiresAt[index]!-now)/duration;const alpha=remaining>.66?.92:remaining>.33?.64:.34;const x=Math.round(pool.x[index]!),y=Math.round(pool.y[index]!);pool.graphics.fillStyle(pool.color[index]!,alpha).fillRect(x,y,pool.size[index]!,pool.size[index]!);const movedX=pool.x[index]!-pool.previousX[index]!,movedY=pool.y[index]!-pool.previousY[index]!;const moved=Math.hypot(movedX,movedY);const vx=moved>.01?movedX/moved:pool.velocityX[index]!/Math.max(1,Math.hypot(pool.velocityX[index]!,pool.velocityY[index]!));const vy=moved>.01?movedY/moved:pool.velocityY[index]!/Math.max(1,Math.hypot(pool.velocityX[index]!,pool.velocityY[index]!));const tail=Math.max(0,Math.round(pool.tailLength[index]!*remaining));for(let step=1;step<=tail;step++){if(step>2&&step%2===0)continue;pool.graphics.fillRect(Math.round(x-vx*step),Math.round(y-vy*step),1,1);}}}

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
