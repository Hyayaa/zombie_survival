import { describe, expect, it } from "vitest";
import { InventorySystem } from "../systems/inventory-system";

describe("equipment drag unequip", () => {
  it("moves clothing directly into a requested grid cell atomically with the same instance id", () => {
    const inventory = new InventorySystem(); const shirtId = inventory.getEquipment().shirt!;
    expect(inventory.unequipItemToGrid("shirt", shirtId, { containerId: "pockets", x: 0, y: 0, rotation: 0 })).toEqual({ success: true });
    expect(inventory.getEquipment().shirt).toBeUndefined(); expect(inventory.getContainers().some(({ kind }) => kind === "shirt")).toBe(false);
    expect(inventory.getItem(shirtId)).toMatchObject({ instanceId: shirtId, containerId: "pockets", x: 0, y: 0, width: 2, height: 2 });
  });

  it("rejects own storage and non-empty equipment storage without mutating state", () => {
    const inventory = new InventorySystem(); const shirtId = inventory.getEquipment().shirt!; const shirtContainer = inventory.getContainers().find(({ kind }) => kind === "shirt")!;
    expect(inventory.canUnequipItemToGrid("shirt", shirtId, { containerId: shirtContainer.id, x: 0, y: 0 })).toEqual({ success: false, reason: "own-storage" });
    inventory.add("cloth", 1); const cloth = inventory.getStoredItems().find(({ itemId }) => itemId === "cloth")!;
    expect(inventory.moveItem(cloth.instanceId, { containerId: shirtContainer.id, x: 0, y: 0 })).toBe(true);
    const before = inventory.snapshot(); expect(inventory.unequipItemToGrid("shirt", shirtId, { containerId: "pockets", x: 0, y: 0 })).toEqual({ success: false, reason: "storage-not-empty" });
    expect(inventory.snapshot()).toEqual(before);
  });

  it("rolls back a blocked clothing target and supports weapon-slot-to-grid dragging", () => {
    const inventory = new InventorySystem(); const shirtId = inventory.getEquipment().shirt!; const before = inventory.snapshot();
    expect(inventory.unequipItemToGrid("shirt", shirtId, { containerId: "pockets", x: 3, y: 1 })).toEqual({ success: false, reason: "target-blocked" });
    expect(inventory.snapshot()).toEqual(before);
    expect(inventory.add("knife", 1)).toBe(1); const knife = inventory.getStoredItems().find(({ itemId }) => itemId === "knife")!;
    expect(inventory.equipWeapon(knife.instanceId, "primary")).toBe(true);
    expect(inventory.unequipWeaponToGrid("primary", knife.instanceId, { containerId: "pockets", x: 0, y: 0 })).toEqual({ success: true });
    expect(inventory.getWeaponInstance("primary")).toBeNull(); expect(inventory.getItem(knife.instanceId)).toMatchObject({ containerId: "pockets", x: 0, y: 0 });
  });
});
