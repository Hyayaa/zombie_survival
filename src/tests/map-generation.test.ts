import { describe, expect, it } from "vitest";
import { BALANCE, FOG_CELL_SIZE, TILE_SIZE } from "../config/game-config";
import { CITY_REGION_HEIGHT, CITY_REGION_WIDTH } from "../data/world-region-definitions";
import { createCityBlockMap, isDoorInitiallyOpen, TerrainType } from "../data/map-definitions";
import { validateMap } from "../data/map-validation";

describe("expanded road-first city map", () => {
  it("uses 128x128 tiles, 3072px axes and a 1024x1024 fog grid", () => {
    const map = createCityBlockMap(123,4);
    expect(map.widthTiles).toBe(CITY_REGION_WIDTH);
    expect(map.heightTiles).toBe(CITY_REGION_HEIGHT);
    expect(map.widthTiles*TILE_SIZE).toBe(3_072);
    expect(map.heightTiles*TILE_SIZE).toBe(3_072);
    expect(map.widthTiles*TILE_SIZE / FOG_CELL_SIZE).toBe(1_024);
    expect(map.terrain).toBeInstanceOf(Uint8Array);
    expect(map.terrain).toHaveLength(128 * 128);
  });

  it("contains connected horizontal, vertical and both diagonal road directions", () => {
    const map = createCityBlockMap(456,4);
    expect(map.roadSegments).toHaveLength(11);
    expect(map.roadSegments.some((road) => road.startY === road.endY && road.widthTiles >= 7)).toBe(true);
    expect(map.roadSegments.some((road) => road.startX === road.endX && road.widthTiles >= 7)).toBe(true);
    expect(map.roadSegments.some((road) => road.kind === "diagonal" && road.endY > road.startY)).toBe(true);
    expect(map.roadSegments.some((road) => road.kind === "diagonal" && road.endY < road.startY)).toBe(true);
    expect(map.terrain.filter((terrain) => terrain === TerrainType.Road).length).toBeGreaterThan(2_000);
  });

  it("places 30-42 non-overlapping buildings on both road sides with real diagonal footprints", () => {
    const map = createCityBlockMap(789,4);
    expect(map.buildings.length).toBeGreaterThanOrEqual(30);
    expect(map.buildings.length).toBeLessThanOrEqual(42);
    expect(map.buildings.some((building) => building.roadSide === -1)).toBe(true);
    expect(map.buildings.some((building) => building.roadSide === 1)).toBe(true);
    const diagonalDown = map.buildings.filter((building) => building.orientation === 45);
    const diagonalUp = map.buildings.filter((building) => building.orientation === 135);
    expect(diagonalDown.length).toBeGreaterThan(0);
    expect(diagonalUp.length).toBeGreaterThan(0);
    for (const building of [...diagonalDown, ...diagonalUp]) {
      expect(building.floorTiles.length).toBeGreaterThan(0);
      expect(building.wallTiles.length).toBeGreaterThan(0);
      expect(building.entranceTiles).toHaveLength(1);
      const door = map.doors.find((candidate) => candidate.buildingId === building.id);
      expect(door?.orientation).toMatch(/^diagonal-/);
      expect(building.wallSegments.length).toBeGreaterThanOrEqual(4);
      expect(door?.segment).toBeDefined();
      expect(map.obstacles.some((obstacle) => obstacle.id.startsWith(`${building.id}-wall-`))).toBe(false);
      expect(building.wallTiles.every((index) => map.minimapWallCoverage[index] === 1)).toBe(true);
    }
  });

  it("validates road, door and core objective reachability", () => {
    const map = createCityBlockMap(321,4);
    const result = validateMap(map);
    expect(result.errors, result.errors.join("\n")).toEqual([]);
    expect(result.valid).toBe(true);
    expect(map.companionSpawns).toHaveLength(4);
    expect(new Set(map.companionSpawns.map((spawn) => spawn.id)).size).toBe(4);
    expect(new Set(map.companionSpawns.map((spawn) => `${spawn.tileX},${spawn.tileY}`)).size).toBe(4);
    const companionBuildings = map.companionSpawns.map((spawn) => map.buildings.find((building) => building.footprintTiles.includes(spawn.tileY * map.widthTiles + spawn.tileX))!);
    expect(new Set(companionBuildings.map((building) => building.id)).size).toBe(4);
    expect(companionBuildings.some((building) => building.orientation === 45 || building.orientation === 135)).toBe(true);
    expect(companionBuildings.every((building) => building.kind !== "safehouse")).toBe(true);
    expect(map.containers.length).toBeGreaterThanOrEqual(45);
    expect(map.containers.length).toBeLessThanOrEqual(65);
    expect(map.groundItems.length).toBeGreaterThanOrEqual(12);
    expect(map.zombieSpawns.length).toBeGreaterThanOrEqual(240);
    expect(map.zombieSpawns.length).toBeLessThanOrEqual(300);
    expect(BALANCE.maxActiveZombies).toBe(72);
    expect(map.zombieSpawns.every((spawn) => Math.hypot(
      spawn.tileX * TILE_SIZE + TILE_SIZE / 2 - map.playerSpawn.x,
      spawn.tileY * TILE_SIZE + TILE_SIZE / 2 - map.playerSpawn.y,
    ) >= 16 * TILE_SIZE)).toBe(true);
    expect(map.zombieSpawns.filter((spawn) => Math.hypot(
      spawn.tileX * TILE_SIZE + TILE_SIZE / 2 - map.playerSpawn.x,
      spawn.tileY * TILE_SIZE + TILE_SIZE / 2 - map.playerSpawn.y,
    ) <= 760).length).toBeGreaterThanOrEqual(40);
    const parts = map.containers.filter((container) => container.part);
    expect(parts).toHaveLength(3);
    for (let first = 0; first < parts.length; first += 1) for (let second = first + 1; second < parts.length; second += 1) {
      expect(Math.hypot(parts[first]!.tileX - parts[second]!.tileX, parts[first]!.tileY - parts[second]!.tileY)).toBeGreaterThanOrEqual(30);
    }
    const diagonalBuildingIds = new Set(map.buildings.filter((building) => building.orientation === 45 || building.orientation === 135).map((building) => building.id));
    expect(parts.some((part) => map.buildings.some((building) => diagonalBuildingIds.has(building.id) && building.floorTiles.includes(part.tileY * map.widthTiles + part.tileX)))).toBe(true);
  });

  it("is deterministic for one map seed without consuming gameplay RNG", () => {
    const first = createCityBlockMap(0x1234,4);
    const second = createCityBlockMap(0x1234,4);
    expect([...first.terrain]).toEqual([...second.terrain]);
    expect([...first.minimapWallCoverage]).toEqual([...second.minimapWallCoverage]);
    expect(first.roadSegments).toEqual(second.roadSegments);
    expect(first.buildings.map(({ id, orientation, footprintTiles, entranceTiles }) => ({ id, orientation, footprintTiles, entranceTiles })))
      .toEqual(second.buildings.map(({ id, orientation, footprintTiles, entranceTiles }) => ({ id, orientation, footprintTiles, entranceTiles })));
    expect(first.containers).toEqual(second.containers);
    expect(first.zombieSpawns).toEqual(second.zombieSpawns);
    expect(first.companionSpawns).toEqual(second.companionSpawns);
    expect(first.wallSegments).toEqual(second.wallSegments);
    expect(first.doors.map((door) => door.segment)).toEqual(second.doors.map((door) => door.segment));
  });

  it("places each new firearm with matching ammunition outside objective containers", () => {
    const map = createCityBlockMap(0x3344,4);
    const expected = { smg: "smg_ammo", shotgun: "shotgun_shell", hunting_rifle: "rifle_ammo" } as const;
    for (const [weapon, ammo] of Object.entries(expected)) {
      const container = map.containers.find((candidate) => candidate.equipment === weapon);
      expect(container).toBeDefined(); expect(container?.part).toBeUndefined();
      expect(container?.loot.some((stack) => stack.itemId === ammo && stack.quantity > 0)).toBe(true);
    }
    expect(createCityBlockMap(0x3344,4).containers).toEqual(map.containers);
  });

  it("places every wearable storage item at least once deterministically", () => {
    const map = createCityBlockMap(0x7788,4);
    const loot = map.containers.flatMap((container) => container.loot.map((stack) => stack.itemId));
    for (const itemId of ["basic_tshirt", "work_pants", "utility_belt", "utility_vest", "school_backpack", "hiking_backpack", "military_backpack"]) {
      expect(loot.filter((candidate) => candidate === itemId).length).toBeGreaterThanOrEqual(1);
    }
    expect(createCityBlockMap(0x7788,4).containers).toEqual(map.containers);
  });

  it("opens doors deterministically at an aggregate rate near 80 percent", () => {
    const first = createCityBlockMap(77,4).doors.map((door) => door.open);
    const second = createCityBlockMap(77,4).doors.map((door) => door.open);
    expect(second).toEqual(first);
    expect(createCityBlockMap(78,4).doors.map((door) => door.open)).not.toEqual(first);
    let open = 0;
    let total = 0;
    for (let seed = 0; seed < 200; seed += 1) {
      for (let doorIndex = 0; doorIndex < 40; doorIndex += 1) {
        open += Number(isDoorInitiallyOpen(seed, `door-building-${doorIndex}`));
        total += 1;
      }
    }
    expect(open / total).toBeGreaterThanOrEqual(0.75);
    expect(open / total).toBeLessThanOrEqual(0.85);
  });
});
