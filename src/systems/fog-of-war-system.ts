import { deterministicHash } from "../core/seeded-rng";

export enum VisibilityState {
  Unknown = 0,
  Explored = 1,
  Visible = 2,
}

export interface VisionSource {
  x: number;
  y: number;
  radius: number;
  intensity: number;
  sourceType: "player" | "torch" | "flashlight" | "fire";
  direction?: number;
  coneAngle?: number;
}

export interface VisionGrid {
  blocksVision(cellX: number, cellY: number): boolean;
  additionalCost(cellX: number, cellY: number): number;
}

interface QueueNode {
  x: number;
  y: number;
  cost: number;
}

const NEIGHBORS = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, 1.42], [1, -1, 1.42], [-1, 1, 1.42], [-1, -1, 1.42],
] as const;

export class FogOfWarSystem {
  readonly widthCells: number;
  readonly heightCells: number;
  private readonly states: Uint8Array;

  constructor(readonly widthPixels: number, readonly heightPixels: number, readonly cellSize: number, private readonly seed: number) {
    this.widthCells = Math.ceil(widthPixels / cellSize);
    this.heightCells = Math.ceil(heightPixels / cellSize);
    this.states = new Uint8Array(this.widthCells * this.heightCells);
  }

  recompute(sources: readonly VisionSource[], grid: VisionGrid): void {
    for (let index = 0; index < this.states.length; index += 1) {
      if (this.states[index] === VisibilityState.Visible) this.states[index] = VisibilityState.Explored;
    }
    sources.forEach((source, sourceIndex) => this.propagate(source, grid, sourceIndex));
  }

  getStateAtCell(x: number, y: number): VisibilityState {
    if (!this.inBounds(x, y)) return VisibilityState.Unknown;
    return this.states[this.index(x, y)] as VisibilityState;
  }

  getStateAtWorld(x: number, y: number): VisibilityState {
    return this.getStateAtCell(Math.floor(x / this.cellSize), Math.floor(y / this.cellSize));
  }

  exportExplored(): number[] {
    const explored: number[] = [];
    for (let index = 0; index < this.states.length; index += 1) {
      if (this.states[index] !== VisibilityState.Unknown) explored.push(index);
    }
    return explored;
  }

  importExplored(indices: readonly number[]): void {
    indices.forEach((index) => {
      if (Number.isInteger(index) && index >= 0 && index < this.states.length) this.states[index] = VisibilityState.Explored;
    });
  }

  private propagate(source: VisionSource, grid: VisionGrid, sourceIndex: number): void {
    const sourceX = Math.floor(source.x / this.cellSize);
    const sourceY = Math.floor(source.y / this.cellSize);
    const maxCost = Math.max(1, source.radius / this.cellSize) * Math.max(0.25, source.intensity);
    const best = new Float32Array(this.states.length);
    best.fill(Number.POSITIVE_INFINITY);
    const queue = new MinHeap();
    queue.push({ x: sourceX, y: sourceY, cost: 0 });
    if (this.inBounds(sourceX, sourceY)) best[this.index(sourceX, sourceY)] = 0;

    while (queue.size > 0) {
      const current = queue.pop();
      if (!current || current.cost > maxCost || !this.inBounds(current.x, current.y)) continue;
      const currentIndex = this.index(current.x, current.y);
      if (current.cost > best[currentIndex]) continue;
      if (!this.inCone(source, current.x, current.y)) continue;
      if (!this.hasGridLineOfSight(sourceX, sourceY, current.x, current.y, grid)) continue;

      const ratio = current.cost / maxCost;
      const fringeDrop = ratio > 0.7 && deterministicHash(current.x, current.y, this.seed + sourceIndex * 977) < (ratio - 0.7) * 1.45;
      const blocked = grid.blocksVision(current.x, current.y);
      if (!fringeDrop || current.cost < 2) this.states[currentIndex] = VisibilityState.Visible;
      if (blocked || fringeDrop) continue;

      for (const [deltaX, deltaY, moveCost] of NEIGHBORS) {
        const x = current.x + deltaX;
        const y = current.y + deltaY;
        if (!this.inBounds(x, y)) continue;
        const cost = current.cost + moveCost + grid.additionalCost(x, y);
        const index = this.index(x, y);
        if (cost >= best[index] || cost > maxCost) continue;
        best[index] = cost;
        queue.push({ x, y, cost });
      }
    }
  }

  private inCone(source: VisionSource, cellX: number, cellY: number): boolean {
    if (source.direction === undefined || source.coneAngle === undefined) return true;
    const worldX = (cellX + 0.5) * this.cellSize;
    const worldY = (cellY + 0.5) * this.cellSize;
    if (Math.hypot(worldX - source.x, worldY - source.y) <= this.cellSize) return true;
    const angle = Math.atan2(worldY - source.y, worldX - source.x);
    return Math.abs(normalizeAngle(angle - source.direction)) <= source.coneAngle / 2;
  }

  private hasGridLineOfSight(fromX: number, fromY: number, toX: number, toY: number, grid: VisionGrid): boolean {
    let x = fromX;
    let y = fromY;
    const deltaX = Math.abs(toX - fromX);
    const deltaY = Math.abs(toY - fromY);
    const stepX = fromX < toX ? 1 : -1;
    const stepY = fromY < toY ? 1 : -1;
    let error = deltaX - deltaY;

    while (x !== toX || y !== toY) {
      const doubleError = error * 2;
      if (doubleError > -deltaY) { error -= deltaY; x += stepX; }
      if (doubleError < deltaX) { error += deltaX; y += stepY; }
      if ((x !== toX || y !== toY) && grid.blocksVision(x, y)) return false;
    }
    return true;
  }

  private inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.widthCells && y < this.heightCells;
  }

  private index(x: number, y: number): number {
    return y * this.widthCells + x;
  }
}

class MinHeap {
  private readonly nodes: QueueNode[] = [];
  get size(): number { return this.nodes.length; }

  push(node: QueueNode): void {
    this.nodes.push(node);
    let index = this.nodes.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      const parentNode = this.nodes[parent];
      if (!parentNode || parentNode.cost <= node.cost) break;
      this.nodes[index] = parentNode;
      index = parent;
    }
    this.nodes[index] = node;
  }

  pop(): QueueNode | undefined {
    const root = this.nodes[0];
    const last = this.nodes.pop();
    if (!root || !last || this.nodes.length === 0) return root;
    this.nodes[0] = last;
    let index = 0;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      let smallest = index;
      if (this.nodes[left] && this.nodes[left]!.cost < this.nodes[smallest]!.cost) smallest = left;
      if (this.nodes[right] && this.nodes[right]!.cost < this.nodes[smallest]!.cost) smallest = right;
      if (smallest === index) break;
      [this.nodes[index], this.nodes[smallest]] = [this.nodes[smallest]!, this.nodes[index]!];
      index = smallest;
    }
    return root;
  }
}

function normalizeAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}
