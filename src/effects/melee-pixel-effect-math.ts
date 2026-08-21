import type { MeleeAttackMode, MeleeWeaponId } from "../data/melee-attack-definitions";

export const MELEE_TRAIL_PIXEL_CAP = 40;
export const POSTURE_SHATTER_PIXEL_CAP = 30;
export const CHARGE_PIXEL_CAP = 8;

export interface MeleePixelPlan { x: number; y: number; delayMs: number; lifetimeMs: number; size: 1 | 2 | 3; colorIndex: number }

export function createMeleeTrailPlan(sequence: number, weapon: MeleeWeaponId, mode: MeleeAttackMode, originX: number, originY: number, angle: number, charge = 0): MeleePixelPlan[] {
  const count = mode === "stab" ? 4 : mode === "heavy" ? (weapon === "bat" ? 10 : 8) : (weapon === "bat" ? 8 : 6);
  const plan: MeleePixelPlan[] = [];
  const chargeAmount = Math.max(0, Math.min(1, charge));
  const reach = (weapon === "bat" ? 43 : 32) * (mode === "heavy" ? 0.9 + chargeAmount * 0.1 : 1);
  const arc = mode === "stab" ? 0.12 : mode === "heavy" ? (weapon === "bat" ? 1.42 : 0.28) : (weapon === "bat" ? 2.08 : 1.62);
  const start = angle - arc * 0.5;
  for (let index = 0; index < Math.min(count, MELEE_TRAIL_PIXEL_CAP); index += 1) {
    const progress = index / Math.max(1, count - 1);
    const sampleAngle = start + arc * progress;
    const distance = mode === "stab" ? 8 + reach * progress : reach * (0.68 + random(sequence, index) * 0.28);
    const jitter = (random(sequence, 50 + index) - 0.5) * (mode === "heavy" ? 2 : 1);
    plan.push({ x: originX + Math.cos(sampleAngle) * distance + Math.cos(sampleAngle + Math.PI / 2) * jitter, y: originY + Math.sin(sampleAngle) * distance + Math.sin(sampleAngle + Math.PI / 2) * jitter, delayMs: progress * (mode === "heavy" ? 115 : mode === "swing" ? 86 : 48), lifetimeMs: mode === "heavy" ? 82 : 58, size: mode === "heavy" && index % 4 === 0 ? 3 : weapon === "bat" || index % 5 === 0 ? 2 : 1, colorIndex: index % 3 });
  }
  return plan;
}

export function createPostureShatterPlan(sequence: number, x: number, y: number, directionAngle: number): MeleePixelPlan[] {
  const plan: MeleePixelPlan[] = [];
  for (let index = 0; index < POSTURE_SHATTER_PIXEL_CAP; index += 1) {
    const angle = directionAngle + Math.PI + (random(sequence, index * 2) - 0.5) * 2.7;
    const distance = 4 + random(sequence, index * 2 + 1) * 12;
    plan.push({ x: x + Math.cos(angle) * distance, y: y + Math.sin(angle) * distance, delayMs: index % 5 * 7, lifetimeMs: 110 + index * 4, size: index % 7 === 0 ? 2 : 1, colorIndex: index % 3 });
  }
  return plan;
}

export function createChargePixelPlan(sequence: number, x: number, y: number, angle: number, charge: number): MeleePixelPlan[] {
  const count = Math.min(CHARGE_PIXEL_CAP, 2 + Math.floor(Math.max(0, Math.min(1, charge)) * 6));
  const plan: MeleePixelPlan[] = [];
  for (let index = 0; index < count; index += 1) {
    const sampleAngle = angle + Math.PI + (random(sequence, index) - 0.5) * 1.1;
    const distance = 5 + random(sequence, 30 + index) * 8;
    plan.push({ x: x + Math.cos(sampleAngle) * distance, y: y + Math.sin(sampleAngle) * distance, delayMs: index * 8, lifetimeMs: 80 + index * 8, size: index % 4 === 0 ? 2 : 1, colorIndex: index % 3 });
  }
  return plan;
}

function random(seed: number, salt: number): number {
  let value = (seed ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0;
  value ^= value >>> 16; value = Math.imul(value, 0x7feb352d); value ^= value >>> 15;
  return (value >>> 0) / 0x1_0000_0000;
}
