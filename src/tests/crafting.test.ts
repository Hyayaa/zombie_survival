import { describe, expect, it } from "vitest";
import { RECIPE_DEFINITIONS } from "../data/recipe-definitions";
import { CraftingSystem } from "../systems/crafting-system";
import { InventorySystem } from "../systems/inventory-system";

describe("CraftingSystem", () => {
  const crafting = new CraftingSystem(RECIPE_DEFINITIONS);

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
    const inventory = new InventorySystem(1);
    inventory.add("cloth", 3);
    expect(crafting.craft("bandage", inventory)).toMatchObject({ success: false, reason: "inventory-full" });
    expect(inventory.count("cloth")).toBe(3);
    expect(inventory.count("bandage")).toBe(0);
  });
});

