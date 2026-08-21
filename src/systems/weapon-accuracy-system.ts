import type { WeaponDefinition } from "../data/weapon-definitions";

export interface WeaponAccuracyState { bloomRadians: number; lastShotAt: number }
export type WeaponMovementAccuracy = "stationary" | "walking" | "running";

export function createWeaponAccuracyState(): WeaponAccuracyState {
  return { bloomRadians: 0, lastShotAt: -10_000 };
}

export function getEffectiveWeaponSpread(weapon: WeaponDefinition, state: WeaponAccuracyState, movement: WeaponMovementAccuracy): number {
  const movementSpread = movement === "running" ? weapon.runningSpreadRadians ?? 0 : movement === "walking" ? weapon.movingSpreadRadians ?? 0 : 0;
  return Math.max(0, (weapon.spreadRadians ?? 0) + movementSpread + state.bloomRadians);
}

export function recordWeaponShot(state: WeaponAccuracyState, weapon: WeaponDefinition, now: number): void {
  state.bloomRadians = Math.min(weapon.maximumBloomRadians ?? 0, state.bloomRadians + (weapon.shotBloomRadians ?? 0));
  state.lastShotAt = now;
}

export function recoverWeaponBloom(state: WeaponAccuracyState, weapon: WeaponDefinition, deltaSeconds: number): void {
  state.bloomRadians = Math.max(0, state.bloomRadians - (weapon.bloomRecoveryRadiansPerSecond ?? 0) * Math.max(0, deltaSeconds));
}

export function deterministicProjectileAngle(aimAngle: number, spread: number, shotSequence: number, pelletIndex: number, pelletCount: number): number {
  const hash = hashShot(shotSequence, pelletIndex);
  const randomOffset = (hash / 0xffffffff) * 2 - 1;
  const patternOffset = pelletCount > 1 ? ((pelletIndex + 0.5) / pelletCount * 2 - 1) * 0.72 : 0;
  return aimAngle + Math.max(-1, Math.min(1, randomOffset * 0.28 + patternOffset)) * spread;
}

export function spreadToCrosshairGap(spreadRadians: number): number {
  return Math.round(Math.max(5, Math.min(36, 5 + Math.tan(Math.min(1.2, Math.max(0, spreadRadians))) * 112)));
}

function hashShot(sequence: number, pelletIndex: number): number {
  let value = (sequence ^ Math.imul(pelletIndex + 1, 0x9e3779b1)) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d) >>> 0;
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b) >>> 0;
  return (value ^ (value >>> 16)) >>> 0;
}
