import { FOG_CELLS_PER_TILE, MAP_TILES, MINIMAP, TILE_SIZE, WORLD_SIZE } from "../config/game-config";
import type { MapDefinition } from "../data/map-definitions";
import { FogOfWarSystem, VisibilityState } from "../systems/fog-of-war-system";
import type { Point } from "../systems/zombie-ai-system";

export enum MinimapTileState {
  Unknown = 0,
  Explored = 1,
  Visible = 2,
}

export enum MinimapTerrain {
  Ground = 0,
  Road = 1,
  Floor = 2,
  Wall = 3,
  Vehicle = 4,
  Door = 5,
}

export const MINIMAP_COLORS = {
  unknown: 0x020405,
  groundExplored: 0x18201d,
  groundVisible: 0x29342f,
  roadExplored: 0x23282a,
  roadVisible: 0x3b4244,
  floorExplored: 0x2c2c27,
  floorVisible: 0x505047,
  wallExplored: 0x41433d,
  wallVisible: 0x77796d,
  vehicleExplored: 0x353c3e,
  vehicleVisible: 0x616b6e,
  doorExplored: 0x4c4335,
  doorVisible: 0x8a7656,
  player: 0x64c7e8,
  companion: 0xd1ad5f,
  safehouse: 0x7193b8,
  extraction: 0x8fbd68,
  cameraViewport: 0xd7e0dc,
} as const;

export interface MinimapDynamicState {
  player: Point;
  companion?: Point;
  companionRescued: boolean;
  companionAlive: boolean;
  collectedParts: number;
  defenseActive: boolean;
  cameraWorldView: { x: number; y: number; width: number; height: number };
}

export class MinimapFogTracker {
  private readonly dirtyFlags = new Uint8Array(MAP_TILES * MAP_TILES);
  private readonly dirtyTiles: number[] = [];

  markFogIndices(indices: readonly number[], fogWidthCells: number): void {
    for (const index of indices) {
      const cellX = index % fogWidthCells;
      const cellY = Math.floor(index / fogWidthCells);
      this.markTile(Math.floor(cellX / FOG_CELLS_PER_TILE), Math.floor(cellY / FOG_CELLS_PER_TILE));
    }
  }

  markTile(tileX: number, tileY: number): void {
    if (tileX < 0 || tileY < 0 || tileX >= MAP_TILES || tileY >= MAP_TILES) return;
    const index = tileY * MAP_TILES + tileX;
    if (this.dirtyFlags[index]) return;
    this.dirtyFlags[index] = 1;
    this.dirtyTiles.push(index);
  }

  consume(callback: (tileIndex: number) => void): void {
    for (const index of this.dirtyTiles) {
      callback(index);
      this.dirtyFlags[index] = 0;
    }
    this.dirtyTiles.length = 0;
  }

  clear(): void {
    for (const index of this.dirtyTiles) this.dirtyFlags[index] = 0;
    this.dirtyTiles.length = 0;
  }

  get size(): number {
    return this.dirtyTiles.length;
  }
}

export function getMinimapTileState(fog: Pick<FogOfWarSystem, "getStateAtCell">, tileX: number, tileY: number): MinimapTileState {
  let explored = false;
  const startX = tileX * FOG_CELLS_PER_TILE;
  const startY = tileY * FOG_CELLS_PER_TILE;
  for (let offsetY = 0; offsetY < FOG_CELLS_PER_TILE; offsetY += 1) {
    for (let offsetX = 0; offsetX < FOG_CELLS_PER_TILE; offsetX += 1) {
      const state = fog.getStateAtCell(startX + offsetX, startY + offsetY);
      if (state === VisibilityState.Visible) return MinimapTileState.Visible;
      if (state === VisibilityState.Explored) explored = true;
    }
  }
  return explored ? MinimapTileState.Explored : MinimapTileState.Unknown;
}

export function getMinimapTerrain(map: MapDefinition, tileX: number, tileY: number): MinimapTerrain {
  if (map.doors.some((door) => door.tileX === tileX && door.tileY === tileY)) return MinimapTerrain.Door;
  for (const obstacle of map.obstacles) {
    if (tileX < obstacle.tileX || tileY < obstacle.tileY
      || tileX >= obstacle.tileX + obstacle.widthTiles
      || tileY >= obstacle.tileY + obstacle.heightTiles) continue;
    return obstacle.kind === "vehicle" ? MinimapTerrain.Vehicle : MinimapTerrain.Wall;
  }
  const key = `${tileX},${tileY}`;
  if (map.floorTiles.has(key)) return MinimapTerrain.Floor;
  if (map.roadTiles.has(key)) return MinimapTerrain.Road;
  return MinimapTerrain.Ground;
}

export function worldToMinimap(worldX: number, worldY: number, output: Point = { x: 0, y: 0 }): Point {
  output.x = clamp(worldX / WORLD_SIZE * MINIMAP.size, 0, MINIMAP.size);
  output.y = clamp(worldY / WORLD_SIZE * MINIMAP.size, 0, MINIMAP.size);
  return output;
}

export function cameraViewportToMinimap(
  worldView: { x: number; y: number; width: number; height: number },
): { x: number; y: number; width: number; height: number } {
  return {
    x: clamp(worldView.x / WORLD_SIZE * MINIMAP.size, 0, MINIMAP.size),
    y: clamp(worldView.y / WORLD_SIZE * MINIMAP.size, 0, MINIMAP.size),
    width: clamp(worldView.width / WORLD_SIZE * MINIMAP.size, 0, MINIMAP.size),
    height: clamp(worldView.height / WORLD_SIZE * MINIMAP.size, 0, MINIMAP.size),
  };
}

export function shouldShowCompanion(rescued: boolean, alive: boolean): boolean {
  return rescued && alive;
}

export function shouldShowExtraction(tileState: MinimapTileState, collectedParts: number, defenseActive: boolean): boolean {
  return tileState !== MinimapTileState.Unknown || collectedParts >= 3 || defenseActive;
}

export function shouldUpdateMinimap(open: boolean, now: number, lastUpdateAt: number): boolean {
  return open && now >= lastUpdateAt + MINIMAP.updateIntervalMs;
}

export class MinimapPanel {
  readonly root: HTMLDivElement;
  private readonly terrainCanvas: HTMLCanvasElement;
  private readonly markerCanvas: HTMLCanvasElement;
  private readonly terrainContext: CanvasRenderingContext2D;
  private readonly markerContext: CanvasRenderingContext2D;
  private readonly terrain = new Uint8Array(MAP_TILES * MAP_TILES);
  private readonly tileStates = new Uint8Array(MAP_TILES * MAP_TILES);
  private readonly dirty = new MinimapFogTracker();
  private readonly markerPoint: Point = { x: 0, y: 0 };
  private initialized = false;
  private needsFullRebuild = false;
  private lastDynamicUpdateAt = Number.NEGATIVE_INFINITY;

  constructor(parent: HTMLElement, private readonly map: MapDefinition, private readonly fog: FogOfWarSystem) {
    this.root = document.createElement("div");
    this.root.className = "minimap-panel pixel-panel";
    this.root.hidden = true;
    this.root.innerHTML = `<div class="minimap-panel__title">도시 지도 · M 닫기</div><div class="minimap-panel__canvas"><canvas data-layer="terrain"></canvas><canvas data-layer="markers"></canvas></div>`;
    const terrainCanvas = this.root.querySelector<HTMLCanvasElement>('canvas[data-layer="terrain"]');
    const markerCanvas = this.root.querySelector<HTMLCanvasElement>('canvas[data-layer="markers"]');
    if (!terrainCanvas || !markerCanvas) throw new Error("Minimap canvas missing");
    this.terrainCanvas = terrainCanvas;
    this.markerCanvas = markerCanvas;
    this.terrainCanvas.width = MINIMAP.size;
    this.terrainCanvas.height = MINIMAP.size;
    this.markerCanvas.width = MINIMAP.size;
    this.markerCanvas.height = MINIMAP.size;
    const terrainContext = this.terrainCanvas.getContext("2d");
    const markerContext = this.markerCanvas.getContext("2d");
    if (!terrainContext || !markerContext) throw new Error("Minimap canvas context unavailable");
    this.terrainContext = terrainContext;
    this.markerContext = markerContext;
    this.terrainContext.imageSmoothingEnabled = false;
    this.markerContext.imageSmoothingEnabled = false;
    for (let tileY = 0; tileY < MAP_TILES; tileY += 1) {
      for (let tileX = 0; tileX < MAP_TILES; tileX += 1) {
        this.terrain[tileY * MAP_TILES + tileX] = getMinimapTerrain(map, tileX, tileY);
      }
    }
    parent.append(this.root);
  }

  toggle(): boolean {
    if (this.isOpen()) this.hide();
    else this.show();
    return this.isOpen();
  }

  show(): void {
    this.root.hidden = false;
    if (!this.initialized || this.needsFullRebuild) this.rebuildTerrain();
    this.lastDynamicUpdateAt = Number.NEGATIVE_INFINITY;
  }

  hide(): void {
    this.root.hidden = true;
  }

  isOpen(): boolean {
    return !this.root.hidden;
  }

  markFogDirty(indices: readonly number[]): void {
    if (!this.isOpen()) {
      this.needsFullRebuild = true;
      return;
    }
    this.dirty.markFogIndices(indices, this.fog.widthCells);
  }

  markWorldTileDirty(tileX: number, tileY: number): void {
    if (!this.isOpen()) {
      this.needsFullRebuild = true;
      return;
    }
    this.dirty.markTile(tileX, tileY);
  }

  update(now: number, state: MinimapDynamicState): boolean {
    if (!this.isOpen()) return false;
    this.dirty.consume((index) => this.drawTerrainTile(index));
    if (!shouldUpdateMinimap(true, now, this.lastDynamicUpdateAt)) return false;
    this.lastDynamicUpdateAt = now;
    this.drawMarkers(state);
    return true;
  }

  destroy(): void {
    this.root.remove();
  }

  private rebuildTerrain(): void {
    for (let index = 0; index < MAP_TILES * MAP_TILES; index += 1) this.drawTerrainTile(index);
    this.dirty.clear();
    this.initialized = true;
    this.needsFullRebuild = false;
  }

  private drawTerrainTile(index: number): void {
    const tileX = index % MAP_TILES;
    const tileY = Math.floor(index / MAP_TILES);
    const state = getMinimapTileState(this.fog, tileX, tileY);
    this.tileStates[index] = state;
    this.terrainContext.fillStyle = colorCss(getMinimapTileColor(this.terrain[index]!, state));
    this.terrainContext.fillRect(
      tileX * MINIMAP.pixelsPerTile,
      tileY * MINIMAP.pixelsPerTile,
      MINIMAP.pixelsPerTile,
      MINIMAP.pixelsPerTile,
    );
  }

  private drawMarkers(state: MinimapDynamicState): void {
    const context = this.markerContext;
    context.clearRect(0, 0, MINIMAP.size, MINIMAP.size);

    const viewport = cameraViewportToMinimap(state.cameraWorldView);
    context.strokeStyle = colorCss(MINIMAP_COLORS.cameraViewport);
    context.lineWidth = 1;
    context.strokeRect(
      Math.floor(viewport.x) + 0.5,
      Math.floor(viewport.y) + 0.5,
      Math.max(1, Math.floor(viewport.width) - 1),
      Math.max(1, Math.floor(viewport.height) - 1),
    );

    const safehouse = this.map.safehouseZone;
    worldToMinimap(safehouse.x + safehouse.width / 2, safehouse.y + safehouse.height / 2, this.markerPoint);
    drawMarker(context, this.markerPoint, MINIMAP_COLORS.safehouse, 2);

    const extractionTileX = Math.floor(this.map.extractionZone.x / TILE_SIZE);
    const extractionTileY = Math.floor(this.map.extractionZone.y / TILE_SIZE);
    const extractionState = this.tileStates[extractionTileY * MAP_TILES + extractionTileX] as MinimapTileState;
    if (shouldShowExtraction(extractionState, state.collectedParts, state.defenseActive)) {
      worldToMinimap(this.map.extractionZone.x, this.map.extractionZone.y, this.markerPoint);
      drawMarker(context, this.markerPoint, MINIMAP_COLORS.extraction, 3);
    }

    if (state.companion && shouldShowCompanion(state.companionRescued, state.companionAlive)) {
      worldToMinimap(state.companion.x, state.companion.y, this.markerPoint);
      drawMarker(context, this.markerPoint, MINIMAP_COLORS.companion, 2);
    }
    worldToMinimap(state.player.x, state.player.y, this.markerPoint);
    drawMarker(context, this.markerPoint, MINIMAP_COLORS.player, 3);
  }
}

export function getMinimapTileColor(terrain: MinimapTerrain, state: MinimapTileState): number {
  if (state === MinimapTileState.Unknown) return MINIMAP_COLORS.unknown;
  const visible = state === MinimapTileState.Visible;
  switch (terrain) {
    case MinimapTerrain.Road: return visible ? MINIMAP_COLORS.roadVisible : MINIMAP_COLORS.roadExplored;
    case MinimapTerrain.Floor: return visible ? MINIMAP_COLORS.floorVisible : MINIMAP_COLORS.floorExplored;
    case MinimapTerrain.Wall: return visible ? MINIMAP_COLORS.wallVisible : MINIMAP_COLORS.wallExplored;
    case MinimapTerrain.Vehicle: return visible ? MINIMAP_COLORS.vehicleVisible : MINIMAP_COLORS.vehicleExplored;
    case MinimapTerrain.Door: return visible ? MINIMAP_COLORS.doorVisible : MINIMAP_COLORS.doorExplored;
    default: return visible ? MINIMAP_COLORS.groundVisible : MINIMAP_COLORS.groundExplored;
  }
}

function drawMarker(context: CanvasRenderingContext2D, point: Point, color: number, size: number): void {
  const x = Math.min(MINIMAP.size - size, Math.max(0, Math.round(point.x) - Math.floor(size / 2)));
  const y = Math.min(MINIMAP.size - size, Math.max(0, Math.round(point.y) - Math.floor(size / 2)));
  context.fillStyle = colorCss(color);
  context.fillRect(x, y, size, size);
}

function colorCss(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
