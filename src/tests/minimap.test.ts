import { describe, expect, it } from "vitest";
import { MINIMAP, WORLD_SIZE } from "../config/game-config";
import { createCityBlockMap } from "../data/map-definitions";
import { VisibilityState } from "../systems/fog-of-war-system";
import { cameraViewportToMinimap, getMinimapTerrain, getMinimapTileColor, getMinimapTileState, MINIMAP_COLORS, MinimapFogTracker, MinimapTerrain, MinimapTileState, shouldShowCompanion, shouldShowExtraction, shouldUpdateMinimap, worldToMinimap } from "../ui/minimap";

function fakeFog(states: Map<string, VisibilityState>): { getStateAtCell(x: number, y: number): VisibilityState } {
  return { getStateAtCell: (x, y) => states.get(`${x},${y}`) ?? VisibilityState.Unknown };
}

describe("minimap data", () => {
  it("prioritizes visible over explored and keeps untouched tiles unknown", () => {
    expect(getMinimapTileState(fakeFog(new Map()), 1, 1)).toBe(MinimapTileState.Unknown);
    expect(getMinimapTileState(fakeFog(new Map([["8,8", VisibilityState.Explored]])), 1, 1)).toBe(MinimapTileState.Explored);
    expect(getMinimapTileState(fakeFog(new Map([
      ["8,8", VisibilityState.Explored],
      ["15,15", VisibilityState.Visible],
    ])), 1, 1)).toBe(MinimapTileState.Visible);
  });

  it("classifies road, floor, wall and multi-tile vehicles", () => {
    const map = createCityBlockMap();
    expect(getMinimapTerrain(map, 0, 16)).toBe(MinimapTerrain.Road);
    expect(getMinimapTerrain(map, 3, 3)).toBe(MinimapTerrain.Floor);
    expect(getMinimapTerrain(map, 2, 2)).toBe(MinimapTerrain.Wall);
    expect(getMinimapTerrain(map, 7, 16)).toBe(MinimapTerrain.Vehicle);
    expect(getMinimapTerrain(map, 8, 11)).toBe(MinimapTerrain.Door);
  });

  it("uses the same unknown color without leaking terrain type", () => {
    expect(getMinimapTileColor(MinimapTerrain.Road, MinimapTileState.Unknown)).toBe(MINIMAP_COLORS.unknown);
    expect(getMinimapTileColor(MinimapTerrain.Wall, MinimapTileState.Unknown)).toBe(MINIMAP_COLORS.unknown);
    expect(getMinimapTileColor(MinimapTerrain.Floor, MinimapTileState.Visible)).toBe(MINIMAP_COLORS.floorVisible);
  });

  it("maps world corners and actor positions into the 192px canvas", () => {
    expect(MINIMAP.size).toBe(192);
    expect(worldToMinimap(0, 0)).toEqual({ x: 0, y: 0 });
    expect(worldToMinimap(WORLD_SIZE, WORLD_SIZE)).toEqual({ x: 192, y: 192 });
    expect(worldToMinimap(WORLD_SIZE / 2, WORLD_SIZE / 2)).toEqual({ x: 96, y: 96 });
  });

  it("makes the viewport smaller when zooming in", () => {
    const zoomedOut = cameraViewportToMinimap({ x: 0, y: 0, width: 480 / 0.55, height: 270 / 0.55 });
    const zoomedIn = cameraViewportToMinimap({ x: 0, y: 0, width: 480 / 2, height: 270 / 2 });
    expect(zoomedIn.width).toBeLessThan(zoomedOut.width);
    expect(zoomedIn.height).toBeLessThan(zoomedOut.height);
  });

  it("shows only rescued living companions and conditionally known extraction", () => {
    expect(shouldShowCompanion(false, true)).toBe(false);
    expect(shouldShowCompanion(true, true)).toBe(true);
    expect(shouldShowCompanion(true, false)).toBe(false);
    expect(shouldShowExtraction(MinimapTileState.Unknown, 2, false)).toBe(false);
    expect(shouldShowExtraction(MinimapTileState.Explored, 0, false)).toBe(true);
    expect(shouldShowExtraction(MinimapTileState.Unknown, 3, false)).toBe(true);
    expect(shouldShowExtraction(MinimapTileState.Unknown, 0, true)).toBe(true);
  });

  it("deduplicates changed fog cells that belong to the same tile", () => {
    const tracker = new MinimapFogTracker();
    tracker.markFogIndices([0, 1, 7, 384 * 8], 384);
    expect(tracker.size).toBe(2);
    const consumed: number[] = [];
    tracker.consume((index) => consumed.push(index));
    expect(consumed).toEqual([0, 48]);
    expect(tracker.size).toBe(0);
  });

  it("skips dynamic updates while closed and limits open updates to 10Hz", () => {
    expect(shouldUpdateMinimap(false, 1_000, 0)).toBe(false);
    expect(shouldUpdateMinimap(true, 99, 0)).toBe(false);
    expect(shouldUpdateMinimap(true, 100, 0)).toBe(true);
  });
});
