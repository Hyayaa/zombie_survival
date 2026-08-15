import { MAP_TILES, TILE_SIZE } from "../config/game-config";
import type { ZombieKind } from "./zombie-definitions";

export type CoverHeight = "none" | "low" | "full";

export interface WorldObstacle {
  id: string;
  tileX: number;
  tileY: number;
  widthTiles: number;
  heightTiles: number;
  blocksMovement: boolean;
  blocksVision: boolean;
  blocksProjectiles: boolean;
  coverHeight: CoverHeight;
  kind: "wall" | "furniture" | "vehicle" | "barricade";
}

export interface DoorDefinition {
  id: string;
  tileX: number;
  tileY: number;
  open: boolean;
}

export interface LootStack {
  itemId: string;
  quantity: number;
}

export interface ContainerDefinition {
  id: string;
  tileX: number;
  tileY: number;
  kind: "drawer" | "crate" | "shelf" | "trash" | "vehicle" | "corpse" | "pile";
  loot: LootStack[];
  equipment?: "bat" | "pistol";
  part?: "battery" | "fuel" | "engine_part";
}

export interface GroundItemDefinition extends LootStack {
  id: string;
  tileX: number;
  tileY: number;
}

export interface ZombieSpawnDefinition {
  id: string;
  tileX: number;
  tileY: number;
  kind: ZombieKind;
}

export interface StructureDefinition {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  floorColor: number;
}

export interface MapDefinition {
  widthTiles: number;
  heightTiles: number;
  structures: StructureDefinition[];
  roadTiles: Set<string>;
  floorTiles: Set<string>;
  obstacles: WorldObstacle[];
  doors: DoorDefinition[];
  containers: ContainerDefinition[];
  groundItems: GroundItemDefinition[];
  zombieSpawns: ZombieSpawnDefinition[];
  playerSpawn: { x: number; y: number };
  survivorSpawn: { x: number; y: number };
  extractionZone: { x: number; y: number; radius: number };
  safehouseZone: { x: number; y: number; width: number; height: number };
}

function key(x: number, y: number): string {
  return `${x},${y}`;
}

function tileCenter(tile: number): number {
  return tile * TILE_SIZE + TILE_SIZE / 2;
}

export function createCityBlockMap(): MapDefinition {
  const roadTiles = new Set<string>();
  const floorTiles = new Set<string>();
  const obstacles: WorldObstacle[] = [];
  const doors: DoorDefinition[] = [];
  const structures: StructureDefinition[] = [
    { id: "safehouse", name: "은신처", x: 2, y: 2, width: 12, height: 10, floorColor: 0x4c5148 },
    { id: "house-north", name: "북쪽 주택", x: 21, y: 3, width: 11, height: 10, floorColor: 0x514a42 },
    { id: "house-south", name: "남쪽 주택", x: 3, y: 22, width: 13, height: 11, floorColor: 0x4c4842 },
    { id: "store", name: "편의점", x: 21, y: 21, width: 14, height: 12, floorColor: 0x4b514c },
    { id: "warehouse", name: "창고", x: 36, y: 3, width: 10, height: 17, floorColor: 0x484d4c },
  ];

  for (let y = 15; y <= 19; y += 1) {
    for (let x = 0; x < MAP_TILES; x += 1) roadTiles.add(key(x, y));
  }
  for (let x = 16; x <= 19; x += 1) {
    for (let y = 0; y < MAP_TILES; y += 1) roadTiles.add(key(x, y));
  }
  for (let y = 35; y <= 39; y += 1) {
    for (let x = 16; x < MAP_TILES; x += 1) roadTiles.add(key(x, y));
  }

  const doorTiles = new Map<string, DoorDefinition>();
  const addDoor = (id: string, tileX: number, tileY: number): void => {
    const door = { id, tileX, tileY, open: false };
    doors.push(door);
    doorTiles.set(key(tileX, tileY), door);
  };
  addDoor("door-safehouse", 8, 11);
  addDoor("door-house-north", 26, 12);
  addDoor("door-house-south", 10, 22);
  addDoor("door-store", 27, 21);
  addDoor("door-store-back", 34, 27);
  addDoor("door-warehouse", 36, 14);

  for (const structure of structures) {
    for (let y = structure.y + 1; y < structure.y + structure.height - 1; y += 1) {
      for (let x = structure.x + 1; x < structure.x + structure.width - 1; x += 1) floorTiles.add(key(x, y));
    }
    for (let x = structure.x; x < structure.x + structure.width; x += 1) {
      for (const y of [structure.y, structure.y + structure.height - 1]) {
        if (!doorTiles.has(key(x, y))) obstacles.push(wall(`${structure.id}-${x}-${y}`, x, y));
      }
    }
    for (let y = structure.y + 1; y < structure.y + structure.height - 1; y += 1) {
      for (const x of [structure.x, structure.x + structure.width - 1]) {
        if (!doorTiles.has(key(x, y))) obstacles.push(wall(`${structure.id}-${x}-${y}`, x, y));
      }
    }
  }

  const furniture = (id: string, tileX: number, tileY: number, widthTiles = 1, heightTiles = 1): void => {
    obstacles.push({ id, tileX, tileY, widthTiles, heightTiles, blocksMovement: true, blocksVision: false, blocksProjectiles: false, coverHeight: "low", kind: "furniture" });
  };
  furniture("safe-bed", 4, 4, 2, 1);
  furniture("safe-table", 10, 7, 2, 1);
  furniture("north-sofa", 23, 7, 2, 1);
  furniture("north-table", 28, 9, 2, 1);
  furniture("south-bed", 5, 25, 2, 1);
  furniture("south-counter", 12, 28, 2, 1);
  furniture("store-shelf-a", 23, 24, 1, 5);
  furniture("store-shelf-b", 27, 24, 1, 5);
  furniture("store-counter", 31, 23, 2, 1);
  furniture("warehouse-pallet-a", 39, 6, 2, 2);
  furniture("warehouse-pallet-b", 42, 10, 2, 2);
  furniture("warehouse-pallet-c", 39, 16, 3, 1);

  obstacles.push(vehicle("car-west", 7, 16, 2, 1));
  obstacles.push(vehicle("car-cross", 17, 27, 1, 2));
  obstacles.push(vehicle("car-east", 29, 17, 2, 1));
  obstacles.push(vehicle("escape-vehicle", 40, 40, 2, 1));

  const containers: ContainerDefinition[] = [
    { id: "safe-drawer", tileX: 5, tileY: 8, kind: "drawer", loot: [{ itemId: "cloth", quantity: 2 }, { itemId: "canned_food", quantity: 1 }] },
    { id: "north-drawer", tileX: 29, tileY: 5, kind: "drawer", loot: [{ itemId: "medicine", quantity: 1 }, { itemId: "cloth", quantity: 2 }] },
    { id: "north-corpse", tileX: 24, tileY: 10, kind: "corpse", loot: [{ itemId: "ammo", quantity: 8 }], equipment: "pistol" },
    { id: "south-cabinet", tileX: 13, tileY: 25, kind: "drawer", loot: [{ itemId: "engine_part", quantity: 1 }, { itemId: "metal", quantity: 2 }], part: "engine_part" },
    { id: "south-closet", tileX: 6, tileY: 30, kind: "drawer", loot: [{ itemId: "water", quantity: 2 }, { itemId: "wood", quantity: 2 }] },
    { id: "store-food", tileX: 25, tileY: 27, kind: "shelf", loot: [{ itemId: "canned_food", quantity: 2 }, { itemId: "water", quantity: 2 }] },
    { id: "store-fuel", tileX: 32, tileY: 29, kind: "shelf", loot: [{ itemId: "fuel", quantity: 3 }, { itemId: "cloth", quantity: 1 }], part: "fuel" },
    { id: "store-trash", tileX: 33, tileY: 31, kind: "trash", loot: [{ itemId: "scrap_cache", quantity: 2 }, { itemId: "metal", quantity: 1 }] },
    { id: "warehouse-crate", tileX: 43, tileY: 17, kind: "crate", loot: [{ itemId: "battery", quantity: 1 }, { itemId: "metal", quantity: 3 }], equipment: "bat", part: "battery" },
    { id: "warehouse-pile", tileX: 38, tileY: 9, kind: "pile", loot: [{ itemId: "wood", quantity: 4 }, { itemId: "fuel", quantity: 1 }] },
    { id: "street-car", tileX: 8, tileY: 17, kind: "vehicle", loot: [{ itemId: "metal", quantity: 2 }, { itemId: "ammo", quantity: 4 }] },
    { id: "alley-trash", tileX: 20, tileY: 39, kind: "trash", loot: [{ itemId: "cloth", quantity: 1 }, { itemId: "water", quantity: 1 }] },
  ];

  const groundItems: GroundItemDefinition[] = [
    { id: "ground-wood", itemId: "wood", quantity: 1, tileX: 15, tileY: 13 },
    { id: "ground-bandage", itemId: "bandage", quantity: 1, tileX: 19, tileY: 23 },
    { id: "ground-ammo", itemId: "ammo", quantity: 3, tileX: 33, tileY: 15 },
  ];

  const spawnData: Array<[number, number, ZombieKind]> = [
    [14, 16, "walker"], [22, 17, "walker"], [27, 16, "runner"], [34, 18, "walker"],
    [18, 8, "walker"], [33, 7, "walker"], [45, 22, "runner"], [40, 24, "walker"],
    [18, 31, "walker"], [24, 38, "walker"], [30, 37, "runner"], [36, 35, "walker"],
    [8, 38, "walker"], [13, 43, "runner"], [42, 44, "walker"], [46, 33, "walker"],
    [4, 18, "walker"], [2, 41, "walker"], [31, 46, "walker"], [45, 10, "runner"],
  ];
  const zombieSpawns = spawnData.map(([tileX, tileY, kind], index) => ({ id: `zombie-${index}`, tileX, tileY, kind }));

  return {
    widthTiles: MAP_TILES,
    heightTiles: MAP_TILES,
    structures,
    roadTiles,
    floorTiles,
    obstacles,
    doors,
    containers,
    groundItems,
    zombieSpawns,
    playerSpawn: { x: tileCenter(7), y: tileCenter(7) },
    survivorSpawn: { x: tileCenter(8), y: tileCenter(28) },
    extractionZone: { x: tileCenter(41), y: tileCenter(42), radius: 46 },
    safehouseZone: { x: tileCenter(3), y: tileCenter(3), width: 10 * TILE_SIZE, height: 8 * TILE_SIZE },
  };
}

function wall(id: string, tileX: number, tileY: number): WorldObstacle {
  return { id, tileX, tileY, widthTiles: 1, heightTiles: 1, blocksMovement: true, blocksVision: true, blocksProjectiles: true, coverHeight: "full", kind: "wall" };
}

function vehicle(id: string, tileX: number, tileY: number, widthTiles: number, heightTiles: number): WorldObstacle {
  return { id, tileX, tileY, widthTiles, heightTiles, blocksMovement: true, blocksVision: true, blocksProjectiles: true, coverHeight: "full", kind: "vehicle" };
}

