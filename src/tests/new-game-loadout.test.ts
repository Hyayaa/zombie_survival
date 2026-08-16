import { describe, expect, it, vi } from "vitest";
import { InventorySystem } from "../systems/inventory-system";
import { initializeNewGameLoadout } from "../systems/new-game-loadout";

describe("new game loadout", () => {
  it("keeps basic supplies and grants exactly 20 reserve rounds with an equipped pistol", () => {
    const inventory = new InventorySystem();
    let equipped = "knife";
    const unlockWeapon = vi.fn((weapon: "knife" | "bat" | "pistol") => { equipped = weapon; });
    initializeNewGameLoadout(inventory, { unlockWeapon });
    expect(inventory.count("bandage")).toBe(1);
    expect(inventory.count("water")).toBe(1);
    expect(inventory.count("pistol_ammo")).toBe(20);
    expect(unlockWeapon).toHaveBeenCalledWith("pistol");
    expect(equipped).toBe("pistol");
  });
});
