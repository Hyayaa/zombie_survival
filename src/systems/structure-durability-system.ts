import { BUILDABLE_DEFINITIONS, getBuildCostItems, type BuildableKind, type StructureMaterial } from "../data/buildable-definitions";
import type { PlacedStructureState } from "../entities/placed-structure";
import { RECIPE_DEFINITIONS } from "../data/recipe-definitions";

export const STRUCTURE_DAMAGE_MULTIPLIER: Readonly<Record<StructureMaterial, number>> = Object.freeze({ wood: 1, metal: 0.65, machine: 0.85 });
export interface StructureDamageResult { damaged: boolean; destroyedNow: boolean; appliedDamage: number }

export class StructureDurabilitySystem {
  private readonly destroyed = new Set<string>();
  damage(state: PlacedStructureState, rawDamage: number): StructureDamageResult {
    if (rawDamage <= 0 || state.health <= 0 || this.destroyed.has(state.id)) return { damaged: false, destroyedNow: false, appliedDamage: 0 };
    const material = BUILDABLE_DEFINITIONS[state.kind].material; const appliedDamage = Math.max(1, Math.round(rawDamage * STRUCTURE_DAMAGE_MULTIPLIER[material]));
    state.health = Math.max(0, state.health - appliedDamage); const destroyedNow = state.health === 0;
    if (destroyedNow) this.destroyed.add(state.id);
    return { damaged: true, destroyedNow, appliedDamage };
  }
  repair(state: PlacedStructureState, inventory: { count(id: string): number; remove(id: string, quantity: number): boolean }): boolean {
    if (state.health >= state.maximumHealth) return false; const costs = getRepairCost(state);
    if (costs.some((cost) => inventory.count(cost.itemId) < cost.quantity)) return false;
    for (const cost of costs) if (!inventory.remove(cost.itemId, cost.quantity)) return false;
    state.health = state.maximumHealth; this.destroyed.delete(state.id); return true;
  }
}

export function getOriginalMaterialCost(kind: BuildableKind): Array<{ itemId: string; quantity: number }> {
  const definition = BUILDABLE_DEFINITIONS[kind];
  if (definition.cost.kind === "materials") return definition.cost.items.map((item) => ({ ...item }));
  const kitItemId = definition.cost.itemId;
  const recipe = RECIPE_DEFINITIONS.find((candidate) => candidate.resultItemId === kitItemId);
  return recipe ? Object.entries(recipe.ingredients).map(([itemId, quantity]) => ({ itemId, quantity })) : getBuildCostItems(definition).map((item) => ({ ...item }));
}
export function getRepairCost(state: Pick<PlacedStructureState, "kind" | "health" | "maximumHealth">): Array<{ itemId: string; quantity: number }> {
  const ratio = Math.max(0, state.maximumHealth - state.health) / state.maximumHealth;
  return getOriginalMaterialCost(state.kind).map((cost) => ({ itemId: cost.itemId, quantity: Math.ceil(cost.quantity * ratio * 0.6) })).filter((cost) => cost.quantity > 0);
}
export function getDemolitionRefund(state: Pick<PlacedStructureState, "kind" | "health" | "maximumHealth">): Array<{ itemId: string; quantity: number }> {
  const ratio = 0.65 * Math.max(0, state.health) / state.maximumHealth;
  return getOriginalMaterialCost(state.kind).map((cost) => ({ itemId: cost.itemId, quantity: Math.floor(cost.quantity * ratio) })).filter((cost) => cost.quantity > 0);
}
export function estimateStructureBreakCost(state: Pick<PlacedStructureState, "kind" | "health">, damagePerSecond = 12, costWeight = 1): number {
  const resistance = STRUCTURE_DAMAGE_MULTIPLIER[BUILDABLE_DEFINITIONS[state.kind].material];
  return state.health / Math.max(1, damagePerSecond * resistance) * costWeight;
}
