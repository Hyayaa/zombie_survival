import { describe, expect, it } from "vitest";
import { FOG_CELL_SIZE, MAP_ID, MAP_VERSION, SAVE_VERSION } from "../config/game-config";
import type { SaveGame } from "../core/save-state";
import { createCityBlockMap } from "../data/map-definitions";
import { decodeExploredFog, encodeExploredFog, FOG_TOTAL_CELLS, isValidExploredFog } from "../systems/fog-save-codec";
import { SaveSystem, type StorageLike } from "../systems/save-system";
import { InventorySystem } from "../systems/inventory-system";
import { createPlacedSegment, createPlacedStructure } from "../entities/placed-structure";
import { WorldStorageContainer } from "../systems/world-storage-container";

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
    player: { x: 12, y: 24, health: 81, infection: 13, equippedWeapon: "knife", unlockedWeapons: ["knife"], magazines: { pistol: 3, smg: 7, shotgun: 2, hunting_rifle: 1 }, flashlightCharge: 100, flashlightOn: false, torchRemaining: 0, survivalNeeds: { hunger: 74, thirst: 63, stamina: 52 } },
    clock: { elapsedSeconds: 52, dayNumber: 1 },
    inventory: [{ itemId: "cloth", quantity: 2 }, null],
    quickslots: ["bandage", null, null, null, null],
    companions: [0, 1, 2, 3].map((index) => ({ id: `companion-${index}`, x: 30 + index * 4, y: 40 + index * 4, health: 80, rescued: index === 0, alive: true, command: "follow" as const })),
    collectedParts: [],
    searchedContainers: ["drawer-1"],
    openedDoors: [],
    doorStates: [],
    barricades: [],
    structures: [],
    consumedZombieSpawnIds: [],
    zombies: [],
    exploredFog: { cellSize: FOG_CELL_SIZE, encoding: "rle-v1", runs: [1, 2, 50, 1] },
    extraction: { active: false, remainingSeconds: 45 },
  };
}

describe("SaveSystem", () => {
  it("round-trips segment geometry, door state, health, crate storage and structure counter", () => {
    const storage=new MemoryStorage(),saves=new SaveSystem(storage,"structures-v9"),fixture=saveFixture();
    const wall=createPlacedSegment("wall-7","metal-wall",24,48,48,72,7);wall.health=411;
    const door=createPlacedSegment("door-8","wood-door",48,72,72,72,8,-1);door.doorOpen=true;
    const crate=createPlacedStructure("crate-9","wood-crate",4,5,0,9);const contents=new WorldStorageContainer("structure:crate-9:storage");contents.add("wood",4,0,0);crate.storage=contents.snapshot();
    fixture.structures=[wall,door,crate].map(({powered:_powered,...state})=>state);fixture.nextStructureId=12;
    expect(saves.save(fixture)).toBe(true);const loaded=saves.load();expect(loaded?.structures).toEqual(fixture.structures);expect(loaded?.nextStructureId).toBe(12);
  });
  it("restores player, inventory and explored fog", () => {
    const storage = new MemoryStorage();
    const saves = new SaveSystem(storage, "test");
    expect(saves.save(saveFixture())).toBe(true);
    const loaded = saves.load();
    expect(loaded?.player).toMatchObject({ x: 12, health: 81, infection: 13 });
    expect(Array.isArray(loaded?.inventory) ? loaded.inventory[0] : null).toEqual({ itemId: "cloth", quantity: 2 });
    expect(loaded?.exploredFog).toEqual({ cellSize: 3, encoding: "rle-v1", runs: [1, 2, 50, 1] });
  });

  it("preserves optional relative zombie posture timers without adding a player melee action", () => {
    const storage = new MemoryStorage();
    const saves = new SaveSystem(storage, "posture");
    const fixture = saveFixture();
    fixture.zombies = [{ id: "walker-1", kind: "walker", state: "Stagger", x: 40, y: 50, health: 60, postureValue: 25, postureRecoveryRemainingMs: 900, postureStaggerRemainingMs: 420, postureBreakImmunityRemainingMs: 360 }];
    expect(saves.save(fixture)).toBe(true);
    const loaded = saves.load();
    expect(loaded?.zombies[0]).toMatchObject({ postureValue: 25, postureRecoveryRemainingMs: 900, postureStaggerRemainingMs: 420, postureBreakImmunityRemainingMs: 360 });
    expect(loaded?.player).not.toHaveProperty("meleeAction");
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

  it("migrates v3 door state without resetting player, fog or inventory", () => {
    const storage = new MemoryStorage();
    const saves = new SaveSystem(storage, "test");
    const fixture = saveFixture();
    const { id: _id, ...legacyCompanion } = fixture.companions[0]!;
    const legacy = { ...fixture, version: 3, companion: legacyCompanion, player: { ...fixture.player, health: 67, magazine: 5 }, openedDoors: ["door-building-00"] } as Record<string, unknown>;
    delete (legacy.player as Record<string, unknown>).magazines;
    delete legacy.companions;
    delete legacy.doorStates;
    delete legacy.barricades;
    storage.setItem("test", JSON.stringify(legacy));
    const loaded = saves.load();
    expect(loaded?.version).toBe(SAVE_VERSION);
    expect(loaded?.player.health).toBe(67);
    expect(loaded?.inventory).toEqual(fixture.inventory);
    expect(loaded?.exploredFog).toEqual(fixture.exploredFog);
    expect(loaded?.doorStates).toHaveLength(createCityBlockMap(99).doors.length);
    expect(loaded?.doorStates.find((door) => door.id === "door-building-00")).toMatchObject({ open: true, health: 48, destroyed: false });
    expect(loaded?.doorStates.find((door) => door.id !== "door-building-00")?.open).toBe(false);
    expect(loaded?.barricades).toEqual([]);
    expect(loaded?.companions).toHaveLength(4);
    expect(loaded?.companions[0]).toMatchObject({ id: "companion-0", health: 80, rescued: true });
    expect(loaded?.player.magazines.pistol).toBe(5);
    expect(loaded?.structures).toEqual([]);
    expect(saves.consumeIncompatibleMapReset()).toBe(false);
  });

  it("migrates a v4 single companion while preserving obstacle state", () => {
    const storage = new MemoryStorage();
    const saves = new SaveSystem(storage, "test");
    const current = saveFixture();
    const { id: _id, ...legacyCompanion } = current.companions[0]!;
    const fixture = {
      ...current,
      version: 4,
      companions: undefined,
      companion: { ...legacyCompanion, health: 63, targetX: 88, targetY: 92 },
      player: { ...current.player, magazine: 4, magazines: undefined },
      doorStates: [{ id: "door-building-00", open: false, health: 17, destroyed: false }],
      barricades: [{ id: "b-1", tileX: 10, tileY: 11, health: 31, maxHealth: 96 }],
    };
    storage.setItem("test", JSON.stringify(fixture));
    const loaded = saves.load();
    expect(loaded?.version).toBe(SAVE_VERSION);
    expect(loaded?.companions[0]).toMatchObject({ id: "companion-0", health: 63, targetX: 88, targetY: 92 });
    expect(loaded?.companions.slice(1).every((companion) => !companion.rescued && companion.health === 80)).toBe(true);
    expect(loaded?.doorStates[0]?.health).toBe(17);
    expect(loaded?.barricades[0]).toMatchObject({ id: "b-1", health: 31, maxHealth: 96 });
    expect(loaded?.structures).toEqual([]);
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

  it("migrates the v5 single magazine and legacy ammo into pistol state with no structures", () => {
    const storage = new MemoryStorage(); const saves = new SaveSystem(storage, "test");
    const current = saveFixture();
    const legacy = { ...current, version: 5, structures: undefined, player: { ...current.player, magazines: undefined, magazine: 6 }, inventory: [{ itemId: "ammo", quantity: 9 }], quickslots: ["ammo", null, null, null, null] };
    storage.setItem("test", JSON.stringify(legacy)); const loaded = saves.load();
    expect(loaded?.version).toBe(SAVE_VERSION);
    expect(loaded?.player.magazines).toEqual({ pistol: 6, smg: 0, shotgun: 0, hunting_rifle: 0 });
    expect(Array.isArray(loaded?.inventory) ? loaded.inventory[0] : null).toEqual({ itemId: "pistol_ammo", quantity: 9 });
    expect(loaded?.quickslots[0]).toBe("pistol_ammo"); expect(loaded?.structures).toEqual([]);
  });

  it("round-trips four structures, energy, fuel and independent magazines without derived topology", () => {
    const storage = new MemoryStorage(); const saves = new SaveSystem(storage, "test");
    const fixture = saveFixture();
    fixture.player.unlockedWeapons = ["knife", "pistol", "smg", "shotgun", "hunting_rifle"];
    fixture.structures = [
      { id: "t", kind: "turret", tileX: 1, tileY: 1, storedEnergy: 0, aimAngle: 1 },
      { id: "s", kind: "solar-generator", tileX: 2, tileY: 1, storedEnergy: 30 },
      { id: "f", kind: "fuel-generator", tileX: 3, tileY: 1, storedEnergy: 40, fuelSeconds: 122 },
      { id: "b", kind: "battery-bank", tileX: 4, tileY: 1, storedEnergy: 120 },
    ];
    saves.save(fixture); const loaded = saves.load();
    expect(loaded?.structures).toEqual(fixture.structures);
    expect(loaded?.player.magazines).toEqual(fixture.player.magazines);
    expect(JSON.stringify(loaded)).not.toContain("powerEdges");
  });

  it("round-trips survival needs and day number", () => {
    const storage = new MemoryStorage(); const saves = new SaveSystem(storage, "test");
    const fixture = saveFixture(); fixture.clock = { elapsedSeconds: 2_100, dayNumber: 3 };
    fixture.player.survivalNeeds = { hunger: 41, thirst: 32, stamina: 18 };
    expect(saves.save(fixture)).toBe(true);
    expect(saves.load()).toMatchObject({ clock: { elapsedSeconds: 2_100, dayNumber: 3 }, player: { survivalNeeds: { hunger: 41, thirst: 32, stamina: 18 } } });
  });

  it("round-trips the versioned grid inventory snapshot", () => {
    const storage = new MemoryStorage(); const saves = new SaveSystem(storage, "test");
    const fixture = saveFixture(); const inventory = new InventorySystem();
    inventory.add("water", 2); inventory.add("utility_belt", 1);
    inventory.add("knife", 1); inventory.add("pistol", 1);
    const knife = inventory.getStoredItems().find((item) => item.itemId === "knife")!; const pistol = inventory.getStoredItems().find((item) => item.itemId === "pistol")!;
    inventory.equipWeapon(knife.instanceId, "primary"); inventory.equipWeapon(pistol.instanceId, "secondary"); inventory.setActiveWeaponSlot("secondary");
    fixture.inventory = inventory.snapshot();
    expect(saves.save(fixture)).toBe(true);
    expect(saves.load()?.inventory).toEqual(fixture.inventory);
  });

  it("migrates v6 survival needs and day number without changing existing player state", () => {
    const storage = new MemoryStorage(); const saves = new SaveSystem(storage, "test");
    const fixture = saveFixture();
    const legacy = { ...fixture, version: 6, player: { ...fixture.player, survivalNeeds: undefined }, clock: { elapsedSeconds: 52 } };
    storage.setItem("test", JSON.stringify(legacy));
    const loaded = saves.load();
    expect(loaded?.player).toMatchObject({ health: 81, infection: 13, survivalNeeds: { hunger: 100, thirst: 100, stamina: 100 } });
    expect(loaded?.clock.dayNumber).toBe(1);
  });
});
