import { describe, expect, it } from "vitest";
import { InventorySystem } from "../systems/inventory-system";

describe("equipment slot drops", () => {
  it("accepts only matching clothing and weapon targets", () => {
    const inventory = new InventorySystem(); inventory.add("utility_belt", 1); inventory.add("pistol", 1);
    const belt = inventory.getStoredItems().find((item) => item.itemId === "utility_belt")!; const pistol = inventory.getStoredItems().find((item) => item.itemId === "pistol")!;
    expect(inventory.canEquipToSlot(belt.instanceId, "belt")).toBe(true); expect(inventory.canEquipToSlot(belt.instanceId, "vest")).toBe(false);
    expect(inventory.canEquipWeapon(pistol.instanceId, "primary")).toBe(true); expect(inventory.canEquipWeapon(belt.instanceId, "primary")).toBe(false);
  });
  it("keeps the source position on an invalid drop and preserves the instance on equip", () => {
    const inventory = new InventorySystem(); inventory.add("utility_vest", 1); const vest = inventory.getStoredItems().find((item) => item.itemId === "utility_vest")!; const before = inventory.getItem(vest.instanceId);
    expect(inventory.equipToSlot(vest.instanceId, "shirt")).toBe(false); expect(inventory.getItem(vest.instanceId)).toEqual(before);
    expect(inventory.equipToSlot(vest.instanceId, "vest")).toBe(true); expect(inventory.getEquipment().vest).toBe(vest.instanceId);
    expect(inventory.getContainers().find((container) => container.kind === "vest")).toMatchObject({ width: 4, height: 3, sourceItemInstanceId: vest.instanceId });
  });
});
