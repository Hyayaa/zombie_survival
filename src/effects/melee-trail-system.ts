import type Phaser from "phaser";
import { DEPTH } from "../config/game-config";
import { MELEE_ATTACK_DEFINITIONS, type MeleeAttackMode, type MeleeWeaponId } from "../data/melee-attack-definitions";
import type { AttackEffectEvent } from "./pixel-effect-definitions";
import { createCrescentTrailGeometry, createStabTrailGeometry, type MeleeTrailGeometry, type PixelCrescentFrame } from "./melee-trail-geometry";

export const MAX_ACTIVE_MELEE_TRAILS = 10;
const RECENT_SEQUENCE_CAP = 32;

export interface MeleeTrailTiming { revealMs: number; holdMs: number; fadeMs: number }
export interface MeleeTrailColorProfile { main: number; edge: number }

export interface ActiveMeleeTrail {
  sequence: number;
  weaponId: MeleeWeaponId;
  mode: MeleeAttackMode;
  originX: number;
  originY: number;
  geometry: MeleeTrailGeometry;
  startedAt: number;
  revealEndsAt: number;
  holdEndsAt: number;
  expiresAt: number;
  colors: MeleeTrailColorProfile;
}

export interface MeleeTrailLifecycle {
  phase: "before" | "reveal" | "hold" | "fade" | "expired";
  revealProgress: number;
  alpha: number;
}

export function getMeleeTrailTiming(weapon: MeleeWeaponId, mode: MeleeAttackMode): MeleeTrailTiming | undefined {
  if (mode === "stab") return { revealMs: 24, holdMs: 24, fadeMs: 38 };
  if (weapon === "knife" && mode === "heavy") return { revealMs: 30, holdMs: 36, fadeMs: 54 };
  if (weapon === "knife" && mode === "swing") return { revealMs: 35, holdMs: 25, fadeMs: 50 };
  if (weapon === "bat" && mode === "swing") return { revealMs: 40, holdMs: 35, fadeMs: 60 };
  if (weapon === "bat" && mode === "heavy") return { revealMs: 45, holdMs: 40, fadeMs: 75 };
  return undefined;
}

export function createActiveMeleeTrail(event: AttackEffectEvent): ActiveMeleeTrail | undefined {
  if (event.weapon !== "knife" && event.weapon !== "bat") return undefined;
  const weaponId = event.weapon;
  const mode = event.meleeMode ?? "swing";
  const definition = MELEE_ATTACK_DEFINITIONS[weaponId][mode];
  const timing = getMeleeTrailTiming(weaponId, mode);
  if (!timing) return undefined;
  const range = Math.max(8, event.meleeRange ?? definition.range);
  const arcRadians = Math.max(0.05, event.meleeArcRadians ?? definition.arcRadians);
  const geometry = definition.geometry === "capsule" ? createStabTrailGeometry({
    originX: event.originX,
    originY: event.originY,
    aimAngle: event.angle,
    length: range,
    blunt: weaponId === "bat",
    heavy: mode === "heavy",
  }) : createCrescentTrailGeometry({
    originX: event.originX,
    originY: event.originY,
    aimAngle: event.angle,
    sweepDirection: event.sweepDirection ?? (event.sequence % 2 === 0 ? -1 : 1),
    innerRadius: weaponId === "bat" ? Math.max(20, range - 24) : Math.max(13, range - 15),
    outerRadius: range,
    arcRadians,
    maximumThickness: weaponId === "bat" ? mode === "heavy" ? 12 : 10 : 6,
  });
  return {
    sequence: event.sequence,
    weaponId,
    mode,
    originX: Math.round(event.originX),
    originY: Math.round(event.originY),
    geometry,
    startedAt: event.startedAt,
    revealEndsAt: event.startedAt + timing.revealMs,
    holdEndsAt: event.startedAt + timing.revealMs + timing.holdMs,
    expiresAt: event.startedAt + timing.revealMs + timing.holdMs + timing.fadeMs,
    colors: weaponId === "bat" && mode === "stab"
      ? { main: 0xc8b98c, edge: 0x77766a }
      : mode === "heavy" ? { main: 0xffffe7, edge: 0xe6e19a } : { main: 0xf5f5df, edge: 0xa6aa8d },
  };
}

export function getMeleeTrailLifecycle(trail: ActiveMeleeTrail, now: number): MeleeTrailLifecycle {
  if (now < trail.startedAt) return { phase: "before", revealProgress: 0, alpha: 0 };
  if (now < trail.revealEndsAt) {
    const progress = clamp01((now - trail.startedAt) / Math.max(1, trail.revealEndsAt - trail.startedAt));
    return { phase: "reveal", revealProgress: progress, alpha: 0.75 + progress * 0.25 };
  }
  if (now < trail.holdEndsAt) return { phase: "hold", revealProgress: 1, alpha: 1 };
  if (now < trail.expiresAt) return { phase: "fade", revealProgress: 1, alpha: 1 - clamp01((now - trail.holdEndsAt) / Math.max(1, trail.expiresAt - trail.holdEndsAt)) };
  return { phase: "expired", revealProgress: 1, alpha: 0 };
}

export class MeleeTrailSystem {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly active: ActiveMeleeTrail[] = [];
  private readonly recentSequences = new Set<number>();
  private readonly sequenceOrder: number[] = [];

  constructor(scene: Phaser.Scene, private readonly isVisible: (x: number, y: number) => boolean) {
    this.graphics = scene.add.graphics().setDepth(DEPTH.effectWorld + 2);
  }

  play(event: AttackEffectEvent): boolean {
    if (this.recentSequences.has(event.sequence)) return false;
    const trail = createActiveMeleeTrail(event);
    if (!trail) return false;
    this.recentSequences.add(event.sequence);
    this.sequenceOrder.push(event.sequence);
    if (this.sequenceOrder.length > RECENT_SEQUENCE_CAP) this.recentSequences.delete(this.sequenceOrder.shift()!);
    if (this.active.length >= MAX_ACTIVE_MELEE_TRAILS) this.active.shift();
    this.active.push(trail);
    return true;
  }

  update(now: number): void {
    this.graphics.clear();
    for (let index = this.active.length - 1; index >= 0; index -= 1) {
      const trail = this.active[index]!;
      const lifecycle = getMeleeTrailLifecycle(trail, now);
      if (lifecycle.phase === "expired") { this.active.splice(index, 1); continue; }
      if (lifecycle.phase === "before" || !this.isVisible(trail.originX, trail.originY)) continue;
      const revealIndex = Math.max(0, Math.min(trail.geometry.revealFrames.length - 1, Math.ceil(lifecycle.revealProgress * trail.geometry.revealFrames.length) - 1));
      const frame = lifecycle.phase === "reveal" ? trail.geometry.revealFrames[revealIndex]! : trail.geometry.frame;
      this.drawFrame(frame, trail.colors, lifecycle.alpha);
    }
  }

  clear(): void { this.active.length = 0; this.recentSequences.clear(); this.sequenceOrder.length = 0; this.graphics.clear(); }
  destroy(): void { this.clear(); this.graphics.destroy(); }
  get activeCount(): number { return this.active.length; }

  private drawFrame(frame: PixelCrescentFrame, colors: MeleeTrailColorProfile, alpha: number): void {
    this.graphics.fillStyle(colors.edge, alpha * 0.78);
    for (const cell of frame.edgeCells) this.graphics.fillRect(cell.x, cell.y, 1, 1);
    this.graphics.fillStyle(colors.main, alpha);
    for (const cell of frame.cells) this.graphics.fillRect(cell.x, cell.y, 1, 1);
  }
}

function clamp01(value: number): number { return Math.max(0, Math.min(1, value)); }
