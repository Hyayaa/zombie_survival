import { describe, expect, it } from "vitest";
import { SAVE_VERSION } from "../config/game-config";
import type { SaveGame } from "../core/save-state";
import { SaveSystem, type StorageLike } from "../systems/save-system";

class MemoryStorage implements StorageLike {
  private data = new Map<string, string>();
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  setItem(key: string, value: string): void { this.data.set(key, value); }
  removeItem(key: string): void { this.data.delete(key); }
}

function saveFixture(): SaveGame {
  return {
    version: SAVE_VERSION,
    seed: 42,
    rngState: 42,
    savedAt: 1,
    player: { x: 12, y: 24, health: 81, infection: 13, equippedWeapon: "knife", unlockedWeapons: ["knife"], magazine: 0, flashlightCharge: 100, flashlightOn: false, torchRemaining: 0 },
    clock: { elapsedSeconds: 52 },
    inventory: [{ itemId: "cloth", quantity: 2 }, null],
    quickslots: ["bandage", null, null, null, null],
    companion: { x: 30, y: 40, health: 80, rescued: false, alive: true, command: "follow" },
    collectedParts: [],
    searchedContainers: ["drawer-1"],
    openedDoors: [],
    zombies: [],
    exploredFog: [1, 2, 50],
    extraction: { active: false, remainingSeconds: 45 },
  };
}

describe("SaveSystem", () => {
  it("restores player, inventory and explored fog", () => {
    const storage = new MemoryStorage();
    const saves = new SaveSystem(storage, "test");
    expect(saves.save(saveFixture())).toBe(true);
    const loaded = saves.load();
    expect(loaded?.player).toMatchObject({ x: 12, health: 81, infection: 13 });
    expect(loaded?.inventory[0]).toEqual({ itemId: "cloth", quantity: 2 });
    expect(loaded?.exploredFog).toEqual([1, 2, 50]);
  });

  it("returns null for corrupt or incompatible data", () => {
    const storage = new MemoryStorage();
    const saves = new SaveSystem(storage, "test");
    storage.setItem("test", "not-json");
    expect(saves.load()).toBeNull();
    storage.setItem("test", JSON.stringify({ version: 999 }));
    expect(saves.load()).toBeNull();
  });
});

