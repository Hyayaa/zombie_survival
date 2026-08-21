import { describe, expect, it } from "vitest";
import { InventorySystem } from "../systems/inventory-system";

describe("grid inventory save migration", () => {
  it("migrates legacy slots into the default wearable layout", () => {
    const inventory = new InventorySystem(20, [{ itemId: "bandage", quantity: 2 }, { itemId: "water", quantity: 1 }]);
    expect(inventory.count("bandage")).toBe(2);
    expect(inventory.count("water")).toBe(1);
    expect(inventory.getEquipment()).toMatchObject({ shirt: expect.any(String), pants: expect.any(String) });
    expect(inventory.takeLegacyOverflow()).toEqual([]);
  });

  it("round trips positions, equipment, and the instance counter", () => {
    const inventory = new InventorySystem();
    inventory.add("utility_belt", 1);
    const belt = inventory.getStoredItems().find(({ itemId }) => itemId === "utility_belt")!;
    expect(inventory.equip(belt.instanceId)).toBe(true);
    const saved = inventory.snapshot();
    const restored = new InventorySystem(20, saved);
    expect(restored.snapshot()).toEqual(saved);
    restored.add("bandage", 1);
    expect(restored.getStoredItems().find(({ itemId }) => itemId === "bandage")?.instanceId).toBe(`item-${saved.nextInstanceId}`);
  });

  it("migrates version 2 items without a rotation field to base orientation", () => {
    const current = new InventorySystem().snapshot();
    const legacy = { ...current, version: 2 as const, items: current.items.map(({ rotation: _rotation, ...item }) => item) };
    const restored = new InventorySystem(20, legacy as unknown as Parameters<InventorySystem["restore"]>[0]);
    expect(restored.getItems().every((item) => item.rotation === 0)).toBe(true);
    expect(restored.snapshot().version).toBe(4);
  });
});
