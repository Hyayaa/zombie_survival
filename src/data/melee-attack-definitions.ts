import type { WeaponId } from "./weapon-definitions";

export type MeleeWeaponId = Extract<WeaponId, "knife" | "bat">;
export type MeleeAttackMode = "stab" | "swing" | "heavy";
export type MeleeGeometry = "capsule" | "arc";

export interface MeleeAttackDefinition {
  mode: MeleeAttackMode;
  geometry: MeleeGeometry;
  damage: number;
  postureDamage: number;
  staminaCost: number;
  range: number;
  width: number;
  arcRadians: number;
  maxTargets: number;
  knockback: number;
  windupMs: number;
  activeMs: number;
  recoveryMs: number;
  movementMultiplier: number;
  turnSpeedRadiansPerSecond: number;
  hitStopMs: number;
}

export const MELEE_INPUT_BALANCE = {
  heavyThresholdMs: 250,
  maximumChargeMs: 900,
  chargeMovementMultiplier: 0.45,
  postureBrokenDamageBonus: 1.32,
  targetDamageAttenuation: [1, 0.75, 0.55] as const,
} as const;

export const MELEE_ATTACK_DEFINITIONS: Record<MeleeWeaponId, Record<MeleeAttackMode, MeleeAttackDefinition>> = {
  knife: {
    stab: { mode: "stab", geometry: "capsule", damage: 25, postureDamage: 18, staminaCost: 8, range: 34, width: 5, arcRadians: 0, maxTargets: 1, knockback: 1, windupMs: 55, activeMs: 70, recoveryMs: 180, movementMultiplier: 0.8, turnSpeedRadiansPerSecond: 4.8, hitStopMs: 22 },
    swing: { mode: "swing", geometry: "arc", damage: 19, postureDamage: 24, staminaCost: 13, range: 35, width: 0, arcRadians: Math.PI * 0.52, maxTargets: 2, knockback: 4, windupMs: 95, activeMs: 105, recoveryMs: 230, movementMultiplier: 0.55, turnSpeedRadiansPerSecond: 2.8, hitStopMs: 31 },
    heavy: { mode: "heavy", geometry: "capsule", damage: 39, postureDamage: 52, staminaCost: 25, range: 41, width: 7, arcRadians: 0, maxTargets: 1, knockback: 6, windupMs: 145, activeMs: 90, recoveryMs: 380, movementMultiplier: 0.35, turnSpeedRadiansPerSecond: 1.7, hitStopMs: 49 },
  },
  bat: {
    stab: { mode: "stab", geometry: "capsule", damage: 13, postureDamage: 28, staminaCost: 10, range: 40, width: 7, arcRadians: 0, maxTargets: 1, knockback: 2, windupMs: 80, activeMs: 75, recoveryMs: 240, movementMultiplier: 0.8, turnSpeedRadiansPerSecond: 4, hitStopMs: 25 },
    swing: { mode: "swing", geometry: "arc", damage: 24, postureDamage: 42, staminaCost: 18, range: 47, width: 0, arcRadians: Math.PI * 0.67, maxTargets: 3, knockback: 5, windupMs: 145, activeMs: 125, recoveryMs: 340, movementMultiplier: 0.55, turnSpeedRadiansPerSecond: 2.4, hitStopMs: 36 },
    heavy: { mode: "heavy", geometry: "arc", damage: 40, postureDamage: 78, staminaCost: 31, range: 50, width: 0, arcRadians: Math.PI * 0.46, maxTargets: 2, knockback: 7, windupMs: 215, activeMs: 125, recoveryMs: 520, movementMultiplier: 0.35, turnSpeedRadiansPerSecond: 1.45, hitStopMs: 56 },
  },
};

export function isMeleeWeaponId(value: string | null | undefined): value is MeleeWeaponId {
  return value === "knife" || value === "bat";
}

export function getChargedMeleeDefinition(weapon: MeleeWeaponId, charge: number): MeleeAttackDefinition {
  const base = MELEE_ATTACK_DEFINITIONS[weapon].heavy;
  const amount = Math.max(0, Math.min(1, Number.isFinite(charge) ? charge : 0));
  return {
    ...base,
    damage: base.damage * (0.78 + amount * 0.22),
    postureDamage: base.postureDamage * (0.72 + amount * 0.28),
    knockback: base.knockback * (0.75 + amount * 0.25),
  };
}
