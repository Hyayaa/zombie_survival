import { deterministicHash } from "../core/seeded-rng";
import type { SavedFogExploration } from "../core/save-state";
import { decodeExploredFog, encodeExploredFog } from "./fog-save-codec";

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

const OCTANTS = [
  [1, 0, 0, 1],
  [0, 1, 1, 0],
  [0, -1, 1, 0],
  [-1, 0, 0, 1],
  [-1, 0, 0, -1],
  [0, -1, -1, 0],
  [0, 1, -1, 0],
  [1, 0, 0, -1],
] as const;

const SOURCE_SALTS = {
  player: 0x13579b,
  torch: 0x2468ac,
  flashlight: 0x3579bd,
  fire: 0x468ace,
} as const;

export class FogOfWarSystem {
  readonly widthCells: number;
  readonly heightCells: number;
  private readonly explored: Uint8Array;
  private readonly visibleGeneration: Uint32Array;
  private currentVisible: number[] = [];
  private previousVisible: number[] = [];
  private readonly changedIndices: number[] = [];
  private generation = 1;

  constructor(readonly widthPixels: number, readonly heightPixels: number, readonly cellSize: number, private readonly seed: number) {
    this.widthCells = Math.ceil(widthPixels / cellSize);
    this.heightCells = Math.ceil(heightPixels / cellSize);
    const cells = this.widthCells * this.heightCells;
    this.explored = new Uint8Array(cells);
    this.visibleGeneration = new Uint32Array(cells);
  }

  recompute(sources: readonly VisionSource[], grid: VisionGrid): number {
    let previousGeneration = this.generation;
    if (this.generation === 0xffff_ffff) {
      this.visibleGeneration.fill(0);
      this.generation = 1;
      previousGeneration = 0xffff_ffff;
    } else {
      this.generation += 1;
    }

    const reuse = this.previousVisible;
    this.previousVisible = this.currentVisible;
    this.currentVisible = reuse;
    this.currentVisible.length = 0;
    this.changedIndices.length = 0;

    for (const source of sources) this.propagate(source, grid, previousGeneration);

    for (const index of this.previousVisible) {
      if (this.visibleGeneration[index] !== this.generation) this.changedIndices.push(index);
    }
    return this.changedIndices.length;
  }

  getStateAtCell(x: number, y: number): VisibilityState {
    if (!this.inBounds(x, y)) return VisibilityState.Unknown;
    const index = this.index(x, y);
    if (this.visibleGeneration[index] === this.generation) return VisibilityState.Visible;
    return this.explored[index] ? VisibilityState.Explored : VisibilityState.Unknown;
  }

  getStateAtWorld(x: number, y: number): VisibilityState {
    return this.getStateAtCell(Math.floor(x / this.cellSize), Math.floor(y / this.cellSize));
  }

  getChangedIndices(): readonly number[] {
    return this.changedIndices;
  }

  exportExplored(): SavedFogExploration {
    return encodeExploredFog(this.explored, this.cellSize);
  }

  importExplored(exploration: SavedFogExploration): boolean {
    return decodeExploredFog(exploration, this.explored);
  }

  private propagate(source: VisionSource, grid: VisionGrid, previousGeneration: number): void {
    const sourceX = Math.floor(source.x / this.cellSize);
    const sourceY = Math.floor(source.y / this.cellSize);
    if (!this.inBounds(sourceX, sourceY)) return;
    const radius = Math.max(1, source.radius / this.cellSize * Math.max(0.25, source.intensity));
    const radiusCells = Math.ceil(radius);
    const radiusSquared = radius * radius;
    const sourceSalt = this.seed + SOURCE_SALTS[source.sourceType];

    this.markVisible(sourceX, sourceY, previousGeneration);
    for (const [xx, xy, yx, yy] of OCTANTS) {
      this.castOctant(source, grid, previousGeneration, sourceX, sourceY, 1, 1, 0, radiusCells, radiusSquared, sourceSalt, xx, xy, yx, yy);
    }
  }

  private castOctant(
    source: VisionSource,
    grid: VisionGrid,
    previousGeneration: number,
    originX: number,
    originY: number,
    row: number,
    startSlope: number,
    endSlope: number,
    radiusCells: number,
    radiusSquared: number,
    sourceSalt: number,
    xx: number,
    xy: number,
    yx: number,
    yy: number,
  ): void {
    if (startSlope < endSlope) return;
    let nextStartSlope = startSlope;

    for (let distance = row; distance <= radiusCells; distance += 1) {
      let blocked = false;
      const deltaY = -distance;
      for (let deltaX = -distance; deltaX <= 0; deltaX += 1) {
        const cellX = originX + deltaX * xx + deltaY * xy;
        const cellY = originY + deltaX * yx + deltaY * yy;
        const leftSlope = (deltaX - 0.5) / (deltaY + 0.5);
        const rightSlope = (deltaX + 0.5) / (deltaY - 0.5);

        if (startSlope < rightSlope) continue;
        if (endSlope > leftSlope) break;
        if (!this.inBounds(cellX, cellY)) continue;

        const sealedCorner = this.isSealedCorner(originX, originY, cellX, cellY, grid);
        const distanceSquared = deltaX * deltaX + deltaY * deltaY;
        if (!sealedCorner && distanceSquared <= radiusSquared) {
          const distanceCells = Math.sqrt(distanceSquared);
          this.markCandidate(source, cellX, cellY, Math.sqrt(distanceSquared / radiusSquared), distanceCells, sourceSalt, previousGeneration);
        }

        const opaque = sealedCorner || grid.blocksVision(cellX, cellY);
        if (blocked) {
          if (opaque) {
            nextStartSlope = rightSlope;
            continue;
          }
          blocked = false;
          startSlope = nextStartSlope;
        } else if (opaque && distance < radiusCells) {
          blocked = true;
          this.castOctant(
            source,
            grid,
            previousGeneration,
            originX,
            originY,
            distance + 1,
            startSlope,
            leftSlope,
            radiusCells,
            radiusSquared,
            sourceSalt,
            xx,
            xy,
            yx,
            yy,
          );
          nextStartSlope = rightSlope;
        }
      }
      if (blocked) break;
    }
  }

  private markCandidate(source: VisionSource, cellX: number, cellY: number, radiusRatio: number, distanceCells: number, sourceSalt: number, previousGeneration: number): void {
    if (!this.inCone(source, cellX, cellY)) return;
    if (distanceCells <= 5) {
      this.markVisible(cellX, cellY, previousGeneration);
      return;
    }
    const clusterNoise = deterministicHash(Math.floor(cellX / 2), Math.floor(cellY / 2), sourceSalt);
    const detailNoise = deterministicHash(cellX, cellY, sourceSalt ^ 0x5bd1e995);
    const irregularEdge = 0.76 + (clusterNoise - 0.5) * 0.13 + (detailNoise - 0.5) * 0.018;
    if (radiusRatio <= 0.73 || radiusRatio <= irregularEdge) this.markVisible(cellX, cellY, previousGeneration);
  }

  private isSealedCorner(originX: number, originY: number, cellX: number, cellY: number, grid: VisionGrid): boolean {
    const stepX = Math.sign(originX - cellX);
    const stepY = Math.sign(originY - cellY);
    if (stepX === 0 || stepY === 0) return false;
    return grid.blocksVision(cellX + stepX, cellY) && grid.blocksVision(cellX, cellY + stepY);
  }

  private markVisible(cellX: number, cellY: number, previousGeneration: number): void {
    const index = this.index(cellX, cellY);
    if (this.visibleGeneration[index] === this.generation) return;
    const wasVisible = this.visibleGeneration[index] === previousGeneration;
    this.visibleGeneration[index] = this.generation;
    this.explored[index] = 1;
    this.currentVisible.push(index);
    if (!wasVisible) this.changedIndices.push(index);
  }

  private inCone(source: VisionSource, cellX: number, cellY: number): boolean {
    if (source.direction === undefined || source.coneAngle === undefined) return true;
    const worldX = (cellX + 0.5) * this.cellSize;
    const worldY = (cellY + 0.5) * this.cellSize;
    if (Math.hypot(worldX - source.x, worldY - source.y) <= this.cellSize) return true;
    const angle = Math.atan2(worldY - source.y, worldX - source.x);
    return Math.abs(normalizeAngle(angle - source.direction)) <= source.coneAngle / 2;
  }

  private inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.widthCells && y < this.heightCells;
  }

  private index(x: number, y: number): number {
    return y * this.widthCells + x;
  }
}

function normalizeAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}
