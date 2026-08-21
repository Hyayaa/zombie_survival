import { describe, expect, it } from "vitest";
import { InventorySystem } from "../systems/inventory-system";
import { initializeNewGameLoadout } from "../systems/new-game-loadout";

describe("new game loadout", () => {
  it("keeps basic supplies and grants exactly 20 reserve rounds with an equipped pistol", () => {
    const inventory = new InventorySystem();
    initializeNewGameLoadout(inventory);
    expect(inventory.count("bandage")).toBe(1);
    expect(inventory.count("water")).toBe(1);
    expect(inventory.count("pistol_ammo")).toBe(20);
    expect(inventory.getWeaponInstance("primary")?.itemId).toBe("knife");
    expect(inventory.getWeaponInstance("secondary")?.itemId).toBe("pistol");
    expect(inventory.getActiveWeaponId()).toBe("pistol");
  });
});
