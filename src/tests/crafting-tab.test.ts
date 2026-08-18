import { describe, expect, it } from "vitest";
import { RECIPE_DEFINITIONS } from "../data/recipe-definitions";
import { CraftingSystem } from "../systems/crafting-system";
import { InventorySystem } from "../systems/inventory-system";

describe("crafting tab model", () => {
  it("reports missing materials and re-evaluates ready state after materials arrive", () => {
    const crafting = new CraftingSystem(RECIPE_DEFINITIONS); const inventory = new InventorySystem();
    expect(crafting.getAvailability("bandage", inventory)).toBe("missing-materials");
    inventory.add("cloth", 2);
    expect(crafting.getAvailability("bandage", inventory)).toBe("ready");
  });
  it("reports no-space state after simulating ingredient consumption", () => {
    const crafting = new CraftingSystem([...RECIPE_DEFINITIONS, { id: "bulky", name: "bulky", resultItemId: "barricade", resultQuantity: 1, ingredients: { cloth: 2 }, craftTimeMs: 1, noiseIntensity: 0 }]);
    const inventory = new InventorySystem(); inventory.add("cloth", 3); inventory.add("engine_part", 4);
    expect(crafting.getAvailability("bulky", inventory)).toBe("inventory-full");
  });
});
