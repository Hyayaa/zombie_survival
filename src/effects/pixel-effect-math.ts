import type { AttackEffectWeapon } from "./pixel-effect-definitions";

export interface MuzzleFlashProfile { length: number; branches: number; lifetimeMs: number; muzzleOffset: number }
export const MUZZLE_FLASH_PROFILES: Readonly<Record<Exclude<AttackEffectWeapon, "knife" | "bat">, MuzzleFlashProfile>> = {
  pistol: { length: 12, branches: 4, lifetimeMs: 60, muzzleOffset: 12 },
  smg: { length: 9, branches: 3, lifetimeMs: 45, muzzleOffset: 13 },
  shotgun: { length: 21, branches: 7, lifetimeMs: 82, muzzleOffset: 15 },
  hunting_rifle: { length: 25, branches: 6, lifetimeMs: 76, muzzleOffset: 18 },
  turret: { length: 10, branches: 4, lifetimeMs: 46, muzzleOffset: 16 },
};

export interface PixelPoint {
  x: number;
  y: number;
}

export interface TracerSegment {
  start: PixelPoint;
  end: PixelPoint;
}

interface SwingProfile {
  startAngle: number;
  endAngle: number;
  minimumRadius: number;
  maximumRadius: number;
}

const DEG_TO_RAD = Math.PI / 180;
const SWING_PROFILES: Record<"knife" | "bat", SwingProfile> = {
  knife: { startAngle: -55 * DEG_TO_RAD, endAngle: 55 * DEG_TO_RAD, minimumRadius: 8, maximumRadius: 17 },
  bat: { startAngle: -75 * DEG_TO_RAD, endAngle: 70 * DEG_TO_RAD, minimumRadius: 9, maximumRadius: 20 },
};

export function effectSeed(sequence: number, weapon: AttackEffectWeapon, originX: number, originY: number): number {
  const weaponSalt = weapon === "knife" ? 0x51ed270b : weapon === "bat" ? 0x68e31da4 : 0x7f4a7c15;
  let value = Math.imul(sequence ^ weaponSalt, 0x85ebca6b);
  value ^= Math.imul(Math.round(originX), 0xc2b2ae35);
  value ^= Math.imul(Math.round(originY), 0x27d4eb2f);
  value ^= value >>> 16;
  return value >>> 0;
}

export function effectRandom(seed: number, sample: number): number {
  let value = seed ^ Math.imul(sample + 1, 0x9e3779b1);
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  value ^= value >>> 16;
  return (value >>> 0) / 4_294_967_296;
}

export function swingOffsetAt(weapon: "knife" | "bat", progress: number): number {
  const profile = SWING_PROFILES[weapon];
  const amount = clamp01(progress);
  if (amount < 0.2) return lerp(0, profile.startAngle, easeOut(amount / 0.2));
  if (amount < 0.75) return lerp(profile.startAngle, profile.endAngle, easeInOut((amount - 0.2) / 0.55));
  return lerp(profile.endAngle, 0, easeOut((amount - 0.75) / 0.25));
}

export function sampleSwingPixel(
  weapon: "knife" | "bat",
  originX: number,
  originY: number,
  aimAngle: number,
  progress: number,
  seed: number,
  sample: number,
): PixelPoint {
  const profile = SWING_PROFILES[weapon];
  const amount = clamp01(progress);
  const radius = lerp(profile.minimumRadius, profile.maximumRadius, 0.28 + amount * 0.72);
  const jitter = (effectRandom(seed, sample) - 0.5) * 0.035;
  const angle = aimAngle + swingOffsetAt(weapon, amount) + jitter;
  return {
    x: Math.round(originX + Math.cos(angle) * radius),
    y: Math.round(originY + Math.sin(angle) * radius),
  };
}

export function getMuzzlePosition(originX: number, originY: number, angle: number, distance = 12): PixelPoint {
  return {
    x: Math.round(originX + Math.cos(angle) * distance),
    y: Math.round(originY + Math.sin(angle) * distance),
  };
}

export function getTracerSegmentCount(startX: number, startY: number, endX: number, endY: number): number {
  const distance = Math.hypot(endX - startX, endY - startY);
  return Math.max(2, Math.min(5, Math.ceil(distance / 52)));
}

export function getTracerSegment(startX: number, startY: number, endX: number, endY: number, index: number, count: number): TracerSegment {
  const safeCount = Math.max(1, count);
  const clampedIndex = Math.max(0, Math.min(safeCount - 1, index));
  const deltaX = endX - startX;
  const deltaY = endY - startY;
  const distance = Math.hypot(deltaX, deltaY);
  const startAmount = Math.min(1, (clampedIndex + 0.24) / safeCount);
  const segmentAmount = distance > 0 ? Math.min(7 / distance, 0.38 / safeCount) : 0;
  const endAmount = Math.min(1, startAmount + segmentAmount);
  return {
    start: { x: Math.round(startX + deltaX * startAmount), y: Math.round(startY + deltaY * startAmount) },
    end: { x: Math.round(startX + deltaX * endAmount), y: Math.round(startY + deltaY * endAmount) },
  };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
}

function easeOut(value: number): number {
  return 1 - (1 - value) * (1 - value);
}

function easeInOut(value: number): number {
  return value < 0.5 ? 2 * value * value : 1 - Math.pow(-2 * value + 2, 2) / 2;
}
