import type { ConsumableEffect } from "../data/item-definitions";

export interface ConsumableVitals { health: number; maxHealth: number; infection: number }
export interface ConsumableNeeds { hunger: number; thirst: number; stamina: number }

export function canApplyConsumable(effect: ConsumableEffect, vitals: ConsumableVitals, needs: ConsumableNeeds): boolean {
  return Boolean(
    effect.health && vitals.health < vitals.maxHealth
    || effect.infection && (effect.infection < 0 ? vitals.infection > 0 : vitals.infection < 100)
    || effect.hunger && needs.hunger < 100
    || effect.thirst && needs.thirst < 100
    || effect.stamina && needs.stamina < 100
  );
}

export function applyConsumable(effect: ConsumableEffect, vitals: ConsumableVitals, needs: ConsumableNeeds): { vitals: ConsumableVitals; needs: ConsumableNeeds } {
  return {
    vitals: { ...vitals, health: clamp(vitals.health + (effect.health ?? 0), 0, vitals.maxHealth), infection: clamp(vitals.infection + (effect.infection ?? 0), 0, 100) },
    needs: { hunger: clamp(needs.hunger + (effect.hunger ?? 0), 0, 100), thirst: clamp(needs.thirst + (effect.thirst ?? 0), 0, 100), stamina: clamp(needs.stamina + (effect.stamina ?? 0), 0, 100) },
  };
}

function clamp(value: number, minimum: number, maximum: number): number { return Math.max(minimum, Math.min(maximum, value)); }
