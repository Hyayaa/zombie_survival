import { MAP_TILES, TILE_SIZE } from "../config/game-config";
import type { Point } from "./zombie-ai-system";

interface Node {
  x: number;
  y: number;
  g: number;
  f: number;
  parent?: Node;
}

const CELL_COUNT = MAP_TILES * MAP_TILES;
const bestCosts = new Uint16Array(CELL_COUNT);
const bestGenerations = new Uint32Array(CELL_COUNT);
const closedGenerations = new Uint32Array(CELL_COUNT);
let pathGeneration = 0;

export function findTilePath(start: Point, goal: Point, isBlocked: (x: number, y: number) => boolean, maxVisited = 800): Point[] {
  const startX = Math.floor(start.x / TILE_SIZE);
  const startY = Math.floor(start.y / TILE_SIZE);
  const goalX = Math.max(0, Math.min(MAP_TILES - 1, Math.floor(goal.x / TILE_SIZE)));
  const goalY = Math.max(0, Math.min(MAP_TILES - 1, Math.floor(goal.y / TILE_SIZE)));
  pathGeneration += 1;
  if (pathGeneration === 0xffff_ffff) {
    bestGenerations.fill(0);
    closedGenerations.fill(0);
    pathGeneration = 1;
  }
  const open = new NodeHeap();
  open.push({ x: startX, y: startY, g: 0, f: heuristic(startX, startY, goalX, goalY) });
  const startIndex = startY * MAP_TILES + startX;
  bestGenerations[startIndex] = pathGeneration;
  bestCosts[startIndex] = 0;
  let closedCount = 0;

  while (open.size > 0 && closedCount < maxVisited) {
    const current = open.pop();
    if (!current) break;
    const currentIndex = current.y * MAP_TILES + current.x;
    if (closedGenerations[currentIndex] === pathGeneration) continue;
    closedGenerations[currentIndex] = pathGeneration;
    closedCount += 1;

    if (current.x === goalX && current.y === goalY) return reconstruct(current).slice(1);

    for (const [deltaX, deltaY] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const x = current.x + deltaX;
      const y = current.y + deltaY;
      if (x < 0 || y < 0 || x >= MAP_TILES || y >= MAP_TILES || isBlocked(x, y)) continue;
      const index = y * MAP_TILES + x;
      const g = current.g + 1;
      if (bestGenerations[index] === pathGeneration && g >= bestCosts[index]!) continue;
      bestGenerations[index] = pathGeneration;
      bestCosts[index] = g;
      open.push({ x, y, g, f: g + heuristic(x, y, goalX, goalY), parent: current });
    }
  }
  return [];
}

class NodeHeap {
  private readonly nodes: Node[] = [];

  get size(): number {
    return this.nodes.length;
  }

  push(node: Node): void {
    let index = this.nodes.length;
    this.nodes.push(node);
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      const parentNode = this.nodes[parent];
      if (!parentNode || parentNode.f <= node.f) break;
      this.nodes[index] = parentNode;
      index = parent;
    }
    this.nodes[index] = node;
  }

  pop(): Node | undefined {
    const root = this.nodes[0];
    const last = this.nodes.pop();
    if (!root || !last || this.nodes.length === 0) return root;
    let index = 0;
    while (true) {
      const left = index * 2 + 1;
      if (left >= this.nodes.length) break;
      const right = left + 1;
      const smaller = right < this.nodes.length && this.nodes[right]!.f < this.nodes[left]!.f ? right : left;
      if (this.nodes[smaller]!.f >= last.f) break;
      this.nodes[index] = this.nodes[smaller]!;
      index = smaller;
    }
    this.nodes[index] = last;
    return root;
  }
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
