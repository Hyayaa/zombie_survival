import type { ZombieStateName } from "../data/zombie-definitions";
import type { ZombieKind } from "../data/zombie-definitions";
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

export const ZOMBIE_AGGRO_RELEASE_PROFILE:Record<ZombieKind,{releaseDistance:number;reengageDistance:number;graceMs:number}>={walker:{releaseDistance:720,reengageDistance:610,graceMs:4_000},runner:{releaseDistance:840,reengageDistance:710,graceMs:4_600}};
/** Compatibility aliases use the most permissive profile. */
export const VISUAL_AGGRO_RELEASE_DISTANCE = ZOMBIE_AGGRO_RELEASE_PROFILE.runner.releaseDistance;
export const VISUAL_AGGRO_RELEASE_GRACE_MS = ZOMBIE_AGGRO_RELEASE_PROFILE.runner.graceMs;
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
  targetDistanceSquared?:number;
  zombieKind?:ZombieKind;
  zombiePosition?:Point;
  lastDamagedAt?:number;
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
    const profile=ZOMBIE_AGGRO_RELEASE_PROFILE[update.zombieKind??"walker"],distanceSquared=update.targetDistanceSquared??(update.targetDistance??0)**2,outside=distanceSquared>profile.releaseDistance**2,insideReengage=distanceSquared<profile.reengageDistance**2;
    const outOfRangeSince = outside ? mind.outOfRangeSince ?? now : insideReengage?undefined:mind.outOfRangeSince;
    const damageExtension=update.lastDamagedAt!==undefined&&now-update.lastDamagedAt<=1_500?Math.max(0,1_500-(now-update.lastDamagedAt)):0;
    if (outside && outOfRangeSince !== undefined && now - outOfRangeSince >= profile.graceMs+damageExtension) return clearVisualLock(mind,update.zombiePosition);
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

function clearVisualLock(mind: ZombieMind,currentPosition?:Point): ZombieMind {
  return { ...mind, state: "SearchLastKnownPosition", currentTargetId: undefined, visualLock: false, outOfRangeSince: undefined,lastSeenTargetPosition:currentPosition?{...currentPosition}:mind.lastSeenTargetPosition, searchTicks: 1 };
}
