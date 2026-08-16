import { angleDifference } from "./combat-system";
import type { Point } from "./zombie-ai-system";

export const TURRET_RANGE = 180;
export const TURRET_DAMAGE = 10;
export const TURRET_COOLDOWN_MS = 360;
export const TURRET_SCAN_INTERVAL_MS = 125;
export const TURRET_ROTATION_RADIANS_PER_SECOND = 6;
export const TURRET_AIM_TOLERANCE = 0.12;
export const TURRET_TARGET_HYSTERESIS = 0.85;

export interface TurretTarget { id: string; position: Point; alive: boolean; active: boolean; kind: "zombie" }

export function selectTurretTarget(origin: Point, powered: boolean, targets: readonly TurretTarget[], hasLineOfSight: (from: Point, to: Point) => boolean, currentTargetId?: string): TurretTarget | undefined {
  if (!powered) return undefined;
  const maximumSquared = TURRET_RANGE * TURRET_RANGE;
  let current: TurretTarget | undefined; let currentSquared = Number.POSITIVE_INFINITY;
  let nearest: TurretTarget | undefined; let nearestSquared = Number.POSITIVE_INFINITY;
  for (const target of targets) {
    if (!target.alive || !target.active) continue;
    const distanceSquared = (target.position.x-origin.x)**2 + (target.position.y-origin.y)**2;
    if (distanceSquared > maximumSquared) continue;
    if (!hasLineOfSight(origin, target.position)) continue;
    if (target.id === currentTargetId) { current = target; currentSquared = distanceSquared; }
    if (distanceSquared < nearestSquared) { nearest = target; nearestSquared = distanceSquared; }
  }
  if (current && nearest && nearest.id !== current.id && nearestSquared >= currentSquared * TURRET_TARGET_HYSTERESIS ** 2) return current;
  return nearest ?? current;
}

export function rotateTurretToward(current: number, target: number, deltaSeconds: number): number {
  const difference = angleDifference(target, current);
  const step = Math.min(Math.abs(difference), TURRET_ROTATION_RADIANS_PER_SECOND * deltaSeconds);
  return current + Math.sign(difference) * step;
}
