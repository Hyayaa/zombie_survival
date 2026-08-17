import { describe, expect, it } from "vitest";
import { InventorySystem } from "../systems/inventory-system";

describe("grid inventory", () => {
  it("starts with pockets, shirt, and pants providing twenty cells", () => {
    const inventory = new InventorySystem();
    const containers = inventory.getContainers();
    expect(containers.map(({ kind, width, height }) => [kind, width, height])).toEqual([
      ["pockets", 4, 2], ["shirt", 2, 2], ["pants", 4, 2],
    ]);
    expect(containers.reduce((sum, container) => sum + container.occupancy.length, 0)).toBe(20);
  });

  it("uses one footprint for a whole stack and preserves stable instance ids", () => {
    const inventory = new InventorySystem();
    expect(inventory.add("cloth", 12)).toBe(12);
    const item = inventory.getStoredItems().find(({ itemId }) => itemId === "cloth")!;
    expect(item.quantity).toBe(12);
    expect(item.width * item.height).toBe(1);
    expect(new InventorySystem(20, inventory.snapshot()).getItem(item.instanceId)).toMatchObject(item);
  });

  it("rolls invalid moves back without changing the item", () => {
    const inventory = new InventorySystem();
    inventory.add("water", 1);
    const before = inventory.getStoredItems().find(({ itemId }) => itemId === "water")!;
    expect(inventory.moveItem(before.instanceId, { containerId: "pockets", x: 4, y: 0 })).toBe(false);
    expect(inventory.getItem(before.instanceId)).toEqual(before);
  });
});
