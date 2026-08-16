import { FOG_CELLS_PER_TILE, MAP_HEIGHT_TILES, MAP_WIDTH_TILES, OBSTACLE_BALANCE, TILE_SIZE } from "../config/game-config";
import type { DoorDefinition, WorldObstacle } from "../data/map-definitions";
import {
  circleIntersectsThickSegment,
  segmentIntersectsThickSegment,
  visitSegmentTiles,
  type SegmentGeometry,
} from "./collision-geometry";
import type { VisionGrid } from "./fog-of-war-system";
import type { Point } from "./zombie-ai-system";

const VISION_CELLS_PER_TILE = FOG_CELLS_PER_TILE;
const SEGMENT_BUCKET_PADDING = 12;

interface SegmentCollider {
  geometry: SegmentGeometry;
  doorIndex: number;
}

export class CollisionSystem implements VisionGrid {
  private readonly doors: DoorDefinition[];
  private readonly staticObstacles: readonly WorldObstacle[];
  private readonly dynamicObstacles: WorldObstacle[] = [];
  private readonly movementGrid: Uint8Array;
  private readonly staticMovementGrid: Uint8Array;
  private readonly doorIndexGrid: Int16Array;
  private readonly dynamicBarricadeCounts: Uint16Array;
  private readonly dynamicHardCounts: Uint16Array;
  private readonly visionGrid: Uint8Array;
  private readonly projectileGrid: Uint8Array;
  private readonly lowCoverGrid: Uint8Array;
  private readonly visionBlockCells: Uint8Array;
  private readonly lowCoverCells: Uint8Array;
  private readonly segmentVisionCounts: Uint16Array;
  private readonly visionWidthCells: number;
  private readonly visionHeightCells: number;
  private readonly segmentColliders: SegmentCollider[] = [];
  private readonly segmentBuckets: number[][];
  private segmentMarkers = new Uint32Array(0);
  private segmentQueryGeneration = 0;
  private readonly doorSegmentIndices: Int32Array;
  private readonly doorSegmentActive: Uint8Array;
  private visionRevisionValue = 0;

  constructor(
    obstacles: WorldObstacle[],
    doors: DoorDefinition[],
    private readonly widthTiles = MAP_WIDTH_TILES,
    private readonly heightTiles = MAP_HEIGHT_TILES,
    private readonly tileSize = TILE_SIZE,
    wallSegments: readonly SegmentGeometry[] = [],
  ) {
    this.doors = doors;
    this.staticObstacles = obstacles;
    const tileCount = widthTiles * heightTiles;
    this.movementGrid = new Uint8Array(tileCount);
    this.staticMovementGrid = new Uint8Array(tileCount);
    this.doorIndexGrid = new Int16Array(tileCount).fill(-1);
    this.dynamicBarricadeCounts = new Uint16Array(tileCount);
    this.dynamicHardCounts = new Uint16Array(tileCount);
    this.visionGrid = new Uint8Array(tileCount);
    this.projectileGrid = new Uint8Array(tileCount);
    this.lowCoverGrid = new Uint8Array(tileCount);
    this.visionWidthCells = widthTiles * VISION_CELLS_PER_TILE;
    this.visionHeightCells = heightTiles * VISION_CELLS_PER_TILE;
    this.visionBlockCells = new Uint8Array(this.visionWidthCells * this.visionHeightCells);
    this.lowCoverCells = new Uint8Array(this.visionWidthCells * this.visionHeightCells);
    this.segmentVisionCounts = new Uint16Array(this.visionWidthCells * this.visionHeightCells);
    this.segmentBuckets = Array.from({ length: tileCount }, () => []);
    this.doorSegmentIndices = new Int32Array(doors.length).fill(-1);
    this.doorSegmentActive = new Uint8Array(doors.length);
    obstacles.forEach((obstacle) => {
      this.markObstacle(obstacle, true);
      if (obstacle.blocksMovement) this.markStaticMovement(obstacle);
    });
    for (const segment of wallSegments) this.addSegmentCollider(segment, -1);
    doors.forEach((door, doorIndex) => {
      this.doorIndexGrid[this.index(door.tileX, door.tileY)] = doorIndex;
      if (door.segment) this.doorSegmentIndices[doorIndex] = this.addSegmentCollider(door.segment, doorIndex);
      this.rebuildTile(door.tileX, door.tileY);
    });
    this.segmentMarkers = new Uint32Array(this.segmentColliders.length);
    for (let index = 0; index < this.segmentColliders.length; index += 1) {
      const collider = this.segmentColliders[index]!;
      if (!this.isSegmentActive(collider)) continue;
      if (collider.doorIndex >= 0) this.doorSegmentActive[collider.doorIndex] = 1;
      this.adjustSegmentVision(index, 1, false);
    }
  }

  addDynamicObstacle(obstacle: WorldObstacle): void {
    this.dynamicObstacles.push(obstacle);
    this.adjustDynamicTraversal(obstacle, 1);
    this.rebuildObstacleTiles(obstacle);
  }

  removeDynamicObstacle(id: string): boolean {
    const index = this.dynamicObstacles.findIndex((obstacle) => obstacle.id === id);
    if (index < 0) return false;
    const [removed] = this.dynamicObstacles.splice(index, 1);
    if (removed) {
      this.adjustDynamicTraversal(removed, -1);
      this.rebuildObstacleTiles(removed);
    }
    return true;
  }

  getDynamicObstacles(): readonly WorldObstacle[] {
    return this.dynamicObstacles;
  }

  get visionRevision(): number {
    return this.visionRevisionValue;
  }

  setDoorOpen(id: string, open: boolean): void {
    const doorIndex = this.doors.findIndex((candidate) => candidate.id === id);
    if (doorIndex < 0) return;
    const door = this.doors[doorIndex]!;
    door.open = door.destroyed ? true : open;
    const isClosed = !door.open && !door.destroyed;
    this.updateDoorSegmentState(doorIndex, isClosed);
    this.rebuildTile(door.tileX, door.tileY);
  }

  setDoorDestroyed(id: string): boolean {
    const doorIndex = this.doors.findIndex((candidate) => candidate.id === id);
    if (doorIndex < 0) return false;
    const door = this.doors[doorIndex]!;
    const destroyedNow = !door.destroyed;
    door.destroyed = true;
    door.health = 0;
    door.open = true;
    this.updateDoorSegmentState(doorIndex, false);
    this.rebuildTile(door.tileX, door.tileY);
    return destroyedNow;
  }

  isMovementBlockedWorld(x: number, y: number, radius = 0): boolean {
    if (x - radius < 0 || y - radius < 0 || x + radius >= this.widthTiles * this.tileSize || y + radius >= this.heightTiles * this.tileSize) return true;
    const minTileX = Math.floor((x - radius) / this.tileSize);
    const maxTileX = Math.floor((x + radius) / this.tileSize);
    const minTileY = Math.floor((y - radius) / this.tileSize);
    const maxTileY = Math.floor((y + radius) / this.tileSize);
    for (let tileY = minTileY; tileY <= maxTileY; tileY += 1) {
      for (let tileX = minTileX; tileX <= maxTileX; tileX += 1) {
        if (!this.movementGrid[this.index(tileX, tileY)]) continue;
        if (circleIntersectsTile(x, y, radius, tileX, tileY, this.tileSize)) return true;
      }
    }
    return this.circleHitsIndexedSegment(x, y, radius, minTileX, minTileY, maxTileX, maxTileY);
  }

  canOccupyCircle(x: number, y: number, radius: number): boolean {
    return !this.isMovementBlockedWorld(x, y, radius);
  }

  canTraverseCircle(from: Point, to: Point, radius: number, sampleStep = 4): boolean {
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    const steps = Math.max(1, Math.ceil(distance / sampleStep));
    for (let step = 1; step <= steps; step += 1) {
      const amount = step / steps;
      if (this.isMovementBlockedWorld(
        from.x + (to.x - from.x) * amount,
        from.y + (to.y - from.y) * amount,
        radius,
      )) return false;
    }
    return true;
  }

  moveCircle(position: Point, deltaX: number, deltaY: number, radius: number): Point {
    let x = position.x;
    let y = position.y;
    const horizontalTarget = { x: x + deltaX, y };
    if (!this.isMovementBlockedWorld(horizontalTarget.x, horizontalTarget.y, radius)
      && !this.traversalHitsIndexedSegment({ x, y }, horizontalTarget, radius, false)) x = horizontalTarget.x;
    const verticalTarget = { x, y: y + deltaY };
    if (!this.isMovementBlockedWorld(verticalTarget.x, verticalTarget.y, radius)
      && !this.traversalHitsIndexedSegment({ x, y }, verticalTarget, radius, false)) y = verticalTarget.y;
    return { x, y };
  }

  blocksVisionWorld(x: number, y: number): boolean {
    if (this.gridValue(this.visionGrid, x, y)) return true;
    return this.pointHitsIndexedSegment(x, y);
  }

  visionCostWorld(x: number, y: number): number {
    return this.gridValue(this.lowCoverGrid, x, y) ? 0.65 : 0;
  }

  blocksVision(cellX: number, cellY: number): boolean {
    if (!this.isVisionCellInBounds(cellX, cellY)) return true;
    return this.visionBlockCells[this.visionCellIndex(cellX, cellY)] === 1;
  }

  additionalCost(cellX: number, cellY: number): number {
    if (!this.isVisionCellInBounds(cellX, cellY)) return 0;
    return this.lowCoverCells[this.visionCellIndex(cellX, cellY)] ? 0.65 : 0;
  }

  blocksProjectilesWorld(x: number, y: number): boolean {
    if (this.gridValue(this.projectileGrid, x, y)) return true;
    return this.pointHitsIndexedSegment(x, y);
  }

  hasLineOfSight(from: Point, to: Point, sampleStep = 6): boolean {
    if (this.traversalHitsIndexedSegment(from, to, 0, false)) return false;
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    const steps = Math.max(1, Math.ceil(distance / sampleStep));
    for (let step = 1; step < steps; step += 1) {
      const amount = step / steps;
      if (this.blocksVisionWorld(from.x + (to.x - from.x) * amount, from.y + (to.y - from.y) * amount)) return false;
    }
    return true;
  }

  firstProjectileCollision(from: Point, to: Point, sampleStep = 4): Point | null {
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    const steps = Math.max(1, Math.ceil(distance / Math.min(sampleStep, 2)));
    for (let step = 1; step <= steps; step += 1) {
      const amount = step / steps;
      const point = { x: from.x + (to.x - from.x) * amount, y: from.y + (to.y - from.y) * amount };
      if (this.blocksProjectilesWorld(point.x, point.y)) return point;
    }
    return null;
  }

  isTileBlocked(tileX: number, tileY: number): boolean {
    if (tileX < 0 || tileY < 0 || tileX >= this.widthTiles || tileY >= this.heightTiles) return true;
    return this.movementGrid[this.index(tileX, tileY)] === 1;
  }

  canTraverseTileEdge(
    fromTileX: number,
    fromTileY: number,
    toTileX: number,
    toTileY: number,
    radius: number,
    allowClosedDoors = false,
  ): boolean {
    const from = { x: fromTileX * this.tileSize + this.tileSize / 2, y: fromTileY * this.tileSize + this.tileSize / 2 };
    const to = { x: toTileX * this.tileSize + this.tileSize / 2, y: toTileY * this.tileSize + this.tileSize / 2 };
    return !this.traversalHitsIndexedSegment(from, to, radius, allowClosedDoors);
  }

  isHardBlockedTile(tileX: number, tileY: number): boolean {
    if (!this.inBounds(tileX, tileY)) return true;
    const index = this.index(tileX, tileY);
    return this.staticMovementGrid[index] === 1 || this.dynamicHardCounts[index]! > 0;
  }

  getZombieTraversalCost(tileX: number, tileY: number): number {
    if (!this.inBounds(tileX, tileY)) return Number.POSITIVE_INFINITY;
    const index = this.index(tileX, tileY);
    if (this.staticMovementGrid[index] === 1 || this.dynamicHardCounts[index]! > 0) return Number.POSITIVE_INFINITY;
    const doorIndex = this.doorIndexGrid[index]!;
    const door = doorIndex >= 0 ? this.doors[doorIndex] : undefined;
    if (door && !door.open && !door.destroyed) return OBSTACLE_BALANCE.doorTraversalCost;
    if (this.dynamicBarricadeCounts[index]! > 0) return OBSTACLE_BALANCE.barricadeTraversalCost;
    return 1;
  }

  private markObstacle(obstacle: WorldObstacle, value: boolean): void {
    let visionChanged = false;
    for (let y = obstacle.tileY; y < obstacle.tileY + obstacle.heightTiles; y += 1) {
      for (let x = obstacle.tileX; x < obstacle.tileX + obstacle.widthTiles; x += 1) {
        if (x < 0 || y < 0 || x >= this.widthTiles || y >= this.heightTiles) continue;
        const index = this.index(x, y);
        if (obstacle.blocksMovement) this.movementGrid[index] = value ? 1 : 0;
        if (obstacle.blocksVision) this.visionGrid[index] = value ? 1 : 0;
        if (obstacle.blocksProjectiles) this.projectileGrid[index] = value ? 1 : 0;
        if (obstacle.coverHeight === "low") this.lowCoverGrid[index] = value ? 1 : 0;
        visionChanged = this.syncVisionCellsForTile(x, y) || visionChanged;
      }
    }
    if (visionChanged) this.visionRevisionValue += 1;
  }

  private rebuildObstacleTiles(obstacle: WorldObstacle): void {
    for (let y = obstacle.tileY; y < obstacle.tileY + obstacle.heightTiles; y += 1) {
      for (let x = obstacle.tileX; x < obstacle.tileX + obstacle.widthTiles; x += 1) this.rebuildTile(x, y);
    }
  }

  private markStaticMovement(obstacle: WorldObstacle): void {
    for (let y = obstacle.tileY; y < obstacle.tileY + obstacle.heightTiles; y += 1) {
      for (let x = obstacle.tileX; x < obstacle.tileX + obstacle.widthTiles; x += 1) {
        if (this.inBounds(x, y)) this.staticMovementGrid[this.index(x, y)] = 1;
      }
    }
  }

  private adjustDynamicTraversal(obstacle: WorldObstacle, amount: 1 | -1): void {
    if (!obstacle.blocksMovement) return;
    const grid = obstacle.kind === "barricade" ? this.dynamicBarricadeCounts : this.dynamicHardCounts;
    for (let y = obstacle.tileY; y < obstacle.tileY + obstacle.heightTiles; y += 1) {
      for (let x = obstacle.tileX; x < obstacle.tileX + obstacle.widthTiles; x += 1) {
        if (!this.inBounds(x, y)) continue;
        const index = this.index(x, y);
        grid[index] = Math.max(0, grid[index]! + amount);
      }
    }
  }

  private rebuildTile(tileX: number, tileY: number): void {
    if (!this.inBounds(tileX, tileY)) return;
    let blocksMovement = false;
    let blocksVision = false;
    let blocksProjectiles = false;
    let lowCover = false;
    const applyObstacle = (obstacle: WorldObstacle): void => {
      if (!containsTile(obstacle, tileX, tileY)) return;
      blocksMovement ||= obstacle.blocksMovement;
      blocksVision ||= obstacle.blocksVision;
      blocksProjectiles ||= obstacle.blocksProjectiles;
      lowCover ||= obstacle.coverHeight === "low";
    };
    for (const obstacle of this.staticObstacles) applyObstacle(obstacle);
    for (const obstacle of this.dynamicObstacles) applyObstacle(obstacle);
    const door = this.doors.find((candidate) => candidate.tileX === tileX && candidate.tileY === tileY);
    if (door && !door.segment && !door.open && !door.destroyed) {
      blocksMovement = true;
      blocksVision = true;
      blocksProjectiles = true;
    }
    const index = this.index(tileX, tileY);
    this.movementGrid[index] = blocksMovement ? 1 : 0;
    this.visionGrid[index] = blocksVision ? 1 : 0;
    this.projectileGrid[index] = blocksProjectiles ? 1 : 0;
    this.lowCoverGrid[index] = lowCover ? 1 : 0;
    if (this.syncVisionCellsForTile(tileX, tileY)) this.visionRevisionValue += 1;
  }

  private syncVisionCellsForTile(tileX: number, tileY: number): boolean {
    const tileIndex = this.index(tileX, tileY);
    const blocks = this.visionGrid[tileIndex] ?? 0;
    const lowCover = this.lowCoverGrid[tileIndex] ?? 0;
    const startX = tileX * VISION_CELLS_PER_TILE;
    const startY = tileY * VISION_CELLS_PER_TILE;
    let changed = false;
    for (let offsetY = 0; offsetY < VISION_CELLS_PER_TILE; offsetY += 1) {
      for (let offsetX = 0; offsetX < VISION_CELLS_PER_TILE; offsetX += 1) {
        const index = this.visionCellIndex(startX + offsetX, startY + offsetY);
        const combinedBlocks = blocks || this.segmentVisionCounts[index]! > 0 ? 1 : 0;
        if (this.visionBlockCells[index] !== combinedBlocks || this.lowCoverCells[index] !== lowCover) changed = true;
        this.visionBlockCells[index] = combinedBlocks;
        this.lowCoverCells[index] = lowCover;
      }
    }
    return changed;
  }

  private addSegmentCollider(geometry: SegmentGeometry, doorIndex: number): number {
    const segmentIndex = this.segmentColliders.length;
    this.segmentColliders.push({ geometry, doorIndex });
    visitSegmentTiles(geometry, this.tileSize, this.widthTiles, this.heightTiles, (tileX, tileY) => {
      this.segmentBuckets[this.index(tileX, tileY)]!.push(segmentIndex);
    }, SEGMENT_BUCKET_PADDING);
    return segmentIndex;
  }

  private isSegmentActive(collider: SegmentCollider): boolean {
    if (collider.doorIndex < 0) return true;
    const door = this.doors[collider.doorIndex];
    return Boolean(door && !door.open && !door.destroyed);
  }

  private updateDoorSegmentState(doorIndex: number, isClosed: boolean): void {
    const wasClosed = this.doorSegmentActive[doorIndex] === 1;
    if (wasClosed === isClosed) return;
    this.doorSegmentActive[doorIndex] = isClosed ? 1 : 0;
    const segmentIndex = this.doorSegmentIndices[doorIndex]!;
    if (segmentIndex >= 0) this.adjustSegmentVision(segmentIndex, isClosed ? 1 : -1, true);
  }

  private adjustSegmentVision(segmentIndex: number, amount: 1 | -1, incrementRevision: boolean): void {
    const segment = this.segmentColliders[segmentIndex]?.geometry;
    if (!segment) return;
    const cellSize = this.tileSize / VISION_CELLS_PER_TILE;
    const padding = Math.SQRT2 * cellSize / 2;
    const minCellX = Math.max(0, Math.floor((Math.min(segment.startX, segment.endX) - segment.thickness / 2 - padding) / cellSize));
    const minCellY = Math.max(0, Math.floor((Math.min(segment.startY, segment.endY) - segment.thickness / 2 - padding) / cellSize));
    const maxCellX = Math.min(this.visionWidthCells - 1, Math.floor((Math.max(segment.startX, segment.endX) + segment.thickness / 2 + padding) / cellSize));
    const maxCellY = Math.min(this.visionHeightCells - 1, Math.floor((Math.max(segment.startY, segment.endY) + segment.thickness / 2 + padding) / cellSize));
    let changed = false;
    for (let cellY = minCellY; cellY <= maxCellY; cellY += 1) {
      for (let cellX = minCellX; cellX <= maxCellX; cellX += 1) {
        const worldX = (cellX + 0.5) * cellSize;
        const worldY = (cellY + 0.5) * cellSize;
        if (!circleIntersectsThickSegment(worldX, worldY, padding, segment)) continue;
        const index = this.visionCellIndex(cellX, cellY);
        const previous = this.segmentVisionCounts[index]!;
        this.segmentVisionCounts[index] = Math.max(0, previous + amount);
        const tileX = Math.floor(cellX / VISION_CELLS_PER_TILE);
        const tileY = Math.floor(cellY / VISION_CELLS_PER_TILE);
        const next = this.visionGrid[this.index(tileX, tileY)] || this.segmentVisionCounts[index]! > 0 ? 1 : 0;
        if (this.visionBlockCells[index] !== next) changed = true;
        this.visionBlockCells[index] = next;
      }
    }
    if (incrementRevision && changed) this.visionRevisionValue += 1;
  }

  private beginSegmentQuery(): number {
    this.segmentQueryGeneration += 1;
    if (this.segmentQueryGeneration >= 0xffff_ffff) {
      this.segmentMarkers.fill(0);
      this.segmentQueryGeneration = 1;
    }
    return this.segmentQueryGeneration;
  }

  private circleHitsIndexedSegment(x: number, y: number, radius: number, minTileX: number, minTileY: number, maxTileX: number, maxTileY: number): boolean {
    const generation = this.beginSegmentQuery();
    for (let tileY = minTileY; tileY <= maxTileY; tileY += 1) {
      for (let tileX = minTileX; tileX <= maxTileX; tileX += 1) {
        const bucket = this.segmentBuckets[this.index(tileX, tileY)]!;
        for (let bucketIndex = 0; bucketIndex < bucket.length; bucketIndex += 1) {
          const segmentIndex = bucket[bucketIndex]!;
          if (this.segmentMarkers[segmentIndex] === generation) continue;
          this.segmentMarkers[segmentIndex] = generation;
          const collider = this.segmentColliders[segmentIndex]!;
          if (this.isSegmentActive(collider) && circleIntersectsThickSegment(x, y, radius, collider.geometry)) return true;
        }
      }
    }
    return false;
  }

  private pointHitsIndexedSegment(x: number, y: number): boolean {
    const tileX = Math.floor(x / this.tileSize);
    const tileY = Math.floor(y / this.tileSize);
    if (!this.inBounds(tileX, tileY)) return true;
    return this.circleHitsIndexedSegment(x, y, 0, tileX, tileY, tileX, tileY);
  }

  private traversalHitsIndexedSegment(from: Point, to: Point, radius: number, allowClosedDoors: boolean): boolean {
    const minTileX = Math.max(0, Math.floor((Math.min(from.x, to.x) - radius) / this.tileSize));
    const minTileY = Math.max(0, Math.floor((Math.min(from.y, to.y) - radius) / this.tileSize));
    const maxTileX = Math.min(this.widthTiles - 1, Math.floor((Math.max(from.x, to.x) + radius) / this.tileSize));
    const maxTileY = Math.min(this.heightTiles - 1, Math.floor((Math.max(from.y, to.y) + radius) / this.tileSize));
    const movement: SegmentGeometry = { startX: from.x, startY: from.y, endX: to.x, endY: to.y, thickness: 0 };
    const generation = this.beginSegmentQuery();
    for (let tileY = minTileY; tileY <= maxTileY; tileY += 1) {
      for (let tileX = minTileX; tileX <= maxTileX; tileX += 1) {
        const bucket = this.segmentBuckets[this.index(tileX, tileY)]!;
        for (let bucketIndex = 0; bucketIndex < bucket.length; bucketIndex += 1) {
          const segmentIndex = bucket[bucketIndex]!;
          if (this.segmentMarkers[segmentIndex] === generation) continue;
          this.segmentMarkers[segmentIndex] = generation;
          const collider = this.segmentColliders[segmentIndex]!;
          if (!this.isSegmentActive(collider) || (allowClosedDoors && collider.doorIndex >= 0)) continue;
          if (segmentIntersectsThickSegment(movement, collider.geometry, radius)) return true;
        }
      }
    }
    return false;
  }

  private isVisionCellInBounds(cellX: number, cellY: number): boolean {
    return cellX >= 0 && cellY >= 0 && cellX < this.visionWidthCells && cellY < this.visionHeightCells;
  }

  private visionCellIndex(cellX: number, cellY: number): number {
    return cellY * this.visionWidthCells + cellX;
  }

  private gridValue(grid: Uint8Array, worldX: number, worldY: number): boolean {
    const tileX = Math.floor(worldX / this.tileSize);
    const tileY = Math.floor(worldY / this.tileSize);
    if (tileX < 0 || tileY < 0 || tileX >= this.widthTiles || tileY >= this.heightTiles) return true;
    return grid[this.index(tileX, tileY)] === 1;
  }

  private index(tileX: number, tileY: number): number {
    return tileY * this.widthTiles + tileX;
  }

  private inBounds(tileX: number, tileY: number): boolean {
    return tileX >= 0 && tileY >= 0 && tileX < this.widthTiles && tileY < this.heightTiles;
  }
}

function containsTile(obstacle: WorldObstacle, tileX: number, tileY: number): boolean {
  return tileX >= obstacle.tileX && tileY >= obstacle.tileY
    && tileX < obstacle.tileX + obstacle.widthTiles && tileY < obstacle.tileY + obstacle.heightTiles;
}

function circleIntersectsTile(x: number, y: number, radius: number, tileX: number, tileY: number, tileSize: number): boolean {
  const left = tileX * tileSize;
  const top = tileY * tileSize;
  const closestX = Math.max(left, Math.min(x, left + tileSize));
  const closestY = Math.max(top, Math.min(y, top + tileSize));
  const deltaX = x - closestX;
  const deltaY = y - closestY;
  return deltaX * deltaX + deltaY * deltaY < radius * radius;
}
