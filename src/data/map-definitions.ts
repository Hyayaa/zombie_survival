import { MAP_HEIGHT_TILES, MAP_ID, MAP_VERSION, MAP_WIDTH_TILES, OBSTACLE_BALANCE, TILE_SIZE } from "../config/game-config";
import type { SegmentGeometry } from "../systems/collision-geometry";
import type { ZombieKind } from "./zombie-definitions";
import type { WeaponId } from "./weapon-definitions";

export enum TerrainType { Ground = 0, Road = 1, Sidewalk = 2, Floor = 3 }
export type RoadKind = "arterial" | "street" | "diagonal";

export interface RoadSegment {
  id: string; kind: RoadKind; startX: number; startY: number; endX: number; endY: number;
  widthTiles: number; sidewalkTiles: number; laneMarking: boolean;
}

export type BuildingOrientation = 0 | 45 | 90 | 135;
export type BuildingKind = "safehouse" | "house" | "store" | "warehouse" | "office" | "clinic" | "garage" | "gas-station" | "ruin";
export type DoorOrientation = "horizontal" | "vertical" | "diagonal-down" | "diagonal-up";
export type CoverHeight = "none" | "low" | "full";

export interface BuildingDefinition {
  id: string; name: string; kind: BuildingKind;
  centerTileX: number; centerTileY: number; widthTiles: number; depthTiles: number;
  orientation: BuildingOrientation; roadId: string; roadSide: -1 | 1;
  footprintTiles: number[]; floorTiles: number[]; wallTiles: number[]; entranceTiles: number[];
  wallSegments: SegmentGeometry[];
  floorColor: number;
}

export interface WorldObstacle {
  id: string; tileX: number; tileY: number; widthTiles: number; heightTiles: number;
  blocksMovement: boolean; blocksVision: boolean; blocksProjectiles: boolean;
  coverHeight: CoverHeight; kind: "wall" | "furniture" | "vehicle" | "barricade";
}

export interface DoorDefinition {
  kind: "door";
  id: string; buildingId?: string; tileX: number; tileY: number;
  orientation: DoorOrientation; open: boolean;
  segment?: SegmentGeometry;
  health: number; maxHealth: number; destroyed: boolean;
}

export interface LootStack { itemId: string; quantity: number }
export interface ContainerDefinition {
  id: string; tileX: number; tileY: number;
  kind: "drawer" | "crate" | "shelf" | "trash" | "vehicle" | "corpse" | "pile";
  loot: LootStack[]; equipment?: WeaponId; part?: "battery" | "fuel" | "engine_part";
}
export interface GroundItemDefinition extends LootStack { id: string; tileX: number; tileY: number }
export interface ZombieSpawnDefinition { id: string; tileX: number; tileY: number; kind: ZombieKind }
export interface CompanionSpawnDefinition { id: string; tileX: number; tileY: number }

export interface MapDefinition {
  mapId: string; mapVersion: number; mapSeed: number;
  widthTiles: number; heightTiles: number; terrain: Uint8Array;
  minimapWallCoverage: Uint8Array;
  roadSegments: RoadSegment[]; buildings: BuildingDefinition[]; structures: BuildingDefinition[];
  wallSegments: SegmentGeometry[];
  obstacles: WorldObstacle[]; doors: DoorDefinition[]; containers: ContainerDefinition[];
  groundItems: GroundItemDefinition[]; zombieSpawns: ZombieSpawnDefinition[];
  playerSpawn: { x: number; y: number }; companionSpawns: CompanionSpawnDefinition[];
  /** v4 map compatibility alias for companion-0. */
  survivorSpawn: { x: number; y: number };
  extractionZone: { x: number; y: number; radius: number };
  safehouseZone: { x: number; y: number; width: number; height: number };
}

const ROAD_SEGMENTS: RoadSegment[] = [
  { id: "diagonal-nw-se", kind: "diagonal", startX: 10, startY: 18, endX: 118, endY: 108, widthTiles: 5, sidewalkTiles: 1, laneMarking: true },
  { id: "diagonal-sw-ne", kind: "diagonal", startX: 16, startY: 116, endX: 112, endY: 26, widthTiles: 5, sidewalkTiles: 1, laneMarking: true },
  { id: "arterial-east-west", kind: "arterial", startX: 0, startY: 64, endX: 127, endY: 64, widthTiles: 7, sidewalkTiles: 1, laneMarking: true },
  { id: "arterial-north-south", kind: "arterial", startX: 64, startY: 0, endX: 64, endY: 127, widthTiles: 7, sidewalkTiles: 1, laneMarking: true },
  { id: "street-north", kind: "street", startX: 0, startY: 34, endX: 127, endY: 34, widthTiles: 5, sidewalkTiles: 1, laneMarking: true },
  { id: "street-south", kind: "street", startX: 0, startY: 96, endX: 127, endY: 96, widthTiles: 5, sidewalkTiles: 1, laneMarking: true },
  { id: "street-west", kind: "street", startX: 32, startY: 0, endX: 32, endY: 127, widthTiles: 5, sidewalkTiles: 1, laneMarking: true },
  { id: "street-east", kind: "street", startX: 96, startY: 0, endX: 96, endY: 127, widthTiles: 5, sidewalkTiles: 1, laneMarking: true },
  { id: "warehouse-access", kind: "street", startX: 88, startY: 114, endX: 127, endY: 114, widthTiles: 7, sidewalkTiles: 1, laneMarking: true },
  { id: "dead-end-west", kind: "street", startX: 16, startY: 82, endX: 34, endY: 82, widthTiles: 3, sidewalkTiles: 1, laneMarking: false },
  { id: "dead-end-north-east", kind: "street", startX: 111, startY: 18, endX: 111, endY: 34, widthTiles: 3, sidewalkTiles: 1, laneMarking: false },
];

const KIND_CYCLE: BuildingKind[] = ["house", "house", "store", "office", "ruin", "house", "warehouse", "garage", "clinic"];
const FLOOR_COLORS = [0x4c5148, 0x514a42, 0x4c4842, 0x4b514c, 0x484d4c, 0x504a46];

export function createCityBlockMap(mapSeed = 0x51a7c1): MapDefinition {
  const widthTiles = MAP_WIDTH_TILES;
  const heightTiles = MAP_HEIGHT_TILES;
  const terrain = new Uint8Array(widthTiles * heightTiles);
  const occupied = new Uint8Array(terrain.length);
  const minimapWallCoverage = new Uint8Array(terrain.length);
  const roadSegments = ROAD_SEGMENTS.map((segment) => ({ ...segment }));
  rasterizeRoads(terrain, widthTiles, heightTiles, roadSegments);

  const buildings: BuildingDefinition[] = [];
  const doors: DoorDefinition[] = [];
  const obstacles: WorldObstacle[] = [];
  const wallSegments: SegmentGeometry[] = [];
  for (const road of roadSegments) {
    if (buildings.length >= 38) break;
    let acceptedForRoad = 0;
    const perRoadLimit = 6;
    const deltaX = road.endX - road.startX;
    const deltaY = road.endY - road.startY;
    const length = Math.hypot(deltaX, deltaY);
    if (length < 28) continue;
    const normalX = -deltaY / length;
    const normalY = deltaX / length;
    const orientation = roadOrientation(road);
    const samples = Math.max(2, Math.floor(length / 11));
    for (const sample of prioritizedSamples(samples)) {
      if (buildings.length >= 38 || acceptedForRoad >= perRoadLimit) break;
      const along = sample / samples;
      const roadX = road.startX + deltaX * along;
      const roadY = road.startY + deltaY * along;
      for (const side of [-1, 1] as const) {
        const buildingIndex = buildings.length;
        const buildingWidth = 8 + (buildingIndex + sample) % 3;
        const buildingDepth = 6 + (buildingIndex + sample) % 2;
        const offset = road.widthTiles / 2 + road.sidewalkTiles + buildingDepth / 2 + 2;
        const centerX = roadX + normalX * side * offset;
        const centerY = roadY + normalY * side * offset;
        const footprint = rasterizeBuildingFootprint(centerX, centerY, buildingWidth, buildingDepth, orientation, widthTiles, heightTiles);
        if (footprint.length < 24 || !canPlaceBuilding(footprint, terrain, occupied, widthTiles, heightTiles)) continue;
        const footprintSet = new Set(footprint);
        const boundary = footprint.filter((index) => isFootprintBoundary(index, footprintSet, widthTiles, heightTiles));
        if (boundary.length < 8) continue;
        let entrance = boundary[0]!;
        let entranceDistance = Number.POSITIVE_INFINITY;
        for (const index of boundary) {
          const tileX = index % widthTiles;
          const tileY = Math.floor(index / widthTiles);
          const candidate = squared(tileX + 0.5 - roadX) + squared(tileY + 0.5 - roadY);
          if (candidate < entranceDistance) { entrance = index; entranceDistance = candidate; }
        }
        const wallTiles = boundary.filter((index) => index !== entrance);
        const wallSet = new Set(boundary);
        const floorTiles = footprint.filter((index) => !wallSet.has(index) || index === entrance);
        const id = `building-${String(buildings.length).padStart(2, "0")}`;
        const kind = KIND_CYCLE[buildings.length % KIND_CYCLE.length]!;
        const diagonalGeometry = orientation === 45 || orientation === 135
          ? createDiagonalBuildingGeometry(centerX, centerY, buildingWidth, buildingDepth, orientation, entrance, widthTiles, roadX, roadY)
          : undefined;
        const building: BuildingDefinition = {
          id, name: buildingName(kind, buildings.length), kind, centerTileX: centerX, centerTileY: centerY,
          widthTiles: buildingWidth, depthTiles: buildingDepth, orientation, roadId: road.id, roadSide: side,
          footprintTiles: footprint, floorTiles, wallTiles, entranceTiles: [entrance],
          wallSegments: diagonalGeometry?.walls ?? [],
          floorColor: FLOOR_COLORS[buildings.length % FLOOR_COLORS.length]!,
        };
        buildings.push(building);
        acceptedForRoad += 1;
        for (const index of footprint) { occupied[index] = 1; terrain[index] = TerrainType.Floor; }
        for (const index of wallTiles) minimapWallCoverage[index] = 1;
        if (diagonalGeometry) wallSegments.push(...diagonalGeometry.walls);
        else for (const index of wallTiles) {
          const tileX = index % widthTiles;
          const tileY = Math.floor(index / widthTiles);
          obstacles.push(wall(`${id}-wall-${tileX}-${tileY}`, tileX, tileY));
        }
        const doorX = entrance % widthTiles;
        const doorY = Math.floor(entrance / widthTiles);
        const doorId = `door-${id}`;
        const orientationValue = diagonalGeometry ? doorOrientationFromSegment(diagonalGeometry.door) : doorOrientation(orientation);
        doors.push({
          kind: "door", id: doorId, buildingId: id, tileX: doorX, tileY: doorY,
          orientation: orientationValue,
          segment: diagonalGeometry?.door ?? createTileDoorSegment(doorX, doorY, orientationValue),
          open: isDoorInitiallyOpen(mapSeed, doorId), health: OBSTACLE_BALANCE.doorHealth,
          maxHealth: OBSTACLE_BALANCE.doorHealth, destroyed: false,
        });
        rasterizeWalkway(terrain, occupied, widthTiles, heightTiles, doorX, doorY, Math.round(roadX), Math.round(roadY));
        if (buildings.length >= 38 || acceptedForRoad >= perRoadLimit) break;
      }
    }
  }
  if (buildings.length < 30) throw new Error(`Expanded city generation produced only ${buildings.length} buildings`);

  const safehouse = nearestBuilding(buildings, 64, 64);
  safehouse.kind = "safehouse"; safehouse.name = "중앙 은신처";
  const playerTile = interiorTile(safehouse, 0.5);
  const diagonalBuildings = buildings.filter((building) => building.orientation === 45 || building.orientation === 135);
  const usedCompanionBuildings = new Set([safehouse.id]);
  const companionBuildings: BuildingDefinition[] = [];
  const firstCompanionBuilding = selectBuildingNearDistance(buildings, safehouse, 38, usedCompanionBuildings);
  companionBuildings.push(firstCompanionBuilding); usedCompanionBuildings.add(firstCompanionBuilding.id);
  const diagonalCompanionBuilding = nearestAvailableBuilding(diagonalBuildings, 92, 38, usedCompanionBuildings);
  companionBuildings.push(diagonalCompanionBuilding); usedCompanionBuildings.add(diagonalCompanionBuilding.id);
  const southWestCompanionBuilding = nearestAvailableBuilding(buildings, 20, 108, usedCompanionBuildings);
  companionBuildings.push(southWestCompanionBuilding); usedCompanionBuildings.add(southWestCompanionBuilding.id);
  const northEastCompanionBuilding = nearestAvailableBuilding(buildings, 108, 20, usedCompanionBuildings);
  companionBuildings.push(northEastCompanionBuilding); usedCompanionBuildings.add(northEastCompanionBuilding.id);
  companionBuildings.forEach((building) => { building.kind = "house"; });
  const companionSpawns = companionBuildings.map((building, index) => {
    const tile = interiorTile(building, 0.38 + index * 0.09);
    return { id: `companion-${index}`, tileX: tile % widthTiles, tileY: Math.floor(tile / widthTiles) };
  });
  const survivorTile = companionSpawns[0]!.tileY * widthTiles + companionSpawns[0]!.tileX;

  const batteryBuilding = nearestBuilding(diagonalBuildings, 108, 24);
  const usedObjectives = new Set([safehouse.id, firstCompanionBuilding.id, batteryBuilding.id]);
  const fuelBuilding = nearestAvailableBuilding(buildings, 108, 108, usedObjectives);
  usedObjectives.add(fuelBuilding.id);
  const engineBuilding = nearestAvailableBuilding(buildings, 20, 108, usedObjectives);
  batteryBuilding.kind = "warehouse"; batteryBuilding.name = "대각선 물류창고";
  fuelBuilding.kind = "gas-station"; fuelBuilding.name = "동부 주유소";
  engineBuilding.kind = "garage"; engineBuilding.name = "서부 정비소";

  const containers = createContainers(buildings, widthTiles, batteryBuilding, fuelBuilding, engineBuilding, mapSeed);
  const groundItems = createGroundItems(buildings, widthTiles);
  addVehicles(obstacles, terrain, occupied, widthTiles, heightTiles);
  const extractionTile = nearestRoadTile(terrain, widthTiles, heightTiles, 120, 116);
  const zombieSpawns = createZombieSpawns(terrain, occupied, widthTiles, heightTiles, mapSeed, playerTile);
  const safeBounds = footprintBounds(safehouse.footprintTiles, widthTiles);
  return {
    mapId: MAP_ID, mapVersion: MAP_VERSION, mapSeed, widthTiles, heightTiles, terrain, minimapWallCoverage, roadSegments,
    buildings, structures: buildings, wallSegments, obstacles, doors, containers, groundItems, zombieSpawns,
    playerSpawn: tileWorld(playerTile, widthTiles), companionSpawns, survivorSpawn: tileWorld(survivorTile, widthTiles),
    extractionZone: { ...tileWorld(extractionTile, widthTiles), radius: 52 },
    safehouseZone: {
      x: safeBounds.minX * TILE_SIZE, y: safeBounds.minY * TILE_SIZE,
      width: (safeBounds.maxX - safeBounds.minX + 1) * TILE_SIZE,
      height: (safeBounds.maxY - safeBounds.minY + 1) * TILE_SIZE,
    },
  };
}

export function isDoorInitiallyOpen(mapSeed: number, doorId: string): boolean {
  let hash = (mapSeed ^ 0x9e3779b9) >>> 0;
  for (let index = 0; index < doorId.length; index += 1) {
    hash ^= doorId.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d) >>> 0;
  hash ^= hash >>> 15;
  return (hash >>> 0) / 0x1_0000_0000 < 0.8;
}

export function getTerrain(map: Pick<MapDefinition, "terrain" | "widthTiles" | "heightTiles">, tileX: number, tileY: number): TerrainType {
  if (tileX < 0 || tileY < 0 || tileX >= map.widthTiles || tileY >= map.heightTiles) return TerrainType.Ground;
  return map.terrain[tileY * map.widthTiles + tileX] as TerrainType;
}
export function isRoad(map: Pick<MapDefinition, "terrain" | "widthTiles" | "heightTiles">, tileX: number, tileY: number): boolean { return getTerrain(map, tileX, tileY) === TerrainType.Road; }

function rasterizeRoads(terrain: Uint8Array, width: number, height: number, roads: readonly RoadSegment[]): void {
  for (const road of roads) {
    const sidewalkRadius = road.widthTiles / 2 + road.sidewalkTiles;
    for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
      const distance = pointSegmentDistance(x + 0.5, y + 0.5, road.startX, road.startY, road.endX, road.endY);
      const index = y * width + x;
      if (distance <= road.widthTiles / 2) terrain[index] = TerrainType.Road;
      else if (distance <= sidewalkRadius && terrain[index] === TerrainType.Ground) terrain[index] = TerrainType.Sidewalk;
    }
  }
}

function rasterizeBuildingFootprint(centerX: number, centerY: number, buildingWidth: number, buildingDepth: number, orientation: BuildingOrientation, mapWidth: number, mapHeight: number): number[] {
  const angle = orientation * Math.PI / 180;
  const cosine = Math.cos(angle); const sine = Math.sin(angle);
  const radius = Math.ceil(Math.hypot(buildingWidth, buildingDepth) / 2) + 1;
  const result: number[] = [];
  for (let y = Math.floor(centerY - radius); y <= Math.ceil(centerY + radius); y += 1) for (let x = Math.floor(centerX - radius); x <= Math.ceil(centerX + radius); x += 1) {
    if (x < 0 || y < 0 || x >= mapWidth || y >= mapHeight) continue;
    const deltaX = x + 0.5 - centerX; const deltaY = y + 0.5 - centerY;
    const localX = deltaX * cosine + deltaY * sine;
    const localY = -deltaX * sine + deltaY * cosine;
    if (Math.abs(localX) <= buildingWidth / 2 && Math.abs(localY) <= buildingDepth / 2) result.push(y * mapWidth + x);
  }
  return result;
}

const DIAGONAL_WALL_THICKNESS = 6;
const DOOR_THICKNESS = 5;
const DOOR_LENGTH = TILE_SIZE - 5;

function createDiagonalBuildingGeometry(
  centerTileX: number,
  centerTileY: number,
  widthTiles: number,
  depthTiles: number,
  orientation: 45 | 135,
  entranceIndex: number,
  mapWidth: number,
  roadTileX: number,
  roadTileY: number,
): { walls: SegmentGeometry[]; door: SegmentGeometry } {
  const angle = orientation * Math.PI / 180;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const localCorners: ReadonlyArray<readonly [number, number]> = [
    [-widthTiles / 2, -depthTiles / 2],
    [widthTiles / 2, -depthTiles / 2],
    [widthTiles / 2, depthTiles / 2],
    [-widthTiles / 2, depthTiles / 2],
  ];
  const corners = localCorners.map(([localX, localY]) => ({
    x: (centerTileX + localX * cosine - localY * sine) * TILE_SIZE,
    y: (centerTileY + localX * sine + localY * cosine) * TILE_SIZE,
  }));
  const roadX = roadTileX * TILE_SIZE;
  const roadY = roadTileY * TILE_SIZE;
  let entranceEdge = 0;
  let entranceEdgeDistance = Number.POSITIVE_INFINITY;
  for (let edge = 0; edge < corners.length; edge += 1) {
    const start = corners[edge]!;
    const end = corners[(edge + 1) % corners.length]!;
    const midpointX = (start.x + end.x) / 2;
    const midpointY = (start.y + end.y) / 2;
    const distance = squared(midpointX - roadX) + squared(midpointY - roadY);
    if (distance < entranceEdgeDistance) { entranceEdge = edge; entranceEdgeDistance = distance; }
  }

  const walls: SegmentGeometry[] = [];
  let door: SegmentGeometry | undefined;
  for (let edge = 0; edge < corners.length; edge += 1) {
    const start = corners[edge]!;
    const end = corners[(edge + 1) % corners.length]!;
    if (edge !== entranceEdge) {
      walls.push({ startX: start.x, startY: start.y, endX: end.x, endY: end.y, thickness: DIAGONAL_WALL_THICKNESS });
      continue;
    }
    const deltaX = end.x - start.x;
    const deltaY = end.y - start.y;
    const length = Math.hypot(deltaX, deltaY);
    const entranceTileX = entranceIndex % mapWidth;
    const entranceTileY = Math.floor(entranceIndex / mapWidth);
    const entranceX = (entranceTileX + 0.5) * TILE_SIZE;
    const entranceY = (entranceTileY + 0.5) * TILE_SIZE;
    const projected = ((entranceX - start.x) * deltaX + (entranceY - start.y) * deltaY) / (length * length);
    const halfDoorAmount = DOOR_LENGTH / (2 * length);
    const centerAmount = Math.max(halfDoorAmount, Math.min(1 - halfDoorAmount, projected));
    const gapStartAmount = centerAmount - halfDoorAmount;
    const gapEndAmount = centerAmount + halfDoorAmount;
    const gapStartX = start.x + deltaX * gapStartAmount;
    const gapStartY = start.y + deltaY * gapStartAmount;
    const gapEndX = start.x + deltaX * gapEndAmount;
    const gapEndY = start.y + deltaY * gapEndAmount;
    if (gapStartAmount > 0.001) walls.push({
      startX: start.x, startY: start.y, endX: gapStartX, endY: gapStartY, thickness: DIAGONAL_WALL_THICKNESS,
    });
    if (gapEndAmount < 0.999) walls.push({
      startX: gapEndX, startY: gapEndY, endX: end.x, endY: end.y, thickness: DIAGONAL_WALL_THICKNESS,
    });
    door = { startX: gapStartX, startY: gapStartY, endX: gapEndX, endY: gapEndY, thickness: DOOR_THICKNESS };
  }
  if (!door) throw new Error("Diagonal building entrance geometry was not generated");
  return { walls, door };
}

function doorOrientationFromSegment(segment: SegmentGeometry): DoorOrientation {
  const sameSign = (segment.endX - segment.startX) * (segment.endY - segment.startY) >= 0;
  return sameSign ? "diagonal-down" : "diagonal-up";
}

function createTileDoorSegment(tileX: number, tileY: number, orientation: DoorOrientation): SegmentGeometry {
  const centerX = (tileX + 0.5) * TILE_SIZE;
  const centerY = (tileY + 0.5) * TILE_SIZE;
  const halfLength = DOOR_LENGTH / 2;
  if (orientation === "vertical") return { startX: centerX, startY: centerY - halfLength, endX: centerX, endY: centerY + halfLength, thickness: DOOR_THICKNESS };
  return { startX: centerX - halfLength, startY: centerY, endX: centerX + halfLength, endY: centerY, thickness: DOOR_THICKNESS };
}

function canPlaceBuilding(footprint: readonly number[], terrain: Uint8Array, occupied: Uint8Array, width: number, height: number): boolean {
  for (const index of footprint) {
    const x = index % width; const y = Math.floor(index / width);
    if (x < 2 || y < 2 || x >= width - 2 || y >= height - 2 || occupied[index] || terrain[index] === TerrainType.Road) return false;
  }
  return true;
}

function isFootprintBoundary(index: number, footprint: Set<number>, width: number, height: number): boolean {
  const x = index % width; const y = Math.floor(index / width);
  return x === 0 || y === 0 || x === width - 1 || y === height - 1 || !footprint.has(index - 1) || !footprint.has(index + 1) || !footprint.has(index - width) || !footprint.has(index + width);
}

function rasterizeWalkway(terrain: Uint8Array, occupied: Uint8Array, width: number, height: number, startX: number, startY: number, endX: number, endY: number): void {
  let x = startX; let y = startY;
  const deltaX = Math.abs(endX - startX); const deltaY = Math.abs(endY - startY);
  const stepX = startX < endX ? 1 : -1; const stepY = startY < endY ? 1 : -1;
  let error = deltaX - deltaY;
  for (let step = 0; step < 16; step += 1) {
    if (x >= 0 && y >= 0 && x < width && y < height) {
      const index = y * width + x;
      if (!occupied[index] && terrain[index] !== TerrainType.Road) terrain[index] = TerrainType.Sidewalk;
      if (terrain[index] === TerrainType.Road) break;
    }
    if (x === endX && y === endY) break;
    const doubled = error * 2;
    if (doubled > -deltaY) { error -= deltaY; x += stepX; }
    if (doubled < deltaX) { error += deltaX; y += stepY; }
  }
}

function createContainers(buildings: readonly BuildingDefinition[], width: number, battery: BuildingDefinition, fuel: BuildingDefinition, engine: BuildingDefinition, mapSeed: number): ContainerDefinition[] {
  const containers: ContainerDefinition[] = [];
  const lootSets: LootStack[][] = [
    [{ itemId: "canned_food", quantity: 1 }, { itemId: "cloth", quantity: 1 }],
    [{ itemId: "water", quantity: 1 }, { itemId: "medicine", quantity: 1 }],
    [{ itemId: "wood", quantity: 2 }, { itemId: "metal", quantity: 1 }],
    [{ itemId: "pistol_ammo", quantity: 4 }, { itemId: "cloth", quantity: 1 }],
  ];
  for (let buildingIndex = 0; buildingIndex < buildings.length; buildingIndex += 1) {
    const building = buildings[buildingIndex]!;
    const count = buildingIndex < 18 ? 2 : 1;
    for (let slot = 0; slot < count; slot += 1) {
      const tile = interiorTile(building, count === 1 ? 0.5 : slot === 0 ? 0.28 : 0.72);
      containers.push({
        id: `container-${building.id}-${slot}`, tileX: tile % width, tileY: Math.floor(tile / width),
        kind: building.kind === "warehouse" ? "crate" : building.kind === "store" ? "shelf" : building.kind === "ruin" ? "pile" : "drawer",
        loot: lootSets[(buildingIndex + slot) % lootSets.length]!.map((item) => ({ ...item })),
      });
    }
  }
  assignPart(containers, battery, "battery", width, [{ itemId: "battery", quantity: 1 }, { itemId: "metal", quantity: 2 }]);
  assignPart(containers, fuel, "fuel", width, [{ itemId: "fuel", quantity: 3 }, { itemId: "cloth", quantity: 1 }]);
  assignPart(containers, engine, "engine_part", width, [{ itemId: "engine_part", quantity: 1 }, { itemId: "metal", quantity: 2 }]);
  const equipment: Array<{ weapon: WeaponId; ammo: string; quantity: number }> = [
    { weapon: "smg", ammo: "smg_ammo", quantity: 28 },
    { weapon: "shotgun", ammo: "shotgun_shell", quantity: 10 },
    { weapon: "hunting_rifle", ammo: "rifle_ammo", quantity: 8 },
  ];
  const candidates = containers.filter((container) => !container.part);
  const start = (mapSeed >>> 0) % candidates.length;
  equipment.forEach((entry, index) => {
    const container = candidates[(start + index * 13) % candidates.length]!;
    container.equipment = entry.weapon;
    container.loot = [{ itemId: entry.ammo, quantity: entry.quantity }, ...container.loot];
  });
  return containers;
}

function assignPart(containers: ContainerDefinition[], building: BuildingDefinition, part: "battery" | "fuel" | "engine_part", width: number, loot: LootStack[]): void {
  const floor = interiorTile(building, 0.5);
  const existing = containers.find((container) => container.id.startsWith(`container-${building.id}-`));
  if (existing) { existing.part = part; existing.loot = loot; existing.tileX = floor % width; existing.tileY = Math.floor(floor / width); }
}

function createGroundItems(buildings: readonly BuildingDefinition[], width: number): GroundItemDefinition[] {
  const itemIds = ["wood", "bandage", "pistol_ammo", "water", "cloth", "canned_food"];
  return buildings.slice(0, 16).map((building, index) => {
    const tile = interiorTile(building, 0.35 + index % 3 * 0.15);
    return { id: `ground-${index}`, itemId: itemIds[index % itemIds.length]!, quantity: index % 4 === 0 ? 2 : 1, tileX: tile % width, tileY: Math.floor(tile / width) };
  });
}

function addVehicles(obstacles: WorldObstacle[], terrain: Uint8Array, occupied: Uint8Array, width: number, height: number): void {
  const points = [[12, 64], [44, 64], [82, 64], [116, 64], [64, 15], [64, 48], [64, 82], [64, 116], [100, 34], [26, 96], [93, 114]];
  points.forEach(([x, y], index) => {
    if (x === undefined || y === undefined || x + 1 >= width || y >= height) return;
    const first = y * width + x;
    if (terrain[first] !== TerrainType.Road || occupied[first] || occupied[first + 1]) return;
    obstacles.push(vehicle(`vehicle-${index}`, x, y, 2, 1));
  });
}

function createZombieSpawns(terrain: Uint8Array, occupied: Uint8Array, width: number, height: number, seed: number, playerTile: number): ZombieSpawnDefinition[] {
  const playerX = playerTile % width; const playerY = Math.floor(playerTile / width);
  const candidates: Array<{ index: number; hash: number }> = [];
  for (let y = 2; y < height - 2; y += 1) for (let x = 2; x < width - 2; x += 1) {
    const index = y * width + x;
    if (terrain[index] !== TerrainType.Road || occupied[index] || Math.hypot(x - playerX, y - playerY) < 16) continue;
    const hash = mixHash(x, y, seed);
    if (hash % 7 === 0) candidates.push({ index, hash });
  }
  candidates.sort((a, b) => a.hash - b.hash);
  return candidates.slice(0, 272).map((candidate, index) => ({
    id: `zombie-spawn-${index}`, tileX: candidate.index % width, tileY: Math.floor(candidate.index / width),
    kind: candidate.hash % 5 === 0 ? "runner" : "walker",
  }));
}

function nearestBuilding(buildings: readonly BuildingDefinition[], targetX: number, targetY: number): BuildingDefinition {
  const match = buildings.reduce<BuildingDefinition | undefined>((best, building) => !best || distanceTo(building, targetX, targetY) < distanceTo(best, targetX, targetY) ? building : best, undefined);
  if (!match) throw new Error("No building candidates available");
  return match;
}
function nearestAvailableBuilding(buildings: readonly BuildingDefinition[], x: number, y: number, used: ReadonlySet<string>): BuildingDefinition { return nearestBuilding(buildings.filter((building) => !used.has(building.id)), x, y); }
function selectBuildingNearDistance(buildings: readonly BuildingDefinition[], origin: BuildingDefinition, desiredDistance: number, used: ReadonlySet<string>): BuildingDefinition {
  const match = buildings.filter((building) => !used.has(building.id)).reduce<BuildingDefinition | undefined>((best, building) => {
    const score = Math.abs(Math.hypot(building.centerTileX - origin.centerTileX, building.centerTileY - origin.centerTileY) - desiredDistance);
    const bestScore = best ? Math.abs(Math.hypot(best.centerTileX - origin.centerTileX, best.centerTileY - origin.centerTileY) - desiredDistance) : Number.POSITIVE_INFINITY;
    return score < bestScore ? building : best;
  }, undefined);
  if (!match) throw new Error("No survivor building available");
  return match;
}

function interiorTile(building: BuildingDefinition, ratio: number): number {
  if (building.floorTiles.length === 0) return building.entranceTiles[0]!;
  return building.floorTiles[Math.min(building.floorTiles.length - 1, Math.max(0, Math.floor((building.floorTiles.length - 1) * ratio)))]!;
}
function nearestRoadTile(terrain: Uint8Array, width: number, height: number, targetX: number, targetY: number): number {
  let best = 0; let bestDistance = Number.POSITIVE_INFINITY;
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const index = y * width + x;
    if (terrain[index] !== TerrainType.Road) continue;
    const candidate = squared(x - targetX) + squared(y - targetY);
    if (candidate < bestDistance) { best = index; bestDistance = candidate; }
  }
  return best;
}
function footprintBounds(tiles: readonly number[], width: number): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = width; let minY = width; let maxX = 0; let maxY = 0;
  for (const index of tiles) {
    const x = index % width; const y = Math.floor(index / width);
    minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  return { minX, minY, maxX, maxY };
}
function tileWorld(index: number, width: number): { x: number; y: number } { return { x: (index % width) * TILE_SIZE + TILE_SIZE / 2, y: Math.floor(index / width) * TILE_SIZE + TILE_SIZE / 2 }; }
function roadOrientation(road: RoadSegment): BuildingOrientation {
  const angle = Math.atan2(road.endY - road.startY, road.endX - road.startX) * 180 / Math.PI;
  if (Math.abs(angle) < 22.5 || Math.abs(angle) > 157.5) return 0;
  if (angle >= 22.5 && angle < 67.5) return 45;
  if (angle <= -22.5 && angle > -67.5) return 135;
  return 90;
}
function doorOrientation(orientation: BuildingOrientation): DoorOrientation {
  if (orientation === 45) return "diagonal-down";
  if (orientation === 135) return "diagonal-up";
  return orientation === 90 ? "vertical" : "horizontal";
}
function buildingName(kind: BuildingKind, index: number): string {
  const names: Record<BuildingKind, string> = { safehouse: "은신처", house: "주택", store: "상점", warehouse: "창고", office: "사무실", clinic: "약국", garage: "정비소", "gas-station": "주유소", ruin: "폐건물" };
  return `${names[kind]} ${index + 1}`;
}
function prioritizedSamples(samples: number): number[] {
  const result: number[] = [];
  const used = new Set<number>();
  for (const fraction of [0.18, 0.4, 0.62, 0.84, 0.28, 0.72, 0.5]) {
    const sample = Math.max(1, Math.min(samples - 1, Math.round(samples * fraction)));
    if (!used.has(sample)) { used.add(sample); result.push(sample); }
  }
  for (let sample = 1; sample < samples; sample += 1) if (!used.has(sample)) result.push(sample);
  return result;
}
function pointSegmentDistance(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const deltaX = bx - ax; const deltaY = by - ay; const lengthSquared = deltaX * deltaX + deltaY * deltaY;
  const amount = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * deltaX + (py - ay) * deltaY) / lengthSquared));
  return Math.hypot(px - (ax + deltaX * amount), py - (ay + deltaY * amount));
}
function mixHash(x: number, y: number, seed: number): number {
  let value = (x * 0x1f123bb5 ^ y * 0x5f356495 ^ seed) >>> 0;
  value ^= value >>> 16; value = Math.imul(value, 0x7feb352d); value ^= value >>> 15; value = Math.imul(value, 0x846ca68b); value ^= value >>> 16;
  return value >>> 0;
}
function distanceTo(building: BuildingDefinition, x: number, y: number): number { return Math.hypot(building.centerTileX - x, building.centerTileY - y); }
function squared(value: number): number { return value * value; }
function wall(id: string, tileX: number, tileY: number): WorldObstacle { return { id, tileX, tileY, widthTiles: 1, heightTiles: 1, blocksMovement: true, blocksVision: true, blocksProjectiles: true, coverHeight: "full", kind: "wall" }; }
function vehicle(id: string, tileX: number, tileY: number, widthTiles: number, heightTiles: number): WorldObstacle { return { id, tileX, tileY, widthTiles, heightTiles, blocksMovement: true, blocksVision: true, blocksProjectiles: true, coverHeight: "full", kind: "vehicle" }; }
