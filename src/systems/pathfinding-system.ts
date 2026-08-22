import { MAP_HEIGHT_TILES, MAP_WIDTH_TILES, TILE_SIZE } from "../config/game-config";
import type { Point } from "./zombie-ai-system";

interface Node {
  x: number;
  y: number;
  g: number;
  f: number;
  parent?: Node;
}

const CELL_COUNT = MAP_WIDTH_TILES * MAP_HEIGHT_TILES;
let bestCosts = new Uint32Array(CELL_COUNT);
let bestGenerations = new Uint32Array(CELL_COUNT);
let closedGenerations = new Uint32Array(CELL_COUNT);
let pathGeneration = 0;

export function findTilePath(
  start: Point,
  goal: Point,
  isBlocked: (x: number, y: number) => boolean,
  maxVisited = 800,
  widthTiles = MAP_WIDTH_TILES,
  heightTiles = MAP_HEIGHT_TILES,
  canTraverseEdge?: (fromX: number, fromY: number, toX: number, toY: number) => boolean,
): Point[] {
  return findWeightedTilePath(start, goal, (x, y) => isBlocked(x, y) ? Number.POSITIVE_INFINITY : 1, maxVisited, widthTiles, heightTiles, canTraverseEdge);
}

export function findWeightedTilePath(
  start: Point,
  goal: Point,
  getTraversalCost: (x: number, y: number) => number,
  maxVisited = 800,
  widthTiles = MAP_WIDTH_TILES,
  heightTiles = MAP_HEIGHT_TILES,
  canTraverseEdge?: (fromX: number, fromY: number, toX: number, toY: number) => boolean,
): Point[] {
  ensureTileWorkspace(widthTiles * heightTiles);
  const startX = Math.floor(start.x / TILE_SIZE);
  const startY = Math.floor(start.y / TILE_SIZE);
  if (startX < 0 || startY < 0 || startX >= widthTiles || startY >= heightTiles) return [];
  const goalX = Math.max(0, Math.min(widthTiles - 1, Math.floor(goal.x / TILE_SIZE)));
  const goalY = Math.max(0, Math.min(heightTiles - 1, Math.floor(goal.y / TILE_SIZE)));
  pathGeneration += 1;
  if (pathGeneration === 0xffff_ffff) {
    bestGenerations.fill(0);
    closedGenerations.fill(0);
    pathGeneration = 1;
  }
  const open = new NodeHeap();
  open.push({ x: startX, y: startY, g: 0, f: heuristic(startX, startY, goalX, goalY) });
  const startIndex = startY * widthTiles + startX;
  bestGenerations[startIndex] = pathGeneration;
  bestCosts[startIndex] = 0;
  let closedCount = 0;

  while (open.size > 0 && closedCount < maxVisited) {
    const current = open.pop();
    if (!current) break;
    const currentIndex = current.y * widthTiles + current.x;
    if (closedGenerations[currentIndex] === pathGeneration) continue;
    closedGenerations[currentIndex] = pathGeneration;
    closedCount += 1;

    if (current.x === goalX && current.y === goalY) return reconstruct(current).slice(1);

    for (const [deltaX, deltaY] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const x = current.x + deltaX;
      const y = current.y + deltaY;
      if (x < 0 || y < 0 || x >= widthTiles || y >= heightTiles) continue;
      if (canTraverseEdge && !canTraverseEdge(current.x, current.y, x, y)) continue;
      const traversalCost = getTraversalCost(x, y);
      if (!Number.isFinite(traversalCost) || traversalCost <= 0) continue;
      const index = y * widthTiles + x;
      const g = current.g + traversalCost;
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

export interface NavigationQuery {
  readonly widthTiles: number;
  readonly heightTiles: number;
  readonly tileSize: number;
  readonly navigationRevision: number;
  getTraversalCost(tileX: number, tileY: number): number;
  canTraverse(from: Point, to: Point): boolean;
  canTraverseEdge(fromTileX: number, fromTileY: number, toTileX: number, toTileY: number): boolean;
}

let anyAngleCosts = new Float64Array(CELL_COUNT);
let anyAngleParents = new Int32Array(CELL_COUNT);
let anyAngleGenerations = new Uint32Array(CELL_COUNT);
let anyAngleClosedGenerations = new Uint32Array(CELL_COUNT);
let anyAngleGeneration = 0;

/** Direct-line first, eight-direction Theta* with a final visibility string pull. */
export function findAnyAnglePath(start: Point, goal: Point, query: NavigationQuery, maxVisited = 800): Point[] {
  if (query.canTraverse(start, goal)) return [{ x: goal.x, y: goal.y }];
  ensureAnyAngleWorkspace(query.widthTiles * query.heightTiles);
  const startX = Math.floor(start.x / query.tileSize);
  const startY = Math.floor(start.y / query.tileSize);
  const goalX = Math.max(0, Math.min(query.widthTiles - 1, Math.floor(goal.x / query.tileSize)));
  const goalY = Math.max(0, Math.min(query.heightTiles - 1, Math.floor(goal.y / query.tileSize)));
  if (!inNavigationBounds(startX, startY, query) || !Number.isFinite(query.getTraversalCost(goalX, goalY))) return [];
  anyAngleGeneration += 1;
  if (anyAngleGeneration >= 0xffff_ffff) {
    anyAngleGenerations.fill(0); anyAngleClosedGenerations.fill(0); anyAngleGeneration = 1;
  }
  const startIndex = startY * query.widthTiles + startX;
  const goalIndex = goalY * query.widthTiles + goalX;
  const open = new IndexHeap();
  anyAngleGenerations[startIndex] = anyAngleGeneration;
  anyAngleCosts[startIndex] = 0;
  anyAngleParents[startIndex] = startIndex;
  open.push(startIndex, euclideanTiles(startX, startY, goalX, goalY));
  let visited = 0;

  while (open.size > 0 && visited < maxVisited) {
    const currentIndex = open.pop();
    if (currentIndex === undefined || anyAngleClosedGenerations[currentIndex] === anyAngleGeneration) continue;
    anyAngleClosedGenerations[currentIndex] = anyAngleGeneration;
    visited += 1;
    if (currentIndex === goalIndex) return finalizeAnyAnglePath(start, goal, reconstructAnyAngle(currentIndex, startIndex, query), query);
    const currentX = currentIndex % query.widthTiles;
    const currentY = Math.floor(currentIndex / query.widthTiles);
    for (let deltaY = -1; deltaY <= 1; deltaY += 1) for (let deltaX = -1; deltaX <= 1; deltaX += 1) {
      if (deltaX === 0 && deltaY === 0) continue;
      const x = currentX + deltaX; const y = currentY + deltaY;
      if (!inNavigationBounds(x, y, query)) continue;
      const traversalCost = query.getTraversalCost(x, y);
      if (!Number.isFinite(traversalCost) || traversalCost <= 0) continue;
      if (deltaX !== 0 && deltaY !== 0 && (!Number.isFinite(query.getTraversalCost(currentX + deltaX, currentY)) || !Number.isFinite(query.getTraversalCost(currentX, currentY + deltaY)))) continue;
      if (!query.canTraverseEdge(currentX, currentY, x, y)) continue;
      const index = y * query.widthTiles + x;
      const currentParent: number = anyAngleParents[currentIndex]!;
      let parentIndex = currentIndex;
      let candidateCost = anyAngleCosts[currentIndex]! + Math.hypot(deltaX, deltaY) * traversalCost;
      if (currentParent !== currentIndex) {
        const parentX = currentParent % query.widthTiles;
        const parentY = Math.floor(currentParent / query.widthTiles);
        const parentPoint = tilePoint(parentX, parentY, query.tileSize);
        const nextPoint = tilePoint(x, y, query.tileSize);
        if (query.canTraverse(parentPoint, nextPoint)) {
          const shortcutCost = anyAngleCosts[currentParent]! + Math.hypot(x - parentX, y - parentY) * traversalCost;
          if (shortcutCost <= candidateCost) { candidateCost = shortcutCost; parentIndex = currentParent; }
        }
      }
      if (anyAngleGenerations[index] === anyAngleGeneration && candidateCost >= anyAngleCosts[index]!) continue;
      anyAngleGenerations[index] = anyAngleGeneration;
      anyAngleCosts[index] = candidateCost;
      anyAngleParents[index] = parentIndex;
      open.push(index, candidateCost + euclideanTiles(x, y, goalX, goalY));
    }
  }
  return [];
}

export function getPathfindingWorkspaceDiagnostics(): { tileCapacity: number; anyAngleCapacity: number } {
  return { tileCapacity: bestCosts.length, anyAngleCapacity: anyAngleCosts.length };
}

function ensureTileWorkspace(required: number): void {
  if (required <= bestCosts.length) return;
  const capacity = nextWorkspaceCapacity(required);
  bestCosts = new Uint32Array(capacity);
  bestGenerations = new Uint32Array(capacity);
  closedGenerations = new Uint32Array(capacity);
  pathGeneration = 0;
}

function ensureAnyAngleWorkspace(required: number): void {
  if (required <= anyAngleCosts.length) return;
  const capacity = nextWorkspaceCapacity(required);
  anyAngleCosts = new Float64Array(capacity);
  anyAngleParents = new Int32Array(capacity);
  anyAngleGenerations = new Uint32Array(capacity);
  anyAngleClosedGenerations = new Uint32Array(capacity);
  anyAngleGeneration = 0;
}

function nextWorkspaceCapacity(required: number): number {
  let capacity = CELL_COUNT;
  while (capacity < required) capacity *= 2;
  return capacity;
}

class IndexHeap {
  private readonly indices: number[] = [];
  private readonly priorities: number[] = [];
  get size(): number { return this.indices.length; }
  push(value: number, priority: number): void {
    let index = this.indices.length;
    this.indices.push(value); this.priorities.push(priority);
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.priorities[parent]! <= priority) break;
      this.indices[index] = this.indices[parent]!; this.priorities[index] = this.priorities[parent]!; index = parent;
    }
    this.indices[index] = value; this.priorities[index] = priority;
  }
  pop(): number | undefined {
    const root = this.indices[0];
    const lastValue = this.indices.pop(); const lastPriority = this.priorities.pop();
    if (root === undefined || lastValue === undefined || lastPriority === undefined || this.indices.length === 0) return root;
    let index = 0;
    while (true) {
      const left = index * 2 + 1; if (left >= this.indices.length) break;
      const right = left + 1;
      const smaller = right < this.indices.length && this.priorities[right]! < this.priorities[left]! ? right : left;
      if (this.priorities[smaller]! >= lastPriority) break;
      this.indices[index] = this.indices[smaller]!; this.priorities[index] = this.priorities[smaller]!; index = smaller;
    }
    this.indices[index] = lastValue; this.priorities[index] = lastPriority;
    return root;
  }
}

function reconstructAnyAngle(goalIndex: number, startIndex: number, query: NavigationQuery): Point[] {
  const reversed: Point[] = [];
  let cursor = goalIndex;
  for (let guard = 0; cursor !== startIndex && guard < query.widthTiles * query.heightTiles; guard += 1) {
    reversed.push(tilePoint(cursor % query.widthTiles, Math.floor(cursor / query.widthTiles), query.tileSize));
    const parent = anyAngleParents[cursor]!;
    if (parent === cursor) break;
    cursor = parent;
  }
  return reversed.reverse();
}

function finalizeAnyAnglePath(start: Point, goal: Point, path: Point[], query: NavigationQuery): Point[] {
  if (path.length === 0) return [];
  let goalAnchor = -1;
  for (let index = path.length - 1; index >= 0; index -= 1) {
    if (query.canTraverse(path[index]!, goal)) { goalAnchor = index; break; }
  }
  if (goalAnchor >= 0) path.splice(goalAnchor + 1, path.length, { x: goal.x, y: goal.y });
  else return [];
  const sparse: Point[] = [];
  let anchor = start;
  let index = 0;
  while (index < path.length) {
    let farthest = index;
    for (let probe = index + 1; probe < path.length; probe += 1) {
      if (!query.canTraverse(anchor, path[probe]!)) break;
      farthest = probe;
    }
    const point = path[farthest]!;
    sparse.push(point); anchor = point; index = farthest + 1;
  }
  return sparse;
}

function tilePoint(tileX: number, tileY: number, tileSize: number): Point {
  return { x: tileX * tileSize + tileSize / 2, y: tileY * tileSize + tileSize / 2 };
}
function euclideanTiles(x: number, y: number, goalX: number, goalY: number): number { return Math.hypot(goalX - x, goalY - y); }
function inNavigationBounds(x: number, y: number, query: NavigationQuery): boolean { return x >= 0 && y >= 0 && x < query.widthTiles && y < query.heightTiles; }
