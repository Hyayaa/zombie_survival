import { describe, expect, it } from "vitest";
import { RECIPE_DEFINITIONS } from "../data/recipe-definitions";
import { CraftingSystem } from "../systems/crafting-system";
import { InventorySystem } from "../systems/inventory-system";

describe("CraftingSystem", () => {
  const crafting = new CraftingSystem(RECIPE_DEFINITIONS);
  const bulkyCrafting = new CraftingSystem([...RECIPE_DEFINITIONS, { id: "test-bulky", name: "test", resultItemId: "barricade", resultQuantity: 1, ingredients: { cloth: 2 }, craftTimeMs: 1, noiseIntensity: 0 }]);

  function fragmentedInventory(): InventorySystem {
    const inventory = new InventorySystem();
    inventory.add("cloth", 3);
    inventory.add("engine_part", 5);
    return inventory;
  }

  it("crafts when materials are sufficient and consumes them", () => {
    const inventory = new InventorySystem();
    inventory.add("cloth", 2);
    const result = crafting.craft("bandage", inventory);
    expect(result.success).toBe(true);
    expect(inventory.count("cloth")).toBe(0);
    expect(inventory.count("bandage")).toBe(1);
  });

  it("fails safely when materials are missing", () => {
    const inventory = new InventorySystem();
    inventory.add("cloth", 1);
    expect(crafting.craft("bandage", inventory)).toMatchObject({ success: false, reason: "missing-materials" });
    expect(inventory.count("cloth")).toBe(1);
  });

  it("restores ingredients when the result cannot fit", () => {
    const inventory = fragmentedInventory();
    expect(bulkyCrafting.craft("test-bulky", inventory)).toMatchObject({ success: false, reason: "inventory-full" });
    expect(inventory.count("cloth")).toBe(3);
    expect(inventory.count("bandage")).toBe(0);
  });

  it("crafts without materials in developer mode and consumes nothing", () => {
    const inventory = new InventorySystem();
    const result = crafting.craft("bandage", inventory, { ignoreIngredients: true });
    expect(result.success).toBe(true);
    expect(inventory.count("cloth")).toBe(0);
    expect(inventory.count("bandage")).toBe(1);
  });

  it("still rejects developer crafting when the result cannot fit", () => {
    const inventory = fragmentedInventory();
    expect(bulkyCrafting.craft("test-bulky", inventory, { ignoreIngredients: true })).toMatchObject({ success: false, reason: "inventory-full" });
    expect(inventory.count("cloth")).toBe(3);
    expect(inventory.count("bandage")).toBe(0);
  });
});
