import { describe, expect, it } from "vitest";
import { getEffectiveFootprint, getItemDefinition } from "../data/item-definitions";
import { InventorySystem, type GridInventorySnapshot } from "../systems/inventory-system";

describe("inventory item rotation", () => {
  it("swaps effective dimensions and rotates in place atomically", () => {
    expect(getEffectiveFootprint(getItemDefinition("water"), 0)).toEqual({ width: 2, height: 1 });
    expect(getEffectiveFootprint(getItemDefinition("water"), 1)).toEqual({ width: 1, height: 2 });
    const inventory = new InventorySystem(); inventory.add("water", 1); const water = inventory.getStoredItems().find((item) => item.itemId === "water")!;
    expect(inventory.rotateItem(water.instanceId)).toBe(true);
    expect(inventory.getItem(water.instanceId)).toMatchObject({ rotation: 1, width: 1, height: 2, x: water.x, y: water.y });
  });
  it("tries base rotation before rotated auto-placement", () => {
    const snapshot: GridInventorySnapshot = { version: 3, nextInstanceId: 4, equipment: { belt: "item-1" }, items: [
      { instanceId: "item-1", itemId: "utility_belt", quantity: 1, containerId: null, x: 0, y: 0, width: 2, height: 1, rotation: 0 },
      { instanceId: "item-2", itemId: "engine_part", quantity: 1, containerId: "pockets", x: 0, y: 0, width: 2, height: 2, rotation: 0 },
      { instanceId: "item-3", itemId: "engine_part", quantity: 1, containerId: "pockets", x: 2, y: 0, width: 2, height: 2, rotation: 0 },
    ] };
    const inventory = new InventorySystem(20, snapshot); expect(inventory.add("water", 1)).toBe(1);
    expect(inventory.getStoredItems().find((item) => item.itemId === "water")).toMatchObject({ rotation: 0, width: 2, height: 1 });
  });
});
