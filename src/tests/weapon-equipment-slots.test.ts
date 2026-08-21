import { describe, expect, it } from "vitest";
import { InventorySystem } from "../systems/inventory-system";

function stored(inventory: InventorySystem, itemId: string) { return inventory.getStoredItems().find((item) => item.itemId === itemId)!; }

describe("two-slot weapon equipment", () => {
  it("keeps stable instances in exactly two slots and persists the active slot", () => {
    const inventory = new InventorySystem(); inventory.add("knife", 1); inventory.add("pistol", 1); inventory.add("smg", 1);
    const knife = stored(inventory, "knife"); const pistol = stored(inventory, "pistol");
    expect(inventory.equipWeapon(knife.instanceId, "primary")).toBe(true);
    expect(inventory.equipWeapon(pistol.instanceId, "secondary")).toBe(true);
    expect(inventory.setActiveWeaponSlot("primary")).toBe(true);
    const restored = new InventorySystem(20, inventory.snapshot());
    expect(restored.getWeaponInstance("primary")?.instanceId).toBe(knife.instanceId);
    expect(restored.getWeaponInstance("secondary")?.instanceId).toBe(pistol.instanceId);
    expect(restored.getActiveWeaponId()).toBe("knife");
    expect(restored.getStoredItems().filter((item) => item.itemId === "smg")).toHaveLength(1);
  });

  it("rolls a replacement back when the displaced long weapon cannot fit", () => {
    const inventory = new InventorySystem(); inventory.add("bat", 1); const bat = stored(inventory, "bat"); expect(inventory.equipWeapon(bat.instanceId, "primary")).toBe(true);
    inventory.add("pistol", 1); const pistol = stored(inventory, "pistol"); inventory.add("cloth", 1_000);
    const before = inventory.snapshot(); expect(inventory.equipWeapon(pistol.instanceId, "primary")).toBe(false); expect(inventory.snapshot()).toEqual(before);
  });

  it("migrates legacy ownership without duplicating instances", () => {
    const inventory = new InventorySystem(); expect(inventory.migrateLegacyWeapons("pistol", ["knife", "pistol", "bat"])).toEqual([]);
    expect(inventory.count("pistol")).toBe(1); expect(inventory.count("knife")).toBe(1); expect(inventory.count("bat")).toBe(1);
    expect(inventory.getActiveWeaponId()).toBe("pistol");
  });

  it("reuses a legacy grid weapon and falls back to the other slot or unarmed on removal", () => {
    const inventory = new InventorySystem(); inventory.add("pistol", 1); const existing = stored(inventory, "pistol");
    inventory.migrateLegacyWeapons("pistol", ["pistol", "knife"]);
    expect(inventory.getWeaponInstance("primary")?.instanceId).toBe(existing.instanceId); expect(inventory.count("pistol")).toBe(1);
    expect(inventory.unequipWeapon("primary")).toBe(true); expect(inventory.getActiveWeaponId()).toBe("knife");
    expect(inventory.unequipWeapon("secondary")).toBe(true); expect(inventory.getActiveWeaponId()).toBeNull();
  });
});
