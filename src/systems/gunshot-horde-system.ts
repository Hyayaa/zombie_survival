import type { Point } from "./zombie-ai-system";

export const HORDE_PRESSURE_THRESHOLD = 1.5;
export const HORDE_MIN_DISTANCE = 320;
export const HORDE_MAX_DISTANCE = 900;
export const HORDE_SPAWN_SCAN_BUDGET = 128;

export function getHordeActivationCount(pressure: number): number {
  if (!Number.isFinite(pressure) || pressure < HORDE_PRESSURE_THRESHOLD) return 0;
  return Math.min(16, 4 + Math.floor((pressure - HORDE_PRESSURE_THRESHOLD) * 1.6));
}

export function getHordeActivationIntervalMs(pressure: number): number {
  return Math.max(1_000, Math.min(1_600, 1_575 - Math.max(0, pressure) * 65));
}

export interface HordeSpawnCheck {
  spawn: Point;
  player: Point;
  attractor: Point;
  insideCamera: boolean;
  visibleInFog: boolean;
  blocked: boolean;
}

export function isEligibleHordeSpawn(check: HordeSpawnCheck): boolean {
  const playerDistance = Math.hypot(check.spawn.x - check.player.x, check.spawn.y - check.player.y);
  const attractorDistance = Math.hypot(check.spawn.x - check.attractor.x, check.spawn.y - check.attractor.y);
  return playerDistance >= HORDE_MIN_DISTANCE
    && playerDistance <= HORDE_MAX_DISTANCE
    && attractorDistance >= HORDE_MIN_DISTANCE
    && attractorDistance <= HORDE_MAX_DISTANCE
    && !check.insideCamera
    && !check.visibleInFog
    && !check.blocked;
}
