import { describe, expect, it } from "vitest";
import { TILE_SIZE } from "../config/game-config";
import { findTilePath } from "../systems/pathfinding-system";

const center = (tile: number): number => tile * TILE_SIZE + TILE_SIZE / 2;

describe("findTilePath", () => {
  it("finds a direct tile path without sorting the open set", () => {
    const path = findTilePath(
      { x: center(2), y: center(2) },
      { x: center(6), y: center(2) },
      () => false,
    );
    expect(path).toHaveLength(4);
    expect(path.at(-1)).toEqual({ x: center(6), y: center(2) });
  });

  it("routes around blocked tiles", () => {
    const path = findTilePath(
      { x: center(2), y: center(2) },
      { x: center(5), y: center(2) },
      (x, y) => y === 2 && x === 3,
    );
    expect(path.some((point) => Math.floor(point.y / TILE_SIZE) !== 2)).toBe(true);
    expect(path.at(-1)).toEqual({ x: center(5), y: center(2) });
  });
});
