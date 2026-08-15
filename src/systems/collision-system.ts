import { FOG_CELL_SIZE, MAP_TILES, TILE_SIZE, WORLD_SIZE } from "../config/game-config";
import type { DoorDefinition, WorldObstacle } from "../data/map-definitions";
import type { VisionGrid } from "./fog-of-war-system";
import type { Point } from "./zombie-ai-system";

const VISION_CELLS_PER_TILE = TILE_SIZE / FOG_CELL_SIZE;
const VISION_WIDTH_CELLS = Math.ceil(WORLD_SIZE / FOG_CELL_SIZE);

export class CollisionSystem implements VisionGrid {
  private readonly doors: DoorDefinition[];
  private readonly dynamicObstacles: WorldObstacle[] = [];
  private readonly movementGrid = new Uint8Array(MAP_TILES * MAP_TILES);
  private readonly visionGrid = new Uint8Array(MAP_TILES * MAP_TILES);
  private readonly projectileGrid = new Uint8Array(MAP_TILES * MAP_TILES);
  private readonly lowCoverGrid = new Uint8Array(MAP_TILES * MAP_TILES);
  private readonly visionBlockCells = new Uint8Array(VISION_WIDTH_CELLS * VISION_WIDTH_CELLS);
  private readonly lowCoverCells = new Uint8Array(VISION_WIDTH_CELLS * VISION_WIDTH_CELLS);
  private visionRevisionValue = 0;

  constructor(obstacles: WorldObstacle[], doors: DoorDefinition[]) {
    this.doors = doors;
    obstacles.forEach((obstacle) => this.markObstacle(obstacle, true));
    doors.forEach((door) => this.markDoor(door));
  }

  addDynamicObstacle(obstacle: WorldObstacle): void {
    this.dynamicObstacles.push(obstacle);
    this.markObstacle(obstacle, true);
  }

  getDynamicObstacles(): readonly WorldObstacle[] {
    return this.dynamicObstacles;
  }

  get visionRevision(): number {
    return this.visionRevisionValue;
  }

  setDoorOpen(id: string, open: boolean): void {
    const door = this.doors.find((candidate) => candidate.id === id);
    if (door) {
      door.open = open;
      this.markDoor(door);
    }
  }

  isMovementBlockedWorld(x: number, y: number, radius = 0): boolean {
    if (x - radius < 0 || y - radius < 0 || x + radius >= WORLD_SIZE || y + radius >= WORLD_SIZE) return true;
    const minTileX = Math.floor((x - radius) / TILE_SIZE);
    const maxTileX = Math.floor((x + radius) / TILE_SIZE);
    const minTileY = Math.floor((y - radius) / TILE_SIZE);
    const maxTileY = Math.floor((y + radius) / TILE_SIZE);
    for (let tileY = minTileY; tileY <= maxTileY; tileY += 1) {
      for (let tileX = minTileX; tileX <= maxTileX; tileX += 1) {
        if (!this.movementGrid[this.index(tileX, tileY)]) continue;
        if (circleIntersectsTile(x, y, radius, tileX, tileY)) return true;
      }
    }
    return false;
  }

  moveCircle(position: Point, deltaX: number, deltaY: number, radius: number): Point {
    let x = position.x;
    let y = position.y;
    if (!this.isMovementBlockedWorld(x + deltaX, y, radius)) x += deltaX;
    if (!this.isMovementBlockedWorld(x, y + deltaY, radius)) y += deltaY;
    return { x, y };
  }

  blocksVisionWorld(x: number, y: number): boolean {
    return this.gridValue(this.visionGrid, x, y);
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
    return this.gridValue(this.projectileGrid, x, y);
  }

  hasLineOfSight(from: Point, to: Point, sampleStep = 6): boolean {
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
    const steps = Math.max(1, Math.ceil(distance / sampleStep));
    for (let step = 1; step <= steps; step += 1) {
      const amount = step / steps;
      const point = { x: from.x + (to.x - from.x) * amount, y: from.y + (to.y - from.y) * amount };
      if (this.blocksProjectilesWorld(point.x, point.y)) return point;
    }
    return null;
  }

  isTileBlocked(tileX: number, tileY: number): boolean {
    if (tileX < 0 || tileY < 0 || tileX >= MAP_TILES || tileY >= MAP_TILES) return true;
    return this.movementGrid[this.index(tileX, tileY)] === 1;
  }

  private markObstacle(obstacle: WorldObstacle, value: boolean): void {
    let visionChanged = false;
    for (let y = obstacle.tileY; y < obstacle.tileY + obstacle.heightTiles; y += 1) {
      for (let x = obstacle.tileX; x < obstacle.tileX + obstacle.widthTiles; x += 1) {
        if (x < 0 || y < 0 || x >= MAP_TILES || y >= MAP_TILES) continue;
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

  private markDoor(door: DoorDefinition): void {
    const index = this.index(door.tileX, door.tileY);
    const blocked = door.open ? 0 : 1;
    this.movementGrid[index] = blocked;
    this.visionGrid[index] = blocked;
    this.projectileGrid[index] = blocked;
    if (this.syncVisionCellsForTile(door.tileX, door.tileY)) this.visionRevisionValue += 1;
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
        if (this.visionBlockCells[index] !== blocks || this.lowCoverCells[index] !== lowCover) changed = true;
        this.visionBlockCells[index] = blocks;
        this.lowCoverCells[index] = lowCover;
      }
    }
    return changed;
  }

  private isVisionCellInBounds(cellX: number, cellY: number): boolean {
    return cellX >= 0 && cellY >= 0 && cellX < VISION_WIDTH_CELLS && cellY < VISION_WIDTH_CELLS;
  }

  private visionCellIndex(cellX: number, cellY: number): number {
    return cellY * VISION_WIDTH_CELLS + cellX;
  }

  private gridValue(grid: Uint8Array, worldX: number, worldY: number): boolean {
    const tileX = Math.floor(worldX / TILE_SIZE);
    const tileY = Math.floor(worldY / TILE_SIZE);
    if (tileX < 0 || tileY < 0 || tileX >= MAP_TILES || tileY >= MAP_TILES) return true;
    return grid[this.index(tileX, tileY)] === 1;
  }

  private index(tileX: number, tileY: number): number {
    return tileY * MAP_TILES + tileX;
  }
}

function circleIntersectsTile(x: number, y: number, radius: number, tileX: number, tileY: number): boolean {
  const left = tileX * TILE_SIZE;
  const top = tileY * TILE_SIZE;
  const closestX = Math.max(left, Math.min(x, left + TILE_SIZE));
  const closestY = Math.max(top, Math.min(y, top + TILE_SIZE));
  const deltaX = x - closestX;
  const deltaY = y - closestY;
  return deltaX * deltaX + deltaY * deltaY < radius * radius;
}
