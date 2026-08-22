import { FOG_CELLS_PER_TILE, LOCAL_MINIMAP_ZOOM_LEVELS, MAP_HEIGHT_TILES, MAP_WIDTH_TILES, MINIMAP, TILE_SIZE, WORLD_HEIGHT, WORLD_WIDTH } from "../config/game-config";
import { getTerrain, TerrainType, type MapDefinition } from "../data/map-definitions";
import { FogOfWarSystem, VisibilityState } from "../systems/fog-of-war-system";
import type { Point } from "../systems/zombie-ai-system";

export type MapDisplayMode = "hidden" | "local" | "full";
export enum MinimapTileState { Unknown = 0, Explored = 1, Visible = 2 }
export enum MinimapTerrain { Ground = 0, Road = 1, Sidewalk = 2, Floor = 3, Wall = 4, Vehicle = 5, Door = 6, OpenDoor = 7, Barricade = 8, Water = 9, RiverBank = 10 }

export const MINIMAP_COLORS = {
  unknown: 0x020405,
  groundExplored: 0x18201d, groundVisible: 0x29342f,
  roadExplored: 0x23282a, roadVisible: 0x3b4244,
  sidewalkExplored: 0x2c3331, sidewalkVisible: 0x59615d,
  floorExplored: 0x2c2c27, floorVisible: 0x505047,
  wallExplored: 0x41433d, wallVisible: 0x77796d,
  vehicleExplored: 0x353c3e, vehicleVisible: 0x616b6e,
  doorExplored: 0x4c4335, doorVisible: 0x8a7656,
  openDoorExplored: 0x343b32, openDoorVisible: 0x65765b,
  barricadeExplored: 0x49382b, barricadeVisible: 0x866140,
  waterExplored: 0x102733, waterVisible: 0x1d5068,
  riverBankExplored: 0x34392c, riverBankVisible: 0x626b50,
  player: 0x64c7e8, companion: 0xd1ad5f, safehouse: 0x7193b8,
  extraction: 0x8fbd68, cameraViewport: 0xd7e0dc,
  zombie: 0xc9403c,
  survivor: 0xe0a65a,
} as const;

export interface MinimapZombieMarkerSource {
  readonly position: Point;
  isAlive(): boolean;
}

export interface MinimapCompanionMarkerSource {
  readonly id: string;
  readonly position: Point;
  readonly rescued: boolean;
  readonly alive: boolean;
}

export interface MinimapDynamicState {
  player: Point; companions: readonly MinimapCompanionMarkerSource[];
  zombies: readonly MinimapZombieMarkerSource[];
  collectedParts: number; defenseActive: boolean;
  developerMode: boolean;
  cameraWorldView: { x: number; y: number; width: number; height: number };
  structures?: readonly { position: Point; kind: string }[];
  structureRevision?: number;
}

export interface LocalMapWindow { startX: number; startY: number; width: number; height: number }

export class MinimapFogTracker {
  private readonly dirtyFlags: Uint8Array;
  private readonly dirtyTiles: number[] = [];
  constructor(private readonly widthTiles = MAP_WIDTH_TILES, private readonly heightTiles = MAP_HEIGHT_TILES) {
    this.dirtyFlags = new Uint8Array(widthTiles * heightTiles);
  }
  markFogIndices(indices: readonly number[], fogWidthCells: number): void {
    for (const index of indices) {
      const cellX = index % fogWidthCells; const cellY = Math.floor(index / fogWidthCells);
      this.markTile(Math.floor(cellX / FOG_CELLS_PER_TILE), Math.floor(cellY / FOG_CELLS_PER_TILE));
    }
  }
  markTile(tileX: number, tileY: number): void {
    if (tileX < 0 || tileY < 0 || tileX >= this.widthTiles || tileY >= this.heightTiles) return;
    const index = tileY * this.widthTiles + tileX;
    if (this.dirtyFlags[index]) return;
    this.dirtyFlags[index] = 1; this.dirtyTiles.push(index);
  }
  consume(callback: (tileIndex: number) => void): void {
    for (const index of this.dirtyTiles) { callback(index); this.dirtyFlags[index] = 0; }
    this.dirtyTiles.length = 0;
  }
  clear(): void { for (const index of this.dirtyTiles) this.dirtyFlags[index] = 0; this.dirtyTiles.length = 0; }
  get size(): number { return this.dirtyTiles.length; }
}

export function cycleMapMode(mode: MapDisplayMode): MapDisplayMode { return mode === "hidden" ? "local" : mode === "local" ? "full" : "hidden"; }
export function shouldPauseSimulationForMap(mode: MapDisplayMode): boolean { return mode === "full"; }

export function getLocalMapWindow(playerTileX: number, playerTileY: number, size: number = MINIMAP.localTiles, widthTiles = MAP_WIDTH_TILES, heightTiles = MAP_HEIGHT_TILES): LocalMapWindow {
  return {
    startX: clamp(Math.floor(playerTileX - size / 2), 0, Math.max(0, widthTiles - size)),
    startY: clamp(Math.floor(playerTileY - size / 2), 0, Math.max(0, heightTiles - size)),
    width: Math.min(size, widthTiles), height: Math.min(size, heightTiles),
  };
}

export function getLocalMinimapPixelsPerTile(tileCount: number): number {
  const pixels = MINIMAP.localSize / tileCount;
  if (!Number.isInteger(pixels)) throw new Error(`Local minimap tile count must divide ${MINIMAP.localSize}: ${tileCount}`);
  return pixels;
}

export function stepLocalMinimapTiles(currentTiles: number, wheelDeltaY: number, mode: MapDisplayMode): number {
  if (mode !== "local" || wheelDeltaY === 0) return currentTiles;
  let index = LOCAL_MINIMAP_ZOOM_LEVELS.findIndex((tiles) => tiles === currentTiles);
  if (index < 0) index = LOCAL_MINIMAP_ZOOM_LEVELS.indexOf(MINIMAP.localTiles);
  index = wheelDeltaY < 0 ? Math.max(0, index - 1) : Math.min(LOCAL_MINIMAP_ZOOM_LEVELS.length - 1, index + 1);
  return LOCAL_MINIMAP_ZOOM_LEVELS[index]!;
}

export function getLocalMarkerPosition(point: Point, window: LocalMapWindow, pixelsPerTile: number, clampOutside = false): Point | undefined {
  const rawX = (point.x / TILE_SIZE - window.startX) * pixelsPerTile;
  const rawY = (point.y / TILE_SIZE - window.startY) * pixelsPerTile;
  const inside = rawX >= 0 && rawY >= 0 && rawX < MINIMAP.localSize && rawY < MINIMAP.localSize;
  if (!inside && !clampOutside) return undefined;
  return {
    x: inside ? rawX : clamp(rawX, 2, MINIMAP.localSize - 3),
    y: inside ? rawY : clamp(rawY, 2, MINIMAP.localSize - 3),
  };
}

export function getMinimapTileState(fog: Pick<FogOfWarSystem, "getStateAtCell">, tileX: number, tileY: number): MinimapTileState {
  let explored = false;
  const startX = tileX * FOG_CELLS_PER_TILE; const startY = tileY * FOG_CELLS_PER_TILE;
  for (let offsetY = 0; offsetY < FOG_CELLS_PER_TILE; offsetY += 1) for (let offsetX = 0; offsetX < FOG_CELLS_PER_TILE; offsetX += 1) {
    const state = fog.getStateAtCell(startX + offsetX, startY + offsetY);
    if (state === VisibilityState.Visible) return MinimapTileState.Visible;
    if (state === VisibilityState.Explored) explored = true;
  }
  return explored ? MinimapTileState.Explored : MinimapTileState.Unknown;
}

export function getMinimapTerrain(map: MapDefinition, tileX: number, tileY: number): MinimapTerrain {
  const door = map.doors.find((candidate) => candidate.tileX === tileX && candidate.tileY === tileY);
  if (door) return door.open ? MinimapTerrain.OpenDoor : MinimapTerrain.Door;
  for (const obstacle of map.obstacles) {
    if (tileX < obstacle.tileX || tileY < obstacle.tileY || tileX >= obstacle.tileX + obstacle.widthTiles || tileY >= obstacle.tileY + obstacle.heightTiles) continue;
    return obstacle.kind === "vehicle" ? MinimapTerrain.Vehicle : obstacle.kind === "wall" ? MinimapTerrain.Wall : MinimapTerrain.Floor;
  }
  if (map.minimapWallCoverage[tileY * map.widthTiles + tileX]) return MinimapTerrain.Wall;
  const terrain = getTerrain(map, tileX, tileY);
  return terrain === TerrainType.Water ? MinimapTerrain.Water : terrain === TerrainType.RiverBank ? MinimapTerrain.RiverBank : terrain === TerrainType.Road || terrain === TerrainType.BridgeRoad ? MinimapTerrain.Road : terrain === TerrainType.Sidewalk ? MinimapTerrain.Sidewalk : terrain === TerrainType.Floor ? MinimapTerrain.Floor : MinimapTerrain.Ground;
}

export function worldToFullMap(worldX: number, worldY: number, output: Point = { x: 0, y: 0 }, worldWidth = WORLD_WIDTH, worldHeight = WORLD_HEIGHT): Point {
  output.x = clamp(worldX / worldWidth * MINIMAP.fullSize, 0, MINIMAP.fullSize);
  output.y = clamp(worldY / worldHeight * MINIMAP.fullSize, 0, MINIMAP.fullSize);
  return output;
}
export const worldToMinimap = worldToFullMap;

export function cameraViewportToFullMap(worldView: { x: number; y: number; width: number; height: number }, worldWidth = WORLD_WIDTH, worldHeight = WORLD_HEIGHT): { x: number; y: number; width: number; height: number } {
  return {
    x: clamp(worldView.x / worldWidth * MINIMAP.fullSize, 0, MINIMAP.fullSize),
    y: clamp(worldView.y / worldHeight * MINIMAP.fullSize, 0, MINIMAP.fullSize),
    width: clamp(worldView.width / worldWidth * MINIMAP.fullSize, 0, MINIMAP.fullSize),
    height: clamp(worldView.height / worldHeight * MINIMAP.fullSize, 0, MINIMAP.fullSize),
  };
}
export const cameraViewportToMinimap = cameraViewportToFullMap;

export function shouldShowCompanion(rescued: boolean, alive: boolean): boolean { return rescued && alive; }
export function shouldShowLocalCompanion(alive: boolean): boolean { return alive; }
export function shouldShowFullCompanion(developerMode: boolean, alive: boolean): boolean { return developerMode && alive; }
export function shouldIterateZombieMarkers(mode: MapDisplayMode): boolean { return mode === "local"; }
export function shouldShowLocalZombie(zombie: MinimapZombieMarkerSource, window: LocalMapWindow, fog?: Pick<FogOfWarSystem, "getStateAtWorld">): boolean {
  return zombie.isAlive() && isPointInLocalWindow(zombie.position, window)
    && (!fog || fog.getStateAtWorld(zombie.position.x, zombie.position.y) === VisibilityState.Visible);
}
export function shouldShowExtraction(tileState: MinimapTileState, collectedParts: number, defenseActive: boolean): boolean { return tileState !== MinimapTileState.Unknown || collectedParts >= 3 || defenseActive; }
export function shouldUpdateMinimap(open: boolean, now: number, lastUpdateAt: number): boolean { return open && now >= lastUpdateAt + MINIMAP.updateIntervalMs; }

export class MinimapPanel {
  readonly root: HTMLDivElement;
  private readonly localRoot: HTMLDivElement;
  private readonly localTitle: HTMLDivElement;
  private readonly fullRoot: HTMLDivElement;
  private readonly localTerrainCanvas: HTMLCanvasElement;
  private readonly localMarkerCanvas: HTMLCanvasElement;
  private readonly fullTerrainCanvas: HTMLCanvasElement;
  private readonly fullFogCanvas: HTMLCanvasElement;
  private readonly fullMarkerCanvas: HTMLCanvasElement;
  private readonly localTerrainContext: CanvasRenderingContext2D;
  private readonly localMarkerContext: CanvasRenderingContext2D;
  private readonly fullTerrainContext: CanvasRenderingContext2D;
  private readonly fullFogContext: CanvasRenderingContext2D;
  private readonly fullMarkerContext: CanvasRenderingContext2D;
  private readonly terrain: Uint8Array;
  private readonly localStates = new Uint8Array(LOCAL_MINIMAP_ZOOM_LEVELS.at(-1)! ** 2);
  private readonly localDirty: MinimapFogTracker;
  private readonly fullDirty: MinimapFogTracker;
  private readonly markerPoint: Point = { x: 0, y: 0 };
  private mode: MapDisplayMode = "hidden";
  private currentLocalTiles: number = MINIMAP.localTiles;
  private localWindow: LocalMapWindow = { startX: -1, startY: -1, width: MINIMAP.localTiles, height: MINIMAP.localTiles };
  private localNeedsRebuild = true;
  private fullInitialized = false;
  private fullFogInitialized = false;
  private lastDynamicUpdateAt = Number.NEGATIVE_INFINITY;
  private lastState?: MinimapDynamicState;
  private readonly localWheelListener = (event: WheelEvent): void => {
    if (this.mode !== "local" || event.deltaY === 0) return;
    event.preventDefault();
    event.stopPropagation();
    this.handleLocalWheel(event.deltaY);
  };

  constructor(parent: HTMLElement, private readonly map: MapDefinition, private readonly fog: FogOfWarSystem) {
    this.root = document.createElement("div"); this.root.className = "minimap-panel"; this.root.hidden = true;
    this.root.innerHTML = `<section class="minimap-panel__local pixel-panel"><div class="minimap-panel__title" data-role="local-title"></div><div class="minimap-panel__canvas"><canvas data-layer="local-terrain"></canvas><canvas data-layer="local-markers"></canvas></div></section><section class="minimap-panel__full pixel-panel"><div class="minimap-panel__title">도시 전체 지도 · M 닫기 · Esc 닫기</div><div class="minimap-panel__canvas"><canvas data-layer="full-terrain"></canvas><canvas data-layer="full-fog"></canvas><canvas data-layer="full-markers"></canvas></div></section>`;
    this.localRoot = requiredElement(this.root, ".minimap-panel__local"); this.fullRoot = requiredElement(this.root, ".minimap-panel__full");
    this.localTitle = requiredElement(this.root, '[data-role="local-title"]');
    this.localTerrainCanvas = requiredCanvas(this.root, 'canvas[data-layer="local-terrain"]');
    this.localMarkerCanvas = requiredCanvas(this.root, 'canvas[data-layer="local-markers"]');
    this.fullTerrainCanvas = requiredCanvas(this.root, 'canvas[data-layer="full-terrain"]');
    this.fullFogCanvas = requiredCanvas(this.root, 'canvas[data-layer="full-fog"]');
    this.fullMarkerCanvas = requiredCanvas(this.root, 'canvas[data-layer="full-markers"]');
    setCanvasSize(this.localTerrainCanvas, MINIMAP.localSize); setCanvasSize(this.localMarkerCanvas, MINIMAP.localSize);
    setCanvasSize(this.fullTerrainCanvas, MINIMAP.fullSize); setCanvasSize(this.fullFogCanvas, MINIMAP.fullSize); setCanvasSize(this.fullMarkerCanvas, MINIMAP.fullSize);
    this.localTerrainContext = requiredContext(this.localTerrainCanvas); this.localMarkerContext = requiredContext(this.localMarkerCanvas);
    this.fullTerrainContext = requiredContext(this.fullTerrainCanvas); this.fullFogContext = requiredContext(this.fullFogCanvas); this.fullMarkerContext = requiredContext(this.fullMarkerCanvas);
    this.terrain = new Uint8Array(map.widthTiles * map.heightTiles);
    for (let y = 0; y < map.heightTiles; y += 1) for (let x = 0; x < map.widthTiles; x += 1) this.terrain[y * map.widthTiles + x] = getMinimapTerrain(map, x, y);
    this.localDirty = new MinimapFogTracker(map.widthTiles, map.heightTiles);
    this.fullDirty = new MinimapFogTracker(map.widthTiles, map.heightTiles);
    this.localRoot.addEventListener("wheel", this.localWheelListener, { passive: false });
    parent.append(this.root); this.updateLocalTitle(); this.syncModeDom();
  }

  setMode(mode: MapDisplayMode): void {
    this.mode = mode; this.lastDynamicUpdateAt = Number.NEGATIVE_INFINITY;
    if (mode === "local") this.localNeedsRebuild = true;
    if (mode === "full" && !this.fullInitialized) this.rebuildFullTerrain();
    if (mode === "full" && !this.fullFogInitialized) this.rebuildFullFog();
    this.syncModeDom();
  }
  cycleMode(): MapDisplayMode { this.setMode(cycleMapMode(this.mode)); return this.mode; }
  toggle(): boolean { this.cycleMode(); return this.isVisible(); }
  hide(): void { this.setMode("hidden"); }
  isLocal(): boolean { return this.mode === "local"; }
  isFull(): boolean { return this.mode === "full"; }
  isVisible(): boolean { return this.mode !== "hidden"; }
  isOpen(): boolean { return this.isVisible(); }
  getMode(): MapDisplayMode { return this.mode; }
  getLocalTileCount(): number { return this.currentLocalTiles; }
  invalidateMarkers(): void { this.lastDynamicUpdateAt = Number.NEGATIVE_INFINITY; }

  handleLocalWheel(deltaY: number): boolean {
    const nextTiles = stepLocalMinimapTiles(this.currentLocalTiles, deltaY, this.mode);
    if (nextTiles === this.currentLocalTiles) return false;
    this.currentLocalTiles = nextTiles;
    this.localWindow = { startX: -1, startY: -1, width: nextTiles, height: nextTiles };
    this.localNeedsRebuild = true;
    this.lastDynamicUpdateAt = Number.NEGATIVE_INFINITY;
    this.localDirty.clear();
    this.updateLocalTitle();
    if (this.lastState) {
      this.updateLocalWindow(this.lastState);
      this.rebuildLocalTerrain();
      this.drawLocalMarkers(this.lastState);
    }
    return true;
  }

  markFogDirty(indices: readonly number[]): void {
    this.localDirty.markFogIndices(indices, this.fog.widthCells);
    this.fullDirty.markFogIndices(indices, this.fog.widthCells);
    if (!this.isLocal()) this.localNeedsRebuild = true;
  }
  markWorldTileDirty(tileX: number, tileY: number): void {
    const index = tileY * this.map.widthTiles + tileX;
    this.terrain[index] = getMinimapTerrain(this.map, tileX, tileY);
    this.localDirty.markTile(tileX, tileY); this.fullDirty.markTile(tileX, tileY); this.localNeedsRebuild = true;
    if (this.fullInitialized) this.drawFullTerrainTile(index);
  }
  markBarricadeTile(tileX: number, tileY: number, present: boolean): void {
    const index = tileY * this.map.widthTiles + tileX;
    this.terrain[index] = present ? MinimapTerrain.Barricade : getMinimapTerrain(this.map, tileX, tileY);
    this.localDirty.markTile(tileX, tileY); this.fullDirty.markTile(tileX, tileY);
    this.localNeedsRebuild = true;
    if (this.fullInitialized) this.drawFullTerrainTile(index);
  }

  update(now: number, state: MinimapDynamicState): boolean {
    if (this.mode === "hidden") return false;
    this.lastState = state;
    if (this.mode === "local") {
      this.updateLocalWindow(state);
      if (this.localNeedsRebuild) this.rebuildLocalTerrain();
      else this.localDirty.consume((index) => this.drawLocalTerrainTile(index));
    }
    if (this.mode === "full") this.fullDirty.consume((index) => this.drawFullFogTile(index));
    if (!shouldUpdateMinimap(true, now, this.lastDynamicUpdateAt)) return false;
    this.lastDynamicUpdateAt = now;
    if (this.mode === "local") this.drawLocalMarkers(state); else this.drawFullMarkers(state);
    return true;
  }

  destroy(): void { this.localRoot.removeEventListener("wheel", this.localWheelListener); this.root.remove(); }

  private syncModeDom(): void {
    this.root.hidden = this.mode === "hidden";
    this.localRoot.hidden = this.mode !== "local";
    this.fullRoot.hidden = this.mode !== "full";
    this.root.dataset.mode = this.mode;
  }
  private updateLocalTitle(): void {
    this.localTitle.textContent = `주변 지도 · ${this.currentLocalTiles}×${this.currentLocalTiles} · 휠 확대/축소 · M 전체`;
  }
  private updateLocalWindow(state: MinimapDynamicState): void {
    const window = getLocalMapWindow(
      Math.floor(state.player.x / TILE_SIZE),
      Math.floor(state.player.y / TILE_SIZE),
      this.currentLocalTiles,
      this.map.widthTiles,
      this.map.heightTiles,
    );
    if (window.startX !== this.localWindow.startX || window.startY !== this.localWindow.startY
      || window.width !== this.localWindow.width || window.height !== this.localWindow.height) {
      this.localWindow = window;
      this.localNeedsRebuild = true;
    }
  }
  private rebuildLocalTerrain(): void {
    this.localTerrainContext.clearRect(0, 0, MINIMAP.localSize, MINIMAP.localSize);
    for (let y = 0; y < this.localWindow.height; y += 1) for (let x = 0; x < this.localWindow.width; x += 1) this.drawLocalTerrainTile((this.localWindow.startY + y) * this.map.widthTiles + this.localWindow.startX + x);
    this.localDirty.clear(); this.localNeedsRebuild = false;
  }
  private drawLocalTerrainTile(index: number): void {
    const tileX = index % this.map.widthTiles; const tileY = Math.floor(index / this.map.widthTiles);
    const localX = tileX - this.localWindow.startX; const localY = tileY - this.localWindow.startY;
    if (localX < 0 || localY < 0 || localX >= this.localWindow.width || localY >= this.localWindow.height) return;
    const state = getMinimapTileState(this.fog, tileX, tileY);
    const pixelsPerTile = getLocalMinimapPixelsPerTile(this.currentLocalTiles);
    this.localStates[localY * this.currentLocalTiles + localX] = state;
    this.localTerrainContext.fillStyle = colorCss(getMinimapTileColor(this.terrain[index] as MinimapTerrain, state));
    this.localTerrainContext.fillRect(localX * pixelsPerTile, localY * pixelsPerTile, pixelsPerTile, pixelsPerTile);
  }
  private rebuildFullTerrain(): void {
    for (let index = 0; index < this.terrain.length; index += 1) this.drawFullTerrainTile(index);
    this.fullInitialized = true;
  }
  private drawFullTerrainTile(index: number): void {
    const tileX = index % this.map.widthTiles; const tileY = Math.floor(index / this.map.widthTiles);
    this.fullTerrainContext.fillStyle = colorCss(getMinimapTileColor(this.terrain[index] as MinimapTerrain, MinimapTileState.Visible));
    const x=Math.floor(tileX/this.map.widthTiles*MINIMAP.fullSize),y=Math.floor(tileY/this.map.heightTiles*MINIMAP.fullSize),nextX=Math.ceil((tileX+1)/this.map.widthTiles*MINIMAP.fullSize),nextY=Math.ceil((tileY+1)/this.map.heightTiles*MINIMAP.fullSize);
    this.fullTerrainContext.fillRect(x,y,Math.max(1,nextX-x),Math.max(1,nextY-y));
  }
  private rebuildFullFog(): void {
    for (let index = 0; index < this.terrain.length; index += 1) this.drawFullFogTile(index);
    this.fullDirty.clear(); this.fullFogInitialized = true;
  }
  private drawFullFogTile(index: number): void {
    const tileX = index % this.map.widthTiles; const tileY = Math.floor(index / this.map.widthTiles);
    const x=Math.floor(tileX/this.map.widthTiles*MINIMAP.fullSize),y=Math.floor(tileY/this.map.heightTiles*MINIMAP.fullSize),nextX=Math.ceil((tileX+1)/this.map.widthTiles*MINIMAP.fullSize),nextY=Math.ceil((tileY+1)/this.map.heightTiles*MINIMAP.fullSize),width=Math.max(1,nextX-x),height=Math.max(1,nextY-y);
    this.fullFogContext.clearRect(x,y,width,height);
    const style = getFullMapFogStyle(getMinimapTileState(this.fog, tileX, tileY));
    if (!style) return;
    this.fullFogContext.fillStyle = style;
    this.fullFogContext.fillRect(x,y,width,height);
  }
  private drawLocalMarkers(state: MinimapDynamicState): void {
    const context = this.localMarkerContext; context.clearRect(0, 0, MINIMAP.localSize, MINIMAP.localSize);
    const pixelsPerTile = getLocalMinimapPixelsPerTile(this.currentLocalTiles);
    drawLocalMarker(context, state.player, this.localWindow, pixelsPerTile, MINIMAP_COLORS.player, 5, false);
    for (const structure of state.structures ?? []) drawLocalMarker(context, structure.position, this.localWindow, pixelsPerTile, structure.kind.includes("wall") || structure.kind.includes("door") ? 0x9c8a67 : 0x708f7d, 2, false);
    let edgeMarkerIndex = 0;
    for (const companion of state.companions) {
      if (!shouldShowLocalCompanion(companion.alive)) continue;
      const inside = isPointInLocalWindow(companion.position, this.localWindow);
      const offset = inside ? 0 : edgeMarkerIndex++ % 3 - 1;
      const color = companion.rescued ? MINIMAP_COLORS.companion : MINIMAP_COLORS.survivor;
      drawLocalMarker(context, companion.position, this.localWindow, pixelsPerTile, color, inside ? 4 : 3, true, offset);
    }
    let zombieCount = 0;
    for (const zombie of state.zombies) {
      if (zombieCount >= 40) break;
      if (!shouldShowLocalZombie(zombie, this.localWindow, this.fog)) continue;
      drawLocalMarker(context, zombie.position, this.localWindow, pixelsPerTile, MINIMAP_COLORS.zombie, 2, false);
      zombieCount += 1;
    }
  }
  private drawFullMarkers(state: MinimapDynamicState): void {
    const context = this.fullMarkerContext; context.clearRect(0, 0, MINIMAP.fullSize, MINIMAP.fullSize);
    const worldWidth=this.map.widthTiles*TILE_SIZE,worldHeight=this.map.heightTiles*TILE_SIZE;
    const viewport = cameraViewportToFullMap(state.cameraWorldView,worldWidth,worldHeight);
    context.strokeStyle = colorCss(MINIMAP_COLORS.cameraViewport); context.lineWidth = 2;
    context.strokeRect(Math.floor(viewport.x) + 0.5, Math.floor(viewport.y) + 0.5, Math.max(1, Math.floor(viewport.width) - 1), Math.max(1, Math.floor(viewport.height) - 1));
    const safehouse = this.map.safehouseZone;
    worldToFullMap(safehouse.x + safehouse.width / 2, safehouse.y + safehouse.height / 2, this.markerPoint,worldWidth,worldHeight); drawMarker(context, this.markerPoint, MINIMAP_COLORS.safehouse, 5, MINIMAP.fullSize);
    const extractionTileX = Math.floor(this.map.extractionZone.x / TILE_SIZE);
    const extractionTileY = Math.floor(this.map.extractionZone.y / TILE_SIZE);
    if (shouldShowExtraction(getMinimapTileState(this.fog, extractionTileX, extractionTileY), state.collectedParts, state.defenseActive)) {
      worldToFullMap(this.map.extractionZone.x, this.map.extractionZone.y, this.markerPoint,worldWidth,worldHeight);
      drawMarker(context, this.markerPoint, MINIMAP_COLORS.extraction, 6, MINIMAP.fullSize);
    }
    for (const companion of state.companions) {
      if (!shouldShowFullCompanion(state.developerMode, companion.alive)) continue;
      worldToFullMap(companion.position.x, companion.position.y, this.markerPoint,worldWidth,worldHeight);
      drawMarker(context, this.markerPoint, companion.rescued ? MINIMAP_COLORS.companion : MINIMAP_COLORS.survivor, 4, MINIMAP.fullSize);
    }
    worldToFullMap(state.player.x, state.player.y, this.markerPoint,worldWidth,worldHeight); drawMarker(context, this.markerPoint, MINIMAP_COLORS.player, 6, MINIMAP.fullSize);
    for (const structure of state.structures ?? []) { worldToFullMap(structure.position.x, structure.position.y, this.markerPoint,worldWidth,worldHeight); drawMarker(context, this.markerPoint, structure.kind.includes("wall") || structure.kind.includes("door") ? 0x9c8a67 : 0x708f7d, 2, MINIMAP.fullSize); }
  }
}

export function getFullMapFogStyle(state: MinimapTileState): string | undefined {
  if (state === MinimapTileState.Visible) return undefined;
  return state === MinimapTileState.Unknown ? "rgba(2,4,5,0.98)" : "rgba(12,22,32,0.74)";
}

export function getMinimapTileColor(terrain: MinimapTerrain, state: MinimapTileState): number {
  if (state === MinimapTileState.Unknown) return MINIMAP_COLORS.unknown;
  const visible = state === MinimapTileState.Visible;
  switch (terrain) {
    case MinimapTerrain.Road: return visible ? MINIMAP_COLORS.roadVisible : MINIMAP_COLORS.roadExplored;
    case MinimapTerrain.Sidewalk: return visible ? MINIMAP_COLORS.sidewalkVisible : MINIMAP_COLORS.sidewalkExplored;
    case MinimapTerrain.Floor: return visible ? MINIMAP_COLORS.floorVisible : MINIMAP_COLORS.floorExplored;
    case MinimapTerrain.Wall: return visible ? MINIMAP_COLORS.wallVisible : MINIMAP_COLORS.wallExplored;
    case MinimapTerrain.Vehicle: return visible ? MINIMAP_COLORS.vehicleVisible : MINIMAP_COLORS.vehicleExplored;
    case MinimapTerrain.Door: return visible ? MINIMAP_COLORS.doorVisible : MINIMAP_COLORS.doorExplored;
    case MinimapTerrain.OpenDoor: return visible ? MINIMAP_COLORS.openDoorVisible : MINIMAP_COLORS.openDoorExplored;
    case MinimapTerrain.Barricade: return visible ? MINIMAP_COLORS.barricadeVisible : MINIMAP_COLORS.barricadeExplored;
    case MinimapTerrain.Water: return visible ? MINIMAP_COLORS.waterVisible : MINIMAP_COLORS.waterExplored;
    case MinimapTerrain.RiverBank: return visible ? MINIMAP_COLORS.riverBankVisible : MINIMAP_COLORS.riverBankExplored;
    default: return visible ? MINIMAP_COLORS.groundVisible : MINIMAP_COLORS.groundExplored;
  }
}

function drawLocalMarker(context: CanvasRenderingContext2D, point: Point, window: LocalMapWindow, pixelsPerTile: number, color: number, size: number, clampOutside: boolean, offset = 0): void {
  const marker = getLocalMarkerPosition(point, window, pixelsPerTile, clampOutside);
  if (!marker) return;
  marker.x = clamp(marker.x + offset, 2, MINIMAP.localSize - 3);
  marker.y = clamp(marker.y - offset, 2, MINIMAP.localSize - 3);
  drawMarker(context, marker, color, size, MINIMAP.localSize);
}
function isPointInLocalWindow(point: Point, window: LocalMapWindow): boolean {
  const tileX = point.x / TILE_SIZE;
  const tileY = point.y / TILE_SIZE;
  return tileX >= window.startX && tileY >= window.startY && tileX < window.startX + window.width && tileY < window.startY + window.height;
}
function drawMarker(context: CanvasRenderingContext2D, point: Point, color: number, size: number, canvasSize: number): void {
  const x = Math.min(canvasSize - size, Math.max(0, Math.round(point.x) - Math.floor(size / 2)));
  const y = Math.min(canvasSize - size, Math.max(0, Math.round(point.y) - Math.floor(size / 2)));
  context.fillStyle = colorCss(color); context.fillRect(x, y, size, size);
}
function requiredCanvas(root: ParentNode, selector: string): HTMLCanvasElement { const canvas = root.querySelector<HTMLCanvasElement>(selector); if (!canvas) throw new Error(`Map canvas missing: ${selector}`); return canvas; }
function requiredElement(root: ParentNode, selector: string): HTMLDivElement { const element = root.querySelector<HTMLDivElement>(selector); if (!element) throw new Error(`Map element missing: ${selector}`); return element; }
function requiredContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D { const context = canvas.getContext("2d"); if (!context) throw new Error("Map canvas context unavailable"); context.imageSmoothingEnabled = false; return context; }
function setCanvasSize(canvas: HTMLCanvasElement, size: number): void { canvas.width = size; canvas.height = size; }
function colorCss(color: number): string { return `#${color.toString(16).padStart(6, "0")}`; }
function clamp(value: number, minimum: number, maximum: number): number { return Math.max(minimum, Math.min(maximum, value)); }
