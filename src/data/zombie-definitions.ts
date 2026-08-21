export type ZombieKind = "walker" | "runner";
export type ZombieStateName = "Idle" | "Wander" | "InvestigateNoise" | "Chase" | "Attack" | "AttackObstacle" | "SearchLastKnownPosition" | "Stagger" | "Dead";

export interface ZombieDefinition {
  kind: ZombieKind;
  name: string;
  health: number;
  speed: number;
  sightRadius: number;
  hearingMultiplier: number;
  damage: number;
  infectionScratch: number;
  infectionBite: number;
  attackCooldownMs: number;
  biteWindupMs: number;
  bodyColor: number;
  accentColor: number;
  postureMaximum: number;
  postureRecoveryPerSecond: number;
  postureRecoveryDelayMs: number;
  postureBreakStaggerMs: number;
  postureBreakImmunityMs: number;
}

export const ZOMBIE_DEFINITIONS: Record<ZombieKind, ZombieDefinition> = {
  walker: {
    kind: "walker", name: "배회자", health: 72, speed: 27, sightRadius: 81, hearingMultiplier: 0.67,
    damage: 9, infectionScratch: 4, infectionBite: 16, attackCooldownMs: 1_300, biteWindupMs: 520,
    bodyColor: 0x687765, accentColor: 0x9aa486,
    postureMaximum: 100, postureRecoveryPerSecond: 27, postureRecoveryDelayMs: 1_450, postureBreakStaggerMs: 680, postureBreakImmunityMs: 580,
  },
  runner: {
    kind: "runner", name: "질주자", health: 36, speed: 49, sightRadius: 95, hearingMultiplier: 0.9,
    damage: 7, infectionScratch: 5, infectionBite: 14, attackCooldownMs: 1_050, biteWindupMs: 420,
    bodyColor: 0x66483f, accentColor: 0x9b6a58,
    postureMaximum: 78, postureRecoveryPerSecond: 34, postureRecoveryDelayMs: 1_250, postureBreakStaggerMs: 490, postureBreakImmunityMs: 520,
  },
};
