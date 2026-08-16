import { MAP_ID, MAP_VERSION, SAVE_VERSION } from "../config/game-config";
import type { SaveGame } from "../core/save-state";
import { ITEM_DEFINITIONS } from "../data/item-definitions";
import { emptyFogExploration, isValidExploredFog } from "./fog-save-codec";

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
      this.storage.setItem(this.key, JSON.stringify({ ...data, exploredFog, version: SAVE_VERSION, savedAt: Date.now() }));
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
      if (parsed.version !== SAVE_VERSION || parsed.mapId !== MAP_ID || parsed.mapVersion !== MAP_VERSION) {
        this.storage.removeItem(this.key);
        this.incompatibleMapReset = true;
        return null;
      }
      if (!this.isValidBase(parsed)) return null;
      const exploredFog = isValidExploredFog(parsed.exploredFog) ? parsed.exploredFog : emptyFogExploration();
      return { ...parsed, version: SAVE_VERSION, exploredFog } as SaveGame;
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

  private isValidBase(value: SaveCandidate): boolean {
    return value.version === SAVE_VERSION
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
      && typeof value.player?.magazine === "number"
      && typeof value.player?.flashlightCharge === "number"
      && typeof value.player?.flashlightOn === "boolean"
      && typeof value.player?.torchRemaining === "number"
      && Array.isArray(value.inventory)
      && value.inventory.every((slot) => slot === null || (typeof slot?.itemId === "string" && ITEM_DEFINITIONS[slot.itemId] !== undefined && typeof slot.quantity === "number" && slot.quantity > 0))
      && Array.isArray(value.quickslots)
      && value.quickslots.every((itemId) => itemId === null || (typeof itemId === "string" && ITEM_DEFINITIONS[itemId] !== undefined))
      && Array.isArray(value.zombies)
      && typeof value.clock?.elapsedSeconds === "number"
      && typeof value.companion?.x === "number"
      && typeof value.companion?.y === "number"
      && typeof value.companion?.health === "number"
      && typeof value.companion?.rescued === "boolean"
      && typeof value.companion?.alive === "boolean"
      && typeof value.companion?.command === "string"
      && Array.isArray(value.collectedParts)
      && Array.isArray(value.searchedContainers)
      && Array.isArray(value.openedDoors)
      && Array.isArray(value.consumedZombieSpawnIds)
      && typeof value.extraction?.active === "boolean"
      && typeof value.extraction?.remainingSeconds === "number";
  }
}

type SaveCandidate = Omit<Partial<SaveGame>, "exploredFog"> & {
  exploredFog?: unknown;
};
