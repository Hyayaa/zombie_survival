import type { RecipeDefinition } from "../data/recipe-definitions";
import { InventorySystem } from "./inventory-system";

export interface CraftResult {
  success: boolean;
  reason?: "missing-materials" | "inventory-full";
  recipe?: RecipeDefinition;
}

export interface CraftOptions {
  ignoreIngredients?: boolean;
}

export class CraftingSystem {
  constructor(private readonly recipes: readonly RecipeDefinition[]) {}

  getRecipes(): readonly RecipeDefinition[] {
    return this.recipes;
  }

  craft(recipeId: string, inventory: InventorySystem, options: CraftOptions = {}): CraftResult {
    const recipe = this.recipes.find((candidate) => candidate.id === recipeId);
    if (!recipe) throw new Error(`Unknown recipe: ${recipeId}`);
    if (!options.ignoreIngredients && !inventory.has(recipe.ingredients)) return { success: false, reason: "missing-materials", recipe };

    if (options.ignoreIngredients) {
      if (!inventory.canAdd(recipe.resultItemId, recipe.resultQuantity)) return { success: false, reason: "inventory-full", recipe };
      inventory.add(recipe.resultItemId, recipe.resultQuantity);
      return { success: true, recipe };
    }

    const before = inventory.snapshot();
    Object.entries(recipe.ingredients).forEach(([itemId, quantity]) => inventory.remove(itemId, quantity));
    const added = inventory.add(recipe.resultItemId, recipe.resultQuantity);
    if (added !== recipe.resultQuantity) {
      inventory.restore(before);
      return { success: false, reason: "inventory-full", recipe };
    }
    return { success: true, recipe };
  }
}
