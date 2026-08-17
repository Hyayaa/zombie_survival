import { describe, expect, it } from "vitest";
import { findAnyAnglePath, type NavigationQuery } from "../systems/pathfinding-system";

const TILE = 24;
const point = (x: number, y: number) => ({ x: x * TILE + TILE / 2, y: y * TILE + TILE / 2 });

function query(width: number, height: number, hard: Set<string>, soft = new Set<string>()): NavigationQuery {
  const key = (x: number, y: number) => `${x},${y}`;
  const blockedAt = (x: number, y: number) => x < 0 || y < 0 || x >= width || y >= height || hard.has(key(x, y)) || soft.has(key(x, y));
  return {
    widthTiles: width, heightTiles: height, tileSize: TILE, navigationRevision: 0,
    getTraversalCost: (x, y) => hard.has(key(x, y)) ? Number.POSITIVE_INFINITY : soft.has(key(x, y)) ? 6 : 1,
    canTraverse: (from, to) => {
      const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / 4));
      for (let step = 1; step <= steps; step += 1) {
        const amount = step / steps;
        if (blockedAt(Math.floor((from.x + (to.x - from.x) * amount) / TILE), Math.floor((from.y + (to.y - from.y) * amount) / TILE))) return false;
      }
      return true;
    },
    canTraverseEdge: (_fromX, _fromY, toX, toY) => !hard.has(key(toX, toY)),
  };
}

describe("any-angle actor pathfinding", () => {
  it("returns the exact world goal immediately when the radius-safe segment is clear", () => {
    const goal = { x: 137.25, y: 91.5 };
    expect(findAnyAnglePath(point(1, 1), goal, query(10, 10, new Set()))).toEqual([goal]);
  });

  it("routes around a wall with sparse visible waypoints and keeps the exact goal", () => {
    const hard = new Set(["3,0", "3,1", "3,2", "3,3"]);
    const navigation = query(8, 7, hard);
    const start = point(1, 1);
    const goal = { x: point(6, 1).x + 3, y: point(6, 1).y - 2 };
    const path = findAnyAnglePath(start, goal, navigation, 300);
    expect(path.at(-1)).toEqual(goal);
    expect(path.length).toBeGreaterThan(1);
    expect(path.length).toBeLessThan(7);
    let from = start;
    for (const waypoint of path) { expect(navigation.canTraverse(from, waypoint)).toBe(true); from = waypoint; }
  });

  it("does not cut a diagonal corner", () => {
    const hard = new Set(["2,1", "1,2"]);
    const path = findAnyAnglePath(point(1, 1), point(3, 3), query(6, 6, hard), 200);
    expect(path[0]).not.toEqual(point(2, 2));
  });

  it("keeps a costly closed obstacle as an explicit attack waypoint", () => {
    const hard = new Set(["3,0", "3,1", "3,3", "3,4"]);
    const soft = new Set(["3,2"]);
    const path = findAnyAnglePath(point(1, 2), point(5, 2), query(7, 5, hard, soft), 300);
    expect(path.some((waypoint) => Math.floor(waypoint.x / TILE) === 3 && Math.floor(waypoint.y / TILE) === 2)).toBe(true);
  });
});
