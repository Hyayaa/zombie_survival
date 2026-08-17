import { MAP_ID, MAP_VERSION, SAVE_VERSION, TILE_SIZE } from "../config/game-config";
import type { SaveGame } from "../core/save-state";
import { ITEM_DEFINITIONS } from "../data/item-definitions";
import { createCityBlockMap } from "../data/map-definitions";
import { emptyFogExploration, isValidExploredFog } from "./fog-save-codec";
import { createWeaponMagazines } from "./weapon-system";
import { GameClock } from "../core/game-clock";
import { createSurvivalNeeds } from "./survival-needs-system";
import type { GridInventorySnapshot, InventorySlot } from "./inventory-system";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class SaveSystem {
  private incompatibleMapReset = false;
  constructor(private readonly storage: StorageLike, private readonly key: string) {}

  save(data: SaveGame): boolean {
    try {
      const exploredFog = isValidExploredFog(data.exploredFog) ? data.exploredFog : emptyFogExploration();
      const player = { ...data.player, survivalNeeds: createSurvivalNeeds(data.player.survivalNeeds) };
      this.storage.setItem(this.key, JSON.stringify({ ...data, player, exploredFog, version: SAVE_VERSION, savedAt: Date.now() }));
      return true;
    } catch {
      return false;
    }
  }

  load(): SaveGame | null {
    try {
      const raw = this.storage.getItem(this.key);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as SaveCandidate;
      if (parsed.mapId !== MAP_ID || parsed.mapVersion !== MAP_VERSION) {
        this.storage.removeItem(this.key);
        this.incompatibleMapReset = true;
        return null;
      }
      if (parsed.version === 3) return this.migrateV3(parsed);
      if (parsed.version === 4) return this.migrateV4(parsed);
      if (parsed.version === 5) return this.migrateV5(parsed);
      if (parsed.version === 6) return this.migrateV6(parsed);
      if (parsed.version === 7) return this.migrateV7(parsed);
      if (parsed.version !== SAVE_VERSION) {
        this.storage.removeItem(this.key);
        this.incompatibleMapReset = true;
        return null;
      }
      if (!this.isValidBase(parsed, SAVE_VERSION) || !this.hasValidObstacleState(parsed) || !this.hasValidCompanions(parsed) || !this.hasValidStructures(parsed) || !this.hasValidSurvivalState(parsed)) return null;
      const exploredFog = isValidExploredFog(parsed.exploredFog) ? parsed.exploredFog : emptyFogExploration();
      return { ...parsed, player: { ...parsed.player!, survivalNeeds: createSurvivalNeeds(parsed.player!.survivalNeeds) }, version: SAVE_VERSION, exploredFog } as SaveGame;
    } catch {
      return null;
    }
  }

  hasSave(): boolean {
    try {
      const raw = this.storage.getItem(this.key);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as { version?: unknown };
      return typeof parsed.version === "number";
    } catch {
      return false;
    }
  }

  consumeIncompatibleMapReset(): boolean {
    const value = this.incompatibleMapReset;
    this.incompatibleMapReset = false;
    return value;
  }

  clear(): void {
    this.storage.removeItem(this.key);
  }

  private migrateV3(value: SaveCandidate): SaveGame | null {
    if (!this.isValidBase(value, 3) || typeof value.mapSeed !== "number") return null;
    const openedDoors = new Set(value.openedDoors);
    const map = createCityBlockMap(value.mapSeed);
    const exploredFog = isValidExploredFog(value.exploredFog) ? value.exploredFog : emptyFogExploration();
    const v4 = {
      ...value,
      version: 4,
      exploredFog,
      doorStates: map.doors.map((door) => ({
        id: door.id,
        open: openedDoors.has(door.id),
        health: door.maxHealth,
        destroyed: false,
      })),
      barricades: [],
    } as SaveCandidate;
    return this.migrateV4(v4);
  }

  private migrateV4(value: SaveCandidate): SaveGame | null {
    if (!this.isValidBase(value, 4) || !this.hasValidObstacleState(value) || typeof value.mapSeed !== "number") return null;
    const legacy = value.companion;
    if (!legacy) return null;
    const map = createCityBlockMap(value.mapSeed);
    const companions = map.companionSpawns.map((spawn, index) => index === 0 ? {
      id: spawn.id,
      x: legacy.x!, y: legacy.y!, health: legacy.health!,
      rescued: legacy.rescued!, alive: legacy.alive!, command: legacy.command!,
      targetX: legacy.targetX, targetY: legacy.targetY, focusTargetId: legacy.focusTargetId,
    } : {
      id: spawn.id,
      x: spawn.tileX * TILE_SIZE + TILE_SIZE / 2, y: spawn.tileY * TILE_SIZE + TILE_SIZE / 2, health: 80,
      rescued: false, alive: true, command: "follow" as const,
    });
    const exploredFog = isValidExploredFog(value.exploredFog) ? value.exploredFog : emptyFogExploration();
    const v5 = { ...value, version: 5, companions, companion: undefined, exploredFog } as SaveCandidate;
    return this.migrateV5(v5);
  }

  private migrateV5(value: SaveCandidate): SaveGame | null {
    if (!this.isValidBase(value, 5) || !this.hasValidObstacleState(value) || !this.hasValidCompanions(value)) return null;
    const legacyInventory = Array.isArray(value.inventory) ? value.inventory : [];
    const inventory = legacyInventory.map((slot) => slot?.itemId === "ammo" ? { ...slot, itemId: "pistol_ammo" } : slot);
    const quickslots = value.quickslots!.map((itemId) => itemId === "ammo" ? "pistol_ammo" : itemId);
    const v6 = {
      ...value,
      version: 6,
      player: { ...value.player!, magazines: createWeaponMagazines({ pistol: value.player!.magazine ?? 0 }), magazine: undefined },
      inventory,
      quickslots,
      structures: [],
    } as SaveCandidate;
    return this.migrateV6(v6);
  }

  private migrateV6(value: SaveCandidate): SaveGame | null {
    if (!this.isValidBase(value, 6) || !this.hasValidObstacleState(value) || !this.hasValidCompanions(value) || !this.hasValidStructures(value)) return null;
    const clock = new GameClock();
    clock.restore({ elapsedSeconds: value.clock!.elapsedSeconds!, dayNumber: 1 });
    const migrated = {
      ...value,
      version: SAVE_VERSION,
      player: { ...value.player!, survivalNeeds: createSurvivalNeeds() },
      clock: clock.snapshot(),
    } as SaveGame;
    this.save(migrated);
    return migrated;
  }

  private migrateV7(value: SaveCandidate): SaveGame | null {
    if (!this.isValidBase(value, 7) || !this.hasValidObstacleState(value) || !this.hasValidCompanions(value)
      || !this.hasValidStructures(value) || !this.hasValidSurvivalState(value)) return null;
    const migrated = { ...value, version: SAVE_VERSION } as SaveGame;
    this.save(migrated);
    return migrated;
  }

  private isValidBase(value: SaveCandidate, version: number): boolean {
    return value.version === version
      && value.mapId === MAP_ID
      && value.mapVersion === MAP_VERSION
      && typeof value.mapSeed === "number"
      && typeof value.seed === "number"
      && typeof value.rngState === "number"
      && typeof value.savedAt === "number"
      && typeof value.player?.x === "number"
      && typeof value.player?.y === "number"
      && typeof value.player?.health === "number"
      && typeof value.player?.infection === "number"
      && typeof value.player?.equippedWeapon === "string"
      && Array.isArray(value.player?.unlockedWeapons)
      && (version >= 6
        ? value.player?.magazines !== undefined && ["pistol", "smg", "shotgun", "hunting_rifle"].every((id) => typeof value.player?.magazines?.[id as keyof typeof value.player.magazines] === "number")
        : typeof value.player?.magazine === "number")
      && typeof value.player?.flashlightCharge === "number"
      && typeof value.player?.flashlightOn === "boolean"
      && typeof value.player?.torchRemaining === "number"
      && this.hasValidInventory(value.inventory, version)
      && Array.isArray(value.quickslots)
      && value.quickslots.every((itemId) => itemId === null || (typeof itemId === "string" && ITEM_DEFINITIONS[itemId] !== undefined))
      && Array.isArray(value.zombies)
      && typeof value.clock?.elapsedSeconds === "number"
      && (version < 7 || typeof value.clock?.dayNumber === "number")
      && (version >= 5 ? Array.isArray(value.companions) : (
        typeof value.companion?.x === "number"
        && typeof value.companion?.y === "number"
        && typeof value.companion?.health === "number"
        && typeof value.companion?.rescued === "boolean"
        && typeof value.companion?.alive === "boolean"
        && typeof value.companion?.command === "string"
      ))
      && Array.isArray(value.collectedParts)
      && Array.isArray(value.searchedContainers)
      && Array.isArray(value.openedDoors)
      && Array.isArray(value.consumedZombieSpawnIds)
      && typeof value.extraction?.active === "boolean"
      && typeof value.extraction?.remainingSeconds === "number";
  }

  private hasValidInventory(value: unknown, version: number): boolean {
    if (Array.isArray(value)) return value.every((slot: InventorySlot | null) => slot === null
      || (typeof slot?.itemId === "string" && ITEM_DEFINITIONS[slot.itemId] !== undefined && typeof slot.quantity === "number" && slot.quantity > 0));
    if (version < 8 || !value || typeof value !== "object") return false;
    const snapshot = value as Partial<GridInventorySnapshot>;
    return snapshot.version === 2 && typeof snapshot.nextInstanceId === "number" && Array.isArray(snapshot.items)
      && snapshot.items.every((item) => item && typeof item.instanceId === "string" && typeof item.itemId === "string"
        && ITEM_DEFINITIONS[item.itemId] !== undefined && typeof item.quantity === "number" && item.quantity > 0
        && (typeof item.containerId === "string" || item.containerId === null)
        && [item.x, item.y, item.width, item.height].every((coordinate) => typeof coordinate === "number"))
      && !!snapshot.equipment && typeof snapshot.equipment === "object";
  }

  private hasValidObstacleState(value: SaveCandidate): boolean {
    return Array.isArray(value.doorStates)
      && value.doorStates.every((door) => typeof door?.id === "string" && typeof door.open === "boolean"
        && typeof door.health === "number" && typeof door.destroyed === "boolean")
      && Array.isArray(value.barricades)
      && value.barricades.every((barricade) => typeof barricade?.id === "string"
        && typeof barricade.tileX === "number" && typeof barricade.tileY === "number"
        && typeof barricade.health === "number" && typeof barricade.maxHealth === "number");
  }

  private hasValidCompanions(value: SaveCandidate): boolean {
    if (!Array.isArray(value.companions) || value.companions.length !== 4) return false;
    const ids = new Set<string>();
    for (const companion of value.companions) {
      if (!companion || typeof companion.id !== "string" || ids.has(companion.id)
        || typeof companion.x !== "number" || typeof companion.y !== "number"
        || typeof companion.health !== "number" || typeof companion.rescued !== "boolean"
        || typeof companion.alive !== "boolean" || typeof companion.command !== "string") return false;
      ids.add(companion.id);
    }
    return true;
  }

  private hasValidStructures(value: SaveCandidate): boolean {
    return Array.isArray(value.structures) && value.structures.every((state) => state && typeof state.id === "string"
      && ["turret", "solar-generator", "fuel-generator", "battery-bank"].includes(state.kind)
      && typeof state.tileX === "number" && typeof state.tileY === "number" && typeof state.storedEnergy === "number"
      && (state.fuelSeconds === undefined || typeof state.fuelSeconds === "number"));
  }

  private hasValidSurvivalState(value: SaveCandidate): boolean {
    const needs = value.player?.survivalNeeds;
    return needs !== undefined
      && typeof needs.hunger === "number" && Number.isFinite(needs.hunger)
      && typeof needs.thirst === "number" && Number.isFinite(needs.thirst)
      && typeof needs.stamina === "number" && Number.isFinite(needs.stamina);
  }
}

type SaveCandidate = Omit<Partial<SaveGame>, "exploredFog"> & {
  exploredFog?: unknown;
};
