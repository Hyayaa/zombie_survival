import { MAP_TILES, TILE_SIZE } from "../config/game-config";
import type { Point } from "./zombie-ai-system";

interface Node {
  x: number;
  y: number;
  g: number;
  f: number;
  parent?: Node;
}

export function findTilePath(start: Point, goal: Point, isBlocked: (x: number, y: number) => boolean, maxVisited = 800): Point[] {
  const startX = Math.floor(start.x / TILE_SIZE);
  const startY = Math.floor(start.y / TILE_SIZE);
  const goalX = Math.max(0, Math.min(MAP_TILES - 1, Math.floor(goal.x / TILE_SIZE)));
  const goalY = Math.max(0, Math.min(MAP_TILES - 1, Math.floor(goal.y / TILE_SIZE)));
  const open: Node[] = [{ x: startX, y: startY, g: 0, f: heuristic(startX, startY, goalX, goalY) }];
  const best = new Map<string, number>([[`${startX},${startY}`, 0]]);
  const closed = new Set<string>();

  while (open.length > 0 && closed.size < maxVisited) {
    open.sort((a, b) => a.f - b.f);
    const current = open.shift();
    if (!current) break;
    const currentKey = `${current.x},${current.y}`;
    if (closed.has(currentKey)) continue;
    closed.add(currentKey);

    if (current.x === goalX && current.y === goalY) return reconstruct(current).slice(1);

    for (const [deltaX, deltaY] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const x = current.x + deltaX;
      const y = current.y + deltaY;
      if (x < 0 || y < 0 || x >= MAP_TILES || y >= MAP_TILES || isBlocked(x, y)) continue;
      const key = `${x},${y}`;
      const g = current.g + 1;
      if (g >= (best.get(key) ?? Number.POSITIVE_INFINITY)) continue;
      best.set(key, g);
      open.push({ x, y, g, f: g + heuristic(x, y, goalX, goalY), parent: current });
    }
  }
  return [];
}

function heuristic(x: number, y: number, goalX: number, goalY: number): number {
  return Math.abs(goalX - x) + Math.abs(goalY - y);
}

function reconstruct(node: Node): Point[] {
  const path: Point[] = [];
  let cursor: Node | undefined = node;
  while (cursor) {
    path.push({ x: cursor.x * TILE_SIZE + TILE_SIZE / 2, y: cursor.y * TILE_SIZE + TILE_SIZE / 2 });
    cursor = cursor.parent;
  }
  return path.reverse();
}

