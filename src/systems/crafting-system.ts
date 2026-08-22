import { CRAFTING_STATION_TIER, type CraftingStationKind, type RecipeDefinition } from "../data/recipe-definitions";
import { InventorySystem } from "./inventory-system";

export interface CraftResult {
  success: boolean;
  reason?: "station-missing" | "missing-materials" | "inventory-full";
  recipe?: RecipeDefinition;
}

export interface CraftOptions {
  ignoreIngredients?: boolean;
  stationKind?: CraftingStationKind;
}
export type CraftAvailability = "ready" | "station-missing" | "missing-materials" | "inventory-full";

export function stationSatisfies(available: CraftingStationKind, required: CraftingStationKind): boolean {
  return CRAFTING_STATION_TIER[available] >= CRAFTING_STATION_TIER[required];
}

export class CraftingSystem {
  constructor(private readonly recipes: readonly RecipeDefinition[]) {}

  getRecipes(): readonly RecipeDefinition[] {
    return this.recipes;
  }

  getAvailability(recipeId: string, inventory: InventorySystem, options: CraftOptions = {}): CraftAvailability {
    const recipe = this.recipes.find((candidate) => candidate.id === recipeId);
    if (!recipe) throw new Error(`Unknown recipe: ${recipeId}`);
    if (!stationSatisfies(options.stationKind ?? "hand", recipe.requiredStation)) return "station-missing";
    if (!options.ignoreIngredients && !inventory.has(recipe.ingredients)) return "missing-materials";
    const trial = inventory.clone();
    if (!options.ignoreIngredients) for (const [itemId, quantity] of Object.entries(recipe.ingredients)) trial.remove(itemId, quantity);
    return trial.canAdd(recipe.resultItemId, recipe.resultQuantity) ? "ready" : "inventory-full";
  }

  craft(recipeId: string, inventory: InventorySystem, options: CraftOptions = {}): CraftResult {
    const recipe = this.recipes.find((candidate) => candidate.id === recipeId);
    if (!recipe) throw new Error(`Unknown recipe: ${recipeId}`);
    if (!stationSatisfies(options.stationKind ?? "hand", recipe.requiredStation)) return { success: false, reason: "station-missing", recipe };
    if (!options.ignoreIngredients && !inventory.has(recipe.ingredients)) return { success: false, reason: "missing-materials", recipe };

    if (options.ignoreIngredients) {
      if (!inventory.canAdd(recipe.resultItemId, recipe.resultQuantity)) return { success: false, reason: "inventory-full", recipe };
      inventory.add(recipe.resultItemId, recipe.resultQuantity);
      return { success: true, recipe };
    }

    const trial = inventory.clone();
    Object.entries(recipe.ingredients).forEach(([itemId, quantity]) => trial.remove(itemId, quantity));
    const added = trial.add(recipe.resultItemId, recipe.resultQuantity);
    if (added !== recipe.resultQuantity) {
      return { success: false, reason: "inventory-full", recipe };
    }
    inventory.restore(trial.snapshot());
    return { success: true, recipe };
  }
}
