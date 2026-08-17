import type { ClockSnapshot } from "./game-clock";
import type { InventorySlot } from "../systems/inventory-system";
import type { ZombieKind, ZombieStateName } from "../data/zombie-definitions";
import type { SavedStructureState } from "../entities/placed-structure";
import type { WeaponMagazines } from "../systems/weapon-system";
import type { SurvivalNeeds } from "../systems/survival-needs-system";

export interface SavedActor {
  x: number;
  y: number;
  health: number;
}

export interface SavedZombie extends SavedActor {
  id: string;
  kind: ZombieKind;
  state: ZombieStateName;
  maxHealth?: number;
}

export interface SavedCompanion extends SavedActor {
  id: string;
  rescued: boolean;
  alive: boolean;
  command: "follow" | "hold" | "move" | "focus";
  targetX?: number;
  targetY?: number;
  focusTargetId?: string;
}

export interface SavedFogExploration {
  cellSize: number;
  encoding: "rle-v1";
  runs: number[];
}

export interface SavedDoorState {
  id: string;
  open: boolean;
  health: number;
  destroyed: boolean;
}

export interface SavedBarricadeState {
  id: string;
  tileX: number;
  tileY: number;
  health: number;
  maxHealth: number;
}

export interface SaveGame {
  version: number;
  mapId: string;
  mapVersion: number;
  mapSeed: number;
  seed: number;
  rngState: number;
  savedAt: number;
  player: SavedActor & {
    infection: number;
    equippedWeapon: string;
    unlockedWeapons: string[];
    magazines: WeaponMagazines;
    /** v5 migration input only. */
    magazine?: number;
    flashlightCharge: number;
    flashlightOn: boolean;
    torchRemaining: number;
    survivalNeeds: SurvivalNeeds;
  };
  clock: ClockSnapshot;
  inventory: Array<InventorySlot | null>;
  quickslots: Array<string | null>;
  companions: SavedCompanion[];
  /** v4 migration input only. */
  companion?: Omit<SavedCompanion, "id"> & { id?: string };
  collectedParts: string[];
  searchedContainers: string[];
  openedDoors: string[];
  doorStates: SavedDoorState[];
  barricades: SavedBarricadeState[];
  structures: SavedStructureState[];
  consumedZombieSpawnIds: string[];
  zombies: SavedZombie[];
  exploredFog: SavedFogExploration;
  extraction: {
    active: boolean;
    remainingSeconds: number;
  };
}
