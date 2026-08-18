import { describe, expect, it } from "vitest";
import { InventorySystem } from "../systems/inventory-system";

describe("inventory placement preview rule", () => {
  it("allows the dragged item's own cells and rejects overlap or bounds violations", () => {
    const inventory = new InventorySystem(); inventory.add("water", 1); inventory.add("bandage", 1);
    const water = inventory.getStoredItems().find((item) => item.itemId === "water")!; const bandage = inventory.getStoredItems().find((item) => item.itemId === "bandage")!;
    expect(inventory.canPlace(water.instanceId, { containerId: water.containerId!, x: water.x, y: water.y, rotation: water.rotation })).toBe(true);
    expect(inventory.canPlace(water.instanceId, { containerId: bandage.containerId!, x: bandage.x, y: bandage.y, rotation: 1 })).toBe(false);
    expect(inventory.canPlace(water.instanceId, { containerId: "pockets", x: 4, y: 0, rotation: 1 })).toBe(false);
  });
});
