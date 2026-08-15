import type { RecipeDefinition } from "../data/recipe-definitions";
import { InventorySystem } from "./inventory-system";

export interface CraftResult {
  success: boolean;
  reason?: "missing-materials" | "inventory-full";
  recipe?: RecipeDefinition;
}

export class CraftingSystem {
  constructor(private readonly recipes: readonly RecipeDefinition[]) {}

  getRecipes(): readonly RecipeDefinition[] {
    return this.recipes;
  }

  craft(recipeId: string, inventory: InventorySystem): CraftResult {
    const recipe = this.recipes.find((candidate) => candidate.id === recipeId);
    if (!recipe) throw new Error(`Unknown recipe: ${recipeId}`);
    if (!inventory.has(recipe.ingredients)) return { success: false, reason: "missing-materials", recipe };

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

