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

  it("repacks legacy two-by-four shirt contents into four-by-two storage without loss", () => {
    const source = new InventorySystem(); source.add("water", 1); source.add("cloth", 3);
    const saved = source.snapshot(); const shirtId = source.getContainers().find(({ kind }) => kind === "shirt")!.id;
    const water = saved.items.find(({ itemId }) => itemId === "water")!; const cloth = saved.items.find(({ itemId }) => itemId === "cloth")!;
    water.containerId = shirtId; water.x = 0; water.y = 2; water.rotation = 0;
    cloth.containerId = shirtId; cloth.x = 1; cloth.y = 3; cloth.rotation = 0;
    const restored = new InventorySystem(20, saved);
    expect(restored.getContainers().find(({ kind }) => kind === "shirt")).toMatchObject({ width: 4, height: 2 });
    expect(restored.getItem(water.instanceId)).not.toBeNull(); expect(restored.getItem(cloth.instanceId)).not.toBeNull();
    expect(restored.count("water")).toBe(1); expect(restored.count("cloth")).toBe(3); expect(restored.takeLegacyOverflow()).toEqual([]);
  });

  it("preserves the original instance id when an impossible restored item becomes overflow", () => {
    const source = new InventorySystem(); source.add("solar_panel", 1); source.add("steel_plate", 1); source.add("hunting_rifle", 1);
    const saved = source.snapshot(); const solar = saved.items.find((item) => item.itemId === "solar_panel")!; const steel = saved.items.find((item) => item.itemId === "steel_plate")!; const rifle = saved.items.find((item) => item.itemId === "hunting_rifle")!;
    saved.equipment = {}; saved.items = [solar, steel, rifle];
    Object.assign(solar, { containerId: "pockets", x: 0, y: 0 }); Object.assign(steel, { containerId: "pockets", x: 2, y: 0 }); rifle.containerId = "missing-container";
    const restored = new InventorySystem(20, saved);
    expect(restored.getItem(rifle.instanceId)).toBeNull();
    expect(restored.takeLegacyOverflow()).toEqual([{ itemId: "hunting_rifle", quantity: 1, instanceId: rifle.instanceId }]);
  });
});
