import type Phaser from "phaser";
import { DEPTH } from "../config/game-config";
import { MELEE_ATTACK_DEFINITIONS, type MeleeAttackMode, type MeleeWeaponId } from "../data/melee-attack-definitions";
import type { AttackEffectEvent } from "./pixel-effect-definitions";
import { createCrescentTrailGeometry, createStabTrailGeometry, type CrescentTrailGeometry, type PixelPoint, type StabTrailGeometry } from "./melee-trail-geometry";

export const MAX_ACTIVE_MELEE_TRAILS = 10;
const RECENT_SEQUENCE_CAP = 32;

export interface MeleeTrailTiming { revealMs: number; holdMs: number; fadeMs: number; echoDelayMs: number }
export interface MeleeTrailColorProfile { main: number; secondary: number; fragment: number }
export type MeleeTrailGeometry = CrescentTrailGeometry | StabTrailGeometry;

export interface ActiveMeleeTrail {
  sequence: number;
  weaponId: MeleeWeaponId;
  mode: MeleeAttackMode;
  sweepDirection: -1 | 1;
  originX: number;
  originY: number;
  geometry: MeleeTrailGeometry;
  startedAt: number;
  revealEndsAt: number;
  holdEndsAt: number;
  expiresAt: number;
  echoStartsAt: number;
  colors: MeleeTrailColorProfile;
}

export interface MeleeTrailLifecycle {
  phase: "before" | "reveal" | "hold" | "fade" | "expired";
  revealProgress: number;
  alpha: number;
}

export function getMeleeTrailTiming(weapon: MeleeWeaponId, mode: MeleeAttackMode): MeleeTrailTiming {
  if (mode === "heavy") return weapon === "bat" ? { revealMs: 52, holdMs: 50, fadeMs: 83, echoDelayMs: 20 } : { revealMs: 34, holdMs: 42, fadeMs: 64, echoDelayMs: 0 };
  if (mode === "stab") return weapon === "bat" ? { revealMs: 30, holdMs: 30, fadeMs: 45, echoDelayMs: 0 } : { revealMs: 28, holdMs: 28, fadeMs: 44, echoDelayMs: 0 };
  return weapon === "bat" ? { revealMs: 50, holdMs: 45, fadeMs: 65, echoDelayMs: 0 } : { revealMs: 45, holdMs: 38, fadeMs: 57, echoDelayMs: 0 };
}

export function createActiveMeleeTrail(event: AttackEffectEvent): ActiveMeleeTrail | undefined {
  if (event.weapon !== "knife" && event.weapon !== "bat") return undefined;
  const weaponId = event.weapon;
  const mode = event.meleeMode ?? "swing";
  const definition = MELEE_ATTACK_DEFINITIONS[weaponId][mode];
  const range = Math.max(8, event.meleeRange ?? definition.range);
  const arcRadians = Math.max(0, event.meleeArcRadians ?? definition.arcRadians);
  const sweepDirection = event.sweepDirection ?? (event.sequence % 2 === 0 ? -1 : 1);
  const timing = getMeleeTrailTiming(weaponId, mode);
  const isStab = mode === "stab" || (weaponId === "knife" && mode === "heavy");
  const geometry = isStab
    ? createStabTrailGeometry({
      originX: event.originX, originY: event.originY, aimAngle: event.angle, startOffset: 8,
      length: range * (weaponId === "bat" ? 0.72 : mode === "heavy" ? 0.95 : 0.9),
      maximumWidth: weaponId === "bat" ? 7 : mode === "heavy" ? 7 : 4,
      fragmentCount: weaponId === "bat" ? 3 : mode === "heavy" ? 6 : 3,
      sequence: event.sequence,
    })
    : createCrescentTrailGeometry({
      originX: event.originX, originY: event.originY, aimAngle: event.angle, sweepDirection,
      innerRadius: weaponId === "bat" ? Math.max(20, range - 24) : Math.max(15, range - 18),
      outerRadius: range, arcRadians, segmentCount: Math.max(8, Math.ceil(range * arcRadians / 5)),
      maximumThickness: weaponId === "bat" ? mode === "heavy" ? 12 : 10 : 7,
      sequence: event.sequence,
    });
  return {
    sequence: event.sequence, weaponId, mode, sweepDirection, originX: event.originX, originY: event.originY,
    geometry, startedAt: event.startedAt, revealEndsAt: event.startedAt + timing.revealMs,
    holdEndsAt: event.startedAt + timing.revealMs + timing.holdMs,
    expiresAt: event.startedAt + timing.revealMs + timing.holdMs + timing.fadeMs,
    echoStartsAt: event.startedAt + timing.echoDelayMs,
    colors: weaponId === "bat" ? { main: 0xf4f5e9, secondary: 0xb6a77f, fragment: 0x9d9684 } : { main: 0xf4f5e9, secondary: 0xd9e1d2, fragment: 0x9da89f },
  };
}

export function getMeleeTrailLifecycle(trail: ActiveMeleeTrail, now: number): MeleeTrailLifecycle {
  if (now < trail.startedAt) return { phase: "before", revealProgress: 0, alpha: 0 };
  if (now < trail.revealEndsAt) return { phase: "reveal", revealProgress: clamp01((now - trail.startedAt) / Math.max(1, trail.revealEndsAt - trail.startedAt)), alpha: 0.75 + 0.25 * clamp01((now - trail.startedAt) / Math.max(1, trail.revealEndsAt - trail.startedAt)) };
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
      if (trail.geometry.kind === "crescent") this.drawCrescent(trail, trail.geometry, lifecycle, now);
      else this.drawStab(trail, trail.geometry, lifecycle);
    }
  }

  clear(): void { this.active.length = 0; this.recentSequences.clear(); this.sequenceOrder.length = 0; this.graphics.clear(); }
  destroy(): void { this.clear(); this.graphics.destroy(); }
  get activeCount(): number { return this.active.length; }

  private drawCrescent(trail: ActiveMeleeTrail, geometry: CrescentTrailGeometry, lifecycle: MeleeTrailLifecycle, now: number): void {
    const revealIndex = Math.max(0, Math.min(geometry.revealPolygons.length - 1, Math.ceil(lifecycle.revealProgress * geometry.revealPolygons.length) - 1));
    const main = lifecycle.phase === "reveal" ? geometry.revealPolygons[revealIndex]! : geometry.mainPolygon;
    const highlight = lifecycle.phase === "reveal" ? geometry.highlightRevealPolygons[revealIndex]! : geometry.highlightPolygon;
    if (trail.mode === "heavy" && trail.weaponId === "bat" && now >= trail.echoStartsAt) {
      this.graphics.fillStyle(trail.colors.secondary, lifecycle.alpha * 0.34).fillPoints(highlight, true);
    }
    this.graphics.fillStyle(trail.colors.main, lifecycle.alpha * 0.96).fillPoints(main, true);
    this.graphics.fillStyle(trail.colors.secondary, lifecycle.alpha * 0.68).fillPoints(highlight, true);
    if (lifecycle.phase === "fade") this.drawFragments(geometry.trailingFragments, trail.colors.fragment, lifecycle.alpha * 0.65, trail.weaponId === "bat" ? 2 : 1);
  }

  private drawStab(trail: ActiveMeleeTrail, geometry: StabTrailGeometry, lifecycle: MeleeTrailLifecycle): void {
    const revealIndex = Math.max(0, Math.min(geometry.revealPolygons.length - 1, Math.ceil(lifecycle.revealProgress * geometry.revealPolygons.length) - 1));
    const body = lifecycle.phase === "reveal" ? geometry.revealPolygons[revealIndex]! : geometry.mainPolygon;
    this.graphics.fillStyle(trail.colors.secondary, lifecycle.alpha * 0.78).fillPoints(body, true);
    const coreCount = Math.max(1, Math.ceil(geometry.coreLine.length * lifecycle.revealProgress));
    this.graphics.fillStyle(trail.colors.main, lifecycle.alpha);
    for (let index = 0; index < coreCount; index += 1) {
      const point = geometry.coreLine[index]!;
      this.graphics.fillRect(point.x, point.y, trail.mode === "heavy" ? 2 : 1, 1);
    }
    if (lifecycle.revealProgress >= 0.82) this.graphics.fillStyle(trail.colors.main, lifecycle.alpha).fillPoints(geometry.tipPolygon, true);
    if (lifecycle.phase === "hold" || lifecycle.phase === "fade") this.drawFragments(geometry.trailingFragments, trail.colors.fragment, lifecycle.alpha * 0.6, trail.weaponId === "bat" ? 2 : 1);
  }

  private drawFragments(points: readonly PixelPoint[], color: number, alpha: number, size: number): void {
    this.graphics.fillStyle(color, alpha);
    for (const point of points) this.graphics.fillRect(point.x, point.y, size, 1);
  }
}

function clamp01(value: number): number { return Math.max(0, Math.min(1, value)); }
