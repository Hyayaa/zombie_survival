import { TILE_SIZE } from "../config/game-config";
import { segmentsIntersect } from "../systems/collision-geometry";
import { TerrainType, type MapDefinition } from "./map-definitions";

export interface MapValidationResult { valid: boolean; errors: string[] }

export function validateMap(map: MapDefinition): MapValidationResult {
  const errors: string[] = [];
  const tileCount = map.widthTiles * map.heightTiles;
  if (map.terrain.length !== tileCount) errors.push(`terrain length ${map.terrain.length}, expected ${tileCount}`);
  if (map.widthTiles !== 128 || map.heightTiles !== 128) errors.push(`map dimensions ${map.widthTiles}x${map.heightTiles}, expected 128x128`);
  if (map.buildings.length < 30) errors.push(`building count ${map.buildings.length}, expected at least 30`);
  if (!map.buildings.some((building) => building.orientation === 45)) errors.push("missing orientation 45 building");
  if (!map.buildings.some((building) => building.orientation === 135)) errors.push("missing orientation 135 building");
  if (!map.roadSegments.some((road) => road.kind === "diagonal" && road.endY > road.startY)) errors.push("missing NW-SE diagonal road");
  if (!map.roadSegments.some((road) => road.kind === "diagonal" && road.endY < road.startY)) errors.push("missing SW-NE diagonal road");

  const owner = new Int16Array(tileCount).fill(-1);
  map.buildings.forEach((building, buildingIndex) => {
    if (building.entranceTiles.length === 0) errors.push(`${building.id}: missing entrance`);
    for (const index of building.footprintTiles) {
      if (index < 0 || index >= tileCount) { errors.push(`${building.id}: out-of-bounds footprint ${index}`); continue; }
      if (map.terrain[index] === TerrainType.Road) errors.push(`${building.id}: overlaps road at ${formatIndex(index, map.widthTiles)}`);
      if (owner[index] !== -1 && owner[index] !== buildingIndex) errors.push(`${building.id}: overlaps building ${map.buildings[owner[index]!]!.id} at ${formatIndex(index, map.widthTiles)}`);
      owner[index] = buildingIndex;
    }
    for (const entrance of building.entranceTiles) {
      if (!building.footprintTiles.includes(entrance) || building.wallTiles.includes(entrance)) errors.push(`${building.id}: invalid entrance ${formatIndex(entrance, map.widthTiles)}`);
    }
    if (building.orientation === 45 || building.orientation === 135) {
      const door = map.doors.find((candidate) => candidate.buildingId === building.id);
      if (building.wallSegments.length < 4) errors.push(`${building.id}: incomplete diagonal wall segments`);
      if (!door?.segment) errors.push(`${building.id}: missing diagonal door segment`);
      else {
        const deltaX = door.segment.endX - door.segment.startX;
        const deltaY = door.segment.endY - door.segment.startY;
        if (door.orientation === "diagonal-down" && deltaX * deltaY < 0) errors.push(`${building.id}: door orientation mismatch`);
        if (door.orientation === "diagonal-up" && deltaX * deltaY > 0) errors.push(`${building.id}: door orientation mismatch`);
        if (building.wallSegments.some((wall) => segmentsIntersect(door.segment!, wall))) errors.push(`${building.id}: door overlaps wall segment`);
        const exterior = [...building.wallSegments, door.segment];
        const endpointDegree = new Map<string, number>();
        for (const segment of exterior) for (const key of [`${segment.startX},${segment.startY}`, `${segment.endX},${segment.endY}`]) endpointDegree.set(key, (endpointDegree.get(key) ?? 0) + 1);
        if ([...endpointDegree.values()].some((degree) => degree !== 2)) errors.push(`${building.id}: discontinuous diagonal exterior`);
      }
    }
  });

  const roadReachable = floodRoads(map);
  for (const road of map.roadSegments) {
    const index = nearestRoadIndex(map, Math.round((road.startX + road.endX) / 2), Math.round((road.startY + road.endY) / 2));
    if (index < 0 || !roadReachable[index]) errors.push(`${road.id}: disconnected road segment`);
  }

  const blocked = buildBlockedGrid(map);
  const playerIndex = worldIndex(map, map.playerSpawn.x, map.playerSpawn.y);
  if (playerIndex < 0 || blocked[playerIndex]) errors.push("player spawn is blocked or outside map");
  const reachable = floodWalkable(map, blocked, playerIndex);
  const objectives: Array<[string, number]> = [["extraction", worldIndex(map, map.extractionZone.x, map.extractionZone.y)]];
  if (map.companionSpawns.length !== 4) errors.push(`companion spawn count ${map.companionSpawns.length}, expected 4`);
  const companionIds = new Set<string>();
  const companionTiles = new Set<number>();
  const companionBuildings = new Set<string>();
  let diagonalCompanionCount = 0;
  for (const spawn of map.companionSpawns) {
    const index = spawn.tileY * map.widthTiles + spawn.tileX;
    if (companionIds.has(spawn.id)) errors.push(`duplicate companion id ${spawn.id}`);
    if (companionTiles.has(index)) errors.push(`duplicate companion tile ${spawn.tileX},${spawn.tileY}`);
    companionIds.add(spawn.id); companionTiles.add(index);
    if (blocked[index]) errors.push(`${spawn.id}: blocked spawn at ${formatIndex(index, map.widthTiles)}`);
    const building = map.buildings.find((candidate) => candidate.footprintTiles.includes(index));
    if (!building) errors.push(`${spawn.id}: not inside a building`);
    else {
      if (building.kind === "safehouse") errors.push(`${spawn.id}: inside safehouse`);
      if (companionBuildings.has(building.id)) errors.push(`${spawn.id}: shares building ${building.id}`);
      companionBuildings.add(building.id);
      if (building.orientation === 45 || building.orientation === 135) diagonalCompanionCount += 1;
    }
    objectives.push([spawn.id, index]);
  }
  if (diagonalCompanionCount === 0) errors.push("missing companion spawn in diagonal building");
  for (const part of ["battery", "fuel", "engine_part"] as const) {
    const container = map.containers.find((candidate) => candidate.part === part);
    if (!container) errors.push(`missing objective part ${part}`);
    else objectives.push([part, container.tileY * map.widthTiles + container.tileX]);
  }
  for (const [name, index] of objectives) if (index < 0 || !reachable[index]) errors.push(`${name}: unreachable from player spawn at ${formatIndex(index, map.widthTiles)}`);

  for (const building of map.buildings) {
    for (const entrance of building.entranceTiles) {
      if (blocked[entrance]) errors.push(`${building.id}: entrance blocked at ${formatIndex(entrance, map.widthTiles)}`);
      if (!canReachTerrain(map, blocked, entrance, TerrainType.Road)) errors.push(`${building.id}: entrance has no path to road at ${formatIndex(entrance, map.widthTiles)}`);
    }
  }
  return { valid: errors.length === 0, errors };
}

export function assertValidMap(map: MapDefinition): void {
  const result = validateMap(map);
  if (!result.valid) throw new Error(`Map validation failed:\n${result.errors.join("\n")}`);
}

function buildBlockedGrid(map: MapDefinition): Uint8Array {
  const blocked = new Uint8Array(map.widthTiles * map.heightTiles);
  for (const obstacle of map.obstacles) {
    if (!obstacle.blocksMovement) continue;
    for (let y = obstacle.tileY; y < obstacle.tileY + obstacle.heightTiles; y += 1) for (let x = obstacle.tileX; x < obstacle.tileX + obstacle.widthTiles; x += 1) {
      if (x >= 0 && y >= 0 && x < map.widthTiles && y < map.heightTiles) blocked[y * map.widthTiles + x] = 1;
    }
  }
  // Validation treats doors as open so every room must remain completable after interaction.
  for (const door of map.doors) blocked[door.tileY * map.widthTiles + door.tileX] = 0;
  return blocked;
}

function floodRoads(map: MapDefinition): Uint8Array {
  const first = map.terrain.findIndex((terrain) => terrain === TerrainType.Road);
  const visited = new Uint8Array(map.terrain.length);
  if (first < 0) return visited;
  return flood(map.widthTiles, map.heightTiles, first, (index) => map.terrain[index] === TerrainType.Road, visited);
}

function floodWalkable(map: MapDefinition, blocked: Uint8Array, start: number): Uint8Array {
  const visited = new Uint8Array(map.terrain.length);
  if (start < 0 || blocked[start]) return visited;
  return flood(map.widthTiles, map.heightTiles, start, (index) => blocked[index] === 0, visited);
}

function canReachTerrain(map: MapDefinition, blocked: Uint8Array, start: number, target: TerrainType): boolean {
  const visited = floodWalkable(map, blocked, start);
  for (let index = 0; index < visited.length; index += 1) if (visited[index] && map.terrain[index] === target) return true;
  return false;
}

function flood(width: number, height: number, start: number, allowed: (index: number) => boolean, visited: Uint8Array): Uint8Array {
  const queue = new Int32Array(width * height);
  let head = 0; let tail = 0;
  queue[tail++] = start; visited[start] = 1;
  while (head < tail) {
    const index = queue[head++]!;
    const x = index % width; const y = Math.floor(index / width);
    for (const next of [x > 0 ? index - 1 : -1, x + 1 < width ? index + 1 : -1, y > 0 ? index - width : -1, y + 1 < height ? index + width : -1]) {
      if (next < 0 || visited[next] || !allowed(next)) continue;
      visited[next] = 1; queue[tail++] = next;
    }
  }
  return visited;
}

function nearestRoadIndex(map: MapDefinition, targetX: number, targetY: number): number {
  let best = -1; let bestDistance = Number.POSITIVE_INFINITY;
  for (let y = Math.max(0, targetY - 5); y <= Math.min(map.heightTiles - 1, targetY + 5); y += 1) for (let x = Math.max(0, targetX - 5); x <= Math.min(map.widthTiles - 1, targetX + 5); x += 1) {
    const index = y * map.widthTiles + x;
    if (map.terrain[index] !== TerrainType.Road) continue;
    const candidate = (x - targetX) ** 2 + (y - targetY) ** 2;
    if (candidate < bestDistance) { best = index; bestDistance = candidate; }
  }
  return best;
}

function worldIndex(map: MapDefinition, worldX: number, worldY: number): number {
  const x = Math.floor(worldX / TILE_SIZE); const y = Math.floor(worldY / TILE_SIZE);
  return x < 0 || y < 0 || x >= map.widthTiles || y >= map.heightTiles ? -1 : y * map.widthTiles + x;
}

function formatIndex(index: number, width: number): string { return index < 0 ? "outside" : `${index % width},${Math.floor(index / width)}`; }
