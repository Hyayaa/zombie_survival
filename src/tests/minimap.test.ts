import { describe, expect, it } from "vitest";
import { MINIMAP, WORLD_HEIGHT, WORLD_WIDTH } from "../config/game-config";
import { createCityBlockMap, TerrainType } from "../data/map-definitions";
import { VisibilityState } from "../systems/fog-of-war-system";
import { cameraViewportToFullMap, cycleMapMode, getLocalMapWindow, getMinimapTerrain, getMinimapTileColor, getMinimapTileState, MINIMAP_COLORS, MinimapFogTracker, MinimapTerrain, MinimapTileState, shouldPauseSimulationForMap, shouldShowCompanion, shouldShowExtraction, shouldUpdateMinimap, worldToFullMap } from "../ui/minimap";

function fakeFog(states: Map<string, VisibilityState>): { getStateAtCell(x: number, y: number): VisibilityState } { return { getStateAtCell: (x, y) => states.get(`${x},${y}`) ?? VisibilityState.Unknown }; }

describe("local and full map data", () => {
  it("cycles hidden to local to full to hidden one step at a time", () => {
    expect(cycleMapMode("hidden")).toBe("local");
    expect(cycleMapMode("local")).toBe("full");
    expect(cycleMapMode("full")).toBe("hidden");
    expect(shouldPauseSimulationForMap("local")).toBe(false);
    expect(shouldPauseSimulationForMap("full")).toBe(true);
  });

  it("uses a clamped 32x32 local window", () => {
    expect(getLocalMapWindow(64, 64)).toEqual({ startX: 48, startY: 48, width: 32, height: 32 });
    expect(getLocalMapWindow(0, 0)).toEqual({ startX: 0, startY: 0, width: 32, height: 32 });
    expect(getLocalMapWindow(127, 127)).toEqual({ startX: 96, startY: 96, width: 32, height: 32 });
    expect(MINIMAP.localSize).toBe(192);
    expect(MINIMAP.localPixelsPerTile).toBe(6);
  });

  it("prioritizes visible over explored and keeps untouched tiles unknown", () => {
    expect(getMinimapTileState(fakeFog(new Map()), 1, 1)).toBe(MinimapTileState.Unknown);
    expect(getMinimapTileState(fakeFog(new Map([["8,8", VisibilityState.Explored]])), 1, 1)).toBe(MinimapTileState.Explored);
    expect(getMinimapTileState(fakeFog(new Map([["8,8", VisibilityState.Explored], ["15,15", VisibilityState.Visible]])), 1, 1)).toBe(MinimapTileState.Visible);
  });

  it("classifies generated terrain, diagonal walls, vehicles and doors", () => {
    const map = createCityBlockMap(7);
    const road = map.terrain.findIndex((value) => value === TerrainType.Road);
    const floor = map.buildings[0]!.floorTiles[0]!;
    const wall = map.buildings[0]!.wallTiles[0]!;
    const vehicle = map.obstacles.find((obstacle) => obstacle.kind === "vehicle")!;
    const door = map.doors[0]!;
    expect(getMinimapTerrain(map, road % map.widthTiles, Math.floor(road / map.widthTiles))).toBe(MinimapTerrain.Road);
    expect(getMinimapTerrain(map, floor % map.widthTiles, Math.floor(floor / map.widthTiles))).toBe(MinimapTerrain.Floor);
    expect(getMinimapTerrain(map, wall % map.widthTiles, Math.floor(wall / map.widthTiles))).toBe(MinimapTerrain.Wall);
    expect(getMinimapTerrain(map, vehicle.tileX, vehicle.tileY)).toBe(MinimapTerrain.Vehicle);
    expect(getMinimapTerrain(map, door.tileX, door.tileY)).toBe(MinimapTerrain.Door);
    door.open = true;
    expect(getMinimapTerrain(map, door.tileX, door.tileY)).toBe(MinimapTerrain.OpenDoor);
  });

  it("never leaks terrain color for unknown local tiles while full uses bright terrain", () => {
    expect(getMinimapTileColor(MinimapTerrain.Road, MinimapTileState.Unknown)).toBe(MINIMAP_COLORS.unknown);
    expect(getMinimapTileColor(MinimapTerrain.Wall, MinimapTileState.Unknown)).toBe(MINIMAP_COLORS.unknown);
    expect(getMinimapTileColor(MinimapTerrain.Floor, MinimapTileState.Visible)).toBe(MINIMAP_COLORS.floorVisible);
  });

  it("maps all 128 tiles into the 512px full canvas", () => {
    expect(MINIMAP.fullSize).toBe(512);
    expect(MINIMAP.fullPixelsPerTile).toBe(4);
    expect(worldToFullMap(0, 0)).toEqual({ x: 0, y: 0 });
    expect(worldToFullMap(WORLD_WIDTH, WORLD_HEIGHT)).toEqual({ x: 512, y: 512 });
    expect(worldToFullMap(WORLD_WIDTH / 2, WORLD_HEIGHT / 2)).toEqual({ x: 256, y: 256 });
  });

  it("makes the full-map viewport marker smaller when zooming in", () => {
    const zoomedOut = cameraViewportToFullMap({ x: 0, y: 0, width: 480 / 0.55, height: 270 / 0.55 });
    const zoomedIn = cameraViewportToFullMap({ x: 0, y: 0, width: 480 / 2, height: 270 / 2 });
    expect(zoomedIn.width).toBeLessThan(zoomedOut.width);
    expect(zoomedIn.height).toBeLessThan(zoomedOut.height);
  });

  it("shows only rescued living companions and conditionally known local extraction", () => {
    expect(shouldShowCompanion(false, true)).toBe(false);
    expect(shouldShowCompanion(true, true)).toBe(true);
    expect(shouldShowCompanion(true, false)).toBe(false);
    expect(shouldShowExtraction(MinimapTileState.Unknown, 2, false)).toBe(false);
    expect(shouldShowExtraction(MinimapTileState.Explored, 0, false)).toBe(true);
  });

  it("deduplicates 8x8 fog-cell changes into 128-wide map tiles", () => {
    const tracker = new MinimapFogTracker();
    tracker.markFogIndices([0, 1, 7, 1_024 * 8], 1_024);
    const consumed: number[] = [];
    tracker.consume((index) => consumed.push(index));
    expect(consumed).toEqual([0, 128]);
    expect(tracker.size).toBe(0);
  });

  it("skips updates while hidden and caps markers at 10Hz", () => {
    expect(shouldUpdateMinimap(false, 1_000, 0)).toBe(false);
    expect(shouldUpdateMinimap(true, 99, 0)).toBe(false);
    expect(shouldUpdateMinimap(true, 100, 0)).toBe(true);
  });
});
