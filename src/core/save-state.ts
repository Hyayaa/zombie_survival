import type { ClockSnapshot } from "./game-clock";
import type { InventorySlot } from "../systems/inventory-system";
import type { ZombieKind, ZombieStateName } from "../data/zombie-definitions";

export interface SavedActor {
  x: number;
  y: number;
  health: number;
}

export interface SavedZombie extends SavedActor {
  id: string;
  kind: ZombieKind;
  state: ZombieStateName;
}

export interface SavedCompanion extends SavedActor {
  rescued: boolean;
  alive: boolean;
  command: "follow" | "hold" | "move" | "focus";
  targetX?: number;
  targetY?: number;
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
    magazine: number;
    flashlightCharge: number;
    flashlightOn: boolean;
    torchRemaining: number;
  };
  clock: ClockSnapshot;
  inventory: Array<InventorySlot | null>;
  quickslots: Array<string | null>;
  companion: SavedCompanion;
  collectedParts: string[];
  searchedContainers: string[];
  openedDoors: string[];
  doorStates: SavedDoorState[];
  barricades: SavedBarricadeState[];
  consumedZombieSpawnIds: string[];
  zombies: SavedZombie[];
  exploredFog: SavedFogExploration;
  extraction: {
    active: boolean;
    remainingSeconds: number;
  };
}
