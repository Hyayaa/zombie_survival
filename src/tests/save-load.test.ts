import { describe, expect, it } from "vitest";
import { FOG_CELL_SIZE, SAVE_VERSION } from "../config/game-config";
import type { SaveGame } from "../core/save-state";
import { decodeExploredFog, encodeExploredFog, FOG_TOTAL_CELLS, FOG_WIDTH_CELLS, isValidExploredFog } from "../systems/fog-save-codec";
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

  it("migrates v1 192x192 explored cells into 2x2 v2 cells", () => {
    const storage = new MemoryStorage();
    const saves = new SaveSystem(storage, "test");
    const legacy = { ...saveFixture(), version: 1, exploredFog: [0, 1, 192 + 3] };
    storage.setItem("test", JSON.stringify(legacy));
    const loaded = saves.load();
    expect(loaded?.version).toBe(2);
    const explored = new Uint8Array(FOG_TOTAL_CELLS);
    expect(loaded && decodeExploredFog(loaded.exploredFog, explored)).toBe(true);
    for (const [x, y] of [[0, 0], [1, 0], [0, 1], [1, 1], [2, 0], [3, 1], [6, 2], [7, 3]]) {
      expect(explored[y * FOG_WIDTH_CELLS + x]).toBe(1);
    }
  });

  it("preserves the legacy map-edge cell during migration", () => {
    const storage = new MemoryStorage();
    const saves = new SaveSystem(storage, "test");
    storage.setItem("test", JSON.stringify({ ...saveFixture(), version: 1, exploredFog: [192 * 192 - 1] }));
    const loaded = saves.load();
    const explored = new Uint8Array(FOG_TOTAL_CELLS);
    expect(loaded && decodeExploredFog(loaded.exploredFog, explored)).toBe(true);
    expect(explored[382 * FOG_WIDTH_CELLS + 382]).toBe(1);
    expect(explored[383 * FOG_WIDTH_CELLS + 383]).toBe(1);
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

  it("resets only malformed legacy fog data", () => {
    const storage = new MemoryStorage();
    const saves = new SaveSystem(storage, "test");
    storage.setItem("test", JSON.stringify({ ...saveFixture(), version: 1, seed: 77, exploredFog: [192 * 192] }));
    const loaded = saves.load();
    expect(loaded?.seed).toBe(77);
    expect(loaded?.exploredFog.runs).toEqual([]);
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
