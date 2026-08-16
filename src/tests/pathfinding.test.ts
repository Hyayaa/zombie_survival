import { describe, expect, it } from "vitest";
import { TILE_SIZE } from "../config/game-config";
import { findTilePath, findWeightedTilePath } from "../systems/pathfinding-system";

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

  it("uses edge traversal geometry without marking the destination tile fully blocked", () => {
    const path = findTilePath(
      { x: center(1), y: center(2) },
      { x: center(4), y: center(2) },
      () => false,
      200,
      6,
      5,
      (fromX, fromY, toX, toY) => !(fromY === 2 && toY === 2 && ((fromX === 2 && toX === 3) || (fromX === 3 && toX === 2))),
    );
    expect(path.some((point) => Math.floor(point.y / TILE_SIZE) !== 2)).toBe(true);
  });
});

describe("findWeightedTilePath", () => {
  it("routes around a costly closed door when the detour is shorter", () => {
    const path = findWeightedTilePath(
      { x: center(1), y: center(2) },
      { x: center(5), y: center(2) },
      (x, y) => x === 3 && y === 2 ? 6 : 1,
      200,
      7,
      5,
    );
    expect(path.some((point) => Math.floor(point.x / TILE_SIZE) === 3 && Math.floor(point.y / TILE_SIZE) === 2)).toBe(false);
  });

  it("selects a door when the only alternative has a larger accumulated cost", () => {
    const path = findWeightedTilePath(
      { x: center(1), y: center(3) },
      { x: center(7), y: center(3) },
      (x, y) => {
        if (x === 4 && y === 3) return 6;
        if (x === 4 && y !== 0) return Number.POSITIVE_INFINITY;
        return 1;
      },
      500,
      9,
      7,
    );
    expect(path.some((point) => Math.floor(point.x / TILE_SIZE) === 4 && Math.floor(point.y / TILE_SIZE) === 3)).toBe(true);
  });

  it("supports high Uint32 accumulated costs and barricade traversal", () => {
    const path = findWeightedTilePath(
      { x: center(1), y: center(1) },
      { x: center(4), y: center(1) },
      (x, y) => y !== 1 ? Number.POSITIVE_INFINITY : x === 2 ? 70_000 : x === 3 ? 12 : 1,
      50,
      6,
      3,
    );
    expect(path).toHaveLength(3);
    expect(path.at(-1)).toEqual({ x: center(4), y: center(1) });
  });
});
