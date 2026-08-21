import { describe, expect, it, vi } from "vitest";
import { ITEM_DEFINITIONS } from "../data/item-definitions";
import { WEAPON_DEFINITIONS } from "../data/weapon-definitions";
import { createCompendiumEntries, filterCompendiumEntries, grantCompendiumEntry } from "../systems/compendium-system";
import { pauseEscapeAction } from "../ui/pause-menu";

describe("item compendium", () => {
  it("automatically lists every item and obtainable weapon exactly once", () => {
    const entries = createCompendiumEntries();
    expect(entries).toHaveLength(Object.keys(ITEM_DEFINITIONS).length + Object.keys(WEAPON_DEFINITIONS).length);
    expect(new Set(entries.map((entry) => entry.id)).size).toBe(entries.length);
    expect(entries.filter((entry) => entry.kind === "item")).toHaveLength(Object.keys(ITEM_DEFINITIONS).length);
    expect(entries.filter((entry) => entry.kind === "weapon")).toHaveLength(Object.keys(WEAPON_DEFINITIONS).length);
  });

  it("filters the prebuilt entry list by Korean search text and category", () => {
    const entries = createCompendiumEntries();
    expect(filterCompendiumEntries(entries, "권총", "all").map((entry) => entry.id)).toContain("weapon:pistol");
    expect(filterCompendiumEntries(entries, "", "ammo").every((entry) => entry.category === "ammo")).toBe(true);
  });

  it("returns from the compendium to pause before resuming",()=>{expect(pauseEscapeAction("compendium")).toBe("back");expect(pauseEscapeAction("main")).toBe("resume");});

  it("rechecks developer mode, inventory capacity, unlock duplication, and quest sync", () => {
    const entries = createCompendiumEntries();
    const add = vi.fn(() => 5); const unlockWeapon = vi.fn(); const syncObjectives = vi.fn();
    const access = { developerMode: false, canAdd: vi.fn(() => true), add, hasWeapon: vi.fn(() => false), unlockWeapon, syncObjectives };
    expect(grantCompendiumEntry(entries.find((entry) => entry.id === "item:wood")!, access).reason).toBe("developer-mode-off");
    access.developerMode = true;
    expect(grantCompendiumEntry(entries.find((entry) => entry.id === "item:wood")!, access)).toMatchObject({ success: true, amount: 5 });
    expect(syncObjectives).toHaveBeenCalledOnce();
    add.mockReturnValue(20); access.canAdd.mockReturnValue(true);
    expect(grantCompendiumEntry(entries.find((entry) => entry.id === "item:pistol_ammo")!, access).amount).toBe(20);
    access.canAdd.mockReturnValue(false);
    expect(grantCompendiumEntry(entries.find((entry) => entry.id === "item:wood")!, access).reason).toBe("inventory-full");
    access.hasWeapon.mockReturnValue(true);
    expect(grantCompendiumEntry(entries.find((entry) => entry.id === "weapon:pistol")!, access).reason).toBe("already-unlocked");
    expect(unlockWeapon).not.toHaveBeenCalled();
    access.hasWeapon.mockReturnValue(false); access.canAdd.mockReturnValue(true); add.mockReturnValue(1); expect(grantCompendiumEntry(entries.find((entry) => entry.id === "weapon:pistol")!, access).success).toBe(true); expect(add).toHaveBeenCalledWith("pistol", 1); expect(unlockWeapon).toHaveBeenCalledWith("pistol");
  });
});
