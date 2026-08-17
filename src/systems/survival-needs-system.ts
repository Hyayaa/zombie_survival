export interface SurvivalNeeds {
  hunger: number;
  thirst: number;
  stamina: number;
}

export interface SurvivalRuntime {
  exhausted: boolean;
  lastRunAt: number;
  starving: boolean;
  dehydrated: boolean;
  nextHungerDamageAt: number;
  nextThirstDamageAt: number;
}

export interface SurvivalUpdateInput {
  deltaSeconds: number;
  nowMs: number;
  actualRunning: boolean;
  lastAttackAt: number;
}

export const SURVIVAL_BALANCE = {
  hungerDrainPerSecond: 0.04,
  thirstDrainPerSecond: 0.0625,
  runningHungerMultiplier: 1.2,
  runningThirstMultiplier: 1.35,
  staminaDrainPerSecond: 24,
  staminaRecoveryPerSecond: 20,
  staminaRecoveryDelayMs: 650,
  attackRecoveryDelayMs: 500,
  resumeRunningAt: 18,
  lowNeedsThreshold: 25,
  hungerRecoveryMultiplier: 0.75,
  thirstRecoveryMultiplier: 0.55,
  hungerRunSpeedMultiplier: 0.92,
  thirstRunSpeedMultiplier: 0.85,
  hungerDamage: 2,
  hungerDamageIntervalMs: 5_000,
  thirstDamage: 3,
  thirstDamageIntervalMs: 4_000,
  cannedFoodRestore: 35,
  waterRestore: 45,
} as const;

export function clampNeed(value: number, fallback = 100): number {
  return Math.min(100, Math.max(0, Number.isFinite(value) ? value : fallback));
}

export function createSurvivalNeeds(value: Partial<SurvivalNeeds> = {}): SurvivalNeeds {
  return {
    hunger: clampNeed(value.hunger ?? 100),
    thirst: clampNeed(value.thirst ?? 100),
    stamina: clampNeed(value.stamina ?? 100),
  };
}

export function createSurvivalRuntime(): SurvivalRuntime {
  return {
    exhausted: false,
    lastRunAt: -Infinity,
    starving: false,
    dehydrated: false,
    nextHungerDamageAt: Infinity,
    nextThirstDamageAt: Infinity,
  };
}

export function canRun(needs: SurvivalNeeds, runtime: SurvivalRuntime): boolean {
  if (runtime.exhausted && needs.stamina >= SURVIVAL_BALANCE.resumeRunningAt) runtime.exhausted = false;
  return !runtime.exhausted && needs.stamina > 0;
}

export function getRunSpeedMultiplier(needs: SurvivalNeeds): number {
  let multiplier = 1;
  if (needs.hunger <= SURVIVAL_BALANCE.lowNeedsThreshold) multiplier *= SURVIVAL_BALANCE.hungerRunSpeedMultiplier;
  if (needs.thirst <= SURVIVAL_BALANCE.lowNeedsThreshold) multiplier *= SURVIVAL_BALANCE.thirstRunSpeedMultiplier;
  return multiplier;
}

export function updateSurvivalNeeds(needs: SurvivalNeeds, runtime: SurvivalRuntime, input: SurvivalUpdateInput): { needs: SurvivalNeeds; damage: number } {
  const deltaSeconds = Math.max(0, Number.isFinite(input.deltaSeconds) ? input.deltaSeconds : 0);
  const hungerMultiplier = input.actualRunning ? SURVIVAL_BALANCE.runningHungerMultiplier : 1;
  const thirstMultiplier = input.actualRunning ? SURVIVAL_BALANCE.runningThirstMultiplier : 1;
  const next = createSurvivalNeeds({
    hunger: needs.hunger - SURVIVAL_BALANCE.hungerDrainPerSecond * hungerMultiplier * deltaSeconds,
    thirst: needs.thirst - SURVIVAL_BALANCE.thirstDrainPerSecond * thirstMultiplier * deltaSeconds,
    stamina: needs.stamina,
  });

  if (input.actualRunning) {
    runtime.lastRunAt = input.nowMs;
    next.stamina = clampNeed(next.stamina - SURVIVAL_BALANCE.staminaDrainPerSecond * deltaSeconds);
    if (next.stamina <= 0) runtime.exhausted = true;
  } else if (input.nowMs - runtime.lastRunAt >= SURVIVAL_BALANCE.staminaRecoveryDelayMs) {
    let recovery = SURVIVAL_BALANCE.staminaRecoveryPerSecond;
    if (next.hunger <= SURVIVAL_BALANCE.lowNeedsThreshold) recovery *= SURVIVAL_BALANCE.hungerRecoveryMultiplier;
    if (next.thirst <= SURVIVAL_BALANCE.lowNeedsThreshold) recovery *= SURVIVAL_BALANCE.thirstRecoveryMultiplier;
    if (input.nowMs - input.lastAttackAt < SURVIVAL_BALANCE.attackRecoveryDelayMs) recovery *= 0.65;
    next.stamina = clampNeed(next.stamina + recovery * deltaSeconds);
  }

  let damage = 0;
  if (next.hunger <= 0) {
    if (!runtime.starving) {
      runtime.starving = true;
      runtime.nextHungerDamageAt = input.nowMs + SURVIVAL_BALANCE.hungerDamageIntervalMs;
    } else if (input.nowMs >= runtime.nextHungerDamageAt) {
      damage += SURVIVAL_BALANCE.hungerDamage;
      runtime.nextHungerDamageAt = input.nowMs + SURVIVAL_BALANCE.hungerDamageIntervalMs;
    }
  } else {
    runtime.starving = false;
    runtime.nextHungerDamageAt = Infinity;
  }
  if (next.thirst <= 0) {
    if (!runtime.dehydrated) {
      runtime.dehydrated = true;
      runtime.nextThirstDamageAt = input.nowMs + SURVIVAL_BALANCE.thirstDamageIntervalMs;
    } else if (input.nowMs >= runtime.nextThirstDamageAt) {
      damage += SURVIVAL_BALANCE.thirstDamage;
      runtime.nextThirstDamageAt = input.nowMs + SURVIVAL_BALANCE.thirstDamageIntervalMs;
    }
  } else {
    runtime.dehydrated = false;
    runtime.nextThirstDamageAt = Infinity;
  }
  return { needs: next, damage };
}

export function restoreHunger(needs: SurvivalNeeds, amount = SURVIVAL_BALANCE.cannedFoodRestore): SurvivalNeeds {
  return { ...needs, hunger: clampNeed(needs.hunger + amount) };
}

export function restoreThirst(needs: SurvivalNeeds, amount = SURVIVAL_BALANCE.waterRestore): SurvivalNeeds {
  return { ...needs, thirst: clampNeed(needs.thirst + amount) };
}
