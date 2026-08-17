import type { ZombieStateName } from "../data/zombie-definitions";
import type { HeardNoise } from "./noise-system";

export interface Point {
  x: number;
  y: number;
}

export interface ZombieMind {
  state: ZombieStateName;
  lastSeenTargetPosition?: Point;
  lastHeardNoisePosition?: Point;
  currentTargetId?: string;
  alertLevel: number;
  searchTicks: number;
  visualLock: boolean;
  lastSeenAt: number;
  outOfRangeSince?: number;
}

export const VISUAL_AGGRO_RELEASE_DISTANCE = 1_000;
export const VISUAL_AGGRO_RELEASE_GRACE_MS = 6_000;
export const ZOMBIE_CHASE_MULTIPLIER = { walker: 1.24, runner: 1.14 } as const;

export interface PerceptionUpdate {
  canSeeTarget: boolean;
  targetPosition?: Point;
  targetId?: string;
  heardNoise?: HeardNoise;
  reachedDestination?: boolean;
  inAttackRange?: boolean;
  nowMs?: number;
  targetAlive?: boolean;
  targetDistance?: number;
}

export function createZombieMind(): ZombieMind {
  return { state: "Idle", alertLevel: 0, searchTicks: 0, visualLock: false, lastSeenAt: 0 };
}

export function updateZombieMind(mind: ZombieMind, update: PerceptionUpdate): ZombieMind {
  if (mind.state === "Dead" || mind.state === "Stagger" || mind.state === "AttackObstacle") return { ...mind };

  if (update.canSeeTarget && update.targetPosition) {
    return {
      ...mind,
      state: update.inAttackRange ? "Attack" : "Chase",
      lastSeenTargetPosition: { ...update.targetPosition },
      currentTargetId: update.targetId,
      alertLevel: 1,
      searchTicks: 3,
      visualLock: true,
      lastSeenAt: update.nowMs ?? mind.lastSeenAt,
      outOfRangeSince: undefined,
    };
  }

  if (mind.visualLock) {
    if (update.targetAlive === false || !mind.currentTargetId) return clearVisualLock(mind);
    const now = update.nowMs ?? mind.lastSeenAt;
    const outside = (update.targetDistance ?? 0) > VISUAL_AGGRO_RELEASE_DISTANCE;
    const outOfRangeSince = outside ? mind.outOfRangeSince ?? now : undefined;
    if (outside && outOfRangeSince !== undefined && now - outOfRangeSince >= VISUAL_AGGRO_RELEASE_GRACE_MS) return clearVisualLock(mind);
    return { ...mind, state: update.inAttackRange ? "Attack" : "Chase", lastSeenTargetPosition: update.targetPosition ? { ...update.targetPosition } : mind.lastSeenTargetPosition, outOfRangeSince, alertLevel: 1 };
  }

  if (mind.state === "Chase" || mind.state === "Attack") {
    return { ...mind, state: "SearchLastKnownPosition", currentTargetId: undefined, searchTicks: Math.max(2, Math.min(3, mind.searchTicks)) };
  }

  if (update.heardNoise) {
    return {
      ...mind,
      state: "InvestigateNoise",
      lastHeardNoisePosition: { x: update.heardNoise.x, y: update.heardNoise.y },
      alertLevel: Math.min(1, update.heardNoise.perceivedIntensity / 30),
      searchTicks: 3,
    };
  }

  if (update.reachedDestination && mind.state === "InvestigateNoise") {
    return { ...mind, state: "SearchLastKnownPosition", searchTicks: 3 };
  }

  if (mind.state === "SearchLastKnownPosition") {
    const searchTicks = Math.max(0, mind.searchTicks - 1);
    return { ...mind, state: searchTicks === 0 ? "Wander" : mind.state, alertLevel: searchTicks === 0 ? 0 : mind.alertLevel, searchTicks };
  }

  return { ...mind, state: mind.state === "Idle" ? "Wander" : mind.state };
}

function clearVisualLock(mind: ZombieMind): ZombieMind {
  return { ...mind, state: "SearchLastKnownPosition", currentTargetId: undefined, visualLock: false, outOfRangeSince: undefined, searchTicks: 3 };
}
