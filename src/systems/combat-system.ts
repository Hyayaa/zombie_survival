import type { WeaponDefinition } from "../data/weapon-definitions";
import type { Point } from "./zombie-ai-system";

export interface CombatTarget {
  id: string;
  position: Point;
  alive: boolean;
}

export type ZombieKnockbackKind = "melee" | "ranged";
export const ZOMBIE_KNOCKBACK_MULTIPLIERS: Record<ZombieKnockbackKind, number> = { melee: 0.6, ranged: 0.5 };

export function getFinalZombieKnockback(knockback: Point, damage: number, kind: ZombieKnockbackKind): Point {
  if (damage <= 0) return { x: 0, y: 0 };
  const multiplier = ZOMBIE_KNOCKBACK_MULTIPLIERS[kind];
  return {
    x: (Number.isFinite(knockback.x) ? knockback.x : 0) * multiplier,
    y: (Number.isFinite(knockback.y) ? knockback.y : 0) * multiplier,
  };
}

export function targetsInMeleeArc(origin: Point, aimAngle: number, weapon: WeaponDefinition, targets: readonly CombatTarget[]): CombatTarget[] {
  return targets
    .filter((target) => {
      if (!target.alive) return false;
      const deltaX = target.position.x - origin.x;
      const deltaY = target.position.y - origin.y;
      const distance = Math.hypot(deltaX, deltaY);
      if (distance > weapon.range) return false;
      return Math.abs(angleDifference(Math.atan2(deltaY, deltaX), aimAngle)) <= weapon.arcRadians / 2;
    })
    .sort((a, b) => distance(origin, a.position) - distance(origin, b.position))
    .slice(0, weapon.maxTargets);
}

export function firstTargetOnLine(origin: Point, end: Point, targets: readonly CombatTarget[], hitRadius = 8): { target: CombatTarget; amount: number } | null {
  let best: { target: CombatTarget; amount: number } | null = null;
  for (const target of targets) {
    if (!target.alive) continue;
    const projection = segmentProjection(origin, end, target.position);
    if (projection.amount < 0 || projection.amount > 1 || projection.distance > hitRadius) continue;
    if (!best || projection.amount < best.amount) best = { target, amount: projection.amount };
  }
  return best;
}

export function angleDifference(a: number, b: number): number {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function segmentProjection(start: Point, end: Point, point: Point): { amount: number; distance: number } {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const lengthSquared = deltaX * deltaX + deltaY * deltaY;
  if (lengthSquared === 0) return { amount: 0, distance: distance(start, point) };
  const amount = ((point.x - start.x) * deltaX + (point.y - start.y) * deltaY) / lengthSquared;
  const closest = { x: start.x + deltaX * amount, y: start.y + deltaY * amount };
  return { amount, distance: distance(closest, point) };
}

