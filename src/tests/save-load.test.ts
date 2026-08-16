import { describe, expect, it } from "vitest";
import { FOG_CELL_SIZE, MAP_ID, MAP_VERSION, SAVE_VERSION } from "../config/game-config";
import type { SaveGame } from "../core/save-state";
import { decodeExploredFog, encodeExploredFog, FOG_TOTAL_CELLS, isValidExploredFog } from "../systems/fog-save-codec";
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
    mapId: MAP_ID,
    mapVersion: MAP_VERSION,
    mapSeed: 99,
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
    consumedZombieSpawnIds: [],
    zombies: [],
    exploredFog: { cellSize: FOG_CELL_SIZE, encoding: "rle-v1", runs: [1, 2, 50, 1] },
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
    expect(loaded?.exploredFog).toEqual({ cellSize: 3, encoding: "rle-v1", runs: [1, 2, 50, 1] });
  });

  it("resets an incompatible 48x48 map save and emits a one-shot notice", () => {
    const storage = new MemoryStorage();
    const saves = new SaveSystem(storage, "test");
    storage.setItem("test", JSON.stringify({ ...saveFixture(), version: 2, mapId: undefined, mapVersion: undefined }));
    expect(saves.hasSave()).toBe(true);
    expect(saves.load()).toBeNull();
    expect(saves.consumeIncompatibleMapReset()).toBe(true);
    expect(saves.consumeIncompatibleMapReset()).toBe(false);
    expect(saves.hasSave()).toBe(false);
  });

  it("round-trips empty and fully explored fog with RLE", () => {
    const empty = new Uint8Array(FOG_TOTAL_CELLS);
    const emptyEncoded = encodeExploredFog(empty);
    expect(emptyEncoded.runs).toEqual([]);
    const full = new Uint8Array(FOG_TOTAL_CELLS).fill(1);
    const fullEncoded = encodeExploredFog(full);
    expect(fullEncoded.runs).toEqual([0, FOG_TOTAL_CELLS]);
    const decoded = new Uint8Array(FOG_TOTAL_CELLS);
    expect(decodeExploredFog(fullEncoded, decoded)).toBe(true);
    expect(decoded.every((value) => value === 1)).toBe(true);
  });

  it("rejects malformed RLE without discarding the rest of the save", () => {
    const storage = new MemoryStorage();
    const saves = new SaveSystem(storage, "test");
    const malformed = { cellSize: FOG_CELL_SIZE, encoding: "rle-v1", runs: [0, 5, 4, 2] };
    expect(isValidExploredFog(malformed)).toBe(false);
    storage.setItem("test", JSON.stringify({ ...saveFixture(), player: { ...saveFixture().player, health: 73 }, exploredFog: malformed }));
    const loaded = saves.load();
    expect(loaded?.player.health).toBe(73);
    expect(loaded?.exploredFog.runs).toEqual([]);
  });

  it("resets a mismatched map id instead of loading invalid coordinates", () => {
    const storage = new MemoryStorage();
    const saves = new SaveSystem(storage, "test");
    storage.setItem("test", JSON.stringify({ ...saveFixture(), mapId: "old-city" }));
    expect(saves.load()).toBeNull();
    expect(saves.consumeIncompatibleMapReset()).toBe(true);
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
