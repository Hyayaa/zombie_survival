import type { ZombieDefinition } from "../data/zombie-definitions";

export interface ZombiePostureState {
  value: number;
  maximum: number;
  recoveryStartsAt: number;
  staggerUntil: number;
  breakImmunityUntil: number;
  recentlyDamagedUntil: number;
}

export interface ZombiePostureDamageResult {
  applied: number;
  broken: boolean;
  state: ZombiePostureState;
}

export function createZombiePosture(definition: ZombieDefinition): ZombiePostureState {
  return { value: definition.postureMaximum, maximum: definition.postureMaximum, recoveryStartsAt: 0, staggerUntil: 0, breakImmunityUntil: 0, recentlyDamagedUntil: 0 };
}

export function damageZombiePosture(state: ZombiePostureState, amount: number, now: number, definition: ZombieDefinition): ZombiePostureDamageResult {
  if (amount <= 0 || !Number.isFinite(amount) || now < state.breakImmunityUntil) return { applied: 0, broken: false, state };
  const previous = state.value;
  state.value = Math.max(0, state.value - amount);
  state.recoveryStartsAt = now + definition.postureRecoveryDelayMs;
  state.recentlyDamagedUntil = state.recoveryStartsAt;
  if (state.value > 0) return { applied: previous - state.value, broken: false, state };
  state.value = state.maximum * 0.25;
  state.staggerUntil = now + definition.postureBreakStaggerMs;
  state.breakImmunityUntil = now + definition.postureBreakImmunityMs;
  state.recentlyDamagedUntil = state.staggerUntil;
  return { applied: previous, broken: true, state };
}

export function updateZombiePosture(state: ZombiePostureState, definition: ZombieDefinition, now: number, deltaSeconds: number): void {
  if (now < state.recoveryStartsAt || now < state.staggerUntil || state.value >= state.maximum) return;
  state.value = Math.min(state.maximum, state.value + definition.postureRecoveryPerSecond * Math.max(0, deltaSeconds));
}

export function isZombiePostureBroken(state: ZombiePostureState, now: number): boolean {
  return now < state.staggerUntil;
}

export function shouldShowZombiePosture(state: ZombiePostureState, now: number, targeted = false): boolean {
  return targeted || now < state.recentlyDamagedUntil || now < state.staggerUntil;
}

export interface ZombieAttackWindups { biteCompletesAt: number; obstacleAttackCompletesAt: number; obstacleTargetId?: string }
export function cancelZombieAttackWindups(runtime: ZombieAttackWindups): void {
  runtime.biteCompletesAt = 0;
  runtime.obstacleAttackCompletesAt = 0;
  runtime.obstacleTargetId = undefined;
}
