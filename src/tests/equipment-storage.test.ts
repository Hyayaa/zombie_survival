import { describe, expect, it } from "vitest";
import { InventorySystem } from "../systems/inventory-system";

describe("wearable storage", () => {
  it("keeps the shirt item at two-by-two while restoring its four-by-two storage", () => {
    const inventory = new InventorySystem(); const shirt = inventory.getContainers().find(({ kind }) => kind === "shirt")!;
    expect(shirt).toMatchObject({ width: 4, height: 2 }); inventory.add("cloth", 1); const cloth = inventory.getStoredItems().find(({ itemId }) => itemId === "cloth")!;
    expect(inventory.moveItem(cloth.instanceId, { containerId: shirt.id, x: 3, y: 1 })).toBe(true);
    const restored = new InventorySystem(20, inventory.snapshot()); expect(restored.getItem(cloth.instanceId)).toMatchObject({ x: 3, y: 1 });
  });
  it("creates an independent container when equipment is worn", () => {
    const inventory = new InventorySystem();
    inventory.add("utility_vest", 1);
    const vest = inventory.getItems().find(({ itemId }) => itemId === "utility_vest")!;
    if (vest.containerId !== null) expect(inventory.equip(vest.instanceId)).toBe(true);
    expect(inventory.getContainers().find(({ kind }) => kind === "vest")).toMatchObject({ width: 4, height: 3 });
  });

  it("does not unequip a container that still owns items", () => {
    const inventory = new InventorySystem();
    const shirt = inventory.getContainers().find(({ kind }) => kind === "shirt")!;
    inventory.add("cloth", 1);
    const cloth = inventory.getStoredItems().find(({ itemId }) => itemId === "cloth")!;
    expect(inventory.moveItem(cloth.instanceId, { containerId: shirt.id, x: 0, y: 0 })).toBe(true);
    expect(inventory.unequip("shirt")).toBe(false);
    expect(inventory.getContainers().some(({ kind }) => kind === "shirt")).toBe(true);
  });

  it("prevents bags inside bags", () => {
    const inventory = new InventorySystem();
    inventory.add("school_backpack", 1);
    const schoolBag = inventory.getItems().find(({ itemId }) => itemId === "school_backpack")!;
    if (schoolBag.containerId !== null) expect(inventory.equip(schoolBag.instanceId)).toBe(true);
    expect(inventory.add("hiking_backpack", 1)).toBe(0);
    expect(inventory.count("hiking_backpack")).toBe(0);
  });
});
