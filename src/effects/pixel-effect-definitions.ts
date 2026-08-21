export type AttackEffectWeapon = "knife" | "bat" | "pistol" | "smg" | "shotgun" | "hunting_rifle" | "turret";
export type AttackImpactKind = "zombie" | "wall";

export interface AttackEffectImpact {
  x: number;
  y: number;
  kind: AttackImpactKind;
}

export interface AttackEffectEvent {
  sequence: number;
  weapon: AttackEffectWeapon;
  originX: number;
  originY: number;
  angle: number;
  startedAt: number;
  endpointX?: number;
  endpointY?: number;
  impacts: readonly AttackEffectImpact[];
  alwaysShowCore?: boolean;
  meleeMode?: "stab" | "swing" | "heavy";
  charge?: number;
  meleeRange?: number;
  meleeArcRadians?: number;
  sweepDirection?: -1 | 1;
}

export const ATTACK_EFFECT_DURATION_MS: Record<AttackEffectWeapon, number> = {
  knife: 120,
  bat: 200,
  pistol: 90,
  smg: 70,
  shotgun: 120,
  hunting_rifle: 125,
  turret: 70,
};

export const PIXEL_EFFECT_PRIORITY = {
  dust: 1,
  smoke: 2,
  wall: 3,
  impact: 4,
  tracer: 5,
  muzzle: 6,
  swing: 7,
} as const;
